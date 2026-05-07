import json
import sqlite3
import unittest

from fastapi_app.ai_workflow import AIWorkflowDraftService
from fastapi_app.main import reset_schema


class _MockProvider:
    """Injects a fixed response or raises a fixed exception."""

    def __init__(self, response):
        self._response = response
        self._responses = list(response) if isinstance(response, list) else None
        self.calls = []

    def complete(self, system: str, user: str, timeout: int) -> str:
        self.calls.append({"system": system, "user": user, "timeout": timeout})
        response = self._responses.pop(0) if self._responses is not None else self._response
        if isinstance(response, Exception):
            raise response
        return response


def _valid_json(
    title="Singapore AI Exchange",
    clarifying_questions=None,
    reviewer_email="oge@plaksha.edu.in",
    confidence=0.85,
    extra_warnings=None,
) -> str:
    return json.dumps(
        {
            "opportunity": {
                "title": title,
                "description": "4-week research program at NTU.",
                "host_institution": "NTU",
                "program_type": "Research",
                "eligibility_criteria": "CGPA >= 7.5",
                "funding_available": True,
                "visibility": "plaksha_only",
            },
            "graph": {
                "nodes": [
                    {
                        "node_key": "start",
                        "node_type": "start",
                        "display_name": "Start",
                        "reviewer_email": None,
                        "visible_sections": ["all"],
                        "allowed_actions": [],
                    },
                    {
                        "node_key": "oge_review",
                        "node_type": "reviewer",
                        "display_name": "OGE Review",
                        "reviewer_email": reviewer_email,
                        "visible_sections": ["all"],
                        "allowed_actions": ["approve", "request_changes", "comment"],
                    },
                    {
                        "node_key": "end",
                        "node_type": "end",
                        "display_name": "End",
                        "reviewer_email": None,
                        "visible_sections": [],
                        "allowed_actions": [],
                    },
                ],
                "edges": [
                    {"from_node_key": "start", "to_node_key": "oge_review", "condition_json": None, "label": None},
                    {"from_node_key": "oge_review", "to_node_key": "end", "condition_json": None, "label": None},
                ],
            },
            "clarifying_questions": clarifying_questions or [],
            "confidence": confidence,
            "warnings": extra_warnings or [],
            "is_fallback": False,
        }
    )


class AIWorkflowDraftServiceTests(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        reset_schema(self.conn)

    def tearDown(self):
        self.conn.close()

    # --- generate_draft ---

    def test_valid_model_output_parses_and_persists(self):
        service = AIWorkflowDraftService(provider=_MockProvider(_valid_json()))
        prompt = "Exchange in Singapore"
        result = service.generate_draft(self.conn, "admin@plaksha.edu.in", prompt)

        self.assertIn("id", result)
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["publish_ready"], 1)
        self.assertEqual(result["created_by_email"], "admin@plaksha.edu.in")
        self.assertEqual(result["original_prompt"], prompt)

        stored = json.loads(result["draft_output"])
        self.assertEqual(stored["opportunity"]["title"], "Singapore AI Exchange")
        self.assertFalse(stored["is_fallback"])

    def test_malformed_json_triggers_fallback(self):
        service = AIWorkflowDraftService(provider=_MockProvider("not json {{{"))
        result = service.generate_draft(self.conn, "admin@plaksha.edu.in", "some prompt")

        stored = json.loads(result["draft_output"])
        self.assertTrue(stored["is_fallback"])
        self.assertEqual(stored["confidence"], 0.0)
        self.assertEqual(result["publish_ready"], 0)

    def test_provider_exception_triggers_fallback(self):
        service = AIWorkflowDraftService(provider=_MockProvider(RuntimeError("provider timeout")))
        result = service.generate_draft(self.conn, "admin@plaksha.edu.in", "some prompt")

        stored = json.loads(result["draft_output"])
        self.assertTrue(stored["is_fallback"])
        self.assertEqual(result["publish_ready"], 0)

    def test_graph_validation_errors_appended_to_warnings_and_block_publish(self):
        # reviewer node missing reviewer_email — GraphPolicyValidator should catch this
        invalid_graph_json = json.dumps(
            {
                "opportunity": {
                    "title": "Test",
                    "description": "Test opp",
                    "funding_available": False,
                    "visibility": "plaksha_only",
                },
                "graph": {
                    "nodes": [
                        {
                            "node_key": "start",
                            "node_type": "start",
                            "display_name": None,
                            "reviewer_email": None,
                            "visible_sections": ["all"],
                            "allowed_actions": [],
                        },
                        {
                            "node_key": "bad_reviewer",
                            "node_type": "reviewer",
                            "display_name": "Review",
                            "reviewer_email": None,  # missing — should fail validation
                            "visible_sections": ["all"],
                            "allowed_actions": ["approve"],
                        },
                        {
                            "node_key": "end",
                            "node_type": "end",
                            "display_name": None,
                            "reviewer_email": None,
                            "visible_sections": [],
                            "allowed_actions": [],
                        },
                    ],
                    "edges": [
                        {"from_node_key": "start", "to_node_key": "bad_reviewer", "condition_json": None, "label": None},
                        {"from_node_key": "bad_reviewer", "to_node_key": "end", "condition_json": None, "label": None},
                    ],
                },
                "clarifying_questions": [],
                "confidence": 0.5,
                "warnings": [],
                "is_fallback": False,
            }
        )
        service = AIWorkflowDraftService(provider=_MockProvider(invalid_graph_json))
        result = service.generate_draft(self.conn, "admin@plaksha.edu.in", "some prompt")

        warnings = json.loads(result["warnings"])
        self.assertTrue(any("bad_reviewer" in w or "reviewer_email" in w for w in warnings))
        self.assertEqual(result["publish_ready"], 0)
        self.assertEqual(result["status"], "pending")

    def test_clarifying_questions_block_publish_ready(self):
        json_str = _valid_json(clarifying_questions=["Who is the final approver?"])
        service = AIWorkflowDraftService(provider=_MockProvider(json_str))
        result = service.generate_draft(self.conn, "admin@plaksha.edu.in", "prompt")

        self.assertEqual(result["publish_ready"], 0)
        self.assertEqual(result["status"], "pending")
        questions = json.loads(result["clarifying_questions"])
        self.assertIn("Who is the final approver?", questions)

    def test_draft_row_written_to_workflow_drafts_table(self):
        service = AIWorkflowDraftService(provider=_MockProvider(_valid_json()))
        prompt = "prompt"
        result = service.generate_draft(self.conn, "oge@plaksha.edu.in", prompt)

        row = self.conn.execute(
            "SELECT * FROM workflow_drafts WHERE id = ?", (result["id"],)
        ).fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row["created_by_email"], "oge@plaksha.edu.in")
        self.assertEqual(row["original_prompt"], prompt)

    # --- answer_clarification ---

    def test_answer_clarification_sets_publish_ready(self):
        json_str = _valid_json(clarifying_questions=["Who is the final approver?"])
        service = AIWorkflowDraftService(provider=_MockProvider(json_str))
        draft = service.generate_draft(self.conn, "admin@plaksha.edu.in", "prompt")
        self.assertEqual(draft["publish_ready"], 0)

        updated = service.answer_clarification(
            self.conn, draft["id"], {"Who is the final approver?": "Dean of Academic Affairs"}
        )

        self.assertEqual(updated["publish_ready"], 1)
        self.assertEqual(updated["status"], "ready")
        answers = json.loads(updated["admin_answers"])
        self.assertEqual(answers["Who is the final approver?"], "Dean of Academic Affairs")

    def test_answer_clarification_partial_answers_remain_pending(self):
        json_str = _valid_json(clarifying_questions=["Q1?", "Q2?"])
        service = AIWorkflowDraftService(provider=_MockProvider(json_str))
        draft = service.generate_draft(self.conn, "admin@plaksha.edu.in", "prompt")

        updated = service.answer_clarification(self.conn, draft["id"], {"Q1?": "answer 1"})

        self.assertEqual(updated["publish_ready"], 0)

    def test_answer_clarification_all_questions_answered_sets_ready(self):
        json_str = _valid_json(clarifying_questions=["Q1?", "Q2?"])
        service = AIWorkflowDraftService(provider=_MockProvider(json_str))
        draft = service.generate_draft(self.conn, "admin@plaksha.edu.in", "prompt")
        service.answer_clarification(self.conn, draft["id"], {"Q1?": "a1"})

        updated = service.answer_clarification(self.conn, draft["id"], {"Q2?": "a2"})

        self.assertEqual(updated["publish_ready"], 1)

    def test_answer_clarification_invalid_draft_id_raises(self):
        service = AIWorkflowDraftService()
        with self.assertRaises(ValueError):
            service.answer_clarification(self.conn, 9999, {"Q?": "A"})

    # --- regenerate_with_answers ---

    def test_regenerate_with_answers_reuses_original_prompt_and_updates_row(self):
        provider = _MockProvider(
            [
                _valid_json(title="Draft Needing Answers", clarifying_questions=["Who approves?"]),
                _valid_json(title="Regenerated Ready Draft"),
            ]
        )
        service = AIWorkflowDraftService(provider=provider)
        draft = service.generate_draft(
            self.conn,
            "admin@plaksha.edu.in",
            "Original messy opportunity prompt",
        )

        updated = service.regenerate_with_answers(
            self.conn,
            draft["id"],
            {"Who approves?": "Dean of Academic Affairs"},
        )

        self.assertEqual(updated["id"], draft["id"])
        self.assertEqual(updated["original_prompt"], "Original messy opportunity prompt")
        self.assertEqual(updated["publish_ready"], 1)
        self.assertEqual(updated["status"], "ready")
        answers = json.loads(updated["admin_answers"])
        self.assertEqual(answers["Who approves?"], "Dean of Academic Affairs")
        stored = json.loads(updated["draft_output"])
        self.assertEqual(stored["opportunity"]["title"], "Regenerated Ready Draft")
        self.assertEqual(len(provider.calls), 2)
        self.assertIn("Original messy opportunity prompt", provider.calls[1]["user"])
        self.assertIn("ADMIN CLARIFICATION ANSWERS", provider.calls[1]["user"])
        self.assertIn("Dean of Academic Affairs", provider.calls[1]["user"])

    def test_regenerate_with_answers_invalid_draft_id_raises(self):
        service = AIWorkflowDraftService(provider=_MockProvider(_valid_json()))
        with self.assertRaises(ValueError):
            service.regenerate_with_answers(self.conn, 9999, {"Q?": "A"})

    def test_regenerate_with_answers_records_answers_when_provider_fails(self):
        provider = _MockProvider(
            [
                _valid_json(title="Draft Needing Answers", clarifying_questions=["Who approves?"]),
                RuntimeError("provider unavailable"),
            ]
        )
        service = AIWorkflowDraftService(provider=provider)
        draft = service.generate_draft(
            self.conn,
            "admin@plaksha.edu.in",
            "Original messy opportunity prompt",
        )
        original_output = draft["draft_output"]

        updated = service.regenerate_with_answers(
            self.conn,
            draft["id"],
            {"Who approves?": "Dean of Academic Affairs"},
        )

        self.assertEqual(updated["draft_output"], original_output)
        self.assertEqual(updated["publish_ready"], 1)
        answers = json.loads(updated["admin_answers"])
        self.assertEqual(answers["Who approves?"], "Dean of Academic Affairs")

    def test_regenerate_with_answers_requires_original_prompt(self):
        service = AIWorkflowDraftService(provider=_MockProvider(_valid_json()))
        draft = service.generate_draft(self.conn, "admin@plaksha.edu.in", "prompt")
        self.conn.execute("UPDATE workflow_drafts SET original_prompt = NULL WHERE id = ?", (draft["id"],))

        with self.assertRaisesRegex(ValueError, "original prompt"):
            service.regenerate_with_answers(self.conn, draft["id"], {"Q?": "A"})

    # --- _fallback_draft ---

    def test_fallback_draft_is_valid_and_flagged(self):
        service = AIWorkflowDraftService()
        fallback = service._fallback_draft()

        self.assertTrue(fallback.is_fallback)
        self.assertEqual(fallback.confidence, 0.0)
        self.assertTrue(len(fallback.warnings) > 0)

    def test_fallback_draft_graph_is_structurally_valid(self):
        from fastapi_app.graph_validation import GraphPolicyValidator

        service = AIWorkflowDraftService()
        fallback = service._fallback_draft()
        errors = GraphPolicyValidator().validate_graph(fallback.graph)

        self.assertEqual(errors, [], f"Fallback graph has validation errors: {errors}")

    def test_fallback_draft_not_marked_publish_ready(self):
        service = AIWorkflowDraftService(provider=_MockProvider(RuntimeError("down")))
        result = service.generate_draft(self.conn, "admin@plaksha.edu.in", "prompt")

        self.assertEqual(result["publish_ready"], 0)


if __name__ == "__main__":
    unittest.main()
