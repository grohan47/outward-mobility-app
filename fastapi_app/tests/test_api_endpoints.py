import unittest
from datetime import datetime, timezone

from fastapi import HTTPException, Response

from fastapi_app.main import (
    ADMIN_ROLE,
    ApplicationCreateBody,
    CommentCreateBody,
    CustomFormFieldPayload,
    DecisionBody,
    LoginBody,
    OpportunityCreatePayload,
    OpportunityPatchBody,
    SessionUser,
    StudentResponseBody,
    WorkflowRequiredInput,
    WorkflowStepPayload,
    admin_applications,
    admin_create_opportunity,
    admin_delete_opportunity,
    admin_get_opportunity,
    admin_list_opportunities,
    admin_patch_application,
    admin_patch_opportunity,
    admin_summary,
    admin_visibility_audit,
    admin_visibility_audit_single,
    app,
    application_detail,
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
    list_applications,
    list_opportunities,
    my_applications,
    opportunity_detail,
    post_comment,
    reject_application,
    request_changes,
    reviewer_inbox,
    submit_student_response,
    users_me,
    AdminApplicationPatchBody,
)


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
            ("GET", "/api/admin/opportunities"),
            ("GET", "/api/admin/opportunities/{opportunity_id}"),
            ("GET", "/api/admin/visibility-audit"),
            ("GET", "/api/admin/opportunities/{opportunity_id}/visibility-audit"),
            ("POST", "/api/admin/opportunities"),
            ("PATCH", "/api/admin/opportunities/{opportunity_id}"),
            ("DELETE", "/api/admin/opportunities/{opportunity_id}"),
            ("POST", "/api/applications"),
            ("DELETE", "/api/applications/{application_id}"),
            ("GET", "/api/applications"),
            ("GET", "/api/applications/{application_id}"),
            ("POST", "/api/applications/{application_id}/approve"),
            ("POST", "/api/applications/{application_id}/request-changes"),
            ("POST", "/api/applications/{application_id}/student-response"),
            ("POST", "/api/applications/{application_id}/reject"),
            ("GET", "/api/applications/{application_id}/comments"),
            ("POST", "/api/applications/{application_id}/comments"),
            ("GET", "/api/my/applications"),
            ("GET", "/api/reviewer/inbox"),
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
        self.assertEqual(login["user"]["role"], ADMIN_ROLE)
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
        finally:
            delete_result = admin_delete_opportunity(opportunity_id, session=admin_session)
            self.assertTrue(delete_result.get("ok"))

        with self.assertRaises(HTTPException) as deleted_lookup:
            admin_get_opportunity(opportunity_id, session=admin_session)
        self.assertEqual(deleted_lookup.exception.status_code, 404)

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
            self.assertEqual(vc_comments.get("comments"), [])

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


if __name__ == "__main__":
    unittest.main()
