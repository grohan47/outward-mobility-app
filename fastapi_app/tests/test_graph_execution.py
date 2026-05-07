import json
import sqlite3
import unittest

from fastapi_app.graph_execution import GraphExecutionService
from fastapi_app.main import reset_schema


class GraphExecutionServiceTests(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        reset_schema(self.conn)
        self.service = GraphExecutionService()
        self.graph_version_id = self._seed_base_application({"funding_requested": True, "cgpa": 8.7})

    def tearDown(self):
        self.conn.close()

    def _seed_base_application(self, submitted_data: dict) -> int:
        now = "2026-05-05T00:00:00+00:00"
        self.conn.execute(
            "INSERT INTO users (id, email, full_name, is_active, created_at) VALUES (1, ?, ?, 1, ?)",
            ("student@plaksha.edu.in", "Student One", now),
        )
        self.conn.execute(
            """
            INSERT INTO student_profiles (id, user_id, student_id, program, official_cgpa, created_at)
            VALUES (1, 1, 'PL-TEST-1', 'Computer Science', 8.7, ?)
            """,
            (now,),
        )
        self.conn.execute(
            """
            INSERT INTO opportunities
            (id, code, title, description, term, destination, deadline, seats, status, created_at, updated_at)
            VALUES (1, 'GRAPH_TEST', 'Graph Test Opportunity', 'Test', 'Fall 2026', 'Singapore', '2026-12-31', 3, 'published', ?, ?)
            """,
            (now, now),
        )
        graph_cursor = self.conn.execute(
            """
            INSERT INTO graph_versions (opportunity_id, version, status, published_at, created_at)
            VALUES (1, 1, 'active', ?, ?)
            """,
            (now, now),
        )
        graph_version_id = int(graph_cursor.lastrowid)
        self.conn.execute(
            """
            INSERT INTO applications
            (id, student_profile_id, opportunity_id, current_step_order, current_stage_label, graph_version_id,
             final_status, submitted_data_json, submitted_at, created_at, updated_at)
            VALUES (1, 1, 1, 1, 'Submitted', ?, NULL, ?, ?, ?, ?)
            """,
            (graph_version_id, json.dumps(submitted_data), now, now, now),
        )
        return graph_version_id

    def _insert_node(
        self,
        key: str,
        node_type: str,
        reviewer_email: str | None = None,
        display_name: str | None = None,
        allowed_actions: list[str] | None = None,
        visible_sections: list[str] | None = None,
    ):
        self.conn.execute(
            """
            INSERT INTO graph_nodes
            (graph_version_id, node_key, node_type, display_name, reviewer_email, allowed_actions, visible_sections)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                self.graph_version_id,
                key,
                node_type,
                display_name or key.replace("_", " ").title(),
                reviewer_email,
                json.dumps(allowed_actions or ["approve", "reject", "request_changes", "comment"]),
                json.dumps(visible_sections or ["all"]),
            ),
        )

    def _insert_edge(self, from_key: str, to_key: str, condition: dict | None = None, action: str | None = None):
        self.conn.execute(
            """
            INSERT INTO graph_edges (graph_version_id, from_node_key, to_node_key, condition_json, action)
            VALUES (?, ?, ?, ?, ?)
            """,
            (self.graph_version_id, from_key, to_key, json.dumps(condition) if condition else None, action),
        )

    def _task(self, task_id: int) -> sqlite3.Row:
        row = self.conn.execute("SELECT * FROM application_workflow_tasks WHERE id = ?", (task_id,)).fetchone()
        self.assertIsNotNone(row)
        return row

    def _application(self) -> sqlite3.Row:
        row = self.conn.execute("SELECT * FROM applications WHERE id = 1").fetchone()
        self.assertIsNotNone(row)
        return row

    def _seed_linear_graph(self, reviewer_email: str = "oge@plaksha.edu.in"):
        self._insert_node("start", "start")
        self._insert_node("oge_review", "reviewer", reviewer_email, "OGE Review")
        self._insert_node("end", "end")
        self._insert_edge("start", "oge_review")
        self._insert_edge("oge_review", "end")

    def test_instantiate_creates_first_reviewer_task_and_inbox_row(self):
        self._seed_linear_graph()

        task_ids = self.service.instantiate(self.conn, 1, self.graph_version_id)

        self.assertEqual(len(task_ids), 1)
        task = self._task(task_ids[0])
        self.assertEqual(task["status"], "active")
        self.assertEqual(task["node_key"], "oge_review")
        inbox = self.service.get_inbox(self.conn, "oge@plaksha.edu.in")
        self.assertEqual(len(inbox), 1)
        self.assertEqual(inbox[0].opportunity_title, "Graph Test Opportunity")
        self.assertEqual(inbox[0].student_name, "Student One")
        self.assertIn("approve", inbox[0].allowed_actions)

    def test_approve_advances_to_next_reviewer_node(self):
        self._insert_node("start", "start")
        self._insert_node("oge_review", "reviewer", "oge@plaksha.edu.in", "OGE Review")
        self._insert_node("dean_review", "reviewer", "dean@plaksha.edu.in", "Dean Review")
        self._insert_node("end", "end")
        self._insert_edge("start", "oge_review")
        self._insert_edge("oge_review", "dean_review")
        self._insert_edge("dean_review", "end")
        task_id = self.service.instantiate(self.conn, 1, self.graph_version_id)[0]

        result = self.service.transition(self.conn, task_id, "approve", "oge@plaksha.edu.in", "Looks good")

        self.assertTrue(result.success)
        self.assertEqual(len(result.next_task_ids), 1)
        self.assertEqual(self._task(task_id)["status"], "completed")
        next_task = self._task(result.next_task_ids[0])
        self.assertEqual(next_task["node_key"], "dean_review")
        self.assertEqual(next_task["assigned_reviewer_email"], "dean@plaksha.edu.in")

    def test_join_all_waits_for_all_incoming_tasks_before_advancing(self):
        self._insert_node("start", "start")
        self._insert_node("academic_review", "reviewer", "academic@plaksha.edu.in")
        self._insert_node("student_life_review", "reviewer", "student-life@plaksha.edu.in")
        self._insert_node("all_reviews_join", "join_all")
        self._insert_node("dean_review", "reviewer", "dean@plaksha.edu.in")
        self._insert_node("end", "end")
        self._insert_edge("start", "academic_review")
        self._insert_edge("start", "student_life_review")
        self._insert_edge("academic_review", "all_reviews_join")
        self._insert_edge("student_life_review", "all_reviews_join")
        self._insert_edge("all_reviews_join", "dean_review")
        self._insert_edge("dean_review", "end")
        academic_task, student_life_task = self.service.instantiate(self.conn, 1, self.graph_version_id)

        first_result = self.service.transition(self.conn, academic_task, "approve", "academic@plaksha.edu.in")
        second_result = self.service.transition(self.conn, student_life_task, "approve", "student-life@plaksha.edu.in")

        self.assertEqual(first_result.next_task_ids, [])
        self.assertEqual(len(second_result.next_task_ids), 1)
        self.assertEqual(self._task(second_result.next_task_ids[0])["node_key"], "dean_review")

    def test_wrong_actor_is_rejected(self):
        self._seed_linear_graph()
        task_id = self.service.instantiate(self.conn, 1, self.graph_version_id)[0]

        with self.assertRaisesRegex(ValueError, "Actor is not assigned"):
            self.service.transition(self.conn, task_id, "approve", "someone-else@plaksha.edu.in")

    def test_stale_completed_task_is_rejected(self):
        self._seed_linear_graph()
        task_id = self.service.instantiate(self.conn, 1, self.graph_version_id)[0]
        self.service.transition(self.conn, task_id, "approve", "oge@plaksha.edu.in")

        with self.assertRaisesRegex(ValueError, "no longer active"):
            self.service.transition(self.conn, task_id, "approve", "oge@plaksha.edu.in")

    def test_final_approval_closes_application(self):
        self._seed_linear_graph()
        task_id = self.service.instantiate(self.conn, 1, self.graph_version_id)[0]

        result = self.service.transition(self.conn, task_id, "approve", "oge@plaksha.edu.in")

        self.assertTrue(result.success)
        self.assertEqual(result.application_status, "APPROVED")
        application = self._application()
        self.assertEqual(application["final_status"], "APPROVED")
        self.assertEqual(application["current_stage_label"], "Closed")

    def test_conditional_edge_routes_by_submitted_application_data(self):
        self._insert_node("start", "start")
        self._insert_node("funding_gate", "conditional")
        self._insert_node("scholarship_review", "reviewer", "scholarships@plaksha.edu.in")
        self._insert_node("end", "end")
        self._insert_edge("start", "funding_gate")
        self._insert_edge(
            "funding_gate",
            "scholarship_review",
            {"op": "equals", "field": "funding_requested", "value": True},
        )
        self._insert_edge("scholarship_review", "end")

        task_ids = self.service.instantiate(self.conn, 1, self.graph_version_id)

        self.assertEqual(len(task_ids), 1)
        self.assertEqual(self._task(task_ids[0])["assigned_reviewer_email"], "scholarships@plaksha.edu.in")

    def test_numeric_threshold_routes_to_vc_when_funding_exceeds_limit(self):
        self.conn.execute(
            "UPDATE applications SET submitted_data_json = ? WHERE id = 1",
            (json.dumps({"research_grant_amount": 250000}),),
        )
        self._insert_node("start", "start")
        self._insert_node("funding_gate", "conditional")
        self._insert_node("vc_review", "reviewer", "vc@plaksha.edu.in", "Vice Chancellor Review")
        self._insert_node("end", "end")
        self._insert_edge("start", "funding_gate")
        self._insert_edge(
            "funding_gate",
            "vc_review",
            {"op": "gt", "field": "research_grant_amount", "value": 200000},
            action="condition_true",
        )
        self._insert_edge("vc_review", "end", action="approve")

        task_ids = self.service.instantiate(self.conn, 1, self.graph_version_id)

        self.assertEqual(len(task_ids), 1)
        self.assertEqual(self._task(task_ids[0])["assigned_reviewer_email"], "vc@plaksha.edu.in")

    def test_conditional_false_edge_routes_to_standard_reviewer(self):
        self.conn.execute(
            "UPDATE applications SET submitted_data_json = ? WHERE id = 1",
            (json.dumps({"research_grant_amount": 50000}),),
        )
        self._insert_node("start", "start")
        self._insert_node("funding_gate", "conditional")
        self._insert_node("vc_review", "reviewer", "vc@plaksha.edu.in")
        self._insert_node("oge_review", "reviewer", "oge@plaksha.edu.in")
        self._insert_node("end", "end")
        condition = {"op": "gt", "field": "research_grant_amount", "value": 200000}
        self._insert_edge("start", "funding_gate")
        self._insert_edge("funding_gate", "vc_review", condition, action="condition_true")
        self._insert_edge("funding_gate", "oge_review", condition, action="condition_false")
        self._insert_edge("vc_review", "end", action="approve")
        self._insert_edge("oge_review", "end", action="approve")

        task_ids = self.service.instantiate(self.conn, 1, self.graph_version_id)

        self.assertEqual(len(task_ids), 1)
        self.assertEqual(self._task(task_ids[0])["assigned_reviewer_email"], "oge@plaksha.edu.in")

    def test_reject_edge_routes_to_configured_stakeholder(self):
        self._insert_node("start", "start")
        self._insert_node("oge_review", "reviewer", "oge@plaksha.edu.in", "OGE Review")
        self._insert_node("student_affairs", "reviewer", "student-affairs@plaksha.edu.in", "Student Affairs Follow-up")
        self._insert_node("end", "end")
        self._insert_edge("start", "oge_review")
        self._insert_edge("oge_review", "end", action="approve")
        self._insert_edge("oge_review", "student_affairs", action="reject")
        self._insert_edge("student_affairs", "end", action="approve")
        task_id = self.service.instantiate(self.conn, 1, self.graph_version_id)[0]

        result = self.service.transition(self.conn, task_id, "reject", "oge@plaksha.edu.in", "Not eligible.")

        self.assertTrue(result.success)
        self.assertEqual(len(result.next_task_ids), 1)
        self.assertEqual(self._task(result.next_task_ids[0])["assigned_reviewer_email"], "student-affairs@plaksha.edu.in")
        self.assertIsNone(self._application()["final_status"])

    def test_reject_without_route_closes_application_as_rejected(self):
        self._seed_linear_graph()
        task_id = self.service.instantiate(self.conn, 1, self.graph_version_id)[0]

        result = self.service.transition(self.conn, task_id, "reject", "oge@plaksha.edu.in", "Not eligible.")

        self.assertTrue(result.success)
        self.assertEqual(result.application_status, "REJECTED")
        self.assertEqual(self._application()["final_status"], "REJECTED")

    def test_reject_edge_to_rejected_end_closes_application_as_rejected(self):
        self._insert_node("start", "start")
        self._insert_node("oge_review", "reviewer", "oge@plaksha.edu.in", "OGE Review")
        self._insert_node("approved_end", "end")
        self._insert_node_with_metadata("rejected_end", "end", metadata={"final_status": "REJECTED"})
        self._insert_edge("start", "oge_review")
        self._insert_edge("oge_review", "approved_end", action="approve")
        self._insert_edge("oge_review", "rejected_end", action="reject")
        task_id = self.service.instantiate(self.conn, 1, self.graph_version_id)[0]

        result = self.service.transition(self.conn, task_id, "reject", "oge@plaksha.edu.in", "Not eligible.")

        self.assertTrue(result.success)
        self.assertEqual(result.application_status, "REJECTED")
        self.assertEqual(self._application()["final_status"], "REJECTED")

    def test_condition_routes_do_not_fire_on_reject_decision(self):
        self.conn.execute(
            "UPDATE applications SET submitted_data_json = ? WHERE id = 1",
            (json.dumps({"research_grant_amount": 250000}),),
        )
        self._insert_node("start", "start")
        self._insert_node("oge_review", "reviewer", "oge@plaksha.edu.in", "OGE Review")
        self._insert_node("vc_review", "reviewer", "vc@plaksha.edu.in", "Vice Chancellor Review")
        self._insert_node_with_metadata("rejected_end", "end", metadata={"final_status": "REJECTED"})
        self._insert_edge("start", "oge_review")
        self._insert_edge(
            "oge_review",
            "vc_review",
            {"op": "gt", "field": "research_grant_amount", "value": 200000},
            action="condition_true",
        )
        self._insert_edge("oge_review", "rejected_end", action="reject")
        task_id = self.service.instantiate(self.conn, 1, self.graph_version_id)[0]

        result = self.service.transition(self.conn, task_id, "reject", "oge@plaksha.edu.in", "Not eligible.")

        self.assertTrue(result.success)
        self.assertEqual(result.next_task_ids, [])
        self.assertEqual(self._application()["final_status"], "REJECTED")
        vc_tasks = self.conn.execute(
            "SELECT COUNT(*) AS cnt FROM application_workflow_tasks WHERE node_key = 'vc_review'"
        ).fetchone()
        self.assertEqual(int(vc_tasks["cnt"]), 0)

    def test_reject_is_blocked_when_node_does_not_allow_it(self):
        self._insert_node("start", "start")
        self._insert_node(
            "oge_review",
            "reviewer",
            "oge@plaksha.edu.in",
            "OGE Review",
            allowed_actions=["approve", "request_changes", "comment"],
        )
        self._insert_node("end", "end")
        self._insert_edge("start", "oge_review")
        self._insert_edge("oge_review", "end")
        task_id = self.service.instantiate(self.conn, 1, self.graph_version_id)[0]

        with self.assertRaisesRegex(ValueError, "not allowed"):
            self.service.transition(self.conn, task_id, "reject", "oge@plaksha.edu.in")

    def test_request_changes_returns_application_to_student_rework(self):
        self._seed_linear_graph()
        task_id = self.service.instantiate(self.conn, 1, self.graph_version_id)[0]

        result = self.service.transition(
            self.conn,
            task_id,
            "request_changes",
            "oge@plaksha.edu.in",
            "Please update your documents.",
        )

        self.assertTrue(result.success)
        self.assertEqual(result.application_status, "STUDENT_REWORK")
        task = self._task(task_id)
        self.assertEqual(task["status"], "returned")
        self.assertEqual(task["decision"], "request_changes")
        self.assertIsNone(task["return_to_task_id"])
        self.assertEqual(self._application()["current_stage_label"], "Student Rework")

    def test_resubmit_after_rework_reactivates_returned_task_and_clears_return_fields(self):
        self._seed_linear_graph()
        task_id = self.service.instantiate(self.conn, 1, self.graph_version_id)[0]
        self.service.transition(
            self.conn,
            task_id,
            "request_changes",
            "oge@plaksha.edu.in",
            "Please update your documents.",
        )

        resubmitted_task_id = self.service.resubmit_after_rework(self.conn, 1)

        self.assertEqual(resubmitted_task_id, task_id)
        task = self._task(task_id)
        self.assertEqual(task["status"], "active")
        self.assertIsNone(task["acted_at"])
        self.assertIsNone(task["decision"])
        self.assertIsNone(task["comment_summary"])
        application = self._application()
        self.assertEqual(application["current_stage_label"], "OGE Review")
        self.assertEqual(application["current_step_order"], 1)
        self.assertIsNone(application["return_to_step_order"])
        self.assertIsNone(application["return_to_stage_label"])

    def test_join_any_skips_sibling_and_advances_once(self):
        self._insert_node("start", "start")
        self._insert_node("reviewer_a", "reviewer", "a@plaksha.edu.in")
        self._insert_node("reviewer_b", "reviewer", "b@plaksha.edu.in")
        self._insert_node("join", "join_any")
        self._insert_node("final_reviewer", "reviewer", "final@plaksha.edu.in")
        self._insert_node("end", "end")
        self._insert_edge("start", "reviewer_a")
        self._insert_edge("start", "reviewer_b")
        self._insert_edge("reviewer_a", "join")
        self._insert_edge("reviewer_b", "join")
        self._insert_edge("join", "final_reviewer")
        self._insert_edge("final_reviewer", "end")
        task_a, task_b = self.service.instantiate(self.conn, 1, self.graph_version_id)

        result = self.service.transition(self.conn, task_a, "approve", "a@plaksha.edu.in")

        # join_any: reviewer_b sibling is skipped; exactly one downstream task created
        self.assertEqual(len(result.next_task_ids), 1)
        self.assertEqual(self._task(task_b)["status"], "skipped")
        final_task = self._task(result.next_task_ids[0])
        self.assertEqual(final_task["node_key"], "final_reviewer")

    def test_join_any_skipped_task_is_rejected_on_transition(self):
        self._insert_node("start", "start")
        self._insert_node("reviewer_a", "reviewer", "a@plaksha.edu.in")
        self._insert_node("reviewer_b", "reviewer", "b@plaksha.edu.in")
        self._insert_node("join", "join_any")
        self._insert_node("end", "end")
        self._insert_edge("start", "reviewer_a")
        self._insert_edge("start", "reviewer_b")
        self._insert_edge("reviewer_a", "join")
        self._insert_edge("reviewer_b", "join")
        self._insert_edge("join", "end")
        task_a, task_b = self.service.instantiate(self.conn, 1, self.graph_version_id)
        self.service.transition(self.conn, task_a, "approve", "a@plaksha.edu.in")

        with self.assertRaisesRegex(ValueError, "no longer active"):
            self.service.transition(self.conn, task_b, "approve", "b@plaksha.edu.in")

    def test_conditional_false_path_creates_no_task(self):
        # Application submitted WITHOUT funding_requested — scholarship branch should be skipped.
        # setUp seeds with funding_requested=True; override for this test with a fresh graph.
        self.conn.execute(
            "UPDATE applications SET submitted_data_json = ? WHERE id = 1",
            (json.dumps({"funding_requested": False}),),
        )
        self._insert_node("start", "start")
        self._insert_node("funding_gate", "conditional")
        self._insert_node("scholarship_review", "reviewer", "scholarships@plaksha.edu.in")
        self._insert_node("end", "end")
        self._insert_edge("start", "funding_gate")
        self._insert_edge(
            "funding_gate",
            "scholarship_review",
            {"op": "equals", "field": "funding_requested", "value": True},
        )
        self._insert_edge("scholarship_review", "end")

        task_ids = self.service.instantiate(self.conn, 1, self.graph_version_id)

        self.assertEqual(task_ids, [])

    def test_conditional_absent_field_creates_no_task(self):
        # Application submitted without the field at all — condition should evaluate to False.
        self.conn.execute(
            "UPDATE applications SET submitted_data_json = ? WHERE id = 1",
            (json.dumps({}),),
        )
        self._insert_node("start", "start")
        self._insert_node("gate", "conditional")
        self._insert_node("review", "reviewer", "oge@plaksha.edu.in")
        self._insert_node("end", "end")
        self._insert_edge("start", "gate")
        self._insert_edge(
            "gate", "review", {"op": "equals", "field": "missing_field", "value": True}
        )
        self._insert_edge("review", "end")

        task_ids = self.service.instantiate(self.conn, 1, self.graph_version_id)

        self.assertEqual(task_ids, [])

    # --- required inputs ---

    def _insert_node_with_metadata(
        self,
        key: str,
        node_type: str,
        reviewer_email: str | None = None,
        metadata: dict | None = None,
    ):
        self.conn.execute(
            """
            INSERT INTO graph_nodes
            (graph_version_id, node_key, node_type, display_name, reviewer_email,
             allowed_actions, visible_sections, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                self.graph_version_id,
                key,
                node_type,
                key.replace("_", " ").title(),
                reviewer_email,
                json.dumps(["approve", "reject", "request_changes", "comment"]),
                json.dumps(["all"]),
                json.dumps(metadata or {}),
            ),
        )

    def test_approve_with_no_required_inputs_succeeds(self):
        self._insert_node_with_metadata("start", "start")
        self._insert_node_with_metadata("oge", "reviewer", "oge@plaksha.edu.in", metadata={})
        self._insert_node_with_metadata("end", "end")
        self._insert_edge("start", "oge")
        self._insert_edge("oge", "end")

        (task_id,) = self.service.instantiate(self.conn, 1, self.graph_version_id)
        result = self.service.transition(self.conn, task_id, "approve", "oge@plaksha.edu.in")

        self.assertTrue(result.success)

    def test_approve_with_all_required_inputs_provided_succeeds(self):
        metadata = {
            "required_inputs": [
                {"input_key": "gpa_check", "label": "GPA confirmed", "input_type": "checkbox", "required": True}
            ]
        }
        self._insert_node_with_metadata("start", "start")
        self._insert_node_with_metadata("oge", "reviewer", "oge@plaksha.edu.in", metadata=metadata)
        self._insert_node_with_metadata("end", "end")
        self._insert_edge("start", "oge")
        self._insert_edge("oge", "end")

        (task_id,) = self.service.instantiate(self.conn, 1, self.graph_version_id)
        result = self.service.transition(
            self.conn, task_id, "approve", "oge@plaksha.edu.in",
            reviewer_data={"gpa_check": True},
        )

        self.assertTrue(result.success)
        task = self._task(task_id)
        stored = json.loads(task["reviewer_data_json"])
        self.assertEqual(stored["gpa_check"], True)

    def test_approve_missing_required_input_raises(self):
        metadata = {
            "required_inputs": [
                {"input_key": "gpa_check", "label": "GPA confirmed", "input_type": "checkbox", "required": True},
                {"input_key": "remarks", "label": "Remarks", "input_type": "text", "required": False},
            ]
        }
        self._insert_node_with_metadata("start", "start")
        self._insert_node_with_metadata("oge", "reviewer", "oge@plaksha.edu.in", metadata=metadata)
        self._insert_node_with_metadata("end", "end")
        self._insert_edge("start", "oge")
        self._insert_edge("oge", "end")

        (task_id,) = self.service.instantiate(self.conn, 1, self.graph_version_id)
        with self.assertRaisesRegex(ValueError, "gpa_check"):
            self.service.transition(
                self.conn, task_id, "approve", "oge@plaksha.edu.in",
                reviewer_data={"remarks": "Looks good"},
            )

    def test_approve_missing_optional_input_succeeds(self):
        metadata = {
            "required_inputs": [
                {"input_key": "remarks", "label": "Remarks", "input_type": "text", "required": False}
            ]
        }
        self._insert_node_with_metadata("start", "start")
        self._insert_node_with_metadata("oge", "reviewer", "oge@plaksha.edu.in", metadata=metadata)
        self._insert_node_with_metadata("end", "end")
        self._insert_edge("start", "oge")
        self._insert_edge("oge", "end")

        (task_id,) = self.service.instantiate(self.conn, 1, self.graph_version_id)
        result = self.service.transition(self.conn, task_id, "approve", "oge@plaksha.edu.in")

        self.assertTrue(result.success)

    def test_request_changes_stores_reviewer_data(self):
        self._seed_linear_graph()
        (task_id,) = self.service.instantiate(self.conn, 1, self.graph_version_id)
        result = self.service.transition(
            self.conn, task_id, "request_changes", "oge@plaksha.edu.in",
            reviewer_data={"feedback": "Needs more documents"},
        )

        self.assertTrue(result.success)
        task = self._task(task_id)
        stored = json.loads(task["reviewer_data_json"])
        self.assertEqual(stored["feedback"], "Needs more documents")


if __name__ == "__main__":
    unittest.main()
