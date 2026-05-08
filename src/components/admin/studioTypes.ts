"use client";

export type CatalogField = {
  field_key: string;
  label: string;
  description?: string | null;
  field_hint?: string | null;
  input_type: string;
  options?: string[];
  section_key: string;
};

export type CustomFieldDraft = {
  field_key: string;
  label: string;
  description: string;
  fieldHint: string;
  inputType: "text" | "textarea" | "single_select" | "multiselect";
  optionsText: string;
  persistForFuture?: boolean;
};

export type OpportunityDetailField = {
  field_key: string;
  label: string;
  value: string;
  value_type: "text" | "number" | "date";
  display_order: number;
  is_student_visible: boolean;
};

export type RequiredInputType = "text" | "number" | "dropdown" | "multiselect";

export type RequiredInput = {
  id: string;
  label: string;
  inputType: RequiredInputType;
  required: boolean;
  options: string[];
  optionsText: string;
};

export type WorkflowStep = {
  name: string;
  reviewerEmail: string;
  reviewerName: string;
  visibleFields: string[];
  requiredInputs: RequiredInput[];
  slaHours: number;
  canViewComments: boolean;
};

export type GeneratorVisibilityRuleType = "EMAIL" | "GROUP_EMAIL";

export type GeneratorVisibilityRule = {
  ruleType: GeneratorVisibilityRuleType;
  ruleValue: string;
};

export type OpportunityData = {
  code: string;
  title: string;
  description: string;
  cover_image_url: string;
  term: string;
  destination: string;
  deadline: string;
  seats: number;
  status: string;
  ai_summary_bullets: string[];
  ai_summary_source_hash?: string | null;
};

export type StudioNodeType = "start" | "reviewer" | "join_all" | "join_any" | "conditional" | "end";

export type StudioEdgeAction =
  | "always"
  | "approve"
  | "reject"
  | "request_changes"
  | "condition_true"
  | "condition_false";

export type StudioRequiredInput = {
  input_key: string;
  label: string;
  input_type: "text" | "number" | "select" | "checkbox";
  options: string[];
  required: boolean;
};

export type StudioGraphNode = {
  node_key: string;
  node_type: StudioNodeType;
  display_name?: string | null;
  reviewer_email?: string | null;
  visible_sections: string[];
  allowed_actions: string[];
  metadata: {
    required_inputs: StudioRequiredInput[];
    sla_hours?: number;
    can_view_comments?: boolean;
    [key: string]: unknown;
  };
};

export type StudioGraphEdge = {
  from_node_key: string;
  to_node_key: string;
  condition_json?: Record<string, unknown> | null;
  label?: string | null;
  action?: StudioEdgeAction | null;
};

export type DraftOutput = {
  opportunity: {
    code?: string | null;
    title: string;
    description: string;
    cover_image_url?: string | null;
    term?: string | null;
    destination?: string | null;
    deadline?: string | null;
    seats?: number | null;
    host_institution?: string | null;
    program_type?: string | null;
    detail_fields?: OpportunityDetailField[];
    ai_summary_bullets?: string[];
    eligibility_criteria?: string | null;
    funding_available?: boolean;
    visibility?: string;
  };
  graph: {
    nodes: StudioGraphNode[];
    edges: StudioGraphEdge[];
  };
  applicant_form_fields?: string[];
  clarifying_questions: string[];
  confidence: number;
  warnings: string[];
  is_fallback: boolean;
};

export type WorkflowDraftRow = {
  id: number;
  opportunity_id: number | null;
  status: string;
  draft_output: string | null;
  clarifying_questions: string | null;
  admin_answers: string | null;
  warnings: string | null;
  confidence: number | null;
  publish_ready: number;
  created_by_email?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ImpactApplication = {
  id: number;
  current_stage?: string | null;
  current_stage_label?: string | null;
  final_status?: string | null;
  opportunity_id: number;
  student_user?: {
    full_name?: string | null;
    email?: string | null;
  };
};
