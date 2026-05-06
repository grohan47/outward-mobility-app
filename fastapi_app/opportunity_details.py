from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from datetime import date
from typing import Any
from urllib.parse import urlparse

from fastapi import HTTPException


DETAIL_VALUE_TYPES = {"text", "number", "date"}


def slugify_detail_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_") or "detail"


def validate_cover_image_url(value: str | None) -> str | None:
    url = (value or "").strip()
    if not url:
        return None
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Cover image URL must be a valid https:// URL.")
    return url


def generate_unique_opportunity_code(conn: sqlite3.Connection, title: str) -> str:
    base = slugify_detail_key(title).upper()[:24] or "OPPORTUNITY"
    existing = conn.execute(
        "SELECT code FROM opportunities WHERE code = ? OR code LIKE ?",
        (base, f"{base}_%"),
    ).fetchall()
    used = {str(row["code"]).upper() for row in existing}
    if base not in used:
        return base
    suffix = 2
    while f"{base}_{suffix}" in used:
        suffix += 1
    return f"{base}_{suffix}"


def normalize_ai_summary_bullets(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            parsed = [line.strip("- ").strip() for line in value.splitlines()]
    else:
        parsed = value
    if not isinstance(parsed, list):
        raise HTTPException(status_code=400, detail="AI summary must be a list of bullet strings.")
    bullets = [str(item).strip() for item in parsed if str(item).strip()]
    return bullets[:8]


def parse_ai_summary_json(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item).strip() for item in parsed if str(item).strip()]


def normalize_detail_fields(raw_fields: Any) -> list[dict[str, Any]]:
    if raw_fields is None:
        return []
    if not isinstance(raw_fields, list):
        raise HTTPException(status_code=400, detail="Detail fields must be a list.")

    normalized: list[dict[str, Any]] = []
    used_keys: set[str] = set()
    for index, raw in enumerate(raw_fields, start=1):
        if not isinstance(raw, dict):
            raise HTTPException(status_code=400, detail=f"Detail field #{index} must be an object.")
        label = str(raw.get("label", "")).strip()
        value = str(raw.get("value", "")).strip()
        if not label and not value:
            continue
        if not label:
            raise HTTPException(status_code=400, detail=f"Detail field #{index} label cannot be empty.")

        base_key = slugify_detail_key(str(raw.get("field_key") or raw.get("key") or label))
        field_key = base_key
        suffix = 2
        while field_key in used_keys:
            field_key = f"{base_key}_{suffix}"
            suffix += 1
        used_keys.add(field_key)

        value_type = str(raw.get("value_type") or raw.get("valueType") or "text").strip().lower()
        if value_type not in DETAIL_VALUE_TYPES:
            value_type = "text"

        visible_value = raw.get("is_student_visible")
        if visible_value is None:
            visible_value = raw.get("isStudentVisible", True)

        normalized.append(
            {
                "field_key": field_key,
                "label": label,
                "value": value,
                "value_type": value_type,
                "display_order": int(raw.get("display_order") or raw.get("displayOrder") or index),
                "is_student_visible": 1 if visible_value else 0,
            }
        )
    return normalized


def fetch_detail_fields(conn: sqlite3.Connection, opportunity_id: int, *, visible_only: bool = False) -> list[dict[str, Any]]:
    visibility_clause = "AND is_student_visible = 1" if visible_only else ""
    rows = conn.execute(
        f"""
        SELECT id, opportunity_id, field_key, label, value, value_type, display_order, is_student_visible, created_at, updated_at
        FROM opportunity_detail_fields
        WHERE opportunity_id = ?
        {visibility_clause}
        ORDER BY display_order ASC, id ASC
        """,
        (opportunity_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def enforced_deadline(conn: sqlite3.Connection, opportunity_id: int) -> date | None:
    rows = conn.execute(
        """
        SELECT field_key, label, value
        FROM opportunity_detail_fields
        WHERE opportunity_id = ?
          AND is_student_visible = 1
          AND value_type = 'date'
        ORDER BY display_order ASC, id ASC
        """,
        (opportunity_id,),
    ).fetchall()
    for row in rows:
        field_key = str(row["field_key"] or "").lower()
        label = str(row["label"] or "").lower()
        if "deadline" not in field_key and "deadline" not in label:
            continue
        try:
            return date.fromisoformat(str(row["value"]))
        except ValueError:
            raise HTTPException(status_code=400, detail="Opportunity deadline is not a valid date.")
    return None


def replace_detail_fields(
    conn: sqlite3.Connection,
    opportunity_id: int,
    fields: list[dict[str, Any]],
    ts: str,
) -> None:
    conn.execute("DELETE FROM opportunity_detail_fields WHERE opportunity_id = ?", (opportunity_id,))
    for order, field in enumerate(fields, start=1):
        conn.execute(
            """
            INSERT INTO opportunity_detail_fields
              (opportunity_id, field_key, label, value, value_type, display_order, is_student_visible, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                opportunity_id,
                field["field_key"],
                field["label"],
                field["value"],
                field["value_type"],
                int(field.get("display_order") or order),
                int(field.get("is_student_visible", 1)),
                ts,
                ts,
            ),
        )


def summary_source_hash(opportunity: dict[str, Any], detail_fields: list[dict[str, Any]]) -> str:
    source = {
        "title": opportunity.get("title") or "",
        "description": opportunity.get("description") or "",
        "details": [
            {
                "label": field.get("label") or "",
                "value": field.get("value") or "",
                "visible": int(field.get("is_student_visible", 1)),
            }
            for field in detail_fields
        ],
    }
    raw = json.dumps(source, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
