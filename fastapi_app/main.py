from __future__ import annotations

import json
import hmac
import hashlib
import secrets
import time
import os
import re
import sqlite3
from contextlib import contextmanager, asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal
from urllib.parse import quote, unquote

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from fastapi_app.ai_service import (
    ai_approval_assist,
    ai_nomination_insights,
    ai_thread_summary,
)
from fastapi_app.ai_workflow import AIWorkflowDraftService
from fastapi_app.graph_execution import GraphExecutionService
from fastapi_app.graph_models import (
    AIWorkflowDraftOutput,
    GraphModel,
    OpportunityDraftModel,
)
from fastapi_app.graph_publishing import GraphPublishingService
from fastapi_app.graph_validation import GraphPolicyValidator
from fastapi_app.opportunity_details import (
    enforced_deadline,
    fetch_detail_fields,
    generate_unique_opportunity_code,
    normalize_ai_summary_bullets,
    normalize_detail_fields,
    parse_ai_summary_json,
    replace_detail_fields,
    replace_opportunity_form_fields as _replace_opportunity_form_fields,
    summary_source_hash,
    validate_cover_image_url,
)
from fastapi_app.sla_management import (
    SLAEmailSender,
    SLAManagementService,
    sla_check_job,
)

DB_PATH = Path(
    os.environ.get(
        "PRISM_DB_PATH",
        str(Path(__file__).resolve().parent.parent / "data" / "prism.sqlite"),
    )
)
SESSION_COOKIE = "prism_session"
SESSION_SECRET = secrets.token_bytes(32)
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

CANONICAL_TABLES = {
    "roles",
    "graph_nodes",
    "user_roles",
    "opportunity_required_fields",
    "sla_reminders_sent",
    "opportunity_detail_fields",
    "student_profiles",
    "email_groups",
    "users",
    "graph_versions",
    "application_comments",
    "sla_policies",
    "email_group_memberships",
    "application_workflow_tasks",
    "sla_breaches",
    "timeline_events",
    "form_field_catalog",
    "graph_edges",
    "opportunities",
    "opportunity_visibility_rules",
    "workflow_drafts",
    "applications",
}

STUDENT_ROLE = "STUDENT"
REVIEWER_ROLE = "REVIEWER"
ADMIN_ROLE = "ADMIN"
REVIEWER_ROLES = {REVIEWER_ROLE}
CUSTOM_FIELD_INPUT_TYPES = {"text", "textarea", "single_select", "multiselect"}


def dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        key = value.strip()
        if not key or key in seen:
            continue
        seen.add(key)
        output.append(key)
    return output


def slugify_input_key(label: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", label.strip().lower()).strip("_")
    return slug or "input"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def valid_email(email: str) -> bool:
    return bool(EMAIL_REGEX.match(email.strip().lower()))


def parse_options_json(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item).strip() for item in parsed if str(item).strip()]


def serialize_form_field(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "field_key": row["field_key"],
        "label": row["label"],
        "description": row["description"],
        "field_hint": row["field_hint"],
        "input_type": row["input_type"],
        "options": parse_options_json(row["options_json"]),
        "section_key": row["section_key"],
    }


def serialize_opportunity(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item["ai_summary_bullets"] = parse_ai_summary_json(item.get("ai_summary_json"))
    return item


def extract_ctas_from_description(description: str | None) -> list[str]:
    if not description:
        return []
    snippets = re.split(r"[.\n;]+", description)
    action_terms = (
        "submit",
        "prepare",
        "highlight",
        "show",
        "include",
        "share",
        "explain",
        "attach",
    )
    ctas: list[str] = []
    for snippet in snippets:
        text = snippet.strip()
        if not text:
            continue
        lowered = text.lower()
        if any(term in lowered for term in action_terms):
            ctas.append(text[:90])
    if not ctas:
        ctas = [segment.strip()[:90] for segment in snippets if segment.strip()][:3]
    return dedupe_preserve_order(ctas)[:4]


@contextmanager
def db_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 10000")
    try:
        yield conn
    finally:
        conn.close()


def execute_script(conn: sqlite3.Connection, script: str) -> None:
    conn.executescript(script)


def list_tables(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()
    return {row["name"] for row in rows}


def table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {row["name"] for row in rows}


def schema_needs_reset(conn: sqlite3.Connection) -> bool:
    return conn.execute("PRAGMA user_version").fetchone()[0] != 1


def reset_schema(conn: sqlite3.Connection) -> None:
    """Initialize an empty database. Destructive reset is only in the CLI."""
    if list_tables(conn):
        raise ValueError("Database is not empty; use the explicit reset command")
    conn.executescript((Path(__file__).parent / "schema.sql").read_text())


def seed_data(conn):
    from fastapi_app.seed import seed_data as seed

    seed(conn)


def ensure_db_initialized() -> None:
    if not DB_PATH.exists():
        raise HTTPException(
            status_code=503, detail="Database is not initialized. Run npm run db:init."
        )
    with db_conn() as conn:
        if schema_needs_reset(conn):
            raise HTTPException(
                status_code=503,
                detail="Database schema is incompatible. Run the explicit database command; startup will not reset data.",
            )


def encode_session(payload: dict) -> str:
    body = quote(json.dumps({**payload, "expires": int(time.time()) + 86400}), safe="")
    return (
        body + "." + hmac.new(SESSION_SECRET, body.encode(), hashlib.sha256).hexdigest()
    )


def parse_session(raw_session: str | None) -> dict[str, Any] | None:
    try:
        body, signature = (raw_session or "").rsplit(".", 1)
        expected = hmac.new(SESSION_SECRET, body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return None
        parsed = json.loads(unquote(body))
        if not isinstance(parsed, dict) or parsed.get("expires", 0) < time.time():
            return None
        return parsed
    except (ValueError, TypeError):
        return None


from fastapi_app.contracts import (
    SessionUser,
    LoginBody,
    WorkspaceSelectBody,
    ReviewerOnboardingBody,
    CommentCreateBody,
    DecisionBody,
    StudentResponseBody,
    AdminApplicationPatchBody,
    CustomFormFieldPayload,
    OpportunityDetailFieldPayload,
    VisibilityRulePayload,
    OpportunityPatchBody,
    OpportunityAIGenerateBody,
    ClarificationAnswerBody,
    WorkflowDraftManualBody,
    WorkflowDraftValidateBody,
    TaskDecideBody,
    SLAPolicyBody,
    SLATestReminderBody,
    SLABreachAcknowledgeBody,
    ApplicationCreateBody,
)


def get_session(
    raw_session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> SessionUser:
    if os.environ.get("PRISM_ENV", "development") != "development":
        raise HTTPException(
            status_code=503,
            detail="Clerk authentication must be configured before deployment.",
        )
    parsed = parse_session(raw_session)
    if not parsed:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        session = SessionUser(**parsed)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid session") from None
    with db_conn() as conn:
        user = get_user_identity(conn, session.email)
        workspaces = get_user_workspaces(conn, session.email)
        if (
            not user
            or user["id"] != session.userId
            or session.role not in {w["role"] for w in workspaces}
        ):
            raise HTTPException(status_code=403, detail="Workspace access was revoked")
    return session


def require_roles(*allowed_roles: str):
    def dependency(session: SessionUser = Depends(get_session)) -> SessionUser:
        if session.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return session

    return dependency


def get_role_display_name(conn: sqlite3.Connection, role_code: str) -> str:
    row = conn.execute(
        "SELECT display_name FROM roles WHERE code = ?", (role_code,)
    ).fetchone()
    return row["display_name"] if row else role_code


def role_dashboard_path(role_code: str) -> str:
    if role_code == STUDENT_ROLE:
        return "/student"
    if role_code == ADMIN_ROLE:
        return "/admin"
    return "/reviewer"


def get_user_identity(conn: sqlite3.Connection, email: str) -> sqlite3.Row | None:
    return conn.execute(
        """
        SELECT id, email, full_name, reviewer_onboarded, pronouns, department, notify_email, notify_digest
        FROM users
        WHERE LOWER(email) = LOWER(?) AND is_active = 1
        LIMIT 1
        """,
        (email,),
    ).fetchone()


def get_user_workspaces(conn, email):
    user = get_user_identity(conn, email)
    if not user:
        return []
    roles = {
        r[0]
        for r in conn.execute(
            "SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=?",
            (user["id"],),
        )
    }
    if conn.execute(
        "SELECT 1 FROM graph_nodes WHERE LOWER(reviewer_email)=LOWER(?)", (email,)
    ).fetchone():
        roles.add(REVIEWER_ROLE)
    return [
        {
            "role": role,
            "roleDisplayName": get_role_display_name(conn, role),
            "dashboardPath": role_dashboard_path(role),
        }
        for role in [STUDENT_ROLE, REVIEWER_ROLE, ADMIN_ROLE]
        if role in roles
    ]


def build_session_payload(
    user: sqlite3.Row | dict[str, Any],
    available_workspaces: list[dict[str, Any]],
    active_role: str | None = None,
) -> dict[str, Any]:
    if not available_workspaces:
        raise HTTPException(
            status_code=403, detail="No workspaces are available for this account."
        )

    active_workspace = next(
        (
            workspace
            for workspace in available_workspaces
            if workspace["role"] == active_role
        ),
        available_workspaces[0],
    )
    return {
        "email": user["email"],
        "name": user["full_name"],
        "role": active_workspace["role"],
        "roleDisplayName": active_workspace["roleDisplayName"],
        "userId": user["id"],
        "reviewerOnboarded": bool(user["reviewer_onboarded"]),
        "pronouns": user["pronouns"],
        "department": user["department"],
        "notifyEmail": bool(user["notify_email"]),
        "notifyDigest": bool(user["notify_digest"]),
        "availableWorkspaces": available_workspaces,
    }


def can_user_view_opportunity(
    conn: sqlite3.Connection, user_id: int, opportunity_id: int
) -> bool:
    rule_count_row = conn.execute(
        "SELECT COUNT(*) AS c FROM opportunity_visibility_rules WHERE opportunity_id = ?",
        (opportunity_id,),
    ).fetchone()
    if not rule_count_row or int(rule_count_row["c"]) == 0:
        return False

    exact_match = conn.execute(
        """
        SELECT 1
        FROM opportunity_visibility_rules rules
        JOIN users u ON LOWER(u.email) = LOWER(rules.rule_value)
        WHERE rules.opportunity_id = ? AND u.id = ?
        LIMIT 1
        """,
        (opportunity_id, user_id),
    ).fetchone()
    if exact_match:
        return True

    group_match = conn.execute(
        """
        SELECT 1
        FROM opportunity_visibility_rules rules
        JOIN email_groups groups
          ON LOWER(groups.email_address) = LOWER(rules.rule_value)
         AND groups.is_active = 1
        JOIN email_group_memberships memberships ON memberships.group_id = groups.id
        WHERE rules.opportunity_id = ? AND memberships.user_id = ?
        LIMIT 1
        """,
        (opportunity_id, user_id),
    ).fetchone()
    return bool(group_match)


def normalize_visibility_rules(rules: list[Any] | None) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for raw_rule in rules or []:
        if isinstance(raw_rule, str):
            rule_type = "EMAIL"
            rule_value = raw_rule.strip().lower()
        else:
            rule = (
                raw_rule
                if isinstance(raw_rule, VisibilityRulePayload)
                else VisibilityRulePayload(**raw_rule)
            )
            rule_type = (rule.ruleType or "EMAIL").strip().upper()
            rule_value = rule.ruleValue.strip().lower()
        rule_value = re.sub(r"^ug(20\d{2})@", r"ug.\1@", rule_value)
        if not rule_value:
            continue
        if not valid_email(rule_value):
            raise HTTPException(
                status_code=400,
                detail=f'Visibility rule "{rule_value}" must be a valid email address.',
            )
        if (
            re.fullmatch(r"ug\.?20\d{2}@plaksha\.edu\.in", rule_value)
            or rule_value == "professors@plaksha.edu.in"
        ):
            rule_type = "GROUP_EMAIL"
        key = (rule_type, rule_value)
        if key in seen:
            continue
        seen.add(key)
        normalized.append({"rule_type": rule_type, "rule_value": rule_value})
    return normalized


def get_opportunity_visibility_rules(
    conn: sqlite3.Connection, opportunity_id: int
) -> list[dict[str, str]]:
    rows = conn.execute(
        """
        SELECT rule_type, rule_value
        FROM opportunity_visibility_rules
        WHERE opportunity_id = ?
        ORDER BY CASE rule_type WHEN 'GROUP_EMAIL' THEN 1 ELSE 2 END, LOWER(rule_value) ASC
        """,
        (opportunity_id,),
    ).fetchall()
    return [
        {
            "ruleType": row["rule_type"],
            "ruleValue": row["rule_value"],
        }
        for row in rows
    ]


def replace_opportunity_visibility_rules(
    conn: sqlite3.Connection,
    opportunity_id: int,
    rules: list[dict[str, str]],
    created_at: str,
) -> None:
    conn.execute(
        "DELETE FROM opportunity_visibility_rules WHERE opportunity_id = ?",
        (opportunity_id,),
    )
    for rule in rules:
        conn.execute(
            """
            INSERT INTO opportunity_visibility_rules (opportunity_id, rule_type, rule_value, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (opportunity_id, rule["rule_type"], rule["rule_value"], created_at),
        )


def get_user_role(conn: sqlite3.Connection, email: str) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT u.id, u.email, u.full_name, u.reviewer_onboarded, u.pronouns, u.department,
               u.notify_email, u.notify_digest,
               r.code AS role_code, r.display_name AS role_display_name
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE u.email = ? AND u.is_active = 1
        ORDER BY CASE r.code
          WHEN 'ADMIN' THEN 1
          WHEN 'REVIEWER' THEN 2
          WHEN 'STUDENT' THEN 3
          ELSE 99 END
        LIMIT 1
        """,
        (email,),
    ).fetchone()


def derive_name_from_email(email: str) -> str:
    local = email.split("@", 1)[0]
    parts = [chunk for chunk in re.split(r"[^a-zA-Z0-9]+", local) if chunk]
    if not parts:
        return "Reviewer"
    return " ".join(part.capitalize() for part in parts)


def normalize_custom_field_key(raw_key: str, fallback_label: str) -> str:
    base = raw_key.strip().lower()
    if not base:
        base = f"custom_{slugify_input_key(fallback_label)}"
    else:
        base = re.sub(r"[^a-z0-9_]+", "_", base).strip("_")
    if not base:
        base = "custom_field"
    if not base.startswith("custom_"):
        base = f"custom_{base}"
    if not re.fullmatch(r"[a-z0-9_]+", base):
        base = f"custom_{slugify_input_key(base)}"
    return base


def normalize_custom_form_fields(
    custom_fields: list[CustomFormFieldPayload],
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    used_keys: set[str] = set()
    for index, field in enumerate(custom_fields, start=1):
        label = field.label.strip()
        if not label:
            raise HTTPException(
                status_code=400, detail=f"Custom field #{index} label cannot be empty."
            )

        base_key = normalize_custom_field_key(field.key or "", label)
        key = base_key
        suffix = 2
        while key in used_keys:
            key = f"{base_key}_{suffix}"
            suffix += 1
        used_keys.add(key)

        input_type = field.inputType.strip().lower()
        if input_type not in CUSTOM_FIELD_INPUT_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported custom field type: {field.inputType}",
            )

        options = dedupe_preserve_order(field.options or [])
        if input_type in {"single_select", "multiselect"} and not options:
            raise HTTPException(
                status_code=400,
                detail=f'Custom field "{label}" requires at least one option.',
            )
        if input_type not in {"single_select", "multiselect"}:
            options = []

        normalized.append(
            {
                "field_key": key,
                "label": label,
                "description": (field.description or "").strip(),
                "field_hint": (field.fieldHint or field.description or "").strip(),
                "input_type": input_type,
                "options": options,
            }
        )
    return normalized


def upsert_custom_form_fields(
    conn: sqlite3.Connection, custom_fields: list[dict[str, Any]]
) -> None:
    for field in custom_fields:
        existing = conn.execute(
            "SELECT field_key, section_key FROM form_field_catalog WHERE field_key = ?",
            (field["field_key"],),
        ).fetchone()
        if existing and existing["section_key"] != "custom":
            raise HTTPException(
                status_code=400,
                detail=f'Field key "{field["field_key"]}" conflicts with a preset field. Rename the custom field.',
            )

        conn.execute(
            """
            INSERT INTO form_field_catalog (field_key, label, description, field_hint, input_type, options_json, section_key, is_active)
            VALUES (?, ?, ?, ?, ?, ?, 'custom', 1)
            ON CONFLICT(field_key) DO UPDATE SET
              label = excluded.label,
              description = excluded.description,
              field_hint = excluded.field_hint,
              input_type = excluded.input_type,
              options_json = excluded.options_json,
              section_key = 'custom',
              is_active = 1
            """,
            (
                field["field_key"],
                field["label"],
                field["description"] or None,
                field["field_hint"] or None,
                field["input_type"],
                json.dumps(field["options"]) if field["options"] else None,
            ),
        )


def ensure_form_fields_exist(
    conn: sqlite3.Connection, form_fields: list[str]
) -> list[str]:
    normalized = dedupe_preserve_order(form_fields)
    if not normalized:
        raise HTTPException(
            status_code=400, detail="At least one form field is required"
        )

    rows = conn.execute(
        "SELECT field_key FROM form_field_catalog WHERE is_active = 1",
    ).fetchall()
    known = {row["field_key"] for row in rows}
    invalid = [key for key in normalized if key not in known]
    if invalid:
        raise HTTPException(
            status_code=400, detail=f"Unknown form fields: {', '.join(invalid)}"
        )
    return normalized


def replace_opportunity_form_fields(
    conn: sqlite3.Connection,
    opportunity_id: int,
    form_fields: list[str],
) -> list[str]:
    return _replace_opportunity_form_fields(conn, opportunity_id, form_fields)


def get_pipeline_steps(conn, opportunity_id):
    row = conn.execute(
        "SELECT id FROM graph_versions WHERE opportunity_id=? AND status='active' ORDER BY version DESC LIMIT 1",
        (opportunity_id,),
    ).fetchone()
    if not row:
        return []
    levels = GraphExecutionService()._definition(conn, row["id"])
    return [
        {
            "step_order": i + 1,
            "step_name": level["name"],
            "reviewer_email": node["reviewer_email"],
            "reviewer_display_name": node.get("display_name"),
            "visible_fields": node.get("visible_sections", []),
            "allowed_actions": node.get("allowed_actions", []),
            "can_view_comments": node.get("metadata", {}).get(
                "can_view_comments", False
            ),
            "required_inputs": [
                {
                    "input_key": f["input_key"],
                    "input_label": f["label"],
                    "input_type": f["input_type"],
                    "is_required": f.get("required", True),
                }
                for f in node.get("metadata", {}).get("required_inputs", [])
            ],
        }
        for i, level in enumerate(levels)
        for node in level["reviewers"]
    ]


def build_visibility_audit_for_opportunity(
    conn: sqlite3.Connection, opportunity_row: sqlite3.Row
) -> dict[str, Any]:
    opportunity_id = int(opportunity_row["id"])
    form_rows = conn.execute(
        """
        SELECT f.field_key, f.label
        FROM opportunity_required_fields orf
        JOIN form_field_catalog f ON f.field_key = orf.field_key
        WHERE orf.opportunity_id = ?
        ORDER BY orf.display_order ASC
        """,
        (opportunity_id,),
    ).fetchall()
    form_fields = [row["field_key"] for row in form_rows]
    form_field_set = set(form_fields)

    label_lookup = {row["field_key"]: row["label"] for row in form_rows}
    steps = get_pipeline_steps(conn, opportunity_id)

    prior_reviewer_input_keys: list[str] = []
    step_audit: list[dict[str, Any]] = []
    has_issues = False

    for step in steps:
        current_required_keys = [
            entry["input_key"] for entry in step["required_inputs"]
        ]
        for entry in step["required_inputs"]:
            label_lookup[entry["input_key"]] = entry["input_label"]

        visible_fields = step["visible_fields"]
        prior_set = set(prior_reviewer_input_keys)
        current_set = set(current_required_keys)

        visible_field_details: list[dict[str, Any]] = []
        unauthorized_visible: list[str] = []
        for key in visible_fields:
            if key in form_field_set:
                category = "student_form"
            elif key in prior_set:
                category = "prior_reviewer_input"
            elif key in current_set:
                category = "current_step_input"
            else:
                category = "unknown_or_invalid"
                unauthorized_visible.append(key)

            visible_field_details.append(
                {
                    "key": key,
                    "label": label_lookup.get(key, key),
                    "category": category,
                }
            )

        visible_prior_inputs = [key for key in visible_fields if key in prior_set]
        hidden_prior_inputs = [
            key for key in prior_reviewer_input_keys if key not in visible_fields
        ]

        step_has_issue = len(unauthorized_visible) > 0
        if step_has_issue:
            has_issues = True

        step_audit.append(
            {
                "step_order": step["step_order"],
                "step_name": step["step_name"],
                "reviewer_email": step["reviewer_email"],
                "can_view_comments": bool(step.get("can_view_comments")),
                "visible_fields": visible_field_details,
                "current_step_required_inputs": [
                    {
                        "key": entry["input_key"],
                        "label": entry["input_label"],
                        "input_type": entry["input_type"],
                    }
                    for entry in step["required_inputs"]
                ],
                "available_prior_reviewer_inputs": [
                    {"key": key, "label": label_lookup.get(key, key)}
                    for key in prior_reviewer_input_keys
                ],
                "visible_prior_reviewer_inputs": [
                    {"key": key, "label": label_lookup.get(key, key)}
                    for key in visible_prior_inputs
                ],
                "hidden_prior_reviewer_inputs": [
                    {"key": key, "label": label_lookup.get(key, key)}
                    for key in hidden_prior_inputs
                ],
                "unauthorized_visible_keys": unauthorized_visible,
                "has_issue": step_has_issue,
            }
        )

        prior_reviewer_input_keys = dedupe_preserve_order(
            prior_reviewer_input_keys + current_required_keys
        )

    return {
        "opportunity": {
            "id": opportunity_id,
            "code": opportunity_row["code"],
            "title": opportunity_row["title"],
        },
        "form_fields": [
            {"key": row["field_key"], "label": row["label"]} for row in form_rows
        ],
        "steps": step_audit,
        "status": "warning" if has_issues else "ok",
    }


def compute_workflow_meta(application_row: sqlite3.Row) -> dict[str, Any]:
    stage_label = application_row["current_stage_label"]
    if application_row["final_status"] == "APPROVED":
        current_stakeholder = "Completed"
    elif application_row["final_status"] == "REJECTED":
        current_stakeholder = "Rejected"
    elif int(application_row["current_step_order"]) <= 0:
        current_stakeholder = "Student Rework"
    else:
        current_stakeholder = stage_label

    stage_code = f"STEP_{application_row['current_step_order']}"
    if int(application_row["current_step_order"]) <= 0:
        stage_code = "STUDENT_REWORK"

    return {
        "stageCode": stage_code,
        "stageLabel": stage_label,
        "currentStakeholder": current_stakeholder,
        "finalStatus": application_row["final_status"],
    }


def get_enriched_application_list(
    conn: sqlite3.Connection, where_clause: str = "", params: tuple[Any, ...] = ()
) -> list[dict[str, Any]]:
    query = f"""
      SELECT a.*, o.title AS opportunity_title, o.term AS opportunity_term, o.destination AS opportunity_destination,
             o.cover_image_url AS opportunity_cover_image_url, o.id AS opportunity_id_join,
             sp.id AS profile_id_join, sp.student_id, sp.program, sp.official_cgpa,
             u.full_name AS student_full_name, u.email AS student_email
      FROM applications a
      JOIN opportunities o ON o.id = a.opportunity_id
      JOIN student_profiles sp ON sp.id = a.student_profile_id
      JOIN users u ON u.id = sp.user_id
      {where_clause}
      ORDER BY a.updated_at DESC
    """
    rows = conn.execute(query, params).fetchall()
    output: list[dict[str, Any]] = []
    for row in rows:
        app = dict(row)
        pipeline_steps = get_pipeline_steps(conn, app["opportunity_id"])
        output.append(
            {
                "id": app["id"],
                "student_profile_id": app["student_profile_id"],
                "opportunity_id": app["opportunity_id"],
                "current_step_order": app["current_step_order"],
                "current_stage": app["current_stage_label"],
                "current_stage_label": app["current_stage_label"],
                "final_status": app["final_status"],
                "submitted_data": app["submitted_data_json"],
                "submitted_at": app["submitted_at"],
                "created_at": app["created_at"],
                "updated_at": app["updated_at"],
                "opportunity": {
                    "id": app["opportunity_id_join"],
                    "title": app["opportunity_title"],
                    "term": app["opportunity_term"],
                    "destination": app["opportunity_destination"],
                    "cover_image_url": app["opportunity_cover_image_url"],
                },
                "student_profile": {
                    "id": app["profile_id_join"],
                    "student_id": app["student_id"],
                    "program": app["program"],
                    "official_cgpa": app["official_cgpa"],
                },
                "student_user": {
                    "full_name": app["student_full_name"],
                    "email": app["student_email"],
                },
                "pipeline_steps": [dict(step) for step in pipeline_steps],
                "workflow": compute_workflow_meta(row),
            }
        )
    return output


def get_application_detail(conn, application_id):
    from fastapi_app.application_data import detail

    return detail(conn, application_id)


def get_active_graph_task(
    conn: sqlite3.Connection,
    application_id: int,
    reviewer_email: str | None = None,
) -> sqlite3.Row | None:
    """Find the active graph workflow task for an application."""
    if reviewer_email:
        return conn.execute(
            """
            SELECT * FROM application_workflow_tasks
            WHERE application_id = ? AND status = 'active'
              AND LOWER(assigned_reviewer_email) = LOWER(?)
            ORDER BY id ASC LIMIT 1
            """,
            (application_id, reviewer_email.strip().lower()),
        ).fetchone()
    return conn.execute(
        """
        SELECT * FROM application_workflow_tasks
        WHERE application_id = ? AND status = 'active'
        ORDER BY id ASC LIMIT 1
        """,
        (application_id,),
    ).fetchone()


def ensure_application_access_for_user(conn, application_id, session):
    app = conn.execute(
        "SELECT a.*,p.user_id FROM applications a JOIN student_profiles p ON p.id=a.student_profile_id WHERE a.id=?",
        (application_id,),
    ).fetchone()
    if not app:
        raise HTTPException(404, "Application not found")
    if session.role == ADMIN_ROLE or (
        session.role == STUDENT_ROLE and app["user_id"] == session.userId
    ):
        return app
    if session.role == REVIEWER_ROLE and get_active_graph_task(
        conn, application_id, session.email
    ):
        return app
    raise HTTPException(403, "Application is not assigned to you")


@asynccontextmanager
async def lifespan(app):
    if os.environ.get("PRISM_ENV", "development") != "development":
        raise RuntimeError(
            "Production authentication is not configured. Integrate Clerk before deployment."
        )
    ensure_db_initialized()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="PRISM FastAPI",
    description="FastAPI backend for PRISM approvals platform",
    version="1.0.0",
    docs_url="/swagger",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        tables = sorted(list_tables(conn))
    return {"ok": True, "backend": "fastapi", "timestamp": now_iso(), "_tables": tables}


@app.post("/api/auth/login")
def auth_login(body: LoginBody, response: Response) -> dict[str, Any]:
    if os.environ.get("PRISM_ENV", "development") != "development":
        raise HTTPException(503, "Clerk must be configured before deployment")
    ensure_db_initialized()
    with db_conn() as conn:
        user = get_user_identity(conn, body.email.strip().lower())
        if not user:
            raise HTTPException(404, "No development account found for that email")
        payload = build_session_payload(user, get_user_workspaces(conn, body.email))
    response.set_cookie(
        SESSION_COOKIE,
        encode_session(payload),
        httponly=True,
        samesite="lax",
        max_age=86400,
        path="/",
    )
    return {"user": payload}


@app.post("/api/auth/select-workspace")
def auth_select_workspace(
    body: WorkspaceSelectBody,
    response: Response,
    session: SessionUser = Depends(get_session),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        user = get_user_identity(conn, session.email)
        if not user:
            raise HTTPException(status_code=404, detail="Account not found")

        available_workspaces = get_user_workspaces(conn, session.email)
        if not any(
            workspace["role"] == body.role for workspace in available_workspaces
        ):
            raise HTTPException(
                status_code=403,
                detail="That workspace is not available for this account.",
            )

        session_payload = build_session_payload(
            user, available_workspaces, active_role=body.role
        )

    response.set_cookie(
        key=SESSION_COOKIE,
        value=encode_session(session_payload),
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24,
        path="/",
    )
    return {"user": session_payload}


@app.post("/api/auth/logout")
def auth_logout(response: Response) -> dict[str, Any]:
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@app.get("/api/auth/me")
def auth_me(session: SessionUser = Depends(get_session)) -> dict[str, Any]:
    return {"user": session.model_dump()}


@app.get("/api/users/me")
def users_me(session: SessionUser = Depends(get_session)) -> dict[str, Any]:
    return {"user": session.model_dump()}


@app.post("/api/reviewer/onboarding")
def complete_reviewer_onboarding(
    body: ReviewerOnboardingBody,
    response: Response,
    session: SessionUser = Depends(require_roles(REVIEWER_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    display_name = " ".join(body.displayName.split())
    pronouns = " ".join((body.pronouns or "").split()) or None
    department = " ".join((body.department or "").split()) or None
    with db_conn() as conn:
        conn.execute(
            """
            UPDATE users
            SET full_name = ?,
                pronouns = ?,
                department = ?,
                notify_email = ?,
                notify_digest = ?,
                reviewer_onboarded = 1
            WHERE id = ?
            """,
            (
                display_name,
                pronouns,
                department,
                1 if body.notifyEmail else 0,
                1 if body.notifyDigest else 0,
                session.userId,
            ),
        )
        conn.commit()
        user = get_user_identity(conn, session.email)
        if not user:
            raise HTTPException(status_code=404, detail="Account not found")
        workspaces = get_user_workspaces(conn, session.email)
        updated = build_session_payload(user, workspaces, active_role=REVIEWER_ROLE)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=encode_session(updated),
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24,
        path="/",
    )
    return {"user": updated}


@app.get("/api/auth/demo-users")
def auth_demo_users() -> dict[str, Any]:
    ensure_db_initialized()
    items: list[dict[str, Any]] = []
    with db_conn() as conn:
        rows = conn.execute(
            """
            SELECT u.email, u.full_name
            FROM users u
            WHERE u.is_active = 1
              AND LOWER(u.email) <> 'ug-academics@plaksha.edu.in'
            ORDER BY u.email ASC
            """
        ).fetchall()
        for row in rows:
            email = str(row["email"]).strip().lower()
            workspaces = get_user_workspaces(conn, email)
            if not workspaces:
                continue
            primary = workspaces[0]
            items.append(
                {
                    "email": email,
                    "full_name": row["full_name"],
                    "role_code": primary["role"],
                    "role_display_name": primary["roleDisplayName"],
                }
            )
    return {"items": items}


@app.get("/api/form-fields")
def form_fields(
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        rows = conn.execute(
            """
            SELECT field_key, label, description, field_hint, input_type, options_json, section_key
            FROM form_field_catalog
            WHERE is_active = 1
            ORDER BY section_key ASC, label ASC
            """
        ).fetchall()
    return {
        "items": [serialize_form_field(row) for row in rows],
    }


@app.get("/api/opportunities")
def list_opportunities(session: SessionUser = Depends(get_session)) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, code, title, description, cover_image_url, term, destination,
                   deadline, seats, status, created_at, updated_at
            FROM opportunities
            ORDER BY created_at DESC
            """
        ).fetchall()
        result: list[dict[str, Any]] = []
        for row in rows:
            if session.role == STUDENT_ROLE and not can_user_view_opportunity(
                conn, session.userId, int(row["id"])
            ):
                continue
            required_fields = conn.execute(
                """
                SELECT f.field_key, f.label, f.input_type, f.section_key, f.description, f.field_hint, f.options_json
                FROM opportunity_required_fields orf
                JOIN form_field_catalog f ON f.field_key = orf.field_key
                WHERE orf.opportunity_id = ?
                ORDER BY orf.display_order ASC
                """,
                (row["id"],),
            ).fetchall()
            item = dict(row)
            item["required_fields"] = [serialize_form_field(f) for f in required_fields]
            item["ai_ctas"] = extract_ctas_from_description(row["description"])
            result.append(item)
    return {"items": result}


@app.get("/api/opportunities/{opportunity_id}")
def opportunity_detail(
    opportunity_id: int, session: SessionUser = Depends(get_session)
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        opp = conn.execute(
            "SELECT * FROM opportunities WHERE id = ?", (opportunity_id,)
        ).fetchone()
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        if session.role == STUDENT_ROLE and not can_user_view_opportunity(
            conn, session.userId, opportunity_id
        ):
            raise HTTPException(
                status_code=403,
                detail="This opportunity is not visible to your account.",
            )

        required_fields = conn.execute(
            """
            SELECT f.field_key, f.label, f.input_type, f.section_key, f.description, f.field_hint, f.options_json
            FROM opportunity_required_fields orf
            JOIN form_field_catalog f ON f.field_key = orf.field_key
            WHERE orf.opportunity_id = ?
            ORDER BY orf.display_order ASC
            """,
            (opportunity_id,),
        ).fetchall()
        steps = get_pipeline_steps(conn, opportunity_id)
        detail_fields = fetch_detail_fields(conn, opportunity_id, visible_only=True)
    return {
        "opportunity": serialize_opportunity(opp),
        "detail_fields": detail_fields,
        "required_fields": [serialize_form_field(row) for row in required_fields],
        "workflow_steps": steps,
    }


@app.get("/api/opportunities/{opportunity_id}/ai-cta")
def opportunity_ai_cta(
    opportunity_id: int, session: SessionUser = Depends(get_session)
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        opp = conn.execute(
            "SELECT id, description FROM opportunities WHERE id = ?", (opportunity_id,)
        ).fetchone()
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        if session.role == STUDENT_ROLE and not can_user_view_opportunity(
            conn, session.userId, opportunity_id
        ):
            raise HTTPException(
                status_code=403,
                detail="This opportunity is not visible to your account.",
            )
    return {"ctas": extract_ctas_from_description(opp["description"])}


@app.get("/api/opportunities/{opportunity_id}/ai-nomination-insights")
def opportunity_ai_nomination_insights(
    opportunity_id: int, session: SessionUser = Depends(get_session)
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        opp = conn.execute(
            "SELECT id, title, description FROM opportunities WHERE id = ?",
            (opportunity_id,),
        ).fetchone()
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        if session.role == STUDENT_ROLE and not can_user_view_opportunity(
            conn, session.userId, opportunity_id
        ):
            raise HTTPException(
                status_code=403,
                detail="This opportunity is not visible to your account.",
            )
        required_fields = conn.execute(
            """
            SELECT f.label
            FROM opportunity_required_fields orf
            JOIN form_field_catalog f ON f.field_key = orf.field_key
            WHERE orf.opportunity_id = ?
            ORDER BY orf.display_order ASC
            """,
            (opportunity_id,),
        ).fetchall()
    return ai_nomination_insights(
        opportunity_title=str(opp["title"]),
        opportunity_description=str(opp["description"] or ""),
        field_labels=[str(row["label"]) for row in required_fields],
    )


@app.get("/api/applications/{application_id}/ai-thread-summary")
def application_ai_thread_summary(
    application_id: int, session: SessionUser = Depends(get_session)
) -> dict[str, Any]:
    detail = application_detail(application_id, session=session)
    return ai_thread_summary(detail)


@app.get("/api/applications/{application_id}/ai-approval-assist")
def application_ai_approval_assist(
    application_id: int, session: SessionUser = Depends(get_session)
) -> dict[str, Any]:
    detail = application_detail(application_id, session=session)
    return ai_approval_assist(detail)


@app.post("/api/applications/{application_id}/ai-summary")
def application_ai_summary(
    application_id: int, session: SessionUser = Depends(get_session)
) -> dict[str, Any]:
    detail = application_detail(application_id, session=session)
    summary = AIWorkflowDraftService().generate_application_summary(detail)
    return {"summary": summary, "is_dummy_ai": False}


@app.get("/api/admin/opportunities")
def admin_list_opportunities(
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        rows = conn.execute(
            """
            SELECT o.*, COUNT(a.id) AS applicant_count
            FROM opportunities o
            LEFT JOIN applications a ON a.opportunity_id = o.id
            GROUP BY o.id
            ORDER BY o.created_at DESC
            """
        ).fetchall()
    return {"items": [dict(row) for row in rows]}


@app.get("/api/admin/opportunities/{opportunity_id}")
def admin_get_opportunity(
    opportunity_id: int, session: SessionUser = Depends(require_roles(ADMIN_ROLE))
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        opp = conn.execute(
            "SELECT * FROM opportunities WHERE id = ?", (opportunity_id,)
        ).fetchone()
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity not found")

        required_fields = conn.execute(
            "SELECT field_key, display_order FROM opportunity_required_fields WHERE opportunity_id = ? ORDER BY display_order ASC",
            (opportunity_id,),
        ).fetchall()
        custom_fields = conn.execute(
            """
            SELECT f.field_key, f.label, f.description, f.field_hint, f.input_type, f.options_json, f.section_key
            FROM opportunity_required_fields orf
            JOIN form_field_catalog f ON f.field_key = orf.field_key
            WHERE orf.opportunity_id = ? AND f.section_key = 'custom'
            ORDER BY orf.display_order ASC
            """,
            (opportunity_id,),
        ).fetchall()
        steps = get_pipeline_steps(conn, opportunity_id)
        visibility_rules = get_opportunity_visibility_rules(conn, opportunity_id)
        detail_fields = fetch_detail_fields(conn, opportunity_id)
    return {
        "opportunity": serialize_opportunity(opp),
        "detail_fields": detail_fields,
        "form_fields": [row["field_key"] for row in required_fields],
        "custom_fields": [serialize_form_field(row) for row in custom_fields],
        "workflow_steps": steps,
        "student_visibility_rules": visibility_rules,
    }


@app.get("/api/admin/visibility-audit")
def admin_visibility_audit(
    opportunity_id: int | None = None,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        if opportunity_id is not None:
            opp = conn.execute(
                "SELECT id, code, title FROM opportunities WHERE id = ?",
                (opportunity_id,),
            ).fetchone()
            if not opp:
                raise HTTPException(status_code=404, detail="Opportunity not found")
            items = [build_visibility_audit_for_opportunity(conn, opp)]
        else:
            opp_rows = conn.execute(
                "SELECT id, code, title FROM opportunities ORDER BY created_at DESC"
            ).fetchall()
            items = [
                build_visibility_audit_for_opportunity(conn, row) for row in opp_rows
            ]
    return {"count": len(items), "items": items}


@app.get("/api/admin/opportunities/{opportunity_id}/visibility-audit")
def admin_visibility_audit_single(
    opportunity_id: int,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        opp = conn.execute(
            "SELECT id, code, title FROM opportunities WHERE id = ?", (opportunity_id,)
        ).fetchone()
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        item = build_visibility_audit_for_opportunity(conn, opp)
    return {"item": item}


@app.post("/api/admin/opportunities/ai-generate")
def admin_generate_opportunity_with_ai(
    body: OpportunityAIGenerateBody,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        draft = AIWorkflowDraftService().generate_draft(
            conn, session.email, body.prompt
        )
    return {"draft_id": draft["id"], "draft": draft}


@app.post("/api/admin/workflow-drafts/manual", status_code=201)
def admin_create_manual_workflow_draft(
    body: WorkflowDraftManualBody,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    parsed = AIWorkflowDraftOutput(
        opportunity=OpportunityDraftModel(**body.opportunity),
        graph=body.graph,
        applicant_form_fields=body.applicantFormFields,
        custom_fields=[f.model_dump() for f in body.customFields],
        student_visibility_rules=[
            rule["rule_value"]
            for rule in normalize_visibility_rules(body.studentVisibilityRules)
        ],
        clarifying_questions=body.clarifyingQuestions,
        confidence=body.confidence,
        warnings=body.warnings,
        is_fallback=body.isFallback,
    )
    validation_errors = GraphPolicyValidator().validate_graph(
        parsed.graph, parsed.applicant_form_fields
    )
    if (
        not parsed.opportunity.title.strip()
        or not parsed.opportunity.description.strip()
    ):
        validation_errors.append("Title and description are required.")
    if not parsed.applicant_form_fields:
        validation_errors.append("Select at least one student field.")
    if not parsed.student_visibility_rules:
        validation_errors.append("Define eligible student emails or cohorts.")
    merged_warnings = list(dict.fromkeys([*parsed.warnings, *validation_errors]))
    publish_ready = (
        1
        if not validation_errors
        and not parsed.clarifying_questions
        and not parsed.is_fallback
        else 0
    )
    status = "ready" if publish_ready else "pending"
    ts = now_iso()

    with db_conn() as conn:
        conn.execute("BEGIN IMMEDIATE")
        if body.opportunityId is not None:
            opp = conn.execute(
                "SELECT id FROM opportunities WHERE id = ?", (body.opportunityId,)
            ).fetchone()
            if not opp:
                raise HTTPException(status_code=404, detail="Opportunity not found")
        if body.draftId:
            old = conn.execute(
                "SELECT * FROM workflow_drafts WHERE id=? AND created_by_email=? AND status!='published'",
                (body.draftId, session.email),
            ).fetchone()
            if not old:
                raise HTTPException(
                    status_code=409,
                    detail="Draft has been published or is not owned by you. Reload the editor.",
                )
            if (
                body.expectedUpdatedAt is not None
                and old["updated_at"] != body.expectedUpdatedAt
            ):
                raise HTTPException(
                    409, "Draft changed in another editor. Reload before saving."
                )
            conn.execute(
                "UPDATE workflow_drafts SET opportunity_id=?, status=?,draft_output=?,clarifying_questions=?,warnings=?,confidence=?,publish_ready=?,updated_at=? WHERE id=?",
                (
                    body.opportunityId,
                    status,
                    parsed.model_copy(
                        update={"warnings": merged_warnings}
                    ).model_dump_json(),
                    json.dumps(parsed.clarifying_questions),
                    json.dumps(merged_warnings),
                    parsed.confidence,
                    publish_ready,
                    ts,
                    body.draftId,
                ),
            )
            conn.commit()
            return {
                "draft_id": body.draftId,
                "draft": dict(
                    conn.execute(
                        "SELECT * FROM workflow_drafts WHERE id=?", (body.draftId,)
                    ).fetchone()
                ),
            }
        cursor = conn.execute(
            """
            INSERT INTO workflow_drafts
              (opportunity_id, status, draft_output, clarifying_questions,
               admin_answers, warnings, confidence, publish_ready,
               created_by_email, created_at, updated_at)
            VALUES (?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?)
            """,
            (
                body.opportunityId,
                status,
                parsed.model_copy(
                    update={"warnings": merged_warnings}
                ).model_dump_json(),
                json.dumps(parsed.clarifying_questions),
                json.dumps(merged_warnings),
                parsed.confidence,
                publish_ready,
                session.email,
                ts,
                ts,
            ),
        )
        draft_id = int(cursor.lastrowid)
        conn.commit()
        row = conn.execute(
            "SELECT * FROM workflow_drafts WHERE id = ?", (draft_id,)
        ).fetchone()

    return {"draft_id": draft_id, "draft": dict(row)}


@app.post("/api/admin/workflow-drafts/validate")
def admin_validate_workflow_draft(
    body: WorkflowDraftValidateBody,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    parsed = AIWorkflowDraftOutput(
        opportunity=OpportunityDraftModel(**body.opportunity),
        graph=body.graph,
        applicant_form_fields=body.applicantFormFields,
        custom_fields=[f.model_dump() for f in body.customFields],
        student_visibility_rules=[
            rule["rule_value"]
            for rule in normalize_visibility_rules(body.studentVisibilityRules)
        ],
        clarifying_questions=body.clarifyingQuestions,
        confidence=body.confidence,
        warnings=body.warnings,
        is_fallback=body.isFallback,
    )
    validation_errors = GraphPolicyValidator().validate_graph(
        parsed.graph, parsed.applicant_form_fields
    )
    if (
        not parsed.opportunity.title.strip()
        or not parsed.opportunity.description.strip()
    ):
        validation_errors.append("Title and description are required.")
    if not parsed.applicant_form_fields:
        validation_errors.append("Select at least one student field.")
    if not parsed.student_visibility_rules:
        validation_errors.append("Define eligible student emails or cohorts.")
    merged_warnings = list(dict.fromkeys([*parsed.warnings, *validation_errors]))
    publish_ready = (
        len(validation_errors) == 0
        and len(parsed.clarifying_questions) == 0
        and not parsed.is_fallback
    )
    return {
        "warnings": merged_warnings,
        "validation_errors": validation_errors,
        "clarifying_questions": parsed.clarifying_questions,
        "publish_ready": publish_ready,
        "is_fallback": parsed.is_fallback,
    }


@app.get("/api/admin/workflow-drafts")
def admin_list_workflow_drafts(
    opportunity_id: int | None = None,
    limit: int = 25,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    limit = max(1, min(100, int(limit)))
    query = """
        SELECT * FROM workflow_drafts
        WHERE created_by_email = ? AND (? IS NULL OR opportunity_id = ?)
        ORDER BY updated_at DESC, id DESC
        LIMIT ?
    """
    with db_conn() as conn:
        rows = conn.execute(
            query, (session.email, opportunity_id, opportunity_id, limit)
        ).fetchall()
    return {"items": [dict(row) for row in rows]}


@app.get("/api/admin/workflow-drafts/{draft_id}")
def admin_get_workflow_draft(
    draft_id: int,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        row = conn.execute(
            "SELECT * FROM workflow_drafts WHERE id = ? AND created_by_email = ?",
            (draft_id, session.email),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"draft": dict(row)}


def _require_editable_draft(conn, draft_id, email):
    row = conn.execute(
        "SELECT * FROM workflow_drafts WHERE id=? AND created_by_email=? AND status!='published'",
        (draft_id, email),
    ).fetchone()
    if not row:
        raise HTTPException(409, "Draft has been published or is not owned by you.")
    return row


@app.post("/api/admin/workflow-drafts/{draft_id}/answer")
def admin_answer_workflow_draft_clarification(
    draft_id: int,
    body: ClarificationAnswerBody,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        conn.execute("BEGIN IMMEDIATE")
        _require_editable_draft(conn, draft_id, session.email)
        try:
            updated = AIWorkflowDraftService().answer_clarification(
                conn, draft_id, body.answers
            )
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc))
    return {"draft": updated}


@app.post("/api/admin/workflow-drafts/{draft_id}/regenerate")
def admin_regenerate_workflow_draft(
    draft_id: int,
    body: ClarificationAnswerBody,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        # Lock draft mutations together so a generation cannot overwrite a publish.
        conn.execute("BEGIN IMMEDIATE")
        _require_editable_draft(conn, draft_id, session.email)
        try:
            updated = AIWorkflowDraftService().regenerate_with_answers(
                conn, draft_id, body.answers
            )
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from None
    return {"draft_id": draft_id, "draft": updated}


@app.post("/api/admin/workflow-drafts/{draft_id}/publish")
def admin_publish_workflow_draft(
    draft_id: int, session: SessionUser = Depends(require_roles(ADMIN_ROLE))
) -> dict[str, Any]:
    with db_conn() as conn:
        try:
            graph_version_id = GraphPublishingService().publish(
                conn, draft_id, session.email
            )
        except (ValueError, sqlite3.IntegrityError) as exc:
            raise HTTPException(400, str(exc)) from None
        row = conn.execute(
            "SELECT opportunity_id FROM graph_versions WHERE id=?", (graph_version_id,)
        ).fetchone()
        return {
            "graph_version_id": graph_version_id,
            "opportunity_id": row["opportunity_id"],
        }


@app.post("/api/reviewer/tasks/{task_id}/decide")
def reviewer_decide_task(
    task_id: int,
    body: TaskDecideBody,
    session: SessionUser = Depends(require_roles(*REVIEWER_ROLES)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        try:
            result = GraphExecutionService().transition(
                conn,
                task_id,
                body.decision,
                session.email,
                comment=body.comment,
                reviewer_data=body.reviewer_data,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    return result.model_dump()


@app.get("/api/admin/opportunities/{opportunity_id}/graph")
def admin_get_opportunity_graph(
    opportunity_id: int,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        opp = conn.execute(
            "SELECT id FROM opportunities WHERE id = ?", (opportunity_id,)
        ).fetchone()
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        return GraphPublishingService().get_graph(conn, opportunity_id)


@app.patch("/api/admin/opportunities/{opportunity_id}")
def admin_patch_opportunity(
    opportunity_id: int,
    body: OpportunityPatchBody,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    updates = body.model_dump(exclude_unset=True)
    if set(updates) != {"status"} or updates["status"] not in {"published", "archived"}:
        raise HTTPException(
            409, "Edit a draft and publish a new version to change an opportunity"
        )
    with db_conn() as conn:
        conn.execute(
            "UPDATE opportunities SET status=?,updated_at=? WHERE id=?",
            (updates["status"], now_iso(), opportunity_id),
        )
        conn.commit()
    return admin_get_opportunity(opportunity_id, session)


@app.delete("/api/admin/opportunities/{opportunity_id}")
def admin_delete_opportunity(
    opportunity_id: int,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        opp = conn.execute(
            "SELECT id, code, title FROM opportunities WHERE id = ?", (opportunity_id,)
        ).fetchone()
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity not found")

        app_rows = conn.execute(
            "SELECT id FROM applications WHERE opportunity_id = ?",
            (opportunity_id,),
        ).fetchall()
        application_ids = [int(row["id"]) for row in app_rows]

        if application_ids:
            placeholders = ", ".join("?" for _ in application_ids)
            params = tuple(application_ids)

            task_rows = conn.execute(
                f"SELECT id FROM application_workflow_tasks WHERE application_id IN ({placeholders})",
                params,
            ).fetchall()
            task_ids = [int(row["id"]) for row in task_rows]
            if task_ids:
                t_placeholders = ", ".join("?" for _ in task_ids)
                t_params = tuple(task_ids)
                conn.execute(
                    f"DELETE FROM sla_reminders_sent WHERE task_id IN ({t_placeholders})",
                    t_params,
                )
                conn.execute(
                    f"DELETE FROM sla_breaches WHERE task_id IN ({t_placeholders})",
                    t_params,
                )

            conn.execute(
                f"UPDATE application_workflow_tasks SET return_to_task_id = NULL WHERE application_id IN ({placeholders})",
                params,
            )
            conn.execute(
                f"DELETE FROM application_workflow_tasks WHERE application_id IN ({placeholders})",
                params,
            )
            conn.execute(
                f"DELETE FROM timeline_events WHERE application_id IN ({placeholders})",
                params,
            )
            conn.execute(
                f"DELETE FROM application_comments WHERE application_id IN ({placeholders})",
                params,
            )

            conn.execute(
                "DELETE FROM applications WHERE opportunity_id = ?", (opportunity_id,)
            )

        graph_rows = conn.execute(
            "SELECT id FROM graph_versions WHERE opportunity_id = ?", (opportunity_id,)
        ).fetchall()
        graph_ids = [int(row["id"]) for row in graph_rows]
        if graph_ids:
            g_placeholders = ", ".join("?" for _ in graph_ids)
            g_params = tuple(graph_ids)

            node_rows = conn.execute(
                f"SELECT id FROM graph_nodes WHERE graph_version_id IN ({g_placeholders})",
                g_params,
            ).fetchall()
            node_ids = [int(row["id"]) for row in node_rows]
            if node_ids:
                n_placeholders = ", ".join("?" for _ in node_ids)
                n_params = tuple(node_ids)
                conn.execute(
                    f"DELETE FROM sla_policies WHERE graph_node_id IN ({n_placeholders})",
                    n_params,
                )

            conn.execute(
                f"DELETE FROM graph_edges WHERE graph_version_id IN ({g_placeholders})",
                g_params,
            )
            conn.execute(
                f"DELETE FROM graph_nodes WHERE graph_version_id IN ({g_placeholders})",
                g_params,
            )
            conn.execute(
                "DELETE FROM graph_versions WHERE opportunity_id = ?", (opportunity_id,)
            )

        conn.execute(
            "DELETE FROM workflow_drafts WHERE opportunity_id = ?", (opportunity_id,)
        )

        conn.execute("DELETE FROM opportunities WHERE id = ?", (opportunity_id,))

        conn.execute(
            """
            DELETE FROM form_field_catalog
            WHERE section_key = 'custom'
              AND field_key NOT IN (
                SELECT DISTINCT field_key FROM opportunity_required_fields
              )
            """
        )

        conn.commit()

    return {
        "ok": True,
        "deletedOpportunityId": int(opp["id"]),
        "deletedOpportunityCode": opp["code"],
        "deletedApplications": len(application_ids),
    }


@app.post("/api/applications", status_code=201)
def create_application(
    body: ApplicationCreateBody,
    session: SessionUser = Depends(require_roles(STUDENT_ROLE)),
) -> dict[str, Any]:
    from fastapi_app.application_data import form_schema, validate_submission
    from fastapi_app.graph_execution import transaction

    with db_conn() as conn, transaction(conn):
        profile = conn.execute(
            "SELECT id FROM student_profiles WHERE user_id=?", (session.userId,)
        ).fetchone()
        if not profile or (
            body.studentProfileId is not None and body.studentProfileId != profile["id"]
        ):
            raise HTTPException(403, "You can only submit your own student profile")
        opp = conn.execute(
            "SELECT * FROM opportunities WHERE id=?", (body.opportunityId,)
        ).fetchone()
        if not opp:
            raise HTTPException(404, "Opportunity not found")
        if opp["status"] != "published" or not can_user_view_opportunity(
            conn, session.userId, body.opportunityId
        ):
            raise HTTPException(403, "Opportunity is not open to you")
        deadline = enforced_deadline(conn, body.opportunityId)
        if deadline and datetime.now(timezone.utc).date() > deadline:
            raise HTTPException(400, "The application deadline has passed")
        version = conn.execute(
            "SELECT * FROM graph_versions WHERE opportunity_id=? AND status='active' ORDER BY version DESC LIMIT 1",
            (body.opportunityId,),
        ).fetchone()
        if not version:
            raise HTTPException(
                400, "Publish a review workflow before accepting applications"
            )
        data = body.submittedData or {}
        validate_submission(
            form_schema(
                conn,
                {
                    "graph_version_id": version["id"],
                    "opportunity_id": body.opportunityId,
                },
            ),
            data,
        )
        ts = now_iso()
        cursor = conn.execute(
            "INSERT INTO applications (student_profile_id,opportunity_id,current_step_order,current_stage_label,graph_version_id,submitted_data_json,submitted_at,created_at,updated_at) VALUES (?,?,1,'Submitted',?,?,?,?,?)",
            (
                profile["id"],
                body.opportunityId,
                version["id"],
                json.dumps(data),
                ts,
                ts,
                ts,
            ),
        )
        application_id = cursor.lastrowid
        GraphExecutionService().instantiate(conn, application_id, version["id"])
        GraphExecutionService()._event(
            conn,
            application_id,
            "APPLICATION_CREATED",
            session.email,
            {"version": version["id"]},
        )
        return {
            "application": dict(
                conn.execute(
                    "SELECT * FROM applications WHERE id=?", (application_id,)
                ).fetchone()
            )
        }


@app.delete("/api/applications/{application_id}")
def delete_application(
    application_id: int, session: SessionUser = Depends(get_session)
) -> dict[str, Any]:
    ensure_db_initialized()

    with db_conn() as conn:
        app_row = conn.execute(
            """
            SELECT a.id, a.student_profile_id, sp.user_id
            FROM applications a
            JOIN student_profiles sp ON sp.id = a.student_profile_id
            WHERE a.id = ?
            """,
            (application_id,),
        ).fetchone()
        if not app_row:
            raise HTTPException(status_code=404, detail="Application not found")

        can_delete = False
        if session.role == ADMIN_ROLE:
            can_delete = True
        elif session.role == STUDENT_ROLE and int(app_row["user_id"]) == int(
            session.userId
        ):
            can_delete = True

        if not can_delete:
            raise HTTPException(
                status_code=403,
                detail="You are not allowed to delete this application.",
            )

        task_rows = conn.execute(
            "SELECT id FROM application_workflow_tasks WHERE application_id = ?",
            (application_id,),
        ).fetchall()
        task_ids = [int(row["id"]) for row in task_rows]
        if task_ids:
            placeholders = ", ".join("?" for _ in task_ids)
            params = tuple(task_ids)
            conn.execute(
                f"DELETE FROM sla_reminders_sent WHERE task_id IN ({placeholders})",
                params,
            )
            conn.execute(
                f"DELETE FROM sla_breaches WHERE task_id IN ({placeholders})", params
            )
            conn.execute(
                "UPDATE application_workflow_tasks SET return_to_task_id = NULL WHERE application_id = ?",
                (application_id,),
            )
            conn.execute(
                f"DELETE FROM application_workflow_tasks WHERE id IN ({placeholders})",
                params,
            )

        conn.execute(
            "DELETE FROM timeline_events WHERE application_id = ?", (application_id,)
        )
        conn.execute(
            "DELETE FROM application_comments WHERE application_id = ?",
            (application_id,),
        )

        conn.execute("DELETE FROM applications WHERE id = ?", (application_id,))
        conn.commit()

    return {"ok": True, "deletedId": application_id}


@app.get("/api/applications")
def list_applications(session: SessionUser = Depends(get_session)) -> dict[str, Any]:
    if session.role == REVIEWER_ROLE:
        return reviewer_inbox(session)
    if session.role == STUDENT_ROLE:
        return my_applications(session)
    if session.role == ADMIN_ROLE:
        return admin_applications(session)
    raise HTTPException(403, "No application access")


@app.get("/api/applications/{application_id}")
def application_detail(
    application_id: int, session: SessionUser = Depends(get_session)
) -> dict[str, Any]:
    from fastapi_app.application_data import project

    with db_conn() as conn:
        ensure_application_access_for_user(conn, application_id, session)
        return project(conn, get_application_detail(conn, application_id), session)


@app.post("/api/applications/{application_id}/approve")
def approve_application(
    application_id: int,
    body: DecisionBody,
    session: SessionUser = Depends(require_roles(*REVIEWER_ROLES)),
) -> dict[str, Any]:
    with db_conn() as conn:
        ensure_application_access_for_user(conn, application_id, session)
        task = get_active_graph_task(conn, application_id, session.email)
        if not task:
            raise HTTPException(403, "No active task assigned to you")
        try:
            GraphExecutionService().transition(
                conn,
                task["id"],
                "approve",
                session.email,
                comment=body.reason or body.remarks,
                reviewer_data=body.requiredInputs,
            )
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from None
        return {
            "application": dict(
                conn.execute(
                    "SELECT * FROM applications WHERE id=?", (application_id,)
                ).fetchone()
            )
        }


@app.post("/api/applications/{application_id}/request-changes")
def request_changes(
    application_id: int,
    body: DecisionBody,
    session: SessionUser = Depends(require_roles(*REVIEWER_ROLES)),
) -> dict[str, Any]:
    with db_conn() as conn:
        ensure_application_access_for_user(conn, application_id, session)
        task = get_active_graph_task(conn, application_id, session.email)
        if not task:
            raise HTTPException(403, "No active task assigned to you")
        try:
            GraphExecutionService().transition(
                conn,
                task["id"],
                "request_changes",
                session.email,
                comment=body.reason or body.remarks,
                reviewer_data=body.requiredInputs,
            )
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from None
        return {
            "application": dict(
                conn.execute(
                    "SELECT * FROM applications WHERE id=?", (application_id,)
                ).fetchone()
            )
        }


@app.post("/api/applications/{application_id}/student-response")
def submit_student_response(
    application_id: int,
    body: StudentResponseBody,
    session: SessionUser = Depends(require_roles(STUDENT_ROLE)),
) -> dict[str, Any]:
    from fastapi_app.application_data import form_schema, validate_submission
    from fastapi_app.graph_execution import transaction

    with db_conn() as conn, transaction(conn):
        app = ensure_application_access_for_user(conn, application_id, session)
        if app["current_step_order"] != 0 or app["final_status"]:
            raise HTTPException(409, "Application is not waiting for student rework")
        data = (
            body.submittedData
            if body.submittedData is not None
            else json.loads(app["submitted_data_json"] or "{}")
        )
        validate_submission(form_schema(conn, app), data)
        conn.execute(
            "UPDATE applications SET submitted_data_json=? WHERE id=?",
            (json.dumps(data), application_id),
        )
        conn.execute(
            "INSERT INTO application_comments(application_id,author_email,text,visibility,created_at) VALUES (?,?,?,'student_visible',?)",
            (application_id, session.email, body.text.strip(), now_iso()),
        )
        GraphExecutionService().resubmit_after_rework(conn, application_id)
        return {
            "application": dict(
                conn.execute(
                    "SELECT * FROM applications WHERE id=?", (application_id,)
                ).fetchone()
            )
        }


@app.post("/api/applications/{application_id}/reject")
def reject_application(
    application_id: int,
    body: DecisionBody,
    session: SessionUser = Depends(require_roles(*REVIEWER_ROLES)),
) -> dict[str, Any]:
    with db_conn() as conn:
        ensure_application_access_for_user(conn, application_id, session)
        task = get_active_graph_task(conn, application_id, session.email)
        if not task:
            raise HTTPException(403, "No active task assigned to you")
        try:
            GraphExecutionService().transition(
                conn,
                task["id"],
                "reject",
                session.email,
                comment=body.reason or body.remarks,
                reviewer_data=body.requiredInputs,
            )
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from None
        return {
            "application": dict(
                conn.execute(
                    "SELECT * FROM applications WHERE id=?", (application_id,)
                ).fetchone()
            )
        }


@app.get("/api/applications/{application_id}/comments")
def get_comments(
    application_id: int, session: SessionUser = Depends(get_session)
) -> dict[str, Any]:
    return {"comments": application_detail(application_id, session)["comments"]}


@app.post("/api/applications/{application_id}/comments", status_code=201)
def post_comment(
    application_id: int,
    body: CommentCreateBody,
    session: SessionUser = Depends(get_session),
) -> dict[str, Any]:
    detail = application_detail(application_id, session)
    if body.authorEmail and body.authorEmail.lower() != session.email.lower():
        raise HTTPException(403, "Comment author is determined by the session")
    if body.visibility not in {"internal", "student_visible"}:
        raise HTTPException(400, "Choose internal or student-visible comments")
    if (
        session.role in REVIEWER_ROLES
        and "comment" not in detail["graph_node_info"]["allowed_actions"]
    ):
        raise HTTPException(403, "Commenting is not allowed at this review node")
    visibility = "student_visible" if session.role == STUDENT_ROLE else body.visibility
    with db_conn() as conn:
        cursor = conn.execute(
            "INSERT INTO application_comments(application_id,author_email,text,visibility,created_at) VALUES (?,?,?,?,?)",
            (application_id, session.email, body.text.strip(), visibility, now_iso()),
        )
        conn.commit()
        return {
            "comment": dict(
                conn.execute(
                    "SELECT * FROM application_comments WHERE id=?", (cursor.lastrowid,)
                ).fetchone()
            )
        }


@app.get("/api/my/applications")
def my_applications(
    session: SessionUser = Depends(require_roles(STUDENT_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        profile = conn.execute(
            "SELECT id FROM student_profiles WHERE user_id = ?", (session.userId,)
        ).fetchone()
        if not profile:
            raise HTTPException(status_code=404, detail="Student profile not found")
        items = get_enriched_application_list(
            conn, "WHERE a.student_profile_id = ?", (profile["id"],)
        )
    return {"items": items}


@app.get("/api/reviewer/inbox")
def reviewer_inbox(
    session: SessionUser = Depends(require_roles(*REVIEWER_ROLES)),
) -> dict[str, Any]:
    with db_conn() as conn:
        tasks = GraphExecutionService().get_inbox(conn, session.email)
        deadlines = {
            item["task_id"]: item
            for item in SLAManagementService().reviewer_tasks(conn, session.email)
        }
        processed = conn.execute(
            "SELECT COUNT(*) FROM application_workflow_tasks WHERE assigned_reviewer_email=? AND decision IS NOT NULL",
            (session.email,),
        ).fetchone()[0]
    items = []
    for task in tasks:
        sla = deadlines.get(task.task_id, {})
        items.append(
            {
                **task.model_dump(),
                "id": task.application_id,
                "current_stage": task.display_name,
                "source": "graph",
                "updated_at": task.assigned_at,
                "sla_deadline": sla.get("deadline_at"),
                "sla_status": sla.get("status", "on_time"),
                "days_remaining": sla.get("days_remaining"),
                "sla_days": sla.get("sla_days"),
            }
        )
    return {
        "items": items,
        "stats": {
            "pending": len(items),
            "processed": processed,
            "dueSoon": sum(i["sla_status"] == "approaching" for i in items),
        },
    }


@app.post("/api/admin/sla-policies")
def admin_upsert_sla_policy(
    body: SLAPolicyBody,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        try:
            policy = SLAManagementService().upsert_policy(
                conn,
                graph_node_id=body.graphNodeId,
                sla_days=body.slaDays,
                reminder_days=body.reminderDays,
                escalation_email=body.escalationEmail,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    return policy


@app.get("/api/admin/sla-policies")
def admin_list_sla_policies(
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        policies = SLAManagementService().list_policies(conn)
    return {"policies": policies}


@app.get("/api/admin/sla-dashboard")
def admin_sla_dashboard(
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        return SLAManagementService().dashboard(conn)


@app.get("/api/reviewer/tasks")
def reviewer_tasks_with_sla(
    session: SessionUser = Depends(require_roles(*REVIEWER_ROLES)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        tasks = SLAManagementService().reviewer_tasks(conn, session.email)
    return {"tasks": tasks}


@app.post("/api/admin/sla-reminders/send-test")
def admin_send_sla_test_reminder(
    body: SLATestReminderBody,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    to_email = body.toEmail or session.email
    result = SLAEmailSender().send(
        to_email,
        "PRISM SLA reminder test",
        "This is a PRISM SLA reminder configuration test.",
    )
    return result


@app.post("/api/reviewer/sla-breaches/{task_id}/acknowledge")
def reviewer_acknowledge_sla_breach(
    task_id: int,
    body: SLABreachAcknowledgeBody,
    session: SessionUser = Depends(require_roles(*REVIEWER_ROLES)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        try:
            return SLAManagementService().acknowledge_breach(
                conn, task_id, session.email, body.notes
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/admin/sla-notifications")
def get_sla_notifications(
    session: SessionUser = Depends(require_roles(*REVIEWER_ROLES, ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        service = SLAManagementService()
        if session.role == ADMIN_ROLE:
            dashboard = service.dashboard(conn)
            items = dashboard["approaching_tasks"] + dashboard["breached_tasks"]
        else:
            items = [
                item
                for item in service.reviewer_tasks(conn, session.email)
                if item["status"] in {"approaching", "breached"}
            ]
    return {
        "approaching": sum(item["status"] == "approaching" for item in items),
        "breached": sum(item["status"] == "breached" for item in items),
        "items": items[:10],
    }


@app.get("/api/admin/dashboard/summary")
def admin_summary(
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        total = conn.execute("SELECT COUNT(*) AS c FROM applications").fetchone()["c"]
        active = conn.execute(
            "SELECT COUNT(*) AS c FROM applications WHERE final_status IS NULL"
        ).fetchone()["c"]
        approved = conn.execute(
            "SELECT COUNT(*) AS c FROM applications WHERE final_status = 'APPROVED'"
        ).fetchone()["c"]

        awaiting_me = conn.execute(
            "SELECT COUNT(*) FROM application_workflow_tasks WHERE status='active' AND assigned_reviewer_email=?",
            (session.email,),
        ).fetchone()[0]
        closed_rows = conn.execute(
            "SELECT created_at, updated_at FROM applications WHERE final_status IS NOT NULL"
        ).fetchall()
        if closed_rows:
            days = []
            for row in closed_rows:
                start = parse_iso(row["created_at"])
                end = parse_iso(row["updated_at"])
                if start and end:
                    days.append(max((end - start).total_seconds() / 86400, 0.0))
            avg_processing = round(sum(days) / len(days), 2) if days else 0.0
        else:
            avg_processing = 0.0

        review_counts = conn.execute(
            """
            SELECT
              SUM(CASE WHEN decision = 'request_changes' THEN 1 ELSE 0 END) AS flagged,
              COUNT(*) AS total_reviews
            FROM application_workflow_tasks WHERE decision IS NOT NULL
            """
        ).fetchone()
        flagged = review_counts["flagged"] or 0
        total_reviews = review_counts["total_reviews"] or 0
        flagged_ratio = (
            round((flagged / total_reviews) * 100, 2) if total_reviews else 0.0
        )

        active_opps = conn.execute(
            """
            SELECT o.id, o.title, o.code, COUNT(a.id) AS applicant_count
            FROM opportunities o
            LEFT JOIN applications a ON a.opportunity_id = o.id
            WHERE o.status = 'published'
            GROUP BY o.id
            ORDER BY applicant_count DESC, o.updated_at DESC
            LIMIT 5
            """
        ).fetchall()

    return {
        "total": total,
        "pending": active,
        "awaitingMe": awaiting_me,
        "approved": approved,
        "avgProcessingDays": avg_processing,
        "flaggedRatio": flagged_ratio,
        "activeOpportunities": [dict(row) for row in active_opps],
    }


@app.get("/api/admin/applications")
def admin_applications(
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        items = get_enriched_application_list(conn)
    return {"items": items}


@app.patch("/api/admin/applications/{application_id}")
def admin_patch_application(
    application_id: int,
    body: AdminApplicationPatchBody,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    from fastapi_app.application_data import form_schema, validate_submission
    from fastapi_app.graph_execution import transaction

    with db_conn() as conn, transaction(conn):
        app = ensure_application_access_for_user(conn, application_id, session)
        if app["final_status"]:
            raise HTTPException(409, "Closed applications cannot be edited")
        validate_submission(form_schema(conn, app), body.submittedData)
        conn.execute(
            "UPDATE applications SET submitted_data_json=? WHERE id=?",
            (json.dumps(body.submittedData), application_id),
        )
        service = GraphExecutionService()
        levels = service._definition(conn, app["graph_version_id"])
        service._return(conn, app, levels, 0, "student", session.email)
        service.resubmit_after_rework(conn, application_id)
        service._event(
            conn,
            application_id,
            "APPLICATION_CORRECTED",
            session.email,
            {"review_restarted": True},
        )
        return {
            "application": dict(
                conn.execute(
                    "SELECT * FROM applications WHERE id=?", (application_id,)
                ).fetchone()
            )
        }
