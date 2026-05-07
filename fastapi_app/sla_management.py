from __future__ import annotations

import json
import logging
import os
import smtplib
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Any

_log = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def json_list(raw: str | None, fallback: list[int]) -> list[int]:
    if not raw:
        return fallback
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return fallback
    if not isinstance(parsed, list):
        return fallback
    out: list[int] = []
    for item in parsed:
        try:
            out.append(int(item))
        except (TypeError, ValueError):
            continue
    return out or fallback


def node_metadata(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


@dataclass
class SLAEvaluation:
    task_id: int
    graph_node_id: int
    application_id: int
    opportunity_title: str
    student_name: str
    reviewer_email: str
    current_node: str
    assigned_at: str
    deadline_at: str
    sla_days: int
    days_remaining: int
    hours_remaining: int
    status: str
    escalation_email: str | None
    breach_acknowledged: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.task_id,
            "task_id": self.task_id,
            "graph_node_id": self.graph_node_id,
            "application_id": self.application_id,
            "opportunity_title": self.opportunity_title,
            "student_name": self.student_name,
            "reviewer_email": self.reviewer_email,
            "current_node": self.current_node,
            "assigned_at": self.assigned_at,
            "deadline_at": self.deadline_at,
            "sla_days": self.sla_days,
            "days_remaining": self.days_remaining,
            "hours_remaining": self.hours_remaining,
            "status": self.status,
            "escalation_email": self.escalation_email,
            "breach_acknowledged": self.breach_acknowledged,
        }


class SLAEmailSender:
    """SMTP adapter. Without SMTP env vars, records a dry-run success for local demos."""

    def send(self, to_email: str, subject: str, body: str) -> dict[str, Any]:
        host = os.environ.get("SMTP_HOST")
        from_email = os.environ.get("SMTP_FROM_EMAIL", "prism@localhost")
        if not host:
            _log.info("sla_email_dry_run", extra={"to": to_email, "subject": subject})
            return {"sent": True, "dry_run": True, "timestamp": now_iso()}

        message = EmailMessage()
        message["From"] = from_email
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(body)

        port = int(os.environ.get("SMTP_PORT", "587"))
        username = os.environ.get("SMTP_USERNAME")
        password = os.environ.get("SMTP_PASSWORD")
        use_tls = os.environ.get("SMTP_USE_TLS", "1") != "0"

        with smtplib.SMTP(host, port, timeout=10) as smtp:
            if use_tls:
                smtp.starttls()
            if username and password:
                smtp.login(username, password)
            smtp.send_message(message)
        return {"sent": True, "dry_run": False, "timestamp": now_iso()}


class SLAManagementService:
    DEFAULT_SLA_DAYS = 3
    DEFAULT_REMINDER_DAYS = [1]

    def upsert_policy(
        self,
        db: sqlite3.Connection,
        graph_node_id: int,
        sla_days: int,
        reminder_days: list[int],
        escalation_email: str | None,
    ) -> dict[str, Any]:
        node = db.execute("SELECT id FROM graph_nodes WHERE id = ?", (graph_node_id,)).fetchone()
        if not node:
            raise ValueError("Graph node not found")
        if sla_days < 1:
            raise ValueError("SLA days must be at least 1")

        normalized_reminders = sorted({day for day in reminder_days if day >= 0}, reverse=True) or self.DEFAULT_REMINDER_DAYS
        ts = now_iso()
        with db:
            existing = db.execute("SELECT id FROM sla_policies WHERE graph_node_id = ?", (graph_node_id,)).fetchone()
            if existing:
                db.execute(
                    """
                    UPDATE sla_policies
                    SET sla_days = ?, reminder_days = ?, escalation_email = ?, updated_at = ?
                    WHERE graph_node_id = ?
                    """,
                    (sla_days, json.dumps(normalized_reminders), escalation_email, ts, graph_node_id),
                )
            else:
                db.execute(
                    """
                    INSERT INTO sla_policies
                      (graph_node_id, sla_days, reminder_days, escalation_email, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (graph_node_id, sla_days, json.dumps(normalized_reminders), escalation_email, ts, ts),
                )
        row = db.execute("SELECT * FROM sla_policies WHERE graph_node_id = ?", (graph_node_id,)).fetchone()
        return self.serialize_policy(row)

    def list_policies(self, db: sqlite3.Connection) -> list[dict[str, Any]]:
        rows = db.execute(
            """
            SELECT p.*, n.node_key, n.display_name, n.reviewer_email, gv.opportunity_id, o.title AS opportunity_title
            FROM sla_policies p
            JOIN graph_nodes n ON n.id = p.graph_node_id
            JOIN graph_versions gv ON gv.id = n.graph_version_id
            JOIN opportunities o ON o.id = gv.opportunity_id
            ORDER BY o.title ASC, n.display_name ASC
            """
        ).fetchall()
        return [self.serialize_policy(row) for row in rows]

    def dashboard(self, db: sqlite3.Connection) -> dict[str, Any]:
        evaluations = self.evaluate_active_tasks(db)
        on_time = [item for item in evaluations if item.status == "on_time"]
        approaching = [item for item in evaluations if item.status == "approaching"]
        breached = [item for item in evaluations if item.status == "breached"]
        return {
            "on_time": len(on_time),
            "approaching": len(approaching),
            "breached": len(breached),
            "approaching_tasks": [item.to_dict() for item in approaching],
            "breached_tasks": [item.to_dict() for item in breached],
        }

    def reviewer_tasks(self, db: sqlite3.Connection, reviewer_email: str) -> list[dict[str, Any]]:
        evaluations = self.evaluate_active_tasks(db, reviewer_email=reviewer_email)
        return [item.to_dict() for item in evaluations]

    def acknowledge_breach(
        self,
        db: sqlite3.Connection,
        task_id: int,
        reviewer_email: str,
        notes: str | None,
    ) -> dict[str, Any]:
        task = db.execute(
            """
            SELECT * FROM application_workflow_tasks
            WHERE id = ? AND status = 'active'
            """,
            (task_id,),
        ).fetchone()
        if not task:
            raise ValueError("Active task not found")
        if task["assigned_reviewer_email"].strip().lower() != reviewer_email.strip().lower():
            raise ValueError("Actor is not assigned to this task")

        evaluation = next((item for item in self.evaluate_active_tasks(db) if item.task_id == task_id), None)
        if not evaluation or evaluation.status != "breached":
            raise ValueError("Task has not breached SLA")

        ts = now_iso()
        with db:
            db.execute(
                """
                INSERT INTO sla_breaches
                  (task_id, breached_at, escalation_sent_to, acknowledged_by_email, acknowledged_at, resolution_notes)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(task_id) DO UPDATE SET
                  acknowledged_by_email = excluded.acknowledged_by_email,
                  acknowledged_at = excluded.acknowledged_at,
                  resolution_notes = excluded.resolution_notes
                """,
                (task_id, evaluation.deadline_at, evaluation.escalation_email, reviewer_email, ts, notes),
            )
        return {"acknowledged": True, "acknowledged_at": ts}

    def run_check(self, db: sqlite3.Connection, sender: SLAEmailSender | None = None) -> dict[str, Any]:
        sender = sender or SLAEmailSender()
        sent = 0
        breached = 0
        for evaluation in self.evaluate_active_tasks(db):
            if evaluation.status == "breached":
                breached += 1
                recipients = [evaluation.reviewer_email]
                if evaluation.escalation_email:
                    recipients.append(evaluation.escalation_email)
                for recipient in recipients:
                    if self._send_once(
                        db,
                        sender,
                        evaluation.task_id,
                        "breached",
                        recipient,
                        f"SLA breached: {evaluation.opportunity_title}",
                        f"{evaluation.student_name}'s task at {evaluation.current_node} is overdue.",
                    ):
                        sent += 1
                self._record_breach(db, evaluation)
            elif evaluation.status == "approaching":
                reminder_type = f"approaching_{max(evaluation.days_remaining, 0)}d"
                if self._send_once(
                    db,
                    sender,
                    evaluation.task_id,
                    reminder_type,
                    evaluation.reviewer_email,
                    f"SLA approaching: {evaluation.opportunity_title}",
                    f"{evaluation.student_name}'s task at {evaluation.current_node} is due {evaluation.deadline_at}.",
                ):
                    sent += 1
        return {"checked": True, "sent": sent, "breached": breached, "timestamp": now_iso()}

    def evaluate_active_tasks(self, db: sqlite3.Connection, reviewer_email: str | None = None) -> list[SLAEvaluation]:
        params: list[Any] = []
        reviewer_clause = ""
        if reviewer_email:
            reviewer_clause = "AND LOWER(t.assigned_reviewer_email) = LOWER(?)"
            params.append(reviewer_email.strip().lower())

        rows = db.execute(
            f"""
            SELECT
              t.id AS task_id,
              t.application_id,
              t.assigned_reviewer_email,
              t.assigned_at,
              n.id AS graph_node_id,
              n.node_key,
              n.display_name,
              n.metadata,
              p.sla_days,
              p.reminder_days,
              p.escalation_email,
              b.acknowledged_at,
              o.title AS opportunity_title,
              u.full_name AS student_name
            FROM application_workflow_tasks t
            JOIN graph_nodes n
              ON n.graph_version_id = t.graph_version_id
             AND n.node_key = t.node_key
            JOIN applications a ON a.id = t.application_id
            JOIN opportunities o ON o.id = a.opportunity_id
            JOIN student_profiles sp ON sp.id = a.student_profile_id
            JOIN users u ON u.id = sp.user_id
            LEFT JOIN sla_policies p ON p.graph_node_id = n.id
            LEFT JOIN sla_breaches b ON b.task_id = t.id
            WHERE t.status = 'active'
            {reviewer_clause}
            ORDER BY t.assigned_at ASC, t.id ASC
            """,
            tuple(params),
        ).fetchall()

        now = datetime.now(timezone.utc)
        result: list[SLAEvaluation] = []
        for row in rows:
            assigned_at = parse_iso(row["assigned_at"]) or now
            metadata = node_metadata(row["metadata"])
            metadata_hours = int(metadata.get("sla_hours") or 0)
            policy_days = int(row["sla_days"] or 0)
            if policy_days:
                sla_days = policy_days
            elif metadata_hours:
                sla_days = max(1, round(metadata_hours / 24))
            else:
                sla_days = self.DEFAULT_SLA_DAYS
            reminder_days = json_list(row["reminder_days"], self.DEFAULT_REMINDER_DAYS)
            deadline = assigned_at + timedelta(days=sla_days)
            remaining = deadline - now
            hours_remaining = int(remaining.total_seconds() // 3600)
            days_remaining = int(remaining.total_seconds() // 86400)
            status = "on_time"
            if remaining.total_seconds() < 0:
                status = "breached"
            elif any(timedelta(days=day) >= remaining for day in reminder_days):
                status = "approaching"

            result.append(
                SLAEvaluation(
                    task_id=int(row["task_id"]),
                    graph_node_id=int(row["graph_node_id"]),
                    application_id=int(row["application_id"]),
                    opportunity_title=str(row["opportunity_title"]),
                    student_name=str(row["student_name"]),
                    reviewer_email=str(row["assigned_reviewer_email"]),
                    current_node=str(row["display_name"] or row["node_key"]),
                    assigned_at=assigned_at.isoformat(),
                    deadline_at=deadline.isoformat(),
                    sla_days=sla_days,
                    days_remaining=days_remaining,
                    hours_remaining=hours_remaining,
                    status=status,
                    escalation_email=str(row["escalation_email"]) if row["escalation_email"] else None,
                    breach_acknowledged=bool(row["acknowledged_at"]),
                )
            )
        return result

    def serialize_policy(self, row: sqlite3.Row) -> dict[str, Any]:
        data = dict(row)
        data["reminder_days"] = json_list(data.get("reminder_days"), self.DEFAULT_REMINDER_DAYS)
        return data

    def _send_once(
        self,
        db: sqlite3.Connection,
        sender: SLAEmailSender,
        task_id: int,
        reminder_type: str,
        to_email: str,
        subject: str,
        body: str,
    ) -> bool:
        existing = db.execute(
            """
            SELECT id FROM sla_reminders_sent
            WHERE task_id = ? AND reminder_type = ? AND LOWER(sent_to_email) = LOWER(?)
            """,
            (task_id, reminder_type, to_email),
        ).fetchone()
        if existing:
            return False
        sender.send(to_email, subject, body)
        with db:
            db.execute(
                """
                INSERT OR IGNORE INTO sla_reminders_sent
                  (task_id, reminder_type, sent_at, sent_to_email)
                VALUES (?, ?, ?, ?)
                """,
                (task_id, reminder_type, now_iso(), to_email),
            )
        return True

    def _record_breach(self, db: sqlite3.Connection, evaluation: SLAEvaluation) -> None:
        with db:
            db.execute(
                """
                INSERT OR IGNORE INTO sla_breaches
                  (task_id, breached_at, escalation_sent_to)
                VALUES (?, ?, ?)
                """,
                (evaluation.task_id, evaluation.deadline_at, evaluation.escalation_email),
            )


def sla_check_job(db_path: Path | str) -> dict[str, Any]:
    db = sqlite3.connect(str(db_path), check_same_thread=False)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    try:
        return SLAManagementService().run_check(db)
    finally:
        db.close()
