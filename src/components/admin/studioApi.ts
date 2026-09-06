import type {
  CatalogField,
  CustomFieldDraft,
  DraftOutput,
  OpportunityData,
  OpportunityDetailField,
  StudentVisibilityRule,
  StudioEdgeAction,
  StudioGraphEdge,
  StudioGraphNode,
  StudioNodeType,
  StudioRequiredInput,
  WorkflowDraftRow,
} from "./studioTypes";
import type { ReviewLevel } from "./levels";

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonObject;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function text(value: unknown, label: string, fallback?: string): string {
  if (typeof value === "string") return value;
  if (value == null && fallback !== undefined) return fallback;
  throw new Error(`${label} must be text.`);
}

function optionalText(value: unknown, label: string): string | null {
  if (value == null) return null;
  return text(value, label);
}

function stringList(value: unknown, label: string, fallback: string[] = []): string[] {
  if (value == null) return fallback;
  return array(value, label).map((item, index) => text(item, `${label}[${index}]`));
}

function parseJson(value: unknown, label: string): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${label} contains invalid JSON.`);
  }
}

function numberValue(value: unknown, label: string, fallback: number): number {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number.`);
  return parsed;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (value == null) return fallback;
  return value !== false && value !== 0;
}

function parseRequiredInput(value: unknown, label: string): StudioRequiredInput {
  const input = object(value, label);
  const inputType = text(input.input_type, `${label}.input_type`, "text");
  if (!["text", "number", "select", "checkbox"].includes(inputType)) {
    throw new Error(`${label}.input_type is unsupported.`);
  }
  return {
    input_key: text(input.input_key, `${label}.input_key`),
    label: text(input.label, `${label}.label`),
    input_type: inputType as StudioRequiredInput["input_type"],
    options: stringList(input.options, `${label}.options`),
    required: booleanValue(input.required, true),
  };
}

export function parseGraphNode(value: unknown, label: string): StudioGraphNode {
  const node = object(value, label);
  const nodeType = text(node.node_type, `${label}.node_type`);
  const supported: StudioNodeType[] = ["start", "reviewer", "join_all", "join_any", "conditional", "end"];
  if (!supported.includes(nodeType as StudioNodeType)) throw new Error(`${label}.node_type is unsupported.`);
  const metadata = object(parseJson(node.metadata ?? {}, `${label}.metadata`), `${label}.metadata`);
  const requiredInputs = array(metadata.required_inputs ?? [], `${label}.metadata.required_inputs`).map((item, index) =>
    parseRequiredInput(item, `${label}.metadata.required_inputs[${index}]`),
  );
  const returnRule = metadata.return_rule == null ? null : object(metadata.return_rule, `${label}.metadata.return_rule`);
  return {
    node_key: text(node.node_key, `${label}.node_key`),
    node_type: nodeType as StudioNodeType,
    display_name: optionalText(node.display_name, `${label}.display_name`),
    reviewer_email: optionalText(node.reviewer_email, `${label}.reviewer_email`),
    visible_sections: stringList(parseJson(node.visible_sections ?? [], `${label}.visible_sections`), `${label}.visible_sections`),
    allowed_actions: stringList(parseJson(node.allowed_actions ?? [], `${label}.allowed_actions`), `${label}.allowed_actions`),
    metadata: {
      ...metadata,
      required_inputs: requiredInputs,
      sla_hours: numberValue(metadata.sla_hours, `${label}.metadata.sla_hours`, 72),
      can_view_comments: booleanValue(metadata.can_view_comments, false),
      return_target: text(metadata.return_target, `${label}.metadata.return_target`, "student"),
      return_rule: returnRule
        ? {
            field: text(returnRule.field, `${label}.metadata.return_rule.field`, ""),
            value: text(returnRule.value, `${label}.metadata.return_rule.value`, ""),
            target: text(returnRule.target, `${label}.metadata.return_rule.target`, "student"),
          }
        : null,
      student_visible_fields: stringList(metadata.student_visible_fields, `${label}.metadata.student_visible_fields`),
    },
  };
}

function parseGraphEdge(value: unknown, label: string): StudioGraphEdge {
  const edge = object(value, label);
  const action = optionalText(edge.action, `${label}.action`);
  const supported: StudioEdgeAction[] = ["always", "approve", "reject", "request_changes", "condition_true", "condition_false"];
  if (action && !supported.includes(action as StudioEdgeAction)) throw new Error(`${label}.action is unsupported.`);
  const condition = edge.condition_json == null ? null : object(parseJson(edge.condition_json, `${label}.condition_json`), `${label}.condition_json`);
  return {
    from_node_key: text(edge.from_node_key, `${label}.from_node_key`),
    to_node_key: text(edge.to_node_key, `${label}.to_node_key`),
    condition_json: condition,
    label: optionalText(edge.label, `${label}.label`),
    action: action as StudioEdgeAction | null,
  };
}

function parseLevel(value: unknown, label: string): ReviewLevel {
  const level = object(value, label);
  return {
    id: text(level.id, `${label}.id`),
    name: text(level.name, `${label}.name`),
    reviewers: array(level.reviewers ?? [], `${label}.reviewers`).map((item, index) => parseGraphNode(item, `${label}.reviewers[${index}]`)),
  };
}

function parseDetailField(value: unknown, index: number): OpportunityDetailField {
  const field = object(value, `detail_fields[${index}]`);
  const valueType = text(field.value_type ?? field.valueType, `detail_fields[${index}].value_type`, "text");
  if (!["text", "number", "date"].includes(valueType)) throw new Error(`detail_fields[${index}].value_type is unsupported.`);
  return {
    field_key: text(field.field_key ?? field.key, `detail_fields[${index}].field_key`, `detail_${index + 1}`),
    label: text(field.label, `detail_fields[${index}].label`, ""),
    value: text(field.value, `detail_fields[${index}].value`, ""),
    value_type: valueType as OpportunityDetailField["value_type"],
    display_order: numberValue(field.display_order ?? field.displayOrder, `detail_fields[${index}].display_order`, index + 1),
    is_student_visible: booleanValue(field.is_student_visible ?? field.isStudentVisible, true),
  };
}

export function parseOpportunity(value: unknown): OpportunityData {
  const opportunity = object(value, "opportunity");
  return {
    code: text(opportunity.code, "opportunity.code", ""),
    title: text(opportunity.title, "opportunity.title", ""),
    description: text(opportunity.description, "opportunity.description", ""),
    cover_image_url: text(opportunity.cover_image_url, "opportunity.cover_image_url", ""),
    term: text(opportunity.term, "opportunity.term", ""),
    destination: text(opportunity.destination, "opportunity.destination", ""),
    deadline: text(opportunity.deadline, "opportunity.deadline", ""),
    seats: numberValue(opportunity.seats, "opportunity.seats", 0),
    status: text(opportunity.status, "opportunity.status", "published"),
    ai_summary_bullets: stringList(
      opportunity.ai_summary_bullets ?? parseJson(opportunity.ai_summary_json ?? [], "opportunity.ai_summary_json"),
      "opportunity.ai_summary_bullets",
    ),
    ai_summary_source_hash: optionalText(opportunity.ai_summary_source_hash, "opportunity.ai_summary_source_hash"),
  };
}

function parseCustomField(value: unknown, index: number): CustomFieldDraft {
  const field = object(value, `custom_fields[${index}]`);
  const inputType = text(field.inputType ?? field.input_type, `custom_fields[${index}].inputType`, "text");
  if (!["text", "textarea", "single_select", "multiselect"].includes(inputType)) throw new Error(`custom_fields[${index}].inputType is unsupported.`);
  const key = text(field.key ?? field.field_key, `custom_fields[${index}].key`);
  const options = Array.isArray(field.options)
    ? stringList(field.options, `custom_fields[${index}].options`)
    : stringList(parseJson(field.options_json ?? [], `custom_fields[${index}].options_json`), `custom_fields[${index}].options`);
  return {
    field_key: key,
    label: text(field.label, `custom_fields[${index}].label`, ""),
    description: text(field.description, `custom_fields[${index}].description`, ""),
    fieldHint: text(field.fieldHint ?? field.field_hint, `custom_fields[${index}].fieldHint`, ""),
    inputType: inputType as CustomFieldDraft["inputType"],
    optionsText: options.join(", "),
    persistForFuture: booleanValue(field.persistForFuture, true),
  };
}

export function parseDraftOutput(value: unknown): DraftOutput {
  const output = object(parseJson(value, "draft_output"), "draft_output");
  const graph = object(output.graph, "draft_output.graph");
  const levels = graph.levels == null ? undefined : array(graph.levels, "draft_output.graph.levels").map((item, index) => parseLevel(item, `draft_output.graph.levels[${index}]`));
  const nodes = graph.nodes == null ? undefined : array(graph.nodes, "draft_output.graph.nodes").map((item, index) => parseGraphNode(item, `draft_output.graph.nodes[${index}]`));
  const edges = graph.edges == null ? undefined : array(graph.edges, "draft_output.graph.edges").map((item, index) => parseGraphEdge(item, `draft_output.graph.edges[${index}]`));
  if (!levels && !nodes) throw new Error("draft_output.graph needs levels or nodes.");
  const opportunityObject = object(output.opportunity, "draft_output.opportunity");
  return {
    opportunity: {
      ...opportunityObject,
      ...parseOpportunity(opportunityObject),
      detail_fields: array(opportunityObject.detail_fields ?? [], "draft_output.opportunity.detail_fields").map(parseDetailField),
    },
    graph: { levels, nodes, edges },
    applicant_form_fields: stringList(output.applicant_form_fields, "draft_output.applicant_form_fields"),
    student_visibility_rules: stringList(output.student_visibility_rules, "draft_output.student_visibility_rules"),
    clarifying_questions: stringList(output.clarifying_questions, "draft_output.clarifying_questions"),
    confidence: numberValue(output.confidence, "draft_output.confidence", 0),
    warnings: stringList(output.warnings, "draft_output.warnings"),
    is_fallback: booleanValue(output.is_fallback, false),
  };
}

export function parseCatalogResponse(value: unknown): CatalogField[] {
  const response = object(value, "form field response");
  return array(response.items, "form field response.items").map((item, index) => {
    const field = object(item, `form field response.items[${index}]`);
    return {
      field_key: text(field.field_key, `form field response.items[${index}].field_key`),
      label: text(field.label, `form field response.items[${index}].label`),
      description: optionalText(field.description, `form field response.items[${index}].description`),
      field_hint: optionalText(field.field_hint, `form field response.items[${index}].field_hint`),
      input_type: text(field.input_type, `form field response.items[${index}].input_type`),
      options: stringList(field.options, `form field response.items[${index}].options`),
      section_key: text(field.section_key, `form field response.items[${index}].section_key`),
    };
  });
}

export function parseOpportunityResponse(value: unknown) {
  const response = object(value, "opportunity response");
  return {
    opportunity: parseOpportunity(response.opportunity),
    detailFields: array(response.detail_fields ?? [], "opportunity response.detail_fields").map(parseDetailField),
    selectedFields: stringList(response.form_fields, "opportunity response.form_fields"),
    customFields: array(response.custom_fields ?? [], "opportunity response.custom_fields").map(parseCustomField),
    visibilityRules: array(response.student_visibility_rules ?? [], "opportunity response.student_visibility_rules").map((item, index): StudentVisibilityRule => {
      const rule = object(item, `opportunity response.student_visibility_rules[${index}]`);
      const ruleType = text(rule.ruleType, `opportunity response.student_visibility_rules[${index}].ruleType`, "EMAIL");
      if (!["EMAIL", "GROUP_EMAIL"].includes(ruleType)) throw new Error(`student_visibility_rules[${index}].ruleType is unsupported.`);
      return { ruleType: ruleType as StudentVisibilityRule["ruleType"], ruleValue: text(rule.ruleValue, `student_visibility_rules[${index}].ruleValue`) };
    }),
  };
}

export function parseGraphResponse(value: unknown): { nodes: StudioGraphNode[]; edges: StudioGraphEdge[] } {
  const response = object(value, "graph response");
  return {
    nodes: array(response.nodes ?? [], "graph response.nodes").map((item, index) => parseGraphNode(item, `graph response.nodes[${index}]`)),
    edges: array(response.edges ?? [], "graph response.edges").map((item, index) => parseGraphEdge(item, `graph response.edges[${index}]`)),
  };
}

export function parseDraftResponse(value: unknown): { draft_id?: number; draft: WorkflowDraftRow; output: DraftOutput } {
  const response = object(value, "workflow draft response");
  const row = object(response.draft, "workflow draft response.draft");
  const idValue = numberValue(row.id, "workflow draft response.draft.id", 0);
  const draftOutput = text(row.draft_output, "workflow draft response.draft.draft_output");
  return {
    draft_id: response.draft_id == null ? undefined : numberValue(response.draft_id, "workflow draft response.draft_id", idValue),
    draft: {
      id: idValue,
      opportunity_id: row.opportunity_id == null ? null : numberValue(row.opportunity_id, "workflow draft response.draft.opportunity_id", 0),
      status: text(row.status, "workflow draft response.draft.status", "pending"),
      draft_output: draftOutput,
      clarifying_questions: optionalText(row.clarifying_questions, "workflow draft response.draft.clarifying_questions"),
      admin_answers: optionalText(row.admin_answers, "workflow draft response.draft.admin_answers"),
      warnings: optionalText(row.warnings, "workflow draft response.draft.warnings"),
      confidence: row.confidence == null ? null : numberValue(row.confidence, "workflow draft response.draft.confidence", 0),
      publish_ready: numberValue(row.publish_ready, "workflow draft response.draft.publish_ready", 0),
      created_by_email: optionalText(row.created_by_email, "workflow draft response.draft.created_by_email"),
      created_at: optionalText(row.created_at, "workflow draft response.draft.created_at"),
      updated_at: optionalText(row.updated_at, "workflow draft response.draft.updated_at"),
    },
    output: parseDraftOutput(draftOutput),
  };
}

export function customFieldsFromDraft(output: DraftOutput): CustomFieldDraft[] {
  return array(output.custom_fields ?? [], "draft_output.custom_fields").map(parseCustomField);
}
