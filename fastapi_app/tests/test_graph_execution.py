from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest

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
        "allowed_actions": actions or ["approve", "reject", "request_changes", "comment"],
        "metadata": metadata or {},
    }


def workflow(*levels: tuple[str, str, list[dict]]) -> GraphModel:
    return GraphModel(
        levels=[{"id": level_id, "name": name, "reviewers": reviewers} for level_id, name, reviewers in levels]
    )


def seed_application(database, graph: GraphModel, *, code: str = "ENGINE-TEST"):
    opportunity_id, version_id = database.add_workflow(graph, code=code)
    application_id, task_ids = database.add_application(
        opportunity_id,
        version_id,
        "alice@plaksha.edu.in",
        {"full_name": "Alice", "statement": "Private statement"},
    )
    return application_id, version_id, task_ids


def test_level_opens_all_reviewers_and_waits_for_unanimous_approval(database):
    graph = workflow(
        (
            "checks",
            "Parallel checks",
            [
                reviewer("academic", "reviewer-a@plaksha.edu.in"),
                reviewer("conduct", "reviewer-b@plaksha.edu.in"),
            ],
        ),
        ("final", "Final review", [reviewer("dean", "dean@plaksha.edu.in")]),
    )
    application_id, _, task_ids = seed_application(database, graph)
    service = GraphExecutionService()

    with database.connect() as conn:
        first = service.transition(conn, task_ids[0], "approve", "reviewer-a@plaksha.edu.in")
        assert first.next_task_ids == []
        app = conn.execute("SELECT * FROM applications WHERE id=?", (application_id,)).fetchone()
        assert (app["current_level"], app["current_stage_label"]) == (0, "Parallel checks")

        second = service.transition(conn, task_ids[1], "approve", "reviewer-b@plaksha.edu.in")
        assert len(second.next_task_ids) == 1
        next_task = conn.execute(
            "SELECT * FROM application_workflow_tasks WHERE id=?", (second.next_task_ids[0],)
        ).fetchone()
        assert next_task["node_key"] == "dean"
        app = conn.execute("SELECT * FROM applications WHERE id=?", (application_id,)).fetchone()
        assert (app["current_level"], app["current_step_order"], app["current_stage_label"]) == (
            1,
            2,
            "Final review",
        )


def test_parallel_approvals_from_separate_connections_advance_exactly_once(database):
    graph = workflow(
        (
            "checks",
            "Parallel checks",
            [
                reviewer("academic", "reviewer-a@plaksha.edu.in"),
                reviewer("conduct", "reviewer-b@plaksha.edu.in"),
            ],
        ),
        ("final", "Final review", [reviewer("dean", "dean@plaksha.edu.in")]),
    )
    application_id, _, task_ids = seed_application(database, graph, code="CONCURRENT")
    gate = Barrier(2)

    def decide(task_id: int, actor: str):
        with database.connect() as conn:
            gate.wait()
            return GraphExecutionService().transition(conn, task_id, "approve", actor)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(
                lambda args: decide(*args),
                zip(task_ids, ["reviewer-a@plaksha.edu.in", "reviewer-b@plaksha.edu.in"]),
            )
        )

    assert sorted(len(result.next_task_ids) for result in results) == [0, 1]
    with database.connect() as conn:
        rows = conn.execute(
            "SELECT * FROM application_workflow_tasks WHERE application_id=? AND node_key='dean'",
            (application_id,),
        ).fetchall()
        assert len(rows) == 1
        assert rows[0]["status"] == "active"


def test_return_to_earlier_level_invalidates_that_level_and_every_later_approval(database):
    graph = workflow(
        ("eligibility", "Eligibility", [reviewer("eligibility", "reviewer-a@plaksha.edu.in")]),
        ("faculty", "Faculty", [reviewer("faculty", "reviewer-b@plaksha.edu.in")]),
        (
            "final",
            "Final",
            [
                reviewer(
                    "dean",
                    "dean@plaksha.edu.in",
                    metadata={"return_target": "eligibility"},
                )
            ],
        ),
    )
    application_id, _, task_ids = seed_application(database, graph, code="RETURN-EARLIER")
    service = GraphExecutionService()
    with database.connect() as conn:
        faculty = service.transition(conn, task_ids[0], "approve", "reviewer-a@plaksha.edu.in").next_task_ids[0]
        dean = service.transition(conn, faculty, "approve", "reviewer-b@plaksha.edu.in").next_task_ids[0]
        result = service.transition(
            conn,
            dean,
            "request_changes",
            "dean@plaksha.edu.in",
            comment="Repeat the eligibility check.",
        )

        assert len(result.next_task_ids) == 1
        history = conn.execute(
            "SELECT node_key,attempt,status FROM application_workflow_tasks WHERE application_id=? ORDER BY id",
            (application_id,),
        ).fetchall()
        assert [(row["node_key"], row["attempt"], row["status"]) for row in history] == [
            ("eligibility", 1, "invalidated"),
            ("faculty", 1, "invalidated"),
            ("dean", 1, "invalidated"),
            ("eligibility", 2, "active"),
        ]
        app = conn.execute("SELECT * FROM applications WHERE id=?", (application_id,)).fetchone()
        assert (app["attempt"], app["current_level"], app["return_level"]) == (2, 0, 0)


def test_student_rework_resubmission_reopens_the_whole_unanimous_level(database):
    graph = workflow(
        (
            "checks",
            "Parallel checks",
            [
                reviewer("academic", "reviewer-a@plaksha.edu.in"),
                reviewer("conduct", "reviewer-b@plaksha.edu.in"),
            ],
        )
    )
    application_id, _, task_ids = seed_application(database, graph, code="STUDENT-REWORK")
    service = GraphExecutionService()
    with database.connect() as conn:
        result = service.transition(
            conn,
            task_ids[0],
            "request_changes",
            "reviewer-a@plaksha.edu.in",
            comment="Please correct the statement.",
        )
        assert result.application_status == "STUDENT_REWORK"
        assert result.next_task_ids == []
        app = conn.execute("SELECT * FROM applications WHERE id=?", (application_id,)).fetchone()
        assert (app["attempt"], app["current_step_order"], app["current_stage_label"]) == (
            2,
            0,
            "Student Rework",
        )
        assert {
            row["status"]
            for row in conn.execute(
                "SELECT status FROM application_workflow_tasks WHERE application_id=? AND attempt=1",
                (application_id,),
            )
        } == {"invalidated"}

        service.resubmit_after_rework(conn, application_id)
        reopened = conn.execute(
            """SELECT node_key,status FROM application_workflow_tasks
               WHERE application_id=? AND attempt=2 ORDER BY node_key""",
            (application_id,),
        ).fetchall()
        assert [(row["node_key"], row["status"]) for row in reopened] == [
            ("academic", "active"),
            ("conduct", "active"),
        ]


def test_stale_and_spoofed_decisions_are_rejected(database):
    graph = workflow(("review", "Review", [reviewer("review", "reviewer-a@plaksha.edu.in")]))
    _, _, task_ids = seed_application(database, graph, code="STALE")
    task_id = task_ids[0]
    service = GraphExecutionService()
    with database.connect() as conn:
        with pytest.raises(ValueError, match="Actor is not assigned"):
            service.transition(conn, task_id, "approve", "reviewer-b@plaksha.edu.in")
        service.transition(conn, task_id, "approve", "reviewer-a@plaksha.edu.in")
        with pytest.raises(ValueError, match="no longer active"):
            service.transition(conn, task_id, "approve", "reviewer-a@plaksha.edu.in")


def test_required_reviewer_inputs_are_typed_and_required_on_approval(database):
    graph = workflow(
        (
            "review",
            "Review",
            [
                reviewer(
                    "review",
                    "reviewer-a@plaksha.edu.in",
                    metadata={
                        "required_inputs": [
                            {
                                "input_key": "recommendation",
                                "label": "Recommendation",
                                "input_type": "select",
                                "options": ["yes", "no"],
                                "required": True,
                            },
                            {
                                "input_key": "score",
                                "label": "Score",
                                "input_type": "number",
                                "required": True,
                            },
                            {
                                "input_key": "verified",
                                "label": "Verified",
                                "input_type": "checkbox",
                                "required": True,
                            },
                        ]
                    },
                )
            ],
        )
    )
    _, _, task_ids = seed_application(database, graph, code="INPUTS")
    task_id = task_ids[0]
    service = GraphExecutionService()
    invalid = [
        ({}, "Missing required reviewer input: Recommendation"),
        ({"recommendation": "maybe", "score": 4, "verified": True}, "Invalid option"),
        ({"recommendation": "yes", "score": "inf", "verified": True}, "finite number"),
        ({"recommendation": "yes", "score": 4, "verified": "yes"}, "true or false"),
        ({"recommendation": "yes", "score": 4, "verified": True, "secret": 1}, "Unknown reviewer input"),
    ]
    with database.connect() as conn:
        for values, message in invalid:
            with pytest.raises(ValueError, match=message):
                service.transition(conn, task_id, "approve", "reviewer-a@plaksha.edu.in", reviewer_data=values)

        result = service.transition(
            conn,
            task_id,
            "approve",
            "reviewer-a@plaksha.edu.in",
            reviewer_data={"recommendation": "yes", "score": "4.5", "verified": True},
        )
        assert result.application_status == "APPROVED"
        stored = conn.execute(
            "SELECT reviewer_data_json FROM application_workflow_tasks WHERE id=?", (task_id,)
        ).fetchone()
        assert json.loads(stored["reviewer_data_json"]) == {
            "recommendation": "yes",
            "score": 4.5,
            "verified": True,
        }
