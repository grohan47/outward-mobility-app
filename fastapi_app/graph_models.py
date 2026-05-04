from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class GraphNodeModel(BaseModel):
    node_key: str
    node_type: Literal["start", "reviewer", "join_all", "join_any", "conditional", "end"]
    display_name: str | None = None
    reviewer_email: str | None = None
    visible_sections: list[str] = Field(default_factory=lambda: ["all"])
    allowed_actions: list[str] = Field(default_factory=lambda: ["approve", "request_changes", "comment"])
    metadata: dict[str, Any] = Field(default_factory=dict)


class GraphEdgeModel(BaseModel):
    from_node_key: str
    to_node_key: str
    condition_json: dict[str, Any] | None = None
    label: str | None = None


class GraphModel(BaseModel):
    nodes: list[GraphNodeModel]
    edges: list[GraphEdgeModel]


class OpportunityDraftModel(BaseModel):
    title: str
    description: str
    host_institution: str | None = None
    program_type: str | None = None
    eligibility_criteria: str | None = None
    funding_available: bool = False
    visibility: str = "plaksha_only"


class AIWorkflowDraftOutput(BaseModel):
    opportunity: OpportunityDraftModel
    graph: GraphModel
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
