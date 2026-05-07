import { getDb } from "./db";

// ── Schema DDL ──

const SCHEMA_SQL = `
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
  description TEXT,
  term TEXT,
  destination TEXT,
  deadline TEXT,
  seats INTEGER,
  status TEXT DEFAULT 'published',
  form_template_id INTEGER,
  workflow_template_id INTEGER,
  created_at TEXT,
  updated_at TEXT
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

CREATE TABLE IF NOT EXISTS form_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  schema_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_step_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_template_id INTEGER NOT NULL,
  step_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id)
);

CREATE TABLE IF NOT EXISTS reviewer_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_step_template_id INTEGER NOT NULL,
  reviewer_email TEXT NOT NULL,
  reviewer_display_name TEXT,
  access_level TEXT NOT NULL DEFAULT 'standard',
  allowed_actions TEXT NOT NULL DEFAULT '["approve","comment"]',
  visible_sections TEXT NOT NULL DEFAULT '["all"]',
  required_inputs TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (workflow_step_template_id) REFERENCES workflow_step_templates(id)
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
  current_step_id INTEGER,
  final_status TEXT,
  submitted_data TEXT,
  submitted_at TEXT,
  metadata TEXT,
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

CREATE TABLE IF NOT EXISTS workflow_step_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  workflow_step_template_id INTEGER NOT NULL,
  assigned_reviewer_email TEXT,
  assigned_at TEXT,
  acted_at TEXT,
  decision TEXT,
  comment_summary TEXT,
  FOREIGN KEY (application_id) REFERENCES applications(id),
  FOREIGN KEY (workflow_step_template_id) REFERENCES workflow_step_templates(id)
);

CREATE TABLE IF NOT EXISTS deficiency_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  created_by_email TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  author_email TEXT NOT NULL,
  text TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'internal',
  created_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id)
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

// ── Initialization ──

export function initSchema() {
  const db = getDb();
  db.exec(SCHEMA_SQL);

  // Seed workflow stages
  const stages = [
    ["STUDENT_SUBMISSION", "Student Submission", 1],
    ["STUDENT_LIFE", "Student Life Review", 2],
    ["PROGRAM_CHAIR", "Program Chair Review", 3],
    ["OGE", "OGE Office Review", 4],
    ["DEAN", "Dean Academics Final Approval", 5],
  ] as const;

  const insertStage = db.prepare(
    `INSERT OR IGNORE INTO workflow_stages (code, display_name, sequence_order, is_active)
     VALUES (?, ?, ?, 1)`
  );
  for (const [code, name, order] of stages) {
    insertStage.run(code, name, order);
  }

  // Seed roles
  const roles = [
    ["GENERATOR", "Generator"],
    ["REVIEWER", "Reviewer"],
    ["ADMIN", "Administrator"],
    ["STUDENT", "Student"],
    ["STUDENT_LIFE", "Student Life Office"],
    ["PROGRAM_CHAIR", "Program Chair"],
    ["OGE_ADMIN", "OGE Administrator"],
    ["DEAN_ACADEMICS", "Dean of Academics"],
  ] as const;

  const insertRole = db.prepare(
    `INSERT OR IGNORE INTO roles (code, display_name) VALUES (?, ?)`
  );
  for (const [code, name] of roles) {
    insertRole.run(code, name);
  }
}

// ── Seed demo data ──

export function seedDemoData() {
  const db = getDb();
  const now = new Date().toISOString();

  // ── Users ──
  const users = [
    [1, "rohan@plaksha.edu.in", "Rohan", now],
    [2, "siddharth@plaksha.edu.in", "Siddharth", now],
    [3, "john.doe@plaksha.edu.in", "John Doe", now],
    [4, "jane.roe@plaksha.edu.in", "Jane Roe", now],
    [5, "prof.a@plaksha.edu.in", "Prof A", now],
    [6, "prof.b@plaksha.edu.in", "Prof B", now],
    [10, "ug-academics@plaksha.edu.in", "Dr. Vikram Sahay", now],
    [11, "student-life@plaksha.edu.in", "Ananya Iyer", now],
    [12, "program-chair@plaksha.edu.in", "Prof. Rajesh Gupta", now],
    [13, "oge@plaksha.edu.in", "Rajesh Kumar", now],
    [14, "dean@plaksha.edu.in", "Dr. Sarah Jenkins", now],
  ] as const;

  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users (id, email, full_name, is_active, created_at)
     VALUES (?, ?, ?, 1, ?)`
  );
  for (const [id, email, name, ts] of users) {
    insertUser.run(id, email, name, ts);
  }

  // ── User role assignments ──
  const roleMap: Record<string, string[]> = {
    "rohan@plaksha.edu.in": ["GENERATOR", "STUDENT"],
    "siddharth@plaksha.edu.in": ["GENERATOR", "STUDENT"],
    "john.doe@plaksha.edu.in": ["GENERATOR"],
    "jane.roe@plaksha.edu.in": ["GENERATOR"],
    "ug-academics@plaksha.edu.in": ["REVIEWER", "STUDENT_LIFE"],
    "student-life@plaksha.edu.in": ["REVIEWER", "STUDENT_LIFE"],
    "program-chair@plaksha.edu.in": ["REVIEWER", "PROGRAM_CHAIR"],
    "oge@plaksha.edu.in": ["ADMIN", "REVIEWER", "OGE_ADMIN"],
    "dean@plaksha.edu.in": ["ADMIN", "REVIEWER", "DEAN_ACADEMICS"],
  };

  for (const [email, roleCodes] of Object.entries(roleMap)) {
    const user = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email) as { id: number } | undefined;
    if (!user) continue;
    for (const roleCode of roleCodes) {
      const role = db.prepare(`SELECT id FROM roles WHERE code = ?`).get(roleCode) as { id: number } | undefined;
      if (!role) continue;
      db.prepare(
        `INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, ?)`
      ).run(user.id, role.id, now);
    }
  }

  // ── Student profiles ──
  const profiles = [
    [1, 1, "PL-2022-ROH", "Computer Science", 8.5, now],
    [2, 2, "PL-2022-SID", "Electronics Engineering", 9.2, now],
  ] as const;

  const insertProfile = db.prepare(
    `INSERT OR IGNORE INTO student_profiles (id, user_id, student_id, program, official_cgpa, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const p of profiles) {
    insertProfile.run(...p);
  }

  // ── Workflow template (OGE Outward Mobility) ──
  db.prepare(
    `INSERT OR IGNORE INTO workflow_templates (id, name, description, created_at, updated_at)
     VALUES (1, 'OGE Outward Mobility Workflow', 'Sequential 5-step approval workflow for outbound student mobility applications', ?, ?)`
  ).run(now, now);

  const steps = [
    [1, 1, 1, "UG Academics Review", "Verify CGPA and academic eligibility"],
    [2, 1, 2, "Student Life Review", "Check disciplinary record and campus involvement"],
    [3, 1, 3, "Program Chair Review", "Assess course alignment and academic fit"],
    [4, 1, 4, "OGE Office Review", "Administrative screening and compliance check"],
    [5, 1, 5, "Dean Academics Approval", "Final institutional approval"],
  ] as const;

  const insertStep = db.prepare(
    `INSERT OR IGNORE INTO workflow_step_templates (id, workflow_template_id, step_order, name, description)
     VALUES (?, ?, ?, ?, ?)`
  );
  for (const s of steps) {
    insertStep.run(...s);
  }

  // ── Reviewer assignments ──
  const assignments = [
    [1, "ug-academics@plaksha.edu.in", "Dr. Vikram Sahay", "standard", '["approve","request_changes","comment"]', '["personal","academic","attachments"]', '[]'],
    [2, "student-life@plaksha.edu.in", "Ananya Iyer", "standard", '["approve","request_changes","comment"]', '["personal","discipline","attachments"]', '[]'],
    [3, "program-chair@plaksha.edu.in", "Prof. Rajesh Gupta", "standard", '["approve","request_changes","send_back","comment"]', '["personal","academic","program_fit","attachments"]', '[]'],
    [4, "oge@plaksha.edu.in", "Rajesh Kumar", "elevated", '["approve","reject","request_changes","send_back","comment"]', '["all"]', '[]'],
    [5, "dean@plaksha.edu.in", "Dr. Sarah Jenkins", "final", '["approve","reject","comment"]', '["all"]', '[]'],
  ] as const;

  const insertAssignment = db.prepare(
    `INSERT OR IGNORE INTO reviewer_assignments (workflow_step_template_id, reviewer_email, reviewer_display_name, access_level, allowed_actions, visible_sections, required_inputs)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const a of assignments) {
    insertAssignment.run(...a);
  }

  // ── Opportunities ──
  const opps = [
    [1, "TUD_FALL_2026", "TU Delft Exchange", "Semester abroad at TU Delft, Netherlands. Strong robotics and sustainable tech programs.", "Fall 2026", "TU Delft, Netherlands", "2026-06-30", 4, "published"],
    [2, "NUS_SPRING_2026", "NUS Singapore Exchange", "Exchange program at National University of Singapore. Good for cross-disciplinary work.", "Spring 2026", "NUS, Singapore", "2026-02-01", 6, "published"],
  ] as const;

  const insertOpp = db.prepare(
    `INSERT OR IGNORE INTO opportunities (id, code, title, description, term, destination, deadline, seats, status, workflow_template_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  );
  for (const o of opps) {
    insertOpp.run(...o, now, now);
  }

  // ── Demo email distribution groups ──
  const insertGroup = db.prepare(
    `INSERT OR IGNORE INTO email_groups (id, email_address, display_name, is_active, created_at)
     VALUES (?, ?, ?, 1, ?)`
  );
  insertGroup.run(1, "ug2024@plaksha.edu.in", "UG 2024 Cohort", now);
  insertGroup.run(2, "professors@plaksha.edu.in", "All Professors", now);

  const insertMembership = db.prepare(
    `INSERT OR IGNORE INTO email_group_memberships (group_id, user_id, created_at)
     VALUES (?, ?, ?)`
  );
  // ug2024 group members
  insertMembership.run(1, 1, now);
  insertMembership.run(1, 2, now);
  insertMembership.run(1, 3, now);
  // professors group members
  insertMembership.run(2, 5, now);
  insertMembership.run(2, 6, now);

  const insertVisibilityRule = db.prepare(
    `INSERT OR IGNORE INTO opportunity_visibility_rules (opportunity_id, rule_type, rule_value, created_by, created_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  // TU Delft visible to UG2024 cohort + explicit John Doe
  insertVisibilityRule.run(1, "GROUP_EMAIL", "ug2024@plaksha.edu.in", 13, now);
  insertVisibilityRule.run(1, "EMAIL", "john.doe@plaksha.edu.in", 13, now);
  // NUS visible to professors cohort
  insertVisibilityRule.run(2, "GROUP_EMAIL", "professors@plaksha.edu.in", 13, now);

  const insertScopedRole = db.prepare(
    `INSERT OR IGNORE INTO user_scope_roles (user_id, role_id, scope_type, scope_id, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const siddharthUser = db.prepare(`SELECT id FROM users WHERE email = ?`).get("siddharth@plaksha.edu.in") as { id: number } | undefined;
  const reviewerRole = db.prepare(`SELECT id FROM roles WHERE code = ?`).get("REVIEWER") as { id: number } | undefined;
  if (siddharthUser && reviewerRole) {
    insertScopedRole.run(siddharthUser.id, reviewerRole.id, "OPPORTUNITY", 1, 13, now);
  }

  // ── Form template (OGE standard form) ──
  const formSchema = JSON.stringify({
    sections: [
      {
        id: "personal",
        title: "Personal Information",
        fields: [
          { id: "full_name", label: "Full Name", type: "text", required: true },
          { id: "email", label: "Email", type: "email", required: true },
        ],
      },
      {
        id: "academic",
        title: "Academic Details",
        fields: [
          { id: "transcript", label: "Transcript Upload", type: "file", required: true },
          { id: "sop", label: "Statement of Purpose", type: "textarea", required: true },
          { id: "course_applied_for", label: "Course Applied For", type: "text", required: true },
        ],
      },
    ],
  });

  db.prepare(
    `INSERT OR IGNORE INTO form_templates (id, name, description, schema_json, created_at, updated_at)
     VALUES (1, 'OGE Standard Application Form', 'Standard mobility application form', ?, ?, ?)`
  ).run(formSchema, now, now);

  db.prepare(`UPDATE opportunities SET form_template_id = 1 WHERE form_template_id IS NULL`).run();

  // ── Demo applications ──
  // 1: Rohan -> TU Delft (opp 1). 2: Siddharth -> NUS (opp 2). Both at STUDENT_LIFE stage.
  const rohanData = JSON.stringify({ full_name: "Rohan", email: "rohan@plaksha.edu.in", transcript: "rohan_transcript.pdf", sop: "I want to go to Delft.", course_applied_for: "Robotics" });
  const siddData = JSON.stringify({ full_name: "Siddharth", email: "siddharth@plaksha.edu.in", transcript: "sidd_transcript.pdf", sop: "NUS has great AI.", course_applied_for: "AI & ML", phone: "12345678" });
  
  const apps = [
    [1, 1, 1, "STUDENT_LIFE", null, rohanData, now, now, now],
    [2, 2, 2, "STUDENT_LIFE", null, siddData, now, now, now],
  ] as const;

  const insertApp = db.prepare(
    `INSERT OR IGNORE INTO applications (id, student_profile_id, opportunity_id, current_stage, final_status, submitted_data, submitted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const a of apps) {
    insertApp.run(...a);
  }

  // ── Demo reviews (UG Academics already approved) ──
  db.prepare(
    `INSERT OR IGNORE INTO application_reviews (id, application_id, review_role, verification_outcome, remarks, visibility_scope, created_by, created_at)
     VALUES (1, 1, 'UG_ACADEMICS', 'APPROVE', 'Academic requirements met for Rohan.', 'INTERNAL', 10, ?)`
  ).run(now);
  db.prepare(
    `INSERT OR IGNORE INTO application_reviews (id, application_id, review_role, verification_outcome, remarks, visibility_scope, created_by, created_at)
     VALUES (2, 2, 'UG_ACADEMICS', 'APPROVE', 'Academic requirements met for Siddharth.', 'INTERNAL', 10, ?)`
  ).run(now);

  db.prepare(
    `INSERT OR IGNORE INTO application_decisions (id, application_id, stage_code, decision, reason, decided_by, decided_at)
     VALUES (1, 1, 'STUDENT_SUBMISSION', 'APPROVE', 'UG Academics review passed.', 10, ?)`
  ).run(now);
  db.prepare(
    `INSERT OR IGNORE INTO application_decisions (id, application_id, stage_code, decision, reason, decided_by, decided_at)
     VALUES (2, 2, 'STUDENT_SUBMISSION', 'APPROVE', 'UG Academics review passed.', 10, ?)`
  ).run(now);

  // ── Timeline events ──
  const events = [
    [1, 1, "APPLICATION_CREATED", JSON.stringify({ current_stage: "STUDENT_LIFE" }), 1, now],
    [2, 2, "APPLICATION_CREATED", JSON.stringify({ current_stage: "STUDENT_LIFE" }), 2, now],
  ] as const;

  const insertEvent = db.prepare(
    `INSERT OR IGNORE INTO timeline_events (id, application_id, event_type, event_payload, actor_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const e of events) {
    insertEvent.run(...e);
  }

  // ── Snapshots ──
  db.prepare(
    `INSERT OR IGNORE INTO application_student_snapshot (id, application_id, official_cgpa_at_submission, program_at_submission, disciplinary_status_at_submission, snapshot_captured_at)
     VALUES (1, 1, 8.5, 'Computer Science', 'Clear', ?)`
  ).run(now);
  db.prepare(
    `INSERT OR IGNORE INTO application_student_snapshot (id, application_id, official_cgpa_at_submission, program_at_submission, disciplinary_status_at_submission, snapshot_captured_at)
     VALUES (2, 2, 9.2, 'Electronics Engineering', 'Clear', ?)`
  ).run(now);
}

// ── Ensure DB is initialized ──

let _initialized = false;

export function ensureDbInitialized() {
  if (_initialized) return;
  initSchema();
  seedDemoData();
  _initialized = true;
}

export function listVisibleOpportunitiesForUser(userId: number) {
  const db = getDb();
  return db
    .prepare(
      `SELECT opportunities.*
       FROM opportunities
       JOIN opportunity_visible_users visible_users
         ON visible_users.opportunity_id = opportunities.id
       WHERE visible_users.user_id = ?
       ORDER BY opportunities.deadline ASC, opportunities.id ASC`
    )
    .all(userId);
}
