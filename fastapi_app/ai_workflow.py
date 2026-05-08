from __future__ import annotations

import inspect
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

CHAT_SYSTEM_PROMPT = """\
You are PRISM Setup, a helpful assistant that helps university administrators configure
an opportunity approval workflow. The admin will paste a forwarded email or describe
an opportunity. Your job is to understand it fully before generating the structured data.

Ask clarifying questions ONE AT A TIME about:
- Who should review applications (and in what order)
- Which reviewers need reject authority vs only comment/flag authority
- Eligibility criteria if not explicit
- Application deadline
- Whether parallel reviews are needed

When you have enough information to generate a complete workflow, say EXACTLY:
"I am ready to generate your opportunity!"
Do not output any JSON. Do not guess — ask.
"""

READY_TO_GENERATE_PHRASE = "I am ready to generate your opportunity!"

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
        "visible_sections": [],
        "allowed_actions": ["approve", "flag", "request_changes", "comment"],
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
  "generator_visibility_rules": [],
  "clarifying_questions": [],
  "confidence": 0.85,
  "warnings": [],
  "is_fallback": false
}

GRAPH RULES:
- Every graph must have exactly one start node and at least one end node.
- reviewer nodes must have reviewer_email set. Use exact reviewer addresses when known.
- allowed_actions must always include "comment" for every reviewer node.
- Every reviewer node must set metadata.sla_hours. Default: 72. Use a lower value only if the email specifies a tighter timeline (minimum 24).
- For parallel approvals, use start → [reviewerA, reviewerB] → join_all → next.
- Use join_all for parallel approvals. Do not generate join_any unless the email explicitly describes first-response-wins approval.
- Do not generate conditional nodes unless the email explicitly describes conditional routing.
- Do not include unrestricted code or arbitrary expressions in condition_json.

NODE TYPES:
- start: entry point, no reviewer, exactly 1 per graph
- reviewer: human review step — requires reviewer_email, display_name, sla_hours (default 72)
- join_all: gate that waits for ALL incoming reviewer branches to complete
- end: terminal — use metadata.final_status "APPROVED" or "REJECTED" based on incoming action

EDGE ACTIONS:
- always: unconditional (use from start → reviewer, join_all → next)
- approve: traverse when reviewer approves
- reject: traverse when reviewer rejects (only for nodes with reject authority)
- request_changes: traverse when reviewer requests changes (goes to student rework)

AUTHORITY LEVELS:
- Standard reviewer allowed_actions: ["approve", "flag", "request_changes", "comment"]
- Final approver allowed_actions: ["approve", "reject", "flag", "request_changes", "comment"]
- Only the LAST reviewer in the chain (before end) should have reject authority

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

VISIBILITY RULES:
- generator_visibility_rules should default to [] so the admin can fill eligibility in the UI.
- If the prompt names exact eligible email groups or users, include those lowercase addresses.
- Do not invent visibility rules.

STANDARD APPROVAL PATHWAY:
If the email does not specify an explicit reviewer/approval chain, use this graph.
Replace reviewer_email placeholders with real addresses when known.
If any reviewer_email is a placeholder, set confidence below 0.7 and add a clarifying question asking who exactly should review.
Warning to add: "No explicit approval chain found — applied standard pathway. Review reviewer assignments before publishing."

  Nodes (in order):
    start                  — node_type: start
    oaa_review             — reviewer, oaa@university.edu, sla_hours:72, standard authority
                             required_input: backlog_status (select: Clear/Active backlog/Misconduct)
    ug_academics_review    — reviewer, academics@university.edu, sla_hours:72, standard authority
                             required_input: cgpa_verified (select: Meets requirement/Below minimum/Cannot verify)
    parallel_join          — node_type: join_all
    program_chair_review   — reviewer, chair@university.edu, sla_hours:72, standard authority
                             required_input: coursework_alignment (select: Strong/Adequate/Weak/No alignment)
    dean_approval          — reviewer, dean@university.edu, sla_hours:72, FINAL AUTHORITY
                             allowed_actions: ["approve","reject","flag","request_changes","comment"]
                             required_input: dean_decision (select: Approved for nomination/Rejected)
    end                    — node_type: end

  Edges:
    start → oaa_review, start → ug_academics_review (two edges, creating parallel branches)
    oaa_review → parallel_join, ug_academics_review → parallel_join
    parallel_join → program_chair_review → dean_approval → end

OTHER RULES:
- If policy is still unclear after applying all rules above, add a clarifying question and lower confidence.
- If any reviewer_email is a placeholder, set confidence < 0.7 and add a clarifying question about who exactly should review.
- Output JSON only. No markdown, no prose, no explanations.
"""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class LLMProvider(Protocol):
    """Swap-in interface for any model provider. Mock this in tests."""

    def complete(
        self,
        system: str,
        user: str,
        timeout: int,
        response_format: dict[str, str] | None = None,
    ) -> str:
        """Return raw JSON string from the model."""
        ...


class ClaudeProvider:
    """Anthropic SDK provider with structured output. Requires: pip install anthropic"""

    def complete(
        self,
        system: str,
        user: str,
        timeout: int,
        response_format: dict[str, str] | None = None,
    ) -> str:
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

    def complete(
        self,
        system: str,
        user: str,
        timeout: int,
        response_format: dict[str, str] | None = None,
    ) -> str:
        import os

        from google import genai

        client = genai.Client(api_key=os.environ["AI_API_KEY"])
        kwargs: dict[str, Any] = {"model": self.MODEL, "contents": f"{system}\n\n{user}"}
        if response_format:
            kwargs["config"] = {"response_mime_type": "application/json"}
        resp = client.models.generate_content(**kwargs)
        return resp.text


def get_provider() -> LLMProvider:
    """Resolve provider from AI_PROVIDER env var. Defaults to claude."""
    import os

    p = os.environ.get("AI_PROVIDER", "claude").lower()
    if p == "gemini":
        return GeminiProvider()
    return ClaudeProvider()


def _provider_supports_kwarg(provider: LLMProvider, name: str) -> bool:
    try:
        signature = inspect.signature(provider.complete)
    except (TypeError, ValueError):
        return False
    return name in signature.parameters or any(
        parameter.kind == inspect.Parameter.VAR_KEYWORD
        for parameter in signature.parameters.values()
    )


def _complete(
    provider: LLMProvider,
    system: str,
    user: str,
    timeout: int,
    response_format: dict[str, str] | None = None,
) -> str:
    if response_format and _provider_supports_kwarg(provider, "response_format"):
        return provider.complete(system, user, timeout, response_format=response_format)
    return provider.complete(system, user, timeout)


class AIWorkflowChatService:
    """Conversational setup assistant for two-phase workflow generation."""

    TIMEOUT_SECONDS = 30

    def __init__(self, provider: LLMProvider | None = None) -> None:
        self._provider = provider

    def chat(self, messages: list[dict[str, str]]) -> tuple[str, bool]:
        provider = self._provider or get_provider()
        transcript = self._format_messages(messages)
        reply = _complete(provider, CHAT_SYSTEM_PROMPT, transcript, self.TIMEOUT_SECONDS)
        return reply, READY_TO_GENERATE_PHRASE in reply

    def _format_messages(self, messages: list[dict[str, str]]) -> str:
        lines: list[str] = []
        for message in messages:
            role = str(message.get("role") or "user").strip().lower()
            content = str(message.get("content") or "").strip()
            if role not in {"user", "assistant"} or not content:
                continue
            lines.append(f"{role.upper()}: {content}")
        return "\n\n".join(lines)


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
        parsed = self._generate_parsed(prompt)
        return self._persist_draft(db, admin_email, parsed, original_prompt=prompt)

    def regenerate_with_answers(
        self, db: sqlite3.Connection, draft_id: int, answers: dict[str, Any]
    ) -> dict[str, Any]:
        """Regenerate an existing draft using its original prompt plus admin clarification answers."""
        row = db.execute("SELECT * FROM workflow_drafts WHERE id = ?", (draft_id,)).fetchone()
        if not row:
            raise ValueError(f"Draft {draft_id} not found")

        original_prompt = row["original_prompt"]
        if not original_prompt:
            raise ValueError(f"Draft {draft_id} does not have an original prompt")

        existing: dict[str, Any] = {}
        if row["admin_answers"]:
            try:
                existing = json.loads(row["admin_answers"])
            except json.JSONDecodeError:
                pass
        merged = {**existing, **answers}

        prompt = self._prompt_with_answers(original_prompt, merged)
        try:
            parsed = self._generate_parsed(prompt, fallback_on_failure=False)
        except Exception:
            return self.answer_clarification(db, draft_id, answers)
        return self._update_draft(db, draft_id, parsed, merged)

    def _generate_parsed(self, prompt: str, fallback_on_failure: bool = True) -> AIWorkflowDraftOutput:
        """Call model and return parsed output, falling back deterministically on failure."""
        provider = self._provider or get_provider()
        t0 = time.monotonic()
        parsed: AIWorkflowDraftOutput | None = None

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                raw = _complete(
                    provider,
                    SYSTEM_PROMPT,
                    prompt,
                    self.TIMEOUT_SECONDS,
                    response_format={"type": "json_object"},
                )
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
                if fallback_on_failure:
                    parsed = self._fallback_draft()
                    break
                raise

        assert parsed is not None
        return parsed

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
            generator_visibility_rules=["ug2024@plaksha.edu.in"],
            clarifying_questions=[],
            confidence=0.0,
            warnings=["AI generation unavailable — fallback draft used. Review and edit before publishing."],
            is_fallback=True,
        )

    def _persist_draft(
        self,
        db: sqlite3.Connection,
        admin_email: str,
        parsed: AIWorkflowDraftOutput,
        original_prompt: str | None = None,
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
                  (opportunity_id, original_prompt, status, draft_output, clarifying_questions,
                   admin_answers, warnings, confidence, publish_ready,
                   created_by_email, created_at, updated_at)
                VALUES (NULL, ?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?)
                """,
                (
                    original_prompt,
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

    def _update_draft(
        self,
        db: sqlite3.Connection,
        draft_id: int,
        parsed: AIWorkflowDraftOutput,
        admin_answers: dict[str, Any],
    ) -> dict[str, Any]:
        """Replace AI-generated content for an existing workflow_draft row."""
        validation_errors = GraphPolicyValidator().validate_graph(parsed.graph)
        has_questions = bool(parsed.clarifying_questions)
        publish_ready = 1 if (not validation_errors and not has_questions and not parsed.is_fallback) else 0
        status = "ready" if publish_ready else "pending"
        ts = _now_iso()

        with db:
            db.execute(
                """
                UPDATE workflow_drafts
                SET status = ?, draft_output = ?, clarifying_questions = ?,
                    admin_answers = ?, warnings = ?, confidence = ?,
                    publish_ready = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    status,
                    parsed.model_dump_json(),
                    json.dumps(parsed.clarifying_questions),
                    json.dumps(admin_answers),
                    json.dumps(parsed.warnings),
                    parsed.confidence,
                    publish_ready,
                    ts,
                    draft_id,
                ),
            )

        row = db.execute("SELECT * FROM workflow_drafts WHERE id = ?", (draft_id,)).fetchone()
        return dict(row)

    def _prompt_with_answers(self, original_prompt: str, answers: dict[str, Any]) -> str:
        answers_json = json.dumps(answers, indent=2, sort_keys=True, default=str)
        return (
            f"{original_prompt}\n\n"
            "ADMIN CLARIFICATION ANSWERS:\n"
            "Use these answers to resolve prior clarifying questions and regenerate the full workflow draft.\n"
            f"{answers_json}"
        )
