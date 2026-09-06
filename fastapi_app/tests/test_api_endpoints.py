from __future__ import annotations

import json

import pytest
from fastapi import HTTPException

from conftest import login
from fastapi_app import main
from fastapi_app.application_data import form_schema
from fastapi_app.graph_execution import GraphExecutionService
from fastapi_app.graph_models import GraphModel


def reviewer(
    key: str,
    email: str,
    *,
    visible: list[str] | None = None,
    actions: list[str] | None = None,
    metadata: dict | None = None,
) -> dict:
    return {
        "node_key": key,
        "node_type": "reviewer",
        "display_name": key.replace("_", " ").title(),
        "reviewer_email": email,
        "visible_sections": visible or ["full_name"],
        "allowed_actions": actions or ["approve", "request_changes", "comment"],
        "metadata": metadata or {},
    }


def workflow(*levels: tuple[str, str, list[dict]]) -> GraphModel:
    return GraphModel(
        levels=[{"id": level_id, "name": name, "reviewers": reviewers} for level_id, name, reviewers in levels]
    )


def seed_two_applications(database, graph: GraphModel, *, code: str = "HTTP-TEST"):
    opportunity_id, version_id = database.add_workflow(graph, code=code)
    alice_id, alice_tasks = database.add_application(
        opportunity_id,
        version_id,
        "alice@plaksha.edu.in",
        {"full_name": "Alice", "statement": "Alice private statement"},
    )
    bob_id, bob_tasks = database.add_application(
        opportunity_id,
        version_id,
        "bob@plaksha.edu.in",
        {"full_name": "Bob", "statement": "Bob private statement"},
    )
    return opportunity_id, version_id, alice_id, alice_tasks, bob_id, bob_tasks


def test_auth_rejects_missing_malformed_forged_and_revoked_sessions(client, database):
    assert client.get("/api/auth/me").status_code == 401

    client.cookies.set(main.SESSION_COOKIE, "malformed")
    assert client.get("/api/auth/me").status_code == 401

    valid = main.encode_session(
        {
            "email": "alice@plaksha.edu.in",
            "name": "Alice",
            "role": "STUDENT",
            "roleDisplayName": "Student",
            "userId": 1,
        }
    )
    body, _ = valid.rsplit(".", 1)
    client.cookies.set(main.SESSION_COOKIE, f"{body}.{'0' * 64}")
    assert client.get("/api/auth/me").status_code == 401

    payload = login(client, "alice@plaksha.edu.in", "STUDENT")
    payload["userId"] = 9999
    client.cookies.set(main.SESSION_COOKIE, main.encode_session(payload))
    response = client.get("/api/auth/me")
    assert response.status_code == 403
    assert response.json()["detail"] == "Workspace access was revoked"


def test_production_auth_is_blocked_until_clerk_is_integrated(client, monkeypatch):
    login(client, "alice@plaksha.edu.in", "STUDENT")
    monkeypatch.setenv("PRISM_ENV", "production")
    response = client.get("/api/auth/me")
    assert response.status_code == 503
    assert "Clerk authentication" in response.json()["detail"]


def test_session_identity_prevents_task_and_comment_actor_spoofing(client, database):
    graph = workflow(("review", "Review", [reviewer("review", "reviewer-a@plaksha.edu.in")]))
    _, _, application_id, task_ids, _, _ = seed_two_applications(database, graph, code="SPOOF")

    login(client, "reviewer-b@plaksha.edu.in", "REVIEWER")
    response = client.post(
        f"/api/reviewer/tasks/{task_ids[0]}/decide",
        json={"decision": "approve", "actor_email": "reviewer-a@plaksha.edu.in"},
    )
    assert response.status_code == 400
    assert "Actor is not assigned" in response.json()["detail"]

    login(client, "reviewer-a@plaksha.edu.in", "REVIEWER")
    response = client.post(
        f"/api/applications/{application_id}/comments",
        json={
            "text": "Spoofed author",
            "visibility": "internal",
            "authorEmail": "oge@plaksha.edu.in",
        },
    )
    assert response.status_code == 403
    with database.connect() as conn:
        assert conn.execute(
            "SELECT COUNT(*) FROM application_comments WHERE application_id=?", (application_id,)
        ).fetchone()[0] == 0


def test_student_can_only_read_their_own_application(client, database):
    graph = workflow(("review", "Review", [reviewer("review", "reviewer-a@plaksha.edu.in")]))
    _, _, alice_id, _, bob_id, _ = seed_two_applications(database, graph, code="OWN-ONLY")

    login(client, "alice@plaksha.edu.in", "STUDENT")
    own = client.get(f"/api/applications/{alice_id}")
    assert own.status_code == 200
    assert own.json()["application_file"]["statement"] == "Alice private statement"
    assert client.get(f"/api/applications/{bob_id}").status_code == 403

    listing = client.get("/api/applications")
    assert listing.status_code == 200
    assert {item["id"] for item in listing.json()["items"]} == {alice_id}


def test_reviewer_field_and_comment_grants_apply_to_detail_inbox_and_ai(client, database, monkeypatch):
    graph = workflow(
        (
            "review",
            "Review",
            [
                reviewer(
                    "review",
                    "reviewer-a@plaksha.edu.in",
                    visible=["full_name"],
                    metadata={"can_view_comments": False},
                )
            ],
        )
    )
    _, _, application_id, _, _, _ = seed_two_applications(database, graph, code="PROJECTION")
    with database.connect() as conn:
        conn.executemany(
            """INSERT INTO application_comments(application_id,author_email,text,visibility,created_at)
               VALUES (?,?,?,?,?)""",
            [
                (application_id, "oge@plaksha.edu.in", "Internal secret", "internal", "2026-09-06"),
                (application_id, "alice@plaksha.edu.in", "Student-visible note", "student_visible", "2026-09-06"),
            ],
        )

    login(client, "reviewer-a@plaksha.edu.in", "REVIEWER")
    detail = client.get(f"/api/applications/{application_id}")
    assert detail.status_code == 200
    assert detail.json()["application_file"] == {"full_name": "Alice"}
    assert [comment["text"] for comment in detail.json()["comments"]] == ["Student-visible note"]
    assert json.loads(detail.json()["application"]["submitted_data_json"]) == {"full_name": "Alice"}

    inbox = client.get("/api/reviewer/inbox")
    assert inbox.status_code == 200
    item = next(item for item in inbox.json()["items"] if item["id"] == application_id)
    assert item["student_name"] == "Alice"
    assert item["visible_sections"] == ["full_name"]
    assert "statement" not in json.dumps(item)
    assert "Internal secret" not in json.dumps(item)

    captured: list[dict] = []

    def capture(detail_payload):
        captured.append(detail_payload)
        return {"captured": True}

    monkeypatch.setattr(main, "ai_approval_assist", capture)
    monkeypatch.setattr(main, "ai_thread_summary", capture)
    assert client.get(f"/api/applications/{application_id}/ai-approval-assist").json() == {"captured": True}
    assert client.get(f"/api/applications/{application_id}/ai-thread-summary").json() == {"captured": True}
    assert len(captured) == 2
    for payload in captured:
        assert payload["application_file"] == {"full_name": "Alice"}
        assert [comment["text"] for comment in payload["comments"]] == ["Student-visible note"]


def test_student_never_receives_internal_comments(client, database):
    graph = workflow(("review", "Review", [reviewer("review", "reviewer-a@plaksha.edu.in")]))
    _, _, application_id, _, _, _ = seed_two_applications(database, graph, code="COMMENTS")
    with database.connect() as conn:
        conn.executemany(
            """INSERT INTO application_comments(application_id,author_email,text,visibility,created_at)
               VALUES (?,?,?,?,?)""",
            [
                (application_id, "reviewer-a@plaksha.edu.in", "Internal secret", "internal", "2026-09-06"),
                (application_id, "reviewer-a@plaksha.edu.in", "Visible response", "student_visible", "2026-09-06"),
            ],
        )

    login(client, "alice@plaksha.edu.in", "STUDENT")
    response = client.get(f"/api/applications/{application_id}/comments")
    assert response.status_code == 200
    assert [comment["text"] for comment in response.json()["comments"]] == ["Visible response"]


def test_publish_freezes_level_and_form_definitions(client, database):
    login(client, "oge@plaksha.edu.in", "ADMIN")
    payload = {
        "applicantFormFields": ["full_name", "statement"],
        "opportunity": {
            "title": "Frozen Definition Opportunity",
            "description": "A complete description for snapshot verification.",
            "deadline": "2099-12-31",
            "seats": 3,
        },
        "graph": {
            "levels": [
                {
                    "id": "review",
                    "name": "Review",
                    "reviewers": [
                        reviewer("review", "reviewer-a@plaksha.edu.in", visible=["full_name"])
                    ],
                }
            ]
        },
        "studentVisibilityRules": ["alice@plaksha.edu.in"],
        "clarifyingQuestions": [],
        "warnings": [],
        "confidence": 1.0,
        "isFallback": False,
    }
    draft = client.post("/api/admin/workflow-drafts/manual", json=payload)
    assert draft.status_code == 201, draft.text
    assert draft.json()["draft"]["publish_ready"] == 1
    published = client.post(f"/api/admin/workflow-drafts/{draft.json()['draft_id']}/publish")
    assert published.status_code == 200, published.text
    version_id = published.json()["graph_version_id"]

    with database.connect() as conn:
        frozen = json.loads(
            conn.execute("SELECT definition_json FROM graph_versions WHERE id=?", (version_id,)).fetchone()[0]
        )
        assert frozen["graph"]["levels"][0]["name"] == "Review"
        assert [field["label"] for field in frozen["form_schema"]] == ["Full name", "Statement"]

        conn.execute("UPDATE form_field_catalog SET label='Changed later' WHERE field_key='full_name'")
        conn.execute(
            "UPDATE graph_nodes SET visible_sections='[\"statement\"]' WHERE graph_version_id=? AND node_key='review'",
            (version_id,),
        )
        graph_definition = GraphExecutionService()._definition(conn, version_id)
        app_shape = {"graph_version_id": version_id, "opportunity_id": published.json()["opportunity_id"]}
        assert graph_definition[0]["reviewers"][0]["visible_sections"] == ["full_name"]
        assert [field["label"] for field in form_schema(conn, app_shape)] == ["Full name", "Statement"]


def test_incompatible_existing_database_is_not_reset_on_startup(database):
    with database.connect() as conn:
        conn.execute("PRAGMA user_version = 0")
        alice_id = conn.execute(
            "SELECT id FROM users WHERE email='alice@plaksha.edu.in'"
        ).fetchone()[0]

    with pytest.raises(HTTPException, match="schema is incompatible"):
        main.ensure_db_initialized()

    with database.connect() as conn:
        assert conn.execute("SELECT full_name FROM users WHERE id=?", (alice_id,)).fetchone()[0] == "Alice"
        assert conn.execute("PRAGMA user_version").fetchone()[0] == 0
