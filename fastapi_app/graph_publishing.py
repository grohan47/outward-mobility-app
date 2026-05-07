from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from typing import Any

from fastapi_app.graph_models import AIWorkflowDraftOutput
from fastapi_app.opportunity_details import (
    generate_unique_opportunity_code,
    normalize_ai_summary_bullets,
    normalize_detail_fields,
    replace_detail_fields,
    replace_opportunity_form_fields,
    summary_source_hash,
    validate_cover_image_url,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "_", text.strip().lower()).strip("_") or "opp"


def _normalize_generator_visibility_rules(rules: list[str]) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    seen: set[str] = set()
    for raw_rule in rules:
        rule_value = raw_rule.strip().lower()
        if not rule_value or rule_value in seen:
            continue
        if not rule_value.endswith("@plaksha.edu.in"):
            raise ValueError(f'Visibility rule "{rule_value}" must be a valid @plaksha.edu.in email address.')
        seen.add(rule_value)
        normalized.append({"rule_type": "GROUP_EMAIL", "rule_value": rule_value})
    return normalized


def _replace_opportunity_visibility_rules(
    db: sqlite3.Connection,
    opportunity_id: int,
    rules: list[dict[str, str]],
    created_at: str,
) -> None:
    db.execute("DELETE FROM opportunity_visibility_rules WHERE opportunity_id = ?", (opportunity_id,))
    for rule in rules:
        db.execute(
            """
            INSERT INTO opportunity_visibility_rules (opportunity_id, rule_type, rule_value, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (opportunity_id, rule["rule_type"], rule["rule_value"], created_at),
        )


class GraphPublishingService:
    """
    Publishes a validated workflow_draft into an active graph version.

    Publish boundary:
      draft.publish_ready must be 1 (set by AIWorkflowDraftService).
      Any draft that has validation errors, open clarifying questions,
      or is_fallback=True will be rejected here.

    On publish:
      1. If draft.opportunity_id is NULL, create an opportunity row from
         draft_output.opportunity and link it.
      2. Increment the version counter for that opportunity.
      3. Write graph_versions (status='active'), graph_nodes, graph_edges.
      4. Mark draft status='published'.
      5. Return graph_version_id.
    """

    def publish(self, db: sqlite3.Connection, draft_id: int, admin_email: str) -> int:
        draft = db.execute("SELECT * FROM workflow_drafts WHERE id = ?", (draft_id,)).fetchone()
        if not draft:
            raise ValueError(f"Draft {draft_id} not found")
        if not draft["publish_ready"]:
            raise ValueError("Draft is not publish_ready — resolve validation errors and open questions first")

        raw = draft["draft_output"]
        if not raw:
            raise ValueError("Draft has no output to publish")
        parsed = AIWorkflowDraftOutput.model_validate_json(raw)

        with db:
            opportunity_id = draft["opportunity_id"]
            if not opportunity_id:
                opportunity_id = self._create_opportunity(db, parsed, admin_email)
                db.execute(
                    "UPDATE workflow_drafts SET opportunity_id = ? WHERE id = ?",
                    (opportunity_id, draft_id),
                )
            else:
                self._update_opportunity(db, int(opportunity_id), parsed)

            version = self._next_version(db, opportunity_id)
            ts = _now_iso()

            cursor = db.execute(
                """
                INSERT INTO graph_versions
                  (opportunity_id, version, status, published_by_email, published_at, created_at)
                VALUES (?, ?, 'active', ?, ?, ?)
                """,
                (opportunity_id, version, admin_email, ts, ts),
            )
            graph_version_id = int(cursor.lastrowid)

            for node in parsed.graph.nodes:
                db.execute(
                    """
                    INSERT INTO graph_nodes
                      (graph_version_id, node_key, node_type, display_name, reviewer_email,
                       visible_sections, allowed_actions, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        graph_version_id,
                        node.node_key,
                        node.node_type,
                        node.display_name,
                        node.reviewer_email,
                        json.dumps(node.visible_sections),
                        json.dumps(node.allowed_actions),
                        node.metadata.model_dump_json(),
                    ),
                )

            for edge in parsed.graph.edges:
                db.execute(
                    """
                    INSERT INTO graph_edges
                      (graph_version_id, from_node_key, to_node_key, condition_json, label, action)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        graph_version_id,
                        edge.from_node_key,
                        edge.to_node_key,
                        json.dumps(edge.condition_json) if edge.condition_json else None,
                        edge.label,
                        edge.action,
                    ),
                )

            db.execute(
                "UPDATE workflow_drafts SET status = 'published', updated_at = ? WHERE id = ?",
                (ts, draft_id),
            )

        return graph_version_id

    def _create_opportunity(
        self, db: sqlite3.Connection, parsed: AIWorkflowDraftOutput, admin_email: str
    ) -> int:
        opp = parsed.opportunity
        ts = _now_iso()
        code = opp.code or generate_unique_opportunity_code(db, opp.title)

        cursor = db.execute(
            """
            INSERT INTO opportunities
              (code, title, description, cover_image_url, term, destination, deadline, seats,
               ai_summary_json, ai_summary_source_hash, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)
            """,
            (
                code,
                opp.title,
                opp.description,
                validate_cover_image_url(opp.cover_image_url),
                opp.term or "TBD",
                opp.destination or opp.host_institution or "Global",
                opp.deadline or f"{datetime.now(timezone.utc).year}-12-31",
                opp.seats or 10,
                json.dumps(normalize_ai_summary_bullets(opp.ai_summary_bullets)) if opp.ai_summary_bullets else None,
                summary_source_hash(opp.model_dump(), normalize_detail_fields(opp.detail_fields)) if opp.ai_summary_bullets else None,
                ts,
                ts,
            ),
        )
        opportunity_id = int(cursor.lastrowid)
        replace_detail_fields(db, opportunity_id, normalize_detail_fields(opp.detail_fields), ts)
        if parsed.applicant_form_fields:
            replace_opportunity_form_fields(db, opportunity_id, parsed.applicant_form_fields)
        visibility_rules = parsed.generator_visibility_rules or ["ug2024@plaksha.edu.in"]
        _replace_opportunity_visibility_rules(
            db,
            opportunity_id,
            _normalize_generator_visibility_rules(visibility_rules),
            ts,
        )
        return opportunity_id

    def _update_opportunity(self, db: sqlite3.Connection, opportunity_id: int, parsed: AIWorkflowDraftOutput) -> None:
        opp = parsed.opportunity
        ts = _now_iso()
        detail_fields = normalize_detail_fields(opp.detail_fields)
        bullets = normalize_ai_summary_bullets(opp.ai_summary_bullets)
        db.execute(
            """
            UPDATE opportunities
            SET title = ?,
                description = ?,
                cover_image_url = ?,
                term = ?,
                destination = ?,
                deadline = ?,
                seats = ?,
                ai_summary_json = ?,
                ai_summary_source_hash = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                opp.title,
                opp.description,
                validate_cover_image_url(opp.cover_image_url),
                opp.term,
                opp.destination or opp.host_institution,
                opp.deadline,
                opp.seats,
                json.dumps(bullets) if bullets else None,
                summary_source_hash(opp.model_dump(), detail_fields) if bullets else None,
                ts,
                opportunity_id,
            ),
        )
        replace_detail_fields(db, opportunity_id, detail_fields, ts)
        if parsed.applicant_form_fields:
            replace_opportunity_form_fields(db, opportunity_id, parsed.applicant_form_fields)
        visibility_rules = parsed.generator_visibility_rules or ["ug2024@plaksha.edu.in"]
        _replace_opportunity_visibility_rules(
            db,
            opportunity_id,
            _normalize_generator_visibility_rules(visibility_rules),
            ts,
        )

    def _next_version(self, db: sqlite3.Connection, opportunity_id: int) -> int:
        row = db.execute(
            "SELECT MAX(version) AS max_v FROM graph_versions WHERE opportunity_id = ?",
            (opportunity_id,),
        ).fetchone()
        return (row["max_v"] or 0) + 1

    def get_graph(self, db: sqlite3.Connection, opportunity_id: int) -> dict[str, Any]:
        """Return the active graph version with its nodes and edges."""
        version = db.execute(
            """
            SELECT * FROM graph_versions
            WHERE opportunity_id = ? AND status = 'active'
            ORDER BY version DESC
            LIMIT 1
            """,
            (opportunity_id,),
        ).fetchone()
        if not version:
            return {"graph_version": None, "nodes": [], "edges": []}

        nodes = db.execute(
            "SELECT * FROM graph_nodes WHERE graph_version_id = ? ORDER BY id ASC",
            (int(version["id"]),),
        ).fetchall()
        edges = db.execute(
            "SELECT * FROM graph_edges WHERE graph_version_id = ? ORDER BY id ASC",
            (int(version["id"]),),
        ).fetchall()

        return {
            "graph_version": dict(version),
            "nodes": [dict(n) for n in nodes],
            "edges": [dict(e) for e in edges],
        }
