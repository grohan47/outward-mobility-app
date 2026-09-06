"""Disposable development fixtures. Only invoked by the database CLI/tests."""

import json
from fastapi_app.main import now_iso, STUDENT_ROLE, REVIEWER_ROLE, ADMIN_ROLE
from fastapi_app.opportunity_details import replace_detail_fields, summary_source_hash


def seed_data(conn: sqlite3.Connection) -> None:
    now = now_iso()

    role_rows = [
        (STUDENT_ROLE, "Student"),
        (REVIEWER_ROLE, "Reviewer"),
        (ADMIN_ROLE, "Administrator"),
    ]
    for code, display_name in role_rows:
        conn.execute(
            "INSERT OR IGNORE INTO roles (code, display_name) VALUES (?, ?)",
            (code, display_name),
        )

    user_rows = [
        (1, "rohan@plaksha.edu.in", "Rohan", 1),
        (2, "siddharth@plaksha.edu.in", "Siddharth", 1),
        (3, "john.doe@plaksha.edu.in", "John Doe", 1),
        (4, "jane.roe@plaksha.edu.in", "Jane Roe", 1),
        (5, "prof.a@plaksha.edu.in", "Prof A", 1),
        (6, "prof.b@plaksha.edu.in", "Prof B", 1),
        (11, "student-life@plaksha.edu.in", "Ananya Iyer", 1),
        (12, "program-chair@plaksha.edu.in", "Prof. Rajesh Gupta", 1),
        (13, "oge@plaksha.edu.in", "Rajesh Kumar", 1),
        (14, "dean@plaksha.edu.in", "Dr. Sarah Jenkins", 1),
        (15, "vc@plaksha.edu.in", "Vice Chancellor", 1),
        (16, "oaa@plaksha.edu.in", "Office of Academic Affairs", 1),
        (17, "ug-academics@plaksha.edu.in", "UG Academics", 1),
        (18, "shashikant.pawar@plaksha.edu.in", "Prof. Shashikant Pawar", 1),
    ]
    for user in user_rows:
        conn.execute(
            "INSERT OR IGNORE INTO users (id, email, full_name, is_active, created_at) VALUES (?, ?, ?, ?, ?)",
            (*user, now),
        )

    role_assignments = [
        ("rohan@plaksha.edu.in", STUDENT_ROLE),
        ("siddharth@plaksha.edu.in", STUDENT_ROLE),
        ("siddharth@plaksha.edu.in", REVIEWER_ROLE),
        ("john.doe@plaksha.edu.in", STUDENT_ROLE),
        ("jane.roe@plaksha.edu.in", STUDENT_ROLE),
        ("prof.a@plaksha.edu.in", REVIEWER_ROLE),
        ("prof.b@plaksha.edu.in", REVIEWER_ROLE),
        ("student-life@plaksha.edu.in", REVIEWER_ROLE),
        ("program-chair@plaksha.edu.in", REVIEWER_ROLE),
        ("dean@plaksha.edu.in", REVIEWER_ROLE),
        ("vc@plaksha.edu.in", REVIEWER_ROLE),
        ("oge@plaksha.edu.in", REVIEWER_ROLE),
        ("oge@plaksha.edu.in", ADMIN_ROLE),
        ("oaa@plaksha.edu.in", REVIEWER_ROLE),
        ("ug-academics@plaksha.edu.in", REVIEWER_ROLE),
        ("shashikant.pawar@plaksha.edu.in", REVIEWER_ROLE),
    ]
    for email, role_code in role_assignments:
        user = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        role = conn.execute(
            "SELECT id FROM roles WHERE code = ?", (role_code,)
        ).fetchone()
        if user and role:
            conn.execute(
                "INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, ?)",
                (user["id"], role["id"], now),
            )

    profile_rows = [
        (1, 1, "PL-2022-ROH", "Computer Science", 8.5),
        (2, 2, "PL-2022-SID", "Electronics Engineering", 9.2),
    ]
    for profile in profile_rows:
        conn.execute(
            """
            INSERT OR IGNORE INTO student_profiles (id, user_id, student_id, program, official_cgpa, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (*profile, now),
        )

    form_fields = [
        (
            "full_name",
            "Full Name",
            "Enter the applicant's legal full name.",
            "Use your passport/legal record name.",
            "text",
            None,
            "personal",
        ),
        (
            "student_id",
            "Student ID",
            "Enter the institutional student ID.",
            "Format: PL-YYYY-XXX",
            "text",
            None,
            "personal",
        ),
        (
            "email",
            "Email Address",
            "Enter the applicant's official email address.",
            "Prefer your Plaksha email.",
            "email",
            None,
            "personal",
        ),
        (
            "phone",
            "Phone Number",
            "Enter a reachable phone number.",
            "Include country code.",
            "text",
            None,
            "personal",
        ),
        (
            "program",
            "Academic Program",
            "Enter the current academic program or department.",
            "Example: BTech CSE",
            "text",
            None,
            "academic",
        ),
        (
            "cgpa",
            "Current CGPA",
            "Enter the latest approved CGPA/GPA.",
            "Use official transcript value.",
            "number",
            None,
            "academic",
        ),
        (
            "passport_number",
            "Passport Number",
            "Enter passport number if travel documentation is required.",
            "Type NA if unavailable.",
            "text",
            None,
            "documents",
        ),
        (
            "statement_of_purpose",
            "Statement of Purpose",
            "Provide a short motivation statement.",
            "Explain goals and fit in 200-400 words.",
            "textarea",
            None,
            "documents",
        ),
        (
            "language_score",
            "Language Score (IELTS/TOEFL)",
            "Enter the latest validated language test score.",
            "Numeric value only.",
            "number",
            None,
            "academic",
        ),
        (
            "prior_exchange_experience",
            "Prior Exchange Experience",
            "List prior exchange or mobility participation, if any.",
            "Mention location, duration, and outcome.",
            "text",
            None,
            "experience",
        ),
        (
            "disciplinary_history",
            "Declared Disciplinary History",
            "Declare relevant disciplinary history or write none.",
            "Be transparent and concise.",
            "text",
            None,
            "compliance",
        ),
        (
            "transcript_upload",
            "Transcript Upload",
            "Add the transcript file link or document reference.",
            "Paste drive/share link.",
            "file",
            None,
            "documents",
        ),
        (
            "recommendation_upload",
            "Recommendation Upload",
            "Add recommendation letter file link or document reference.",
            "Paste drive/share link.",
            "file",
            None,
            "documents",
        ),
        (
            "resume_upload",
            "Resume Upload",
            "Add the resume/CV file link or document reference.",
            "Paste drive/share link.",
            "file",
            None,
            "documents",
        ),
        (
            "custom_funding_plan",
            "Funding Plan",
            "Explain how you will fund the exchange, including any scholarships applied for.",
            "Mention scholarship, self-funding, or department support.",
            "textarea",
            None,
            "documents",
        ),
        (
            "custom_research_focus",
            "Research Focus Area",
            "Describe your primary research interest or project focus for this opportunity.",
            "Be specific — mention lab, topic, or faculty if applicable.",
            "textarea",
            None,
            "documents",
        ),
    ]
    for row in form_fields:
        conn.execute(
            """
            INSERT OR IGNORE INTO form_field_catalog (field_key, label, description, field_hint, input_type, options_json, section_key, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            """,
            row,
        )

    # ── NTU Singapore AI & Robotics Exchange (graph-backed, matches demo_fixture.json) ──
    conn.execute(
        """
        INSERT OR IGNORE INTO opportunities (
          id, code, title, description, cover_image_url, term, destination, deadline, seats, status, ai_summary_json, ai_summary_source_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            1,
            "NTU-AIR-SU2026",
            "Summer 2026 AI & Robotics Research Exchange — NTU Singapore",
            "Five-seat summer research exchange at Nanyang Technological University Singapore. "
            "Students join NTU's AI and Robotics labs for two months, working alongside PhD researchers. "
            "Covers programme fee; students fund travel and accommodation. Need-based travel grants available.",
            "https://images.unsplash.com/photo-1546412414-8035e1776c9a",
            "Summer 2026 (July 1 – August 31)",
            "Singapore, NTU",
            "2027-06-15",
            5,
            "published",
            json.dumps(
                [
                    "5-seat research exchange at NTU Singapore, July–August 2026.",
                    "Open to UG 2023 batch only. Minimum CGPA 7.5, no active backlogs.",
                    "Programme fee (SGD 1,200) covered by Plaksha. Travel grants available.",
                    "Application deadline: June 15, 2027. Nomination due to NTU: June 20.",
                    "Standard 4-stage Plaksha approval: OAA + UG Academics → Program Chair → Dean.",
                ]
            ),
            None,
            now,
            now,
        ),
    )

    seed_detail_fields = {
        1: [
            {
                "field_key": "destination",
                "label": "Destination",
                "value": "Singapore, NTU",
                "value_type": "text",
                "display_order": 1,
                "is_student_visible": 1,
            },
            {
                "field_key": "term",
                "label": "Programme Term",
                "value": "July 1 – Aug 31 2026",
                "value_type": "text",
                "display_order": 2,
                "is_student_visible": 1,
            },
            {
                "field_key": "application_deadline",
                "label": "Application Deadline",
                "value": "2027-06-15",
                "value_type": "date",
                "display_order": 3,
                "is_student_visible": 1,
            },
            {
                "field_key": "seats",
                "label": "Seats Available",
                "value": "5",
                "value_type": "number",
                "display_order": 4,
                "is_student_visible": 1,
            },
            {
                "field_key": "min_cgpa",
                "label": "Minimum CGPA",
                "value": "7.5",
                "value_type": "number",
                "display_order": 5,
                "is_student_visible": 1,
            },
            {
                "field_key": "programme_fee",
                "label": "Programme Fee",
                "value": "SGD 1,200 (covered by Plaksha)",
                "value_type": "text",
                "display_order": 6,
                "is_student_visible": 1,
            },
            {
                "field_key": "estimated_cost",
                "label": "Est. Personal Cost",
                "value": "~SGD 1,800/month (travel + accommodation)",
                "value_type": "text",
                "display_order": 7,
                "is_student_visible": 1,
            },
            {
                "field_key": "eligible_batch",
                "label": "Eligible Batch",
                "value": "UG 2023 only",
                "value_type": "text",
                "display_order": 8,
                "is_student_visible": 1,
            },
            {
                "field_key": "host_contact",
                "label": "NTU Partner Contact",
                "value": "partners@ntu.edu.sg",
                "value_type": "text",
                "display_order": 9,
                "is_student_visible": 0,
            },
        ],
    }
    for opportunity_id, fields in seed_detail_fields.items():
        replace_detail_fields(conn, opportunity_id, fields, now)
        opp = conn.execute(
            "SELECT * FROM opportunities WHERE id = ?", (opportunity_id,)
        ).fetchone()
        if opp:
            conn.execute(
                "UPDATE opportunities SET ai_summary_source_hash = ? WHERE id = ?",
                (summary_source_hash(dict(opp), fields), opportunity_id),
            )

    conn.execute(
        """
        UPDATE email_groups
        SET email_address = 'ug.2024@plaksha.edu.in',
            display_name = 'UG 2024 Cohort'
        WHERE id = 1
          AND LOWER(email_address) = 'ug2024@plaksha.edu.in'
          AND NOT EXISTS (
              SELECT 1 FROM email_groups WHERE LOWER(email_address) = 'ug.2024@plaksha.edu.in'
          )
        """
    )
    conn.execute(
        """
        UPDATE opportunity_visibility_rules
        SET rule_value = 'ug.2024@plaksha.edu.in'
        WHERE LOWER(rule_value) = 'ug2024@plaksha.edu.in'
        """
    )

    email_groups = [
        (1, "ug.2024@plaksha.edu.in", "UG 2024 Cohort"),
        (2, "professors@plaksha.edu.in", "All Professors"),
        (3, "ug.2022@plaksha.edu.in", "UG 2022 Cohort"),
        (4, "ug.2023@plaksha.edu.in", "UG 2023 Cohort"),
        (5, "ug.2025@plaksha.edu.in", "UG 2025 Cohort"),
        (6, "ug2024@plaksha.edu.in", "UG 2024 Cohort (legacy alias)"),
    ]
    for group_id, email_address, display_name in email_groups:
        conn.execute(
            """
            INSERT OR IGNORE INTO email_groups (id, email_address, display_name, is_active, created_at)
            VALUES (?, ?, ?, 1, ?)
            """,
            (group_id, email_address, display_name, now),
        )

    email_group_memberships = [
        (1, 1),
        (1, 2),
        (1, 3),
        (2, 5),
        (2, 6),
        (3, 1),
        (3, 2),
        (6, 1),
        (6, 2),
        (6, 3),
    ]
    for group_id, user_id in email_group_memberships:
        conn.execute(
            """
            INSERT OR IGNORE INTO email_group_memberships (group_id, user_id, created_at)
            VALUES (?, ?, ?)
            """,
            (group_id, user_id, now),
        )

    visibility_rules = [
        (1, "GROUP_EMAIL", "ug.2024@plaksha.edu.in"),
        (1, "EMAIL", "john.doe@plaksha.edu.in"),
    ]
    for opportunity_id, rule_type, rule_value in visibility_rules:
        conn.execute(
            """
            INSERT OR IGNORE INTO opportunity_visibility_rules (opportunity_id, rule_type, rule_value, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (opportunity_id, rule_type, rule_value, now),
        )

    required_fields_by_opp = {
        1: [
            "full_name",
            "student_id",
            "email",
            "cgpa",
            "statement_of_purpose",
            "resume_upload",
        ],
    }
    for opp_id, fields in required_fields_by_opp.items():
        for order, field_key in enumerate(fields, start=1):
            conn.execute(
                """
                INSERT OR IGNORE INTO opportunity_required_fields (opportunity_id, field_key, display_order)
                VALUES (?, ?, ?)
                """,
                (opp_id, field_key, order),
            )

    # ── Graph version for NTU Singapore (matches demo_fixture.json) ──
    gv_cursor = conn.execute(
        """
        INSERT OR IGNORE INTO graph_versions (opportunity_id, version, status, created_by_email, created_at)
        VALUES (1, 1, 'active', 'oge@plaksha.edu.in', ?)
        """,
        (now,),
    )
    gv_id = int(
        gv_cursor.lastrowid
        or conn.execute(
            "SELECT id FROM graph_versions WHERE opportunity_id = 1 LIMIT 1"
        ).fetchone()["id"]
    )

    backlog_input = json.dumps(
        {
            "sla_hours": 72,
            "required_inputs": [
                {
                    "input_key": "backlog_status",
                    "label": "Backlog / Misconduct Status",
                    "input_type": "select",
                    "options": [
                        "Clear — no active backlogs or misconduct",
                        "Active backlog — details in remarks",
                        "Misconduct record — details in remarks",
                    ],
                    "required": True,
                }
            ],
        }
    )
    cgpa_input = json.dumps(
        {
            "sla_hours": 72,
            "required_inputs": [
                {
                    "input_key": "cgpa_verified",
                    "label": "CGPA Verification",
                    "input_type": "select",
                    "options": [
                        "Verified ≥ 7.5 — meets requirement",
                        "Below 7.5 — does not meet minimum",
                        "Cannot verify at this time",
                    ],
                    "required": True,
                }
            ],
        }
    )
    chair_input = json.dumps(
        {
            "sla_hours": 72,
            "required_inputs": [
                {
                    "input_key": "coursework_alignment",
                    "label": "Coursework Alignment with NTU AI/Robotics Programme",
                    "input_type": "select",
                    "options": [
                        "Strong alignment — student's coursework directly relevant",
                        "Adequate alignment — conditional approval",
                        "Weak alignment — details in remarks",
                        "No alignment — recommend rejection",
                    ],
                    "required": True,
                }
            ],
        }
    )
    dean_input = json.dumps(
        {
            "sla_hours": 72,
            "required_inputs": [
                {
                    "input_key": "dean_decision",
                    "label": "Final Nomination Decision",
                    "input_type": "select",
                    "options": [
                        "Approved — submit to NTU",
                        "Rejected — details in remarks",
                    ],
                    "required": True,
                }
            ],
        }
    )

    graph_nodes = [
        ("start", "start", "Application Submitted", None, '["all"]', "[]", "{}"),
        (
            "oaa_review",
            "reviewer",
            "Office of Academic Affairs",
            "oaa@plaksha.edu.in",
            '["all"]',
            '["approve","request_changes","comment"]',
            backlog_input,
        ),
        (
            "ug_academics_review",
            "reviewer",
            "UG Academics (CGPA ≥ 7.5)",
            "ug-academics@plaksha.edu.in",
            '["all"]',
            '["approve","request_changes","comment"]',
            cgpa_input,
        ),
        (
            "parallel_join",
            "join_all",
            "OAA + UG Academics Complete",
            None,
            '["all"]',
            "[]",
            "{}",
        ),
        (
            "program_chair_review",
            "reviewer",
            "Freshmore Coordinator (Prof. S. Pawar)",
            "shashikant.pawar@plaksha.edu.in",
            '["all"]',
            '["approve","request_changes","comment"]',
            chair_input,
        ),
        (
            "dean_approval",
            "reviewer",
            "Dean — Final Approval",
            "dean@plaksha.edu.in",
            '["all"]',
            '["approve","reject","comment"]',
            dean_input,
        ),
        ("end", "end", "Nominated — Submitted to NTU", None, '["all"]', "[]", "{}"),
    ]
    for (
        node_key,
        node_type,
        display_name,
        reviewer_email,
        visible_sections,
        allowed_actions,
        metadata,
    ) in graph_nodes:
        conn.execute(
            """
            INSERT OR IGNORE INTO graph_nodes (graph_version_id, node_key, node_type, display_name, reviewer_email, visible_sections, allowed_actions, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                gv_id,
                node_key,
                node_type,
                display_name,
                reviewer_email,
                visible_sections,
                allowed_actions,
                metadata,
            ),
        )

    graph_edges = [
        ("start", "oaa_review"),
        ("start", "ug_academics_review"),
        ("oaa_review", "parallel_join"),
        ("ug_academics_review", "parallel_join"),
        ("parallel_join", "program_chair_review"),
        ("program_chair_review", "dean_approval"),
        ("dean_approval", "end"),
    ]
    for from_key, to_key in graph_edges:
        conn.execute(
            """
            INSERT OR IGNORE INTO graph_edges (graph_version_id, from_node_key, to_node_key)
            VALUES (?, ?, ?)
            """,
            (gv_id, from_key, to_key),
        )

    # ── Sample application: Rohan applying to NTU Singapore ──
    submitted_rohan_ntu = {
        "full_name": "Rohan",
        "student_id": "PL-2022-ROH",
        "email": "rohan@plaksha.edu.in",
        "cgpa": 8.5,
        "statement_of_purpose": "I am deeply interested in AI and robotics research. NTU's labs offer the perfect environment to apply my coursework in real-world research projects alongside leading PhD students.",
        "resume_upload": "https://drive.google.com/file/rohan_resume",
    }
    conn.execute(
        """
        INSERT OR IGNORE INTO applications
        (id, student_profile_id, opportunity_id, current_step_order, current_stage_label,
         graph_version_id, final_status, submitted_data_json, submitted_at, created_at, updated_at)
        VALUES (1, 1, 1, 1, 'Office of Academic Affairs', ?, NULL, ?, ?, ?, ?)
        """,
        (gv_id, json.dumps(submitted_rohan_ntu), now, now, now),
    )
    # Parallel tasks: both OAA and UG Academics start simultaneously.
    conn.execute(
        """
        INSERT OR IGNORE INTO application_workflow_tasks
        (application_id, graph_version_id, node_key, assigned_reviewer_email, status, assigned_at)
        VALUES (1, ?, 'oaa_review', 'oaa@plaksha.edu.in', 'active', ?)
        """,
        (gv_id, now),
    )
    conn.execute(
        """
        INSERT OR IGNORE INTO application_workflow_tasks
        (application_id, graph_version_id, node_key, assigned_reviewer_email, status, assigned_at)
        VALUES (1, ?, 'ug_academics_review', 'ug-academics@plaksha.edu.in', 'active', ?)
        """,
        (gv_id, now),
    )
    conn.execute(
        """
        INSERT INTO timeline_events
        (application_id, event_type, event_payload_json, actor_email, created_at)
        VALUES (1, 'APPLICATION_CREATED', ?, ?, ?)
        """,
        (
            json.dumps({"current_stage": "Office of Academic Affairs"}),
            "rohan@plaksha.edu.in",
            now,
        ),
    )

    from fastapi_app.graph_execution import GraphExecutionService
    from fastapi_app.graph_models import GraphModel
    from fastapi_app.levels import compile_levels
    from fastapi_app.main import serialize_form_field

    form_schema = [
        serialize_form_field(row)
        for row in conn.execute(
            "SELECT f.* FROM opportunity_required_fields r JOIN form_field_catalog f ON f.field_key=r.field_key WHERE r.opportunity_id=1 ORDER BY r.display_order"
        )
    ]
    fields = [f["field_key"] for f in form_schema]
    levels = GraphExecutionService()._definition(conn, gv_id)
    for level in levels:
        for node in level["reviewers"]:
            if "all" in node["visible_sections"]:
                node["visible_sections"] = fields
    graph = GraphModel(levels=levels).model_dump()
    for node in graph["nodes"]:
        conn.execute(
            "UPDATE graph_nodes SET visible_sections=?,metadata=? WHERE graph_version_id=? AND node_key=?",
            (
                json.dumps(node["visible_sections"]),
                json.dumps(node["metadata"]),
                gv_id,
                node["node_key"],
            ),
        )
    definition = {
        "opportunity": dict(
            conn.execute("SELECT * FROM opportunities WHERE id=1").fetchone()
        ),
        "graph": graph,
        "form_schema": form_schema,
        "applicant_form_fields": fields,
    }
    conn.execute(
        "UPDATE graph_versions SET definition_json=? WHERE id=?",
        (json.dumps(definition), gv_id),
    )
    conn.commit()
