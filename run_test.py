import sqlite3
import os
from fastapi_app.ai_workflow import AIWorkflowDraftService

# Ensure API key is somewhat loaded
os.environ["ANTHROPIC_API_KEY"] = os.environ.get("ANTHROPIC_API_KEY", "sk-ant-dummy")

db = sqlite3.connect(":memory:")
db.execute("CREATE TABLE workflow_drafts (id INTEGER PRIMARY KEY, status TEXT, draft_output TEXT, clarifying_questions TEXT, admin_answers TEXT, warnings TEXT, confidence REAL, publish_ready INTEGER, created_by_email TEXT, created_at TEXT, updated_at TEXT)")
try:
    svc = AIWorkflowDraftService()
    svc.MAX_RETRIES = 0
    row = svc.generate_draft(db, "test@example.com", "Make me an opportunity")
    print(row["warnings"])
except Exception as e:
    print(f"Exception: {e}")
