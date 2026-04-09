"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type CatalogField = {
  field_key: string;
  label: string;
  description?: string | null;
  field_hint?: string | null;
  input_type: string;
  options?: string[];
  section_key: string;
};

type CustomFieldDraft = {
  field_key: string;
  label: string;
  description: string;
  fieldHint: string;
  inputType: "text" | "textarea" | "single_select" | "multiselect";
  optionsText: string;
};

type RequiredInputType = "text" | "number" | "dropdown" | "multiselect";

type RequiredInput = {
  id: string;
  label: string;
  inputType: RequiredInputType;
  required: boolean;
  options: string[];
  optionsText: string;
};

type WorkflowStep = {
  name: string;
  reviewerEmail: string;
  reviewerName: string;
  visibleFields: string[];
  requiredInputs: RequiredInput[];
  slaHours: number;
  canViewComments: boolean;
};

type GeneratorVisibilityRuleType = "EMAIL" | "GROUP_EMAIL";

type GeneratorVisibilityRule = {
  ruleType: GeneratorVisibilityRuleType;
  ruleValue: string;
};

type OpportunityEditorProps = {
  mode: "create" | "edit";
  opportunityId?: string;
};

function blankStep(index: number): WorkflowStep {
  return {
    name: `Review Step ${index}`,
    reviewerEmail: "",
    reviewerName: "",
    visibleFields: [],
    requiredInputs: [],
    slaHours: 72,
    canViewComments: false,
  };
}

function validPlakshaEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@plaksha.edu.in");
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "input"
  );
}

function inputKeyForStep(stepOrder: number, input: RequiredInput): string {
  const base = (input.id || slugify(input.label)).toLowerCase().trim();
  if (base.startsWith(`${stepOrder}_`)) {
    return base;
  }
  return `${stepOrder}_${base}`;
}

function parseOptionsText(value: string): string[] {
  return value
    .split(/[,;\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function makeCustomFieldKey(seed: string): string {
  const base = slugify(seed || `custom_${Date.now()}`);
  return base.startsWith("custom_") ? base : `custom_${base}`;
}

function parseRequiredInput(raw: any, stepOrder: number, index: number): RequiredInput {
  const inputType: RequiredInputType = ["text", "number", "dropdown", "multiselect"].includes(raw?.input_type)
    ? raw.input_type
    : ["text", "number", "dropdown", "multiselect"].includes(raw?.inputType)
      ? raw.inputType
      : "text";

  const id = String(raw?.input_key || raw?.id || `${stepOrder}_${slugify(raw?.input_label || raw?.label || `input_${index}`)}`);
  const label = String(raw?.input_label || raw?.label || `Input ${index}`);

  let optionsRaw: unknown[] = [];
  if (Array.isArray(raw?.options)) {
    optionsRaw = raw.options;
  } else if (typeof raw?.options_json === "string") {
    try {
      const parsed = JSON.parse(raw.options_json);
      if (Array.isArray(parsed)) {
        optionsRaw = parsed;
      }
    } catch {
      optionsRaw = [];
    }
  }
  const options = optionsRaw.map((item: unknown) => String(item).trim()).filter(Boolean);

  return {
    id,
    label,
    inputType,
    required: raw?.is_required === 0 ? false : raw?.required !== false,
    options,
    optionsText: options.join(", "),
  };
}

export default function OpportunityEditor({ mode, opportunityId }: OpportunityEditorProps) {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availableFields, setAvailableFields] = useState<CatalogField[]>([]);
  const [defaultPipeline, setDefaultPipeline] = useState<WorkflowStep[]>([]);

  const [oppData, setOppData] = useState({
    code: "",
    title: "",
    description: "",
    cover_image_url: "",
    term: "",
    destination: "",
    deadline: "",
    seats: 0,
    status: "published",
  });

  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDraft[]>([]);
  const [generatorVisibilityRules, setGeneratorVisibilityRules] = useState<GeneratorVisibilityRule[]>([
    { ruleType: "GROUP_EMAIL", ruleValue: "" },
  ]);
  const [useDefaultTemplate, setUseDefaultTemplate] = useState(mode === "create");
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([blankStep(1)]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const fieldResponse = await fetch("/api/form-fields");
        const fieldData = await fieldResponse.json();

        const fields: CatalogField[] = fieldData.items || [];
        const defaults: WorkflowStep[] = (fieldData.defaultPipelineTemplate || []).map((item: any, idx: number) => ({
          name: String(item.name || `Step ${idx + 1}`),
          reviewerEmail: String(item.reviewerEmail || ""),
          reviewerName: String(item.reviewerName || ""),
          visibleFields: Array.isArray(item.visibleFields) ? item.visibleFields : [],
          slaHours: Number(item.slaHours || 72),
          canViewComments: Boolean(item.canViewComments),
          requiredInputs: (item.requiredInputs || []).map((input: any, inputIdx: number) =>
            parseRequiredInput(input, idx + 1, inputIdx + 1)
          ),
        }));

        if (!mounted) return;

        setAvailableFields(fields);
        setDefaultPipeline(defaults);

        if (mode === "create") {
          if (defaults.length > 0) {
            setWorkflowSteps(defaults);
          }
          setCustomFields([]);
          setLoading(false);
          return;
        }

        const detailResponse = await fetch(`/api/admin/opportunities/${opportunityId}`);
        const detailData = await detailResponse.json();
        if (!detailResponse.ok) {
          throw new Error(detailData?.detail || "Unable to load opportunity details.");
        }

        const opportunity = detailData.opportunity || {};
        const steps: WorkflowStep[] = (detailData.workflow_steps || []).map((ws: any, idx: number) => ({
          name: String(ws.step_name || `Step ${idx + 1}`),
          reviewerEmail: String(ws.reviewer_email || ""),
          reviewerName: String(ws.reviewer_display_name || ""),
          visibleFields: Array.isArray(ws.visible_fields) ? ws.visible_fields : [],
          slaHours: Number(ws.sla_hours || 72),
          canViewComments: Boolean(ws.can_view_comments),
          requiredInputs: (ws.required_inputs || []).map((input: any, inputIdx: number) =>
            parseRequiredInput(input, idx + 1, inputIdx + 1)
          ),
        }));

        if (!mounted) return;

        setOppData({
          code: String(opportunity.code || ""),
          title: String(opportunity.title || ""),
          description: String(opportunity.description || ""),
          cover_image_url: String(opportunity.cover_image_url || ""),
          term: String(opportunity.term || ""),
          destination: String(opportunity.destination || ""),
          deadline: String(opportunity.deadline || ""),
          seats: Number(opportunity.seats || 0),
          status: String(opportunity.status || "published"),
        });

        setSelectedFields(Array.isArray(detailData.form_fields) ? detailData.form_fields : []);
        setCustomFields(
          (Array.isArray(detailData.custom_fields) ? detailData.custom_fields : []).map((field: any) => ({
            field_key: String(field.field_key || makeCustomFieldKey(field.label || "custom_field")),
            label: String(field.label || ""),
            description: String(field.description || ""),
            fieldHint: String(field.field_hint || field.description || ""),
            inputType: ["text", "textarea", "single_select", "multiselect"].includes(field.input_type)
              ? field.input_type
              : "text",
            optionsText: Array.isArray(field.options) ? field.options.join(", ") : "",
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
        setWorkflowSteps(steps.length > 0 ? steps : defaults.length > 0 ? defaults : [blankStep(1)]);
        setUseDefaultTemplate(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load opportunity editor data.");
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

  const selectedFieldSet = useMemo(() => new Set(selectedFields), [selectedFields]);
  const presetFields = useMemo(() => availableFields.filter((field) => field.section_key !== "custom"), [availableFields]);
  const selectableFields = useMemo(() => {
    const merged = new Map<string, CatalogField>();
    for (const field of availableFields) {
      merged.set(field.field_key, field);
    }
    for (const custom of customFields) {
      merged.set(custom.field_key, {
        field_key: custom.field_key,
        label: custom.label || "Custom Field",
        description: custom.description,
        field_hint: custom.fieldHint,
        input_type: custom.inputType,
        options: parseOptionsText(custom.optionsText),
        section_key: "custom",
      });
    }
    return Array.from(merged.values());
  }, [availableFields, customFields]);

  function toggleField(fieldKey: string) {
    setSelectedFields((prev) => {
      if (prev.includes(fieldKey)) {
        return prev.filter((f) => f !== fieldKey);
      }
      return [...prev, fieldKey];
    });
  }

  function addCustomField() {
    const fieldKey = makeCustomFieldKey(`custom_${Date.now()}`);
    setCustomFields((prev) => [
      ...prev,
      { field_key: fieldKey, label: "", description: "", fieldHint: "", inputType: "text", optionsText: "" },
    ]);
    setSelectedFields((prev) => (prev.includes(fieldKey) ? prev : [...prev, fieldKey]));
  }

  function addVisibilityRule() {
    setGeneratorVisibilityRules((prev) => [...prev, { ruleType: "EMAIL", ruleValue: "" }]);
  }

  function updateVisibilityRule(index: number, patch: Partial<GeneratorVisibilityRule>) {
    setGeneratorVisibilityRules((prev) =>
      prev.map((rule, idx) => (idx === index ? { ...rule, ...patch } : rule))
    );
  }

  function removeVisibilityRule(index: number) {
    setGeneratorVisibilityRules((prev) => prev.filter((_, idx) => idx !== index));
  }

  function updateCustomField(fieldKey: string, patch: Partial<CustomFieldDraft>) {
    setCustomFields((prev) =>
      prev.map((field) => (field.field_key === fieldKey ? { ...field, ...patch } : field))
    );
  }

  function removeCustomField(fieldKey: string) {
    setCustomFields((prev) => prev.filter((field) => field.field_key !== fieldKey));
    setSelectedFields((prev) => prev.filter((key) => key !== fieldKey));
  }

  function setWorkflowStepField(stepIndex: number, field: "name" | "reviewerEmail" | "reviewerName" | "slaHours", value: string | number) {
    setWorkflowSteps((prev) => {
      const next = [...prev];
      next[stepIndex] = { ...next[stepIndex], [field]: value } as WorkflowStep;
      return next;
    });
  }

  function setWorkflowStepBooleanField(stepIndex: number, field: "canViewComments", value: boolean) {
    setWorkflowSteps((prev) => {
      const next = [...prev];
      next[stepIndex] = { ...next[stepIndex], [field]: value };
      return next;
    });
  }

  function updateRequiredInput(stepIndex: number, inputIndex: number, patch: Partial<RequiredInput>) {
    setWorkflowSteps((prev) => {
      const next = [...prev];
      const target = { ...next[stepIndex] };
      const updatedInputs = [...target.requiredInputs];
      updatedInputs[inputIndex] = { ...updatedInputs[inputIndex], ...patch };
      target.requiredInputs = updatedInputs;
      next[stepIndex] = target;
      return next;
    });
  }

  function removeRequiredInput(stepIndex: number, inputIndex: number) {
    setWorkflowSteps((prev) => {
      const removed = prev[stepIndex].requiredInputs[inputIndex];
      const removedKey = inputKeyForStep(stepIndex + 1, removed);

      const next = prev.map((item, idx) => {
        if (idx === stepIndex) {
          return {
            ...item,
            requiredInputs: item.requiredInputs.filter((_, i) => i !== inputIndex),
          };
        }
        if (idx > stepIndex) {
          return {
            ...item,
            visibleFields: item.visibleFields.filter((field) => field !== removedKey),
          };
        }
        return item;
      });
      return next;
    });
  }

  function addRequiredInput(stepIndex: number) {
    setWorkflowSteps((prev) => {
      const next = [...prev];
      next[stepIndex] = {
        ...next[stepIndex],
        requiredInputs: [
          ...next[stepIndex].requiredInputs,
          {
            id: `${slugify(next[stepIndex].name || "input")}_${Date.now()}`,
            label: "New Required Input",
            inputType: "text",
            required: true,
            options: [],
            optionsText: "",
          },
        ],
      };
      return next;
    });
  }

  function addWorkflowStep() {
    setWorkflowSteps((prev) => [...prev, blankStep(prev.length + 1)]);
  }

  function removeWorkflowStep(stepIndex: number) {
    setWorkflowSteps((prev) => prev.filter((_, idx) => idx !== stepIndex));
  }

  function reorderSteps(sourceIndex: number, targetIndex: number) {
    if (sourceIndex === targetIndex) return;
    setWorkflowSteps((prev) => {
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next.map((ws) => ({ ...ws, visibleFields: [] }));
    });
  }

  function visibilityOptionsForStep(stepIndex: number): Array<{ key: string; label: string; source: string }> {
    const options: Array<{ key: string; label: string; source: string }> = [];

    for (const field of selectableFields) {
      if (!selectedFieldSet.has(field.field_key)) continue;
      options.push({ key: field.field_key, label: field.label, source: "Applicant form" });
    }

    for (let i = 0; i < stepIndex; i += 1) {
      const prior = workflowSteps[i];
      for (const input of prior.requiredInputs) {
        const key = inputKeyForStep(i + 1, input);
        options.push({ key, label: input.label, source: prior.name });
      }
    }

    const seen = new Set<string>();
    return options.filter((option) => {
      if (seen.has(option.key)) return false;
      seen.add(option.key);
      return true;
    });
  }

  function toggleVisibleField(stepIndex: number, key: string) {
    setWorkflowSteps((prev) => {
      const next = [...prev];
      const target = { ...next[stepIndex] };
      target.visibleFields = target.visibleFields.includes(key)
        ? target.visibleFields.filter((entry) => entry !== key)
        : [...target.visibleFields, key];
      next[stepIndex] = target;
      return next;
    });
  }

  function applyDefaultTemplate(enabled: boolean) {
    setUseDefaultTemplate(enabled);
    if (enabled && defaultPipeline.length > 0) {
      setWorkflowSteps(defaultPipeline);
    }
  }

  function normalizePipelineForSubmit(pipeline: WorkflowStep[]): WorkflowStep[] {
    return pipeline.map((ws, index) => ({
      ...ws,
      reviewerEmail: ws.reviewerEmail.trim().toLowerCase(),
      reviewerName: ws.reviewerName.trim(),
      name: ws.name.trim(),
      slaHours: Math.max(1, Number(ws.slaHours || 72)),
      requiredInputs: ws.requiredInputs.map((input) => ({
        ...input,
        id: inputKeyForStep(index + 1, input),
        label: input.label.trim(),
        options: parseOptionsText(input.optionsText || ""),
        optionsText: input.optionsText || "",
      })),
      canViewComments: Boolean(ws.canViewComments),
      visibleFields: ws.visibleFields,
    }));
  }

  async function submitForm() {
    setError(null);

    if (!oppData.code.trim() || !oppData.title.trim()) {
      setError("Opportunity code and title are required.");
      return;
    }

    if (selectedFields.length === 0) {
      setError("Select at least one applicant field before saving.");
      return;
    }

    const selectedCustomFields = customFields.filter((field) => selectedFieldSet.has(field.field_key));
    const invalidCustomField = selectedCustomFields.find((field) => !field.label.trim());
    if (invalidCustomField) {
      setError("Each selected custom field must include a label.");
      return;
    }
    const invalidCustomOptions = selectedCustomFields.find(
      (field) => (field.inputType === "single_select" || field.inputType === "multiselect") && parseOptionsText(field.optionsText).length === 0
    );
    if (invalidCustomOptions) {
      setError(`Custom field "${invalidCustomOptions.label || "Untitled"}" needs options for select inputs.`);
      return;
    }

    const customFieldsPayload = selectedCustomFields.map((field) => ({
      key: field.field_key,
      label: field.label.trim(),
      description: field.description.trim(),
      fieldHint: field.fieldHint.trim() || field.description.trim(),
      inputType: field.inputType,
      options: parseOptionsText(field.optionsText),
    }));
    const visibilityRulesPayload = generatorVisibilityRules
      .map((rule) => ({
        ruleType: rule.ruleType,
        ruleValue: rule.ruleValue.trim().toLowerCase(),
      }))
      .filter((rule) => rule.ruleValue.length > 0);

    if (visibilityRulesPayload.length === 0) {
      setError("Define at least one eligible generator email/group before saving this opportunity.");
      return;
    }

    const invalidGeneratorRule = visibilityRulesPayload.find((rule) => !validPlakshaEmail(rule.ruleValue));
    if (invalidGeneratorRule) {
      setError(`Generator visibility emails must end with @plaksha.edu.in (${invalidGeneratorRule.ruleValue}).`);
      return;
    }

    const rawPipeline = useDefaultTemplate ? defaultPipeline : workflowSteps;
    const pipelineToSubmit = normalizePipelineForSubmit(rawPipeline);

    if (pipelineToSubmit.length === 0) {
      setError("Define at least one approver step.");
      return;
    }

    const invalidReviewer = pipelineToSubmit.find((item) => !validPlakshaEmail(item.reviewerEmail));
    if (invalidReviewer) {
      setError(`Reviewer email must end with @plaksha.edu.in (${invalidReviewer.name}).`);
      return;
    }

    const invalidInput = pipelineToSubmit
      .flatMap((ws) => ws.requiredInputs.map((input) => ({ ws, input })))
      .find(({ input }) => !input.label.trim());
    if (invalidInput) {
      setError(`Every required input needs a label (${invalidInput.ws.name}).`);
      return;
    }

    const invalidOptionInput = pipelineToSubmit
      .flatMap((ws) => ws.requiredInputs.map((input) => ({ ws, input })))
      .find(({ input }) => ["dropdown", "multiselect"].includes(input.inputType) && input.options.length === 0);
    if (invalidOptionInput) {
      setError(`Dropdown/multiselect inputs require options (${invalidOptionInput.ws.name}).`);
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        const createPayload = {
          opportunity: {
            code: oppData.code,
            title: oppData.title,
            description: oppData.description,
            cover_image_url: oppData.cover_image_url,
            term: oppData.term,
            destination: oppData.destination,
            deadline: oppData.deadline,
            seats: oppData.seats,
          },
          formFields: selectedFields,
          customFields: customFieldsPayload,
          workflowSteps: pipelineToSubmit,
          generatorVisibilityRules: visibilityRulesPayload,
          useDefaultTemplate,
        };

        const response = await fetch("/api/admin/opportunities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });

        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.detail || "Failed to create opportunity");
        }
      } else {
        const patchPayload = {
          title: oppData.title,
          description: oppData.description,
          cover_image_url: oppData.cover_image_url,
          term: oppData.term,
          destination: oppData.destination,
          deadline: oppData.deadline,
          seats: oppData.seats,
          status: oppData.status,
          formFields: selectedFields,
          customFields: customFieldsPayload,
          workflowSteps: pipelineToSubmit,
          generatorVisibilityRules: visibilityRulesPayload,
          useDefaultTemplate,
        };

        const response = await fetch(`/api/admin/opportunities/${opportunityId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchPayload),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.detail || "Failed to update opportunity");
        }
      }

      router.push("/admin/opportunities");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save opportunity.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center text-slate-400">
        <span className="material-symbols-outlined animate-spin text-4xl mb-4">progress_activity</span>
        Loading opportunity editor...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-semibold text-slate-900">
          {mode === "create" ? "Define New Opportunity and Approval Pipeline" : "Edit Opportunity and Approval Pipeline"}
        </h1>
        <p className="text-slate-500 mt-2">
          Step 1 captures applicant fields. Step 2 configures reviewers for this opportunity.
        </p>
      </div>

      <div className="flex gap-4 mb-8">
        <div className={`flex-1 h-2 rounded-full ${step >= 1 ? "bg-primary" : "bg-slate-200"}`} />
        <div className={`flex-1 h-2 rounded-full ${step >= 2 ? "bg-primary" : "bg-slate-200"}`} />
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-medium mb-4">1. Opportunity Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Opportunity ID (Code)</label>
                <input
                  type="text"
                  disabled={mode === "edit"}
                  className="w-full border rounded-lg p-2 disabled:bg-slate-100 disabled:text-slate-500"
                  placeholder="e.g. NUS_FALL_2026"
                  value={oppData.code}
                  onChange={(e) => setOppData({ ...oppData, code: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2"
                  value={oppData.title}
                  onChange={(e) => setOppData({ ...oppData, title: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  className="w-full border rounded-lg p-2"
                  rows={3}
                  value={oppData.description}
                  onChange={(e) => setOppData({ ...oppData, description: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Cover Image URL</label>
                <input
                  type="url"
                  className="w-full border rounded-lg p-2"
                  value={oppData.cover_image_url}
                  onChange={(e) => setOppData({ ...oppData, cover_image_url: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Destination</label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2"
                  value={oppData.destination}
                  onChange={(e) => setOppData({ ...oppData, destination: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Term</label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2"
                  value={oppData.term}
                  onChange={(e) => setOppData({ ...oppData, term: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Deadline</label>
                <input
                  type="date"
                  className="w-full border rounded-lg p-2"
                  value={oppData.deadline}
                  onChange={(e) => setOppData({ ...oppData, deadline: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Available Seats</label>
                <input
                  type="number"
                  className="w-full border rounded-lg p-2"
                  value={oppData.seats}
                  onChange={(e) => setOppData({ ...oppData, seats: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between gap-4 mb-2">
              <h2 className="text-xl font-medium">2. Applicant Form Fields</h2>
              <Button variant="secondary" size="sm" onClick={addCustomField}>
                <span className="material-symbols-outlined mr-1">add</span>
                Add Custom Field
              </Button>
            </div>
            <p className="text-slate-500 text-sm mb-4">Select preset fields and add custom fields with hints and input modes.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {presetFields.map((field) => (
                <label
                  key={field.field_key}
                  className={`flex items-center p-3 border rounded-xl cursor-pointer transition-colors ${
                    selectedFieldSet.has(field.field_key) ? "border-primary bg-primary/5" : "hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mr-3 w-4 h-4 text-primary"
                    checked={selectedFieldSet.has(field.field_key)}
                    onChange={() => toggleField(field.field_key)}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{field.label}</p>
                    {field.description && <p className="text-xs text-slate-500 mt-1">{field.description}</p>}
                    <p className="text-xs text-slate-400 uppercase tracking-wider">{field.section_key}</p>
                  </div>
                </label>
              ))}
            </div>

            {customFields.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Custom Fields</h3>
                {customFields.map((field, index) => (
                  <div key={field.field_key} className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={selectedFieldSet.has(field.field_key)}
                          onChange={() => toggleField(field.field_key)}
                        />
                        Include this field
                      </label>
                      <button
                        type="button"
                        onClick={() => removeCustomField(field.field_key)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Field Label
                        </label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateCustomField(field.field_key, { label: e.target.value })}
                          placeholder={`Custom Field ${index + 1}`}
                          className="w-full border rounded-lg p-2 text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value={field.description}
                          onChange={(e) => updateCustomField(field.field_key, { description: e.target.value })}
                          placeholder="What this field captures"
                          className="w-full border rounded-lg p-2 text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Field Hint
                        </label>
                        <input
                          type="text"
                          value={field.fieldHint}
                          onChange={(e) => updateCustomField(field.field_key, { fieldHint: e.target.value })}
                          placeholder="Instruction shown to generator"
                          className="w-full border rounded-lg p-2 text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Input Type
                        </label>
                        <select
                          value={field.inputType}
                          onChange={(e) => updateCustomField(field.field_key, { inputType: e.target.value as CustomFieldDraft["inputType"] })}
                          className="w-full border rounded-lg p-2 text-sm bg-white"
                        >
                          <option value="text">Simple text box</option>
                          <option value="textarea">Large text box</option>
                          <option value="single_select">Single select</option>
                          <option value="multiselect">Multi select</option>
                        </select>
                      </div>
                    </div>
                    {(field.inputType === "single_select" || field.inputType === "multiselect") && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Options (comma separated)
                        </label>
                        <input
                          type="text"
                          value={field.optionsText}
                          onChange={(e) => updateCustomField(field.field_key, { optionsText: e.target.value })}
                          placeholder="Option A, Option B"
                          className="w-full border rounded-lg p-2 text-sm bg-white"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between gap-4 mb-2">
              <h2 className="text-xl font-medium">3. Eligible Generators</h2>
              <Button variant="secondary" size="sm" onClick={addVisibilityRule}>
                <span className="material-symbols-outlined mr-1">add</span>
                Add Email Rule
              </Button>
            </div>
            <p className="text-slate-500 text-sm mb-4">
              Define who is allowed to apply. Use exact emails for individuals and group emails for Outlook cohorts like
              <span className="font-medium text-slate-700"> ug2024@plaksha.edu.in</span>. This list is mandatory: only explicitly listed emails/groups can access this opportunity in generator mode.
            </p>

            <div className="space-y-3">
              {generatorVisibilityRules.map((rule, index) => (
                <div key={`${rule.ruleType}-${index}`} className="grid grid-cols-1 md:grid-cols-[180px,1fr,auto] gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Rule Type
                    </label>
                    <select
                      className="w-full border rounded-lg p-2 text-sm bg-white"
                      value={rule.ruleType}
                      onChange={(e) => updateVisibilityRule(index, { ruleType: e.target.value as GeneratorVisibilityRuleType })}
                    >
                      <option value="GROUP_EMAIL">Group Email</option>
                      <option value="EMAIL">Exact Email</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      {rule.ruleType === "GROUP_EMAIL" ? "Group Address" : "Email Address"}
                    </label>
                    <input
                      type="email"
                      className="w-full border rounded-lg p-2 text-sm bg-white"
                      placeholder={rule.ruleType === "GROUP_EMAIL" ? "ug2024@plaksha.edu.in" : "john.doe@plaksha.edu.in"}
                      value={rule.ruleValue}
                      onChange={(e) => updateVisibilityRule(index, { ruleValue: e.target.value })}
                    />
                    {rule.ruleValue.trim() && !validPlakshaEmail(rule.ruleValue) && (
                      <p className="mt-1 text-xs text-red-500">Must be a valid `@plaksha.edu.in` email address.</p>
                    )}
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeVisibilityRule(index)}
                      disabled={generatorVisibilityRules.length === 1 && !rule.ruleValue.trim()}
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={selectedFields.length === 0 || !oppData.title || !oppData.code}>
              Next: Configure Pipeline
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-medium">3. Approval Pipeline</h2>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={useDefaultTemplate}
                  onChange={(e) => applyDefaultTemplate(e.target.checked)}
                />
                Use Default Template
              </label>
            </div>
            <p className="text-slate-500 text-sm mb-6">
              Define reviewers, response SLAs, field visibility, and stage inputs.
            </p>
            <p className="text-xs text-slate-500 mb-4">
              If you want to review this opportunity yourself, add your own email as one of the reviewer emails below and place it in the order you want within the chain.
            </p>
            {useDefaultTemplate && (
              <p className="text-xs text-slate-500 mb-6">Uncheck &quot;Use Default Template&quot; to edit reviewer stages or input options.</p>
            )}

            <div className="space-y-6">
              {workflowSteps.map((ws, idx) => {
                const visibilityOptions = visibilityOptionsForStep(idx);

                return (
                  <div
                    key={`${ws.name}-${idx}`}
                    className="border border-slate-200 rounded-xl p-5 bg-slate-50/50"
                    draggable={!useDefaultTemplate}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", String(idx))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const source = Number(e.dataTransfer.getData("text/plain"));
                      reorderSteps(source, idx);
                    }}
                  >
                    <div className="flex justify-between items-center mb-4 gap-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400">drag_indicator</span>
                        <input
                          type="text"
                          className="text-lg font-medium bg-transparent border-b border-transparent hover:border-slate-300 focus:border-primary focus:outline-none px-1 py-0.5"
                          value={ws.name}
                          disabled={useDefaultTemplate}
                          onChange={(e) => setWorkflowStepField(idx, "name", e.target.value)}
                        />
                      </div>
                      {!useDefaultTemplate && workflowSteps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeWorkflowStep(idx)}
                          className="text-red-500 hover:text-red-700 text-sm font-medium"
                        >
                          Remove Step
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Approver Email
                        </label>
                        <input
                          type="email"
                          className="w-full border rounded-lg p-2 text-sm"
                          value={ws.reviewerEmail}
                          disabled={useDefaultTemplate}
                          onChange={(e) => setWorkflowStepField(idx, "reviewerEmail", e.target.value)}
                        />
                        {ws.reviewerEmail && !validPlakshaEmail(ws.reviewerEmail) && (
                          <p className="text-xs text-red-500 mt-1">Must be a @plaksha.edu.in email.</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Approver Name/Role
                        </label>
                        <input
                          type="text"
                          className="w-full border rounded-lg p-2 text-sm"
                          value={ws.reviewerName}
                          disabled={useDefaultTemplate}
                          onChange={(e) => setWorkflowStepField(idx, "reviewerName", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          SLA (Hours)
                        </label>
                        <input
                          type="number"
                          min={1}
                          className="w-full border rounded-lg p-2 text-sm"
                          value={ws.slaHours}
                          disabled={useDefaultTemplate}
                          onChange={(e) => setWorkflowStepField(idx, "slaHours", Number(e.target.value) || 1)}
                        />
                      </div>
                    </div>

                    <div className="mb-5">
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <input
                          type="checkbox"
                          checked={ws.canViewComments}
                          disabled={useDefaultTemplate}
                          onChange={(e) => setWorkflowStepBooleanField(idx, "canViewComments", e.target.checked)}
                        />
                        Allow this reviewer to see full review comments
                      </label>
                    </div>

                    <div className="mb-5">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Visible Data At This Stage
                      </label>
                      {visibilityOptions.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No fields available yet. Add generator fields in step 1.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {visibilityOptions.map((option) => (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => toggleVisibleField(idx, option.key)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                                ws.visibleFields.includes(option.key)
                                  ? "bg-primary text-white border-primary"
                                  : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                              }`}
                            >
                              {option.label}
                              <span className="ml-1 text-[10px] opacity-80">({option.source})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Required Inputs For This Stage
                        </label>
                        <button
                          type="button"
                          onClick={() => addRequiredInput(idx)}
                          className="text-primary hover:text-primary-dark text-xs font-medium"
                        >
                          + Add Input
                        </button>
                      </div>

                      {ws.requiredInputs.length === 0 && (
                        <span className="text-sm text-slate-400 italic">No custom inputs required.</span>
                      )}

                      <div className="space-y-3 mt-2">
                        {ws.requiredInputs.map((input, inputIdx) => (
                          <div key={`${input.id}-${inputIdx}`} className="border rounded-lg p-3 bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                              <input
                                type="text"
                                className="md:col-span-2 border border-slate-200 rounded-md p-2 text-sm"
                                value={input.label}
                                disabled={useDefaultTemplate}
                                onChange={(e) => updateRequiredInput(idx, inputIdx, { label: e.target.value })}
                              />
                              <select
                                className="border border-slate-200 rounded-md p-2 text-sm"
                                value={input.inputType}
                                disabled={useDefaultTemplate}
                                onChange={(e) =>
                                  updateRequiredInput(idx, inputIdx, {
                                    inputType: e.target.value as RequiredInputType,
                                    options:
                                      e.target.value === "dropdown" || e.target.value === "multiselect"
                                        ? input.options
                                        : [],
                                    optionsText:
                                      e.target.value === "dropdown" || e.target.value === "multiselect"
                                        ? input.optionsText
                                        : "",
                                  })
                                }
                              >
                                <option value="text">Bare text box</option>
                                <option value="number">Numeric input</option>
                                <option value="dropdown">Dropdown menu</option>
                                <option value="multiselect">Multi select options</option>
                              </select>
                              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={input.required}
                                  disabled={useDefaultTemplate}
                                  onChange={(e) => updateRequiredInput(idx, inputIdx, { required: e.target.checked })}
                                />
                                Required
                              </label>
                              <button
                                type="button"
                                onClick={() => removeRequiredInput(idx, inputIdx)}
                                disabled={useDefaultTemplate}
                                className="justify-self-end p-2 text-slate-400 hover:text-red-500"
                              >
                                <span className="material-symbols-outlined text-sm">close</span>
                              </button>
                            </div>

                            {(input.inputType === "dropdown" || input.inputType === "multiselect") && (
                              <div className="mt-2">
                                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                  Options (comma separated)
                                </label>
                                <input
                                  type="text"
                                  className="w-full border border-slate-200 rounded-md p-2 text-sm"
                                  value={input.optionsText}
                                  disabled={useDefaultTemplate}
                                  onChange={(e) =>
                                    updateRequiredInput(idx, inputIdx, {
                                      optionsText: e.target.value,
                                      options: parseOptionsText(e.target.value),
                                    })
                                  }
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!useDefaultTemplate && (
              <Button variant="secondary" className="w-full mt-4" onClick={addWorkflowStep}>
                <span className="material-symbols-outlined mr-2">add</span>
                Add Approver Step
              </Button>
            )}
          </Card>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={submitForm} disabled={saving}>
              {saving ? "Saving..." : mode === "create" ? "Create and Publish" : "Save Changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
