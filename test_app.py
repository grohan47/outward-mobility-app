import sqlite3
import os
import traceback
from fastapi_app.ai_workflow import AIWorkflowDraftService
from fastapi_app.main import ensure_db_initialized, db_conn

os.environ["ANTHROPIC_API_KEY"] = "sk-ant-dummy"
ensure_db_initialized()

with db_conn() as conn:
    svc = AIWorkflowDraftService()
    svc.MAX_RETRIES = 0
    try:
        row = svc.generate_draft(conn, "test@example.com", "Make me an opportunity about MIT")
        print("Success! Row ID:", row["id"])
    except Exception as e:
        print("EXCEPTION:")
        traceback.print_exc()
