CREATE TABLE IF NOT EXISTS sla_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  graph_node_id INTEGER NOT NULL REFERENCES graph_nodes(id),
  sla_days INTEGER NOT NULL,
  reminder_days TEXT NOT NULL,
  escalation_email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(graph_node_id)
);

CREATE TABLE IF NOT EXISTS sla_reminders_sent (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES application_workflow_tasks(id),
  reminder_type TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  sent_to_email TEXT NOT NULL,
  UNIQUE(task_id, reminder_type, sent_to_email)
);

CREATE TABLE IF NOT EXISTS sla_breaches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES application_workflow_tasks(id),
  breached_at TEXT NOT NULL,
  escalation_sent_to TEXT,
  acknowledged_by_email TEXT,
  acknowledged_at TEXT,
  resolution_notes TEXT,
  UNIQUE(task_id)
);

CREATE INDEX IF NOT EXISTS idx_sla_policies_node
  ON sla_policies(graph_node_id);
CREATE INDEX IF NOT EXISTS idx_sla_reminders_task
  ON sla_reminders_sent(task_id);
CREATE INDEX IF NOT EXISTS idx_sla_breaches_task
  ON sla_breaches(task_id);
