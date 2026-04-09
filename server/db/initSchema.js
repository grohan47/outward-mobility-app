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

CREATE TABLE IF NOT EXISTS user_scope_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    scope_type TEXT NOT NULL CHECK(scope_type IN ('SYSTEM', 'OPPORTUNITY')),
    scope_id INTEGER,
    created_by INTEGER,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, role_id, scope_type, scope_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (scope_id) REFERENCES opportunities(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
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

CREATE TABLE IF NOT EXISTS email_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_address TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_group_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES email_groups(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS opportunity_visibility_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER NOT NULL,
    rule_type TEXT NOT NULL CHECK(rule_type IN ('EMAIL', 'GROUP_EMAIL')),
    rule_value TEXT NOT NULL,
    created_by INTEGER,
    created_at TEXT NOT NULL,
    UNIQUE(opportunity_id, rule_type, rule_value),
    FOREIGN KEY (opportunity_id) REFERENCES opportunities(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
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

CREATE TABLE IF NOT EXISTS chat_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_thread_participants (
    thread_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (thread_id, user_id),
    FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    sender_user_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE VIEW IF NOT EXISTS opportunity_visible_users AS
SELECT DISTINCT
    rules.opportunity_id AS opportunity_id,
    users.id AS user_id
FROM opportunity_visibility_rules rules
JOIN users ON rules.rule_type = 'EMAIL'
    AND LOWER(users.email) = LOWER(rules.rule_value)
UNION
SELECT DISTINCT
    rules.opportunity_id AS opportunity_id,
    memberships.user_id AS user_id
FROM opportunity_visibility_rules rules
JOIN email_groups groups ON rules.rule_type = 'GROUP_EMAIL'
    AND LOWER(groups.email_address) = LOWER(rules.rule_value)
    AND groups.is_active = 1
JOIN email_group_memberships memberships ON memberships.group_id = groups.id;

CREATE VIEW IF NOT EXISTS user_role_contexts AS
SELECT
    ur.user_id,
    r.code AS source_role_code,
    r.display_name AS source_role_display_name,
    CASE
        WHEN r.code IN ('ADMIN', 'OGE_ADMIN', 'DEAN_ACADEMICS') THEN 'ADMIN'
        WHEN r.code IN ('REVIEWER', 'STUDENT_LIFE', 'PROGRAM_CHAIR') THEN 'REVIEWER'
        WHEN r.code IN ('GENERATOR', 'STUDENT') THEN 'GENERATOR'
        ELSE r.code
    END AS workspace_role_code,
    CASE
        WHEN r.code IN ('ADMIN', 'OGE_ADMIN', 'DEAN_ACADEMICS') THEN 'Administrator'
        WHEN r.code IN ('REVIEWER', 'STUDENT_LIFE', 'PROGRAM_CHAIR') THEN 'Reviewer'
        WHEN r.code IN ('GENERATOR', 'STUDENT') THEN 'Generator'
        ELSE r.display_name
    END AS workspace_role_display_name,
    'SYSTEM' AS scope_type,
    NULL AS scope_id,
    NULL AS opportunity_code,
    NULL AS opportunity_title
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
UNION
SELECT
    usr.user_id,
    r.code AS source_role_code,
    r.display_name AS source_role_display_name,
    CASE
        WHEN r.code IN ('ADMIN', 'OGE_ADMIN', 'DEAN_ACADEMICS') THEN 'ADMIN'
        WHEN r.code IN ('REVIEWER', 'STUDENT_LIFE', 'PROGRAM_CHAIR') THEN 'REVIEWER'
        WHEN r.code IN ('GENERATOR', 'STUDENT') THEN 'GENERATOR'
        ELSE r.code
    END AS workspace_role_code,
    CASE
        WHEN r.code IN ('ADMIN', 'OGE_ADMIN', 'DEAN_ACADEMICS') THEN 'Administrator'
        WHEN r.code IN ('REVIEWER', 'STUDENT_LIFE', 'PROGRAM_CHAIR') THEN 'Reviewer'
        WHEN r.code IN ('GENERATOR', 'STUDENT') THEN 'Generator'
        ELSE r.display_name
    END AS workspace_role_display_name,
    usr.scope_type,
    usr.scope_id,
    opportunities.code AS opportunity_code,
    opportunities.title AS opportunity_title
FROM user_scope_roles usr
JOIN roles r ON r.id = usr.role_id
LEFT JOIN opportunities ON usr.scope_type = 'OPPORTUNITY' AND opportunities.id = usr.scope_id;
`;

const ROLE_ROWS = [
    ["GENERATOR", "Generator"],
    ["REVIEWER", "Reviewer"],
    ["ADMIN", "Administrator"],
    ["STUDENT", "Student"],
    ["STUDENT_LIFE", "Student Life Office"],
    ["PROGRAM_CHAIR", "Program Chair"],
    ["OGE_ADMIN", "OGE Administrator"],
    ["DEAN_ACADEMICS", "Dean of Academics"],
];

const WORKFLOW_STAGE_ROWS = [
    ["STUDENT_SUBMISSION", "Student Submission", 1],
    ["STUDENT_LIFE", "Student Life Review", 2],
    ["PROGRAM_CHAIR", "Program Chair Review", 3],
    ["OGE", "OGE Office Review", 4],
    ["DEAN", "Dean Academics Final Approval", 5],
];

export function initSchema(db) {
    db.exec(CREATE_TABLES_SQL);

    const hasColumn = (tableName, columnName) => {
        const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
        return columns.some((column) => column.name === columnName);
    };

    const allowedStageCodes = WORKFLOW_STAGE_ROWS.map(([code]) => code);
    const allowedRoleCodes = ROLE_ROWS.map(([code]) => code);

    const insertStage = db.prepare(
        `INSERT OR IGNORE INTO workflow_stages (code, display_name, sequence_order, is_active)
         VALUES (?, ?, ?, 1)`
    );
    const updateStage = db.prepare(
        `UPDATE workflow_stages SET display_name = ?, sequence_order = ?, is_active = 1 WHERE code = ?`
    );
    for (const [code, displayName, sequenceOrder] of WORKFLOW_STAGE_ROWS) {
        insertStage.run(code, displayName, sequenceOrder);
        updateStage.run(displayName, sequenceOrder, code);
    }

    const insertRole = db.prepare(
        `INSERT OR IGNORE INTO roles (code, display_name) VALUES (?, ?)`
    );
    const updateRole = db.prepare(
        `UPDATE roles SET display_name = ? WHERE code = ?`
    );
    for (const [code, displayName] of ROLE_ROWS) {
        insertRole.run(code, displayName);
        updateRole.run(displayName, code);
    }

    const stagePlaceholders = allowedStageCodes.map(() => "?").join(", ");
    db.prepare(`DELETE FROM workflow_stages WHERE code NOT IN (${stagePlaceholders})`).run(...allowedStageCodes);
    if (hasColumn("applications", "current_stage") && hasColumn("applications", "updated_at")) {
        db.prepare(
            `UPDATE applications SET current_stage = 'STUDENT_LIFE', updated_at = ?
             WHERE final_status IS NULL AND current_stage NOT IN (${stagePlaceholders})`
        ).run(new Date().toISOString(), ...allowedStageCodes);
    }

    const rolePlaceholders = allowedRoleCodes.map(() => "?").join(", ");
    db.prepare(
        `DELETE FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE code NOT IN (${rolePlaceholders}))`
    ).run(...allowedRoleCodes);
    db.prepare(`DELETE FROM roles WHERE code NOT IN (${rolePlaceholders})`).run(...allowedRoleCodes);

}

export function seedDemoData(db) {
    const now = new Date().toISOString();
    db.prepare(
        `INSERT OR IGNORE INTO users (id, email, full_name, is_active, created_at)
         VALUES (1, 'student1@plaksha.edu.in', 'Student One', 1, ?)`
    ).run(now);
    db.prepare(
        `INSERT OR IGNORE INTO users (id, email, full_name, is_active, created_at)
         VALUES (2, 'john.doe@plaksha.edu.in', 'John Doe', 1, ?)`
    ).run(now);
    db.prepare(
        `INSERT OR IGNORE INTO users (id, email, full_name, is_active, created_at)
         VALUES (3, 'jane.roe@plaksha.edu.in', 'Jane Roe', 1, ?)`
    ).run(now);
    db.prepare(
        `INSERT OR IGNORE INTO users (id, email, full_name, is_active, created_at)
         VALUES (4, 'prof.a@plaksha.edu.in', 'Prof A', 1, ?)`
    ).run(now);
    db.prepare(
        `INSERT OR IGNORE INTO users (id, email, full_name, is_active, created_at)
         VALUES (5, 'prof.b@plaksha.edu.in', 'Prof B', 1, ?)`
    ).run(now);
    db.prepare(
        `INSERT OR IGNORE INTO users (id, email, full_name, is_active, created_at)
            VALUES (99, 'reviewer@plaksha.edu.in', 'Workflow Reviewer', 1, ?)`
    ).run(now);
    db.prepare(
        `INSERT OR IGNORE INTO student_profiles (id, user_id, student_id, program, official_cgpa, created_at)
         VALUES (1, 1, 'PL-2022-001', 'Computer Science', 8.9, ?)`
    ).run(now);
    db.prepare(
        `INSERT OR IGNORE INTO opportunities (id, code, title, term, destination)
         VALUES (1, 'ETH_FALL_2026', 'ETH Zurich Exchange', 'Fall 2026', 'ETH Zurich')`
    ).run();
    db.prepare(
        `INSERT OR IGNORE INTO opportunities (id, code, title, term, destination)
         VALUES (2, 'NUS_SPRING_2027', 'NUS Exchange', 'Spring 2027', 'NUS Singapore')`
    ).run();

    const demoRoleAssignments = [
        ["student1@plaksha.edu.in", "GENERATOR"],
        ["john.doe@plaksha.edu.in", "GENERATOR"],
        ["jane.roe@plaksha.edu.in", "GENERATOR"],
        ["prof.a@plaksha.edu.in", "REVIEWER"],
        ["prof.b@plaksha.edu.in", "REVIEWER"],
        ["reviewer@plaksha.edu.in", "ADMIN"],
    ];
    const findUserIdByEmail = db.prepare(`SELECT id FROM users WHERE email = ?`);
    const findRoleIdByCode = db.prepare(`SELECT id FROM roles WHERE code = ?`);
    const insertUserRole = db.prepare(
        `INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, ?)`
    );
    for (const [email, roleCode] of demoRoleAssignments) {
        const user = findUserIdByEmail.get(email);
        const role = findRoleIdByCode.get(roleCode);
        if (user && role) {
            insertUserRole.run(user.id, role.id, now);
        }
    }

    const insertScopedRole = db.prepare(
        `INSERT OR IGNORE INTO user_scope_roles (user_id, role_id, scope_type, scope_id, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
    );
    const reviewerRole = findRoleIdByCode.get("REVIEWER");
    const reviewerAdmin = findUserIdByEmail.get("reviewer@plaksha.edu.in");
    const mixedRoleUser = findUserIdByEmail.get("siddharth@plaksha.edu.in");
    if (reviewerRole && reviewerAdmin && mixedRoleUser) {
        insertScopedRole.run(mixedRoleUser.id, reviewerRole.id, "OPPORTUNITY", 1, reviewerAdmin.id, now);
    }

    db.prepare(
        `INSERT OR IGNORE INTO email_groups (id, email_address, display_name, is_active, created_at)
         VALUES (1, 'ug2024@plaksha.edu.in', 'UG 2024 Cohort', 1, ?)`
    ).run(now);
    db.prepare(
        `INSERT OR IGNORE INTO email_groups (id, email_address, display_name, is_active, created_at)
         VALUES (2, 'professors@plaksha.edu.in', 'All Professors', 1, ?)`
    ).run(now);

    db.prepare(
        `INSERT OR IGNORE INTO email_group_memberships (group_id, user_id, created_at)
         VALUES (1, 1, ?), (1, 2, ?), (1, 3, ?), (2, 4, ?), (2, 5, ?)`
    ).run(now, now, now, now, now);

    db.prepare(
        `INSERT OR IGNORE INTO opportunity_visibility_rules (opportunity_id, rule_type, rule_value, created_by, created_at)
         VALUES
         (1, 'GROUP_EMAIL', 'ug2024@plaksha.edu.in', 99, ?),
         (1, 'EMAIL', 'john.doe@plaksha.edu.in', 99, ?),
         (2, 'GROUP_EMAIL', 'professors@plaksha.edu.in', 99, ?)`
    ).run(now, now, now);
}
