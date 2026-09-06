from __future__ import annotations
import re
from fastapi_app.graph_models import GraphModel


class GraphPolicyValidator:
    def validate_graph(
        self, graph: GraphModel, known_fields: list[str] | None = None
    ) -> list[str]:
        errors = []
        levels = graph.levels or []
        if not levels:
            return ["Add at least one review level."]
        level_ids = [level.id for level in levels]
        if len(set(level_ids)) != len(level_ids):
            errors.append("Level IDs must be unique.")
        if "student" in level_ids:
            errors.append(
                "Level ID 'student' is reserved for returns to the applicant."
            )
        node_ids = [n.node_key for level in levels for n in level.reviewers]
        if len(set(node_ids)) != len(node_ids):
            errors.append("Reviewer IDs must be unique.")
        connector_ids = {
            "start",
            "end",
            *(f"join_{level_id}" for level_id in level_ids),
        }
        if set(node_ids) & connector_ids:
            errors.append(
                "Reviewer IDs cannot conflict with generated start, end, or join IDs."
            )
        outputs = [
            f.input_key
            for level in levels
            for node in level.reviewers
            for f in node.metadata.required_inputs
        ]
        if len(outputs) != len(set(outputs)) or set(outputs) & set(known_fields or []):
            errors.append(
                "Each reviewer field must have a unique ID, distinct from student fields."
            )
        for index, level in enumerate(levels):
            if not re.fullmatch(r"[A-Za-z0-9_-]+", level.id) or not level.name.strip():
                errors.append("Each level needs a stable ID and a name.")
            if not level.reviewers:
                errors.append(f"{level.name}: add at least one reviewer.")
            emails = [
                str(n.reviewer_email or "").strip().lower() for n in level.reviewers
            ]
            if len(set(emails)) != len(emails):
                errors.append(f"{level.name}: assign each person only once per level.")
            automatic = 0
            for node in level.reviewers:
                label = node.display_name or node.node_key
                if node.node_type != "reviewer" or not re.fullmatch(
                    r"[A-Za-z0-9_-]+", node.node_key
                ):
                    errors.append(f"{label}: invalid reviewer ID/type.")
                if not re.fullmatch(
                    r"[^\s@]+@[^\s@]+\.[^\s@]+", node.reviewer_email or ""
                ):
                    errors.append(f"{label}: enter a valid reviewer email.")
                if "approve" not in node.allowed_actions or set(
                    node.allowed_actions
                ) - {"approve", "reject", "request_changes", "comment"}:
                    errors.append(
                        f"{label}: approval is required; choose only supported actions."
                    )
                if "all" in node.visible_sections:
                    errors.append(
                        f"{label}: select explicit visible fields instead of all."
                    )
                prior_outputs = {
                    field.input_key
                    for prior_level in levels[:index]
                    for prior_node in prior_level.reviewers
                    for field in prior_node.metadata.required_inputs
                }
                current_or_future_outputs = set(outputs) - prior_outputs
                if set(node.visible_sections) & current_or_future_outputs:
                    errors.append(
                        f"{label}: visibility can include reviewer outputs from earlier levels only."
                    )
                available_visible_fields = set(known_fields or []) | prior_outputs
                if (
                    known_fields is not None
                    and set(node.visible_sections) - available_visible_fields
                ):
                    errors.append(
                        f"{label}: visibility references a removed or unknown field."
                    )
                if node.metadata.return_target not in ["student", *level_ids[:index]]:
                    errors.append(
                        f"{label}: return target must be the student or an earlier level."
                    )
                for f in node.metadata.required_inputs:
                    if not f.label.strip() or not re.fullmatch(
                        r"[A-Za-z0-9_-]+", f.input_key
                    ):
                        errors.append(
                            f"{label}: reviewer fields need valid IDs and labels."
                        )
                    if f.input_type == "select" and (
                        not f.options or any(not o.strip() for o in f.options)
                    ):
                        errors.append(
                            f"{f.label}: select fields need nonempty options."
                        )
                metadata = node.metadata.model_dump()
                student_visible_fields = metadata.get("student_visible_fields", [])
                if not isinstance(student_visible_fields, list) or any(
                    not isinstance(field, str) for field in student_visible_fields
                ):
                    errors.append(
                        f"{label}: student-visible fields must be a list of reviewer output IDs."
                    )
                elif not set(student_visible_fields) <= {
                    f.input_key for f in node.metadata.required_inputs
                }:
                    errors.append(
                        f"{label}: student-visible fields must be outputs owned by this reviewer."
                    )
                rule = node.metadata.return_rule
                if rule:
                    automatic += 1
                    available = set(known_fields or []) | {
                        f.input_key
                        for l in levels[: index + 1]
                        for n in l.reviewers
                        for f in n.metadata.required_inputs
                    }
                    if (
                        not rule.get("field")
                        or (known_fields is not None and rule["field"] not in available)
                        or "value" not in rule
                    ):
                        errors.append(
                            f"{label}: automatic return needs an available field and comparison value."
                        )
                    if rule.get("target") not in ["student", *level_ids[:index]]:
                        errors.append(
                            f"{label}: automatic return needs the student or an earlier level."
                        )
            if automatic > 1:
                errors.append(
                    f"{level.name}: configure at most one automatic return rule to avoid conflicting routes."
                )
        return errors
