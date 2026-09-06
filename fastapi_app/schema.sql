CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  reviewer_onboarded INTEGER NOT NULL DEFAULT 1,
  pronouns TEXT,
  department TEXT,
  notify_email INTEGER NOT NULL DEFAULT 1,
  notify_digest INTEGER NOT NULL DEFAULT 0,
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
  field_hint TEXT,
  input_type TEXT NOT NULL,
  options_json TEXT,
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
  ai_summary_json TEXT,
  ai_summary_source_hash TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE opportunity_detail_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'text',
  display_order INTEGER NOT NULL,
  is_student_visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(opportunity_id, field_key)
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




CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_profile_id INTEGER NOT NULL,
  opportunity_id INTEGER NOT NULL,
  current_step_order INTEGER NOT NULL,
  current_stage_label TEXT NOT NULL,
  graph_version_id INTEGER REFERENCES graph_versions(id),
  final_status TEXT,
  workflow_notes TEXT,
  submitted_data_json TEXT,
  submitted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (student_profile_id) REFERENCES student_profiles(id),
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id)
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

CREATE TABLE workflow_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER REFERENCES opportunities(id),
  original_prompt TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  draft_output TEXT,
  clarifying_questions TEXT,
  admin_answers TEXT,
  warnings TEXT,
  confidence REAL DEFAULT 0.0,
  publish_ready INTEGER DEFAULT 0,
  created_by_email TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE graph_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id),
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by_email TEXT,
  published_by_email TEXT,
  published_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE graph_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  graph_version_id INTEGER NOT NULL REFERENCES graph_versions(id),
  node_key TEXT NOT NULL,
  node_type TEXT NOT NULL,
  display_name TEXT,
  reviewer_email TEXT,
  visible_sections TEXT DEFAULT '["all"]',
  allowed_actions TEXT DEFAULT '["approve","reject","request_changes","comment"]',
  metadata TEXT DEFAULT '{}'
);

CREATE TABLE graph_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  graph_version_id INTEGER NOT NULL REFERENCES graph_versions(id),
  from_node_key TEXT NOT NULL,
  to_node_key TEXT NOT NULL,
  condition_json TEXT,
  label TEXT,
  action TEXT
);

CREATE TABLE application_workflow_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id),
  graph_version_id INTEGER NOT NULL REFERENCES graph_versions(id),
  node_key TEXT NOT NULL,
  assigned_reviewer_email TEXT NOT NULL,
  assigned_at TEXT DEFAULT (datetime('now')),
  acted_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  decision TEXT,
  comment_summary TEXT,
  return_to_task_id INTEGER REFERENCES application_workflow_tasks(id),
  reviewer_data_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_awt_status_email
  ON application_workflow_tasks(status, assigned_reviewer_email);
CREATE INDEX idx_awt_app_version_node
  ON application_workflow_tasks(application_id, graph_version_id, node_key);

CREATE TABLE sla_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  graph_node_id INTEGER NOT NULL REFERENCES graph_nodes(id),
  sla_days INTEGER NOT NULL,
  reminder_days TEXT NOT NULL,
  escalation_email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(graph_node_id)
);

CREATE TABLE sla_reminders_sent (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES application_workflow_tasks(id),
  reminder_type TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  sent_to_email TEXT NOT NULL,
  UNIQUE(task_id, reminder_type, sent_to_email)
);

CREATE TABLE sla_breaches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES application_workflow_tasks(id),
  breached_at TEXT NOT NULL,
  escalation_sent_to TEXT,
  acknowledged_by_email TEXT,
  acknowledged_at TEXT,
  resolution_notes TEXT,
  UNIQUE(task_id)
);

CREATE INDEX idx_sla_policies_node
  ON sla_policies(graph_node_id);
CREATE INDEX idx_sla_reminders_task
  ON sla_reminders_sent(task_id);
CREATE INDEX idx_sla_breaches_task
  ON sla_breaches(task_id);
CREATE INDEX idx_ge_from
  ON graph_edges(graph_version_id, from_node_key);
CREATE INDEX idx_ge_to
  ON graph_edges(graph_version_id, to_node_key);
CREATE INDEX idx_gn_version_key
  ON graph_nodes(graph_version_id, node_key);

ALTER TABLE graph_versions ADD COLUMN definition_json TEXT;
ALTER TABLE applications ADD COLUMN current_level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE applications ADD COLUMN attempt INTEGER NOT NULL DEFAULT 1;
ALTER TABLE applications ADD COLUMN return_level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE application_workflow_tasks ADD COLUMN attempt INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX idx_task_attempt ON application_workflow_tasks(application_id,node_key,attempt);
PRAGMA user_version = 1;
