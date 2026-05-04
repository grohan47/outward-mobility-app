from __future__ import annotations

from typing import Any

from fastapi_app.graph_models import GraphModel


class GraphPolicyValidator:
    """
    Validates the deterministic subset of workflow graph behavior PRISM can execute.

    Accepted flow:
      start -> reviewer/conditional/join -> ... -> end

    Conditions are a small predicate DSL, not arbitrary code:
      {"op": "equals", "field": "funding_requested", "value": true}
      {"op": "all_of", "conditions": [{...}, {...}]}
    """

    ALLOWED_OPERATORS = {"equals", "in", "gt", "lt", "gte", "lte", "all_of", "any_of"}
    VALID_NODE_TYPES = {"start", "reviewer", "join_all", "join_any", "conditional", "end"}

    def validate_graph(self, graph: GraphModel, known_fields: list[str] | None = None) -> list[str]:
        known_fields = known_fields or []
        errors: list[str] = []
        node_keys = [node.node_key for node in graph.nodes]
        node_key_set = set(node_keys)

        if len(node_keys) != len(node_key_set):
            errors.append("Graph node keys must be unique")

        start_nodes = [node for node in graph.nodes if node.node_type == "start"]
        end_nodes = [node for node in graph.nodes if node.node_type == "end"]
        if len(start_nodes) != 1:
            errors.append("Graph must have exactly one start node")
        if len(end_nodes) < 1:
            errors.append("Graph must have at least one end node")

        for node in graph.nodes:
            if node.node_type not in self.VALID_NODE_TYPES:
                errors.append(f"Unsupported node type '{node.node_type}' on '{node.node_key}'")
            if node.node_type == "reviewer" and not node.reviewer_email:
                errors.append(f"Reviewer node '{node.node_key}' missing reviewer_email")

        for edge in graph.edges:
            if edge.from_node_key not in node_key_set:
                errors.append(f"Edge references unknown from_node_key '{edge.from_node_key}'")
            if edge.to_node_key not in node_key_set:
                errors.append(f"Edge references unknown to_node_key '{edge.to_node_key}'")
            if edge.condition_json:
                errors.extend(self._validate_condition(edge.condition_json, known_fields))

        return errors

    def _validate_condition(self, condition: dict[str, Any], known_fields: list[str]) -> list[str]:
        errors: list[str] = []
        op = condition.get("op")
        if op not in self.ALLOWED_OPERATORS:
            errors.append(f"Condition uses unsupported operator '{op}'")
            return errors

        if op in {"all_of", "any_of"}:
            child_conditions = condition.get("conditions")
            if not isinstance(child_conditions, list) or not child_conditions:
                errors.append(f"Condition operator '{op}' requires a non-empty conditions list")
                return errors
            for child in child_conditions:
                if not isinstance(child, dict):
                    errors.append(f"Condition operator '{op}' contains a non-object child condition")
                    continue
                errors.extend(self._validate_condition(child, known_fields))
            return errors

        field = condition.get("field")
        if not field:
            errors.append(f"Condition operator '{op}' requires a field")
        elif known_fields and field not in known_fields:
            errors.append(f"Condition references unknown field '{field}'")

        if op == "in" and not isinstance(condition.get("value"), list):
            errors.append("Condition operator 'in' requires value to be a list")

        return errors
