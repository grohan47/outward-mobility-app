from __future__ import annotations
from typing import Any, Literal
from pydantic import BaseModel, Field
from fastapi_app.graph_models import GraphModel


class SessionUser(BaseModel):
    email: str
    name: str
    role: str
    roleDisplayName: str
    userId: int
    reviewerOnboarded: bool = True
    pronouns: str | None = None
    department: str | None = None
    notifyEmail: bool = True
    notifyDigest: bool = False
    availableWorkspaces: list[dict[str, Any]] = Field(default_factory=list)


class LoginBody(BaseModel):
    email: str


class WorkspaceSelectBody(BaseModel):
    role: str


class ReviewerOnboardingBody(BaseModel):
    displayName: str = Field(min_length=1, max_length=120)
    pronouns: str | None = Field(default=None, max_length=80)
    department: str | None = Field(default=None, max_length=120)
    notifyEmail: bool = True
    notifyDigest: bool = False


class CommentCreateBody(BaseModel):
    text: str = Field(min_length=1)
    visibility: str = "internal"
    authorEmail: str | None = None


class DecisionBody(BaseModel):
    remarks: str | None = None
    reason: str | None = None
    reviewerEmail: str | None = None
    requiredInputs: dict[str, Any] | None = None
    targetStepOrder: int | None = None


class StudentResponseBody(BaseModel):
    submittedData: dict[str, Any] | None = None
    text: str = Field(min_length=1)


class AdminApplicationPatchBody(BaseModel):
    submittedData: dict[str, Any]


class CustomFormFieldPayload(BaseModel):
    key: str | None = None
    label: str
    description: str | None = None
    fieldHint: str | None = None
    inputType: Literal["text", "textarea", "single_select", "multiselect"] = "text"
    options: list[str] = Field(default_factory=list)
    persistForFuture: bool = True


class OpportunityDetailFieldPayload(BaseModel):
    key: str | None = None
    field_key: str | None = None
    label: str
    value: str
    valueType: Literal["text", "number", "date"] = "text"
    value_type: str | None = None
    displayOrder: int | None = None
    display_order: int | None = None
    isStudentVisible: bool = True
    is_student_visible: bool | None = None


class VisibilityRulePayload(BaseModel):
    ruleType: Literal["EMAIL", "GROUP_EMAIL"]
    ruleValue: str


VisibilityRuleInput = str | VisibilityRulePayload


class OpportunityPatchBody(BaseModel):
    title: str | None = None
    description: str | None = None
    cover_image_url: str | None = None
    term: str | None = None
    destination: str | None = None
    deadline: str | None = None
    seats: int | None = None
    status: str | None = None
    formFields: list[str] | None = None
    customFields: list[CustomFormFieldPayload] | None = None
    studentVisibilityRules: list[VisibilityRuleInput] | None = None
    detailFields: list[OpportunityDetailFieldPayload] | None = None
    aiSummaryBullets: list[str] | None = None


class OpportunityAIGenerateBody(BaseModel):
    prompt: str = Field(min_length=10, max_length=4000)


class ClarificationAnswerBody(BaseModel):
    answers: dict[str, Any]


class WorkflowDraftManualBody(BaseModel):
    draftId: int | None = None
    expectedUpdatedAt: str | None = None
    applicantFormFields: list[str] = Field(default_factory=list)
    customFields: list[CustomFormFieldPayload] = Field(default_factory=list)
    opportunityId: int | None = None
    opportunity: dict[str, Any]
    graph: GraphModel
    studentVisibilityRules: list[VisibilityRuleInput] = Field(default_factory=list)
    clarifyingQuestions: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.75, ge=0.0, le=1.0)
    isFallback: bool = False


class WorkflowDraftValidateBody(WorkflowDraftManualBody):
    pass


class TaskDecideBody(BaseModel):
    decision: str
    comment: str | None = None
    reviewer_data: dict[str, Any] | None = None


class SLAPolicyBody(BaseModel):
    graphNodeId: int
    slaDays: int = Field(ge=1)
    reminderDays: list[int] = Field(default_factory=lambda: [1])
    escalationEmail: str | None = None


class SLATestReminderBody(BaseModel):
    toEmail: str | None = None


class SLABreachAcknowledgeBody(BaseModel):
    notes: str | None = None


class ApplicationCreateBody(BaseModel):
    opportunityId: int
    studentProfileId: int | None = None
    submittedData: dict[str, Any] | None = None
