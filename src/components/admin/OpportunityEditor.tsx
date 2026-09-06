"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import OpportunityStudio from "./OpportunityStudio";
import { levelsFromGraph, validateLevels, type ReviewLevel } from "./levels";
import {
  customFieldsFromDraft,
  parseCatalogResponse,
  parseDraftResponse,
  parseGraphResponse,
  parseOpportunityResponse,
} from "./studioApi";
import type {
  CatalogField,
  CustomFieldDraft,
  DraftOutput,
  OpportunityData,
  OpportunityDetailField,
  StudentVisibilityRule,
} from "./studioTypes";

type OpportunityEditorProps = { mode: "create" | "edit"; opportunityId?: string };

type LoadedEditor = {
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

function draftIdFromLocation(): number | null {
  const raw = new URLSearchParams(window.location.search).get("draft");
  if (raw == null) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`The draft ID "${raw}" is invalid.`);
  return value;
}

function outputLevels(output: DraftOutput): ReviewLevel[] {
  if (output.graph.levels) return validateLevels(output.graph.levels);
  return levelsFromGraph(output.graph.nodes ?? [], output.graph.edges ?? []);
}

export default function OpportunityEditor({ mode, opportunityId }: OpportunityEditorProps) {
  const [loaded, setLoaded] = useState<LoadedEditor | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoaded(null);
      setError(null);
      try {
        const routeOpportunityId = opportunityId == null ? undefined : Number(opportunityId);
        if (routeOpportunityId !== undefined && (!Number.isSafeInteger(routeOpportunityId) || routeOpportunityId < 1)) {
          throw new Error(`The opportunity ID "${opportunityId}" is invalid.`);
        }
        const requestedDraftId = draftIdFromLocation();
        const catalogPromise = api<unknown>("/api/form-fields");

        if (requestedDraftId) {
          const [catalogRaw, draftRaw] = await Promise.all([
            catalogPromise,
            api<unknown>(`/api/admin/workflow-drafts/${requestedDraftId}`),
          ]);
          const saved = parseDraftResponse(draftRaw);
          if (routeOpportunityId && saved.draft.opportunity_id && routeOpportunityId !== saved.draft.opportunity_id) {
            throw new Error("This draft belongs to a different opportunity.");
          }
          const output = saved.output;
          const parsedOpportunity = output.opportunity;
          if (!mounted) return;
          setLoaded({
            availableFields: parseCatalogResponse(catalogRaw),
            opportunity: {
              ...blankOpportunity,
              ...parsedOpportunity,
              code: parsedOpportunity.code ?? "",
              cover_image_url: parsedOpportunity.cover_image_url ?? "",
              term: parsedOpportunity.term ?? "",
              destination: parsedOpportunity.destination ?? "",
              deadline: parsedOpportunity.deadline ?? "",
              seats: parsedOpportunity.seats ?? 0,
              ai_summary_bullets: parsedOpportunity.ai_summary_bullets ?? [],
            },
            detailFields: parsedOpportunity.detail_fields ?? [],
            selectedFields: output.applicant_form_fields ?? [],
            customFields: customFieldsFromDraft(output),
            visibilityRules: (output.student_visibility_rules ?? []).map((ruleValue) => ({ ruleValue })),
            levels: outputLevels(output),
            draftId: saved.draft.id,
            draftUpdatedAt: saved.draft.updated_at ?? null,
            effectiveOpportunityId: saved.draft.opportunity_id ?? routeOpportunityId,
            aiOutput: output,
          });
          return;
        }

        if (mode === "create") {
          const availableFields = parseCatalogResponse(await catalogPromise);
          if (!mounted) return;
          setLoaded({
            availableFields,
            opportunity: blankOpportunity,
            detailFields: [],
            selectedFields: availableFields
              .filter((field) => ["identity", "academic"].includes(field.section_key))
              .slice(0, 6)
              .map((field) => field.field_key),
            customFields: [],
            visibilityRules: [{ ruleValue: "" }],
            levels: [],
            draftId: null,
            draftUpdatedAt: null,
            aiOutput: null,
          });
          return;
        }

        if (!routeOpportunityId) throw new Error("An opportunity ID is required in edit mode.");
        const [catalogRaw, detailRaw, graphRaw] = await Promise.all([
          catalogPromise,
          api<unknown>(`/api/admin/opportunities/${routeOpportunityId}`),
          api<unknown>(`/api/admin/opportunities/${routeOpportunityId}/graph`),
        ]);
        const details = parseOpportunityResponse(detailRaw);
        const graph = parseGraphResponse(graphRaw);
        if (!mounted) return;
        setLoaded({
          availableFields: parseCatalogResponse(catalogRaw),
          opportunity: details.opportunity,
          detailFields: details.detailFields,
          selectedFields: details.selectedFields,
          customFields: details.customFields,
          visibilityRules: details.visibilityRules.length ? details.visibilityRules : [{ ruleValue: "" }],
          levels: levelsFromGraph(graph.nodes, graph.edges),
          draftId: null,
          draftUpdatedAt: null,
          effectiveOpportunityId: routeOpportunityId,
          aiOutput: null,
        });
      } catch (caught) {
        if (mounted) setError(caught instanceof Error ? caught.message : "Failed to load Opportunity Studio.");
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [mode, opportunityId]);

  if (!loaded && !error) {
    return (
      <div className="flex flex-col items-center py-20 text-slate-400" role="status">
        <span className="material-symbols-outlined mb-4 animate-spin text-4xl">progress_activity</span>
        Loading Opportunity Studio…
      </div>
    );
  }
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>;
  return <OpportunityStudio {...loaded!} />;
}
