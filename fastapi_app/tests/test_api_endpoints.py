import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

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
    OpportunityDetailFieldPayload,
    OpportunityPatchBody,
    SessionUser,
    StudentResponseBody,
    TaskDecideBody,
    WorkflowDraftManualBody,
    WorkflowDraftValidateBody,
    SLABreachAcknowledgeBody,
    SLAPolicyBody,
    SLATestReminderBody,
    admin_applications,
    admin_answer_workflow_draft_clarification,
    admin_list_workflow_drafts,
    admin_list_sla_policies,
    admin_create_opportunity,
    admin_create_manual_workflow_draft,
    admin_validate_workflow_draft,
    admin_generate_opportunity_with_ai,
    admin_delete_opportunity,
    admin_get_opportunity,
    admin_get_opportunity_graph,
    admin_get_workflow_draft,
    admin_list_opportunities,
    admin_patch_application,
    admin_patch_opportunity,
    admin_publish_workflow_draft,
    admin_regenerate_workflow_draft,
    admin_send_sla_test_reminder,
    admin_sla_dashboard,
    admin_summary,
    admin_upsert_sla_policy,
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
    get_sla_notifications,
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
    reviewer_acknowledge_sla_breach,
    reviewer_inbox,
    reviewer_tasks_with_sla,
    submit_student_response,
    users_me,
    AdminApplicationPatchBody,
)
from fastapi_app.graph_execution import GraphExecutionService
from fastapi_app.graph_publishing import GraphPublishingService
from fastapi_app.graph_models import AIWorkflowDraftOutput, GraphModel, GraphNodeModel, GraphEdgeModel, OpportunityDraftModel


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
            detailFields=[
                OpportunityDetailFieldPayload(
                    key="host_institution",
                    label="Host Institution",
                    value="Test University",
                ),
                OpportunityDetailFieldPayload(
                    key="funding",
                    label="Funding",
                    value="Need-based travel grant review",
                ),
            ],
            aiSummaryBullets=[
                "Students apply through PRISM after reviewing eligibility.",
                "Funding is reviewed after nomination.",
            ],
            generatorVisibilityRules=[
                {"ruleType": "EMAIL", "ruleValue": "rohan@plaksha.edu.in"},
            ],
        )

        result = admin_create_opportunity(payload, session=self.session_for("oge@plaksha.edu.in"))
        opportunity_id = int(result["id"])
        self.seed_active_review_graph(opportunity_id)
        return opportunity_id

    def seed_active_review_graph(self, opportunity_id: int) -> int:
        now = datetime.now(timezone.utc).isoformat()
        with db_conn() as conn:
            cursor = conn.execute(
                """
                INSERT INTO graph_versions (opportunity_id, version, status, published_by_email, published_at, created_at)
                VALUES (?, 1, 'active', ?, ?, ?)
                """,
                (opportunity_id, "oge@plaksha.edu.in", now, now),
            )
            graph_version_id = int(cursor.lastrowid)
            nodes = [
                ("start", "start", "Start", None, ["all"], [], {}),
                (
                    "oge_review",
                    "reviewer",
                    "OGE Intake Review",
                    "oge@plaksha.edu.in",
                    ["all"],
                    ["approve", "request_changes", "reject", "comment"],
                    {},
                ),
                (
                    "vc_review",
                    "reviewer",
                    "VC Review",
                    "vc@plaksha.edu.in",
                    ["full_name", "student_id", "email", "cgpa"],
                    ["approve", "reject"],
                    {},
                ),
                ("end", "end", "End", None, [], [], {}),
            ]
            for node_key, node_type, display_name, reviewer_email, visible_sections, allowed_actions, metadata in nodes:
                conn.execute(
                    """
                    INSERT INTO graph_nodes
                    (graph_version_id, node_key, node_type, display_name, reviewer_email,
                     visible_sections, allowed_actions, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        graph_version_id,
                        node_key,
                        node_type,
                        display_name,
                        reviewer_email,
                        json.dumps(visible_sections),
                        json.dumps(allowed_actions),
                        json.dumps(metadata),
                    ),
                )
            for from_key, to_key in [("start", "oge_review"), ("oge_review", "vc_review"), ("vc_review", "end")]:
                conn.execute(
                    """
                    INSERT INTO graph_edges (graph_version_id, from_node_key, to_node_key)
                    VALUES (?, ?, ?)
                    """,
                    (graph_version_id, from_key, to_key),
                )
            conn.commit()
            return graph_version_id

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
            ("GET", "/api/admin/workflow-drafts"),
            ("POST", "/api/admin/workflow-drafts/manual"),
            ("POST", "/api/admin/workflow-drafts/validate"),
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
            ("GET", "/api/reviewer/tasks"),
            ("POST", "/api/reviewer/tasks/{task_id}/decide"),
            ("POST", "/api/reviewer/sla-breaches/{task_id}/acknowledge"),
            ("GET", "/api/admin/workflow-drafts/{draft_id}"),
            ("POST", "/api/admin/workflow-drafts/{draft_id}/answer"),
            ("POST", "/api/admin/workflow-drafts/{draft_id}/regenerate"),
            ("POST", "/api/admin/workflow-drafts/{draft_id}/publish"),
            ("GET", "/api/admin/opportunities/{opportunity_id}/graph"),
            ("GET", "/api/admin/sla-policies"),
            ("POST", "/api/admin/sla-policies"),
            ("GET", "/api/admin/sla-dashboard"),
            ("POST", "/api/admin/sla-reminders/send-test"),
            ("GET", "/api/admin/dashboard/summary"),
            ("GET", "/api/admin/applications"),
            ("PATCH", "/api/admin/applications/{application_id}"),
            ("GET", "/api/admin/sla-notifications"),
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
            "sla_policies",
            "sla_reminders_sent",
            "sla_breaches",
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

            admin_list = admin_list_opportunities(session=admin_session)
            self.assertIn(opportunity_id, [row["id"] for row in admin_list.get("items", [])])

            detail = admin_get_opportunity(opportunity_id, session=admin_session)
            self.assertTrue(any(f["field_key"] == "custom_org_unit" for f in detail.get("custom_fields", [])))
            self.assertEqual([row["label"] for row in detail.get("detail_fields", [])][:2], ["Host Institution", "Funding"])
            self.assertIn("Students apply through PRISM", " ".join(detail["opportunity"].get("ai_summary_bullets", [])))

            patch = admin_patch_opportunity(
                opportunity_id,
                OpportunityPatchBody(
                    title="CRUD Opportunity Updated",
                    detailFields=[
                        OpportunityDetailFieldPayload(
                            key="deadline_note",
                            label="Deadline Note",
                            value="Late applications are not accepted.",
                        )
                    ],
                    aiSummaryBullets=["Updated summary for student detail page."],
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
            self.assertEqual(patch["detail_fields"][0]["field_key"], "deadline_note")
            self.assertEqual(patch["opportunity"]["ai_summary_bullets"], ["Updated summary for student detail page."])

            vis_all = admin_visibility_audit(session=admin_session)
            self.assertGreaterEqual(vis_all.get("count", 0), 1)

            vis_one = admin_visibility_audit_single(opportunity_id, session=admin_session)
            self.assertIn("item", vis_one)

            generator_list = list_opportunities(session=student_session)
            self.assertIn(opportunity_id, [row["id"] for row in generator_list.get("items", [])])

            generator_detail = opportunity_detail(opportunity_id, session=student_session)
            keys = [row["field_key"] for row in generator_detail.get("required_fields", [])]
            self.assertIn("custom_org_unit", keys)
            self.assertEqual(generator_detail["detail_fields"][0]["label"], "Deadline Note")
            self.assertEqual(generator_detail["opportunity"]["ai_summary_bullets"], ["Updated summary for student detail page."])

            nomination_ai = opportunity_ai_nomination_insights(opportunity_id, session=student_session)
            self.assertIn("nominations_assist", nomination_ai)
            self.assertTrue(nomination_ai.get("is_dummy_ai"))
        finally:
            delete_result = admin_delete_opportunity(opportunity_id, session=admin_session)
            self.assertTrue(delete_result.get("ok"))

        with self.assertRaises(HTTPException) as deleted_lookup:
            admin_get_opportunity(opportunity_id, session=admin_session)
        self.assertEqual(deleted_lookup.exception.status_code, 404)

    def test_opportunity_cover_image_requires_https(self):
        payload = OpportunityCreatePayload(
            opportunity={
                "code": "BAD_COVER_TEST",
                "title": "Bad Cover URL Test",
                "description": "Cover URL validation test",
                "cover_image_url": "javascript:alert(1)",
                "term": "Fall 2026",
                "destination": "Test Destination",
                "deadline": "2026-12-31",
                "seats": 5,
            },
            formFields=["full_name", "student_id", "email", "cgpa"],
            customFields=[],
            detailFields=[],
            aiSummaryBullets=[],
            generatorVisibilityRules=[
                {"ruleType": "EMAIL", "ruleValue": "rohan@plaksha.edu.in"},
            ],
        )

        with self.assertRaises(HTTPException) as raised:
            admin_create_opportunity(payload, session=self.session_for("oge@plaksha.edu.in"))
        self.assertEqual(raised.exception.status_code, 400)

    def test_opportunity_code_autogenerates_from_database(self):
        admin = self.session_for("oge@plaksha.edu.in")
        payload = OpportunityCreatePayload(
            opportunity={
                "title": "Auto Code Opportunity",
                "description": "Code should be generated by the backend.",
            },
            formFields=["full_name", "student_id", "email", "cgpa"],
            customFields=[],
            detailFields=[],
            aiSummaryBullets=[],
            generatorVisibilityRules=[
                {"ruleType": "EMAIL", "ruleValue": "rohan@plaksha.edu.in"},
            ],
        )
        first = admin_create_opportunity(payload, session=admin)
        second = admin_create_opportunity(payload, session=admin)
        try:
            first_detail = admin_get_opportunity(int(first["id"]), session=admin)
            second_detail = admin_get_opportunity(int(second["id"]), session=admin)
            self.assertEqual(first_detail["opportunity"]["code"], "AUTO_CODE_OPPORTUNITY")
            self.assertEqual(second_detail["opportunity"]["code"], "AUTO_CODE_OPPORTUNITY_2")
        finally:
            admin_delete_opportunity(int(first["id"]), session=admin)
            admin_delete_opportunity(int(second["id"]), session=admin)

    def test_application_create_rejects_expired_detail_deadline(self):
        admin = self.session_for("oge@plaksha.edu.in")
        student = self.session_for("rohan@plaksha.edu.in")
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()
        payload = OpportunityCreatePayload(
            opportunity={
                "title": "Expired Detail Deadline",
                "description": "Deadline should block late applications.",
            },
            formFields=["full_name", "student_id", "email", "cgpa"],
            customFields=[],
            detailFields=[
                OpportunityDetailFieldPayload(
                    key="application_deadline",
                    label="Application Deadline",
                    value=yesterday,
                    valueType="date",
                )
            ],
            aiSummaryBullets=[],
            generatorVisibilityRules=[
                {"ruleType": "EMAIL", "ruleValue": "rohan@plaksha.edu.in"},
            ],
        )
        created = admin_create_opportunity(payload, session=admin)
        opportunity_id = int(created["id"])
        try:
            with self.assertRaises(HTTPException) as raised:
                create_application(
                    ApplicationCreateBody(
                        opportunityId=opportunity_id,
                        submittedData={
                            "full_name": "Rohan",
                            "student_id": "PL-2022-ROH",
                            "email": "rohan@plaksha.edu.in",
                            "cgpa": "8.1",
                        },
                    ),
                    session=student,
                )
            self.assertEqual(raised.exception.status_code, 400)
            self.assertIn("deadline has passed", str(raised.exception.detail))
        finally:
            admin_delete_opportunity(opportunity_id, session=admin)

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
            self.assertEqual(first_approve["application"]["current_step_order"], 1)
            self.assertEqual(first_approve["application"]["current_stage_label"], "VC Review")

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
            applicant_form_fields=[],
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

    def test_manual_workflow_draft_can_be_saved_ready(self):
        admin = self.session_for("oge@plaksha.edu.in")
        resp = admin_create_manual_workflow_draft(
            WorkflowDraftManualBody(
                opportunity={
                    "title": "Manual Studio Opportunity",
                    "description": "Created from Opportunity Studio.",
                    "destination": "Singapore",
                    "term": "Fall 2026",
                    "deadline": "2026-12-31",
                    "seats": 4,
                },
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
            ),
            session=admin,
        )
        self.assertIn("draft_id", resp)
        self.assertEqual(resp["draft"]["publish_ready"], 1)

    def test_list_workflow_drafts_returns_recent_rows(self):
        first_id = self._seed_publish_ready_draft()
        second_id = self._seed_publish_ready_draft()
        admin = self.session_for("oge@plaksha.edu.in")
        resp = admin_list_workflow_drafts(session=admin)
        self.assertIn("items", resp)
        self.assertGreaterEqual(len(resp["items"]), 2)
        ids = [item["id"] for item in resp["items"]]
        self.assertIn(first_id, ids)
        self.assertIn(second_id, ids)

    def test_validate_workflow_draft_returns_publish_ready(self):
        admin = self.session_for("oge@plaksha.edu.in")
        resp = admin_validate_workflow_draft(
            WorkflowDraftValidateBody(
                opportunity={
                    "title": "Validated Studio Opportunity",
                    "description": "Validated from Opportunity Studio.",
                    "destination": "Singapore",
                    "term": "Fall 2026",
                },
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
                clarifyingQuestions=[],
                warnings=[],
                confidence=0.9,
                isFallback=False,
            ),
            session=admin,
        )
        self.assertEqual(resp["publish_ready"], True)
        self.assertEqual(resp["validation_errors"], [])
        self.assertEqual(resp["warnings"], [])

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

    # --- POST workflow-drafts/{id}/regenerate ---

    def test_regenerate_workflow_draft_uses_clarification_body(self):
        draft_id = self._seed_publish_ready_draft()
        admin = self.session_for("oge@plaksha.edu.in")

        with patch("fastapi_app.main.AIWorkflowDraftService") as service_cls:
            service_cls.return_value.regenerate_with_answers.return_value = {
                "id": draft_id,
                "admin_answers": json.dumps({"Who approves?": "Dean"}),
                "publish_ready": 1,
            }

            resp = admin_regenerate_workflow_draft(
                draft_id,
                ClarificationAnswerBody(answers={"Who approves?": "Dean"}),
                session=admin,
            )

        self.assertEqual(resp["draft"]["id"], draft_id)
        service_cls.return_value.regenerate_with_answers.assert_called_once()
        _, called_draft_id, called_answers = service_cls.return_value.regenerate_with_answers.call_args.args
        self.assertEqual(called_draft_id, draft_id)
        self.assertEqual(called_answers, {"Who approves?": "Dean"})

    def test_regenerate_workflow_draft_404_for_missing(self):
        admin = self.session_for("oge@plaksha.edu.in")

        with patch("fastapi_app.main.AIWorkflowDraftService") as service_cls:
            service_cls.return_value.regenerate_with_answers.side_effect = ValueError("Draft 999999 not found")
            with self.assertRaises(HTTPException) as ctx:
                admin_regenerate_workflow_draft(
                    999999,
                    ClarificationAnswerBody(answers={"q": "a"}),
                    session=admin,
                )

        self.assertEqual(ctx.exception.status_code, 404)

    def test_regenerate_workflow_draft_400_for_missing_original_prompt(self):
        admin = self.session_for("oge@plaksha.edu.in")

        with patch("fastapi_app.main.AIWorkflowDraftService") as service_cls:
            service_cls.return_value.regenerate_with_answers.side_effect = ValueError(
                "Draft 123 does not have an original prompt"
            )
            with self.assertRaises(HTTPException) as ctx:
                admin_regenerate_workflow_draft(
                    123,
                    ClarificationAnswerBody(answers={"q": "a"}),
                    session=admin,
                )

        self.assertEqual(ctx.exception.status_code, 400)

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

    def test_sla_policy_dashboard_reviewer_tasks_and_acknowledge(self):
        draft_id = self._seed_publish_ready_draft()
        admin = self.session_for("oge@plaksha.edu.in")
        pub = admin_publish_workflow_draft(draft_id, session=admin)
        gv_id = pub["graph_version_id"]

        with db_conn() as conn:
            graph_node = conn.execute(
                "SELECT * FROM graph_nodes WHERE graph_version_id = ? AND node_key = 'review'",
                (gv_id,),
            ).fetchone()
            opp_id = conn.execute(
                "SELECT opportunity_id FROM graph_versions WHERE id = ?", (gv_id,)
            ).fetchone()["opportunity_id"]
            conn.execute(
                "INSERT INTO opportunity_visibility_rules (opportunity_id, rule_type, rule_value, created_at) VALUES (?, 'EMAIL', ?, ?)",
                (opp_id, "rohan@plaksha.edu.in", datetime.now(timezone.utc).isoformat()),
            )
            conn.commit()

        policy = admin_upsert_sla_policy(
            SLAPolicyBody(
                graphNodeId=int(graph_node["id"]),
                slaDays=1,
                reminderDays=[1],
                escalationEmail="dean@plaksha.edu.in",
            ),
            session=admin,
        )
        self.assertEqual(policy["sla_days"], 1)
        self.assertTrue(
            any(item["id"] == policy["id"] for item in admin_list_sla_policies(session=admin)["policies"])
        )

        student = self.session_for("rohan@plaksha.edu.in")
        resp = create_application(
            ApplicationCreateBody(
                opportunityId=opp_id,
                submittedData={"full_name": "Rohan", "email": "rohan@plaksha.edu.in"},
            ),
            session=student,
        )
        application_id = int(resp["application"]["id"])

        with db_conn() as conn:
            task = conn.execute(
                "SELECT * FROM application_workflow_tasks WHERE application_id = ?",
                (application_id,),
            ).fetchone()
            conn.execute(
                "UPDATE application_workflow_tasks SET assigned_at = ? WHERE id = ?",
                ("2020-01-01T00:00:00+00:00", int(task["id"])),
            )
            conn.commit()
            task_id = int(task["id"])

        dashboard = admin_sla_dashboard(session=admin)
        self.assertGreaterEqual(dashboard["breached"], 1)
        self.assertTrue(any(item["task_id"] == task_id for item in dashboard["breached_tasks"]))

        tasks = reviewer_tasks_with_sla(session=self.session_for("oge@plaksha.edu.in"))["tasks"]
        task_payload = next(item for item in tasks if item["task_id"] == task_id)
        self.assertEqual(task_payload["status"], "breached")
        self.assertEqual(task_payload["sla_days"], 1)

        ack = reviewer_acknowledge_sla_breach(
            task_id,
            SLABreachAcknowledgeBody(notes="I am handling this today."),
            session=self.session_for("oge@plaksha.edu.in"),
        )
        self.assertTrue(ack["acknowledged"])

    def test_sla_test_reminder_dry_run(self):
        result = admin_send_sla_test_reminder(
            SLATestReminderBody(toEmail="oge@plaksha.edu.in"),
            session=self.session_for("oge@plaksha.edu.in"),
        )
        self.assertTrue(result["sent"])
        self.assertIn("timestamp", result)

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

    def test_publish_draft_writes_form_fields_and_visibility_rules(self):
        """Chunk B: publishing a draft persists applicant fields and generator visibility."""
        output = AIWorkflowDraftOutput(
            opportunity=OpportunityDraftModel(
                title="Form Fields and Visibility Publish Test",
                description="Verify form fields and visibility rules are written on publish.",
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
            applicant_form_fields=["full_name", "cgpa", "email"],
            generator_visibility_rules=["ug2024@plaksha.edu.in"],
            clarifying_questions=[],
            confidence=0.95,
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
                VALUES (NULL, 'ready', ?, '[]', '{}', '[]', 0.95, 1, ?, ?, ?)
                """,
                (output.model_dump_json(), "oge@plaksha.edu.in", ts, ts),
            )
            draft_id = int(cursor.lastrowid)
            conn.commit()

        admin = self.session_for("oge@plaksha.edu.in")
        resp = admin_publish_workflow_draft(draft_id, session=admin)
        self.assertIn("graph_version_id", resp)

        with db_conn() as conn:
            draft = conn.execute("SELECT opportunity_id FROM workflow_drafts WHERE id = ?", (draft_id,)).fetchone()
            opportunity_id = draft["opportunity_id"]
            self.assertIsNotNone(opportunity_id)

            rows = conn.execute(
                "SELECT field_key FROM opportunity_required_fields WHERE opportunity_id = ? ORDER BY display_order ASC",
                (opportunity_id,),
            ).fetchall()
            field_keys = [row["field_key"] for row in rows]
            visibility_rows = conn.execute(
                """
                SELECT rule_type, rule_value
                FROM opportunity_visibility_rules
                WHERE opportunity_id = ?
                ORDER BY rule_value ASC
                """,
                (opportunity_id,),
            ).fetchall()
            visibility_rules = [(row["rule_type"], row["rule_value"]) for row in visibility_rows]

        self.assertEqual(len(field_keys), 3)
        self.assertIn("full_name", field_keys)
        self.assertIn("cgpa", field_keys)
        self.assertIn("email", field_keys)
        self.assertEqual(
            visibility_rules,
            [
                ("GROUP_EMAIL", "ug2024@plaksha.edu.in"),
            ],
        )

    def test_publish_draft_updates_existing_form_fields_and_visibility_rules(self):
        ts = datetime.now(timezone.utc).strftime("%H%M%S%f")
        created_at = datetime.now(timezone.utc).isoformat()
        with db_conn() as conn:
            cursor = conn.execute(
                """
                INSERT INTO opportunities
                  (code, title, description, status, created_at, updated_at)
                VALUES (?, 'Existing Publish Target', 'Before AI publish.', 'published', ?, ?)
                """,
                (f"PUBUPD_{ts}", created_at, created_at),
            )
            opportunity_id = int(cursor.lastrowid)
            conn.execute(
                """
                INSERT INTO opportunity_required_fields (opportunity_id, field_key, display_order)
                VALUES (?, 'full_name', 1), (?, 'cgpa', 2)
                """,
                (opportunity_id, opportunity_id),
            )
            conn.execute(
                """
                INSERT INTO opportunity_visibility_rules (opportunity_id, rule_type, rule_value, created_at)
                VALUES (?, 'EMAIL', 'rohan@plaksha.edu.in', ?)
                """,
                (opportunity_id, created_at),
            )
            conn.commit()

        output = AIWorkflowDraftOutput(
            opportunity=OpportunityDraftModel(
                title="Updated Publish Target",
                description="Verify publish refreshes existing opportunity fields.",
                host_institution="Updated Test University",
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
            applicant_form_fields=["full_name", "email"],
            generator_visibility_rules=["ug2025@plaksha.edu.in"],
            clarifying_questions=[],
            confidence=0.95,
            warnings=[],
            is_fallback=False,
        )
        draft_ts = datetime.now(timezone.utc).isoformat()
        try:
            with db_conn() as conn:
                cursor = conn.execute(
                    """
                    INSERT INTO workflow_drafts
                      (opportunity_id, status, draft_output, clarifying_questions,
                       admin_answers, warnings, confidence, publish_ready,
                       created_by_email, created_at, updated_at)
                    VALUES (?, 'ready', ?, '[]', '{}', '[]', 0.95, 1, ?, ?, ?)
                    """,
                    (opportunity_id, output.model_dump_json(), "oge@plaksha.edu.in", draft_ts, draft_ts),
                )
                draft_id = int(cursor.lastrowid)
                conn.commit()

            admin = self.session_for("oge@plaksha.edu.in")
            resp = admin_publish_workflow_draft(draft_id, session=admin)
            self.assertIn("graph_version_id", resp)

            with db_conn() as conn:
                field_rows = conn.execute(
                    """
                    SELECT field_key
                    FROM opportunity_required_fields
                    WHERE opportunity_id = ?
                    ORDER BY display_order ASC
                    """,
                    (opportunity_id,),
                ).fetchall()
                visibility_rows = conn.execute(
                    """
                    SELECT rule_type, rule_value
                    FROM opportunity_visibility_rules
                    WHERE opportunity_id = ?
                    ORDER BY rule_value ASC
                    """,
                    (opportunity_id,),
                ).fetchall()
        finally:
            try:
                admin_delete_opportunity(opportunity_id, session=self.session_for("oge@plaksha.edu.in"))
            except HTTPException as exc:
                if exc.status_code != 404:
                    raise

        self.assertEqual([row["field_key"] for row in field_rows], ["full_name", "email"])
        self.assertEqual(
            [(row["rule_type"], row["rule_value"]) for row in visibility_rows],
            [("GROUP_EMAIL", "ug2025@plaksha.edu.in")],
        )

    def test_sla_notifications_endpoint_returns_summary(self):
        """Chunk C: the SLA notifications endpoint returns the expected keys."""
        admin = self.session_for("oge@plaksha.edu.in")
        result = get_sla_notifications(session=admin)
        self.assertIn("approaching", result)
        self.assertIn("breached", result)
        self.assertIn("items", result)
        self.assertIsInstance(result["approaching"], int)
        self.assertIsInstance(result["breached"], int)
        self.assertIsInstance(result["items"], list)

    def test_graph_workflow_progression_via_legacy_endpoints(self):
        """Verify that legacy approve/reject/request_changes endpoints
        correctly advance graph-backed applications through the graph."""
        # ── Publish a graph-backed opportunity with 3 stages ──
        output = AIWorkflowDraftOutput(
            opportunity=OpportunityDraftModel(
                title="Graph Workflow Progression Test",
                description="Test that decisions propagate through the graph.",
                host_institution="Test University",
            ),
            graph=GraphModel(
                nodes=[
                    GraphNodeModel(node_key="start", node_type="start", display_name="Start"),
                    GraphNodeModel(
                        node_key="step_a",
                        node_type="reviewer",
                        display_name="Step A",
                        reviewer_email="oge@plaksha.edu.in",
                        allowed_actions=["approve", "request_changes", "reject"],
                    ),
                    GraphNodeModel(
                        node_key="step_b",
                        node_type="reviewer",
                        display_name="Step B",
                        reviewer_email="student-life@plaksha.edu.in",
                        allowed_actions=["approve", "reject"],
                    ),
                    GraphNodeModel(node_key="end", node_type="end", display_name="End"),
                ],
                edges=[
                    GraphEdgeModel(from_node_key="start", to_node_key="step_a"),
                    GraphEdgeModel(from_node_key="step_a", to_node_key="step_b"),
                    GraphEdgeModel(from_node_key="step_b", to_node_key="end"),
                ],
            ),
            applicant_form_fields=[],
            generator_visibility_rules=["ug2024@plaksha.edu.in"],
            clarifying_questions=[],
            confidence=0.9,
            warnings=[],
            is_fallback=False,
        )
        ts = datetime.now(timezone.utc).isoformat()
        admin = self.session_for("oge@plaksha.edu.in")
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

        resp = admin_publish_workflow_draft(draft_id, session=admin)
        gv_id = resp["graph_version_id"]

        # Find the created opportunity; draft publishing should make it visible to Rohan via UG 2024.
        with db_conn() as conn:
            draft = conn.execute("SELECT opportunity_id FROM workflow_drafts WHERE id = ?", (draft_id,)).fetchone()
            opportunity_id = draft["opportunity_id"]
            visibility = conn.execute(
                "SELECT rule_value FROM opportunity_visibility_rules WHERE opportunity_id = ?",
                (opportunity_id,),
            ).fetchall()
        self.assertIn("ug2024@plaksha.edu.in", [row["rule_value"] for row in visibility])

        # ── Submit an application as Rohan ──
        student = self.session_for("rohan@plaksha.edu.in")
        app_resp = create_application(
            ApplicationCreateBody(opportunityId=opportunity_id, formData={}),
            session=student,
        )
        app_id = app_resp["application"]["id"]

        # Verify the graph task was created and is active at step_a
        with db_conn() as conn:
            tasks = conn.execute(
                "SELECT * FROM application_workflow_tasks WHERE application_id = ? ORDER BY id",
                (app_id,),
            ).fetchall()
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0]["node_key"], "step_a")
        self.assertEqual(tasks[0]["status"], "active")

        # ── Approve at Step A via legacy endpoint ──
        reviewer_a = self.session_for("oge@plaksha.edu.in")
        approve_resp = approve_application(
            app_id,
            DecisionBody(remarks="Looks good at Step A"),
            session=reviewer_a,
        )
        app_data = approve_resp["application"]
        self.assertEqual(app_data["current_stage_label"], "Step B")
        self.assertIsNone(app_data["final_status"])

        # Verify graph tasks: step_a completed, step_b active
        with db_conn() as conn:
            tasks = conn.execute(
                "SELECT * FROM application_workflow_tasks WHERE application_id = ? ORDER BY id",
                (app_id,),
            ).fetchall()
        self.assertEqual(len(tasks), 2)
        task_a = next(t for t in tasks if t["node_key"] == "step_a")
        task_b = next(t for t in tasks if t["node_key"] == "step_b")
        self.assertEqual(task_a["status"], "completed")
        self.assertEqual(task_a["decision"], "approve")
        self.assertEqual(task_b["status"], "active")

        # ── Approve at Step B → application should be APPROVED ──
        reviewer_b = self.session_for("student-life@plaksha.edu.in")
        approve_resp2 = approve_application(
            app_id,
            DecisionBody(remarks="All clear at Step B"),
            session=reviewer_b,
        )
        app_data2 = approve_resp2["application"]
        self.assertEqual(app_data2["final_status"], "APPROVED")

        # ── Now test request_changes → student_response flow ──
        # Create a second application to test rework.
        app_resp2 = create_application(
            ApplicationCreateBody(opportunityId=opportunity_id, formData={}),
            session=student,
        )
        app_id2 = app_resp2["application"]["id"]

        # Request changes at Step A → should go to Student Rework
        rc_resp = request_changes(
            app_id2,
            DecisionBody(remarks="Please fix your SOP"),
            session=reviewer_a,
        )
        self.assertEqual(rc_resp["application"]["current_stage_label"], "Student Rework")

        with db_conn() as conn:
            task = conn.execute(
                "SELECT * FROM application_workflow_tasks WHERE application_id = ? AND node_key = 'step_a'",
                (app_id2,),
            ).fetchone()
        self.assertEqual(task["status"], "returned")

        # Student responds → should reactivate back to Step A
        sr_resp = submit_student_response(
            app_id2,
            StudentResponseBody(text="I have fixed my SOP."),
            session=student,
        )
        self.assertEqual(sr_resp["application"]["current_stage_label"], "Step A")

        with db_conn() as conn:
            task = conn.execute(
                "SELECT * FROM application_workflow_tasks WHERE application_id = ? AND node_key = 'step_a'",
                (app_id2,),
            ).fetchone()
        self.assertEqual(task["status"], "active")

        # ── Test reject via legacy endpoint ──
        # Create a third application
        app_resp3 = create_application(
            ApplicationCreateBody(opportunityId=opportunity_id, formData={}),
            session=student,
        )
        app_id3 = app_resp3["application"]["id"]

        reject_resp = reject_application(
            app_id3,
            DecisionBody(reason="Does not meet requirements"),
            session=reviewer_a,
        )
        self.assertEqual(reject_resp["application"]["final_status"], "REJECTED")

        with db_conn() as conn:
            task = conn.execute(
                "SELECT * FROM application_workflow_tasks WHERE application_id = ? AND node_key = 'step_a'",
                (app_id3,),
            ).fetchone()
        self.assertEqual(task["status"], "completed")
        self.assertEqual(task["decision"], "reject")


class GoldenPathTests(unittest.TestCase):
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

    def _active_task_keys(self, application_id: int) -> list[str]:
        with db_conn() as conn:
            rows = conn.execute(
                """
                SELECT node_key
                FROM application_workflow_tasks
                WHERE application_id = ? AND status = 'active'
                ORDER BY node_key ASC
                """,
                (application_id,),
            ).fetchall()
        return [row["node_key"] for row in rows]

    def _task_keys(self, application_id: int) -> list[str]:
        with db_conn() as conn:
            rows = conn.execute(
                """
                SELECT node_key
                FROM application_workflow_tasks
                WHERE application_id = ?
                ORDER BY id ASC
                """,
                (application_id,),
            ).fetchall()
        return [row["node_key"] for row in rows]

    def _seed_standard_pathway_draft(self) -> int:
        output = AIWorkflowDraftOutput(
            opportunity=OpportunityDraftModel(
                title="Golden Path Standard Pathway Test",
                description="End-to-end test for the Plaksha standard approval pathway.",
                host_institution="Test Partner University",
                term="Fall 2026",
                destination="Singapore",
                deadline="2026-12-31",
                seats=5,
            ),
            graph=GraphModel(
                nodes=[
                    GraphNodeModel(
                        node_key="start",
                        node_type="start",
                        display_name="Application Submitted",
                        allowed_actions=[],
                    ),
                    GraphNodeModel(
                        node_key="oaa_review",
                        node_type="reviewer",
                        display_name="Office of Academic Affairs",
                        reviewer_email="oge@plaksha.edu.in",
                        allowed_actions=["approve", "request_changes", "comment"],
                        metadata={
                            "sla_hours": 72,
                            "required_inputs": [
                                {
                                    "input_key": "backlog_status",
                                    "label": "Backlog / Misconduct Status",
                                    "input_type": "select",
                                    "options": ["Clear", "Active backlog", "Misconduct"],
                                    "required": True,
                                }
                            ],
                        },
                    ),
                    GraphNodeModel(
                        node_key="ug_academics_review",
                        node_type="reviewer",
                        display_name="UG Academics",
                        reviewer_email="prof.a@plaksha.edu.in",
                        allowed_actions=["approve", "request_changes", "comment"],
                        metadata={
                            "sla_hours": 72,
                            "required_inputs": [
                                {
                                    "input_key": "cgpa_verified",
                                    "label": "CGPA Verified",
                                    "input_type": "select",
                                    "options": ["Meets requirement", "Below minimum", "Cannot verify"],
                                    "required": True,
                                }
                            ],
                        },
                    ),
                    GraphNodeModel(
                        node_key="parallel_join",
                        node_type="join_all",
                        display_name="OAA + UG Academics Complete",
                        allowed_actions=[],
                    ),
                    GraphNodeModel(
                        node_key="program_chair_review",
                        node_type="reviewer",
                        display_name="Freshmore Coordinator / Program Chair",
                        reviewer_email="program-chair@plaksha.edu.in",
                        allowed_actions=["approve", "request_changes", "comment"],
                        metadata={
                            "sla_hours": 72,
                            "required_inputs": [
                                {
                                    "input_key": "coursework_alignment",
                                    "label": "Coursework Alignment with Partner Programme",
                                    "input_type": "select",
                                    "options": ["Strong", "Adequate", "Weak", "No alignment"],
                                    "required": True,
                                }
                            ],
                        },
                    ),
                    GraphNodeModel(
                        node_key="dean_approval",
                        node_type="reviewer",
                        display_name="Dean - Final Approval",
                        reviewer_email="dean@plaksha.edu.in",
                        allowed_actions=["approve", "reject", "comment"],
                        metadata={
                            "sla_hours": 72,
                            "required_inputs": [
                                {
                                    "input_key": "dean_decision",
                                    "label": "Final Decision",
                                    "input_type": "select",
                                    "options": ["Approved for nomination", "Rejected"],
                                    "required": True,
                                }
                            ],
                        },
                    ),
                    GraphNodeModel(
                        node_key="end",
                        node_type="end",
                        display_name="Nomination Complete",
                        allowed_actions=[],
                    ),
                ],
                edges=[
                    GraphEdgeModel(from_node_key="start", to_node_key="oaa_review"),
                    GraphEdgeModel(from_node_key="start", to_node_key="ug_academics_review"),
                    GraphEdgeModel(from_node_key="oaa_review", to_node_key="parallel_join"),
                    GraphEdgeModel(from_node_key="ug_academics_review", to_node_key="parallel_join"),
                    GraphEdgeModel(from_node_key="parallel_join", to_node_key="program_chair_review"),
                    GraphEdgeModel(from_node_key="program_chair_review", to_node_key="dean_approval"),
                    GraphEdgeModel(from_node_key="dean_approval", to_node_key="end"),
                ],
            ),
            applicant_form_fields=["full_name", "student_id", "email", "cgpa", "statement_of_purpose"],
            generator_visibility_rules=["ug2024@plaksha.edu.in"],
            clarifying_questions=[],
            confidence=0.95,
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
                VALUES (NULL, 'ready', ?, '[]', '{}', '[]', 0.95, 1, ?, ?, ?)
                """,
                (output.model_dump_json(), "oge@plaksha.edu.in", ts, ts),
            )
            draft_id = int(cursor.lastrowid)
            conn.commit()
        return draft_id

    def test_standard_pathway_golden_path_approval(self):
        draft_id = self._seed_standard_pathway_draft()
        admin = self.session_for("oge@plaksha.edu.in")
        published = admin_publish_workflow_draft(draft_id, session=admin)
        self.assertIn("graph_version_id", published)

        with db_conn() as conn:
            draft = conn.execute("SELECT opportunity_id FROM workflow_drafts WHERE id = ?", (draft_id,)).fetchone()
            opportunity_id = int(draft["opportunity_id"])

        try:
            with db_conn() as conn:
                field_rows = conn.execute(
                    """
                    SELECT field_key
                    FROM opportunity_required_fields
                    WHERE opportunity_id = ?
                    ORDER BY display_order ASC
                    """,
                    (opportunity_id,),
                ).fetchall()
                visibility_rows = conn.execute(
                    """
                    SELECT rule_type, rule_value
                    FROM opportunity_visibility_rules
                    WHERE opportunity_id = ?
                    ORDER BY id ASC
                    """,
                    (opportunity_id,),
                ).fetchall()

            field_keys = [row["field_key"] for row in field_rows]
            self.assertGreaterEqual(len(visibility_rows), 1)
            self.assertIn("cgpa", field_keys)
            self.assertIn("statement_of_purpose", field_keys)

            student = self.session_for("rohan@plaksha.edu.in")
            app_resp = create_application(
                ApplicationCreateBody(
                    opportunityId=opportunity_id,
                    submittedData={
                        "full_name": "Rohan",
                        "student_id": "PL-2022-ROH",
                        "email": "rohan@plaksha.edu.in",
                        "cgpa": "8.5",
                        "statement_of_purpose": "I want to represent Plaksha well abroad.",
                    },
                ),
                session=student,
            )
            application_id = int(app_resp["application"]["id"])

            self.assertEqual(
                self._active_task_keys(application_id),
                ["oaa_review", "ug_academics_review"],
            )

            approve_application(
                application_id,
                DecisionBody(
                    remarks="OAA clear.",
                    requiredInputs={"backlog_status": "Clear"},
                ),
                session=admin,
            )
            self.assertNotIn("program_chair_review", self._task_keys(application_id))

            approve_application(
                application_id,
                DecisionBody(
                    remarks="UG Academics clear.",
                    requiredInputs={"cgpa_verified": "Meets requirement"},
                ),
                session=self.session_for("prof.a@plaksha.edu.in"),
            )
            self.assertEqual(self._active_task_keys(application_id), ["program_chair_review"])

            approve_application(
                application_id,
                DecisionBody(
                    remarks="Program chair recommends approval.",
                    requiredInputs={"coursework_alignment": "Strong"},
                ),
                session=self.session_for("program-chair@plaksha.edu.in"),
            )
            self.assertEqual(self._active_task_keys(application_id), ["dean_approval"])

            final = approve_application(
                application_id,
                DecisionBody(
                    remarks="Dean approves nomination.",
                    requiredInputs={"dean_decision": "Approved for nomination"},
                ),
                session=self.session_for("dean@plaksha.edu.in"),
            )
            self.assertEqual(final["application"]["final_status"], "APPROVED")
        finally:
            try:
                admin_delete_opportunity(opportunity_id, session=admin)
            except HTTPException as exc:
                if exc.status_code != 404:
                    raise


if __name__ == "__main__":
    unittest.main()
