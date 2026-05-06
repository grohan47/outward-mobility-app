"""
Integration tests — validate AI extraction against demo email fixtures.

Requires: ANTHROPIC_API_KEY set in environment.
Run with:  pytest fastapi_app/tests/test_ai_extraction.py -v -m integration

Each test calls the real Claude API and validates that the output:
  1. Parses as AIWorkflowDraftOutput (Pydantic validation)
  2. Has a non-empty title, at least one detail_field, and a valid graph
  3. Meets opportunity-specific assertions (deadline extracted, etc.)
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "demo_emails"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("""
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
    conn.commit()
    return conn


def _load_email(filename: str) -> str:
    return (FIXTURES_DIR / filename).read_text()


def _generate(email_text: str) -> dict:
    from fastapi_app.ai_workflow import AIWorkflowDraftService
    from fastapi_app.graph_models import AIWorkflowDraftOutput

    db = _make_db()
    row = AIWorkflowDraftService().generate_draft(db, "test@plaksha.edu.in", email_text)
    assert row["draft_output"], "draft_output must not be empty"
    parsed = AIWorkflowDraftOutput.model_validate_json(row["draft_output"])
    return {"row": row, "parsed": parsed}


def _assert_graph_valid(parsed) -> None:
    nodes = parsed.graph.nodes
    edges = parsed.graph.edges
    node_keys = {n.node_key for n in nodes}
    node_types = {n.node_key: n.node_type for n in nodes}

    start_nodes = [n for n in nodes if n.node_type == "start"]
    end_nodes = [n for n in nodes if n.node_type == "end"]
    assert len(start_nodes) == 1, f"Expected exactly 1 start node, got {len(start_nodes)}"
    assert len(end_nodes) >= 1, f"Expected at least 1 end node, got {len(end_nodes)}"

    for edge in edges:
        assert edge.from_node_key in node_keys, f"Edge from unknown node: {edge.from_node_key}"
        assert edge.to_node_key in node_keys, f"Edge to unknown node: {edge.to_node_key}"

    reviewer_nodes = [n for n in nodes if n.node_type == "reviewer"]
    for node in reviewer_nodes:
        assert node.reviewer_email, f"Reviewer node {node.node_key} has no email"
        assert "comment" in node.allowed_actions, f"Reviewer {node.node_key} missing 'comment' in allowed_actions"
        assert node.metadata.sla_hours >= 24, f"Reviewer {node.node_key} has sla_hours < 24"


def _assert_form_fields_valid(parsed) -> None:
    assert parsed.applicant_form_fields, "applicant_form_fields must not be empty"
    required = {"full_name", "student_id", "email", "cgpa"}
    present = set(parsed.applicant_form_fields)
    missing = required - present
    assert not missing, f"Required form fields missing: {missing}"


def _assert_has_deadline(parsed) -> None:
    deadline_fields = [f for f in parsed.opportunity.detail_fields if f.get("field_key") == "application_deadline"]
    assert deadline_fields, "Expected application_deadline in detail_fields"
    assert deadline_fields[0].get("value_type") == "date"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_daad_wise_scholarship_extraction():
    """DAAD WISE: research internship Germany. No explicit chain -> standard pathway expected."""
    result = _generate(_load_email("01_daad_wise_scholarship.txt"))
    parsed = result["parsed"]

    assert "DAAD" in parsed.opportunity.title or "WISE" in parsed.opportunity.title or "Germany" in parsed.opportunity.title
    assert parsed.opportunity.funding_available is True
    _assert_graph_valid(parsed)
    _assert_form_fields_valid(parsed)
    _assert_has_deadline(parsed)

    # Should infer resume required (email explicitly mentions CV)
    assert "resume_url" in parsed.applicant_form_fields

    # Deadline extracted: April 25 2026
    deadline_field = next(f for f in parsed.opportunity.detail_fields if f["field_key"] == "application_deadline")
    assert "2026" in deadline_field["value"]

    # CGPA threshold in detail fields or eligibility
    assert parsed.opportunity.eligibility_criteria or any(
        "cgpa" in f["field_key"].lower() or "8.0" in str(f.get("value", ""))
        for f in parsed.opportunity.detail_fields
    )

    print(f"\n[DAAD] title={parsed.opportunity.title!r}")
    print(f"[DAAD] confidence={parsed.confidence:.2f}, warnings={parsed.warnings}")
    print(f"[DAAD] graph_nodes={[n.node_key for n in parsed.graph.nodes]}")
    print(f"[DAAD] form_fields={parsed.applicant_form_fields}")


@pytest.mark.integration
def test_mitacs_globalink_extraction():
    """Mitacs Globalink: Canada research. Mentions Program Chair + OAA endorsement explicitly."""
    result = _generate(_load_email("02_mitacs_globalink.txt"))
    parsed = result["parsed"]

    assert parsed.opportunity.title
    assert parsed.opportunity.funding_available is True  # CAD 6,000 fellowship
    _assert_graph_valid(parsed)
    _assert_form_fields_valid(parsed)
    _assert_has_deadline(parsed)

    # Deadline: Jan 31 2026 (internal), Feb 28 (Mitacs)
    deadline_field = next(f for f in parsed.opportunity.detail_fields if f["field_key"] == "application_deadline")
    assert "2026" in deadline_field["value"]

    print(f"\n[MITACS] title={parsed.opportunity.title!r}")
    print(f"[MITACS] confidence={parsed.confidence:.2f}")
    print(f"[MITACS] reviewer_nodes={[n.node_key for n in parsed.graph.nodes if n.node_type == 'reviewer']}")
    print(f"[MITACS] form_fields={parsed.applicant_form_fields}")


@pytest.mark.integration
def test_nus_soc_semester_exchange_extraction():
    """NUS SoC exchange: no funding, strict CGPA, explicit final-year exclusion."""
    result = _generate(_load_email("03_nus_soc_semester_exchange.txt"))
    parsed = result["parsed"]

    assert "NUS" in parsed.opportunity.title or "Singapore" in parsed.opportunity.title or "Computing" in parsed.opportunity.title
    assert parsed.opportunity.funding_available is False  # No financial support stated
    _assert_graph_valid(parsed)
    _assert_form_fields_valid(parsed)
    _assert_has_deadline(parsed)

    deadline_field = next(f for f in parsed.opportunity.detail_fields if f["field_key"] == "application_deadline")
    assert "2026" in deadline_field["value"]

    print(f"\n[NUS SoC] title={parsed.opportunity.title!r}")
    print(f"[NUS SoC] confidence={parsed.confidence:.2f}")
    print(f"[NUS SoC] graph_nodes={[n.node_key for n in parsed.graph.nodes]}")


@pytest.mark.integration
def test_eth_zurich_masters_batch_inference():
    """ETH Zurich ESOP: master's level -> PRISM must infer eligible_batch = UG 2022."""
    result = _generate(_load_email("04_eth_zurich_excellence_masters.txt"))
    parsed = result["parsed"]

    assert parsed.opportunity.title
    assert parsed.opportunity.funding_available is True  # CHF 11,000 stipend
    _assert_graph_valid(parsed)
    _assert_form_fields_valid(parsed)

    # Key assertion: batch inference
    batch_fields = [f for f in parsed.opportunity.detail_fields if "batch" in f["field_key"].lower() or "2022" in str(f.get("value", ""))]
    assert batch_fields or (parsed.opportunity.eligibility_criteria and "2022" in parsed.opportunity.eligibility_criteria), (
        "Master's opportunity should infer eligible_batch = UG 2022. "
        f"detail_fields keys: {[f['field_key'] for f in parsed.opportunity.detail_fields]}"
    )

    # Deadline: Feb 15 2026 (internal)
    deadline_field = next((f for f in parsed.opportunity.detail_fields if f["field_key"] == "application_deadline"), None)
    if deadline_field:
        assert "2026" in deadline_field["value"]

    print(f"\n[ETH] title={parsed.opportunity.title!r}")
    print(f"[ETH] confidence={parsed.confidence:.2f}")
    print(f"[ETH] detail_field_keys={[f['field_key'] for f in parsed.opportunity.detail_fields]}")
    print(f"[ETH] eligibility_criteria={parsed.opportunity.eligibility_criteria!r}")


@pytest.mark.integration
def test_penn_wharton_leadership_extraction():
    """Penn Wharton GYLI: leadership / non-technical, near-zero cost, custom form fields expected."""
    result = _generate(_load_email("05_penn_wharton_leadership.txt"))
    parsed = result["parsed"]

    assert "Wharton" in parsed.opportunity.title or "Penn" in parsed.opportunity.title or "Leadership" in parsed.opportunity.title
    assert parsed.opportunity.funding_available is True  # Fee waiver + airfare
    _assert_graph_valid(parsed)
    _assert_form_fields_valid(parsed)
    _assert_has_deadline(parsed)

    deadline_field = next(f for f in parsed.opportunity.detail_fields if f["field_key"] == "application_deadline")
    assert "2026" in deadline_field["value"]

    print(f"\n[WHARTON] title={parsed.opportunity.title!r}")
    print(f"[WHARTON] confidence={parsed.confidence:.2f}")
    print(f"[WHARTON] form_fields={parsed.applicant_form_fields}")


@pytest.mark.integration
def test_ntu_demo_fixture_golden_path():
    """Golden path: NTU Singapore demo email. Validates the primary demo scenario end-to-end."""
    email = """Subject: Summer 2026 AI/Robotics Research Exchange — NTU Singapore (UG 2023 only)

Dear OGE Team,

NTU Singapore has confirmed 5 seats for Plaksha students in their Summer 2026 AI and Robotics Research Exchange Programme (July 1 – August 31, 2026).

Eligibility: Open exclusively to UG 2023 batch students. Minimum CGPA 7.5. No active backlogs.

Funding: Plaksha covers the programme fee (SGD 1,200). Students fund travel and accommodation (~SGD 1,800/month). Need-based travel grants available via the scholarship office.

Application deadline: June 15, 2026. Nomination list due to NTU: June 20, 2026.

Required documents: CV/resume, statement of purpose (500 words), unofficial transcript.

Approval process: All nominations require OAA clearance (no backlogs), UG Academics CGPA verification, Program Chair review, then Dean approval before OGE submits to NTU.

Contact: oge@plaksha.edu.in
"""
    result = _generate(email)
    parsed = result["parsed"]

    # Title extraction
    assert "NTU" in parsed.opportunity.title or "Singapore" in parsed.opportunity.title

    # Explicit approval chain should be detected — standard pathway or equivalent
    reviewer_keys = {n.node_key for n in parsed.graph.nodes if n.node_type == "reviewer"}
    assert len(reviewer_keys) >= 3, f"Expected >=3 reviewer nodes, got {reviewer_keys}"

    # Parallel structure (OAA + UG Academics in parallel)
    start_node = next(n for n in parsed.graph.nodes if n.node_type == "start")
    outgoing_from_start = [e for e in parsed.graph.edges if e.from_node_key == start_node.node_key]
    assert len(outgoing_from_start) >= 2, "start should fan out to at least 2 parallel reviewers"

    # join_all node present
    join_nodes = [n for n in parsed.graph.nodes if n.node_type == "join_all"]
    assert join_nodes, "Parallel approval requires a join_all node"

    # Form fields
    _assert_form_fields_valid(parsed)
    assert "resume_url" in parsed.applicant_form_fields  # CV mentioned

    # SLA on all reviewer nodes
    for node in parsed.graph.nodes:
        if node.node_type == "reviewer":
            assert node.metadata.sla_hours == 72, f"{node.node_key} sla_hours={node.metadata.sla_hours}, expected 72"

    # Funding available
    assert parsed.opportunity.funding_available is True

    print(f"\n[GOLDEN PATH] title={parsed.opportunity.title!r}")
    print(f"[GOLDEN PATH] confidence={parsed.confidence:.2f}")
    print(f"[GOLDEN PATH] nodes={[n.node_key for n in parsed.graph.nodes]}")
    print(f"[GOLDEN PATH] start_outgoing={[e.to_node_key for e in outgoing_from_start]}")
    print(f"[GOLDEN PATH] form_fields={parsed.applicant_form_fields}")
    print(f"[GOLDEN PATH] warnings={parsed.warnings}")


@pytest.mark.integration
def test_extraction_report(tmp_path):
    """Run all 5 fixture emails and dump a JSON extraction report for manual inspection."""
    fixtures = [
        "01_daad_wise_scholarship.txt",
        "02_mitacs_globalink.txt",
        "03_nus_soc_semester_exchange.txt",
        "04_eth_zurich_excellence_masters.txt",
        "05_penn_wharton_leadership.txt",
    ]
    report = []
    for fname in fixtures:
        try:
            result = _generate(_load_email(fname))
            parsed = result["parsed"]
            report.append({
                "file": fname,
                "status": "ok",
                "title": parsed.opportunity.title,
                "confidence": parsed.confidence,
                "is_fallback": parsed.is_fallback,
                "graph_nodes": [{"key": n.node_key, "type": n.node_type, "sla_hours": n.metadata.sla_hours if n.node_type == "reviewer" else None} for n in parsed.graph.nodes],
                "applicant_form_fields": parsed.applicant_form_fields,
                "detail_field_keys": [f["field_key"] for f in parsed.opportunity.detail_fields],
                "clarifying_questions": parsed.clarifying_questions,
                "warnings": parsed.warnings,
                "funding_available": parsed.opportunity.funding_available,
                "eligibility_criteria": parsed.opportunity.eligibility_criteria,
            })
        except Exception as exc:
            report.append({"file": fname, "status": "error", "error": str(exc)})

    report_path = Path("fastapi_app/tests/fixtures/extraction_report.json")
    report_path.write_text(json.dumps(report, indent=2))
    print(f"\nExtraction report written to {report_path}")
    for entry in report:
        status = "✓" if entry["status"] == "ok" else "✗"
        title = entry.get("title", entry.get("error", ""))
        conf = f"  conf={entry['confidence']:.2f}" if "confidence" in entry else ""
        print(f"  {status} {entry['file']}: {title!r}{conf}")

    failed = [e for e in report if e["status"] == "error"]
    assert not failed, f"Extraction failed for: {[e['file'] for e in failed]}"
