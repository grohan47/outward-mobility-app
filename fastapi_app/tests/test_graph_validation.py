import unittest

from pydantic import ValidationError

from fastapi_app.graph_models import GraphEdgeModel, GraphModel, GraphNodeModel
from fastapi_app.graph_validation import GraphPolicyValidator


def linear_graph() -> GraphModel:
    return GraphModel(
        nodes=[
            GraphNodeModel(node_key="start", node_type="start"),
            GraphNodeModel(
                node_key="oge_review",
                node_type="reviewer",
                display_name="OGE Review",
                reviewer_email="oge@plaksha.edu.in",
            ),
            GraphNodeModel(node_key="end", node_type="end"),
        ],
        edges=[
            GraphEdgeModel(from_node_key="start", to_node_key="oge_review"),
            GraphEdgeModel(from_node_key="oge_review", to_node_key="end"),
        ],
    )


class GraphPolicyValidatorTests(unittest.TestCase):
    def setUp(self):
        self.validator = GraphPolicyValidator()

    def test_valid_linear_graph_passes(self):
        self.assertEqual(self.validator.validate_graph(linear_graph()), [])

    def test_missing_start_node_fails(self):
        graph = GraphModel(
            nodes=[
                GraphNodeModel(node_key="review", node_type="reviewer", reviewer_email="oge@plaksha.edu.in"),
                GraphNodeModel(node_key="end", node_type="end"),
            ],
            edges=[GraphEdgeModel(from_node_key="review", to_node_key="end")],
        )

        self.assertIn("Graph must have exactly one start node", self.validator.validate_graph(graph))

    def test_reviewer_missing_email_fails(self):
        graph = GraphModel(
            nodes=[
                GraphNodeModel(node_key="start", node_type="start"),
                GraphNodeModel(node_key="review", node_type="reviewer"),
                GraphNodeModel(node_key="end", node_type="end"),
            ],
            edges=[
                GraphEdgeModel(from_node_key="start", to_node_key="review"),
                GraphEdgeModel(from_node_key="review", to_node_key="end"),
            ],
        )

        self.assertIn("Reviewer node 'review' missing reviewer_email", self.validator.validate_graph(graph))

    def test_unsupported_operator_fails(self):
        graph = linear_graph()
        graph.edges[0].condition_json = {"op": "python_eval", "field": "funding_requested", "value": True}

        self.assertIn("Condition uses unsupported operator 'python_eval'", self.validator.validate_graph(graph))

    def test_unknown_field_fails(self):
        graph = linear_graph()
        graph.edges[0].condition_json = {"op": "equals", "field": "not_a_field", "value": True}

        self.assertIn(
            "Condition references unknown field 'not_a_field'",
            self.validator.validate_graph(graph, known_fields=["funding_requested"]),
        )

    def test_unknown_edge_node_fails(self):
        graph = linear_graph()
        graph.edges.append(GraphEdgeModel(from_node_key="missing", to_node_key="end"))

        self.assertIn("Edge references unknown from_node_key 'missing'", self.validator.validate_graph(graph))

    def test_invalid_node_type_is_rejected_by_model_contract(self):
        with self.assertRaises(ValidationError):
            GraphNodeModel(node_key="unsafe", node_type="script")  # type: ignore[arg-type]


if __name__ == "__main__":
    unittest.main()
