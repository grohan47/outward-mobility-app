-- applications.graph_version_id and applications.workflow_notes are added idempotently by apply_schema_migrations().
-- SQLite does not support portable ADD COLUMN IF NOT EXISTS syntax.

CREATE TABLE IF NOT EXISTS workflow_drafts (
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

CREATE TABLE IF NOT EXISTS graph_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id),
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  published_by_email TEXT,
  published_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS graph_nodes (
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

CREATE TABLE IF NOT EXISTS graph_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  graph_version_id INTEGER NOT NULL REFERENCES graph_versions(id),
  from_node_key TEXT NOT NULL,
  to_node_key TEXT NOT NULL,
  condition_json TEXT,
  label TEXT,
  action TEXT
);

CREATE TABLE IF NOT EXISTS application_workflow_tasks (
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
  flag_target TEXT,
  flag_return_task_id INTEGER REFERENCES application_workflow_tasks(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes required by plan D16 for task-first inbox and graph traversal queries.
CREATE INDEX IF NOT EXISTS idx_awt_status_email
  ON application_workflow_tasks(status, assigned_reviewer_email);
CREATE INDEX IF NOT EXISTS idx_awt_app_version_node
  ON application_workflow_tasks(application_id, graph_version_id, node_key);
CREATE INDEX IF NOT EXISTS idx_ge_from
  ON graph_edges(graph_version_id, from_node_key);
CREATE INDEX IF NOT EXISTS idx_ge_to
  ON graph_edges(graph_version_id, to_node_key);
CREATE INDEX IF NOT EXISTS idx_gn_version_key
  ON graph_nodes(graph_version_id, node_key);
