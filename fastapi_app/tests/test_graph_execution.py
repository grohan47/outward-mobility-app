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
                json.dumps(allowed_actions or ["approve", "request_changes", "comment"]),
                json.dumps(visible_sections or ["all"]),
            ),
        )

    def _insert_edge(self, from_key: str, to_key: str, condition: dict | None = None):
        self.conn.execute(
            """
            INSERT INTO graph_edges (graph_version_id, from_node_key, to_node_key, condition_json)
            VALUES (?, ?, ?, ?)
            """,
            (self.graph_version_id, from_key, to_key, json.dumps(condition) if condition else None),
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
        self.assertEqual(task["return_to_task_id"], task_id)
        self.assertEqual(self._application()["current_stage_label"], "Student Rework")


if __name__ == "__main__":
    unittest.main()
