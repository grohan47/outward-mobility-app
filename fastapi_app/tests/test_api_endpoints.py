import json
import unittest
from datetime import datetime, timezone

from fastapi import HTTPException, Response

from fastapi_app.main import (
    ADMIN_ROLE,
    ApplicationCreateBody,
    CANONICAL_TABLES,
    ClarificationAnswerBody,
    CommentCreateBody,
    CustomFormFieldPayload,
    DecisionBody,
    LoginBody,
    OpportunityCreatePayload,
    OpportunityAIGenerateBody,
    OpportunityPatchBody,
    SessionUser,
    StudentResponseBody,
    TaskDecideBody,
    WorkflowRequiredInput,
    WorkflowStepPayload,
    admin_applications,
    admin_answer_workflow_draft_clarification,
    admin_create_opportunity,
    admin_generate_opportunity_with_ai,
    admin_delete_opportunity,
    admin_get_opportunity,
    admin_get_opportunity_graph,
    admin_get_workflow_draft,
    admin_list_opportunities,
    admin_patch_application,
    admin_patch_opportunity,
    admin_publish_workflow_draft,
    admin_summary,
    admin_visibility_audit,
    admin_visibility_audit_single,
    app,
    application_detail,
    application_ai_approval_assist,
    application_ai_thread_summary,
    approve_application,
    auth_demo_users,
    auth_login,
    auth_logout,
    auth_me,
    create_application,
    db_conn,
    delete_application,
    ensure_db_initialized,
    form_fields,
    get_comments,
    get_user_role,
    health,
    list_tables,
    table_columns,
    list_applications,
    list_opportunities,
    my_applications,
    opportunity_detail,
    opportunity_ai_nomination_insights,
    post_comment,
    reject_application,
    request_changes,
    reviewer_decide_task,
    reviewer_inbox,
    submit_student_response,
    users_me,
    AdminApplicationPatchBody,
)
from fastapi_app.graph_execution import GraphExecutionService
from fastapi_app.graph_publishing import GraphPublishingService
from fastapi_app.graph_models import AIWorkflowDraftOutput, GraphModel, GraphNodeModel, GraphEdgeModel


class ApiEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        ensure_db_initialized()

    def session_for(self, email: str) -> SessionUser:
        with db_conn() as conn:
            row = get_user_role(conn, email.strip().lower())
        self.assertIsNotNone(row, f"Missing test user for {email}")
        return SessionUser(
            email=row["email"],
            name=row["full_name"],
            role=row["role_code"],
            roleDisplayName=row["role_display_name"],
            userId=int(row["id"]),
        )

    def create_test_opportunity(self, code_prefix: str = "TEST") -> int:
        ts = datetime.now(timezone.utc).strftime("%H%M%S%f")
        payload = OpportunityCreatePayload(
            opportunity={
                "code": f"{code_prefix}_{ts}",
                "title": f"{code_prefix} Opportunity",
                "description": "Automated endpoint test opportunity",
                "cover_image_url": "",
                "term": "Fall 2026",
                "destination": "Test Destination",
                "deadline": "2026-12-31",
                "seats": 5,
            },
            formFields=["full_name", "student_id", "email", "cgpa", "custom_org_unit"],
            customFields=[
                CustomFormFieldPayload(
                    key="custom_org_unit",
                    label="Organization Unit",
                    description="Department or unit information.",
                )
            ],
            workflowSteps=[
                WorkflowStepPayload(
                    name="OGE Intake Review",
                    reviewerEmail="oge@plaksha.edu.in",
                    reviewerName="OGE Admin",
                    visibleFields=["full_name", "student_id", "email", "cgpa", "custom_org_unit"],
                    requiredInputs=[],
                    slaHours=24,
                    canViewComments=True,
                ),
                WorkflowStepPayload(
                    name="VC Review",
                    reviewerEmail="vc@plaksha.edu.in",
                    reviewerName="Vice Chancellor",
                    visibleFields=["full_name", "student_id", "email", "cgpa"],
                    requiredInputs=[
                        WorkflowRequiredInput(
                            id="vc_decision_reason",
                            label="VC Decision Reason",
                            inputType="dropdown",
                            required=True,
                            options=["Academic fit", "Capacity constraints", "Policy mismatch"],
                        ),
                        WorkflowRequiredInput(
                            id="vc_tags",
                            label="VC Tags",
                            inputType="multiselect",
                            required=False,
                            options=["High priority", "Merit", "Scholarship"],
                        ),
                    ],
                    slaHours=48,
                    canViewComments=False,
                ),
            ],
            useDefaultTemplate=False,
            generatorVisibilityRules=[
                {"ruleType": "EMAIL", "ruleValue": "rohan@plaksha.edu.in"},
            ],
        )

        result = admin_create_opportunity(payload, session=self.session_for("oge@plaksha.edu.in"))
        return int(result["id"])

    def create_test_application(self, opportunity_id: int, email: str = "rohan@plaksha.edu.in") -> int:
        body = ApplicationCreateBody(
            opportunityId=opportunity_id,
            submittedData={
                "full_name": "Rohan",
                "student_id": "PL-2022-ROH",
                "email": email,
                "cgpa": "8.1",
                "custom_org_unit": "Robotics Club",
            },
        )
        result = create_application(body, session=self.session_for(email))
        return int(result["application"]["id"])

    def safe_delete_opportunity(self, opportunity_id: int):
        try:
            admin_delete_opportunity(opportunity_id, session=self.session_for("oge@plaksha.edu.in"))
        except HTTPException as exc:
            if exc.status_code != 404:
                raise

    def test_openapi_and_route_inventory(self):
        self.assertEqual(app.docs_url, "/swagger")
        self.assertEqual(app.openapi_url, "/openapi.json")

        expected_routes = {
            ("GET", "/api/health"),
            ("POST", "/api/auth/login"),
            ("POST", "/api/auth/logout"),
            ("GET", "/api/auth/me"),
            ("GET", "/api/users/me"),
            ("GET", "/api/auth/demo-users"),
            ("GET", "/api/form-fields"),
            ("GET", "/api/opportunities"),
            ("GET", "/api/opportunities/{opportunity_id}"),
            ("GET", "/api/opportunities/{opportunity_id}/ai-cta"),
            ("GET", "/api/opportunities/{opportunity_id}/ai-nomination-insights"),
            ("GET", "/api/admin/opportunities"),
            ("GET", "/api/admin/opportunities/{opportunity_id}"),
            ("GET", "/api/admin/visibility-audit"),
            ("GET", "/api/admin/opportunities/{opportunity_id}/visibility-audit"),
            ("POST", "/api/admin/opportunities/ai-generate"),
            ("POST", "/api/admin/opportunities"),
            ("PATCH", "/api/admin/opportunities/{opportunity_id}"),
            ("DELETE", "/api/admin/opportunities/{opportunity_id}"),
            ("POST", "/api/applications"),
            ("DELETE", "/api/applications/{application_id}"),
            ("GET", "/api/applications"),
            ("GET", "/api/applications/{application_id}"),
            ("GET", "/api/applications/{application_id}/ai-thread-summary"),
            ("GET", "/api/applications/{application_id}/ai-approval-assist"),
            ("POST", "/api/applications/{application_id}/approve"),
            ("POST", "/api/applications/{application_id}/request-changes"),
            ("POST", "/api/applications/{application_id}/student-response"),
            ("POST", "/api/applications/{application_id}/reject"),
            ("GET", "/api/applications/{application_id}/comments"),
            ("POST", "/api/applications/{application_id}/comments"),
            ("GET", "/api/my/applications"),
            ("GET", "/api/reviewer/inbox"),
            ("POST", "/api/reviewer/tasks/{task_id}/decide"),
            ("GET", "/api/admin/workflow-drafts/{draft_id}"),
            ("POST", "/api/admin/workflow-drafts/{draft_id}/answer"),
            ("POST", "/api/admin/workflow-drafts/{draft_id}/publish"),
            ("GET", "/api/admin/opportunities/{opportunity_id}/graph"),
            ("GET", "/api/admin/dashboard/summary"),
            ("GET", "/api/admin/applications"),
            ("PATCH", "/api/admin/applications/{application_id}"),
        }

        actual_routes = set()
        for route in app.routes:
            if not getattr(route, "path", "").startswith("/api"):
                continue
            for method in getattr(route, "methods", set()):
                if method in {"GET", "POST", "PATCH", "DELETE"}:
                    actual_routes.add((method, route.path))

        self.assertTrue(expected_routes.issubset(actual_routes))

        openapi_paths = app.openapi().get("paths", {})
        for _, path in expected_routes:
            self.assertIn(path, openapi_paths)

    def test_auth_and_identity_endpoints(self):
        self.assertTrue(health().get("ok"))

        response = Response()
        login = auth_login(LoginBody(email="oge@plaksha.edu.in"), response)
        self.assertIn(login["user"]["role"], {"ADMIN", "REVIEWER"})
        cookie_header = response.headers.get("set-cookie", "")
        self.assertIn("prism_session=", cookie_header)

        me = auth_me(session=self.session_for("oge@plaksha.edu.in"))
        self.assertEqual(me["user"]["email"], "oge@plaksha.edu.in")

        me_alias = users_me(session=self.session_for("oge@plaksha.edu.in"))
        self.assertEqual(me_alias["user"]["role"], ADMIN_ROLE)

        demo = auth_demo_users()
        self.assertGreaterEqual(len(demo.get("items", [])), 1)

        with self.assertRaises(HTTPException) as missing_user:
            auth_login(LoginBody(email="not-a-user@plaksha.edu.in"), Response())
        self.assertEqual(missing_user.exception.status_code, 404)

        logout_response = Response()
        logout = auth_logout(logout_response)
        self.assertTrue(logout.get("ok"))
        self.assertIn("prism_session=", logout_response.headers.get("set-cookie", ""))

    def test_graph_schema_foundation_is_available(self):
        expected_graph_tables = {
            "workflow_drafts",
            "graph_versions",
            "graph_nodes",
            "graph_edges",
            "application_workflow_tasks",
        }

        health_payload = health()
        self.assertTrue(health_payload.get("ok"))
        self.assertTrue(expected_graph_tables.issubset(set(health_payload.get("_tables", []))))

        with db_conn() as conn:
            self.assertEqual(list_tables(conn), CANONICAL_TABLES)
            self.assertTrue(expected_graph_tables.issubset(list_tables(conn)))
            self.assertIn("graph_version_id", table_columns(conn, "applications"))

    def test_opportunity_admin_and_generator_endpoints(self):
        opportunity_id = self.create_test_opportunity("CRUD")
        admin_session = self.session_for("oge@plaksha.edu.in")
        student_session = self.session_for("rohan@plaksha.edu.in")

        try:
            fields = form_fields(session=admin_session)
            self.assertIn("items", fields)
            self.assertIn("defaultPipelineTemplate", fields)

            admin_list = admin_list_opportunities(session=admin_session)
            self.assertIn(opportunity_id, [row["id"] for row in admin_list.get("items", [])])

            detail = admin_get_opportunity(opportunity_id, session=admin_session)
            self.assertTrue(any(f["field_key"] == "custom_org_unit" for f in detail.get("custom_fields", [])))

            patch = admin_patch_opportunity(
                opportunity_id,
                OpportunityPatchBody(
                    title="CRUD Opportunity Updated",
                    formFields=["full_name", "student_id", "email", "cgpa", "custom_org_unit"],
                    customFields=[
                        CustomFormFieldPayload(
                            key="custom_org_unit",
                            label="Organization Unit",
                            description="Updated custom description.",
                        )
                    ],
                ),
                session=admin_session,
            )
            self.assertEqual(patch["opportunity"]["title"], "CRUD Opportunity Updated")

            vis_all = admin_visibility_audit(session=admin_session)
            self.assertGreaterEqual(vis_all.get("count", 0), 1)

            vis_one = admin_visibility_audit_single(opportunity_id, session=admin_session)
            self.assertIn("item", vis_one)

            generator_list = list_opportunities(session=student_session)
            self.assertIn(opportunity_id, [row["id"] for row in generator_list.get("items", [])])

            generator_detail = opportunity_detail(opportunity_id, session=student_session)
            keys = [row["field_key"] for row in generator_detail.get("required_fields", [])]
            self.assertIn("custom_org_unit", keys)

            nomination_ai = opportunity_ai_nomination_insights(opportunity_id, session=student_session)
            self.assertIn("nominations_assist", nomination_ai)
            self.assertTrue(nomination_ai.get("is_dummy_ai"))
        finally:
            delete_result = admin_delete_opportunity(opportunity_id, session=admin_session)
            self.assertTrue(delete_result.get("ok"))

        with self.assertRaises(HTTPException) as deleted_lookup:
            admin_get_opportunity(opportunity_id, session=admin_session)
        self.assertEqual(deleted_lookup.exception.status_code, 404)

    def test_admin_ai_opportunity_generation(self):
        # Without a real AI provider, the service returns a deterministic fallback draft.
        admin_session = self.session_for("oge@plaksha.edu.in")
        payload = OpportunityAIGenerateBody(
            prompt="Create an AI and Robotics summer opportunity in Singapore with interview round and scholarship support."
        )
        response = admin_generate_opportunity_with_ai(payload, session=admin_session)

        self.assertIn("draft_id", response)
        self.assertIn("draft", response)
        draft = response["draft"]
        self.assertIn("id", draft)
        self.assertIn("draft_output", draft)
        self.assertIn("publish_ready", draft)
        # Fallback draft is never publish_ready (is_fallback=True).
        self.assertEqual(draft["publish_ready"], 0)

    def test_application_lifecycle_and_access_controls(self):
        opportunity_id = self.create_test_opportunity("APP")
        admin_session = self.session_for("oge@plaksha.edu.in")
        student_session = self.session_for("rohan@plaksha.edu.in")

        try:
            application_id = self.create_test_application(opportunity_id)

            student_apps = my_applications(session=student_session)
            self.assertIn(application_id, [row["id"] for row in student_apps.get("items", [])])

            list_apps = list_applications(session=student_session)
            self.assertIn(application_id, [row["id"] for row in list_apps.get("items", [])])

            student_detail = application_detail(application_id, session=student_session)
            self.assertEqual(student_detail["application"]["id"], application_id)

            thread_summary = application_ai_thread_summary(application_id, session=student_session)
            self.assertIn("summary", thread_summary)
            self.assertTrue(thread_summary.get("is_dummy_ai"))

            approval_assist = application_ai_approval_assist(application_id, session=admin_session)
            self.assertIn("recommendation", approval_assist)
            self.assertTrue(approval_assist.get("is_dummy_ai"))

            comment = post_comment(
                application_id,
                CommentCreateBody(text="Student note", visibility="internal"),
                session=student_session,
            )
            self.assertIsNotNone(comment.get("comment"))

            comments = get_comments(application_id, session=student_session)
            self.assertGreaterEqual(len(comments.get("comments", [])), 1)

            admin_ledger = admin_applications(session=admin_session)
            self.assertIn(application_id, [row["id"] for row in admin_ledger.get("items", [])])

            summary = admin_summary(session=admin_session)
            self.assertIn("total", summary)
            self.assertIn("activeOpportunities", summary)

            patched = admin_patch_application(
                application_id,
                AdminApplicationPatchBody(
                    submittedData={
                        "full_name": "Rohan",
                        "student_id": "PL-2022-ROH",
                        "email": "rohan@plaksha.edu.in",
                        "cgpa": "8.3",
                        "custom_org_unit": "Testing Unit",
                    }
                ),
                session=admin_session,
            )
            self.assertEqual(patched["application"]["id"], application_id)

            inbox = reviewer_inbox(session=admin_session)
            self.assertIn(application_id, [row["id"] for row in inbox.get("items", [])])

            send_back = request_changes(
                application_id,
                DecisionBody(remarks="Please clarify", targetStepOrder=0),
                session=admin_session,
            )
            self.assertEqual(send_back["application"]["current_step_order"], 0)

            student_response = submit_student_response(
                application_id,
                StudentResponseBody(text="Added requested clarification."),
                session=student_session,
            )
            self.assertEqual(student_response["application"]["current_step_order"], 1)

            first_approve = approve_application(
                application_id,
                DecisionBody(remarks="Proceed to VC"),
                session=admin_session,
            )
            self.assertEqual(first_approve["application"]["current_step_order"], 2)

            vc_session = self.session_for("vc@plaksha.edu.in")
            vc_inbox = reviewer_inbox(session=vc_session)
            self.assertIn(application_id, [row["id"] for row in vc_inbox.get("items", [])])

            vc_detail = application_detail(application_id, session=vc_session)
            self.assertFalse(vc_detail["permissions"]["can_view_comments"])
            self.assertNotIn("custom_org_unit", vc_detail.get("application_file", {}))
            self.assertEqual(vc_detail.get("comments", []), [])
            self.assertEqual(vc_detail.get("reviews", []), [])

            vc_comments = get_comments(application_id, session=vc_session)
            self.assertGreaterEqual(len(vc_comments.get("comments", [])), 1)

            with self.assertRaises(HTTPException) as missing_required_input:
                approve_application(application_id, DecisionBody(remarks="Missing required fields"), session=vc_session)
            self.assertEqual(missing_required_input.exception.status_code, 400)

            final_approve = approve_application(
                application_id,
                DecisionBody(
                    remarks="Final approval",
                    requiredInputs={
                        "2_vc_decision_reason": "Academic fit",
                        "2_vc_tags": ["Merit"],
                    },
                ),
                session=vc_session,
            )
            self.assertEqual(final_approve["application"]["final_status"], "APPROVED")

            second_application_id = self.create_test_application(opportunity_id)
            rejected = reject_application(
                second_application_id,
                DecisionBody(reason="Rejected for endpoint test"),
                session=admin_session,
            )
            self.assertEqual(rejected["application"]["final_status"], "REJECTED")

            third_application_id = self.create_test_application(opportunity_id)
            with self.assertRaises(HTTPException) as forbidden_delete:
                delete_application(third_application_id, session=vc_session)
            self.assertEqual(forbidden_delete.exception.status_code, 403)

            deleted_by_student = delete_application(third_application_id, session=student_session)
            self.assertTrue(deleted_by_student.get("ok"))

            deleted_by_admin = delete_application(second_application_id, session=admin_session)
            self.assertTrue(deleted_by_admin.get("ok"))
        finally:
            self.safe_delete_opportunity(opportunity_id)


class GraphPublishingRouteTests(unittest.TestCase):
    """Integration tests for the 8 Chunk 6 graph routes."""

    @classmethod
    def setUpClass(cls):
        ensure_db_initialized()

    def session_for(self, email: str) -> SessionUser:
        with db_conn() as conn:
            row = get_user_role(conn, email.strip().lower())
        self.assertIsNotNone(row, f"Missing test user for {email}")
        return SessionUser(
            email=row["email"],
            name=row["full_name"],
            role=row["role_code"],
            roleDisplayName=row["role_display_name"],
            userId=int(row["id"]),
        )

    def _seed_publish_ready_draft(self) -> int:
        """Insert a publish_ready=1 draft directly, bypassing the AI call."""
        output = AIWorkflowDraftOutput(
            opportunity=__import__("fastapi_app.graph_models", fromlist=["OpportunityDraftModel"]).OpportunityDraftModel(
                title="Test Graph Opportunity",
                description="Automated test opportunity for graph publishing.",
                host_institution="Test University",
            ),
            graph=GraphModel(
                nodes=[
                    GraphNodeModel(node_key="start", node_type="start", display_name="Start"),
                    GraphNodeModel(
                        node_key="review",
                        node_type="reviewer",
                        display_name="OGE Review",
                        reviewer_email="oge@plaksha.edu.in",
                    ),
                    GraphNodeModel(node_key="end", node_type="end", display_name="End"),
                ],
                edges=[
                    GraphEdgeModel(from_node_key="start", to_node_key="review"),
                    GraphEdgeModel(from_node_key="review", to_node_key="end"),
                ],
            ),
            clarifying_questions=[],
            confidence=0.9,
            warnings=[],
            is_fallback=False,
        )
        ts = datetime.now(timezone.utc).isoformat()
        with db_conn() as conn:
            cursor = conn.execute(
                """
                INSERT INTO workflow_drafts
                  (opportunity_id, status, draft_output, clarifying_questions,
                   admin_answers, warnings, confidence, publish_ready,
                   created_by_email, created_at, updated_at)
                VALUES (NULL, 'ready', ?, '[]', '{}', '[]', 0.9, 1, ?, ?, ?)
                """,
                (output.model_dump_json(), "oge@plaksha.edu.in", ts, ts),
            )
            draft_id = int(cursor.lastrowid)
            conn.commit()
            return draft_id

    # --- ai-generate ---

    def test_ai_generate_returns_draft_id(self):
        admin = self.session_for("oge@plaksha.edu.in")
        resp = admin_generate_opportunity_with_ai(
            OpportunityAIGenerateBody(prompt="Singapore AI exchange for CS students, funded, summer 2026."),
            session=admin,
        )
        self.assertIn("draft_id", resp)
        self.assertIn("draft", resp)
        self.assertIsInstance(resp["draft_id"], int)
        self.assertEqual(resp["draft"]["publish_ready"], 0)  # fallback in test env

    # --- GET workflow-drafts/{id} ---

    def test_get_draft_returns_row(self):
        draft_id = self._seed_publish_ready_draft()
        admin = self.session_for("oge@plaksha.edu.in")
        resp = admin_get_workflow_draft(draft_id, session=admin)
        self.assertIn("draft", resp)
        self.assertEqual(resp["draft"]["id"], draft_id)
        self.assertEqual(resp["draft"]["publish_ready"], 1)

    def test_get_draft_404_for_missing(self):
        admin = self.session_for("oge@plaksha.edu.in")
        with self.assertRaises(HTTPException) as ctx:
            admin_get_workflow_draft(999999, session=admin)
        self.assertEqual(ctx.exception.status_code, 404)

    # --- POST workflow-drafts/{id}/answer ---

    def test_answer_clarification_merges_answers(self):
        # Seed a draft with one open clarification question.
        output = AIWorkflowDraftOutput(
            opportunity=__import__("fastapi_app.graph_models", fromlist=["OpportunityDraftModel"]).OpportunityDraftModel(
                title="Clarification Test Opportunity",
                description="Needs clarification.",
            ),
            graph=GraphModel(
                nodes=[
                    GraphNodeModel(node_key="start", node_type="start"),
                    GraphNodeModel(node_key="review", node_type="reviewer", reviewer_email="oge@plaksha.edu.in"),
                    GraphNodeModel(node_key="end", node_type="end"),
                ],
                edges=[
                    GraphEdgeModel(from_node_key="start", to_node_key="review"),
                    GraphEdgeModel(from_node_key="review", to_node_key="end"),
                ],
            ),
            clarifying_questions=["Who is the final authority?"],
            confidence=0.6,
            warnings=[],
            is_fallback=False,
        )
        ts = datetime.now(timezone.utc).isoformat()
        with db_conn() as conn:
            cursor = conn.execute(
                """
                INSERT INTO workflow_drafts
                  (opportunity_id, status, draft_output, clarifying_questions,
                   admin_answers, warnings, confidence, publish_ready,
                   created_by_email, created_at, updated_at)
                VALUES (NULL, 'pending', ?, ?, '{}', '[]', 0.6, 0, ?, ?, ?)
                """,
                (
                    output.model_dump_json(),
                    json.dumps(output.clarifying_questions),
                    "oge@plaksha.edu.in",
                    ts,
                    ts,
                ),
            )
            draft_id = int(cursor.lastrowid)
            conn.commit()

        admin = self.session_for("oge@plaksha.edu.in")
        resp = admin_answer_workflow_draft_clarification(
            draft_id,
            ClarificationAnswerBody(answers={"Who is the final authority?": "Dean of Students"}),
            session=admin,
        )
        self.assertIn("draft", resp)
        draft = resp["draft"]
        self.assertEqual(draft["publish_ready"], 1)
        answers = json.loads(draft["admin_answers"])
        self.assertEqual(answers["Who is the final authority?"], "Dean of Students")

    def test_answer_clarification_404_for_missing(self):
        admin = self.session_for("oge@plaksha.edu.in")
        with self.assertRaises(HTTPException) as ctx:
            admin_answer_workflow_draft_clarification(
                999999,
                ClarificationAnswerBody(answers={"q": "a"}),
                session=admin,
            )
        self.assertEqual(ctx.exception.status_code, 404)

    # --- POST workflow-drafts/{id}/publish ---

    def test_publish_creates_graph_version_and_opportunity(self):
        draft_id = self._seed_publish_ready_draft()
        admin = self.session_for("oge@plaksha.edu.in")
        resp = admin_publish_workflow_draft(draft_id, session=admin)
        self.assertIn("graph_version_id", resp)
        gv_id = resp["graph_version_id"]

        with db_conn() as conn:
            gv = conn.execute("SELECT * FROM graph_versions WHERE id = ?", (gv_id,)).fetchone()
            nodes = conn.execute("SELECT * FROM graph_nodes WHERE graph_version_id = ?", (gv_id,)).fetchall()
            edges = conn.execute("SELECT * FROM graph_edges WHERE graph_version_id = ?", (gv_id,)).fetchall()
            draft = conn.execute("SELECT * FROM workflow_drafts WHERE id = ?", (draft_id,)).fetchone()

        self.assertEqual(gv["status"], "active")
        self.assertEqual(len(nodes), 3)  # start, review, end
        self.assertEqual(len(edges), 2)
        self.assertEqual(draft["status"], "published")
        self.assertIsNotNone(draft["opportunity_id"])

    def test_publish_rejected_for_fallback_draft(self):
        # ai-generate in test env produces a fallback draft (publish_ready=0).
        admin = self.session_for("oge@plaksha.edu.in")
        resp = admin_generate_opportunity_with_ai(
            OpportunityAIGenerateBody(prompt="Singapore AI exchange for CS students."),
            session=admin,
        )
        draft_id = resp["draft_id"]
        with self.assertRaises(HTTPException) as ctx:
            admin_publish_workflow_draft(draft_id, session=admin)
        self.assertEqual(ctx.exception.status_code, 400)

    # --- GET admin/opportunities/{id}/graph ---

    def test_get_opportunity_graph_returns_nodes_and_edges(self):
        draft_id = self._seed_publish_ready_draft()
        admin = self.session_for("oge@plaksha.edu.in")
        pub = admin_publish_workflow_draft(draft_id, session=admin)
        gv_id = pub["graph_version_id"]

        with db_conn() as conn:
            opp_id = conn.execute(
                "SELECT opportunity_id FROM graph_versions WHERE id = ?", (gv_id,)
            ).fetchone()["opportunity_id"]

        resp = admin_get_opportunity_graph(opp_id, session=admin)
        self.assertIsNotNone(resp["graph_version"])
        self.assertEqual(len(resp["nodes"]), 3)
        self.assertEqual(len(resp["edges"]), 2)

    def test_get_graph_returns_empty_for_no_active_version(self):
        # Create a legacy opportunity with no graph version.
        ts = datetime.now(timezone.utc).strftime("%H%M%S%f")
        with db_conn() as conn:
            cursor = conn.execute(
                "INSERT INTO opportunities (code, title, status, created_at, updated_at) VALUES (?, ?, 'published', ?, ?)",
                (f"NOGRAPH_{ts}", "No Graph Opportunity", datetime.now(timezone.utc).isoformat(), datetime.now(timezone.utc).isoformat()),
            )
            opp_id = int(cursor.lastrowid)
            conn.commit()
        admin = self.session_for("oge@plaksha.edu.in")
        resp = admin_get_opportunity_graph(opp_id, session=admin)
        self.assertIsNone(resp["graph_version"])
        self.assertEqual(resp["nodes"], [])

    # --- POST reviewer/tasks/{id}/decide ---

    def test_reviewer_decide_approve_advances_graph(self):
        draft_id = self._seed_publish_ready_draft()
        admin = self.session_for("oge@plaksha.edu.in")
        pub = admin_publish_workflow_draft(draft_id, session=admin)
        gv_id = pub["graph_version_id"]

        with db_conn() as conn:
            opp_id = conn.execute(
                "SELECT opportunity_id FROM graph_versions WHERE id = ?", (gv_id,)
            ).fetchone()["opportunity_id"]
            conn.execute(
                "INSERT INTO opportunity_visibility_rules (opportunity_id, rule_type, rule_value, created_at) VALUES (?, 'EMAIL', ?, ?)",
                (opp_id, "rohan@plaksha.edu.in", datetime.now(timezone.utc).isoformat()),
            )
            conn.commit()

        student = self.session_for("rohan@plaksha.edu.in")
        body = ApplicationCreateBody(
            opportunityId=opp_id,
            submittedData={"full_name": "Rohan", "email": "rohan@plaksha.edu.in"},
        )
        app_resp = create_application(body, session=student)
        application_id = int(app_resp["application"]["id"])

        with db_conn() as conn:
            task = conn.execute(
                "SELECT id FROM application_workflow_tasks WHERE application_id = ? AND status = 'active'",
                (application_id,),
            ).fetchone()
        self.assertIsNotNone(task)
        task_id = int(task["id"])

        reviewer = self.session_for("oge@plaksha.edu.in")
        result = reviewer_decide_task(
            task_id,
            TaskDecideBody(decision="approve", comment="Looks good"),
            session=reviewer,
        )
        self.assertTrue(result["success"])

        with db_conn() as conn:
            app_row = conn.execute("SELECT final_status FROM applications WHERE id = ?", (application_id,)).fetchone()
        self.assertEqual(app_row["final_status"], "APPROVED")

    def test_reviewer_decide_wrong_actor_rejected(self):
        draft_id = self._seed_publish_ready_draft()
        admin = self.session_for("oge@plaksha.edu.in")
        pub = admin_publish_workflow_draft(draft_id, session=admin)
        gv_id = pub["graph_version_id"]

        with db_conn() as conn:
            opp_id = conn.execute(
                "SELECT opportunity_id FROM graph_versions WHERE id = ?", (gv_id,)
            ).fetchone()["opportunity_id"]
            conn.execute(
                "INSERT INTO opportunity_visibility_rules (opportunity_id, rule_type, rule_value, created_at) VALUES (?, 'EMAIL', ?, ?)",
                (opp_id, "rohan@plaksha.edu.in", datetime.now(timezone.utc).isoformat()),
            )
            conn.commit()

        student = self.session_for("rohan@plaksha.edu.in")
        body = ApplicationCreateBody(
            opportunityId=opp_id,
            submittedData={"full_name": "Rohan", "email": "rohan@plaksha.edu.in"},
        )
        app_resp = create_application(body, session=student)
        application_id = int(app_resp["application"]["id"])

        with db_conn() as conn:
            task = conn.execute(
                "SELECT id FROM application_workflow_tasks WHERE application_id = ? AND status = 'active'",
                (application_id,),
            ).fetchone()
        task_id = int(task["id"])

        # vc@plaksha.edu.in is not the assigned reviewer (oge is).
        wrong_reviewer = self.session_for("vc@plaksha.edu.in")
        with self.assertRaises(HTTPException) as ctx:
            reviewer_decide_task(
                task_id,
                TaskDecideBody(decision="approve"),
                session=wrong_reviewer,
            )
        self.assertEqual(ctx.exception.status_code, 400)

    # --- reviewer inbox includes graph tasks ---

    def test_reviewer_inbox_includes_graph_tasks(self):
        draft_id = self._seed_publish_ready_draft()
        admin = self.session_for("oge@plaksha.edu.in")
        pub = admin_publish_workflow_draft(draft_id, session=admin)
        gv_id = pub["graph_version_id"]

        with db_conn() as conn:
            opp_id = conn.execute(
                "SELECT opportunity_id FROM graph_versions WHERE id = ?", (gv_id,)
            ).fetchone()["opportunity_id"]
            conn.execute(
                "INSERT INTO opportunity_visibility_rules (opportunity_id, rule_type, rule_value, created_at) VALUES (?, 'EMAIL', ?, ?)",
                (opp_id, "rohan@plaksha.edu.in", datetime.now(timezone.utc).isoformat()),
            )
            conn.commit()

        student = self.session_for("rohan@plaksha.edu.in")
        create_application(
            ApplicationCreateBody(
                opportunityId=opp_id,
                submittedData={"full_name": "Rohan", "email": "rohan@plaksha.edu.in"},
            ),
            session=student,
        )

        inbox = reviewer_inbox(session=self.session_for("oge@plaksha.edu.in"))
        graph_items = [i for i in inbox["items"] if i.get("source") == "graph"]
        self.assertGreater(len(graph_items), 0)

    # --- graph application submit ---

    def test_graph_application_submit_instantiates_tasks(self):
        draft_id = self._seed_publish_ready_draft()
        admin = self.session_for("oge@plaksha.edu.in")
        pub = admin_publish_workflow_draft(draft_id, session=admin)
        gv_id = pub["graph_version_id"]

        with db_conn() as conn:
            opp_id = conn.execute(
                "SELECT opportunity_id FROM graph_versions WHERE id = ?", (gv_id,)
            ).fetchone()["opportunity_id"]
            conn.execute(
                "INSERT INTO opportunity_visibility_rules (opportunity_id, rule_type, rule_value, created_at) VALUES (?, 'EMAIL', ?, ?)",
                (opp_id, "rohan@plaksha.edu.in", datetime.now(timezone.utc).isoformat()),
            )
            conn.commit()

        student = self.session_for("rohan@plaksha.edu.in")
        resp = create_application(
            ApplicationCreateBody(
                opportunityId=opp_id,
                submittedData={"full_name": "Rohan"},
            ),
            session=student,
        )
        application_id = int(resp["application"]["id"])

        with db_conn() as conn:
            tasks = conn.execute(
                "SELECT * FROM application_workflow_tasks WHERE application_id = ?",
                (application_id,),
            ).fetchall()
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0]["status"], "active")
        self.assertEqual(tasks[0]["node_key"], "review")


if __name__ == "__main__":
    unittest.main()
