from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class NodeRequiredInput(BaseModel):
    input_key: str
    label: str
    input_type: Literal["text", "number", "select", "checkbox"] = "text"
    options: list[str] = Field(default_factory=list)
    required: bool = True


class NodeMetadata(BaseModel):
    sla_hours: int = Field(default=72, ge=1, le=720)
    can_view_comments: bool = False
    return_target: str = "student"
    return_rule: dict[str, str] | None = None
    required_inputs: list[NodeRequiredInput] = Field(default_factory=list)

    model_config = {"extra": "allow"}


class GraphNodeModel(BaseModel):
    node_key: str
    node_type: Literal[
        "start", "reviewer", "join_all", "join_any", "conditional", "end"
    ]
    display_name: str | None = None
    reviewer_email: str | None = None
    visible_sections: list[str] = Field(default_factory=list)
    allowed_actions: list[str] = Field(
        default_factory=lambda: ["approve", "reject", "request_changes", "comment"]
    )
    metadata: NodeMetadata = Field(default_factory=NodeMetadata)


class GraphEdgeModel(BaseModel):
    from_node_key: str
    to_node_key: str
    condition_json: dict[str, Any] | None = None
    label: str | None = None
    action: (
        Literal[
            "always",
            "approve",
            "reject",
            "request_changes",
            "condition_true",
            "condition_false",
        ]
        | None
    ) = None


class ReviewLevelModel(BaseModel):
    id: str
    name: str
    reviewers: list[GraphNodeModel] = Field(default_factory=list)


class GraphModel(BaseModel):
    levels: list[ReviewLevelModel] | None = None
    nodes: list[GraphNodeModel] = Field(default_factory=list)
    edges: list[GraphEdgeModel] = Field(default_factory=list)

    @model_validator(mode="after")
    def derive_forward_graph(self):
        from fastapi_app.levels import compile_levels, normalize_levels

        raw = self.model_dump()
        levels = normalize_levels(raw)
        self.levels = [ReviewLevelModel.model_validate(level) for level in levels]
        nodes, edges = compile_levels(levels)
        self.nodes = [GraphNodeModel.model_validate(node) for node in nodes]
        self.edges = [GraphEdgeModel.model_validate(edge) for edge in edges]
        return self


class OpportunityDraftModel(BaseModel):
    code: str | None = None
    title: str
    description: str
    cover_image_url: str | None = None
    term: str | None = None
    destination: str | None = None
    deadline: str | None = None
    seats: int | None = None
    host_institution: str | None = None
    program_type: str | None = None
    detail_fields: list[dict[str, Any]] = Field(default_factory=list)
    ai_summary_bullets: list[str] = Field(default_factory=list)
    eligibility_criteria: str | None = None
    funding_available: bool = False
    visibility: str = "plaksha_only"


class AIWorkflowDraftOutput(BaseModel):
    opportunity: OpportunityDraftModel
    graph: GraphModel
    applicant_form_fields: list[str] = Field(
        default_factory=lambda: [
            "full_name",
            "student_id",
            "email",
            "cgpa",
            "statement_of_purpose",
        ]
    )
    student_visibility_rules: list[str] = Field(default_factory=list)
    custom_fields: list[dict[str, Any]] = Field(default_factory=list)
    clarifying_questions: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    warnings: list[str] = Field(default_factory=list)
    is_fallback: bool = False


class TransitionResult(BaseModel):
    success: bool
    next_task_ids: list[int] = Field(default_factory=list)
    application_status: str | None = None
    error: str | None = None


class TaskRow(BaseModel):
    task_id: int
    application_id: int
    opportunity_title: str
    student_name: str
    node_key: str
    display_name: str
    allowed_actions: list[str]
    visible_sections: list[str]
    assigned_at: str
