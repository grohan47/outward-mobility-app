from __future__ import annotations

import json
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal
from urllib.parse import quote, unquote

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_PATH = Path(__file__).resolve().parent.parent / "server" / "db" / "prism.sqlite"
SESSION_COOKIE = "prism_session"
PLAKSHA_DOMAIN = "@plaksha.edu.in"

CANONICAL_TABLES = {
    "users",
    "roles",
    "user_roles",
    "user_scope_roles",
    "student_profiles",
    "form_field_catalog",
    "opportunities",
    "email_groups",
    "email_group_memberships",
    "opportunity_visibility_rules",
    "opportunity_required_fields",
    "opportunity_pipeline_steps",
    "opportunity_step_field_access",
    "opportunity_step_required_inputs",
    "applications",
    "application_reviews",
    "application_comments",
    "timeline_events",
}

GENERATOR_ROLE = "GENERATOR"
REVIEWER_ROLE = "REVIEWER"
ADMIN_ROLE = "ADMIN"
REVIEWER_ROLES = {REVIEWER_ROLE}
# Backward naming alias for student-centric code paths.
STUDENT_ROLE = GENERATOR_ROLE
REQUIRED_INPUT_TYPES = {"text", "number", "dropdown", "multiselect"}


def dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        key = value.strip()
        if not key or key in seen:
            continue
        seen.add(key)
        output.append(key)
    return output


def slugify_input_key(label: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", label.strip().lower()).strip("_")
    return slug or "input"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def valid_plaksha_email(email: str) -> bool:
    return email.strip().lower().endswith(PLAKSHA_DOMAIN)


@contextmanager
def db_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()


def execute_script(conn: sqlite3.Connection, script: str) -> None:
    conn.executescript(script)


def list_tables(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()
    return {row["name"] for row in rows}


def table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {row["name"] for row in rows}


def schema_needs_reset(conn: sqlite3.Connection) -> bool:
    existing = list_tables(conn)
    if existing != CANONICAL_TABLES:
        return True

    required_columns: dict[str, set[str]] = {
        "opportunity_pipeline_steps": {"sla_hours", "can_view_comments"},
        "opportunity_step_required_inputs": {"options_json", "display_order"},
        "applications": {"return_to_step_order", "return_to_stage_label"},
    }
    for table, columns in required_columns.items():
        if not columns.issubset(table_columns(conn, table)):
            return True

    if "roles" in existing:
        role_rows = conn.execute("SELECT code FROM roles").fetchall()
        role_codes = {row["code"] for row in role_rows}
        expected_role_codes = {GENERATOR_ROLE, REVIEWER_ROLE, ADMIN_ROLE}
        if role_codes and (role_codes - expected_role_codes):
            return True

    fk_rows = conn.execute("PRAGMA foreign_key_list(opportunity_step_field_access)").fetchall()
    for row in fk_rows:
        if row["from"] == "field_key":
            return True
    return False


def reset_schema(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA foreign_keys = OFF")
    tables = list_tables(conn)
    for table in tables:
        conn.execute(f"DROP TABLE IF EXISTS {table}")

    execute_script(
        conn,
        """
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL
);

CREATE TABLE user_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE user_scope_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  scope_type TEXT NOT NULL CHECK(scope_type IN ('SYSTEM', 'OPPORTUNITY')),
  scope_id INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, role_id, scope_type, scope_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (scope_id) REFERENCES opportunities(id)
);

CREATE TABLE student_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  student_id TEXT NOT NULL UNIQUE,
  program TEXT NOT NULL,
  official_cgpa REAL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE form_field_catalog (
  field_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  input_type TEXT NOT NULL,
  section_key TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  term TEXT,
  destination TEXT,
  deadline TEXT,
  seats INTEGER,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE email_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_address TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE email_group_memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES email_groups(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE opportunity_visibility_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER NOT NULL,
  rule_type TEXT NOT NULL CHECK(rule_type IN ('EMAIL', 'GROUP_EMAIL')),
  rule_value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(opportunity_id, rule_type, rule_value),
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
);

CREATE TABLE opportunity_required_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER NOT NULL,
  field_key TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  UNIQUE(opportunity_id, field_key),
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
  FOREIGN KEY (field_key) REFERENCES form_field_catalog(field_key)
);

CREATE TABLE opportunity_pipeline_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER NOT NULL,
  step_order INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  reviewer_email TEXT NOT NULL,
  reviewer_display_name TEXT,
  sla_hours INTEGER NOT NULL DEFAULT 72,
  can_view_comments INTEGER NOT NULL DEFAULT 0,
  allowed_actions_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(opportunity_id, step_order),
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
);

CREATE TABLE opportunity_step_field_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pipeline_step_id INTEGER NOT NULL,
  field_key TEXT NOT NULL,
  UNIQUE(pipeline_step_id, field_key),
  FOREIGN KEY (pipeline_step_id) REFERENCES opportunity_pipeline_steps(id) ON DELETE CASCADE
);

CREATE TABLE opportunity_step_required_inputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pipeline_step_id INTEGER NOT NULL,
  input_key TEXT NOT NULL,
  input_label TEXT NOT NULL,
  input_type TEXT NOT NULL DEFAULT 'text',
  options_json TEXT,
  is_required INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (pipeline_step_id) REFERENCES opportunity_pipeline_steps(id) ON DELETE CASCADE
);

CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_profile_id INTEGER NOT NULL,
  opportunity_id INTEGER NOT NULL,
  current_step_order INTEGER NOT NULL,
  current_stage_label TEXT NOT NULL,
  return_to_step_order INTEGER,
  return_to_stage_label TEXT,
  final_status TEXT,
  submitted_data_json TEXT,
  submitted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (student_profile_id) REFERENCES student_profiles(id),
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id)
);

CREATE TABLE application_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  step_order INTEGER NOT NULL,
  reviewer_email TEXT NOT NULL,
  reviewer_role TEXT NOT NULL,
  decision TEXT NOT NULL,
  remarks TEXT,
  required_inputs_json TEXT,
  visibility_scope TEXT NOT NULL DEFAULT 'INTERNAL',
  created_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id)
);

CREATE TABLE application_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  author_email TEXT NOT NULL,
  text TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'internal',
  created_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id)
);

CREATE TABLE timeline_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_payload_json TEXT,
  actor_email TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id)
);
""",
    )
    conn.execute("PRAGMA foreign_keys = ON")


def seed_data(conn: sqlite3.Connection) -> None:
    now = now_iso()

    role_rows = [
        (GENERATOR_ROLE, "Generator"),
        (REVIEWER_ROLE, "Reviewer"),
        (ADMIN_ROLE, "Administrator"),
    ]
    for code, display_name in role_rows:
        conn.execute(
            "INSERT OR IGNORE INTO roles (code, display_name) VALUES (?, ?)", (code, display_name)
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
    ]
    for user in user_rows:
        conn.execute(
            "INSERT OR IGNORE INTO users (id, email, full_name, is_active, created_at) VALUES (?, ?, ?, ?, ?)",
            (*user, now),
        )

    role_assignments = [
        ("rohan@plaksha.edu.in", GENERATOR_ROLE),
        ("siddharth@plaksha.edu.in", GENERATOR_ROLE),
        ("siddharth@plaksha.edu.in", REVIEWER_ROLE),
        ("john.doe@plaksha.edu.in", GENERATOR_ROLE),
        ("jane.roe@plaksha.edu.in", GENERATOR_ROLE),
        ("prof.a@plaksha.edu.in", REVIEWER_ROLE),
        ("prof.b@plaksha.edu.in", REVIEWER_ROLE),
        ("student-life@plaksha.edu.in", REVIEWER_ROLE),
        ("program-chair@plaksha.edu.in", REVIEWER_ROLE),
        ("dean@plaksha.edu.in", REVIEWER_ROLE),
        ("oge@plaksha.edu.in", REVIEWER_ROLE),
        ("oge@plaksha.edu.in", ADMIN_ROLE),
    ]
    for email, role_code in role_assignments:
        user = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        role = conn.execute("SELECT id FROM roles WHERE code = ?", (role_code,)).fetchone()
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
        ("full_name", "Full Name", "Enter the applicant's legal full name.", "text", "personal"),
        ("student_id", "Student ID", "Enter the institutional student ID.", "text", "personal"),
        ("email", "Email Address", "Enter the applicant's official email address.", "email", "personal"),
        ("phone", "Phone Number", "Enter a reachable phone number.", "text", "personal"),
        ("program", "Academic Program", "Enter the current academic program or department.", "text", "academic"),
        ("cgpa", "Current CGPA", "Enter the latest approved CGPA/GPA.", "number", "academic"),
        ("passport_number", "Passport Number", "Enter passport number if travel documentation is required.", "text", "documents"),
        ("statement_of_purpose", "Statement of Purpose", "Provide a short motivation statement.", "textarea", "documents"),
        ("language_score", "Language Score (IELTS/TOEFL)", "Enter the latest validated language test score.", "number", "academic"),
        ("prior_exchange_experience", "Prior Exchange Experience", "List prior exchange or mobility participation, if any.", "text", "experience"),
        ("disciplinary_history", "Declared Disciplinary History", "Declare relevant disciplinary history or write none.", "text", "compliance"),
        ("transcript_upload", "Transcript Upload", "Add the transcript file link or document reference.", "file", "documents"),
        ("recommendation_upload", "Recommendation Upload", "Add recommendation letter file link or document reference.", "file", "documents"),
        ("resume_upload", "Resume Upload", "Add the resume/CV file link or document reference.", "file", "documents"),
    ]
    for row in form_fields:
        conn.execute(
            """
            INSERT OR IGNORE INTO form_field_catalog (field_key, label, description, input_type, section_key, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
            """,
            row,
        )

    opp_rows = [
        (
            1,
            "TUD_FALL_2026",
            "TU Delft Exchange",
            "Semester abroad at TU Delft.",
            "https://images.unsplash.com/photo-1523050854058-8df90110c9f1",
            "Fall 2026",
            "TU Delft, Netherlands",
            "2026-06-30",
            4,
            "published",
        ),
        (
            2,
            "NUS_SPRING_2026",
            "NUS Singapore Exchange",
            "Exchange at National University of Singapore.",
            "https://images.unsplash.com/photo-1546412414-8035e1776c9a",
            "Spring 2026",
            "NUS, Singapore",
            "2026-08-15",
            6,
            "published",
        ),
    ]
    for opp in opp_rows:
        conn.execute(
            """
            INSERT OR IGNORE INTO opportunities (
              id, code, title, description, cover_image_url, term, destination, deadline, seats, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (*opp, now, now),
        )

    email_groups = [
        (1, "ug2024@plaksha.edu.in", "UG 2024 Cohort"),
        (2, "professors@plaksha.edu.in", "All Professors"),
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
        (1, "GROUP_EMAIL", "ug2024@plaksha.edu.in"),
        (1, "EMAIL", "john.doe@plaksha.edu.in"),
        (2, "GROUP_EMAIL", "professors@plaksha.edu.in"),
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
            "program",
            "cgpa",
            "passport_number",
            "statement_of_purpose",
            "language_score",
            "transcript_upload",
            "recommendation_upload",
        ],
        2: [
            "full_name",
            "student_id",
            "email",
            "phone",
            "program",
            "cgpa",
            "prior_exchange_experience",
            "disciplinary_history",
            "statement_of_purpose",
            "resume_upload",
            "transcript_upload",
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

    pipeline_template = [
        {
            "step_order": 1,
            "step_name": "OGE Intake Review",
            "reviewer_email": "oge@plaksha.edu.in",
            "reviewer_display_name": "Rajesh Kumar",
            "sla_hours": 24,
            "can_view_comments": 1,
            "allowed_actions": ["approve", "request_changes", "reject", "comment"],
            "required_inputs": [
                {
                    "input_key": "oge_intake_notes",
                    "input_label": "OGE Intake Notes",
                    "input_type": "text",
                    "options": [],
                }
            ],
        },
        {
            "step_order": 2,
            "step_name": "Student Life Review",
            "reviewer_email": "student-life@plaksha.edu.in",
            "reviewer_display_name": "Ananya Iyer",
            "sla_hours": 48,
            "can_view_comments": 0,
            "allowed_actions": ["approve", "request_changes", "comment"],
            "required_inputs": [
                {
                    "input_key": "student_life_flags",
                    "input_label": "Student Life Flags",
                    "input_type": "multiselect",
                    "options": [
                        "No infractions",
                        "Late hostel fee warning",
                        "Library dues pending",
                        "Disciplinary committee referral",
                    ],
                }
            ],
        },
        {
            "step_order": 3,
            "step_name": "Program Chair Review",
            "reviewer_email": "program-chair@plaksha.edu.in",
            "reviewer_display_name": "Prof. Rajesh Gupta",
            "sla_hours": 72,
            "can_view_comments": 0,
            "allowed_actions": ["approve", "request_changes", "comment"],
            "required_inputs": [
                {
                    "input_key": "program_fit_score",
                    "input_label": "Program Fit Score (/10)",
                    "input_type": "number",
                    "options": [],
                }
            ],
        },
        {
            "step_order": 4,
            "step_name": "Dean Final Approval",
            "reviewer_email": "dean@plaksha.edu.in",
            "reviewer_display_name": "Dr. Sarah Jenkins",
            "sla_hours": 48,
            "can_view_comments": 1,
            "allowed_actions": ["approve", "reject", "comment"],
            "required_inputs": [
                {
                    "input_key": "dean_recommendation",
                    "input_label": "Dean Recommendation",
                    "input_type": "dropdown",
                    "options": ["Strongly Recommend", "Recommend", "Do Not Recommend"],
                }
            ],
        },
    ]

    for opp_id in [1, 2]:
        prior_input_keys: list[str] = []
        for step in pipeline_template:
            step_cursor = conn.execute(
                """
                INSERT OR IGNORE INTO opportunity_pipeline_steps
                (opportunity_id, step_order, step_name, reviewer_email, reviewer_display_name, sla_hours, can_view_comments, allowed_actions_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    opp_id,
                    step["step_order"],
                    step["step_name"],
                    step["reviewer_email"],
                    step["reviewer_display_name"],
                    step["sla_hours"],
                    step.get("can_view_comments", 0),
                    json.dumps(step["allowed_actions"]),
                    now,
                ),
            )

            step_row_id = int(step_cursor.lastrowid)
            if step_row_id == 0:
                existing_step = conn.execute(
                    """
                    SELECT id FROM opportunity_pipeline_steps
                    WHERE opportunity_id = ? AND step_order = ?
                    """,
                    (opp_id, step["step_order"]),
                ).fetchone()
                if not existing_step:
                    continue
                step_row_id = int(existing_step["id"])

            # Seed demo opportunities with conservative visibility:
            # downstream reviewer-added fields are hidden unless admin explicitly enables them.
            visible_keys = dedupe_preserve_order(required_fields_by_opp[opp_id])
            for key in visible_keys:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO opportunity_step_field_access (pipeline_step_id, field_key)
                    VALUES (?, ?)
                    """,
                    (step_row_id, key),
                )

            for idx, required_input in enumerate(step["required_inputs"], start=1):
                conn.execute(
                    """
                    INSERT OR IGNORE INTO opportunity_step_required_inputs
                    (pipeline_step_id, input_key, input_label, input_type, options_json, is_required, display_order)
                    VALUES (?, ?, ?, ?, ?, 1, ?)
                    """,
                    (
                        step_row_id,
                        required_input["input_key"],
                        required_input["input_label"],
                        required_input["input_type"],
                        json.dumps(required_input["options"]),
                        idx,
                    ),
                )
                prior_input_keys.append(required_input["input_key"])

    submitted_rohan_tud = {
        "full_name": "Rohan",
        "student_id": "PL-2022-ROH",
        "email": "rohan@plaksha.edu.in",
        "program": "Computer Science",
        "cgpa": 8.5,
        "passport_number": "N1234567",
        "language_score": 8.0,
        "statement_of_purpose": "I want to study advanced robotics systems at TU Delft.",
    }
    submitted_sid_tud = {
        "full_name": "Siddharth",
        "student_id": "PL-2022-SID",
        "email": "siddharth@plaksha.edu.in",
        "program": "Electronics Engineering",
        "cgpa": 9.2,
        "passport_number": "P9988776",
        "language_score": 8.5,
        "statement_of_purpose": "TU Delft aligns with my embedded AI and chip design goals.",
    }
    submitted_rohan_nus = {
        "full_name": "Rohan",
        "student_id": "PL-2022-ROH",
        "email": "rohan@plaksha.edu.in",
        "phone": "+91-9000000001",
        "program": "Computer Science",
        "cgpa": 8.5,
        "prior_exchange_experience": "None",
        "disciplinary_history": "None declared",
        "statement_of_purpose": "NUS has strong AI systems labs and startup exposure.",
    }
    submitted_sid_nus = {
        "full_name": "Siddharth",
        "student_id": "PL-2022-SID",
        "email": "siddharth@plaksha.edu.in",
        "phone": "+91-9000000002",
        "program": "Electronics Engineering",
        "cgpa": 9.2,
        "prior_exchange_experience": "One short summer school",
        "disciplinary_history": "Library dues cleared",
        "statement_of_purpose": "I aim to work on NUS interdisciplinary hardware-AI projects.",
    }

    app_rows = [
        (1, 1, 1, 2, "Student Life Review", None, json.dumps(submitted_rohan_tud), now),
        (2, 2, 1, 3, "Program Chair Review", None, json.dumps(submitted_sid_tud), now),
        (3, 1, 2, 1, "OGE Intake Review", None, json.dumps(submitted_rohan_nus), now),
        (4, 2, 2, 4, "Dean Final Approval", None, json.dumps(submitted_sid_nus), now),
    ]
    for app in app_rows:
        conn.execute(
            """
            INSERT OR IGNORE INTO applications
            (id, student_profile_id, opportunity_id, current_step_order, current_stage_label, final_status, submitted_data_json, submitted_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (*app, now, now),
        )

    seeded_reviews = [
        (2, 1, "oge@plaksha.edu.in", ADMIN_ROLE, "APPROVE", "Documents complete.", {"oge_intake_notes": "All baseline docs verified."}),
        (
            2,
            2,
            "student-life@plaksha.edu.in",
            REVIEWER_ROLE,
            "APPROVE",
            "No serious issues flagged.",
            {"student_life_flags": ["No infractions"]},
        ),
        (4, 1, "oge@plaksha.edu.in", ADMIN_ROLE, "APPROVE", "Eligible for NUS nomination.", {"oge_intake_notes": "Nomination-ready."}),
        (
            4,
            2,
            "student-life@plaksha.edu.in",
            REVIEWER_ROLE,
            "APPROVE",
            "Minor historical dues, now resolved.",
            {"student_life_flags": ["Library dues pending"]},
        ),
        (
            4,
            3,
            "program-chair@plaksha.edu.in",
            REVIEWER_ROLE,
            "APPROVE",
            "Strong fit with host curriculum.",
            {"program_fit_score": 9},
        ),
    ]
    for application_id, step_order, reviewer_email, reviewer_role, decision, remarks, required_inputs in seeded_reviews:
        conn.execute(
            """
            INSERT OR IGNORE INTO application_reviews
            (application_id, step_order, reviewer_email, reviewer_role, decision, remarks, required_inputs_json, visibility_scope, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'INTERNAL', ?)
            """,
            (
                application_id,
                step_order,
                reviewer_email,
                reviewer_role,
                decision,
                remarks,
                json.dumps(required_inputs),
                now,
            ),
        )

    created_events = [
        (1, "rohan@plaksha.edu.in", "Student Life Review"),
        (2, "siddharth@plaksha.edu.in", "Program Chair Review"),
        (3, "rohan@plaksha.edu.in", "OGE Intake Review"),
        (4, "siddharth@plaksha.edu.in", "Dean Final Approval"),
    ]
    for application_id, actor_email, step_name in created_events:
        conn.execute(
            """
            INSERT INTO timeline_events
            (application_id, event_type, event_payload_json, actor_email, created_at)
            VALUES (?, 'APPLICATION_CREATED', ?, ?, ?)
            """,
            (application_id, json.dumps({"current_stage": step_name}), actor_email, now),
        )

    conn.commit()


def ensure_db_initialized() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with db_conn() as conn:
        if schema_needs_reset(conn):
            reset_schema(conn)
            seed_data(conn)
            return

        form_field_columns = table_columns(conn, "form_field_catalog")
        if "description" not in form_field_columns:
            conn.execute("ALTER TABLE form_field_catalog ADD COLUMN description TEXT")
            conn.commit()

        required = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        if required == 0:
            seed_data(conn)


def parse_session(raw_session: str | None) -> dict[str, Any] | None:
    if not raw_session:
        return None
    try:
        parsed = json.loads(unquote(raw_session))
    except json.JSONDecodeError:
        return None

    required_keys = {"email", "name", "role", "roleDisplayName", "userId"}
    if not required_keys.issubset(parsed.keys()):
        return None
    return parsed


class SessionUser(BaseModel):
    email: str
    name: str
    role: str
    roleDisplayName: str
    userId: int
    availableWorkspaces: list[dict[str, Any]] = Field(default_factory=list)


class LoginBody(BaseModel):
    email: str


class WorkspaceSelectBody(BaseModel):
    role: str


class CommentCreateBody(BaseModel):
    text: str = Field(min_length=1)
    visibility: str = "internal"
    authorEmail: str | None = None


class DecisionBody(BaseModel):
    remarks: str | None = None
    reason: str | None = None
    reviewerEmail: str | None = None
    requiredInputs: dict[str, Any] | None = None
    targetStepOrder: int | None = None


class StudentResponseBody(BaseModel):
    text: str = Field(min_length=1)


class AdminApplicationPatchBody(BaseModel):
    submittedData: dict[str, Any]


class CustomFormFieldPayload(BaseModel):
    key: str | None = None
    label: str
    description: str | None = None


class OpportunityPatchBody(BaseModel):
    title: str | None = None
    description: str | None = None
    cover_image_url: str | None = None
    term: str | None = None
    destination: str | None = None
    deadline: str | None = None
    seats: int | None = None
    status: str | None = None
    formFields: list[str] | None = None
    customFields: list[CustomFormFieldPayload] | None = None
    workflowSteps: list["WorkflowStepPayload"] | None = None
    generatorVisibilityRules: list["VisibilityRulePayload"] | None = None
    useDefaultTemplate: bool | None = None


class WorkflowRequiredInput(BaseModel):
    id: str | None = None
    label: str
    inputType: Literal["text", "number", "dropdown", "multiselect"] = "text"
    required: bool = True
    options: list[str] = Field(default_factory=list)


class WorkflowStepPayload(BaseModel):
    name: str
    reviewerEmail: str
    reviewerName: str | None = None
    visibleFields: list[str] = Field(default_factory=list)
    requiredInputs: list[WorkflowRequiredInput] = Field(default_factory=list)
    slaHours: int = 72
    canViewComments: bool = False


class OpportunityCreatePayload(BaseModel):
    opportunity: dict[str, Any]
    formFields: list[str]
    customFields: list[CustomFormFieldPayload] = Field(default_factory=list)
    workflowSteps: list[WorkflowStepPayload]
    generatorVisibilityRules: list["VisibilityRulePayload"] = Field(default_factory=list)
    useDefaultTemplate: bool | None = False


class VisibilityRulePayload(BaseModel):
    ruleType: Literal["EMAIL", "GROUP_EMAIL"]
    ruleValue: str


class ApplicationCreateBody(BaseModel):
    opportunityId: int
    studentProfileId: int | None = None
    submittedData: dict[str, Any] | None = None


def get_session(raw_session: str | None = Cookie(default=None, alias=SESSION_COOKIE)) -> SessionUser:
    parsed = parse_session(raw_session)
    if not parsed:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return SessionUser(**parsed)


def require_roles(*allowed_roles: str):
    def dependency(session: SessionUser = Depends(get_session)) -> SessionUser:
        if session.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return session

    return dependency


def get_role_display_name(conn: sqlite3.Connection, role_code: str) -> str:
    row = conn.execute("SELECT display_name FROM roles WHERE code = ?", (role_code,)).fetchone()
    return row["display_name"] if row else role_code


def role_dashboard_path(role_code: str) -> str:
    if role_code == GENERATOR_ROLE:
        return "/generator"
    if role_code == ADMIN_ROLE:
        return "/admin"
    return "/reviewer"


def get_user_identity(conn: sqlite3.Connection, email: str) -> sqlite3.Row | None:
    return conn.execute(
        """
        SELECT id, email, full_name
        FROM users
        WHERE LOWER(email) = LOWER(?) AND is_active = 1
        LIMIT 1
        """,
        (email,),
    ).fetchone()


def get_user_workspaces(conn: sqlite3.Connection, email: str) -> list[dict[str, Any]]:
    user = get_user_identity(conn, email)
    if not user:
        return []

    user_id = int(user["id"])
    normalized_email = email.strip().lower()

    workspaces: list[dict[str, Any]] = []
    admin_role = conn.execute(
        """
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = ? AND r.code = ?
        LIMIT 1
        """,
        (user_id, ADMIN_ROLE),
    ).fetchone()
    if admin_role:
        workspaces.append(
            {
                "role": ADMIN_ROLE,
                "roleDisplayName": get_role_display_name(conn, ADMIN_ROLE),
                "dashboardPath": role_dashboard_path(ADMIN_ROLE),
            }
        )

    reviewer_assignment = conn.execute(
        """
        SELECT 1
        FROM opportunity_pipeline_steps
        WHERE LOWER(reviewer_email) = LOWER(?)
        LIMIT 1
        """,
        (normalized_email,),
    ).fetchone()
    if reviewer_assignment:
        workspaces.append(
            {
                "role": REVIEWER_ROLE,
                "roleDisplayName": get_role_display_name(conn, REVIEWER_ROLE),
                "dashboardPath": role_dashboard_path(REVIEWER_ROLE),
            }
        )

    generator_assignment = conn.execute(
        """
        SELECT 1
        FROM opportunities o
        WHERE o.status = 'published'
          AND EXISTS (
              SELECT 1
              FROM opportunity_visibility_rules rules
              WHERE rules.opportunity_id = o.id
                AND (
                    (rules.rule_type = 'EMAIL' AND LOWER(rules.rule_value) = LOWER(?))
                    OR (
                        rules.rule_type = 'GROUP_EMAIL'
                        AND EXISTS (
                            SELECT 1
                            FROM email_groups groups
                            JOIN email_group_memberships memberships ON memberships.group_id = groups.id
                            WHERE LOWER(groups.email_address) = LOWER(rules.rule_value)
                              AND groups.is_active = 1
                              AND memberships.user_id = ?
                        )
                    )
                )
          )
        LIMIT 1
        """,
        (normalized_email, user_id),
    ).fetchone()
    if generator_assignment:
        workspaces.append(
            {
                "role": GENERATOR_ROLE,
                "roleDisplayName": get_role_display_name(conn, GENERATOR_ROLE),
                "dashboardPath": role_dashboard_path(GENERATOR_ROLE),
            }
        )

    order = {GENERATOR_ROLE: 1, REVIEWER_ROLE: 2, ADMIN_ROLE: 3}
    workspaces.sort(key=lambda item: order.get(item["role"], 99))
    return workspaces


def build_session_payload(
    user: sqlite3.Row | dict[str, Any],
    available_workspaces: list[dict[str, Any]],
    active_role: str | None = None,
) -> dict[str, Any]:
    if not available_workspaces:
        raise HTTPException(status_code=403, detail="No workspaces are available for this account.")

    active_workspace = next(
        (workspace for workspace in available_workspaces if workspace["role"] == active_role),
        available_workspaces[0],
    )
    return {
        "email": user["email"],
        "name": user["full_name"],
        "role": active_workspace["role"],
        "roleDisplayName": active_workspace["roleDisplayName"],
        "userId": user["id"],
        "availableWorkspaces": available_workspaces,
    }


def can_user_view_opportunity(conn: sqlite3.Connection, user_id: int, opportunity_id: int) -> bool:
    rule_count_row = conn.execute(
        "SELECT COUNT(*) AS c FROM opportunity_visibility_rules WHERE opportunity_id = ?",
        (opportunity_id,),
    ).fetchone()
    if not rule_count_row or int(rule_count_row["c"]) == 0:
        return False

    exact_match = conn.execute(
        """
        SELECT 1
        FROM opportunity_visibility_rules rules
        JOIN users u ON rules.rule_type = 'EMAIL' AND LOWER(u.email) = LOWER(rules.rule_value)
        WHERE rules.opportunity_id = ? AND u.id = ?
        LIMIT 1
        """,
        (opportunity_id, user_id),
    ).fetchone()
    if exact_match:
        return True

    group_match = conn.execute(
        """
        SELECT 1
        FROM opportunity_visibility_rules rules
        JOIN email_groups groups
          ON rules.rule_type = 'GROUP_EMAIL'
         AND LOWER(groups.email_address) = LOWER(rules.rule_value)
         AND groups.is_active = 1
        JOIN email_group_memberships memberships ON memberships.group_id = groups.id
        WHERE rules.opportunity_id = ? AND memberships.user_id = ?
        LIMIT 1
        """,
        (opportunity_id, user_id),
    ).fetchone()
    return bool(group_match)


def normalize_visibility_rules(rules: list[VisibilityRulePayload] | list[dict[str, Any]] | None) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for raw_rule in rules or []:
        rule = raw_rule if isinstance(raw_rule, VisibilityRulePayload) else VisibilityRulePayload(**raw_rule)
        rule_type = rule.ruleType.strip().upper()
        rule_value = rule.ruleValue.strip().lower()
        if not rule_value:
            continue
        if not valid_plaksha_email(rule_value):
            raise HTTPException(
                status_code=400,
                detail=f'Visibility rule "{rule_value}" must be a valid @plaksha.edu.in email address.',
            )
        key = (rule_type, rule_value)
        if key in seen:
            continue
        seen.add(key)
        normalized.append({"rule_type": rule_type, "rule_value": rule_value})
    return normalized


def get_opportunity_visibility_rules(conn: sqlite3.Connection, opportunity_id: int) -> list[dict[str, str]]:
    rows = conn.execute(
        """
        SELECT rule_type, rule_value
        FROM opportunity_visibility_rules
        WHERE opportunity_id = ?
        ORDER BY CASE rule_type WHEN 'GROUP_EMAIL' THEN 1 ELSE 2 END, LOWER(rule_value) ASC
        """,
        (opportunity_id,),
    ).fetchall()
    return [
        {
            "ruleType": row["rule_type"],
            "ruleValue": row["rule_value"],
        }
        for row in rows
    ]


def replace_opportunity_visibility_rules(
    conn: sqlite3.Connection,
    opportunity_id: int,
    rules: list[dict[str, str]],
    created_at: str,
) -> None:
    conn.execute("DELETE FROM opportunity_visibility_rules WHERE opportunity_id = ?", (opportunity_id,))
    for rule in rules:
        conn.execute(
            """
            INSERT INTO opportunity_visibility_rules (opportunity_id, rule_type, rule_value, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (opportunity_id, rule["rule_type"], rule["rule_value"], created_at),
        )


def get_user_role(conn: sqlite3.Connection, email: str) -> dict[str, Any] | None:
    return conn.execute(
        """
        SELECT u.id, u.email, u.full_name, r.code AS role_code, r.display_name AS role_display_name
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE u.email = ? AND u.is_active = 1
        ORDER BY CASE r.code
          WHEN 'ADMIN' THEN 1
          WHEN 'REVIEWER' THEN 2
          WHEN 'GENERATOR' THEN 3
          ELSE 99 END
        LIMIT 1
        """,
        (email,),
    ).fetchone()


def derive_name_from_email(email: str) -> str:
    local = email.split("@", 1)[0]
    parts = [chunk for chunk in re.split(r"[^a-zA-Z0-9]+", local) if chunk]
    if not parts:
        return "Reviewer"
    return " ".join(part.capitalize() for part in parts)


def infer_reviewer_role_code(email: str, step_name: str) -> str:
    normalized_email = email.strip().lower()
    _ = step_name
    if normalized_email == "oge@plaksha.edu.in":
        return ADMIN_ROLE
    return REVIEWER_ROLE


def ensure_user_has_role(conn: sqlite3.Connection, user_id: int, role_code: str, ts: str) -> None:
    role = conn.execute("SELECT id FROM roles WHERE code = ?", (role_code,)).fetchone()
    if not role:
        display_name = role_code.replace("_", " ").title()
        cursor = conn.execute(
            "INSERT INTO roles (code, display_name) VALUES (?, ?)",
            (role_code, display_name),
        )
        role_id = int(cursor.lastrowid)
    else:
        role_id = int(role["id"])

    conn.execute(
        "INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, ?)",
        (user_id, role_id, ts),
    )


def ensure_reviewer_account(
    conn: sqlite3.Connection,
    reviewer_email: str,
    reviewer_name: str | None,
    step_name: str,
    ts: str,
) -> None:
    email = reviewer_email.strip().lower()
    if not email:
        return

    user = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    user_id: int
    if user:
        user_id = int(user["id"])
        if reviewer_name:
            conn.execute(
                "UPDATE users SET full_name = ? WHERE id = ?",
                (reviewer_name.strip(), user_id),
            )
    else:
        display_name = (reviewer_name or "").strip() or derive_name_from_email(email)
        cursor = conn.execute(
            "INSERT INTO users (email, full_name, is_active, created_at) VALUES (?, ?, 1, ?)",
            (email, display_name, ts),
        )
        user_id = int(cursor.lastrowid)

    role_code = infer_reviewer_role_code(email, step_name)
    ensure_user_has_role(conn, user_id, role_code, ts)


def default_pipeline_template() -> list[dict[str, Any]]:
    return [
        {
            "name": "OGE Intake Review",
            "reviewerEmail": "oge@plaksha.edu.in",
            "reviewerName": "Rajesh Kumar",
            "visibleFields": [],
            "slaHours": 24,
            "canViewComments": True,
            "requiredInputs": [
                {
                    "id": "oge_intake_notes",
                    "label": "OGE Intake Notes",
                    "inputType": "text",
                    "required": True,
                    "options": [],
                }
            ],
        },
        {
            "name": "Student Life Review",
            "reviewerEmail": "student-life@plaksha.edu.in",
            "reviewerName": "Ananya Iyer",
            "visibleFields": [],
            "slaHours": 48,
            "canViewComments": False,
            "requiredInputs": [
                {
                    "id": "student_life_flags",
                    "label": "Student Life Flags",
                    "inputType": "multiselect",
                    "required": True,
                    "options": [
                        "No infractions",
                        "Late hostel fee warning",
                        "Library dues pending",
                        "Disciplinary committee referral",
                    ],
                }
            ],
        },
        {
            "name": "Program Chair Review",
            "reviewerEmail": "program-chair@plaksha.edu.in",
            "reviewerName": "Prof. Rajesh Gupta",
            "visibleFields": [],
            "slaHours": 72,
            "canViewComments": False,
            "requiredInputs": [
                {
                    "id": "program_fit_score",
                    "label": "Program Fit Score (/10)",
                    "inputType": "number",
                    "required": True,
                    "options": [],
                }
            ],
        },
        {
            "name": "Dean Final Approval",
            "reviewerEmail": "dean@plaksha.edu.in",
            "reviewerName": "Dr. Sarah Jenkins",
            "visibleFields": [],
            "slaHours": 48,
            "canViewComments": True,
            "requiredInputs": [
                {
                    "id": "dean_recommendation",
                    "label": "Dean Recommendation",
                    "inputType": "dropdown",
                    "required": True,
                    "options": ["Strongly Recommend", "Recommend", "Do Not Recommend"],
                }
            ],
        },
    ]


def normalize_required_input(
    required_input: WorkflowRequiredInput,
    step_order: int,
    input_index: int,
) -> tuple[str, str, str, int, list[str]]:
    input_type = required_input.inputType.lower().strip()
    if input_type not in REQUIRED_INPUT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported input type: {required_input.inputType}")

    label = required_input.label.strip()
    if not label:
        raise HTTPException(status_code=400, detail="Required input label cannot be empty")

    suggested = (required_input.id or slugify_input_key(label)).strip().lower()
    if suggested.startswith(f"{step_order}_"):
        key = suggested
    else:
        key = f"{step_order}_{suggested}"
    if not re.fullmatch(r"[a-z0-9_]+", key):
        key = f"{step_order}_input_{input_index}"

    options = dedupe_preserve_order(required_input.options or [])
    if input_type in {"dropdown", "multiselect"} and not options:
        raise HTTPException(
            status_code=400,
            detail=f'Options are required for input "{label}" when type is {input_type}.',
        )
    if input_type not in {"dropdown", "multiselect"}:
        options = []

    is_required = 1 if required_input.required else 0
    return key, label, input_type, is_required, options


def normalize_custom_field_key(raw_key: str, fallback_label: str) -> str:
    base = raw_key.strip().lower()
    if not base:
        base = f"custom_{slugify_input_key(fallback_label)}"
    else:
        base = re.sub(r"[^a-z0-9_]+", "_", base).strip("_")
    if not base:
        base = "custom_field"
    if not base.startswith("custom_"):
        base = f"custom_{base}"
    if not re.fullmatch(r"[a-z0-9_]+", base):
        base = f"custom_{slugify_input_key(base)}"
    return base


def normalize_custom_form_fields(custom_fields: list[CustomFormFieldPayload]) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    used_keys: set[str] = set()
    for index, field in enumerate(custom_fields, start=1):
        label = field.label.strip()
        if not label:
            raise HTTPException(status_code=400, detail=f"Custom field #{index} label cannot be empty.")

        base_key = normalize_custom_field_key(field.key or "", label)
        key = base_key
        suffix = 2
        while key in used_keys:
            key = f"{base_key}_{suffix}"
            suffix += 1
        used_keys.add(key)

        normalized.append(
            {
                "field_key": key,
                "label": label,
                "description": (field.description or "").strip(),
            }
        )
    return normalized


def upsert_custom_form_fields(conn: sqlite3.Connection, custom_fields: list[dict[str, str]]) -> None:
    for field in custom_fields:
        existing = conn.execute(
            "SELECT field_key, section_key FROM form_field_catalog WHERE field_key = ?",
            (field["field_key"],),
        ).fetchone()
        if existing and existing["section_key"] != "custom":
            raise HTTPException(
                status_code=400,
                detail=f'Field key "{field["field_key"]}" conflicts with a preset field. Rename the custom field.',
            )

        conn.execute(
            """
            INSERT INTO form_field_catalog (field_key, label, description, input_type, section_key, is_active)
            VALUES (?, ?, ?, 'text', 'custom', 1)
            ON CONFLICT(field_key) DO UPDATE SET
              label = excluded.label,
              description = excluded.description,
              input_type = 'text',
              section_key = 'custom',
              is_active = 1
            """,
            (field["field_key"], field["label"], field["description"] or None),
        )


def ensure_form_fields_exist(conn: sqlite3.Connection, form_fields: list[str]) -> list[str]:
    normalized = dedupe_preserve_order(form_fields)
    if not normalized:
        raise HTTPException(status_code=400, detail="At least one form field is required")

    rows = conn.execute(
        "SELECT field_key FROM form_field_catalog WHERE is_active = 1",
    ).fetchall()
    known = {row["field_key"] for row in rows}
    invalid = [key for key in normalized if key not in known]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unknown form fields: {', '.join(invalid)}")
    return normalized


def normalize_workflow_steps(
    workflow_steps: list[WorkflowStepPayload],
    form_fields: list[str],
) -> list[WorkflowStepPayload]:
    if not workflow_steps:
        raise HTTPException(status_code=400, detail="Define at least one workflow step.")

    normalized_steps: list[WorkflowStepPayload] = []
    for step in workflow_steps:
        if not step.reviewerEmail.lower().endswith(PLAKSHA_DOMAIN):
            raise HTTPException(status_code=400, detail=f"Reviewer email must end with {PLAKSHA_DOMAIN}")
        if not step.name.strip():
            raise HTTPException(status_code=400, detail="Workflow step name cannot be empty")
        normalized_steps.append(
            WorkflowStepPayload(
                name=step.name.strip(),
                reviewerEmail=step.reviewerEmail.strip().lower(),
                reviewerName=(step.reviewerName or "").strip() or None,
                visibleFields=dedupe_preserve_order(step.visibleFields),
                requiredInputs=step.requiredInputs,
                slaHours=max(1, min(int(step.slaHours or 72), 24 * 30)),
                canViewComments=bool(step.canViewComments),
            )
        )

    if not any(step.reviewerEmail == "oge@plaksha.edu.in" for step in normalized_steps):
        normalized_steps.insert(
            0,
            WorkflowStepPayload(
                name="OGE Intake Review",
                reviewerEmail="oge@plaksha.edu.in",
                reviewerName="Rajesh Kumar",
                visibleFields=form_fields,
                requiredInputs=[],
                slaHours=24,
                canViewComments=True,
            ),
        )
    return normalized_steps


def replace_opportunity_structure(
    conn: sqlite3.Connection,
    opportunity_id: int,
    form_fields: list[str],
    workflow_steps: list[WorkflowStepPayload],
    ts: str,
) -> None:
    form_fields = ensure_form_fields_exist(conn, form_fields)
    workflow_steps = normalize_workflow_steps(workflow_steps, form_fields)

    conn.execute("DELETE FROM opportunity_required_fields WHERE opportunity_id = ?", (opportunity_id,))
    for order, field_key in enumerate(form_fields, start=1):
        conn.execute(
            "INSERT INTO opportunity_required_fields (opportunity_id, field_key, display_order) VALUES (?, ?, ?)",
            (opportunity_id, field_key, order),
        )

    conn.execute("DELETE FROM opportunity_pipeline_steps WHERE opportunity_id = ?", (opportunity_id,))
    prior_step_input_keys: list[str] = []
    for order, step in enumerate(workflow_steps, start=1):
        ensure_reviewer_account(conn, step.reviewerEmail, step.reviewerName, step.name, ts)

        allowed_actions = ["approve", "request_changes", "comment"]
        if order == len(workflow_steps):
            allowed_actions = ["approve", "reject", "comment"]
        elif step.reviewerEmail == "oge@plaksha.edu.in":
            allowed_actions = ["approve", "request_changes", "reject", "comment"]

        step_cursor = conn.execute(
            """
            INSERT INTO opportunity_pipeline_steps
            (opportunity_id, step_order, step_name, reviewer_email, reviewer_display_name, sla_hours, can_view_comments, allowed_actions_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                opportunity_id,
                order,
                step.name,
                step.reviewerEmail,
                step.reviewerName,
                step.slaHours,
                1 if step.canViewComments else 0,
                json.dumps(allowed_actions),
                ts,
            ),
        )
        pipeline_step_id = int(step_cursor.lastrowid)

        available_keys = dedupe_preserve_order(form_fields + prior_step_input_keys)
        requested_keys = dedupe_preserve_order(step.visibleFields)
        if not requested_keys:
            # Default to generator-submitted form fields only.
            # Reviewer-added fields from previous steps must be explicitly enabled by admin.
            resolved_visible_keys = form_fields
        elif any(key in {"all", "__all__"} for key in requested_keys):
            resolved_visible_keys = available_keys
        else:
            allowed = set(available_keys)
            resolved_visible_keys = [key for key in requested_keys if key in allowed]
            if not resolved_visible_keys:
                resolved_visible_keys = form_fields

        for key in resolved_visible_keys:
            conn.execute(
                "INSERT OR IGNORE INTO opportunity_step_field_access (pipeline_step_id, field_key) VALUES (?, ?)",
                (pipeline_step_id, key),
            )

        step_input_keys: list[str] = []
        for input_index, required_input in enumerate(step.requiredInputs, start=1):
            input_key, input_label, input_type, is_required, options = normalize_required_input(
                required_input, order, input_index
            )
            conn.execute(
                """
                INSERT INTO opportunity_step_required_inputs
                (pipeline_step_id, input_key, input_label, input_type, options_json, is_required, display_order)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pipeline_step_id,
                    input_key,
                    input_label,
                    input_type,
                    json.dumps(options) if options else None,
                    is_required,
                    input_index,
                ),
            )
            step_input_keys.append(input_key)
        prior_step_input_keys.extend(step_input_keys)


def get_pipeline_step_payloads(conn: sqlite3.Connection, opportunity_id: int) -> list[WorkflowStepPayload]:
    steps = get_pipeline_steps(conn, opportunity_id)
    payload_steps: list[WorkflowStepPayload] = []
    for step in steps:
        payload_steps.append(
            WorkflowStepPayload(
                name=step["step_name"],
                reviewerEmail=step["reviewer_email"],
                reviewerName=step["reviewer_display_name"],
                visibleFields=step["visible_fields"],
                slaHours=step["sla_hours"],
                canViewComments=bool(step["can_view_comments"]),
                requiredInputs=[
                    WorkflowRequiredInput(
                        id=entry["input_key"],
                        label=entry["input_label"],
                        inputType=entry["input_type"],
                        required=bool(entry["is_required"]),
                        options=entry.get("options", []),
                    )
                    for entry in step["required_inputs"]
                ],
            )
        )
    return payload_steps


def get_pipeline_steps(conn: sqlite3.Connection, opportunity_id: int) -> list[dict[str, Any]]:
    steps = conn.execute(
        """
        SELECT * FROM opportunity_pipeline_steps
        WHERE opportunity_id = ?
        ORDER BY step_order ASC
        """,
        (opportunity_id,),
    ).fetchall()

    results: list[dict[str, Any]] = []
    for step in steps:
        access_rows = conn.execute(
            "SELECT field_key FROM opportunity_step_field_access WHERE pipeline_step_id = ? ORDER BY id ASC",
            (step["id"],),
        ).fetchall()
        input_rows = conn.execute(
            """
            SELECT input_key, input_label, input_type, options_json, is_required, display_order
            FROM opportunity_step_required_inputs
            WHERE pipeline_step_id = ?
            ORDER BY display_order ASC, id ASC
            """,
            (step["id"],),
        ).fetchall()

        required_inputs = []
        for row in input_rows:
            options: list[str] = []
            if row["options_json"]:
                try:
                    parsed_options = json.loads(row["options_json"])
                    if isinstance(parsed_options, list):
                        options = [str(value) for value in parsed_options]
                except json.JSONDecodeError:
                    options = []
            required_inputs.append(
                {
                    "input_key": row["input_key"],
                    "input_label": row["input_label"],
                    "input_type": row["input_type"],
                    "options": options,
                    "is_required": row["is_required"],
                    "display_order": row["display_order"],
                }
            )

        results.append(
            {
                **dict(step),
                "allowed_actions": json.loads(step["allowed_actions_json"]),
                "visible_fields": [row["field_key"] for row in access_rows],
                "can_view_comments": int(step["can_view_comments"]),
                "required_inputs": required_inputs,
            }
        )
    return results


def build_visibility_audit_for_opportunity(
    conn: sqlite3.Connection, opportunity_row: sqlite3.Row
) -> dict[str, Any]:
    opportunity_id = int(opportunity_row["id"])
    form_rows = conn.execute(
        """
        SELECT f.field_key, f.label
        FROM opportunity_required_fields orf
        JOIN form_field_catalog f ON f.field_key = orf.field_key
        WHERE orf.opportunity_id = ?
        ORDER BY orf.display_order ASC
        """,
        (opportunity_id,),
    ).fetchall()
    form_fields = [row["field_key"] for row in form_rows]
    form_field_set = set(form_fields)

    label_lookup = {row["field_key"]: row["label"] for row in form_rows}
    steps = get_pipeline_steps(conn, opportunity_id)

    prior_reviewer_input_keys: list[str] = []
    step_audit: list[dict[str, Any]] = []
    has_issues = False

    for step in steps:
        current_required_keys = [entry["input_key"] for entry in step["required_inputs"]]
        for entry in step["required_inputs"]:
            label_lookup[entry["input_key"]] = entry["input_label"]

        visible_fields = step["visible_fields"]
        prior_set = set(prior_reviewer_input_keys)
        current_set = set(current_required_keys)

        visible_field_details: list[dict[str, Any]] = []
        unauthorized_visible: list[str] = []
        for key in visible_fields:
            if key in form_field_set:
                category = "generator_form"
            elif key in prior_set:
                category = "prior_reviewer_input"
            elif key in current_set:
                category = "current_step_input"
            else:
                category = "unknown_or_invalid"
                unauthorized_visible.append(key)

            visible_field_details.append(
                {
                    "key": key,
                    "label": label_lookup.get(key, key),
                    "category": category,
                }
            )

        visible_prior_inputs = [key for key in visible_fields if key in prior_set]
        hidden_prior_inputs = [key for key in prior_reviewer_input_keys if key not in visible_fields]

        step_has_issue = len(unauthorized_visible) > 0
        if step_has_issue:
            has_issues = True

        step_audit.append(
            {
                "step_order": step["step_order"],
                "step_name": step["step_name"],
                "reviewer_email": step["reviewer_email"],
                "can_view_comments": bool(step.get("can_view_comments")),
                "visible_fields": visible_field_details,
                "current_step_required_inputs": [
                    {
                        "key": entry["input_key"],
                        "label": entry["input_label"],
                        "input_type": entry["input_type"],
                    }
                    for entry in step["required_inputs"]
                ],
                "available_prior_reviewer_inputs": [
                    {"key": key, "label": label_lookup.get(key, key)} for key in prior_reviewer_input_keys
                ],
                "visible_prior_reviewer_inputs": [
                    {"key": key, "label": label_lookup.get(key, key)} for key in visible_prior_inputs
                ],
                "hidden_prior_reviewer_inputs": [
                    {"key": key, "label": label_lookup.get(key, key)} for key in hidden_prior_inputs
                ],
                "unauthorized_visible_keys": unauthorized_visible,
                "has_issue": step_has_issue,
            }
        )

        prior_reviewer_input_keys = dedupe_preserve_order(prior_reviewer_input_keys + current_required_keys)

    return {
        "opportunity": {
            "id": opportunity_id,
            "code": opportunity_row["code"],
            "title": opportunity_row["title"],
        },
        "form_fields": [{"key": row["field_key"], "label": row["label"]} for row in form_rows],
        "steps": step_audit,
        "status": "warning" if has_issues else "ok",
    }


def compute_workflow_meta(application_row: sqlite3.Row) -> dict[str, Any]:
    stage_label = application_row["current_stage_label"]
    if application_row["final_status"] == "APPROVED":
        current_stakeholder = "Completed"
    elif application_row["final_status"] == "REJECTED":
        current_stakeholder = "Rejected"
    elif int(application_row["current_step_order"]) <= 0:
        current_stakeholder = "Student Rework"
    else:
        current_stakeholder = stage_label

    stage_code = f"STEP_{application_row['current_step_order']}"
    if int(application_row["current_step_order"]) <= 0:
        stage_code = "STUDENT_REWORK"

    return {
        "stageCode": stage_code,
        "stageLabel": stage_label,
        "currentStakeholder": current_stakeholder,
        "finalStatus": application_row["final_status"],
    }


def get_enriched_application_list(conn: sqlite3.Connection, where_clause: str = "", params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    query = f"""
      SELECT a.*, o.title AS opportunity_title, o.term AS opportunity_term, o.destination AS opportunity_destination,
             o.cover_image_url AS opportunity_cover_image_url, o.id AS opportunity_id_join,
             sp.id AS profile_id_join, sp.student_id, sp.program, sp.official_cgpa,
             u.full_name AS student_full_name, u.email AS student_email
      FROM applications a
      JOIN opportunities o ON o.id = a.opportunity_id
      JOIN student_profiles sp ON sp.id = a.student_profile_id
      JOIN users u ON u.id = sp.user_id
      {where_clause}
      ORDER BY a.updated_at DESC
    """
    rows = conn.execute(query, params).fetchall()
    output: list[dict[str, Any]] = []
    for row in rows:
        app = dict(row)
        pipeline_steps = conn.execute(
            """
            SELECT step_order, step_name, reviewer_email
            FROM opportunity_pipeline_steps
            WHERE opportunity_id = ?
            ORDER BY step_order ASC
            """,
            (app["opportunity_id"],),
        ).fetchall()
        output.append(
            {
                "id": app["id"],
                "student_profile_id": app["student_profile_id"],
                "opportunity_id": app["opportunity_id"],
                "current_step_order": app["current_step_order"],
                "current_stage": app["current_stage_label"],
                "current_stage_label": app["current_stage_label"],
                "final_status": app["final_status"],
                "submitted_data": app["submitted_data_json"],
                "submitted_at": app["submitted_at"],
                "created_at": app["created_at"],
                "updated_at": app["updated_at"],
                "opportunity": {
                    "id": app["opportunity_id_join"],
                    "title": app["opportunity_title"],
                    "term": app["opportunity_term"],
                    "destination": app["opportunity_destination"],
                    "cover_image_url": app["opportunity_cover_image_url"],
                },
                "student_profile": {
                    "id": app["profile_id_join"],
                    "student_id": app["student_id"],
                    "program": app["program"],
                    "official_cgpa": app["official_cgpa"],
                },
                "student_user": {
                    "full_name": app["student_full_name"],
                    "email": app["student_email"],
                },
                "pipeline_steps": [dict(step) for step in pipeline_steps],
                "workflow": compute_workflow_meta(row),
            }
        )
    return output


def get_application_detail(conn: sqlite3.Connection, application_id: int) -> dict[str, Any] | None:
    app = conn.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
    if not app:
        return None

    opp = conn.execute("SELECT * FROM opportunities WHERE id = ?", (app["opportunity_id"],)).fetchone()
    profile = conn.execute("SELECT * FROM student_profiles WHERE id = ?", (app["student_profile_id"],)).fetchone()
    user = None
    if profile:
        user = conn.execute("SELECT id, email, full_name FROM users WHERE id = ?", (profile["user_id"],)).fetchone()

    reviews = conn.execute(
        """
        SELECT ar.*, COALESCE(u.full_name, ar.reviewer_email) AS reviewer_name
        FROM application_reviews ar
        LEFT JOIN users u ON LOWER(u.email) = LOWER(ar.reviewer_email)
        WHERE ar.application_id = ?
        ORDER BY ar.id ASC
        """,
        (application_id,),
    ).fetchall()
    comments = conn.execute(
        "SELECT * FROM application_comments WHERE application_id = ? ORDER BY id ASC",
        (application_id,),
    ).fetchall()
    timeline = conn.execute(
        "SELECT * FROM timeline_events WHERE application_id = ? ORDER BY id ASC",
        (application_id,),
    ).fetchall()

    pipeline_steps = get_pipeline_steps(conn, app["opportunity_id"])

    base_submitted_data: dict[str, Any] = {}
    if app["submitted_data_json"]:
        try:
            parsed = json.loads(app["submitted_data_json"])
            if isinstance(parsed, dict):
                base_submitted_data = parsed
        except json.JSONDecodeError:
            base_submitted_data = {}

    field_labels: dict[str, str] = {}
    form_label_rows = conn.execute(
        """
        SELECT orf.field_key, f.label
        FROM opportunity_required_fields orf
        JOIN form_field_catalog f ON f.field_key = orf.field_key
        WHERE orf.opportunity_id = ?
        ORDER BY orf.display_order ASC
        """,
        (app["opportunity_id"],),
    ).fetchall()
    for row in form_label_rows:
        field_labels[str(row["field_key"])] = str(row["label"])

    step_label_rows = conn.execute(
        """
        SELECT sri.input_key, sri.input_label
        FROM opportunity_pipeline_steps s
        JOIN opportunity_step_required_inputs sri ON sri.pipeline_step_id = s.id
        WHERE s.opportunity_id = ?
        ORDER BY s.step_order ASC, sri.display_order ASC
        """,
        (app["opportunity_id"],),
    ).fetchall()
    for row in step_label_rows:
        field_labels[str(row["input_key"])] = str(row["input_label"])

    review_payload: list[dict[str, Any]] = []
    review_added_data: dict[str, Any] = {}
    for row in reviews:
        record = dict(row)
        parsed_inputs: dict[str, Any] = {}
        if row["required_inputs_json"]:
            try:
                maybe_dict = json.loads(row["required_inputs_json"])
                if isinstance(maybe_dict, dict):
                    parsed_inputs = maybe_dict
            except json.JSONDecodeError:
                parsed_inputs = {}
        for key, value in parsed_inputs.items():
            review_added_data[str(key)] = value
            if str(key) not in field_labels:
                field_labels[str(key)] = str(key)
        record["required_inputs"] = parsed_inputs
        review_payload.append(record)

    timeline_payload = []
    for row in timeline:
        payload = None
        if row["event_payload_json"]:
            payload = json.loads(row["event_payload_json"])
        timeline_payload.append({**dict(row), "event_payload": payload})

    application_file = {**base_submitted_data, **review_added_data}

    return {
        "application": dict(app),
        "opportunity": dict(opp) if opp else None,
        "student_profile": dict(profile) if profile else None,
        "student_user": dict(user) if user else None,
        "reviews": review_payload,
        "comments": [dict(row) for row in comments],
        "timeline": timeline_payload,
        "pipeline_steps": pipeline_steps,
        "workflow": compute_workflow_meta(app),
        "application_file": application_file,
        "field_labels": field_labels,
    }


def get_current_pipeline_step(conn: sqlite3.Connection, application_row: sqlite3.Row) -> sqlite3.Row | None:
    return conn.execute(
        """
        SELECT * FROM opportunity_pipeline_steps
        WHERE opportunity_id = ? AND step_order = ?
        LIMIT 1
        """,
        (application_row["opportunity_id"], application_row["current_step_order"]),
    ).fetchone()


def ensure_reviewer_assigned(conn: sqlite3.Connection, application_row: sqlite3.Row, session: SessionUser) -> sqlite3.Row:
    step = get_current_pipeline_step(conn, application_row)
    if not step:
        raise HTTPException(status_code=400, detail="No pipeline step configured for current application stage.")
    if step["reviewer_email"].lower() != session.email.lower():
        raise HTTPException(status_code=403, detail="You are not assigned to this application at the current stage.")
    return step


def ensure_application_access_for_user(
    conn: sqlite3.Connection,
    application_id: int,
    session: SessionUser,
) -> sqlite3.Row:
    app_row = conn.execute(
        """
        SELECT a.*, sp.user_id
        FROM applications a
        JOIN student_profiles sp ON sp.id = a.student_profile_id
        WHERE a.id = ?
        """,
        (application_id,),
    ).fetchone()
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")

    if session.role == ADMIN_ROLE:
        return app_row
    if session.role == STUDENT_ROLE:
        if int(app_row["user_id"]) != int(session.userId):
            raise HTTPException(status_code=403, detail="Forbidden")
        return app_row
    if session.role in REVIEWER_ROLES:
        step = get_current_pipeline_step(conn, app_row)
        if not step or step["reviewer_email"].lower() != session.email.lower():
            raise HTTPException(status_code=403, detail="You are not assigned to this application right now.")
        return app_row
    raise HTTPException(status_code=403, detail="Forbidden")


def validate_required_inputs_for_step(
    conn: sqlite3.Connection,
    pipeline_step_id: int,
    provided_inputs: dict[str, Any] | None,
) -> None:
    provided_inputs = provided_inputs or {}
    rows = conn.execute(
        """
        SELECT input_key, input_label, is_required
        FROM opportunity_step_required_inputs
        WHERE pipeline_step_id = ?
        ORDER BY display_order ASC, id ASC
        """,
        (pipeline_step_id,),
    ).fetchall()

    missing: list[str] = []
    for row in rows:
        if not row["is_required"]:
            continue
        key = row["input_key"]
        value = provided_inputs.get(key)
        if value is None:
            missing.append(row["input_label"])
            continue
        if isinstance(value, str) and not value.strip():
            missing.append(row["input_label"])
            continue
        if isinstance(value, list) and len(value) == 0:
            missing.append(row["input_label"])
            continue
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required step inputs: {', '.join(missing)}",
        )


def write_review_and_timeline(
    conn: sqlite3.Connection,
    application_id: int,
    step_order: int,
    session: SessionUser,
    decision: Literal["APPROVE", "REQUEST_CHANGES", "REJECT"],
    remarks: str | None,
    required_inputs: dict[str, Any] | None,
    timeline_payload: dict[str, Any],
) -> None:
    ts = now_iso()
    conn.execute(
        """
        INSERT INTO application_reviews
        (application_id, step_order, reviewer_email, reviewer_role, decision, remarks, required_inputs_json, visibility_scope, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'INTERNAL', ?)
        """,
        (
            application_id,
            step_order,
            session.email,
            session.role,
            decision,
            remarks,
            json.dumps(required_inputs or {}),
            ts,
        ),
    )
    conn.execute(
        """
        INSERT INTO timeline_events (application_id, event_type, event_payload_json, actor_email, created_at)
        VALUES (?, 'DECISION_RECORDED', ?, ?, ?)
        """,
        (application_id, json.dumps(timeline_payload), session.email, ts),
    )


app = FastAPI(
    title="PRISM FastAPI",
    description="FastAPI backend for PRISM approvals platform",
    version="1.0.0",
    docs_url="/swagger",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    ensure_db_initialized()


@app.get("/api/health")
def health() -> dict[str, Any]:
    ensure_db_initialized()
    return {"ok": True, "backend": "fastapi", "timestamp": now_iso()}


@app.post("/api/auth/login")
def auth_login(body: LoginBody, response: Response) -> dict[str, Any]:
    ensure_db_initialized()
    email = body.email.strip().lower()
    with db_conn() as conn:
        user = get_user_identity(conn, email)
        if not user:
            assignment = conn.execute(
                """
                SELECT reviewer_display_name, step_name
                FROM opportunity_pipeline_steps
                WHERE LOWER(reviewer_email) = LOWER(?)
                ORDER BY id DESC
                LIMIT 1
                """,
                (email,),
            ).fetchone()
            if assignment:
                ensure_reviewer_account(
                    conn,
                    email,
                    assignment["reviewer_display_name"],
                    assignment["step_name"] or "Reviewer Stage",
                    now_iso(),
                )
                conn.commit()
                user = get_user_identity(conn, email)

        if not user:
            raise HTTPException(status_code=404, detail=f'No account found for "{body.email}".')

        available_workspaces = get_user_workspaces(conn, email)
        session_payload = build_session_payload(user, available_workspaces)

    response.set_cookie(
        key=SESSION_COOKIE,
        value=quote(json.dumps(session_payload), safe=""),
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24,
        path="/",
    )
    return {"user": session_payload}


@app.post("/api/auth/select-workspace")
def auth_select_workspace(
    body: WorkspaceSelectBody,
    response: Response,
    session: SessionUser = Depends(get_session),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        user = get_user_identity(conn, session.email)
        if not user:
            raise HTTPException(status_code=404, detail="Account not found")

        available_workspaces = get_user_workspaces(conn, session.email)
        if not any(workspace["role"] == body.role for workspace in available_workspaces):
            raise HTTPException(status_code=403, detail="That workspace is not available for this account.")

        session_payload = build_session_payload(user, available_workspaces, active_role=body.role)

    response.set_cookie(
        key=SESSION_COOKIE,
        value=quote(json.dumps(session_payload), safe=""),
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24,
        path="/",
    )
    return {"user": session_payload}


@app.post("/api/auth/logout")
def auth_logout(response: Response) -> dict[str, Any]:
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@app.get("/api/auth/me")
def auth_me(session: SessionUser = Depends(get_session)) -> dict[str, Any]:
    return {"user": session.model_dump()}


@app.get("/api/users/me")
def users_me(session: SessionUser = Depends(get_session)) -> dict[str, Any]:
    return {"user": session.model_dump()}


@app.get("/api/auth/demo-users")
def auth_demo_users() -> dict[str, Any]:
    ensure_db_initialized()
    items: list[dict[str, Any]] = []
    with db_conn() as conn:
        rows = conn.execute(
            """
            SELECT u.email, u.full_name
            FROM users u
            WHERE u.is_active = 1
              AND LOWER(u.email) <> 'ug-academics@plaksha.edu.in'
            ORDER BY u.email ASC
            """
        ).fetchall()
        for row in rows:
            email = str(row["email"]).strip().lower()
            workspaces = get_user_workspaces(conn, email)
            if not workspaces:
                continue
            primary = workspaces[0]
            items.append(
                {
                    "email": email,
                    "full_name": row["full_name"],
                    "role_code": primary["role"],
                    "role_display_name": primary["roleDisplayName"],
                }
            )
    return {"items": items}


@app.get("/api/form-fields")
def form_fields(session: SessionUser = Depends(require_roles(ADMIN_ROLE))) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        rows = conn.execute(
            "SELECT field_key, label, description, input_type, section_key FROM form_field_catalog WHERE is_active = 1 ORDER BY section_key ASC, label ASC"
        ).fetchall()
    return {
        "items": [dict(row) for row in rows],
        "defaultPipelineTemplate": default_pipeline_template(),
    }


@app.get("/api/opportunities")
def list_opportunities(session: SessionUser = Depends(get_session)) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        rows = conn.execute("SELECT * FROM opportunities ORDER BY created_at DESC").fetchall()
        result: list[dict[str, Any]] = []
        for row in rows:
            if session.role == GENERATOR_ROLE and not can_user_view_opportunity(conn, session.userId, int(row["id"])):
                continue
            required_fields = conn.execute(
                """
                SELECT f.field_key, f.label, f.input_type, f.section_key
                     , f.description
                FROM opportunity_required_fields orf
                JOIN form_field_catalog f ON f.field_key = orf.field_key
                WHERE orf.opportunity_id = ?
                ORDER BY orf.display_order ASC
                """,
                (row["id"],),
            ).fetchall()
            item = dict(row)
            item["required_fields"] = [dict(f) for f in required_fields]
            result.append(item)
    return {"items": result}


@app.get("/api/opportunities/{opportunity_id}")
def opportunity_detail(opportunity_id: int, session: SessionUser = Depends(get_session)) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        opp = conn.execute("SELECT * FROM opportunities WHERE id = ?", (opportunity_id,)).fetchone()
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        if session.role == GENERATOR_ROLE and not can_user_view_opportunity(conn, session.userId, opportunity_id):
            raise HTTPException(status_code=403, detail="This opportunity is not visible to your account.")

        required_fields = conn.execute(
            """
            SELECT f.field_key, f.label, f.input_type, f.section_key
                 , f.description
            FROM opportunity_required_fields orf
            JOIN form_field_catalog f ON f.field_key = orf.field_key
            WHERE orf.opportunity_id = ?
            ORDER BY orf.display_order ASC
            """,
            (opportunity_id,),
        ).fetchall()
        steps = get_pipeline_steps(conn, opportunity_id)
    return {
        "opportunity": dict(opp),
        "required_fields": [dict(row) for row in required_fields],
        "workflow_steps": steps,
    }


@app.get("/api/admin/opportunities")
def admin_list_opportunities(session: SessionUser = Depends(require_roles(ADMIN_ROLE))) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        rows = conn.execute(
            """
            SELECT o.*, COUNT(a.id) AS applicant_count
            FROM opportunities o
            LEFT JOIN applications a ON a.opportunity_id = o.id
            GROUP BY o.id
            ORDER BY o.created_at DESC
            """
        ).fetchall()
    return {"items": [dict(row) for row in rows]}


@app.get("/api/admin/opportunities/{opportunity_id}")
def admin_get_opportunity(opportunity_id: int, session: SessionUser = Depends(require_roles(ADMIN_ROLE))) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        opp = conn.execute("SELECT * FROM opportunities WHERE id = ?", (opportunity_id,)).fetchone()
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity not found")

        required_fields = conn.execute(
            "SELECT field_key, display_order FROM opportunity_required_fields WHERE opportunity_id = ? ORDER BY display_order ASC",
            (opportunity_id,),
        ).fetchall()
        custom_fields = conn.execute(
            """
            SELECT f.field_key, f.label, f.description
            FROM opportunity_required_fields orf
            JOIN form_field_catalog f ON f.field_key = orf.field_key
            WHERE orf.opportunity_id = ? AND f.section_key = 'custom'
            ORDER BY orf.display_order ASC
            """,
            (opportunity_id,),
        ).fetchall()
        steps = get_pipeline_steps(conn, opportunity_id)
        visibility_rules = get_opportunity_visibility_rules(conn, opportunity_id)
    return {
        "opportunity": dict(opp),
        "form_fields": [row["field_key"] for row in required_fields],
        "custom_fields": [dict(row) for row in custom_fields],
        "workflow_steps": steps,
        "generator_visibility_rules": visibility_rules,
    }


@app.get("/api/admin/visibility-audit")
def admin_visibility_audit(
    opportunity_id: int | None = None,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        if opportunity_id is not None:
            opp = conn.execute("SELECT id, code, title FROM opportunities WHERE id = ?", (opportunity_id,)).fetchone()
            if not opp:
                raise HTTPException(status_code=404, detail="Opportunity not found")
            items = [build_visibility_audit_for_opportunity(conn, opp)]
        else:
            opp_rows = conn.execute(
                "SELECT id, code, title FROM opportunities ORDER BY created_at DESC"
            ).fetchall()
            items = [build_visibility_audit_for_opportunity(conn, row) for row in opp_rows]
    return {"count": len(items), "items": items}


@app.get("/api/admin/opportunities/{opportunity_id}/visibility-audit")
def admin_visibility_audit_single(
    opportunity_id: int,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        opp = conn.execute("SELECT id, code, title FROM opportunities WHERE id = ?", (opportunity_id,)).fetchone()
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        item = build_visibility_audit_for_opportunity(conn, opp)
    return {"item": item}


@app.post("/api/admin/opportunities", status_code=201)
def admin_create_opportunity(payload: OpportunityCreatePayload, session: SessionUser = Depends(require_roles(ADMIN_ROLE))) -> dict[str, Any]:
    ensure_db_initialized()

    opportunity = payload.opportunity
    code = str(opportunity.get("code", "")).strip().upper()
    title = str(opportunity.get("title", "")).strip()

    if not code or not title:
        raise HTTPException(status_code=400, detail="Opportunity code and title are required")

    workflow_steps = payload.workflowSteps
    if payload.useDefaultTemplate or not workflow_steps:
        workflow_steps = [WorkflowStepPayload(**item) for item in default_pipeline_template()]
    custom_fields = normalize_custom_form_fields(payload.customFields or [])
    visibility_rules = normalize_visibility_rules(payload.generatorVisibilityRules)
    if not visibility_rules:
        raise HTTPException(
            status_code=400,
            detail="Define at least one eligible generator email/group rule for this opportunity.",
        )

    ts = now_iso()
    with db_conn() as conn:
        try:
            cursor = conn.execute(
                """
                INSERT INTO opportunities
                (code, title, description, cover_image_url, term, destination, deadline, seats, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)
                """,
                (
                    code,
                    title,
                    opportunity.get("description"),
                    opportunity.get("cover_image_url"),
                    opportunity.get("term"),
                    opportunity.get("destination"),
                    opportunity.get("deadline"),
                    opportunity.get("seats"),
                    ts,
                    ts,
                ),
            )
        except sqlite3.IntegrityError as exc:
            raise HTTPException(status_code=409, detail="Opportunity code already exists") from exc

        opportunity_id = int(cursor.lastrowid)
        upsert_custom_form_fields(conn, custom_fields)
        replace_opportunity_structure(conn, opportunity_id, payload.formFields, workflow_steps, ts)
        replace_opportunity_visibility_rules(conn, opportunity_id, visibility_rules, ts)
        conn.commit()

    return {"id": opportunity_id}


@app.patch("/api/admin/opportunities/{opportunity_id}")
def admin_patch_opportunity(
    opportunity_id: int,
    body: OpportunityPatchBody,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    form_fields_override = body.formFields
    custom_fields_override = body.customFields
    workflow_steps_override = body.workflowSteps
    visibility_rules_override = body.generatorVisibilityRules
    use_default_template = body.useDefaultTemplate
    core_updates = {
        k: v
        for k, v in body.model_dump(exclude={"formFields", "customFields", "workflowSteps", "generatorVisibilityRules", "useDefaultTemplate"}).items()
        if v is not None
    }

    should_rewrite_structure = (
        form_fields_override is not None
        or custom_fields_override is not None
        or workflow_steps_override is not None
        or visibility_rules_override is not None
        or bool(use_default_template)
    )

    if not core_updates and not should_rewrite_structure:
        raise HTTPException(status_code=400, detail="No fields provided")

    with db_conn() as conn:
        existing = conn.execute("SELECT * FROM opportunities WHERE id = ?", (opportunity_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Opportunity not found")

        ts = now_iso()
        if core_updates:
            core_updates["updated_at"] = ts
            columns = ", ".join(f"{k} = ?" for k in core_updates.keys())
            values = tuple(core_updates.values()) + (opportunity_id,)
            conn.execute(f"UPDATE opportunities SET {columns} WHERE id = ?", values)

        if should_rewrite_structure:
            if form_fields_override is None:
                rows = conn.execute(
                    """
                    SELECT field_key FROM opportunity_required_fields
                    WHERE opportunity_id = ?
                    ORDER BY display_order ASC
                    """,
                    (opportunity_id,),
                ).fetchall()
                form_fields = [row["field_key"] for row in rows]
            else:
                form_fields = form_fields_override

            if use_default_template:
                workflow_steps = [WorkflowStepPayload(**item) for item in default_pipeline_template()]
            elif workflow_steps_override is not None:
                workflow_steps = workflow_steps_override
            else:
                workflow_steps = get_pipeline_step_payloads(conn, opportunity_id)

            if custom_fields_override is not None:
                normalized_custom_fields = normalize_custom_form_fields(custom_fields_override)
                upsert_custom_form_fields(conn, normalized_custom_fields)

            replace_opportunity_structure(conn, opportunity_id, form_fields, workflow_steps, ts)
            if visibility_rules_override is not None:
                normalized_visibility_rules = normalize_visibility_rules(visibility_rules_override)
                if not normalized_visibility_rules:
                    raise HTTPException(
                        status_code=400,
                        detail="Define at least one eligible generator email/group rule for this opportunity.",
                    )
                replace_opportunity_visibility_rules(conn, opportunity_id, normalized_visibility_rules, ts)
            conn.execute("UPDATE opportunities SET updated_at = ? WHERE id = ?", (ts, opportunity_id))

        conn.commit()

        opp = conn.execute("SELECT * FROM opportunities WHERE id = ?", (opportunity_id,)).fetchone()
        required_fields = conn.execute(
            "SELECT field_key, display_order FROM opportunity_required_fields WHERE opportunity_id = ? ORDER BY display_order ASC",
            (opportunity_id,),
        ).fetchall()
        custom_fields = conn.execute(
            """
            SELECT f.field_key, f.label, f.description
            FROM opportunity_required_fields orf
            JOIN form_field_catalog f ON f.field_key = orf.field_key
            WHERE orf.opportunity_id = ? AND f.section_key = 'custom'
            ORDER BY orf.display_order ASC
            """,
            (opportunity_id,),
        ).fetchall()
        steps = get_pipeline_steps(conn, opportunity_id)
        visibility_rules = get_opportunity_visibility_rules(conn, opportunity_id)
    return {
        "opportunity": dict(opp) if opp else None,
        "form_fields": [row["field_key"] for row in required_fields],
        "custom_fields": [dict(row) for row in custom_fields],
        "workflow_steps": steps,
        "generator_visibility_rules": visibility_rules,
    }


@app.delete("/api/admin/opportunities/{opportunity_id}")
def admin_delete_opportunity(
    opportunity_id: int,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        opp = conn.execute("SELECT id, code, title FROM opportunities WHERE id = ?", (opportunity_id,)).fetchone()
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity not found")

        app_rows = conn.execute(
            "SELECT id FROM applications WHERE opportunity_id = ?",
            (opportunity_id,),
        ).fetchall()
        application_ids = [int(row["id"]) for row in app_rows]

        if application_ids:
            placeholders = ", ".join("?" for _ in application_ids)
            params = tuple(application_ids)
            conn.execute(f"DELETE FROM timeline_events WHERE application_id IN ({placeholders})", params)
            conn.execute(f"DELETE FROM application_comments WHERE application_id IN ({placeholders})", params)
            conn.execute(f"DELETE FROM application_reviews WHERE application_id IN ({placeholders})", params)
            conn.execute("DELETE FROM applications WHERE opportunity_id = ?", (opportunity_id,))

        conn.execute("DELETE FROM opportunities WHERE id = ?", (opportunity_id,))

        conn.execute(
            """
            DELETE FROM form_field_catalog
            WHERE section_key = 'custom'
              AND field_key NOT IN (
                SELECT DISTINCT field_key FROM opportunity_required_fields
              )
            """
        )

        conn.commit()

    return {
        "ok": True,
        "deletedOpportunityId": int(opp["id"]),
        "deletedOpportunityCode": opp["code"],
        "deletedApplications": len(application_ids),
    }


@app.post("/api/applications", status_code=201)
def create_application(body: ApplicationCreateBody, session: SessionUser = Depends(get_session)) -> dict[str, Any]:
    ensure_db_initialized()

    with db_conn() as conn:
        profile_id = body.studentProfileId
        if not profile_id:
            profile = conn.execute(
                "SELECT id FROM student_profiles WHERE user_id = ?",
                (session.userId,),
            ).fetchone()
            if not profile:
                raise HTTPException(status_code=404, detail="Student profile not found for user")
            profile_id = int(profile["id"])

        opp = conn.execute("SELECT * FROM opportunities WHERE id = ?", (body.opportunityId,)).fetchone()
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        if session.role == GENERATOR_ROLE and not can_user_view_opportunity(conn, session.userId, body.opportunityId):
            raise HTTPException(status_code=403, detail="This opportunity is not visible to your account.")

        first_step = conn.execute(
            """
            SELECT * FROM opportunity_pipeline_steps
            WHERE opportunity_id = ?
            ORDER BY step_order ASC
            LIMIT 1
            """,
            (body.opportunityId,),
        ).fetchone()
        if not first_step:
            raise HTTPException(status_code=400, detail="Opportunity has no configured workflow")

        ts = now_iso()
        submitted_data = body.submittedData or {}
        required_fields = conn.execute(
            """
            SELECT field_key
            FROM opportunity_required_fields
            WHERE opportunity_id = ?
            ORDER BY display_order ASC
            """,
            (body.opportunityId,),
        ).fetchall()
        missing_fields: list[str] = []
        for row in required_fields:
            key = row["field_key"]
            value = submitted_data.get(key)
            if value is None:
                missing_fields.append(key)
                continue
            if isinstance(value, str) and not value.strip():
                missing_fields.append(key)
                continue
            if isinstance(value, list) and len(value) == 0:
                missing_fields.append(key)
                continue
        if missing_fields:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required application fields: {', '.join(missing_fields)}",
            )

        cursor = conn.execute(
            """
            INSERT INTO applications
            (student_profile_id, opportunity_id, current_step_order, current_stage_label, final_status, submitted_data_json, submitted_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)
            """,
            (
                profile_id,
                body.opportunityId,
                first_step["step_order"],
                first_step["step_name"],
                json.dumps(submitted_data),
                ts,
                ts,
                ts,
            ),
        )
        application_id = int(cursor.lastrowid)

        conn.execute(
            """
            INSERT INTO timeline_events (application_id, event_type, event_payload_json, actor_email, created_at)
            VALUES (?, 'APPLICATION_CREATED', ?, ?, ?)
            """,
            (
                application_id,
                json.dumps({"current_stage": first_step["step_name"]}),
                session.email,
                ts,
            ),
        )
        conn.commit()

        app_row = conn.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()

    return {"application": dict(app_row) if app_row else None}


@app.delete("/api/applications/{application_id}")
def delete_application(application_id: int, session: SessionUser = Depends(get_session)) -> dict[str, Any]:
    ensure_db_initialized()

    with db_conn() as conn:
        app_row = conn.execute(
            """
            SELECT a.id, a.student_profile_id, sp.user_id
            FROM applications a
            JOIN student_profiles sp ON sp.id = a.student_profile_id
            WHERE a.id = ?
            """,
            (application_id,),
        ).fetchone()
        if not app_row:
            raise HTTPException(status_code=404, detail="Application not found")

        can_delete = False
        if session.role == ADMIN_ROLE:
            can_delete = True
        elif session.role == STUDENT_ROLE and int(app_row["user_id"]) == int(session.userId):
            can_delete = True

        if not can_delete:
            raise HTTPException(status_code=403, detail="You are not allowed to delete this application.")

        conn.execute("DELETE FROM timeline_events WHERE application_id = ?", (application_id,))
        conn.execute("DELETE FROM application_comments WHERE application_id = ?", (application_id,))
        conn.execute("DELETE FROM application_reviews WHERE application_id = ?", (application_id,))
        conn.execute("DELETE FROM applications WHERE id = ?", (application_id,))
        conn.commit()

    return {"ok": True, "deletedId": application_id}


@app.get("/api/applications")
def list_applications(session: SessionUser = Depends(get_session)) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        if session.role == ADMIN_ROLE:
            items = get_enriched_application_list(conn)
        elif session.role == STUDENT_ROLE:
            profile = conn.execute("SELECT id FROM student_profiles WHERE user_id = ?", (session.userId,)).fetchone()
            if not profile:
                raise HTTPException(status_code=404, detail="Student profile not found")
            items = get_enriched_application_list(conn, "WHERE a.student_profile_id = ?", (profile["id"],))
        elif session.role in REVIEWER_ROLES:
            items = get_enriched_application_list(
                conn,
                """
                WHERE a.final_status IS NULL
                  AND EXISTS (
                    SELECT 1 FROM opportunity_pipeline_steps s
                    WHERE s.opportunity_id = a.opportunity_id
                      AND s.step_order = a.current_step_order
                      AND LOWER(s.reviewer_email) = LOWER(?)
                  )
                """,
                (session.email,),
            )
        else:
            raise HTTPException(status_code=403, detail="Forbidden")
    return {"items": items}


@app.get("/api/applications/{application_id}")
def application_detail(application_id: int, session: SessionUser = Depends(get_session)) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        app_row = ensure_application_access_for_user(conn, application_id, session)
        detail = get_application_detail(conn, application_id)
        if not detail:
            raise HTTPException(status_code=404, detail="Application not found")

        detail["permissions"] = {
            "can_view_comments": True,
        }

        if session.role in REVIEWER_ROLES and session.role != ADMIN_ROLE:
            current_step = next(
                (
                    step
                    for step in detail["pipeline_steps"]
                    if int(step["step_order"]) == int(app_row["current_step_order"])
                ),
                None,
            )
            if not current_step:
                raise HTTPException(status_code=400, detail="No active workflow step for this application.")

            can_view_comments = bool(current_step.get("can_view_comments"))
            detail["permissions"] = {
                "can_view_comments": can_view_comments,
            }

            full_file = detail.get("application_file") or {}
            visible_keys = set(current_step.get("visible_fields") or [])
            filtered_file = {key: value for key, value in full_file.items() if key in visible_keys}
            detail["application_file"] = filtered_file
            if isinstance(detail.get("field_labels"), dict):
                detail["field_labels"] = {
                    key: value for key, value in detail["field_labels"].items() if key in visible_keys
                }
            detail["application"]["submitted_data_json"] = json.dumps(filtered_file)

            profile = detail.get("student_profile")
            if isinstance(profile, dict):
                profile["student_id"] = filtered_file.get("student_id")
                profile["program"] = filtered_file.get("program")
                profile["official_cgpa"] = filtered_file.get("cgpa")

            if not can_view_comments:
                detail["comments"] = []
                detail["reviews"] = []
    return detail


@app.post("/api/applications/{application_id}/approve")
def approve_application(
    application_id: int,
    body: DecisionBody,
    session: SessionUser = Depends(require_roles(*REVIEWER_ROLES)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        app_row = conn.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
        if not app_row:
            raise HTTPException(status_code=404, detail="Application not found")
        if app_row["final_status"]:
            raise HTTPException(status_code=400, detail="Application already closed")

        current_step = ensure_reviewer_assigned(conn, app_row, session)
        validate_required_inputs_for_step(conn, int(current_step["id"]), body.requiredInputs)

        last_step = conn.execute(
            """
            SELECT MAX(step_order) AS max_step
            FROM opportunity_pipeline_steps
            WHERE opportunity_id = ?
            """,
            (app_row["opportunity_id"],),
        ).fetchone()
        max_step = int(last_step["max_step"]) if last_step and last_step["max_step"] else current_step["step_order"]

        next_step_order = app_row["current_step_order"] + 1
        ts = now_iso()

        if next_step_order > max_step:
            conn.execute(
                "UPDATE applications SET final_status = 'APPROVED', current_stage_label = 'Closed', updated_at = ? WHERE id = ?",
                (ts, application_id),
            )
            timeline_payload = {
                "decision": "APPROVE",
                "from_stage": current_step["step_name"],
                "to_stage": "Closed",
                "final_status": "APPROVED",
            }
        else:
            next_step = conn.execute(
                """
                SELECT step_order, step_name FROM opportunity_pipeline_steps
                WHERE opportunity_id = ? AND step_order = ?
                """,
                (app_row["opportunity_id"], next_step_order),
            ).fetchone()
            if not next_step:
                raise HTTPException(status_code=500, detail="Next workflow step not found")
            conn.execute(
                """
                UPDATE applications
                SET current_step_order = ?, current_stage_label = ?, updated_at = ?
                WHERE id = ?
                """,
                (next_step["step_order"], next_step["step_name"], ts, application_id),
            )
            timeline_payload = {
                "decision": "APPROVE",
                "from_stage": current_step["step_name"],
                "to_stage": next_step["step_name"],
                "final_status": None,
            }

        write_review_and_timeline(
            conn,
            application_id,
            current_step["step_order"],
            session,
            "APPROVE",
            body.remarks,
            body.requiredInputs,
            timeline_payload,
        )
        conn.commit()

        updated = conn.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()

    return {"application": dict(updated) if updated else None}


@app.post("/api/applications/{application_id}/request-changes")
def request_changes(
    application_id: int,
    body: DecisionBody,
    session: SessionUser = Depends(require_roles(*REVIEWER_ROLES)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        app_row = conn.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
        if not app_row:
            raise HTTPException(status_code=404, detail="Application not found")
        if app_row["final_status"]:
            raise HTTPException(status_code=400, detail="Application already closed")

        current_step = ensure_reviewer_assigned(conn, app_row, session)
        first_step = conn.execute(
            "SELECT step_order, step_name FROM opportunity_pipeline_steps WHERE opportunity_id = ? ORDER BY step_order ASC LIMIT 1",
            (app_row["opportunity_id"],),
        ).fetchone()
        if not first_step:
            raise HTTPException(status_code=500, detail="Workflow template not found")

        target_step_order = int(body.targetStepOrder) if body.targetStepOrder is not None else int(first_step["step_order"])
        send_back_to_student = target_step_order == 0
        if not send_back_to_student and target_step_order >= int(current_step["step_order"]):
            raise HTTPException(status_code=400, detail="You can only send back to a prior step in the chain.")

        target_step = None
        if not send_back_to_student:
            target_step = conn.execute(
                """
                SELECT step_order, step_name FROM opportunity_pipeline_steps
                WHERE opportunity_id = ? AND step_order = ?
                """,
                (app_row["opportunity_id"], target_step_order),
            ).fetchone()
            if not target_step:
                raise HTTPException(status_code=400, detail="Target send-back step does not exist.")

        ts = now_iso()
        if send_back_to_student:
            conn.execute(
                """
                UPDATE applications
                SET current_step_order = 0,
                    current_stage_label = 'Student Rework',
                    return_to_step_order = ?,
                    return_to_stage_label = ?,
                    final_status = NULL,
                    updated_at = ?
                WHERE id = ?
                """,
                (current_step["step_order"], current_step["step_name"], ts, application_id),
            )
            to_stage = "Student Rework"
        else:
            conn.execute(
                """
                UPDATE applications
                SET current_step_order = ?,
                    current_stage_label = ?,
                    return_to_step_order = NULL,
                    return_to_stage_label = NULL,
                    final_status = NULL,
                    updated_at = ?
                WHERE id = ?
                """,
                (target_step["step_order"], target_step["step_name"], ts, application_id),
            )
            to_stage = target_step["step_name"]

        write_review_and_timeline(
            conn,
            application_id,
            current_step["step_order"],
            session,
            "REQUEST_CHANGES",
            body.remarks,
            body.requiredInputs,
            {
                "decision": "REQUEST_CHANGES",
                "from_stage": current_step["step_name"],
                "to_stage": to_stage,
                "target_step_order": target_step_order,
                "returns_to_step_order": current_step["step_order"] if send_back_to_student else target_step_order,
                "final_status": None,
            },
        )
        conn.commit()

        updated = conn.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()

    return {"application": dict(updated) if updated else None}


@app.post("/api/applications/{application_id}/student-response")
def submit_student_response(
    application_id: int,
    body: StudentResponseBody,
    session: SessionUser = Depends(require_roles(STUDENT_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        app_row = conn.execute(
            """
            SELECT a.*, sp.user_id
            FROM applications a
            JOIN student_profiles sp ON sp.id = a.student_profile_id
            WHERE a.id = ?
            """,
            (application_id,),
        ).fetchone()
        if not app_row:
            raise HTTPException(status_code=404, detail="Application not found")
        if int(app_row["user_id"]) != int(session.userId):
            raise HTTPException(status_code=403, detail="Forbidden")
        if app_row["final_status"]:
            raise HTTPException(status_code=400, detail="Application already closed")
        if int(app_row["current_step_order"]) != 0:
            raise HTTPException(status_code=400, detail="This application is not waiting on student rework.")
        if app_row["return_to_step_order"] is None or not app_row["return_to_stage_label"]:
            raise HTTPException(status_code=400, detail="Return step information is missing.")

        ts = now_iso()
        comment_text = body.text.strip()
        conn.execute(
            """
            INSERT INTO application_comments (application_id, author_email, text, visibility, created_at)
            VALUES (?, ?, ?, 'internal', ?)
            """,
            (application_id, session.email, comment_text, ts),
        )
        conn.execute(
            """
            UPDATE applications
            SET current_step_order = ?,
                current_stage_label = ?,
                return_to_step_order = NULL,
                return_to_stage_label = NULL,
                updated_at = ?
            WHERE id = ?
            """,
            (app_row["return_to_step_order"], app_row["return_to_stage_label"], ts, application_id),
        )
        conn.execute(
            """
            INSERT INTO timeline_events (application_id, event_type, event_payload_json, actor_email, created_at)
            VALUES (?, 'STUDENT_RESPONSE_SUBMITTED', ?, ?, ?)
            """,
            (
                application_id,
                json.dumps(
                    {
                        "decision": "STUDENT_RESPONSE_SUBMITTED",
                        "to_stage": app_row["return_to_stage_label"],
                        "target_step_order": app_row["return_to_step_order"],
                    }
                ),
                session.email,
                ts,
            ),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()

    return {"application": dict(updated) if updated else None}


@app.post("/api/applications/{application_id}/reject")
def reject_application(
    application_id: int,
    body: DecisionBody,
    session: SessionUser = Depends(require_roles(*REVIEWER_ROLES)),
) -> dict[str, Any]:
    ensure_db_initialized()

    with db_conn() as conn:
        app_row = conn.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
        if not app_row:
            raise HTTPException(status_code=404, detail="Application not found")
        if app_row["final_status"]:
            raise HTTPException(status_code=400, detail="Application already closed")

        current_step = ensure_reviewer_assigned(conn, app_row, session)
        allowed_actions = json.loads(current_step["allowed_actions_json"])
        if "reject" not in allowed_actions:
            raise HTTPException(status_code=403, detail="This review step is not allowed to reject applications.")

        ts = now_iso()
        conn.execute(
            """
            UPDATE applications
            SET final_status = 'REJECTED', current_stage_label = 'Closed', updated_at = ?
            WHERE id = ?
            """,
            (ts, application_id),
        )

        write_review_and_timeline(
            conn,
            application_id,
            current_step["step_order"],
            session,
            "REJECT",
            body.reason or body.remarks,
            body.requiredInputs,
            {
                "decision": "REJECT",
                "from_stage": current_step["step_name"],
                "to_stage": "Closed",
                "final_status": "REJECTED",
            },
        )
        conn.commit()

        updated = conn.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()

    return {"application": dict(updated) if updated else None}


@app.get("/api/applications/{application_id}/comments")
def get_comments(application_id: int, session: SessionUser = Depends(get_session)) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        app_row = ensure_application_access_for_user(conn, application_id, session)
        if session.role in REVIEWER_ROLES and session.role != ADMIN_ROLE:
            current_step = get_current_pipeline_step(conn, app_row)
            if not current_step:
                raise HTTPException(status_code=400, detail="No active workflow step for this application.")
            if not bool(current_step["can_view_comments"]):
                return {"comments": []}
        rows = conn.execute(
            "SELECT * FROM application_comments WHERE application_id = ? ORDER BY created_at ASC",
            (application_id,),
        ).fetchall()
    return {"comments": [dict(row) for row in rows]}


@app.post("/api/applications/{application_id}/comments", status_code=201)
def post_comment(
    application_id: int,
    body: CommentCreateBody,
    session: SessionUser = Depends(get_session),
) -> dict[str, Any]:
    ensure_db_initialized()
    author_email = (body.authorEmail or session.email).strip().lower()
    ts = now_iso()

    with db_conn() as conn:
        ensure_application_access_for_user(conn, application_id, session)

        cursor = conn.execute(
            """
            INSERT INTO application_comments (application_id, author_email, text, visibility, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (application_id, author_email, body.text.strip(), body.visibility, ts),
        )
        comment_id = int(cursor.lastrowid)
        conn.commit()

        row = conn.execute("SELECT * FROM application_comments WHERE id = ?", (comment_id,)).fetchone()
    return {"comment": dict(row) if row else None}


@app.get("/api/my/applications")
def my_applications(session: SessionUser = Depends(require_roles(STUDENT_ROLE))) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        profile = conn.execute("SELECT id FROM student_profiles WHERE user_id = ?", (session.userId,)).fetchone()
        if not profile:
            raise HTTPException(status_code=404, detail="Student profile not found")
        items = get_enriched_application_list(conn, "WHERE a.student_profile_id = ?", (profile["id"],))
    return {"items": items}


@app.get("/api/reviewer/inbox")
def reviewer_inbox(session: SessionUser = Depends(require_roles(*REVIEWER_ROLES))) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        rows = conn.execute(
            """
            SELECT a.*, o.title AS opportunity_title, sp.student_id, u.full_name AS student_name,
                   s.reviewer_email, s.sla_hours
            FROM applications a
            JOIN opportunities o ON o.id = a.opportunity_id
            JOIN student_profiles sp ON sp.id = a.student_profile_id
            JOIN users u ON u.id = sp.user_id
            JOIN opportunity_pipeline_steps s
              ON s.opportunity_id = a.opportunity_id
             AND s.step_order = a.current_step_order
            WHERE a.final_status IS NULL
              AND LOWER(s.reviewer_email) = LOWER(?)
            ORDER BY a.updated_at DESC
            """,
            (session.email,),
        ).fetchall()

        processed = conn.execute(
            "SELECT COUNT(*) AS c FROM application_reviews WHERE reviewer_email = ?",
            (session.email,),
        ).fetchone()["c"]

    items = []
    due_soon = 0
    for row in rows:
        updated_at = parse_iso(row["updated_at"])
        sla_deadline = None
        if updated_at:
            sla_hours = int(row["sla_hours"] or 72)
            deadline = updated_at + timedelta(hours=sla_hours)
            sla_deadline = deadline.isoformat()
            if datetime.now(timezone.utc) + timedelta(hours=24) >= deadline:
                due_soon += 1

        items.append(
            {
                "id": row["id"],
                "student_name": row["student_name"],
                "student_id": row["student_id"],
                "opportunity_title": row["opportunity_title"],
                "current_stage": row["current_stage_label"],
                "updated_at": row["updated_at"],
                "sla_deadline": sla_deadline,
            }
        )

    return {
        "items": items,
        "stats": {
            "pending": len(items),
            "dueSoon": due_soon,
            "processed": processed,
        },
    }


@app.get("/api/admin/dashboard/summary")
def admin_summary(session: SessionUser = Depends(require_roles(ADMIN_ROLE))) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        total = conn.execute("SELECT COUNT(*) AS c FROM applications").fetchone()["c"]
        active = conn.execute("SELECT COUNT(*) AS c FROM applications WHERE final_status IS NULL").fetchone()["c"]
        approved = conn.execute("SELECT COUNT(*) AS c FROM applications WHERE final_status = 'APPROVED'").fetchone()["c"]

        awaiting_me = conn.execute(
            """
            SELECT COUNT(*) AS c
            FROM applications a
            JOIN opportunity_pipeline_steps s
              ON s.opportunity_id = a.opportunity_id
             AND s.step_order = a.current_step_order
            WHERE a.final_status IS NULL
              AND LOWER(s.reviewer_email) = LOWER(?)
            """,
            (session.email,),
        ).fetchone()["c"]

        closed_rows = conn.execute(
            "SELECT created_at, updated_at FROM applications WHERE final_status IS NOT NULL"
        ).fetchall()
        if closed_rows:
            days = []
            for row in closed_rows:
                start = parse_iso(row["created_at"])
                end = parse_iso(row["updated_at"])
                if start and end:
                    days.append(max((end - start).total_seconds() / 86400, 0.0))
            avg_processing = round(sum(days) / len(days), 2) if days else 0.0
        else:
            avg_processing = 0.0

        review_counts = conn.execute(
            """
            SELECT
              SUM(CASE WHEN decision = 'REQUEST_CHANGES' THEN 1 ELSE 0 END) AS flagged,
              COUNT(*) AS total_reviews
            FROM application_reviews
            """
        ).fetchone()
        flagged = review_counts["flagged"] or 0
        total_reviews = review_counts["total_reviews"] or 0
        flagged_ratio = round((flagged / total_reviews) * 100, 2) if total_reviews else 0.0

        active_opps = conn.execute(
            """
            SELECT o.id, o.title, o.code, COUNT(a.id) AS applicant_count
            FROM opportunities o
            LEFT JOIN applications a ON a.opportunity_id = o.id
            WHERE o.status = 'published'
            GROUP BY o.id
            ORDER BY applicant_count DESC, o.updated_at DESC
            LIMIT 5
            """
        ).fetchall()

    return {
        "total": total,
        "pending": active,
        "awaitingMe": awaiting_me,
        "approved": approved,
        "avgProcessingDays": avg_processing,
        "flaggedRatio": flagged_ratio,
        "activeOpportunities": [dict(row) for row in active_opps],
    }


@app.get("/api/admin/applications")
def admin_applications(session: SessionUser = Depends(require_roles(ADMIN_ROLE))) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        items = get_enriched_application_list(conn)
    return {"items": items}


@app.patch("/api/admin/applications/{application_id}")
def admin_patch_application(
    application_id: int,
    body: AdminApplicationPatchBody,
    session: SessionUser = Depends(require_roles(ADMIN_ROLE)),
) -> dict[str, Any]:
    ensure_db_initialized()
    with db_conn() as conn:
        existing = conn.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Application not found")

        ts = now_iso()
        conn.execute(
            "UPDATE applications SET submitted_data_json = ?, updated_at = ? WHERE id = ?",
            (json.dumps(body.submittedData), ts, application_id),
        )
        conn.execute(
            """
            INSERT INTO timeline_events (application_id, event_type, event_payload_json, actor_email, created_at)
            VALUES (?, 'APPLICATION_FILE_EDITED', ?, ?, ?)
            """,
            (
                application_id,
                json.dumps({"edited_keys": sorted(body.submittedData.keys())}),
                session.email,
                ts,
            ),
        )
        conn.commit()

        updated = conn.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
    return {"application": dict(updated) if updated else None}
