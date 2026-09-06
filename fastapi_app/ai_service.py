"""Claude-powered AI helpers for PRISM.

Each public function accepts domain data and returns a typed dict.
When ``ANTHROPIC_API_KEY`` is absent the functions fall back to
deterministic dummy payloads so the app never crashes in dev.

All Claude calls use structured output via the tool use pattern:
the Pydantic model schema is passed as ``input_schema``, and
``tool_choice`` forces Claude to fill it.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from pydantic import BaseModel, Field

_log = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────
# Pydantic response models (used for Claude structured output)
# ────────────────────────────────────────────────────────────


class ThreadSummaryResponse(BaseModel):
    headline: str = Field(description="One-line summary of the review thread")
    status: str = Field(description="Current stage and progress summary")
    key_points: list[str] = Field(
        description="3-6 bullet points highlighting blockers, decisions, and unresolved asks"
    )
    recommended_action: str = Field(
        description="Concise next-step recommendation for the reviewer"
    )


class FieldAssessment(BaseModel):
    field: str
    label: str
    status: str = Field(description="One of: present, missing, weak")
    note: str = Field(description="Short assessment of the field value quality")


class ApprovalAssistResponse(BaseModel):
    recommendation: str = Field(
        description="One of: APPROVE_OR_ADVANCE, REQUEST_CHANGES, NEEDS_REVIEW"
    )
    rationale: str = Field(description="2-3 sentence explanation of the recommendation")
    field_assessments: list[FieldAssessment] = Field(
        description="Per-field quality assessment"
    )
    draft_remarks: str = Field(
        description="Suggested approval/review remarks the reviewer can use or edit"
    )
    variables_extracted: dict[str, str] = Field(
        default_factory=dict,
        description="Key variables extracted from the application context as flat JSON key-value pairs (e.g. cgpa, destination, batch, sop_quality)",
    )


class NominationInsightsResponse(BaseModel):
    fit_signals: list[str] = Field(
        description="3-5 key signals to look for in strong candidates"
    )
    screening_questions: list[str] = Field(
        description="3-4 targeted screening questions for this opportunity"
    )
    focus_areas: list[str] = Field(
        description="2-3 focus areas derived from the opportunity description"
    )
    selection_criteria_summary: str = Field(
        description="One-paragraph summary of what makes an ideal candidate"
    )


# ────────────────────────────────────────────────────────────
# Claude client helper
# ────────────────────────────────────────────────────────────

CLAUDE_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")

CLAUDE_TEMPERATURE = 0.2
CLAUDE_TOP_P = 0.95
CLAUDE_TOP_K = 40


def _get_client():
    """Return an ``anthropic.Anthropic`` client, or ``None`` if the key is missing."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import anthropic

        return anthropic.Anthropic(api_key=api_key)
    except Exception as exc:
        _log.warning("anthropic_client_init_failed: %s", exc)
        return None


def _claude_structured(system: str, user_prompt: str, response_model: type[BaseModel]):
    """Call Claude with structured output via tool use. Returns a Pydantic instance or None."""
    if not CLAUDE_MODEL:
        _log.debug("CLAUDE_MODEL is blank — skipping Claude call")
        return None

    client = _get_client()
    if client is None:
        return None

    try:
        import anthropic

        tool_def = {
            "name": "respond",
            "description": "Return the structured response.",
            "input_schema": response_model.model_json_schema(),
        }
        message = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=2048,
            temperature=CLAUDE_TEMPERATURE,
            system=system,
            messages=[{"role": "user", "content": user_prompt}],
            tools=[tool_def],
            tool_choice={"type": "tool", "name": "respond"},
        )
        for block in message.content:
            if isinstance(block, anthropic.types.ToolUseBlock):
                return response_model.model_validate(block.input)
        _log.warning("claude_structured_no_tool_use_block: model=%s", CLAUDE_MODEL)
        return None
    except Exception as exc:
        _log.error("claude_structured_call_failed: %s", exc, exc_info=True)
        return None


# ────────────────────────────────────────────────────────────
# Public AI functions (called by endpoints in main.py)
# ────────────────────────────────────────────────────────────


def ai_thread_summary(detail: dict[str, Any]) -> dict[str, Any]:
    """Summarise the review thread for an application."""
    comments = detail.get("comments") or []
    reviews = detail.get("reviews") or []
    timeline = detail.get("timeline") or []
    application = detail.get("application") or {}
    opportunity = detail.get("opportunity") or {}

    # Build context for Claude
    context_lines: list[str] = [
        f"Opportunity: {opportunity.get('title', 'Unknown')}",
        f"Current stage: {application.get('current_stage_label', 'Unknown')}",
        f"Final status: {application.get('final_status') or 'IN_PROGRESS'}",
        "",
        "--- Reviews ---",
    ]
    for r in reviews[:8]:
        decision = r.get("decision", "REVIEW")
        reviewer = r.get("reviewer_email") or "unknown"
        remarks = r.get("remarks") or ""
        context_lines.append(f"  {decision} by {reviewer}: {remarks[:200]}")

    context_lines.append("")
    context_lines.append("--- Comments ---")
    for c in comments[:8]:
        author = c.get("author_email") or "unknown"
        text = c.get("text") or ""
        context_lines.append(f"  {author}: {text[:200]}")

    user_prompt = "\n".join(context_lines)

    result = _claude_structured(
        system=(
            "You are PRISM, an AI assistant for Plaksha University's outward mobility office. "
            "Summarise the review thread for this application. Highlight blockers, unresolved asks, "
            "and recommend a clear next action. Be concise and factual."
        ),
        user_prompt=user_prompt,
        response_model=ThreadSummaryResponse,
    )

    if result is not None:
        return {
            "summary": {
                "headline": result.headline,
                "status": result.status,
                "key_points": result.key_points,
                "recommended_action": result.recommended_action,
                "activity_counts": {
                    "comments": len(comments),
                    "reviews": len(reviews),
                    "timeline_events": len(timeline),
                },
                "last_updated_at": application.get("updated_at"),
            },
            "is_dummy_ai": False,
        }

    # ── Fallback (no key / model blank / error) ──
    from fastapi_app.main import (
        flatten_comment_points,
        flatten_review_points,
        dedupe_preserve_order,
    )

    status_line = (
        f"Stage: {application.get('current_stage_label') or 'Unknown'}; "
        f"Final status: {application.get('final_status') or 'IN_PROGRESS'}."
    )
    evidence = dedupe_preserve_order(
        flatten_review_points(reviews, 4) + flatten_comment_points(comments, 4)
    )
    if not evidence:
        evidence = ["No review notes or comments yet."]

    return {
        "summary": {
            "headline": f"{opportunity.get('title', 'Application')} review thread snapshot",
            "status": status_line,
            "key_points": evidence[:6],
            "activity_counts": {
                "comments": len(comments),
                "reviews": len(reviews),
                "timeline_events": len(timeline),
            },
            "last_updated_at": application.get("updated_at"),
        },
        "is_dummy_ai": True,
    }


def ai_approval_assist(detail: dict[str, Any]) -> dict[str, Any]:
    """Provide AI-powered approval recommendation for a reviewer."""
    application_file = detail.get("application_file") or {}
    labels = (
        detail.get("field_labels")
        if isinstance(detail.get("field_labels"), dict)
        else {}
    )
    application = detail.get("application") or {}
    opportunity = detail.get("opportunity") or {}
    reviews = detail.get("reviews") or []

    # Build context for Claude
    context_lines: list[str] = [
        f"Opportunity: {opportunity.get('title', 'Unknown')}",
        f"Current stage: {application.get('current_stage_label', 'Unknown')}",
        "",
        "--- Application Fields ---",
    ]
    for key, value in list(application_file.items())[:15]:
        label = str(labels.get(key, key))
        val_str = str(value)[:200] if value else "(empty)"
        context_lines.append(f"  {label}: {val_str}")

    if reviews:
        context_lines.append("")
        context_lines.append("--- Prior Reviews ---")
        for r in reviews[:5]:
            decision = r.get("decision", "REVIEW")
            reviewer = r.get("reviewer_email") or "unknown"
            remarks = r.get("remarks") or ""
            context_lines.append(f"  {decision} by {reviewer}: {remarks[:150]}")

    user_prompt = "\n".join(context_lines)

    result = _claude_structured(
        system=(
            "You are PRISM, an AI assistant helping reviewers evaluate outward-mobility applications "
            "at Plaksha University. Analyse the submitted fields and prior reviews. Recommend whether "
            "to approve, request changes, or flag for further review. Provide per-field assessments "
            "and draft suggested remarks. Be rigorous but fair.\n\n"
            "Also extract key variables from the application context into the variables_extracted field "
            "as flat string key-value pairs. Include: cgpa (numeric string), batch (e.g. 'UG 2023'), "
            "destination (country/university if visible), sop_quality ('strong'/'adequate'/'weak'), "
            "backlog_status ('clear'/'has_backlog'), and any other key facts visible in the data."
        ),
        user_prompt=user_prompt,
        response_model=ApprovalAssistResponse,
    )

    if result is not None:
        return {
            "recommendation": result.recommendation,
            "rationale": result.rationale,
            "quality_checks": [a.model_dump() for a in result.field_assessments],
            "draft_remarks": result.draft_remarks,
            "variables_extracted": result.variables_extracted,
            "is_dummy_ai": False,
        }

    # ── Fallback ──
    checks: list[dict[str, Any]] = []
    for key, value in list(application_file.items())[:8]:
        label = str(labels.get(key, key))
        if value is None or (isinstance(value, str) and not value.strip()):
            checks.append(
                {
                    "field": key,
                    "label": label,
                    "status": "missing",
                    "note": "Value is empty.",
                }
            )
        else:
            checks.append(
                {
                    "field": key,
                    "label": label,
                    "status": "present",
                    "note": f"Captured value preview: {str(value)[:80]}",
                }
            )

    missing_count = sum(1 for item in checks if item["status"] == "missing")
    recommendation = "APPROVE_OR_ADVANCE" if missing_count == 0 else "REQUEST_CHANGES"
    rationale = (
        "All visible fields appear populated."
        if missing_count == 0
        else f"{missing_count} visible field(s) look incomplete; consider send-back."
    )

    variables_extracted: dict[str, str] = {}
    for key, value in list(application_file.items())[:20]:
        if value is not None and str(value).strip():
            variables_extracted[key] = str(value)[:120]

    return {
        "recommendation": recommendation,
        "rationale": rationale,
        "quality_checks": checks,
        "variables_extracted": variables_extracted,
        "is_dummy_ai": True,
    }


def ai_nomination_insights(
    opportunity_title: str,
    opportunity_description: str,
    field_labels: list[str],
) -> dict[str, Any]:
    """Generate nomination screening insights for an opportunity."""
    context_lines: list[str] = [
        f"Opportunity: {opportunity_title}",
        f"Description: {opportunity_description[:500]}",
        "",
        f"Required application fields: {', '.join(field_labels[:10]) or 'None specified'}",
    ]

    user_prompt = "\n".join(context_lines)

    result = _claude_structured(
        system=(
            "You are PRISM, an AI assistant for Plaksha University's outward mobility office. "
            "Given an opportunity description and required fields, generate screening insights "
            "to help reviewers efficiently identify strong candidates. Be specific to the "
            "opportunity — avoid generic advice."
        ),
        user_prompt=user_prompt,
        response_model=NominationInsightsResponse,
    )

    if result is not None:
        return {
            "nominations_assist": {
                "fit_signals_to_look_for": result.fit_signals,
                "screening_questions": result.screening_questions,
                "focus_areas": result.focus_areas,
                "selection_criteria_summary": result.selection_criteria_summary,
            },
            "is_dummy_ai": False,
        }

    # ── Fallback ──
    import re

    focus_areas = [
        segment.strip()[:60]
        for segment in re.split(r"[.\n;]+", opportunity_description)
        if segment.strip()
    ][:3]

    return {
        "nominations_assist": {
            "fit_signals_to_look_for": field_labels[:6]
            or ["Academic fit", "Statement quality", "Readiness"],
            "screening_questions": [
                f"Why is the candidate a fit for {opportunity_title}?",
                "What evidence supports readiness for this opportunity?",
                "Are there any compliance or documentation gaps?",
            ],
            "focus_areas": focus_areas,
        },
        "is_dummy_ai": True,
    }
