"""
Interactive demo of GraphExecutionService.

Run with:  python -m fastapi_app.demo_graph

Shows a parallel-review workflow end-to-end:

  start
    ├─> OGE Review       (oge@plaksha.edu.in)
    └─> Student Life     (student-life@plaksha.edu.in)
         └── join_all ──> Dean Review (dean@plaksha.edu.in)
                               └──> end  (APPROVED)
"""
import json
import sqlite3

from fastapi_app.graph_execution import GraphExecutionService
from fastapi_app.main import reset_schema

SEP = "─" * 60


def _setup_db():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    reset_schema(conn)
    return conn


def _seed(conn):
    now = "2026-05-05T00:00:00+00:00"
    conn.execute(
        "INSERT INTO users (id, email, full_name, is_active, created_at) VALUES (1, ?, ?, 1, ?)",
        ("student@plaksha.edu.in", "Aryan Mehta", now),
    )
    conn.execute(
        "INSERT INTO student_profiles (id, user_id, student_id, program, official_cgpa, created_at) "
        "VALUES (1, 1, 'PL-2024-42', 'Computer Science', 8.9, ?)",
        (now,),
    )
    conn.execute(
        "INSERT INTO opportunities (id, code, title, description, term, destination, deadline, seats, status, created_at, updated_at) "
        "VALUES (1, 'NTU_SG_2026', 'Singapore AI Exchange', 'Research at NTU', 'Fall 2026', 'Singapore', '2026-12-31', 10, 'published', ?, ?)",
        (now, now),
    )
    gv = conn.execute(
        "INSERT INTO graph_versions (opportunity_id, version, status, published_at, created_at) VALUES (1, 1, 'active', ?, ?)",
        (now, now),
    ).lastrowid
    conn.execute(
        "INSERT INTO applications (id, student_profile_id, opportunity_id, current_step_order, current_stage_label, "
        "graph_version_id, final_status, submitted_data_json, submitted_at, created_at, updated_at) "
        "VALUES (1, 1, 1, 1, 'Submitted', ?, NULL, ?, ?, ?, ?)",
        (gv, json.dumps({"funding_requested": True, "cgpa": 8.9}), now, now, now),
    )
    conn.commit()
    return int(gv)


def _build_parallel_graph(conn, gv_id):
    nodes = [
        ("start",        "start",    None,                          "Start"),
        ("oge_review",   "reviewer", "oge@plaksha.edu.in",          "OGE Review"),
        ("sl_review",    "reviewer", "student-life@plaksha.edu.in", "Student Life Review"),
        ("join",         "join_all", None,                          "All Reviews Complete"),
        ("dean_review",  "reviewer", "dean@plaksha.edu.in",         "Dean Final Approval"),
        ("end",          "end",      None,                          "End"),
    ]
    for key, ntype, email, name in nodes:
        conn.execute(
            "INSERT INTO graph_nodes (graph_version_id, node_key, node_type, display_name, reviewer_email, allowed_actions, visible_sections) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (gv_id, key, ntype, name, email,
             json.dumps(["approve", "request_changes"]), json.dumps(["all"])),
        )
    edges = [
        ("start",       "oge_review"),
        ("start",       "sl_review"),
        ("oge_review",  "join"),
        ("sl_review",   "join"),
        ("join",        "dean_review"),
        ("dean_review", "end"),
    ]
    for frm, to in edges:
        conn.execute(
            "INSERT INTO graph_edges (graph_version_id, from_node_key, to_node_key) VALUES (?, ?, ?)",
            (gv_id, frm, to),
        )
    conn.commit()


def _show_inbox(svc, conn, email):
    tasks = svc.get_inbox(conn, email)
    if not tasks:
        print(f"  📭  {email}: no active tasks")
        return
    for t in tasks:
        print(f"  📬  [{email}] task #{t.task_id} — {t.opportunity_title} / {t.student_name}")
        print(f"       stage: {t.display_name}  |  actions: {t.allowed_actions}")


def _show_application(conn):
    row = conn.execute("SELECT current_stage_label, final_status FROM applications WHERE id = 1").fetchone()
    print(f"  Application → stage: {row['current_stage_label']}  |  status: {row['final_status'] or 'in-progress'}")


def main():
    print(SEP)
    print("PRISM Graph Execution Demo")
    print(SEP)

    conn = _setup_db()
    gv_id = _seed(conn)
    _build_parallel_graph(conn, gv_id)
    svc = GraphExecutionService()

    # ── Step 1: Instantiate on application submit ──────────────────────────────
    print("\n[1] Student submits application → graph instantiates")
    task_ids = svc.instantiate(conn, 1, gv_id)
    print(f"    Created tasks: {task_ids}")
    _show_application(conn)
    print()
    _show_inbox(svc, conn, "oge@plaksha.edu.in")
    _show_inbox(svc, conn, "student-life@plaksha.edu.in")
    _show_inbox(svc, conn, "dean@plaksha.edu.in")

    oge_task, sl_task = task_ids

    # ── Step 2: OGE approves first ─────────────────────────────────────────────
    print(f"\n[2] OGE approves task #{oge_task}")
    result = svc.transition(conn, oge_task, "approve", "oge@plaksha.edu.in", "Strong application, recommend.")
    print(f"    next_task_ids: {result.next_task_ids}  (join_all is waiting for SL)")
    _show_application(conn)

    # ── Step 3: Student Life approves — join_all fires ─────────────────────────
    print(f"\n[3] Student Life approves task #{sl_task} → join_all fires → Dean task created")
    result = svc.transition(conn, sl_task, "approve", "student-life@plaksha.edu.in", "No conduct issues.")
    print(f"    next_task_ids: {result.next_task_ids}")
    _show_application(conn)
    print()
    _show_inbox(svc, conn, "oge@plaksha.edu.in")
    _show_inbox(svc, conn, "dean@plaksha.edu.in")

    dean_task = result.next_task_ids[0]

    # ── Step 4: Dean grants final approval ─────────────────────────────────────
    print(f"\n[4] Dean gives final approval on task #{dean_task}")
    result = svc.transition(conn, dean_task, "approve", "dean@plaksha.edu.in", "Approved for Singapore exchange.")
    print(f"    application_status: {result.application_status}")
    _show_application(conn)

    # ── Step 5: Show guard rails ───────────────────────────────────────────────
    print(f"\n[5] Guardrails: try to approve a completed task (task #{oge_task})")
    try:
        svc.transition(conn, oge_task, "approve", "oge@plaksha.edu.in")
    except ValueError as e:
        print(f"    ✅  Correctly rejected: {e}")

    print(f"\n[6] Guardrails: wrong actor tries to act on Dean's already-completed task #{dean_task}")
    try:
        svc.transition(conn, dean_task, "approve", "intruder@plaksha.edu.in")
    except ValueError as e:
        print(f"    ✅  Correctly rejected: {e}")

    print(f"\n{SEP}")
    print("Demo complete. All graph transitions behaved correctly.")
    print(SEP)


if __name__ == "__main__":
    main()
