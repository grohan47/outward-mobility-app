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

    ALLOWED_OPERATORS = {
        "equals",
        "not_equals",
        "in",
        "not_in",
        "contains",
        "exists",
        "empty",
        "gt",
        "lt",
        "gte",
        "lte",
        "all_of",
        "any_of",
    }
    VALID_EDGE_ACTIONS = {"always", "approve", "reject", "request_changes", "condition_true", "condition_false"}
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
            if edge.from_node_key == edge.to_node_key:
                errors.append(f"Edge '{edge.from_node_key}' cannot point to itself")
            if edge.from_node_key not in node_key_set:
                errors.append(f"Edge references unknown from_node_key '{edge.from_node_key}'")
            if edge.to_node_key not in node_key_set:
                errors.append(f"Edge references unknown to_node_key '{edge.to_node_key}'")
            if edge.action and edge.action not in self.VALID_EDGE_ACTIONS:
                errors.append(f"Edge uses unsupported action '{edge.action}'")
            if edge.action in {"condition_true", "condition_false"} and not edge.condition_json:
                errors.append(f"Conditional route '{edge.from_node_key}' -> '{edge.to_node_key}' requires condition_json")
            if edge.condition_json:
                errors.extend(self._validate_condition(edge.condition_json, known_fields))

        edge_keys = [(edge.from_node_key, edge.to_node_key) for edge in graph.edges]
        if len(edge_keys) != len(set(edge_keys)):
            errors.append("Graph edges must be unique by from_node_key and to_node_key")

        if len(start_nodes) == 1:
            adjacency: dict[str, list[str]] = {key: [] for key in node_keys}
            for edge in graph.edges:
                if edge.from_node_key in node_key_set and edge.to_node_key in node_key_set:
                    adjacency.setdefault(edge.from_node_key, []).append(edge.to_node_key)
            reachable = self._reachable_from(start_nodes[0].node_key, adjacency)
            for node in graph.nodes:
                if node.node_key not in reachable:
                    errors.append(f"Graph node '{node.node_key}' is not reachable from start")
            for node in graph.nodes:
                if node.node_type != "end" and not self._can_reach_end(node.node_key, graph, adjacency):
                    errors.append(f"Graph node '{node.node_key}' cannot reach an end node")

        return errors

    def _reachable_from(self, start_key: str, adjacency: dict[str, list[str]]) -> set[str]:
        seen: set[str] = set()
        stack = [start_key]
        while stack:
            key = stack.pop()
            if key in seen:
                continue
            seen.add(key)
            stack.extend(adjacency.get(key, []))
        return seen

    def _can_reach_end(self, start_key: str, graph: GraphModel, adjacency: dict[str, list[str]]) -> bool:
        node_by_key = {node.node_key: node for node in graph.nodes}
        seen: set[str] = set()
        stack = [start_key]
        while stack:
            key = stack.pop()
            if key in seen:
                continue
            seen.add(key)
            node = node_by_key.get(key)
            if node and node.node_type == "end":
                return True
            stack.extend(adjacency.get(key, []))
        return False

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

        if op in {"in", "not_in"} and not isinstance(condition.get("value"), list):
            errors.append(f"Condition operator '{op}' requires value to be a list")
        if op not in {"exists", "empty"} and "value" not in condition:
            errors.append(f"Condition operator '{op}' requires a value")

        return errors
