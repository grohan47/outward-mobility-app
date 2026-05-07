import os
import sqlite3
import traceback
from fastapi_app.ai_workflow import AIWorkflowDraftService

def main():
    db = sqlite3.connect(":memory:")
    db.execute("""
        CREATE TABLE workflow_drafts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            opportunity_id INTEGER,
            status TEXT NOT NULL DEFAULT 'pending',
            draft_output TEXT,
            clarifying_questions TEXT,
            admin_answers TEXT DEFAULT '{}',
            warnings TEXT,
            confidence REAL,
            publish_ready INTEGER NOT NULL DEFAULT 0,
            created_by_email TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    """)
    db.commit()
    
    svc = AIWorkflowDraftService()
    svc.MAX_RETRIES = 0
    try:
        row = svc.generate_draft(db, "test@example.com", "Make me an opportunity about studying at MIT")
        print("Success! Warnings:", row["warnings"])
    except Exception as e:
        traceback.print_exc()

if __name__ == "__main__":
    main()
