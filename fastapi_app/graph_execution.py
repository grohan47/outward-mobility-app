"""Transactional execution of sequential levels with unanimous parallel reviews."""

from __future__ import annotations
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from fastapi_app.graph_models import TaskRow, TransitionResult
from fastapi_app.levels import normalize_levels


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def transaction(db):
    # Acquire the write lock before reading task state. Nested callers already own it.
    owned = not db.in_transaction
    if owned:
        db.execute("BEGIN IMMEDIATE")
    try:
        yield
        if owned:
            db.commit()
    except Exception:
        if owned:
            db.rollback()
        raise


class GraphExecutionService:
    def _definition(self, db, version):
        row = db.execute(
            "SELECT definition_json FROM graph_versions WHERE id=?", (version,)
        ).fetchone()
        if not row:
            raise ValueError("Published workflow not found")
        if row["definition_json"]:
            return json.loads(row["definition_json"])["graph"]["levels"]
        nodes = []
        for row in db.execute(
            "SELECT * FROM graph_nodes WHERE graph_version_id=? ORDER BY id", (version,)
        ):
            node = dict(row)
            for key, default in [
                ("metadata", {}),
                ("visible_sections", []),
                ("allowed_actions", []),
            ]:
                node[key] = json.loads(node[key] or json.dumps(default))
            nodes.append(node)
        edges = [
            dict(r)
            for r in db.execute(
                "SELECT * FROM graph_edges WHERE graph_version_id=? ORDER BY id",
                (version,),
            )
        ]
        return normalize_levels({"nodes": nodes, "edges": edges})

    def _application(self, db, application_id):
        row = db.execute(
            "SELECT * FROM applications WHERE id=?", (application_id,)
        ).fetchone()
        if not row:
            raise ValueError("Application not found")
        return row

    def _event(self, db, app_id, kind, actor, payload):
        db.execute(
            "INSERT INTO timeline_events (application_id,event_type,event_payload_json,actor_email,created_at) VALUES (?,?,?,?,?)",
            (app_id, kind, json.dumps(payload), actor, _now_iso()),
        )

    def _open(self, db, app, levels, index):
        ts = _now_iso()
        if index >= len(levels):
            db.execute(
                "UPDATE applications SET final_status='APPROVED',current_stage_label='Closed',updated_at=? WHERE id=?",
                (ts, app["id"]),
            )
            return []
        level = levels[index]
        ids = []
        for node in level["reviewers"]:
            cursor = db.execute(
                """INSERT INTO application_workflow_tasks
                (application_id,graph_version_id,node_key,assigned_reviewer_email,assigned_at,status,attempt)
                VALUES (?,?,?,?,?,'active',?)""",
                (
                    app["id"],
                    app["graph_version_id"],
                    node["node_key"],
                    node["reviewer_email"].strip().lower(),
                    ts,
                    app["attempt"],
                ),
            )
            ids.append(cursor.lastrowid)
        db.execute(
            "UPDATE applications SET current_level=?,current_step_order=?,current_stage_label=?,updated_at=? WHERE id=?",
            (index, index + 1, level["name"], ts, app["id"]),
        )
        return ids

    def instantiate(self, db, application_id, graph_version_id):
        with transaction(db):
            app = self._application(db, application_id)
            if db.execute(
                "SELECT 1 FROM application_workflow_tasks WHERE application_id=?",
                (application_id,),
            ).fetchone():
                raise ValueError("Application workflow is already instantiated")
            levels = self._definition(db, graph_version_id)
            if not levels:
                raise ValueError("Workflow needs at least one review level")
            return self._open(db, app, levels, 0)

    def _validate_inputs(self, node, data, required):
        fields = node.get("metadata", {}).get("required_inputs", [])
        if set(data) - {f["input_key"] for f in fields}:
            raise ValueError("Unknown reviewer input")
        for f in fields:
            value = data.get(f["input_key"])
            missing = value is None or value == "" or value == []
            if missing:
                if required and f.get("required", True):
                    raise ValueError(f"Missing required reviewer input: {f['label']}")
                continue
            kind = f.get("input_type", "text")
            if kind == "number":
                if isinstance(value, bool):
                    raise ValueError(f"{f['label']} must be a number")
                try:
                    import math

                    number = float(value)
                    if not math.isfinite(number):
                        raise ValueError()
                    data[f["input_key"]] = number
                except (ValueError, TypeError):
                    raise ValueError(f"{f['label']} must be a finite number") from None
            elif kind == "select" and value not in f.get("options", []):
                raise ValueError(f"Invalid option for {f['label']}")
            elif kind == "checkbox" and not isinstance(value, bool):
                raise ValueError(f"{f['label']} must be true or false")
            elif kind == "text" and not isinstance(value, str):
                raise ValueError(f"{f['label']} must be text")

    def _return(self, db, app, levels, source_index, target, actor):
        index = (
            source_index
            if target == "student"
            else next((i for i, l in enumerate(levels) if l["id"] == target), -1)
        )
        if index < 0 or (target != "student" and index >= source_index):
            raise ValueError("Return target must be the student or an earlier level")
        affected = [n["node_key"] for l in levels[index:] for n in l["reviewers"]]
        marks = ",".join("?" for _ in affected)
        db.execute(
            f"UPDATE application_workflow_tasks SET status='invalidated' WHERE application_id=? AND node_key IN ({marks}) AND status IN ('active','completed','returned')",
            (app["id"], *affected),
        )
        db.execute(
            "UPDATE applications SET attempt=attempt+1,return_level=?,current_level=?,current_step_order=?,current_stage_label=?,updated_at=? WHERE id=?",
            (
                index,
                index,
                0 if target == "student" else index + 1,
                "Student Rework" if target == "student" else levels[index]["name"],
                _now_iso(),
                app["id"],
            ),
        )
        self._event(
            db,
            app["id"],
            "WORKFLOW_RETURNED",
            actor,
            {"target": target, "return_level": index, "attempt": app["attempt"] + 1},
        )
        if target == "student":
            return []
        return self._open(db, self._application(db, app["id"]), levels, index)

    def transition(
        self,
        db: sqlite3.Connection,
        task_id: int,
        decision: str,
        actor_email: str,
        comment: str | None = None,
        reviewer_data: dict | None = None,
    ) -> TransitionResult:
        decision = decision.strip().lower()
        with transaction(db):
            task = db.execute(
                "SELECT * FROM application_workflow_tasks WHERE id=?", (task_id,)
            ).fetchone()
            if (
                not task
                or task["assigned_reviewer_email"].lower()
                != actor_email.strip().lower()
            ):
                raise ValueError("Actor is not assigned to this task")
            if task["status"] != "active":
                raise ValueError("Task is no longer active; refresh the application")
            app = self._application(db, task["application_id"])
            if app["final_status"] or app["current_step_order"] == 0:
                raise ValueError("Application is closed or waiting for student rework")
            levels = self._definition(db, app["graph_version_id"])
            index = next(
                i
                for i, l in enumerate(levels)
                if any(n["node_key"] == task["node_key"] for n in l["reviewers"])
            )
            node = next(
                n
                for n in levels[index]["reviewers"]
                if n["node_key"] == task["node_key"]
            )
            if decision not in node.get("allowed_actions", []) or decision not in {
                "approve",
                "reject",
                "request_changes",
                "comment",
            }:
                raise ValueError("Action is not allowed for this reviewer")
            if decision == "comment":
                if not comment or not comment.strip():
                    raise ValueError("A comment is required")
                db.execute(
                    "INSERT INTO application_comments (application_id,author_email,text,visibility,created_at) VALUES (?,?,?,'internal',?)",
                    (app["id"], actor_email, comment.strip(), _now_iso()),
                )
                return TransitionResult(success=True)
            data = dict(reviewer_data or {})
            self._validate_inputs(node, data, decision == "approve")
            if (
                decision in {"reject", "request_changes"}
                and not (comment or "").strip()
            ):
                raise ValueError("Explain the rejection or requested changes")
            db.execute(
                "UPDATE application_workflow_tasks SET status=?,decision=?,acted_at=?,comment_summary=?,reviewer_data_json=? WHERE id=? AND status='active'",
                (
                    "completed"
                    if decision == "approve"
                    else "returned"
                    if decision == "request_changes"
                    else "rejected",
                    decision,
                    _now_iso(),
                    comment,
                    json.dumps(data),
                    task_id,
                ),
            )
            self._event(
                db,
                app["id"],
                "REVIEW_DECISION",
                actor_email,
                {
                    "task_id": task_id,
                    "node_key": node["node_key"],
                    "decision": decision,
                    "attempt": app["attempt"],
                },
            )
            if decision == "reject":
                db.execute(
                    "UPDATE application_workflow_tasks SET status='cancelled' WHERE application_id=? AND status='active'",
                    (app["id"],),
                )
                db.execute(
                    "UPDATE applications SET final_status='REJECTED',current_stage_label='Closed',updated_at=? WHERE id=?",
                    (_now_iso(), app["id"]),
                )
                return TransitionResult(success=True, application_status="REJECTED")
            if decision == "request_changes":
                target = node.get("metadata", {}).get("return_target", "student")
                if target == "student":
                    # The task's decision record is reviewer-only. Copy only the
                    # required reason into the student-visible conversation.
                    db.execute(
                        "INSERT INTO application_comments (application_id,author_email,text,visibility,created_at) VALUES (?,?,?,'student_visible',?)",
                        (app["id"], actor_email, comment.strip(), _now_iso()),
                    )
                ids = self._return(db, app, levels, index, target, actor_email)
                return TransitionResult(
                    success=True,
                    next_task_ids=ids,
                    application_status="STUDENT_REWORK"
                    if target == "student"
                    else "IN_PROGRESS",
                )
            keys = [n["node_key"] for n in levels[index]["reviewers"]]
            rows = db.execute(
                f"SELECT * FROM application_workflow_tasks WHERE application_id=? AND attempt=? AND node_key IN ({','.join('?' for _ in keys)})",
                (app["id"], app["attempt"], *keys),
            ).fetchall()
            if len(rows) != len(keys) or any(
                r["status"] != "completed" or r["decision"] != "approve" for r in rows
            ):
                return TransitionResult(success=True, application_status="IN_PROGRESS")
            values = json.loads(app["submitted_data_json"] or "{}")
            for r in db.execute(
                "SELECT reviewer_data_json FROM application_workflow_tasks WHERE application_id=? AND status='completed' ORDER BY id",
                (app["id"],),
            ):
                values.update(json.loads(r["reviewer_data_json"] or "{}"))
            for n in levels[index]["reviewers"]:
                rule = n.get("metadata", {}).get("return_rule")
                if (
                    rule
                    and rule["field"] in values
                    and str(values[rule["field"]]).lower() == str(rule["value"]).lower()
                ):
                    if app["attempt"] >= 10:
                        db.execute(
                            "UPDATE applications SET current_stage_label='Return limit reached — OGE action required' WHERE id=?",
                            (app["id"],),
                        )
                        self._event(
                            db,
                            app["id"],
                            "AUTOMATIC_RETURN_PAUSED",
                            actor_email,
                            {"level": index},
                        )
                        return TransitionResult(
                            success=True, application_status="PAUSED"
                        )
                    ids = self._return(
                        db, app, levels, index, rule["target"], actor_email
                    )
                    return TransitionResult(
                        success=True,
                        next_task_ids=ids,
                        application_status="STUDENT_REWORK"
                        if rule["target"] == "student"
                        else "IN_PROGRESS",
                    )
            ids = self._open(db, app, levels, index + 1)
            self._event(
                db,
                app["id"],
                "LEVEL_COMPLETED",
                actor_email,
                {"level_id": levels[index]["id"], "attempt": app["attempt"]},
            )
            return TransitionResult(
                success=True,
                next_task_ids=ids,
                application_status="IN_PROGRESS" if ids else "APPROVED",
            )

    def resubmit_after_rework(self, db, application_id):
        with transaction(db):
            app = self._application(db, application_id)
            if app["current_step_order"] != 0 or app["final_status"]:
                raise ValueError("Application is not waiting for student rework")
            ids = self._open(
                db,
                app,
                self._definition(db, app["graph_version_id"]),
                app["return_level"],
            )
            self._event(
                db,
                application_id,
                "STUDENT_RESUBMITTED",
                None,
                {"attempt": app["attempt"]},
            )
            return ids[0]

    def get_inbox(self, db, reviewer_email):
        rows = db.execute(
            """SELECT t.*,o.title AS opportunity_title,u.full_name AS student_name,n.display_name,n.visible_sections,n.allowed_actions
            FROM application_workflow_tasks t JOIN applications a ON a.id=t.application_id JOIN opportunities o ON o.id=a.opportunity_id
            JOIN student_profiles p ON p.id=a.student_profile_id JOIN users u ON u.id=p.user_id
            JOIN graph_nodes n ON n.graph_version_id=t.graph_version_id AND n.node_key=t.node_key
            WHERE t.status='active' AND a.final_status IS NULL AND LOWER(t.assigned_reviewer_email)=LOWER(?) ORDER BY t.assigned_at,t.id""",
            (reviewer_email,),
        ).fetchall()
        return [
            TaskRow(
                task_id=r["id"],
                application_id=r["application_id"],
                opportunity_title=r["opportunity_title"],
                student_name=r["student_name"]
                if "full_name" in json.loads(r["visible_sections"] or "[]")
                else "Applicant",
                node_key=r["node_key"],
                display_name=r["display_name"] or "Review",
                allowed_actions=json.loads(r["allowed_actions"] or "[]"),
                visible_sections=json.loads(r["visible_sections"] or "[]"),
                assigned_at=r["assigned_at"],
            )
            for r in rows
        ]
