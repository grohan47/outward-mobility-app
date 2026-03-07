const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS student_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    student_id TEXT NOT NULL UNIQUE,
    program TEXT NOT NULL,
    official_cgpa REAL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    term TEXT,
    destination TEXT
);

CREATE TABLE IF NOT EXISTS workflow_stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    sequence_order INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_profile_id INTEGER NOT NULL,
    opportunity_id INTEGER NOT NULL,
    current_stage TEXT NOT NULL,
    final_status TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (student_profile_id) REFERENCES student_profiles(id),
    FOREIGN KEY (opportunity_id) REFERENCES opportunities(id)
);

CREATE TABLE IF NOT EXISTS application_student_snapshot (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL UNIQUE,
    official_cgpa_at_submission REAL,
    program_at_submission TEXT,
    disciplinary_status_at_submission TEXT,
    snapshot_captured_at TEXT NOT NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id)
);

CREATE TABLE IF NOT EXISTS application_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    uploaded_by INTEGER,
    uploaded_at TEXT NOT NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS application_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    review_role TEXT NOT NULL,
    verification_outcome TEXT,
    remarks TEXT,
    visibility_scope TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS application_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    stage_code TEXT NOT NULL,
    decision TEXT NOT NULL,
    reason TEXT,
    decided_by INTEGER NOT NULL,
    decided_at TEXT NOT NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id),
    FOREIGN KEY (decided_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS application_remarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    remark_type TEXT NOT NULL,
    text TEXT NOT NULL,
    visibility_scope TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS timeline_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    event_payload TEXT,
    actor_user_id INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id),
    FOREIGN KEY (actor_user_id) REFERENCES users(id)
);
`;

const WORKFLOW_STAGE_ROWS = [
    ["STUDENT_SUBMISSION", "Student Submission", 1],
    ["UG_ACADEMICS", "UG Academics Review", 2],
    ["STUDENT_LIFE", "Student Life Review", 3],
    ["PROGRAM_CHAIR", "Program Chair Review", 4],
    ["OGE", "OGE Routing", 5],
    ["DEAN", "Dean Academics Final Approval", 6],
];

export function initSchema(db) {
    db.exec(CREATE_TABLES_SQL);

    const insertStage = db.prepare(
        `INSERT OR IGNORE INTO workflow_stages (code, display_name, sequence_order, is_active)
         VALUES (?, ?, ?, 1)`
    );
    for (const [code, displayName, sequenceOrder] of WORKFLOW_STAGE_ROWS) {
        insertStage.run(code, displayName, sequenceOrder);
    }
}

export function seedDemoData(db) {
    const now = new Date().toISOString();
    db.prepare(
        `INSERT OR IGNORE INTO users (id, email, full_name, is_active, created_at)
         VALUES (1, 'student1@plaksha.edu.in', 'Student One', 1, ?)`
    ).run(now);
    db.prepare(
        `INSERT OR IGNORE INTO users (id, email, full_name, is_active, created_at)
         VALUES (99, 'reviewer@plaksha.edu.in', 'UG Reviewer', 1, ?)`
    ).run(now);
    db.prepare(
        `INSERT OR IGNORE INTO student_profiles (id, user_id, student_id, program, official_cgpa, created_at)
         VALUES (1, 1, 'PL-2022-001', 'Computer Science', 8.9, ?)`
    ).run(now);
    db.prepare(
        `INSERT OR IGNORE INTO opportunities (id, code, title, term, destination)
         VALUES (1, 'ETH_FALL_2026', 'ETH Zurich Exchange', 'Fall 2026', 'ETH Zurich')`
    ).run();
}
