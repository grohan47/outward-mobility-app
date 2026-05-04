from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any

from fastapi_app.graph_models import TaskRow, TransitionResult


APPROVE = "approve"
REQUEST_CHANGES = "request_changes"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json_list(raw: str | None, fallback: list[str]) -> list[str]:
    if not raw:
        return fallback
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return fallback
    if not isinstance(parsed, list):
        return fallback
    return [str(item) for item in parsed]


def _submitted_data(application_row: sqlite3.Row) -> dict[str, Any]:
    raw = application_row["submitted_data_json"]
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


class GraphExecutionService:
    """
    Executes published graph versions through reviewer tasks.

    State machine:
      instantiate()
        start node -> outgoing edges -> reviewer tasks

      transition(task, approve)
        active reviewer task -> completed -> downstream node(s)
        reviewer -> reviewer: create next active task
        reviewer -> join_all: wait until all incoming reviewer tasks completed
        reviewer -> join_any: skip sibling active tasks, advance once
        reviewer -> conditional: evaluate whitelisted edge predicates
        reviewer -> end: mark application approved

      transition(task, request_changes)
        active reviewer task -> returned -> application waits in Student Rework
    """

    VALID_DECISIONS = {APPROVE, REQUEST_CHANGES}

    def instantiate(self, db: sqlite3.Connection, application_id: int, graph_version_id: int) -> list[int]:
        with db:
            application = self._get_application(db, application_id)
            start_node = db.execute(
                """
                SELECT *
                FROM graph_nodes
                WHERE graph_version_id = ? AND node_type = 'start'
                LIMIT 1
                """,
                (graph_version_id,),
            ).fetchone()
            if not start_node:
                raise ValueError("Graph version has no start node")

            return self._advance_from_node(db, application, graph_version_id, start_node["node_key"])

    def transition(
        self,
        db: sqlite3.Connection,
        task_id: int,
        decision: str,
        actor_email: str,
        comment: str | None = None,
    ) -> TransitionResult:
        normalized_decision = decision.strip().lower()
        if normalized_decision not in self.VALID_DECISIONS:
            raise ValueError(f"Unsupported graph task decision: {decision}")

        with db:
            task = self._get_task(db, task_id)
            if task["status"] != "active":
                raise ValueError("Task is no longer active")
            if task["assigned_reviewer_email"].lower() != actor_email.strip().lower():
                raise ValueError("Actor is not assigned to this task")

            application = self._get_application(db, int(task["application_id"]))
            ts = _now_iso()

            if normalized_decision == REQUEST_CHANGES:
                db.execute(
                    """
                    UPDATE application_workflow_tasks
                    SET status = 'returned',
                        acted_at = ?,
                        decision = ?,
                        comment_summary = ?,
                        return_to_task_id = NULL
                    WHERE id = ?
                    """,
                    (ts, normalized_decision, comment, task_id),
                )
                db.execute(
                    """
                    UPDATE applications
                    SET current_stage_label = 'Student Rework',
                        final_status = NULL,
                        updated_at = ?
                    WHERE id = ?
                    """,
                    (ts, int(task["application_id"])),
                )
                return TransitionResult(success=True, application_status="STUDENT_REWORK")

            db.execute(
                """
                UPDATE application_workflow_tasks
                SET status = 'completed',
                    acted_at = ?,
                    decision = ?,
                    comment_summary = ?
                WHERE id = ?
                """,
                (ts, normalized_decision, comment, task_id),
            )
            next_task_ids = self._advance_from_node(
                db,
                application,
                int(task["graph_version_id"]),
                str(task["node_key"]),
                completed_task_id=task_id,
            )

            updated = self._get_application(db, int(task["application_id"]))
            return TransitionResult(
                success=True,
                next_task_ids=next_task_ids,
                application_status=updated["final_status"],
            )

    def get_inbox(self, db: sqlite3.Connection, reviewer_email: str) -> list[TaskRow]:
        rows = db.execute(
            """
            SELECT
              t.id AS task_id,
              t.application_id,
              o.title AS opportunity_title,
              u.full_name AS student_name,
              t.node_key,
              COALESCE(n.display_name, t.node_key) AS display_name,
              n.allowed_actions,
              n.visible_sections,
              t.assigned_at
            FROM application_workflow_tasks t
            JOIN applications a ON a.id = t.application_id
            JOIN opportunities o ON o.id = a.opportunity_id
            JOIN student_profiles sp ON sp.id = a.student_profile_id
            JOIN users u ON u.id = sp.user_id
            JOIN graph_nodes n
              ON n.graph_version_id = t.graph_version_id
             AND n.node_key = t.node_key
            WHERE t.status = 'active'
              AND LOWER(t.assigned_reviewer_email) = LOWER(?)
            ORDER BY t.assigned_at DESC, t.id DESC
            """,
            (reviewer_email.strip().lower(),),
        ).fetchall()

        return [
            TaskRow(
                task_id=int(row["task_id"]),
                application_id=int(row["application_id"]),
                opportunity_title=str(row["opportunity_title"]),
                student_name=str(row["student_name"]),
                node_key=str(row["node_key"]),
                display_name=str(row["display_name"]),
                allowed_actions=_json_list(row["allowed_actions"], ["approve", "request_changes", "comment"]),
                visible_sections=_json_list(row["visible_sections"], ["all"]),
                assigned_at=str(row["assigned_at"]),
            )
            for row in rows
        ]

    def _advance_from_node(
        self,
        db: sqlite3.Connection,
        application: sqlite3.Row,
        graph_version_id: int,
        from_node_key: str,
        completed_task_id: int | None = None,
    ) -> list[int]:
        edges = db.execute(
            """
            SELECT *
            FROM graph_edges
            WHERE graph_version_id = ? AND from_node_key = ?
            ORDER BY id ASC
            """,
            (graph_version_id, from_node_key),
        ).fetchall()

        next_task_ids: list[int] = []
        data = _submitted_data(application)
        for edge in edges:
            if edge["condition_json"] and not self._condition_matches(edge["condition_json"], data):
                continue
            next_task_ids.extend(
                self._activate_node(
                    db,
                    application,
                    graph_version_id,
                    str(edge["to_node_key"]),
                    completed_task_id=completed_task_id,
                )
            )
        return next_task_ids

    def _activate_node(
        self,
        db: sqlite3.Connection,
        application: sqlite3.Row,
        graph_version_id: int,
        node_key: str,
        completed_task_id: int | None = None,
    ) -> list[int]:
        node = self._get_node(db, graph_version_id, node_key)
        node_type = str(node["node_type"])
        if node_type == "reviewer":
            return self._create_reviewer_task(db, application, graph_version_id, node)
        if node_type == "end":
            self._mark_application_approved(db, int(application["id"]))
            return []
        if node_type == "conditional":
            return self._advance_from_node(db, application, graph_version_id, node_key, completed_task_id)
        if node_type == "join_all":
            if not self._join_all_ready(db, int(application["id"]), graph_version_id, node_key):
                return []
            return self._advance_once(db, application, graph_version_id, node_key)
        if node_type == "join_any":
            self._skip_join_siblings(db, int(application["id"]), graph_version_id, node_key, completed_task_id)
            return self._advance_once(db, application, graph_version_id, node_key)
        if node_type == "start":
            return self._advance_from_node(db, application, graph_version_id, node_key, completed_task_id)
        raise ValueError(f"Unsupported graph node type: {node_type}")

    def _advance_once(
        self,
        db: sqlite3.Connection,
        application: sqlite3.Row,
        graph_version_id: int,
        node_key: str,
    ) -> list[int]:
        if self._node_already_advanced(db, int(application["id"]), graph_version_id, node_key):
            return []
        return self._advance_from_node(db, application, graph_version_id, node_key)

    def _create_reviewer_task(
        self,
        db: sqlite3.Connection,
        application: sqlite3.Row,
        graph_version_id: int,
        node: sqlite3.Row,
    ) -> list[int]:
        if self._task_exists(db, int(application["id"]), graph_version_id, str(node["node_key"])):
            return []
        reviewer_email = node["reviewer_email"]
        if not reviewer_email:
            raise ValueError(f"Reviewer node '{node['node_key']}' missing reviewer_email")

        cursor = db.execute(
            """
            INSERT INTO application_workflow_tasks
            (application_id, graph_version_id, node_key, assigned_reviewer_email, status)
            VALUES (?, ?, ?, ?, 'active')
            """,
            (int(application["id"]), graph_version_id, node["node_key"], reviewer_email),
        )
        db.execute(
            """
            UPDATE applications
            SET current_stage_label = ?, updated_at = ?
            WHERE id = ?
            """,
            (node["display_name"] or node["node_key"], _now_iso(), int(application["id"])),
        )
        return [int(cursor.lastrowid)]

    def _mark_application_approved(self, db: sqlite3.Connection, application_id: int) -> None:
        db.execute(
            """
            UPDATE applications
            SET final_status = 'APPROVED',
                current_stage_label = 'Closed',
                updated_at = ?
            WHERE id = ?
            """,
            (_now_iso(), application_id),
        )

    def _join_all_ready(
        self,
        db: sqlite3.Connection,
        application_id: int,
        graph_version_id: int,
        join_node_key: str,
    ) -> bool:
        incoming = self._incoming_sources(db, graph_version_id, join_node_key)
        if not incoming:
            return False
        placeholders = ",".join("?" for _ in incoming)
        row = db.execute(
            f"""
            SELECT COUNT(*) AS cnt
            FROM application_workflow_tasks
            WHERE application_id = ?
              AND graph_version_id = ?
              AND node_key IN ({placeholders})
              AND status = 'completed'
              AND decision = 'approve'
            """,
            (application_id, graph_version_id, *incoming),
        ).fetchone()
        return bool(row) and int(row["cnt"]) == len(incoming)

    def _skip_join_siblings(
        self,
        db: sqlite3.Connection,
        application_id: int,
        graph_version_id: int,
        join_node_key: str,
        completed_task_id: int | None,
    ) -> None:
        incoming = self._incoming_sources(db, graph_version_id, join_node_key)
        if not incoming:
            return
        placeholders = ",".join("?" for _ in incoming)
        params: list[Any] = [application_id, graph_version_id, *incoming]
        task_filter = ""
        if completed_task_id is not None:
            task_filter = "AND id <> ?"
            params.append(completed_task_id)
        db.execute(
            f"""
            UPDATE application_workflow_tasks
            SET status = 'skipped',
                acted_at = ?
            WHERE application_id = ?
              AND graph_version_id = ?
              AND node_key IN ({placeholders})
              AND status = 'active'
              {task_filter}
            """,
            [_now_iso(), *params],
        )

    def _incoming_sources(self, db: sqlite3.Connection, graph_version_id: int, node_key: str) -> list[str]:
        rows = db.execute(
            """
            SELECT from_node_key
            FROM graph_edges
            WHERE graph_version_id = ? AND to_node_key = ?
            ORDER BY id ASC
            """,
            (graph_version_id, node_key),
        ).fetchall()
        return [str(row["from_node_key"]) for row in rows]

    def _node_already_advanced(
        self,
        db: sqlite3.Connection,
        application_id: int,
        graph_version_id: int,
        node_key: str,
    ) -> bool:
        downstream = db.execute(
            """
            SELECT to_node_key
            FROM graph_edges
            WHERE graph_version_id = ? AND from_node_key = ?
            """,
            (graph_version_id, node_key),
        ).fetchall()
        if not downstream:
            return False
        node_keys = [str(e["to_node_key"]) for e in downstream]
        placeholders = ",".join("?" for _ in node_keys)
        row = db.execute(
            f"""
            SELECT 1
            FROM application_workflow_tasks
            WHERE application_id = ?
              AND graph_version_id = ?
              AND node_key IN ({placeholders})
              AND status IN ('active', 'completed', 'returned')
            LIMIT 1
            """,
            (application_id, graph_version_id, *node_keys),
        ).fetchone()
        return bool(row)

    def _task_exists(
        self,
        db: sqlite3.Connection,
        application_id: int,
        graph_version_id: int,
        node_key: str,
    ) -> bool:
        row = db.execute(
            """
            SELECT 1
            FROM application_workflow_tasks
            WHERE application_id = ?
              AND graph_version_id = ?
              AND node_key = ?
              AND status IN ('active', 'completed')
            LIMIT 1
            """,
            (application_id, graph_version_id, node_key),
        ).fetchone()
        return bool(row)

    def _condition_matches(self, raw_condition: str, data: dict[str, Any]) -> bool:
        try:
            condition = json.loads(raw_condition)
        except json.JSONDecodeError:
            return False
        return self._evaluate_condition(condition, data)

    def _evaluate_condition(self, condition: dict[str, Any], data: dict[str, Any]) -> bool:
        op = condition.get("op")
        if op == "all_of":
            children = condition.get("conditions")
            return isinstance(children, list) and all(
                isinstance(child, dict) and self._evaluate_condition(child, data) for child in children
            )
        if op == "any_of":
            children = condition.get("conditions")
            return isinstance(children, list) and any(
                isinstance(child, dict) and self._evaluate_condition(child, data) for child in children
            )

        field = condition.get("field")
        if not isinstance(field, str):
            return False
        actual = data.get(field)
        expected = condition.get("value")

        if op == "equals":
            return actual == expected
        if op == "in":
            return isinstance(expected, list) and actual in expected
        if op in {"gt", "lt", "gte", "lte"}:
            return self._compare_numbers(actual, expected, op)
        return False

    def _compare_numbers(self, actual: Any, expected: Any, op: str) -> bool:
        try:
            actual_number = float(actual)
            expected_number = float(expected)
        except (TypeError, ValueError):
            return False
        if op == "gt":
            return actual_number > expected_number
        if op == "lt":
            return actual_number < expected_number
        if op == "gte":
            return actual_number >= expected_number
        if op == "lte":
            return actual_number <= expected_number
        return False

    def _get_application(self, db: sqlite3.Connection, application_id: int) -> sqlite3.Row:
        row = db.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
        if not row:
            raise ValueError("Application not found")
        return row

    def _get_task(self, db: sqlite3.Connection, task_id: int) -> sqlite3.Row:
        row = db.execute("SELECT * FROM application_workflow_tasks WHERE id = ?", (task_id,)).fetchone()
        if not row:
            raise ValueError("Task not found")
        return row

    def _get_node(self, db: sqlite3.Connection, graph_version_id: int, node_key: str) -> sqlite3.Row:
        row = db.execute(
            """
            SELECT *
            FROM graph_nodes
            WHERE graph_version_id = ? AND node_key = ?
            LIMIT 1
            """,
            (graph_version_id, node_key),
        ).fetchone()
        if not row:
            raise ValueError(f"Graph node not found: {node_key}")
        return row
