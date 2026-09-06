// ── Core entity types for the PRISM approvals platform ──

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: number;
  created_at: string;
}

export interface Role {
  id: number;
  code: string;
  display_name: string;
}

export interface UserScopeRole {
  id: number;
  user_id: number;
  role_id: number;
  scope_type: "SYSTEM" | "OPPORTUNITY";
  scope_id: number | null;
  created_by: number | null;
  created_at: string;
}

export interface UserRoleContext {
  user_id: number;
  source_role_code: string;
  source_role_display_name: string;
  workspace_role_code: "STUDENT" | "REVIEWER" | "ADMIN" | string;
  workspace_role_display_name: string;
  scope_type: "SYSTEM" | "OPPORTUNITY";
  scope_id: number | null;
  opportunity_code: string | null;
  opportunity_title: string | null;
}

export interface StudentProfile {
  id: number;
  user_id: number;
  student_id: string;
  program: string;
  official_cgpa: number | null;
  created_at: string;
}

export interface Opportunity {
  id: number;
  code: string;
  title: string;
  description: string | null;
  term: string | null;
  destination: string | null;
  deadline: string | null;
  seats: number | null;
  status: string;
  form_template_id: number | null;
  workflow_template_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface FormTemplate {
  id: number;
  name: string;
  description: string | null;
  schema_json: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplate {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStepTemplate {
  id: number;
  workflow_template_id: number;
  step_order: number;
  name: string;
  description: string | null;
}

export interface ReviewerAssignment {
  id: number;
  workflow_step_template_id: number;
  reviewer_email: string;
  reviewer_display_name: string | null;
  access_level: string;
  allowed_actions: string; // JSON array
  visible_sections: string; // JSON array
  status: string;
}

export interface Application {
  id: number;
  student_profile_id: number;
  opportunity_id: number;
  current_level?: number;
  attempt?: number;
  current_stage: string;
  current_stage_label?: string;
  current_step_order?: number;
  current_step_id?: number | null;
  final_status: string | null;
  submitted_data?: string | null; // JSON
  submitted_data_json?: string | null; // JSON
  submitted_at: string | null;
  metadata: string | null; // JSON
  created_at: string;
  updated_at: string;
}

export interface WorkflowStepInstance {
  id: number;
  application_id: number;
  workflow_step_template_id: number;
  assigned_reviewer_email: string | null;
  assigned_at: string | null;
  acted_at: string | null;
  decision: string | null;
  comment_summary: string | null;
}

export interface ApplicationReview {
  id: number;
  application_id: number;
  review_role: string;
  verification_outcome: string | null;
  remarks: string | null;
  visibility_scope: string;
  created_by: number;
  created_at: string;
}

export interface ApplicationDecision {
  id: number;
  application_id: number;
  stage_code: string;
  decision: string;
  reason: string | null;
  decided_by: number;
  decided_at: string;
}

export interface TimelineEvent {
  id: number;
  application_id: number;
  event_type: string;
  event_payload: Record<string, unknown> | null;
  actor_user_id: number | null;
  created_at: string;
}

export interface Comment {
  id: number;
  application_id: number;
  author_email: string;
  text: string;
  visibility: string;
  created_at: string;
}

export interface DeficiencyItem {
  id: number;
  application_id: number;
  created_by_email: string;
  title: string;
  description: string | null;
  status: string;
  resolved_at: string | null;
  created_at: string;
}

export interface ApplicationSnapshot {
  id: number;
  application_id: number;
  official_cgpa_at_submission: number | null;
  program_at_submission: string | null;
  disciplinary_status_at_submission: string | null;
  snapshot_captured_at: string;
}

// ── Enriched types for API responses ──

export interface EnrichedApplication extends Application {
  opportunity?: Opportunity;
  student_profile?: StudentProfile;
  student_user?: User;
  workflow?: WorkflowMeta;
}

export interface WorkflowMeta {
  stageCode: string;
  stageLabel: string;
  currentStakeholder: string;
  finalStatus: string | null;
}

export interface ApplicationDetail {
  application: Application;
  opportunity: Opportunity | null;
  student_profile: StudentProfile | null;
  student_user: User | null;
  snapshot: ApplicationSnapshot | null;
  reviews: ApplicationReview[];
  decisions: ApplicationDecision[];
  timeline: TimelineEvent[];
  workflow: WorkflowMeta;
  step_instances?: WorkflowStepInstance[];
  comments?: Comment[];
  deficiencies?: DeficiencyItem[];
}

export type FieldValue = string | number | boolean | string[] | null;

export type FormField = {
  field_key: string;
  label: string;
  description?: string | null;
  field_hint?: string | null;
  input_type: "text" | "textarea" | "number" | "file" | "single_select" | "select" | "dropdown" | "multiselect";
  options?: string[];
  required?: boolean;
  is_required?: number;
};

export type ReviewerRequiredInput = {
  input_key: string;
  input_label?: string;
  label?: string;
  input_type: "text" | "number" | "dropdown" | "select" | "single_select" | "multiselect" | "checkbox";
  options?: string[];
  required?: boolean;
  is_required?: number;
};

export type PipelineStepSummary = {
  id?: number;
  step_order: number;
  step_name: string;
  reviewer_email?: string;
  reviewer_display_name?: string;
  visible_fields?: string[];
  can_view_comments?: number | boolean;
  required_inputs?: ReviewerRequiredInput[];
};

export type ApplicationListItem = {
  id: number;
  student_profile_id: number;
  opportunity_id: number;
  current_level?: number;
  attempt?: number;
  current_step_order: number;
  current_stage: string;
  current_stage_label: string;
  final_status: string | null;
  submitted_data: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  opportunity?: Pick<Opportunity, "id" | "title" | "term" | "destination"> & {
    cover_image_url?: string | null;
  };
  student_profile?: Pick<StudentProfile, "id" | "student_id" | "program" | "official_cgpa">;
  student_user?: Pick<User, "full_name" | "email">;
  pipeline_steps?: PipelineStepSummary[];
  workflow: WorkflowMeta;
};

export type ReviewerGraphNodeInfo = {
  node_key: string;
  task_id: number;
  display_name: string;
  allowed_actions: Array<"approve" | "reject" | "request_changes" | "comment">;
  visible_sections: string[];
  required_inputs: ReviewerRequiredInput[];
  return_target: string;
};

export type ApplicationDetailPayload = {
  application: Application & {
    current_step_order: number;
    current_stage_label: string;
    submitted_data_json: string | null;
  };
  opportunity?: Opportunity | null;
  student_profile?: Partial<StudentProfile> | null;
  student_user?: Partial<User> | null;
  reviews: Array<{
    id: number;
    reviewer_email?: string;
    reviewer_name?: string;
    reviewer_role: string;
    decision: string;
    remarks: string | null;
    required_inputs?: Record<string, FieldValue>;
    created_at: string;
    status?: string;
    attempt?: number;
  }>;
  comments: Comment[];
  timeline: TimelineEvent[];
  pipeline_steps: PipelineStepSummary[];
  workflow: WorkflowMeta;
  application_file?: Record<string, FieldValue>;
  field_labels?: Record<string, string>;
  form_schema?: FormField[];
  graph_node_info?: ReviewerGraphNodeInfo;
  permissions?: { can_view_comments?: boolean };
};

// ── Session / Auth types ──

export interface SessionUser {
  email: string;
  name: string;
  role: string;
  roleDisplayName: string;
  userId: number;
  reviewerOnboarded?: boolean;
  pronouns?: string | null;
  department?: string | null;
  notifyEmail?: boolean;
  notifyDigest?: boolean;
  availableWorkspaces?: Array<{
    role: string;
    roleDisplayName: string;
    dashboardPath: string;
  }>;
}

export type RoleCode =
  | "STUDENT"
  | "REVIEWER"
  | "ADMIN";
