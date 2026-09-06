from __future__ import annotations

import pytest
from pydantic import ValidationError

from fastapi_app.graph_models import GraphModel
from fastapi_app.graph_validation import GraphPolicyValidator


def reviewer(key: str, email: str, **overrides):
    value = {
        "node_key": key,
        "node_type": "reviewer",
        "display_name": key.title(),
        "reviewer_email": email,
        "visible_sections": ["full_name"],
        "allowed_actions": ["approve", "request_changes", "comment"],
        "metadata": {},
    }
    value.update(overrides)
    return value


def graph_with_levels(*levels):
    return GraphModel(
        levels=[{"id": level_id, "name": name, "reviewers": reviewers} for level_id, name, reviewers in levels]
    )


def test_ordered_levels_compile_to_parallel_reviewers_and_unanimous_joins():
    graph = graph_with_levels(
        (
            "eligibility",
            "Eligibility",
            [
                reviewer("academic", "academic@plaksha.edu.in"),
                reviewer("conduct", "conduct@plaksha.edu.in"),
            ],
        ),
        ("nomination", "Nomination", [reviewer("dean", "dean@plaksha.edu.in")]),
    )

    assert [node.node_key for node in graph.nodes] == [
        "start",
        "academic",
        "conduct",
        "join_eligibility",
        "dean",
        "join_nomination",
        "end",
    ]
    assert {(edge.from_node_key, edge.to_node_key, edge.action) for edge in graph.edges} == {
        ("start", "academic", "always"),
        ("start", "conduct", "always"),
        ("academic", "join_eligibility", "approve"),
        ("conduct", "join_eligibility", "approve"),
        ("join_eligibility", "dean", "always"),
        ("dean", "join_nomination", "approve"),
        ("join_nomination", "end", "always"),
    }
    assert graph.nodes[1].metadata.level_id == "eligibility"
    assert graph.nodes[1].metadata.level_name == "Eligibility"


@pytest.mark.parametrize("node_type", ["join_any", "conditional"])
def test_legacy_branching_graph_nodes_are_rejected(node_type):
    with pytest.raises(ValidationError, match="ordered unanimous review levels"):
        GraphModel(
            nodes=[
                {"node_key": "start", "node_type": "start"},
                {"node_key": "branch", "node_type": node_type},
                {"node_key": "end", "node_type": "end"},
            ],
            edges=[
                {"from_node_key": "start", "to_node_key": "branch"},
                {"from_node_key": "branch", "to_node_key": "end"},
            ],
        )


def test_validator_requires_a_nonempty_level_and_explicit_field_grants():
    empty = GraphModel(levels=[])
    assert GraphPolicyValidator().validate_graph(empty, ["full_name"]) == ["Add at least one review level."]

    graph = graph_with_levels(
        ("review", "Review", [reviewer("review", "reviewer@plaksha.edu.in", visible_sections=["all"])])
    )
    errors = GraphPolicyValidator().validate_graph(graph, ["full_name"])
    assert "Review: select explicit visible fields instead of all." in errors


def test_validator_rejects_duplicate_people_and_reviewer_owned_field_ids():
    repeated = reviewer(
        "second",
        "same@plaksha.edu.in",
        metadata={
            "required_inputs": [
                {"input_key": "full_name", "label": "Result", "input_type": "text", "required": True}
            ]
        },
    )
    graph = graph_with_levels(
        (
            "review",
            "Review",
            [reviewer("first", "same@plaksha.edu.in"), repeated],
        )
    )
    errors = GraphPolicyValidator().validate_graph(graph, ["full_name"])
    assert "Review: assign each person only once per level." in errors
    assert "Each reviewer field must have a unique ID, distinct from student fields." in errors


def test_return_targets_must_point_to_student_or_an_earlier_level():
    graph = graph_with_levels(
        (
            "first",
            "First",
            [
                reviewer(
                    "first_review",
                    "first@plaksha.edu.in",
                    metadata={"return_target": "later"},
                )
            ],
        ),
        ("later", "Later", [reviewer("later_review", "later@plaksha.edu.in")]),
    )
    assert "First Review: return target must be the student or an earlier level." in GraphPolicyValidator().validate_graph(
        graph, ["full_name"]
    )


def test_valid_ordered_levels_pass_policy_validation():
    graph = graph_with_levels(
        ("checks", "Checks", [reviewer("check", "check@plaksha.edu.in")]),
        (
            "final",
            "Final",
            [
                reviewer(
                    "final",
                    "final@plaksha.edu.in",
                    metadata={"return_target": "checks"},
                )
            ],
        ),
    )
    assert GraphPolicyValidator().validate_graph(graph, ["full_name"]) == []
