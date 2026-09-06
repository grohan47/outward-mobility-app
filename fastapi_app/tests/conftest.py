from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from fastapi_app import main
from fastapi_app.graph_execution import GraphExecutionService
from fastapi_app.graph_models import GraphModel


NOW = "2026-09-06T00:00:00+00:00"


@dataclass
class DatabaseHarness:
    path: Path

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA busy_timeout = 10000")
        return conn

    def add_user(self, email: str, name: str, *roles: str, student_id: str | None = None) -> int:
        with self.connect() as conn:
            cursor = conn.execute(
                "INSERT INTO users(email,full_name,is_active,created_at) VALUES (?,?,1,?)",
                (email, name, NOW),
            )
            user_id = int(cursor.lastrowid)
            for role in roles:
                role_row = conn.execute("SELECT id FROM roles WHERE code=?", (role,)).fetchone()
                conn.execute(
                    "INSERT INTO user_roles(user_id,role_id,created_at) VALUES (?,?,?)",
                    (user_id, role_row["id"], NOW),
                )
            if student_id:
                conn.execute(
                    "INSERT INTO student_profiles(user_id,student_id,program,official_cgpa,created_at) VALUES (?,?,?,?,?)",
                    (user_id, student_id, "BTech", 8.4, NOW),
                )
            return user_id

    def add_catalog_field(
        self,
        key: str,
        label: str,
        *,
        input_type: str = "text",
        section: str = "application",
        options: list[str] | None = None,
    ) -> None:
        with self.connect() as conn:
            conn.execute(
                """INSERT INTO form_field_catalog
                   (field_key,label,input_type,options_json,section_key,is_active)
                   VALUES (?,?,?,?,?,1)""",
                (key, label, input_type, json.dumps(options or []), section),
            )

    def add_workflow(
        self,
        graph: GraphModel,
        *,
        code: str = "TEST-OPP",
        title: str = "Test Mobility Opportunity",
        form_fields: list[str] | None = None,
        eligible_emails: list[str] | None = None,
    ) -> tuple[int, int]:
        form_fields = form_fields or ["full_name", "statement"]
        definition = {
            "opportunity": {"title": title, "description": "Test opportunity"},
            "graph": graph.model_dump(mode="json"),
            "applicant_form_fields": form_fields,
            "form_schema": [],
        }
        with self.connect() as conn:
            cursor = conn.execute(
                """INSERT INTO opportunities
                   (code,title,description,deadline,seats,status,created_at,updated_at)
                   VALUES (?,?,?,'2099-12-31',5,'published',?,?)""",
                (code, title, "Test opportunity", NOW, NOW),
            )
            opportunity_id = int(cursor.lastrowid)
            for order, key in enumerate(form_fields, start=1):
                field = conn.execute("SELECT * FROM form_field_catalog WHERE field_key=?", (key,)).fetchone()
                definition["form_schema"].append(
                    {
                        **dict(field),
                        "options": json.loads(field["options_json"] or "[]"),
                    }
                )
                conn.execute(
                    "INSERT INTO opportunity_required_fields(opportunity_id,field_key,display_order) VALUES (?,?,?)",
                    (opportunity_id, key, order),
                )
            for email in eligible_emails or ["alice@plaksha.edu.in", "bob@plaksha.edu.in"]:
                conn.execute(
                    """INSERT INTO opportunity_visibility_rules
                       (opportunity_id,rule_type,rule_value,created_at) VALUES (?,'EMAIL',?,?)""",
                    (opportunity_id, email, NOW),
                )
            cursor = conn.execute(
                """INSERT INTO graph_versions
                   (opportunity_id,version,status,created_by_email,published_by_email,published_at,created_at,definition_json)
                   VALUES (?,1,'active','oge@plaksha.edu.in','oge@plaksha.edu.in',?,?,?)""",
                (opportunity_id, NOW, NOW, json.dumps(definition)),
            )
            version_id = int(cursor.lastrowid)
            for node in graph.nodes:
                conn.execute(
                    """INSERT INTO graph_nodes
                       (graph_version_id,node_key,node_type,display_name,reviewer_email,visible_sections,allowed_actions,metadata)
                       VALUES (?,?,?,?,?,?,?,?)""",
                    (
                        version_id,
                        node.node_key,
                        node.node_type,
                        node.display_name,
                        node.reviewer_email,
                        json.dumps(node.visible_sections),
                        json.dumps(node.allowed_actions),
                        node.metadata.model_dump_json(),
                    ),
                )
            for edge in graph.edges:
                conn.execute(
                    """INSERT INTO graph_edges
                       (graph_version_id,from_node_key,to_node_key,condition_json,label,action)
                       VALUES (?,?,?,?,?,?)""",
                    (
                        version_id,
                        edge.from_node_key,
                        edge.to_node_key,
                        json.dumps(edge.condition_json) if edge.condition_json else None,
                        edge.label,
                        edge.action,
                    ),
                )
        return opportunity_id, version_id

    def add_application(
        self,
        opportunity_id: int,
        version_id: int,
        student_email: str,
        submitted_data: dict[str, Any] | None = None,
    ) -> tuple[int, list[int]]:
        with self.connect() as conn:
            profile = conn.execute(
                """SELECT sp.id FROM student_profiles sp JOIN users u ON u.id=sp.user_id
                   WHERE LOWER(u.email)=LOWER(?)""",
                (student_email,),
            ).fetchone()
            cursor = conn.execute(
                """INSERT INTO applications
                   (student_profile_id,opportunity_id,current_step_order,current_stage_label,graph_version_id,
                    submitted_data_json,submitted_at,created_at,updated_at)
                   VALUES (?,?,1,'Submitted',?,?,?,?,?)""",
                (
                    profile["id"],
                    opportunity_id,
                    version_id,
                    json.dumps(submitted_data or {"full_name": "Applicant", "statement": "Private statement"}),
                    NOW,
                    NOW,
                    NOW,
                ),
            )
            application_id = int(cursor.lastrowid)
        with self.connect() as conn:
            task_ids = GraphExecutionService().instantiate(conn, application_id, version_id)
        return application_id, task_ids


@pytest.fixture
def database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> DatabaseHarness:
    path = tmp_path / "isolated-test.sqlite"
    monkeypatch.setattr(main, "DB_PATH", path)
    monkeypatch.setenv("PRISM_ENV", "development")
    with sqlite3.connect(path) as conn:
        conn.row_factory = sqlite3.Row
        main.reset_schema(conn)
        for code, label in (("STUDENT", "Student"), ("REVIEWER", "Reviewer"), ("ADMIN", "Administrator")):
            conn.execute("INSERT INTO roles(code,display_name) VALUES (?,?)", (code, label))

    harness = DatabaseHarness(path)
    harness.add_user("alice@plaksha.edu.in", "Alice", "STUDENT", student_id="S-ALICE")
    harness.add_user("bob@plaksha.edu.in", "Bob", "STUDENT", student_id="S-BOB")
    harness.add_user("reviewer-a@plaksha.edu.in", "Reviewer A", "REVIEWER")
    harness.add_user("reviewer-b@plaksha.edu.in", "Reviewer B", "REVIEWER")
    harness.add_user("dean@plaksha.edu.in", "Dean", "REVIEWER")
    harness.add_user("oge@plaksha.edu.in", "OGE", "REVIEWER", "ADMIN")
    harness.add_catalog_field("full_name", "Full name")
    harness.add_catalog_field("statement", "Statement")
    return harness


@pytest.fixture
def client(database: DatabaseHarness):
    with TestClient(main.app) as test_client:
        yield test_client


def login(client: TestClient, email: str, role: str | None = None) -> dict[str, Any]:
    client.cookies.clear()
    response = client.post("/api/auth/login", json={"email": email})
    assert response.status_code == 200, response.text
    user = response.json()["user"]
    if role is not None and user["role"] != role:
        response = client.post("/api/auth/select-workspace", json={"role": role})
        assert response.status_code == 200, response.text
        user = response.json()["user"]
    return user
