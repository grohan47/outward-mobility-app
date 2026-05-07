"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import OpportunityStudio from "./OpportunityStudio";
import type {
  CatalogField,
  CustomFieldDraft,
  GeneratorVisibilityRule,
  ImpactApplication,
  OpportunityData,
  OpportunityDetailField,
  RequiredInput,
  RequiredInputType,
  StudioGraphEdge,
  StudioGraphNode,
  StudioNodeType,
  WorkflowStep,
} from "./studioTypes";

type OpportunityEditorProps = {
  mode: "create" | "edit";
  opportunityId?: string;
};

const blankOpportunity: OpportunityData = {
  code: "",
  title: "",
  description: "",
  cover_image_url: "",
  term: "",
  destination: "",
  deadline: "",
  seats: 0,
  status: "published",
  ai_summary_bullets: [],
};

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "input"
  );
}

function makeCustomFieldKey(seed: string): string {
  const base = slugify(seed || `custom_${Date.now()}`);
  return base.startsWith("custom_") ? base : `custom_${base}`;
}

function parseOptionsText(value: string): string[] {
  return value
    .split(/[,;\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseRequiredInput(raw: any, stepOrder: number, index: number): RequiredInput {
  const inputType: RequiredInputType = ["text", "number", "dropdown", "multiselect"].includes(raw?.input_type)
    ? raw.input_type
    : ["text", "number", "dropdown", "multiselect"].includes(raw?.inputType)
      ? raw.inputType
      : "text";
  const options = Array.isArray(raw?.options)
    ? raw.options.map((item: unknown) => String(item).trim()).filter(Boolean)
    : parseJson<string[]>(raw?.options_json, []);
  return {
    id: String(raw?.input_key || raw?.id || `${stepOrder}_${slugify(raw?.input_label || raw?.label || `input_${index}`)}`),
    label: String(raw?.input_label || raw?.label || `Input ${index}`),
    inputType,
    required: raw?.is_required === 0 ? false : raw?.required !== false,
    options,
    optionsText: options.join(", "),
  };
}

function normalizeWorkflowStep(item: any, idx: number): WorkflowStep {
  return {
    name: String(item.step_name || item.name || `Step ${idx + 1}`),
    reviewerEmail: String(item.reviewer_email || item.reviewerEmail || ""),
    reviewerName: String(item.reviewer_display_name || item.reviewerName || ""),
    visibleFields: Array.isArray(item.visible_fields) ? item.visible_fields : Array.isArray(item.visibleFields) ? item.visibleFields : [],
    slaHours: Number(item.sla_hours || item.slaHours || 72),
    canViewComments: Boolean(item.can_view_comments || item.canViewComments),
    requiredInputs: (item.required_inputs || item.requiredInputs || []).map((input: any, inputIdx: number) =>
      parseRequiredInput(input, idx + 1, inputIdx + 1)
    ),
  };
}

function normalizeGraphNode(raw: any): StudioGraphNode {
  const metadata = typeof raw.metadata === "string" ? parseJson<Record<string, unknown>>(raw.metadata, {}) : raw.metadata || {};
  return {
    node_key: String(raw.node_key),
    node_type: normalizeNodeType(raw.node_type),
    display_name: raw.display_name ? String(raw.display_name) : null,
    reviewer_email: raw.reviewer_email ? String(raw.reviewer_email) : null,
    visible_sections: Array.isArray(raw.visible_sections)
      ? raw.visible_sections
      : typeof raw.visible_sections === "string"
        ? parseJson<string[]>(raw.visible_sections, ["all"])
        : ["all"],
    allowed_actions: Array.isArray(raw.allowed_actions)
      ? raw.allowed_actions
      : typeof raw.allowed_actions === "string"
        ? parseJson<string[]>(raw.allowed_actions, ["approve", "reject", "request_changes", "comment"])
        : ["approve", "reject", "request_changes", "comment"],
    metadata: {
      required_inputs: Array.isArray((metadata as any).required_inputs) ? (metadata as any).required_inputs : [],
      sla_hours: Number((metadata as any).sla_hours || raw.sla_hours || 72),
      can_view_comments: Boolean((metadata as any).can_view_comments),
      ...metadata,
    },
  };
}

function normalizeNodeType(value: string): StudioNodeType {
  if (["start", "reviewer", "join_all", "join_any", "conditional", "end"].includes(value)) {
    return value as StudioNodeType;
  }
  return "reviewer";
}

function normalizeGraphEdge(raw: any): StudioGraphEdge {
  return {
    from_node_key: String(raw.from_node_key),
    to_node_key: String(raw.to_node_key),
    condition_json: typeof raw.condition_json === "string" ? parseJson<Record<string, unknown> | null>(raw.condition_json, null) : raw.condition_json || null,
    label: raw.label ? String(raw.label) : null,
    action: raw.action ? raw.action : null,
  };
}

export default function OpportunityEditor({ mode, opportunityId }: OpportunityEditorProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableFields, setAvailableFields] = useState<CatalogField[]>([]);
  const [defaultPipeline, setDefaultPipeline] = useState<WorkflowStep[]>([]);
  const [opportunity, setOpportunity] = useState<OpportunityData>(blankOpportunity);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDraft[]>([]);
  const [detailFields, setDetailFields] = useState<OpportunityDetailField[]>([]);
  const [generatorVisibilityRules, setGeneratorVisibilityRules] = useState<GeneratorVisibilityRule[]>([
    { ruleType: "GROUP_EMAIL", ruleValue: "" },
  ]);
  const [graphNodes, setGraphNodes] = useState<StudioGraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<StudioGraphEdge[]>([]);
  const [activeApplications, setActiveApplications] = useState<ImpactApplication[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const fieldResponse = await fetch("/api/form-fields");
        const fieldData = await fieldResponse.json();
        if (!fieldResponse.ok) {
          throw new Error(fieldData?.detail || "Unable to load form field catalog.");
        }

        const fields: CatalogField[] = fieldData.items || [];
        const defaults: WorkflowStep[] = (fieldData.defaultPipelineTemplate || []).map(normalizeWorkflowStep);

        if (!mounted) return;
        setAvailableFields(fields);
        setDefaultPipeline(defaults);

        if (mode === "create") {
          setSelectedFields(fields.filter((field) => ["identity", "academic"].includes(field.section_key)).slice(0, 6).map((field) => field.field_key));
          setLoading(false);
          return;
        }

        const detailResponse = await fetch(`/api/admin/opportunities/${opportunityId}`);
        const detailData = await detailResponse.json();
        if (!detailResponse.ok) {
          throw new Error(detailData?.detail || "Unable to load opportunity details.");
        }

        const graphResponse = await fetch(`/api/admin/opportunities/${opportunityId}/graph`);
        const graphData = await graphResponse.json();
        if (!graphResponse.ok) {
          throw new Error(graphData?.detail || "Unable to load opportunity graph.");
        }

        const applicationsResponse = await fetch("/api/admin/applications");
        const applicationsData = applicationsResponse.ok ? await applicationsResponse.json() : { items: [] };

        if (!mounted) return;

        const opp = detailData.opportunity || {};
        setOpportunity({
          code: String(opp.code || ""),
          title: String(opp.title || ""),
          description: String(opp.description || ""),
          cover_image_url: String(opp.cover_image_url || ""),
          term: String(opp.term || ""),
          destination: String(opp.destination || ""),
          deadline: String(opp.deadline || ""),
          seats: Number(opp.seats || 0),
          status: String(opp.status || "published"),
          ai_summary_bullets: Array.isArray(opp.ai_summary_bullets) ? opp.ai_summary_bullets.map(String) : parseJson<string[]>(opp.ai_summary_json, []),
          ai_summary_source_hash: typeof opp.ai_summary_source_hash === "string" ? opp.ai_summary_source_hash : null,
        });
        setDetailFields(
          (Array.isArray(detailData.detail_fields) ? detailData.detail_fields : []).map((field: any, index: number) => ({
          field_key: String(field.field_key || `detail_${index + 1}`),
          label: String(field.label || ""),
          value: String(field.value || ""),
          value_type: ["text", "number", "date"].includes(field.value_type) ? field.value_type : "text",
            display_order: Number(field.display_order || index + 1),
            is_student_visible: field.is_student_visible !== 0 && field.is_student_visible !== false,
          }))
        );
        setSelectedFields(Array.isArray(detailData.form_fields) ? detailData.form_fields : []);
        setCustomFields(
          (Array.isArray(detailData.custom_fields) ? detailData.custom_fields : []).map((field: any) => ({
            field_key: String(field.field_key || makeCustomFieldKey(field.label || "custom_field")),
            label: String(field.label || ""),
            description: String(field.description || ""),
            fieldHint: String(field.field_hint || field.description || ""),
            inputType: ["text", "textarea", "single_select", "multiselect"].includes(field.input_type) ? field.input_type : "text",
            optionsText: Array.isArray(field.options) ? field.options.join(", ") : parseJson<string[]>(field.options_json, []).join(", "),
            persistForFuture: true,
          }))
        );
        setGeneratorVisibilityRules(
          Array.isArray(detailData.generator_visibility_rules) && detailData.generator_visibility_rules.length > 0
            ? detailData.generator_visibility_rules.map((rule: any) => ({
                ruleType: rule.ruleType === "EMAIL" ? "EMAIL" : "GROUP_EMAIL",
                ruleValue: String(rule.ruleValue || ""),
              }))
            : [{ ruleType: "GROUP_EMAIL", ruleValue: "" }]
        );
        setGraphNodes((graphData.nodes || []).map(normalizeGraphNode));
        setGraphEdges((graphData.edges || []).map(normalizeGraphEdge));
        setDefaultPipeline((detailData.workflow_steps || []).length > 0 ? detailData.workflow_steps.map(normalizeWorkflowStep) : defaults);
        setActiveApplications(
          (applicationsData.items || []).filter(
            (item: ImpactApplication) => Number(item.opportunity_id) === Number(opportunityId) && !item.final_status
          )
        );
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load Opportunity Studio.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [mode, opportunityId]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center text-slate-400">
        <Icon name="progress_activity" className="mb-4 h-10 w-10 animate-spin" />
        Loading Opportunity Studio...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <OpportunityStudio
      mode={mode}
      opportunityId={opportunityId}
      availableFields={availableFields}
      defaultPipeline={defaultPipeline}
      initialOpportunity={opportunity}
      initialDetailFields={detailFields}
      initialSelectedFields={selectedFields}
      initialCustomFields={customFields}
      initialGeneratorVisibilityRules={generatorVisibilityRules}
      initialGraphNodes={graphNodes}
      initialGraphEdges={graphEdges}
      activeApplications={activeApplications}
    />
  );
}
