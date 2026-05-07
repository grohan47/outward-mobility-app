from __future__ import annotations

import json
import logging
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

from fastapi_app.graph_models import (
    AIWorkflowDraftOutput,
    GraphEdgeModel,
    GraphModel,
    GraphNodeModel,
    OpportunityDraftModel,
)
from fastapi_app.graph_validation import GraphPolicyValidator

_log = logging.getLogger(__name__)

_STANDARD_PATHWAY_PATH = Path(__file__).parent / "standard_pathway.json"
try:
    _STANDARD_PATHWAY: dict = json.loads(_STANDARD_PATHWAY_PATH.read_text())
except (FileNotFoundError, json.JSONDecodeError):
    _STANDARD_PATHWAY = {}

SYSTEM_PROMPT = """\
You are PRISM, an AI workflow generator for Plaksha University's global affairs office (OGE).
Given a messy opportunity description, output ONLY valid JSON matching this exact schema:
{
  "opportunity": {
    "code": "string or null",
    "title": "string",
    "description": "string",
    "detail_fields": [
      {
        "field_key": "string",
        "label": "string",
        "value": "string",
        "value_type": "text | number | date",
        "display_order": 1,
        "is_student_visible": true
      }
    ],
    "ai_summary_bullets": ["string"],
    "eligibility_criteria": "string or null",
    "funding_available": false,
    "visibility": "plaksha_only"
  },
  "graph": {
    "nodes": [
      {
        "node_key": "string",
        "node_type": "start | reviewer | join_all | join_any | conditional | end",
        "display_name": "string or null",
        "reviewer_email": "string or null",
        "visible_sections": ["all"],
        "allowed_actions": ["approve", "request_changes", "comment"],
        "metadata": {
          "sla_hours": 72,
          "required_inputs": [
            {
              "input_key": "string",
              "label": "string",
              "input_type": "text | number | select | checkbox",
              "options": [],
              "required": true
            }
          ]
        }
      }
    ],
    "edges": [
      {
        "from_node_key": "string",
        "to_node_key": "string",
        "condition_json": null,
        "label": null
      }
    ]
  },
  "applicant_form_fields": ["full_name", "student_id", "email", "cgpa", "statement_of_purpose"],
  "clarifying_questions": [],
  "confidence": 0.85,
  "warnings": [],
  "is_fallback": false
}

GRAPH RULES:
- Every graph must have exactly one start node and at least one end node.
- reviewer nodes must have reviewer_email set. Use @plaksha.edu.in addresses.
- allowed_actions must always include "comment" for every reviewer node.
- Every reviewer node must set metadata.sla_hours. Default: 72. Use a lower value only if the email specifies a tighter timeline (minimum 24).
- For parallel approvals, use start → [reviewerA, reviewerB] → join_all → next.
- Do not include unrestricted code or arbitrary expressions in condition_json.

OPPORTUNITY RULES:
- Only title, code, and description are fixed fields.
- Put destination, term, seats, funding details, host institution, eligibility, and all dates in detail_fields.
- detail_fields value_type must be text, number, or date only.
- Always include field_key "application_deadline" with value_type "date" if a deadline appears.
- Set funding_available: true if the email mentions any scholarship, stipend, or covered costs.
- Set eligibility_criteria to a concise string summarising who can apply.

BATCH / ELIGIBILITY INFERENCE:
- Current year is 2026. Plaksha undergraduate batches: UG 2022 (4th year), UG 2023 (3rd year), UG 2024 (2nd year), UG 2025 (1st year).
- If the opportunity is master's, PhD, postgraduate, or graduate level: eligible batch is UG 2022 only (oldest batch). Add detail_field eligible_batch = "UG 2022".
- If the email says "final year" or "graduating students": eligible batch is UG 2022.
- If the email says a specific batch or year, use that.

APPLICANT FORM FIELDS RULES:
- Always include: full_name, student_id, email, cgpa, statement_of_purpose.
- Add resume_upload if the email mentions CV, resume, or portfolio.
- Add custom_funding_plan if funding, scholarship, or budget justification is mentioned.
- Add custom_research_focus if research, lab, or project topic selection is mentioned.
- Add language_score if language proficiency or IELTS/TOEFL is required.

STANDARD PLAKSHA APPROVAL PATHWAY:
If the email does not specify an explicit reviewer/approval chain, use this graph.
Do NOT ask a clarifying question — just apply it and add the warning below.
Warning to add: "No explicit approval chain found — applied Plaksha standard pathway. Review reviewer assignments before publishing."

  Nodes (in order):
    start                  — node_type: start
    oaa_review             — reviewer, oaa@plaksha.edu.in, sla_hours:72
                             required_input: backlog_status (select: Clear/Active backlog/Misconduct)
    ug_academics_review    — reviewer, ug-academics@plaksha.edu.in, sla_hours:72
                             required_input: cgpa_verified (select: Meets requirement/Below minimum/Cannot verify)
    parallel_join          — node_type: join_all
    program_chair_review   — reviewer, shashikant.pawar@plaksha.edu.in, sla_hours:72
                             required_input: coursework_alignment (select: Strong/Adequate/Weak/No alignment)
    dean_approval          — reviewer, dean@plaksha.edu.in, sla_hours:72
                             allowed_actions: ["approve","reject","comment"]
                             required_input: dean_decision (select: Approved for nomination/Rejected)
    end                    — node_type: end

  Edges:
    start → oaa_review, start → ug_academics_review (two edges, creating parallel branches)
    oaa_review → parallel_join, ug_academics_review → parallel_join
    parallel_join → program_chair_review → dean_approval → end

OTHER RULES:
- If policy is still unclear after applying all rules above, add a clarifying question and lower confidence.
- Output JSON only. No markdown, no prose, no explanations.
"""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class LLMProvider(Protocol):
    """Swap-in interface for any model provider. Mock this in tests."""

    def complete(self, system: str, user: str, timeout: int) -> str:
        """Return raw JSON string from the model."""
        ...


class ClaudeProvider:
    """Anthropic SDK provider with structured output. Requires: pip install anthropic"""

    def complete(self, system: str, user: str, timeout: int) -> str:
        import anthropic
        from fastapi_app.ai_service import CLAUDE_MODEL, CLAUDE_TEMPERATURE

        if not CLAUDE_MODEL:
            raise RuntimeError("CLAUDE_MODEL is not set — fill it in fastapi_app/ai_service.py")

        client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env
        msg = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4096,
            temperature=CLAUDE_TEMPERATURE,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return msg.content[0].text


class GeminiProvider:
    """Google GenAI SDK provider. Requires: pip install google-genai"""

    MODEL = "gemini-2.0-flash"

    def complete(self, system: str, user: str, timeout: int) -> str:
        import os

        from google import genai

        client = genai.Client(api_key=os.environ["AI_API_KEY"])
        resp = client.models.generate_content(
            model=self.MODEL,
            contents=f"{system}\n\n{user}",
            config={"response_mime_type": "application/json"},
        )
        return resp.text


def get_provider() -> LLMProvider:
    """Resolve provider from AI_PROVIDER env var. Defaults to claude."""
    import os

    p = os.environ.get("AI_PROVIDER", "claude").lower()
    if p == "gemini":
        return GeminiProvider()
    return ClaudeProvider()


class AIWorkflowDraftService:
    """
    Generates workflow drafts from messy opportunity descriptions.

    Pipeline:
      generate_draft()
        prompt -> LLM (retry-once) -> Pydantic validation
                                   -> GraphPolicyValidator
                                   -> workflow_drafts row
        on any failure -> deterministic fallback draft (is_fallback=True)

      answer_clarification()
        admin answers -> merged into draft row -> publish_ready re-evaluated
    """

    TIMEOUT_SECONDS = 30
    MAX_RETRIES = 1

    def __init__(self, provider: LLMProvider | None = None) -> None:
        self._provider = provider

    def generate_draft(self, db: sqlite3.Connection, admin_email: str, prompt: str) -> dict[str, Any]:
        """Call model, validate output, persist to workflow_drafts. Returns row dict."""
        provider = self._provider or get_provider()
        t0 = time.monotonic()
        parsed: AIWorkflowDraftOutput | None = None

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                raw = provider.complete(SYSTEM_PROMPT, prompt, self.TIMEOUT_SECONDS)
                parsed = AIWorkflowDraftOutput.model_validate_json(raw)
                errors = GraphPolicyValidator().validate_graph(parsed.graph)
                parsed.warnings.extend(errors)
                _log.info(
                    "ai_draft_ok",
                    extra={
                        "provider": type(provider).__name__,
                        "prompt_chars": len(prompt),
                        "latency_ms": int((time.monotonic() - t0) * 1000),
                        "attempt": attempt,
                        "validation_errors": len(errors),
                    },
                )
                break
            except Exception as exc:
                if attempt < self.MAX_RETRIES:
                    _log.warning("ai_draft_retry", extra={"attempt": attempt, "error": str(exc)})
                    continue
                _log.error(
                    "ai_draft_failed",
                    extra={
                        "provider": type(provider).__name__,
                        "prompt_chars": len(prompt),
                        "latency_ms": int((time.monotonic() - t0) * 1000),
                        "error_type": type(exc).__name__,
                    },
                )
                parsed = self._fallback_draft()
                break

        return self._persist_draft(db, admin_email, parsed)  # type: ignore[arg-type]

    def answer_clarification(
        self, db: sqlite3.Connection, draft_id: int, answers: dict[str, Any]
    ) -> dict[str, Any]:
        """Merge admin answers into draft row, re-evaluate publish_ready."""
        row = db.execute("SELECT * FROM workflow_drafts WHERE id = ?", (draft_id,)).fetchone()
        if not row:
            raise ValueError(f"Draft {draft_id} not found")

        existing: dict[str, Any] = {}
        if row["admin_answers"]:
            try:
                existing = json.loads(row["admin_answers"])
            except json.JSONDecodeError:
                pass
        merged = {**existing, **answers}

        questions: list[str] = []
        if row["clarifying_questions"]:
            try:
                questions = json.loads(row["clarifying_questions"])
            except json.JSONDecodeError:
                pass

        validation_errors: list[str] = []
        is_fallback = False
        if row["draft_output"]:
            try:
                parsed = AIWorkflowDraftOutput.model_validate_json(row["draft_output"])
                validation_errors = GraphPolicyValidator().validate_graph(parsed.graph)
                is_fallback = parsed.is_fallback
            except Exception:
                pass

        all_answered = all(q in merged for q in questions)
        publish_ready = 1 if (not validation_errors and all_answered and not is_fallback) else 0
        status = "ready" if publish_ready else "pending"
        ts = _now_iso()

        with db:
            db.execute(
                """
                UPDATE workflow_drafts
                SET admin_answers = ?, publish_ready = ?, status = ?, updated_at = ?
                WHERE id = ?
                """,
                (json.dumps(merged), publish_ready, status, ts, draft_id),
            )

        updated = db.execute("SELECT * FROM workflow_drafts WHERE id = ?", (draft_id,)).fetchone()
        return dict(updated)

    def _fallback_draft(self) -> AIWorkflowDraftOutput:
        """Minimal deterministic draft returned when the model is unavailable."""
        return AIWorkflowDraftOutput(
            opportunity=OpportunityDraftModel(
                title="Draft Opportunity",
                description="AI generation unavailable. Please edit this draft manually before publishing.",
                detail_fields=[],
                ai_summary_bullets=[],
                funding_available=False,
                visibility="plaksha_only",
            ),
            graph=GraphModel(
                nodes=[
                    GraphNodeModel(node_key="start", node_type="start", display_name="Start"),
                    GraphNodeModel(
                        node_key="oge_review",
                        node_type="reviewer",
                        display_name="OGE Review",
                        reviewer_email="oge@plaksha.edu.in",
                    ),
                    GraphNodeModel(node_key="end", node_type="end", display_name="End"),
                ],
                edges=[
                    GraphEdgeModel(from_node_key="start", to_node_key="oge_review"),
                    GraphEdgeModel(from_node_key="oge_review", to_node_key="end"),
                ],
            ),
            clarifying_questions=[],
            confidence=0.0,
            warnings=["AI generation unavailable — fallback draft used. Review and edit before publishing."],
            is_fallback=True,
        )

    def _persist_draft(
        self, db: sqlite3.Connection, admin_email: str, parsed: AIWorkflowDraftOutput
    ) -> dict[str, Any]:
        """Write to workflow_drafts. Returns the new row as a dict."""
        validation_errors = GraphPolicyValidator().validate_graph(parsed.graph)
        has_questions = bool(parsed.clarifying_questions)
        publish_ready = 1 if (not validation_errors and not has_questions and not parsed.is_fallback) else 0
        status = "ready" if publish_ready else "pending"
        ts = _now_iso()

        with db:
            cursor = db.execute(
                """
                INSERT INTO workflow_drafts
                  (opportunity_id, status, draft_output, clarifying_questions,
                   admin_answers, warnings, confidence, publish_ready,
                   created_by_email, created_at, updated_at)
                VALUES (NULL, ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?)
                """,
                (
                    status,
                    parsed.model_dump_json(),
                    json.dumps(parsed.clarifying_questions),
                    json.dumps(parsed.warnings),
                    parsed.confidence,
                    publish_ready,
                    admin_email,
                    ts,
                    ts,
                ),
            )
            draft_id = cursor.lastrowid

        row = db.execute("SELECT * FROM workflow_drafts WHERE id = ?", (draft_id,)).fetchone()
        return dict(row)
