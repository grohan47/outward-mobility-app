"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AIReviewPanel from "./AIReviewPanel";
import StudioGraph from "./StudioGraph";
import StudioInspector from "./StudioInspector";
import type {
  CatalogField,
  CustomFieldDraft,
  DraftOutput,
  GeneratorVisibilityRule,
  ImpactApplication,
  OpportunityData,
  StudioGraphEdge,
  StudioGraphNode,
  WorkflowStep,
} from "./studioTypes";

type OpportunityStudioProps = {
  mode: "create" | "edit";
  opportunityId?: string;
  availableFields: CatalogField[];
  defaultPipeline: WorkflowStep[];
  initialOpportunity: OpportunityData;
  initialSelectedFields: string[];
  initialCustomFields: CustomFieldDraft[];
  initialGeneratorVisibilityRules: GeneratorVisibilityRule[];
  initialGraphNodes: StudioGraphNode[];
  initialGraphEdges: StudioGraphEdge[];
  activeApplications: ImpactApplication[];
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
};

function validPlakshaEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@plaksha.edu.in");
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "node"
  );
}

function nodeKey(seed: string) {
  return `${slugify(seed)}_${Date.now().toString(36)}`;
}

function defaultReviewerNode(label = "New Reviewer"): StudioGraphNode {
  const key = nodeKey(label);
  return {
    node_key: key,
    node_type: "reviewer",
    display_name: label,
    reviewer_email: "",
    visible_sections: ["all"],
    allowed_actions: ["approve", "request_changes", "comment"],
    metadata: { required_inputs: [], sla_hours: 72, can_view_comments: false },
  };
}

function startNode(): StudioGraphNode {
  return {
    node_key: "start",
    node_type: "start",
    display_name: "Start",
    reviewer_email: null,
    visible_sections: ["all"],
    allowed_actions: [],
    metadata: { required_inputs: [] },
  };
}

function endNode(): StudioGraphNode {
  return {
    node_key: "end",
    node_type: "end",
    display_name: "End",
    reviewer_email: null,
    visible_sections: ["all"],
    allowed_actions: [],
    metadata: { required_inputs: [] },
  };
}

function workflowStepsToGraph(steps: WorkflowStep[]): { nodes: StudioGraphNode[]; edges: StudioGraphEdge[] } {
  if (steps.length === 0) return { nodes: [], edges: [] };
  const reviewers = steps.map((step, index) => ({
    node_key: `review_${index + 1}_${slugify(step.name)}`,
    node_type: "reviewer" as const,
    display_name: step.reviewerName || step.name,
    reviewer_email: step.reviewerEmail,
    visible_sections: step.visibleFields.length > 0 ? step.visibleFields : ["all"],
    allowed_actions: ["approve", "request_changes", "comment"],
    metadata: {
      required_inputs: step.requiredInputs.map((input) => {
        const inputType = input.inputType === "dropdown" || input.inputType === "multiselect" ? "select" : input.inputType === "number" ? "number" : "text";
        return {
          input_key: input.id || slugify(input.label),
          label: input.label,
          input_type: inputType as "text" | "number" | "select",
          options: input.options,
          required: input.required,
        };
      }),
      sla_hours: step.slaHours,
      can_view_comments: step.canViewComments,
    },
  }));
  const nodes = [startNode(), ...reviewers, endNode()];
  const edges = nodes.slice(0, -1).map((node, index) => ({
    from_node_key: node.node_key,
    to_node_key: nodes[index + 1].node_key,
  }));
  return { nodes, edges };
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function OpportunityStudio({
  mode,
  opportunityId,
  availableFields,
  defaultPipeline,
  initialOpportunity,
  initialSelectedFields,
  initialCustomFields,
  initialGeneratorVisibilityRules,
  initialGraphNodes,
  initialGraphEdges,
  activeApplications,
}: OpportunityStudioProps) {
  const router = useRouter();
  const [studioMode, setStudioMode] = useState<"ai" | "manual">(mode === "create" ? "ai" : "manual");
  const [mobileTab, setMobileTab] = useState<"details" | "graph" | "inspector">("graph");
  const [opportunity, setOpportunity] = useState<OpportunityData>(initialOpportunity || blankOpportunity);
  const [selectedFields, setSelectedFields] = useState<string[]>(initialSelectedFields);
  const [customFields, setCustomFields] = useState<CustomFieldDraft[]>(initialCustomFields);
  const [visibilityRules, setVisibilityRules] = useState<GeneratorVisibilityRule[]>(
    initialGeneratorVisibilityRules.length > 0 ? initialGeneratorVisibilityRules : [{ ruleType: "GROUP_EMAIL", ruleValue: "" }]
  );
  const fallbackGraph = useMemo(() => workflowStepsToGraph(defaultPipeline), [defaultPipeline]);
  const [graphNodes, setGraphNodes] = useState<StudioGraphNode[]>(
    initialGraphNodes.length > 0 ? initialGraphNodes : mode === "edit" ? fallbackGraph.nodes : []
  );
  const [graphEdges, setGraphEdges] = useState<StudioGraphEdge[]>(initialGraphEdges.length > 0 ? initialGraphEdges : mode === "edit" ? fallbackGraph.edges : []);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [draftOutput, setDraftOutput] = useState<DraftOutput | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [expandedAISection, setExpandedAISection] = useState<"summary" | "questions" | "warnings" | "confidence" | null>(null);
  const [answering, setAnswering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [publishReady, setPublishReady] = useState(false);
  const [successOverlay, setSuccessOverlay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [history, setHistory] = useState<Array<{ nodes: StudioGraphNode[]; edges: StudioGraphEdge[] }>>([]);
  const [future, setFuture] = useState<Array<{ nodes: StudioGraphNode[]; edges: StudioGraphEdge[] }>>([]);

  const selectableFields = useMemo(() => {
    const map = new Map<string, CatalogField>();
    for (const field of availableFields) map.set(field.field_key, field);
    for (const field of customFields) {
      map.set(field.field_key, {
        field_key: field.field_key,
        label: field.label || "Custom Field",
        description: field.description,
        field_hint: field.fieldHint,
        input_type: field.inputType,
        options: field.optionsText.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean),
        section_key: "custom",
      });
    }
    return Array.from(map.values());
  }, [availableFields, customFields]);

  const selectedNode = graphNodes.find((node) => node.node_key === selectedNodeKey) || null;
  const selectedEdge = selectedEdgeKey
    ? graphEdges.find((edge) => `${edge.from_node_key}->${edge.to_node_key}` === selectedEdgeKey) || null
    : null;
  const openQuestions = (draftOutput?.clarifying_questions || []).filter((question) => !answers[question]?.trim());
  const validationWarnings = validateGraph(graphNodes);
  const fallbackUsed = Boolean(draftOutput?.is_fallback);
  const activeImpact = activeApplications.filter((item) => !item.final_status);

  function pushHistory(nodes = graphNodes, edges = graphEdges) {
    setHistory((prev) => [...prev.slice(-19), { nodes, edges }]);
    setFuture([]);
    setPublishReady(false);
  }

  function commitGraph(nodes: StudioGraphNode[], edges: StudioGraphEdge[]) {
    pushHistory();
    setGraphNodes(nodes);
    setGraphEdges(edges);
  }

  function addReviewer() {
    const reviewer = defaultReviewerNode("New Reviewer");
    if (graphNodes.length === 0) {
      commitGraph([startNode(), reviewer, endNode()], [
        { from_node_key: "start", to_node_key: reviewer.node_key },
        { from_node_key: reviewer.node_key, to_node_key: "end" },
      ]);
      setSelectedNodeKey(reviewer.node_key);
      setMobileTab("inspector");
      return;
    }

    const source = selectedNodeKey && graphNodes.some((node) => node.node_key === selectedNodeKey) ? selectedNodeKey : graphNodes.find((node) => node.node_type === "reviewer")?.node_key || "start";
    const outgoing = graphEdges.filter((edge) => edge.from_node_key === source);
    const remaining = graphEdges.filter((edge) => edge.from_node_key !== source);
    const edges = [
      ...remaining,
      { from_node_key: source, to_node_key: reviewer.node_key },
      ...(outgoing.length > 0 ? outgoing.map((edge) => ({ ...edge, from_node_key: reviewer.node_key })) : [{ from_node_key: reviewer.node_key, to_node_key: "end" }]),
    ];
    commitGraph([...graphNodes, reviewer], dedupeEdges(edges));
    setSelectedNodeKey(reviewer.node_key);
    setMobileTab("inspector");
  }

  function addParallelGroup() {
    const selected = graphNodes.find((node) => node.node_key === selectedNodeKey);
    if (!selected || selected.node_type !== "reviewer") {
      if (graphNodes.length === 0) {
        addReviewer();
      } else {
        setError("Select a reviewer node before adding a parallel group.");
      }
      return;
    }

    const parallel = defaultReviewerNode("Configure this reviewer");
    const merge: StudioGraphNode = {
      node_key: nodeKey("merge"),
      node_type: "join_all",
      display_name: "merge",
      reviewer_email: null,
      visible_sections: ["all"],
      allowed_actions: [],
      metadata: { required_inputs: [] },
    };
    const incoming = graphEdges.filter((edge) => edge.to_node_key === selected.node_key);
    const outgoing = graphEdges.filter((edge) => edge.from_node_key === selected.node_key);
    const remaining = graphEdges.filter((edge) => edge.from_node_key !== selected.node_key);
    const parentKeys = incoming.length > 0 ? incoming.map((edge) => edge.from_node_key) : ["start"];
    const targetKeys = outgoing.length > 0 ? outgoing.map((edge) => edge.to_node_key) : ["end"];
    const edges = [
      ...remaining,
      ...parentKeys.map((parent) => ({ from_node_key: parent, to_node_key: parallel.node_key })),
      { from_node_key: selected.node_key, to_node_key: merge.node_key },
      { from_node_key: parallel.node_key, to_node_key: merge.node_key },
      ...targetKeys.map((target) => ({ from_node_key: merge.node_key, to_node_key: target })),
    ];
    commitGraph([...graphNodes, parallel, merge], dedupeEdges(edges));
    setSelectedNodeKey(parallel.node_key);
    setSelectedEdgeKey(null);
    setMobileTab("inspector");
  }

  function addCondition() {
    if (!selectedEdgeKey) {
      setError("Select an edge before adding a condition.");
      return;
    }
    const [from, to] = selectedEdgeKey.split("->");
    setGraphEdges((prev) =>
      prev.map((edge) =>
        edge.from_node_key === from && edge.to_node_key === to
          ? { ...edge, condition_json: edge.condition_json || { field: "", op: "equals", value: "" }, label: edge.label || "Condition" }
          : edge
      )
    );
    setMobileTab("inspector");
  }

  function updateNode(nodeKeyToUpdate: string, patch: Partial<StudioGraphNode>) {
    pushHistory();
    setGraphNodes((prev) => prev.map((node) => (node.node_key === nodeKeyToUpdate ? { ...node, ...patch } : node)));
  }

  function updateEdge(edgeKey: string, patch: Partial<StudioGraphEdge>) {
    const [from, to] = edgeKey.split("->");
    pushHistory();
    setGraphEdges((prev) => prev.map((edge) => (edge.from_node_key === from && edge.to_node_key === to ? { ...edge, ...patch } : edge)));
  }

  function removeNode(nodeKeyToRemove: string) {
    const node = graphNodes.find((item) => item.node_key === nodeKeyToRemove);
    if (!node || node.node_type !== "reviewer") return;
    const incoming = graphEdges.filter((edge) => edge.to_node_key === nodeKeyToRemove);
    const outgoing = graphEdges.filter((edge) => edge.from_node_key === nodeKeyToRemove);
    const bridged = incoming.flatMap((inEdge) => outgoing.map((outEdge) => ({ from_node_key: inEdge.from_node_key, to_node_key: outEdge.to_node_key })));
    commitGraph(
      graphNodes.filter((item) => item.node_key !== nodeKeyToRemove),
      dedupeEdges([...graphEdges.filter((edge) => edge.from_node_key !== nodeKeyToRemove && edge.to_node_key !== nodeKeyToRemove), ...bridged])
    );
    setSelectedNodeKey(null);
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setFuture((prev) => [{ nodes: graphNodes, edges: graphEdges }, ...prev]);
    setHistory((prev) => prev.slice(0, -1));
    setGraphNodes(previous.nodes);
    setGraphEdges(previous.edges);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setHistory((prev) => [...prev, { nodes: graphNodes, edges: graphEdges }]);
    setFuture((prev) => prev.slice(1));
    setGraphNodes(next.nodes);
    setGraphEdges(next.edges);
  }

  async function generateDraft() {
    setError(null);
    setNotice(null);
    if (aiPrompt.trim().length < 10) {
      setError("Enter at least 10 characters so PRISM has enough context.");
      return;
    }
    setAiGenerating(true);
    const started = Date.now();
    try {
      const response = await fetch("/api/admin/opportunities/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.detail || "AI generation failed.");
      const draft = normalizeDraftRow(body.draft);
      setDraftOutput(draft);
      setOpportunity((prev) => ({
        ...prev,
        code: draft.opportunity.code || prev.code,
        title: draft.opportunity.title || prev.title,
        description: draft.opportunity.description || prev.description,
        term: draft.opportunity.term || draft.opportunity.program_type || prev.term,
        destination: draft.opportunity.destination || draft.opportunity.host_institution || prev.destination,
        deadline: draft.opportunity.deadline || prev.deadline,
        seats: Number(draft.opportunity.seats || prev.seats || 0),
      }));
      commitGraph(draft.graph.nodes, draft.graph.edges);
      setExpandedAISection(draft.clarifying_questions.length > 0 ? "questions" : "summary");
      setNotice(Date.now() - started > 5000 ? "Draft ready. PRISM took a little longer than usual." : "Draft ready for review.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate draft.");
    } finally {
      setAiGenerating(false);
    }
  }

  async function submitAnswers() {
    setAnswering(true);
    setNotice("Answers recorded in this draft.");
    setExpandedAISection("summary");
    setAnswering(false);
  }

  function validateForPublish() {
    setValidating(true);
    const warnings = validateGraph(graphNodes);
    setTimeout(() => {
      setPublishReady(warnings.length === 0 && !fallbackUsed && openQuestions.length === 0);
      setValidating(false);
      setNotice(warnings.length === 0 ? "Validation passed." : "Validation found issues on the graph.");
    }, 250);
    return warnings;
  }

  async function saveDraftOnly() {
    setSaving(true);
    setError(null);
    try {
      const body = await createManualDraft();
      if (!body?.draft?.publish_ready) {
        setNotice("Draft saved with validation warnings.");
      } else {
        setNotice("Draft saved and ready to publish.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save draft.");
    } finally {
      setSaving(false);
    }
  }

  async function publishWorkflow(force = false) {
    setError(null);
    if (activeImpact.length > 0 && !force) {
      setShowImpactModal(true);
      return;
    }
    const warnings = validateForPublish();
    if (warnings.length > 0 || fallbackUsed || openQuestions.length > 0) {
      setError(fallbackUsed ? "Fallback drafts must be edited and regenerated before publishing." : openQuestions.length > 0 ? "Answer all clarifying questions before publishing." : "Resolve validation warnings before publishing.");
      return;
    }
    setPublishing(true);
    try {
      const draftBody = await createManualDraft();
      if (!draftBody?.draft?.publish_ready) {
        throw new Error("Draft is not publish ready. Resolve validation errors and try again.");
      }
      const draftId = draftBody.draft_id;
      const publishResponse = await fetch(`/api/admin/workflow-drafts/${draftId}/publish`, { method: "POST" });
      const publishBody = await publishResponse.json();
      if (!publishResponse.ok) throw new Error(publishBody?.detail || "Unable to publish workflow.");
      const refreshed = await fetch(`/api/admin/workflow-drafts/${draftId}`).then((response) => response.json());
      const targetOpportunityId = refreshed?.draft?.opportunity_id || opportunityId;
      setSuccessOverlay(true);
      setTimeout(() => {
        router.push(targetOpportunityId ? `/admin/opportunities/${targetOpportunityId}` : "/admin/opportunities");
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to publish workflow.");
    } finally {
      setPublishing(false);
      setShowImpactModal(false);
    }
  }

  async function createManualDraft() {
    const response = await fetch("/api/admin/workflow-drafts/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        opportunityId: opportunityId ? Number(opportunityId) : undefined,
        opportunity: {
          code: opportunity.code || undefined,
          title: opportunity.title || "Untitled Opportunity",
          description: opportunity.description || "No description provided.",
          cover_image_url: opportunity.cover_image_url || undefined,
          term: opportunity.term || undefined,
          destination: opportunity.destination || undefined,
          deadline: opportunity.deadline || undefined,
          seats: Number(opportunity.seats || 0) || undefined,
          host_institution: opportunity.destination || undefined,
          program_type: opportunity.term || undefined,
          visibility: "plaksha_only",
        },
        graph: { nodes: graphNodes, edges: graphEdges },
        clarifyingQuestions: openQuestions,
        warnings: draftOutput?.warnings || [],
        confidence: draftOutput?.confidence ?? 0.78,
        isFallback: fallbackUsed,
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.detail || "Unable to save workflow draft.");
    return body;
  }

  return (
    <div className="relative -m-6 flex min-h-[calc(100vh-96px)] flex-col bg-white">
      <header className="border-b border-slate-200 bg-white">
        {activeImpact.length > 0 && mode === "edit" && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span>
              {activeImpact.length} application{activeImpact.length === 1 ? " is" : "s are"} currently in this workflow. Republishing may affect in-progress tasks.
            </span>
            <button type="button" onClick={() => setShowImpactModal(true)} className="font-semibold text-amber-900 underline">
              Review impact
            </button>
          </div>
        )}
        <div className="flex min-h-[64px] flex-wrap items-center gap-3 px-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="text-sm font-black text-slate-900">PRISM</span>
            <input
              className="min-w-[180px] flex-1 border-b border-transparent bg-transparent text-lg font-semibold text-slate-900 outline-none hover:border-slate-300 focus:border-primary"
              value={opportunity.title}
              onChange={(event) => setOpportunity({ ...opportunity, title: event.target.value })}
              placeholder="Untitled opportunity"
            />
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{mode === "create" ? "Draft" : opportunity.status}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{studioMode === "ai" ? "AI" : "Manual"}</span>
          </div>
          <button type="button" onClick={saveDraftOnly} disabled={saving} className="min-h-[40px] rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
            {saving ? "Saving..." : "Save Draft"}
          </button>
          <button type="button" onClick={validateForPublish} disabled={validating} className="min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {validating ? "Validating..." : publishReady ? "Validated" : "Validate"}
          </button>
          <button type="button" onClick={() => void publishWorkflow()} disabled={publishing} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white shadow-sm disabled:opacity-50">
            {publishing ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">publish</span>}
            Publish Workflow
          </button>
        </div>
        {(error || notice) && (
          <div className={`border-t px-4 py-2 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {error || notice}
          </div>
        )}
      </header>

      {studioMode === "ai" && !draftOutput && mode === "create" && (
        <div className="border-b border-slate-200 bg-white px-4 py-4">
          <div className="mx-auto max-w-4xl">
            <textarea
              rows={3}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-primary"
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="Paste the messy OGA email or policy note. PRISM will extract the opportunity and approval workflow."
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">{aiGenerating ? "Analyzing opportunity..." : "Start with AI, then tune the graph directly."}</p>
              <button type="button" onClick={generateDraft} disabled={aiGenerating} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white disabled:opacity-50">
                {aiGenerating && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                Generate Workflow
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden flex-1 lg:grid lg:grid-cols-[220px_1fr_280px]">
        <LeftRail
          studioMode={studioMode}
          setStudioMode={setStudioMode}
          opportunity={opportunity}
          setOpportunity={setOpportunity}
          selectedFields={selectedFields}
          setSelectedFields={setSelectedFields}
          selectableFields={selectableFields}
          customFields={customFields}
          setCustomFields={setCustomFields}
          visibilityRules={visibilityRules}
          setVisibilityRules={setVisibilityRules}
          validationWarnings={validationWarnings}
          openQuestions={openQuestions.length}
          publishReady={publishReady}
        />
        <main className="flex min-w-0 flex-col">
          <AIReviewPanel
            draft={draftOutput}
            answers={answers}
            mode={studioMode}
            expandedSection={expandedAISection}
            answering={answering}
            onExpand={setExpandedAISection}
            onAnswerChange={(question, answer) => setAnswers((prev) => ({ ...prev, [question]: answer }))}
            onSubmitAnswers={submitAnswers}
          />
          <StudioGraph
            nodes={graphNodes}
            edges={graphEdges}
            selectedNodeKey={selectedNodeKey}
            selectedEdgeKey={selectedEdgeKey}
            validationWarnings={validationWarnings}
            onSelectNode={setSelectedNodeKey}
            onSelectEdge={setSelectedEdgeKey}
            onAddReviewer={addReviewer}
            onAddParallel={addParallelGroup}
            onAddCondition={addCondition}
            onUndo={undo}
            onRedo={redo}
          />
        </main>
        <StudioInspector
          node={selectedNode}
          edge={selectedEdge}
          availableFields={selectableFields}
          validationWarnings={validationWarnings}
          onClose={() => {
            setSelectedNodeKey(null);
            setSelectedEdgeKey(null);
          }}
          onUpdateNode={updateNode}
          onUpdateEdge={updateEdge}
          onRemoveNode={removeNode}
        />
      </div>

      <div className="flex flex-1 flex-col lg:hidden">
        {mobileTab === "details" && (
          <LeftRail
            studioMode={studioMode}
            setStudioMode={setStudioMode}
            opportunity={opportunity}
            setOpportunity={setOpportunity}
            selectedFields={selectedFields}
            setSelectedFields={setSelectedFields}
            selectableFields={selectableFields}
            customFields={customFields}
            setCustomFields={setCustomFields}
            visibilityRules={visibilityRules}
            setVisibilityRules={setVisibilityRules}
            validationWarnings={validationWarnings}
            openQuestions={openQuestions.length}
            publishReady={publishReady}
            mobile
          />
        )}
        {mobileTab === "graph" && (
          <StudioGraph
            mobile
            nodes={graphNodes}
            edges={graphEdges}
            selectedNodeKey={selectedNodeKey}
            selectedEdgeKey={selectedEdgeKey}
            validationWarnings={validationWarnings}
            onSelectNode={(key) => {
              setSelectedNodeKey(key);
              if (key) setMobileTab("inspector");
            }}
            onSelectEdge={setSelectedEdgeKey}
            onAddReviewer={addReviewer}
            onAddParallel={addParallelGroup}
            onAddCondition={addCondition}
            onUndo={undo}
            onRedo={redo}
          />
        )}
        {mobileTab === "inspector" && (
          <StudioInspector
            node={selectedNode}
            edge={selectedEdge}
            availableFields={selectableFields}
            validationWarnings={validationWarnings}
            onClose={() => setMobileTab("graph")}
            onUpdateNode={updateNode}
            onUpdateEdge={updateEdge}
            onRemoveNode={removeNode}
          />
        )}
        <nav className="mt-auto grid grid-cols-3 border-t border-slate-200 bg-white">
          {(["details", "graph", "inspector"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMobileTab(tab)}
              className={`min-h-[56px] text-sm font-semibold capitalize ${mobileTab === tab ? "text-primary-dark" : "text-slate-500"}`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {showImpactModal && (
        <ImpactModal
          applications={activeImpact}
          onCancel={() => setShowImpactModal(false)}
          onConfirm={() => void publishWorkflow(true)}
          publishing={publishing}
        />
      )}

      {successOverlay && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="rounded-xl border border-emerald-200 bg-white px-8 py-6 text-center shadow-lg">
            <span className="material-symbols-outlined text-4xl text-emerald-600">check_circle</span>
            <p className="mt-3 text-lg font-semibold text-slate-900">Workflow Published</p>
            <p className="text-sm text-slate-500">Version is now active. Redirecting to opportunity...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function LeftRail({
  studioMode,
  setStudioMode,
  opportunity,
  setOpportunity,
  selectedFields,
  setSelectedFields,
  selectableFields,
  customFields,
  setCustomFields,
  visibilityRules,
  setVisibilityRules,
  validationWarnings,
  openQuestions,
  publishReady,
  mobile = false,
}: {
  studioMode: "ai" | "manual";
  setStudioMode: (mode: "ai" | "manual") => void;
  opportunity: OpportunityData;
  setOpportunity: (value: OpportunityData) => void;
  selectedFields: string[];
  setSelectedFields: React.Dispatch<React.SetStateAction<string[]>>;
  selectableFields: CatalogField[];
  customFields: CustomFieldDraft[];
  setCustomFields: React.Dispatch<React.SetStateAction<CustomFieldDraft[]>>;
  visibilityRules: GeneratorVisibilityRule[];
  setVisibilityRules: React.Dispatch<React.SetStateAction<GeneratorVisibilityRule[]>>;
  validationWarnings: string[];
  openQuestions: number;
  publishReady: boolean;
  mobile?: boolean;
}) {
  return (
    <aside className={`${mobile ? "" : "border-r"} overflow-y-auto border-slate-200 bg-white p-4`}>
      <div className="mb-5 flex rounded-lg bg-slate-100 p-1">
        {(["ai", "manual"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setStudioMode(mode)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${studioMode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            {mode === "ai" ? "AI Generated" : "Manual"}
          </button>
        ))}
      </div>

      <RailSection title="Metadata">
        <CompactInput label="Code" value={opportunity.code} onChange={(value) => setOpportunity({ ...opportunity, code: value })} />
        <CompactInput label="Destination" value={opportunity.destination} onChange={(value) => setOpportunity({ ...opportunity, destination: value })} />
        <CompactInput label="Term" value={opportunity.term} onChange={(value) => setOpportunity({ ...opportunity, term: value })} />
        <CompactInput label="Deadline" type="date" value={opportunity.deadline} onChange={(value) => setOpportunity({ ...opportunity, deadline: value })} />
        <CompactInput label="Seats" type="number" value={String(opportunity.seats || "")} onChange={(value) => setOpportunity({ ...opportunity, seats: Number(value) || 0 })} />
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Description</span>
          <textarea
            rows={3}
            className="w-full rounded-lg border border-slate-200 p-2 text-sm"
            value={opportunity.description}
            onChange={(event) => setOpportunity({ ...opportunity, description: event.target.value })}
          />
        </label>
      </RailSection>

      <RailSection title="Fields">
        <div className="flex flex-wrap gap-2">
          {selectableFields.slice(0, 12).map((field) => {
            const checked = selectedFields.includes(field.field_key);
            return (
              <button
                key={field.field_key}
                type="button"
                onClick={() => setSelectedFields((prev) => (checked ? prev.filter((key) => key !== field.field_key) : [...prev, field.field_key]))}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  checked ? "border-primary bg-primary text-white" : "border-slate-300 bg-white text-slate-600"
                }`}
              >
                {field.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            const fieldKey = `custom_${Date.now()}`;
            setCustomFields([...customFields, { field_key: fieldKey, label: "Custom Field", description: "", fieldHint: "", inputType: "text", optionsText: "" }]);
            setSelectedFields((prev) => [...prev, fieldKey]);
          }}
          className="mt-3 text-xs font-semibold text-primary-dark"
        >
          + Add Field
        </button>
      </RailSection>

      <RailSection title="Eligibility">
        {visibilityRules.map((rule, index) => (
          <div key={`${rule.ruleType}-${index}`} className="mb-2 grid grid-cols-[84px_1fr] gap-2">
            <select
              className="rounded-lg border border-slate-200 bg-white p-2 text-xs"
              value={rule.ruleType}
              onChange={(event) =>
                setVisibilityRules((prev) => prev.map((item, ruleIndex) => (ruleIndex === index ? { ...item, ruleType: event.target.value as GeneratorVisibilityRule["ruleType"] } : item)))
              }
            >
              <option value="GROUP_EMAIL">Group</option>
              <option value="EMAIL">Email</option>
            </select>
            <input
              className="rounded-lg border border-slate-200 p-2 text-xs"
              value={rule.ruleValue}
              onChange={(event) => setVisibilityRules((prev) => prev.map((item, ruleIndex) => (ruleIndex === index ? { ...item, ruleValue: event.target.value } : item)))}
              placeholder="ug2024@plaksha.edu.in"
            />
          </div>
        ))}
        <button type="button" onClick={() => setVisibilityRules([...visibilityRules, { ruleType: "EMAIL", ruleValue: "" }])} className="text-xs font-semibold text-primary-dark">
          + Add Rule
        </button>
      </RailSection>

      <RailSection title="Warnings">
        {validationWarnings.length === 0 ? <p className="text-sm text-slate-400">None</p> : validationWarnings.map((warning) => <p key={warning} className="mb-1 text-sm text-red-700">{warning}</p>)}
      </RailSection>

      <RailSection title="Checklist">
        <ChecklistRow done={publishReady} label="Validated" />
        <ChecklistRow done={openQuestions === 0} label={openQuestions === 0 ? "No questions" : `${openQuestions} open questions`} />
        <ChecklistRow done={validationWarnings.length === 0} label={validationWarnings.length === 0 ? "No warnings" : "Warnings remain"} />
      </RailSection>
    </aside>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function CompactInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <input type={type} className="w-full rounded-lg border border-slate-200 p-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ChecklistRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`material-symbols-outlined text-[18px] ${done ? "text-emerald-600" : "text-slate-300"}`}>{done ? "check_circle" : "radio_button_unchecked"}</span>
      <span className={done ? "text-slate-700" : "text-slate-400"}>{label}</span>
    </div>
  );
}

function ImpactModal({
  applications,
  publishing,
  onCancel,
  onConfirm,
}: {
  applications: ImpactApplication[];
  publishing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Review workflow impact</h2>
          <p className="mt-1 text-sm text-amber-900">Republishing may invalidate in-progress tasks. Confirm only after checking affected applications.</p>
        </div>
        <div className="max-h-[360px] overflow-y-auto p-5">
          <div className="space-y-2">
            {applications.slice(0, 12).map((application) => (
              <div key={application.id} className="grid grid-cols-[1fr_auto] gap-4 rounded-lg border border-slate-200 p-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-800">{application.student_user?.full_name || `Application #${application.id}`}</p>
                  <p className="text-slate-500">{application.student_user?.email || "No email"} - current node: {application.current_stage_label || application.current_stage || "In progress"}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Review task impact</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
            Continue editing
          </button>
          <button type="button" onClick={onConfirm} disabled={publishing} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {publishing ? "Publishing..." : "Confirm and publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function validateGraph(nodes: StudioGraphNode[]) {
  const warnings: string[] = [];
  if (nodes.length === 0) warnings.push("Add at least one reviewer node.");
  if (nodes.filter((node) => node.node_type === "start").length !== 1) warnings.push("Graph needs exactly one start node.");
  if (nodes.filter((node) => node.node_type === "end").length < 1) warnings.push("Graph needs at least one end node.");
  for (const node of nodes.filter((item) => item.node_type === "reviewer")) {
    if (!node.reviewer_email || !validPlakshaEmail(node.reviewer_email)) {
      warnings.push(`${node.display_name || node.node_key} needs a @plaksha.edu.in reviewer email.`);
    }
    if (!Number(node.metadata?.sla_hours || 0)) {
      warnings.push(`${node.display_name || node.node_key} needs an SLA.`);
    }
  }
  return warnings;
}

function dedupeEdges(edges: StudioGraphEdge[]) {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = `${edge.from_node_key}->${edge.to_node_key}`;
    if (seen.has(key) || edge.from_node_key === edge.to_node_key) return false;
    seen.add(key);
    return true;
  });
}

function normalizeDraftRow(row: any): DraftOutput {
  const parsed = parseJson<DraftOutput>(row?.draft_output, {
    opportunity: { title: "Generated Opportunity", description: "" },
    graph: { nodes: [], edges: [] },
    clarifying_questions: [],
    confidence: Number(row?.confidence || 0),
    warnings: [],
    is_fallback: false,
  });
  return {
    ...parsed,
    clarifying_questions: parseJson<string[]>(row?.clarifying_questions, parsed.clarifying_questions || []),
    warnings: parseJson<string[]>(row?.warnings, parsed.warnings || []),
    confidence: Number(row?.confidence ?? parsed.confidence ?? 0),
  };
}
