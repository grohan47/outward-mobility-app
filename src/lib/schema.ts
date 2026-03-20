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
    [1, "student1@plaksha.edu.in", "Aditya Sharma", now],
    [2, "student2@plaksha.edu.in", "Priya Kapoor", now],
    [3, "student3@plaksha.edu.in", "Aarav Mehta", now],
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
  const roleMap: Record<string, string> = {
    "student1@plaksha.edu.in": "STUDENT",
    "student2@plaksha.edu.in": "STUDENT",
    "student3@plaksha.edu.in": "STUDENT",
    "ug-academics@plaksha.edu.in": "STUDENT_LIFE",
    "student-life@plaksha.edu.in": "STUDENT_LIFE",
    "program-chair@plaksha.edu.in": "PROGRAM_CHAIR",
    "oge@plaksha.edu.in": "OGE_ADMIN",
    "dean@plaksha.edu.in": "DEAN_ACADEMICS",
  };

  for (const [email, roleCode] of Object.entries(roleMap)) {
    const user = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email) as { id: number } | undefined;
    const role = db.prepare(`SELECT id FROM roles WHERE code = ?`).get(roleCode) as { id: number } | undefined;
    if (user && role) {
      db.prepare(
        `INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, ?)`
      ).run(user.id, role.id, now);
    }
  }

  // ── Student profiles ──
  const profiles = [
    [1, 1, "PL-2022-001", "Computer Science & AI", 8.9, now],
    [2, 2, "PL-2022-042", "Electronics Engineering", 9.1, now],
    [3, 3, "PL-2023-015", "Computer Science", 7.8, now],
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
    [1, "ug-academics@plaksha.edu.in", "Dr. Vikram Sahay", "standard", '["approve","request_changes","comment"]', '["personal","academic","attachments"]'],
    [2, "student-life@plaksha.edu.in", "Ananya Iyer", "standard", '["approve","request_changes","comment"]', '["personal","discipline","attachments"]'],
    [3, "program-chair@plaksha.edu.in", "Prof. Rajesh Gupta", "standard", '["approve","request_changes","send_back","comment"]', '["personal","academic","program_fit","attachments"]'],
    [4, "oge@plaksha.edu.in", "Rajesh Kumar", "elevated", '["approve","reject","request_changes","send_back","comment"]', '["all"]'],
    [5, "dean@plaksha.edu.in", "Dr. Sarah Jenkins", "final", '["approve","reject","comment"]', '["all"]'],
  ] as const;

  const insertAssignment = db.prepare(
    `INSERT OR IGNORE INTO reviewer_assignments (workflow_step_template_id, reviewer_email, reviewer_display_name, access_level, allowed_actions, visible_sections)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const a of assignments) {
    insertAssignment.run(...a);
  }

  // ── Opportunities ──
  const opps = [
    [1, "ETH_FALL_2026", "ETH Zurich Exchange", "Semester exchange program at ETH Zurich, Switzerland. Focus on Computer Science and Engineering.", "Fall 2026", "ETH Zurich, Switzerland", "2026-06-15", 5, "published"],
    [2, "UCB_SPRING_2026", "UC Berkeley Exchange", "Research-focused exchange at UC Berkeley, California. Suitable for CS and AI students.", "Spring 2026", "UC Berkeley, USA", "2026-01-15", 3, "published"],
    [3, "TUD_FALL_2026", "TU Delft Exchange", "Semester abroad at TU Delft, Netherlands. Strong robotics and sustainable tech programs.", "Fall 2026", "TU Delft, Netherlands", "2026-06-30", 4, "published"],
    [4, "NUS_SPRING_2026", "NUS Singapore Exchange", "Exchange program at National University of Singapore. Good for cross-disciplinary work.", "Spring 2026", "NUS, Singapore", "2026-02-01", 6, "published"],
  ] as const;

  const insertOpp = db.prepare(
    `INSERT OR IGNORE INTO opportunities (id, code, title, description, term, destination, deadline, seats, status, workflow_template_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  );
  for (const o of opps) {
    insertOpp.run(...o, now, now);
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
          { id: "phone", label: "Phone Number", type: "tel", required: true },
          { id: "passport_number", label: "Passport Number", type: "text", required: true },
        ],
      },
      {
        id: "academic",
        title: "Academic Details",
        fields: [
          { id: "program", label: "Current Program", type: "text", required: true },
          { id: "cgpa", label: "Current CGPA", type: "number", required: true },
          { id: "semester", label: "Current Semester", type: "number", required: true },
          { id: "credits_completed", label: "Credits Completed", type: "number", required: true },
        ],
      },
      {
        id: "program_fit",
        title: "Program Fit & Motivation",
        fields: [
          { id: "motivation", label: "Motivation Statement", type: "textarea", required: true },
          { id: "research_alignment", label: "Research Alignment", type: "textarea", required: false },
        ],
      },
      {
        id: "attachments",
        title: "Documents",
        fields: [
          { id: "transcript", label: "Official Transcript", type: "file", required: true },
          { id: "recommendation", label: "Letter of Recommendation", type: "file", required: true },
          { id: "passport_copy", label: "Passport Copy", type: "file", required: true },
        ],
      },
    ],
  });

  db.prepare(
    `INSERT OR IGNORE INTO form_templates (id, name, description, schema_json, created_at, updated_at)
     VALUES (1, 'OGE Standard Application Form', 'Standard mobility application form with personal, academic, motivation, and document sections', ?, ?, ?)`
  ).run(formSchema, now, now);

  // Link form template to opportunities
  db.prepare(`UPDATE opportunities SET form_template_id = 1 WHERE form_template_id IS NULL`).run();

  // ── Demo applications ──
  const apps = [
    [1, 1, 1, "PROGRAM_CHAIR", null, now, now, now],
    [2, 2, 2, "STUDENT_LIFE", null, now, now, now],
    [3, 3, 3, "STUDENT_SUBMISSION", null, now, now, now],
  ] as const;

  const insertApp = db.prepare(
    `INSERT OR IGNORE INTO applications (id, student_profile_id, opportunity_id, current_stage, final_status, submitted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const a of apps) {
    insertApp.run(...a);
  }

  // ── Demo reviews for app 1 (Aditya → already past Student Life) ──
  db.prepare(
    `INSERT OR IGNORE INTO application_reviews (id, application_id, review_role, verification_outcome, remarks, visibility_scope, created_by, created_at)
     VALUES (1, 1, 'STUDENT_LIFE', 'APPROVE', 'Academic requirements met. 8.9 CGPA confirmed above threshold.', 'INTERNAL', 10, ?)`
  ).run(now);

  db.prepare(
    `INSERT OR IGNORE INTO application_reviews (id, application_id, review_role, verification_outcome, remarks, visibility_scope, created_by, created_at)
     VALUES (2, 1, 'STUDENT_LIFE', 'APPROVE', 'No disciplinary actions on record. Good standing confirmed.', 'INTERNAL', 11, ?)`
  ).run(now);

  db.prepare(
    `INSERT OR IGNORE INTO application_decisions (id, application_id, stage_code, decision, reason, decided_by, decided_at)
     VALUES (1, 1, 'STUDENT_LIFE', 'APPROVE', 'Student Life review passed - clean record.', 11, ?)`
  ).run(now);

  // ── Timeline events ──
  const events = [
    [1, 1, "APPLICATION_CREATED", JSON.stringify({ current_stage: "STUDENT_LIFE" }), 1, now],
    [2, 1, "DECISION_RECORDED", JSON.stringify({ decision: "APPROVE", from_stage: "STUDENT_LIFE", to_stage: "PROGRAM_CHAIR" }), 11, now],
    [3, 2, "APPLICATION_CREATED", JSON.stringify({ current_stage: "STUDENT_LIFE" }), 2, now],
    [4, 3, "APPLICATION_CREATED", JSON.stringify({ current_stage: "STUDENT_SUBMISSION" }), 3, now],
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
     VALUES (1, 1, 8.9, 'Computer Science & AI', 'Clear', ?)`
  ).run(now);
  db.prepare(
    `INSERT OR IGNORE INTO application_student_snapshot (id, application_id, official_cgpa_at_submission, program_at_submission, disciplinary_status_at_submission, snapshot_captured_at)
     VALUES (2, 2, 9.1, 'Electronics Engineering', 'Clear', ?)`
  ).run(now);

  // ── Demo comments ──
  db.prepare(
    `INSERT OR IGNORE INTO comments (id, application_id, author_email, text, visibility, created_at)
     VALUES (1, 1, 'ug-academics@plaksha.edu.in', 'Academic status confirmed. Student has no outstanding fees and is currently enrolled in all prerequisite courses.', 'internal', ?)`
  ).run(now);
  db.prepare(
    `INSERT OR IGNORE INTO comments (id, application_id, author_email, text, visibility, created_at)
     VALUES (2, 1, 'student-life@plaksha.edu.in', 'Verified CGPA (8.9) against original transcript. Eligibility for the research fellowship confirmed.', 'internal', ?)`
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
