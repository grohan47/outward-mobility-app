"""Versioned form reads and field-level response projection."""

import json
import math
from fastapi import HTTPException


def version_definition(db, version_id):
    row = db.execute(
        "SELECT definition_json FROM graph_versions WHERE id=?", (version_id,)
    ).fetchone()
    return json.loads(row[0]) if row and row[0] else {}


def form_schema(db, app):
    snapshot = version_definition(db, app["graph_version_id"])
    if "form_schema" in snapshot:
        return snapshot["form_schema"]
    rows = db.execute(
        "SELECT f.* FROM opportunity_required_fields r JOIN form_field_catalog f ON f.field_key=r.field_key WHERE r.opportunity_id=? ORDER BY r.display_order",
        (app["opportunity_id"],),
    )
    return [{**dict(r), "options": json.loads(r["options_json"] or "[]")} for r in rows]


def validate_submission(schema, data):
    if set(data) - {f["field_key"] for f in schema}:
        raise HTTPException(400, "Submission contains unknown or reviewer-owned fields")
    for f in schema:
        value = data.get(f["field_key"])
        if (
            value is None
            or value == ""
            or value == []
            or (isinstance(value, str) and not value.strip())
        ):
            raise HTTPException(400, f"Missing required field: {f['label']}")
        kind = f["input_type"]
        if kind == "number":
            try:
                if isinstance(value, bool) or not math.isfinite(float(value)):
                    raise ValueError()
            except (ValueError, TypeError):
                raise HTTPException(400, f"Invalid number: {f['label']}") from None
        elif kind in {"single_select", "select", "dropdown"} and value not in f.get(
            "options", []
        ):
            raise HTTPException(400, f"Invalid option: {f['label']}")
        elif kind == "multiselect":
            if not isinstance(value, list) or any(
                v not in f.get("options", []) for v in value
            ):
                raise HTTPException(400, f"Invalid selection: {f['label']}")
        elif not isinstance(value, str):
            raise HTTPException(400, f"Expected text: {f['label']}")


def detail(db, app_id):
    app = db.execute("SELECT * FROM applications WHERE id=?", (app_id,)).fetchone()
    if not app:
        return None
    app = dict(app)
    opportunity = dict(
        db.execute(
            "SELECT * FROM opportunities WHERE id=?", (app["opportunity_id"],)
        ).fetchone()
    )
    snapshot = version_definition(db, app["graph_version_id"])
    opportunity.update(snapshot.get("opportunity", {}))
    profile = dict(
        db.execute(
            "SELECT * FROM student_profiles WHERE id=?", (app["student_profile_id"],)
        ).fetchone()
    )
    user = dict(
        db.execute(
            "SELECT id,email,full_name FROM users WHERE id=?", (profile["user_id"],)
        ).fetchone()
    )
    nodes = [
        {**dict(r), "metadata": json.loads(r["metadata"] or "{}")}
        for r in db.execute(
            "SELECT * FROM graph_nodes WHERE graph_version_id=? AND node_type='reviewer' ORDER BY id",
            (app["graph_version_id"],),
        )
    ]
    tasks = [
        dict(r)
        for r in db.execute(
            "SELECT * FROM application_workflow_tasks WHERE application_id=? ORDER BY id",
            (app_id,),
        )
    ]
    values = json.loads(app["submitted_data_json"] or "{}")
    labels = {f["field_key"]: f["label"] for f in form_schema(db, app)}
    for n in nodes:
        labels.update(
            {
                f["input_key"]: f["label"]
                for f in n["metadata"].get("required_inputs", [])
            }
        )
    reviews = []
    for t in tasks:
        outputs = json.loads(t["reviewer_data_json"] or "{}")
        if t["status"] == "completed":
            values.update(outputs)
        if t["decision"]:
            reviews.append(
                {
                    "id": t["id"],
                    "reviewer_email": t["assigned_reviewer_email"],
                    "reviewer_name": t["assigned_reviewer_email"],
                    "reviewer_role": "REVIEWER",
                    "decision": t["decision"].upper(),
                    "remarks": t["comment_summary"],
                    "required_inputs": outputs,
                    "created_at": t["acted_at"],
                    "status": t["status"],
                    "attempt": t["attempt"],
                }
            )
    timeline = [
        {**dict(r), "event_payload": json.loads(r["event_payload_json"] or "{}")}
        for r in db.execute(
            "SELECT * FROM timeline_events WHERE application_id=? ORDER BY id",
            (app_id,),
        )
    ]
    levels = []
    for n in nodes:
        level_name = n["metadata"].get("level_name", n["display_name"])
        if level_name not in levels:
            levels.append(level_name)
    return {
        "application": app,
        "opportunity": opportunity,
        "student_profile": profile,
        "student_user": user,
        "reviews": reviews,
        "comments": [
            dict(r)
            for r in db.execute(
                "SELECT * FROM application_comments WHERE application_id=? ORDER BY id",
                (app_id,),
            )
        ],
        "timeline": timeline,
        "pipeline_steps": [
            {"step_order": i + 1, "step_name": name} for i, name in enumerate(levels)
        ],
        "workflow": {
            "stageCode": app["current_stage_label"],
            "stageLabel": app["current_stage_label"],
            "currentStakeholder": app["current_stage_label"],
            "finalStatus": app["final_status"],
        },
        "application_file": values,
        "field_labels": labels,
        "form_schema": form_schema(db, app),
        "graph_tasks": tasks,
    }


def project(db, data, session):
    if session.role == "ADMIN":
        data["permissions"] = {"can_view_comments": True}
        return data
    app = data["application"]
    opportunity = data["opportunity"]
    opportunity["detail_fields"] = [
        field
        for field in opportunity.get("detail_fields", [])
        if field.get("is_student_visible", field.get("isStudentVisible", True))
    ]
    opportunity.pop("created_by_email", None)
    if session.role == "STUDENT":
        allowed = set(json.loads(app["submitted_data_json"] or "{}"))
        for row in db.execute(
            "SELECT metadata FROM graph_nodes WHERE graph_version_id=?",
            (app["graph_version_id"],),
        ):
            allowed.update(json.loads(row[0] or "{}").get("student_visible_fields", []))
        comments = [
            c
            for c in data["comments"]
            if c["visibility"] == "student_visible"
            or c["author_email"] == session.email
        ]
        data["reviews"] = []
        data["permissions"] = {"can_view_comments": True}
    else:
        task = db.execute(
            "SELECT * FROM application_workflow_tasks WHERE application_id=? AND status='active' AND LOWER(assigned_reviewer_email)=LOWER(?) ORDER BY id LIMIT 1",
            (app["id"], session.email),
        ).fetchone()
        if not task:
            raise HTTPException(403, "No active review task")
        node = db.execute(
            "SELECT * FROM graph_nodes WHERE graph_version_id=? AND node_key=?",
            (app["graph_version_id"], task["node_key"]),
        ).fetchone()
        meta = json.loads(node["metadata"] or "{}")
        allowed = set(json.loads(node["visible_sections"] or "[]"))
        allowed.update(f["input_key"] for f in meta.get("required_inputs", []))
        can_read = bool(meta.get("can_view_comments", False))
        comments = [
            c
            for c in data["comments"]
            if c["visibility"] == "student_visible"
            or (can_read and c["visibility"] == "internal")
            or c["author_email"] == session.email
        ]
        data["permissions"] = {
            "can_view_comments": can_read
            or "comment" in json.loads(node["allowed_actions"] or "[]")
        }
        data[
            "reviews"
        ] = []  # Field grants expose outputs; history does not bypass them.
        data["graph_node_info"] = {
            "node_key": node["node_key"],
            "task_id": task["id"],
            "display_name": node["display_name"],
            "allowed_actions": json.loads(node["allowed_actions"] or "[]"),
            "visible_sections": sorted(allowed),
            "required_inputs": meta.get("required_inputs", []),
            "return_target": meta.get("return_target", "student"),
        }
        data["student_user"] = {
            k: v for k, v in data["student_user"].items() if k in allowed
        }
        data["student_profile"] = {
            k: v
            for k, v in data["student_profile"].items()
            if {"official_cgpa": "cgpa"}.get(k, k) in allowed
        }
        data["form_schema"] = [
            f for f in data["form_schema"] if f["field_key"] in allowed
        ]
    data["comments"] = comments
    data["application_file"] = {
        k: v for k, v in data["application_file"].items() if k in allowed
    }
    data["field_labels"] = {
        k: v for k, v in data["field_labels"].items() if k in allowed
    }
    app["submitted_data_json"] = json.dumps(data["application_file"])
    app.pop("workflow_notes", None)
    data.pop("graph_tasks", None)
    for event in data["timeline"]:
        event["event_payload"] = {
            k: v
            for k, v in event["event_payload"].items()
            if k in {"decision", "level_id", "attempt", "to_stage", "target"}
        }
        event.pop("event_payload_json", None)
        event.pop("actor_email", None)
    return data
