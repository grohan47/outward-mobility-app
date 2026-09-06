"use client";

import { useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ApplicationFormScreen, SetupScreen } from "./OpportunitySteps";
import StudioGraph from "./StudioGraph";
import StudioInspector from "./StudioInspector";
import { compileLevels, levelsFromGraph, newLevel, reviewer, validateLevels, type ReviewLevel } from "./levels";
import { customFieldsFromDraft, parseDraftResponse } from "./studioApi";
import type {
  CatalogField,
  CustomFieldDraft,
  DraftOutput,
  OpportunityData,
  OpportunityDetailField,
  StudentVisibilityRule,
  StudioGraphNode,
} from "./studioTypes";

type Props = {
  availableFields: CatalogField[];
  opportunity: OpportunityData;
  detailFields: OpportunityDetailField[];
  selectedFields: string[];
  customFields: CustomFieldDraft[];
  visibilityRules: StudentVisibilityRule[];
  levels: ReviewLevel[];
  draftId: number | null;
  draftUpdatedAt: string | null;
  effectiveOpportunityId?: number;
  aiOutput: DraftOutput | null;
};

type Draft = {
  opportunity: OpportunityData;
  detailFields: OpportunityDetailField[];
  fields: string[];
  customFields: CustomFieldDraft[];
  eligibility: StudentVisibilityRule[];
  levels: ReviewLevel[];
};

type DraftAction = (current: Draft) => Draft;

function outputLevels(output: DraftOutput): ReviewLevel[] {
  if (output.graph.levels) return validateLevels(output.graph.levels);
  return levelsFromGraph(output.graph.nodes ?? [], output.graph.edges ?? []);
}

function warningsFromRow(raw: string | null): string {
  if (!raw) return "Complete the opportunity before publishing.";
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String).join("; ") || "Complete the opportunity before publishing.";
  } catch {
    // The row came from the API; expose a useful fallback instead of its storage format.
  }
  return "Complete the opportunity before publishing.";
}

export default function OpportunityStudio(props: Props) {
  const router = useRouter();
  const [draft, dispatch] = useReducer((current: Draft, action: DraftAction) => action(current), {
    opportunity: props.opportunity,
    detailFields: props.detailFields,
    fields: props.selectedFields,
    customFields: props.customFields,
    eligibility: props.visibilityRules,
    levels: props.levels,
  });
  const editRevision = useRef(0);
  const [step, setStep] = useState<"details" | "form" | "pipeline">("details");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [aiOutput, setAiOutput] = useState<DraftOutput | null>(props.aiOutput);
  const [draftId, setDraftId] = useState<number | null>(props.draftId);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(props.draftUpdatedAt);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [aiBusy, setAiBusy] = useState(false);
  const [summarySource, setSummarySource] = useState(JSON.stringify(props.opportunity));

  function change(recipe: DraftAction) {
    editRevision.current += 1;
    dispatch(recipe);
    setNotice("");
  }

  function setter<K extends keyof Draft>(key: K): React.Dispatch<React.SetStateAction<Draft[K]>> {
    return (value) => change((current) => ({
      ...current,
      [key]: typeof value === "function" ? (value as (previous: Draft[K]) => Draft[K])(current[key]) : value,
    }));
  }

  const fields: CatalogField[] = [
    ...props.availableFields.filter((field) => !draft.customFields.some((custom) => custom.field_key === field.field_key)),
    ...draft.customFields.map((field) => ({
      field_key: field.field_key,
      label: field.label,
      description: field.description,
      field_hint: field.fieldHint,
      input_type: field.inputType,
      options: field.optionsText.split(",").map((value) => value.trim()).filter(Boolean),
      section_key: "custom",
    })),
  ];
  const node = draft.levels.flatMap((level) => level.reviewers).find((candidate) => candidate.node_key === selected);
  const questions = (aiOutput?.clarifying_questions ?? []).filter((question) => !answers[question]?.trim());

  function changeLevels(recipe: (levels: ReviewLevel[]) => ReviewLevel[]) {
    change((current) => ({ ...current, levels: recipe(current.levels) }));
  }

  function closeInspector() {
    const key = selected;
    setSelected(null);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-node="${key}"]`)?.focus());
  }

  function payload() {
    return {
      opportunityId: props.effectiveOpportunityId,
      draftId: draftId ?? undefined,
      expectedUpdatedAt: draftUpdatedAt ?? undefined,
      opportunity: { ...draft.opportunity, detail_fields: draft.detailFields },
      graph: compileLevels(draft.levels),
      applicantFormFields: draft.fields,
      customFields: draft.customFields.map((field) => ({
        key: field.field_key,
        label: field.label,
        description: field.description,
        fieldHint: field.fieldHint,
        inputType: field.inputType,
        options: field.optionsText.split(/[,\n]+/).map((value) => value.trim()).filter(Boolean),
        persistForFuture: field.persistForFuture !== false,
      })),
      studentVisibilityRules: draft.eligibility.map((rule) => ({
        ruleType: rule.ruleType,
        ruleValue: rule.ruleValue.trim(),
      })).filter((rule) => rule.ruleValue),
      clarifyingQuestions: questions,
      confidence: aiOutput?.confidence ?? 1,
      warnings: [],
      isFallback: false,
    };
  }

  async function save(publish: boolean) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = parseDraftResponse(await api<unknown>("/api/admin/workflow-drafts/manual", {
        method: "POST",
        body: JSON.stringify(payload()),
      }));
      setDraftId(saved.draft.id);
      setDraftUpdatedAt(saved.draft.updated_at ?? null);
      if (publish) {
        if (!saved.draft.publish_ready) throw new Error(warningsFromRow(saved.draft.warnings));
        const published = await api<{ opportunity_id: number; graph_version_id: number }>(`/api/admin/workflow-drafts/${saved.draft.id}/publish`, { method: "POST" });
        setNotice(`Published graph version ${published.graph_version_id}. Existing applications retain their submitted version.`);
        router.push(`/admin/opportunities/${published.opportunity_id}`);
        router.refresh();
      } else {
        const url = new URL(window.location.href);
        url.searchParams.set("draft", String(saved.draft.id));
        window.history.replaceState(null, "", `${url.pathname}${url.search}`);
        setNotice("Draft saved.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }

  async function generate(regenerate = false) {
    const startedAtRevision = editRevision.current;
    setAiBusy(true);
    setError("");
    try {
      if (regenerate && !draftId) throw new Error("Save or generate a draft before submitting answers.");
      const raw = await api<unknown>(
        regenerate ? `/api/admin/workflow-drafts/${draftId}/regenerate` : "/api/admin/opportunities/ai-generate",
        { method: "POST", body: JSON.stringify(regenerate ? { answers } : { prompt }) },
      );
      const generated = parseDraftResponse(raw);
      setDraftId(generated.draft.id);
      setDraftUpdatedAt(generated.draft.updated_at ?? null);
      if (editRevision.current !== startedAtRevision) {
        setNotice("PRISM finished, but its response was not applied because you edited the draft while it was working.");
        return;
      }
      const output = generated.output;
      dispatch((current) => ({
        opportunity: {
          ...current.opportunity,
          ...output.opportunity,
          code: output.opportunity.code ?? current.opportunity.code,
          cover_image_url: output.opportunity.cover_image_url ?? "",
          term: output.opportunity.term ?? "",
          destination: output.opportunity.destination ?? "",
          deadline: output.opportunity.deadline ?? "",
          seats: output.opportunity.seats ?? 0,
          status: current.opportunity.status,
          ai_summary_bullets: output.opportunity.ai_summary_bullets ?? [],
        },
        detailFields: output.opportunity.detail_fields ?? [],
        levels: outputLevels(output),
        fields: output.applicant_form_fields ?? current.fields,
        customFields: output.custom_fields ? customFieldsFromDraft(output) : current.customFields,
        eligibility: output.student_visibility_rules?.map((ruleValue) => ({ ruleValue })) ?? current.eligibility,
      }));
      setAiOutput(output);
      setAnswers({});
      setNotice("AI draft loaded. Review all three steps before publishing.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to generate draft.");
    } finally {
      setAiBusy(false);
    }
  }

  function generateSummary() {
    change((current) => {
      const bullets = current.detailFields
        .filter((field) => field.is_student_visible && field.value)
        .map((field) => `${field.label}: ${field.value}`)
        .slice(0, 5);
      const opportunity = { ...current.opportunity, ai_summary_bullets: bullets };
      setSummarySource(JSON.stringify(opportunity));
      return { ...current, opportunity };
    });
  }

  function updateReviewer(next: StudioGraphNode) {
    changeLevels((levels) => levels.map((level) => {
      const containsNode = level.reviewers.some((candidate) => candidate.node_key === next.node_key);
      if (!containsNode) return level;
      return {
        ...level,
        reviewers: level.reviewers.map((candidate) => {
          if (candidate.node_key === next.node_key) return next;
          if (next.metadata.return_rule) return { ...candidate, metadata: { ...candidate.metadata, return_rule: null } };
          return candidate;
        }),
      };
    }));
  }

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold">{draft.opportunity.title || "New opportunity"}</h1>
          <p className="text-sm text-slate-500">Configure details, the student form, and review levels.</p>
        </div>
        <div className="flex gap-2">
          <button disabled={busy || aiBusy} onClick={() => void save(false)} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Save draft</button>
          <button disabled={busy || aiBusy} onClick={() => void save(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "Saving…" : "Publish"}</button>
        </div>
      </header>
      <nav aria-label="Opportunity steps" className="flex flex-wrap gap-2">
        {(["details", "form", "pipeline"] as const).map((item, index) => (
          <button key={item} aria-current={step === item ? "step" : undefined} onClick={() => setStep(item)} className={`rounded-lg px-4 py-2 text-sm ${step === item ? "bg-indigo-100 font-semibold text-indigo-900" : "bg-white text-slate-600"}`}>
            {index + 1}. {item === "details" ? "Details" : item === "form" ? "Student form" : "Reviewers"}
          </button>
        ))}
      </nav>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="rounded-lg border bg-white p-3 text-sm">{notice}</div>}
      <fieldset disabled={busy} className="min-w-0">
        {step === "details" && (
          <SetupScreen
            opportunity={draft.opportunity}
            setOpportunity={setter("opportunity")}
            detailFields={draft.detailFields}
            setDetailFields={setter("detailFields")}
            summaryIsStale={summarySource !== JSON.stringify(draft.opportunity)}
            onGenerateSummary={generateSummary}
            aiPrompt={prompt}
            setAiPrompt={setPrompt}
            aiGenerating={aiBusy}
            draftOutput={aiOutput}
            answers={answers}
            answering={aiBusy}
            openQuestions={questions}
            onGenerateDraft={() => void generate()}
            onAnswerChange={(question, answer) => setAnswers((current) => ({ ...current, [question]: answer }))}
            onSubmitAnswers={() => void generate(true)}
            onContinue={() => setStep("form")}
          />
        )}
        {step === "form" && (
          <ApplicationFormScreen
            selectedFields={draft.fields}
            setSelectedFields={setter("fields")}
            selectableFields={fields}
            customFields={draft.customFields}
            setCustomFields={setter("customFields")}
            visibilityRules={draft.eligibility}
            setVisibilityRules={setter("eligibility")}
            onBack={() => setStep("details")}
            onContinue={() => setStep("pipeline")}
          />
        )}
        {step === "pipeline" && (
          <div className={`grid min-w-0 items-start gap-4 ${node ? "lg:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1"}`}>
            <StudioGraph
              levels={draft.levels}
              selected={selected}
              onSelect={setSelected}
              onAddLevel={() => changeLevels((levels) => [...levels, newLevel()])}
              onAddNode={(levelId) => {
                const added = reviewer();
                changeLevels((levels) => levels.map((level) => level.id === levelId ? { ...level, reviewers: [...level.reviewers, added] } : level));
                setSelected(added.node_key);
              }}
              onRenameLevel={(levelId, name) => changeLevels((levels) => levels.map((level) => level.id === levelId ? { ...level, name } : level))}
              onRemoveLevel={(levelId) => changeLevels((levels) => levels.filter((level) => level.id !== levelId))}
              onMoveLevel={(index, delta) => changeLevels((current) => {
                const levels = [...current];
                [levels[index], levels[index + delta]] = [levels[index + delta], levels[index]];
                return levels;
              })}
            />
            {node && (
              <StudioInspector
                node={node}
                levels={draft.levels}
                fields={fields.filter((field) => draft.fields.includes(field.field_key))}
                onClose={closeInspector}
                onUpdate={updateReviewer}
                onRemove={() => {
                  changeLevels((levels) => levels.map((level) => ({ ...level, reviewers: level.reviewers.filter((candidate) => candidate.node_key !== selected) })));
                  setSelected(null);
                }}
              />
            )}
          </div>
        )}
      </fieldset>
      <details className="rounded-lg border bg-white p-3 text-sm">
        <summary className="cursor-pointer">Opportunity JSON</summary>
        <pre className="mt-3 max-h-96 overflow-auto text-xs">{JSON.stringify(payload(), null, 2)}</pre>
      </details>
    </div>
  );
}
