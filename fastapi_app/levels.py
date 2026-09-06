"""A level is a unanimous group of reviewers. Forward edges are a derived view."""

from __future__ import annotations


def normalize_levels(graph: dict) -> list[dict]:
    if graph.get("levels") is not None:
        # GraphModel persists the derived forward nodes and edges alongside the
        # canonical levels. Levels remain the source of truth on a round-trip.
        return graph["levels"]
    nodes, edges = graph.get("nodes", []), graph.get("edges", [])
    if not nodes:
        return []
    if any(
        n["node_type"] not in {"start", "reviewer", "join_all", "end"} for n in nodes
    ):
        raise ValueError(
            "Use ordered unanimous review levels; conditional and join-any nodes are unsupported."
        )
    node_keys = [n["node_key"] for n in nodes]
    if len(set(node_keys)) != len(node_keys):
        raise ValueError("The imported workflow contains duplicate node IDs.")
    if (
        sum(n["node_type"] == "start" for n in nodes) != 1
        or sum(n["node_type"] == "end" for n in nodes) != 1
    ):
        raise ValueError(
            "The imported workflow must contain exactly one start and one end node."
        )
    if any(
        e["from_node_key"] not in node_keys or e["to_node_key"] not in node_keys
        for e in edges
    ):
        raise ValueError("The imported workflow contains an edge to an unknown node.")
    if any(
        e.get("condition_json") or e.get("action") not in {None, "always", "approve"}
        for e in edges
    ):
        raise ValueError(
            "The imported workflow contains an unsupported route or condition."
        )
    start = next(n["node_key"] for n in nodes if n["node_type"] == "start")
    end = next(n["node_key"] for n in nodes if n["node_type"] == "end")
    if any(e["to_node_key"] == start for e in edges) or any(
        e["from_node_key"] == end for e in edges
    ):
        raise ValueError("The imported workflow has an invalid start or end route.")
    if any(e["from_node_key"] == e["to_node_key"] for e in edges):
        raise ValueError("The imported workflow contains a self-referential route.")
    node_types = {node["node_key"]: node["node_type"] for node in nodes}
    for edge in edges:
        source, target = (
            node_types[edge["from_node_key"]],
            node_types[edge["to_node_key"]],
        )
        if source == "start" and (
            edge.get("action") not in {None, "always"}
            or target not in {"reviewer", "join_all"}
        ):
            raise ValueError("The imported workflow has an unsupported start route.")
        if source == "reviewer" and (
            edge.get("action") not in {None, "approve"}
            or target not in {"reviewer", "join_all", "end"}
        ):
            raise ValueError("The imported workflow has an unsupported reviewer route.")
        if source == "join_all" and (
            edge.get("action") not in {None, "always"}
            or target not in {"reviewer", "end"}
        ):
            raise ValueError("The imported workflow has an unsupported join route.")
    pending = set(node_keys)
    depth = {}
    while pending:
        progressed = False
        for node in nodes:
            key = node["node_key"]
            if key not in pending:
                continue
            parents = [e["from_node_key"] for e in edges if e["to_node_key"] == key]
            if key != start and not parents:
                raise ValueError(
                    f'The imported node "{key}" is disconnected from the start.'
                )
            if any(p not in depth for p in parents):
                continue
            depth[key] = max([depth[p] for p in parents] or [0]) + (
                node["node_type"] == "reviewer"
            )
            pending.remove(key)
            progressed = True
        if not progressed:
            raise ValueError("Forward workflow contains a cycle or an unknown node.")
    if not any(e["to_node_key"] == end for e in edges):
        raise ValueError("The imported workflow does not route to its end node.")
    reachable = {start}
    while True:
        expanded = reachable | {
            e["to_node_key"] for e in edges if e["from_node_key"] in reachable
        }
        if expanded == reachable:
            break
        reachable = expanded
    if len(reachable) != len(node_keys):
        raise ValueError(
            "The imported workflow contains nodes unreachable from the start."
        )
    reverse_reachable = {end}
    while True:
        expanded = reverse_reachable | {
            e["from_node_key"] for e in edges if e["to_node_key"] in reverse_reachable
        }
        if expanded == reverse_reachable:
            break
        reverse_reachable = expanded
    if len(reverse_reachable) != len(node_keys):
        raise ValueError(
            "The imported workflow contains nodes that cannot reach the end."
        )
    groups = {}
    for node in nodes:
        if node["node_type"] != "reviewer":
            continue
        d = depth[node["node_key"]]
        meta = node.get("metadata") or {}
        group = groups.setdefault(
            d,
            {
                "id": meta.get("level_id", f"level_{d}"),
                "name": meta.get("level_name", f"Level {d}"),
                "reviewers": [],
            },
        )
        group["reviewers"].append(node)
    return [groups[key] for key in sorted(groups)]


def compile_levels(levels: list[dict]) -> tuple[list[dict], list[dict]]:
    def connector(key, kind):
        return {
            "node_key": key,
            "node_type": kind,
            "visible_sections": [],
            "allowed_actions": [],
            "metadata": {"required_inputs": []},
        }

    level_ids = [level["id"] for level in levels]
    reviewer_ids = [
        reviewer["node_key"] for level in levels for reviewer in level["reviewers"]
    ]
    reserved_ids = {"start", "end", *(f"join_{level_id}" for level_id in level_ids)}
    if set(reviewer_ids) & reserved_ids:
        raise ValueError("A reviewer ID conflicts with a generated connector ID.")
    nodes = [connector("start", "start")]
    edges = []
    previous = "start"
    for level in levels:
        join = f"join_{level['id']}"
        for reviewer in level["reviewers"]:
            node = {
                **reviewer,
                "metadata": {
                    **reviewer.get("metadata", {}),
                    "level_id": level["id"],
                    "level_name": level["name"],
                },
            }
            nodes.append(node)
            edges.extend(
                [
                    {
                        "from_node_key": previous,
                        "to_node_key": node["node_key"],
                        "action": "always",
                    },
                    {
                        "from_node_key": node["node_key"],
                        "to_node_key": join,
                        "action": "approve",
                    },
                ]
            )
        nodes.append(connector(join, "join_all"))
        previous = join
    nodes.append(connector("end", "end"))
    edges.append({"from_node_key": previous, "to_node_key": "end", "action": "always"})
    return nodes, edges
