"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StudioGraph from "./StudioGraph";
import StudioInspector from "./StudioInspector";
import type {
  CatalogField,
  CustomFieldDraft,
  DraftOutput,
  GeneratorVisibilityRule,
  ImpactApplication,
  OpportunityData,
  OpportunityDetailField,
  StudioEdgeAction,
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
  initialDetailFields: OpportunityDetailField[];
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
  ai_summary_bullets: [],
};

function summarySourceText(opportunity: OpportunityData, detailFields: OpportunityDetailField[]) {
  return JSON.stringify({
    title: opportunity.title,
    description: opportunity.description,
    details: detailFields.map((field) => ({ label: field.label, value: field.value, visible: field.is_student_visible })),
  });
}

function generateSummaryBullets(opportunity: OpportunityData, detailFields: OpportunityDetailField[]) {
  const deadline = detailFields.find((field) => /deadline/i.test(`${field.field_key} ${field.label}`))?.value;
  const destination = detailFields.find((field) => /destination|host/i.test(`${field.field_key} ${field.label}`))?.value;
  const term = detailFields.find((field) => /term|semester|cycle/i.test(`${field.field_key} ${field.label}`))?.value;
  const seats = detailFields.find((field) => /seat|capacity/i.test(`${field.field_key} ${field.label}`))?.value;
  const bullets = [
    destination ? `${opportunity.title || "This opportunity"} is linked to ${destination}.` : "",
    deadline ? `Applications are due by ${deadline}.` : "",
    term ? `Program term: ${term}.` : "",
    seats ? `${seats} seat${Number(seats) === 1 ? "" : "s"} available.` : "",
    detailFields.find((field) => /funding|scholarship/i.test(field.label))?.value
      ? `Funding: ${detailFields.find((field) => /funding|scholarship/i.test(field.label))?.value}.`
      : "",
  ].filter(Boolean);
  if (bullets.length > 0) return bullets.slice(0, 5);
  return opportunity.description
    .split(/[.\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function detailFieldFromDraft(key: string, label: string, value: unknown, valueType: OpportunityDetailField["value_type"] = "text"): OpportunityDetailField | null {
  if (value === null || value === undefined || value === "") return null;
  return {
    field_key: key,
    label,
    value: String(value),
    value_type: valueType,
    display_order: 0,
    is_student_visible: true,
  };
}

function mergeDetailFields(current: OpportunityDetailField[], incoming: OpportunityDetailField[]) {
  const byKey = new Map(current.map((field) => [field.field_key, field]));
  incoming.forEach((field) => {
    byKey.set(field.field_key, { ...field, display_order: byKey.size + 1 });
  });
  return Array.from(byKey.values()).map((field, index) => ({ ...field, display_order: index + 1 }));
}

type StudioStep = "details" | "form" | "pipeline";

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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
    allowed_actions: ["approve", "reject", "request_changes", "comment"],
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

function rejectedEndNode(): StudioGraphNode {
  return {
    node_key: nodeKey("rejected_end"),
    node_type: "end",
    display_name: "Rejected End",
    reviewer_email: null,
    visible_sections: ["all"],
    allowed_actions: [],
    metadata: { required_inputs: [], final_status: "REJECTED" },
  };
}

function conditionNode(label = "If / Else"): StudioGraphNode {
  return {
    node_key: nodeKey("condition"),
    node_type: "conditional",
    display_name: label,
    reviewer_email: null,
    visible_sections: ["all"],
    allowed_actions: [],
    metadata: { required_inputs: [] },
  };
}

function joinNode(label = "Join / Merge"): StudioGraphNode {
  return {
    node_key: nodeKey("join"),
    node_type: "join_all",
    display_name: label,
    reviewer_email: null,
    visible_sections: ["all"],
    allowed_actions: [],
    metadata: { required_inputs: [] },
  };
}

function defaultRouteAction(source?: StudioGraphNode | null): StudioEdgeAction {
  if (!source || source.node_type === "start" || source.node_type === "conditional" || source.node_type === "join_all" || source.node_type === "join_any") {
    return "always";
  }
  return "approve";
}

function workflowStepsToGraph(steps: WorkflowStep[]): { nodes: StudioGraphNode[]; edges: StudioGraphEdge[] } {
  if (steps.length === 0) return { nodes: [], edges: [] };
  const reviewers = steps.map((step, index) => ({
    node_key: `review_${index + 1}_${slugify(step.name)}`,
    node_type: "reviewer" as const,
    display_name: step.reviewerName || step.name,
    reviewer_email: step.reviewerEmail,
    visible_sections: step.visibleFields.length > 0 ? step.visibleFields : ["all"],
    allowed_actions: ["approve", "reject", "request_changes", "comment"],
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
    action: node.node_type === "reviewer" ? "approve" as const : "always" as const,
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
  initialDetailFields,
  initialSelectedFields,
  initialCustomFields,
  initialGeneratorVisibilityRules,
  initialGraphNodes,
  initialGraphEdges,
  activeApplications,
}: OpportunityStudioProps) {
  const router = useRouter();
  const [studioStep, setStudioStep] = useState<StudioStep>(mode === "create" ? "details" : "pipeline");
  const [mobileTab, setMobileTab] = useState<"details" | "graph" | "inspector">("graph");
  const [opportunity, setOpportunity] = useState<OpportunityData>(initialOpportunity || blankOpportunity);
  const [detailFields, setDetailFields] = useState<OpportunityDetailField[]>(initialDetailFields);
  const [summarySourceSnapshot, setSummarySourceSnapshot] = useState(() => summarySourceText(initialOpportunity || blankOpportunity, initialDetailFields));
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
  const [connectSourceKey, setConnectSourceKey] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null);
  const [draftOutput, setDraftOutput] = useState<DraftOutput | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
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
  const selectedApplicationFields = useMemo(
    () => selectableFields.filter((field) => selectedFields.includes(field.field_key)),
    [selectableFields, selectedFields]
  );

  const selectedNode = graphNodes.find((node) => node.node_key === selectedNodeKey) || null;
  const selectedEdge = selectedEdgeKey
    ? graphEdges.find((edge) => `${edge.from_node_key}->${edge.to_node_key}` === selectedEdgeKey) || null
    : null;
  const openQuestions = (draftOutput?.clarifying_questions || []).filter((question) => !answers[question]?.trim());
  const validationWarnings = validateGraph(graphNodes, graphEdges);
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
    setConnectSourceKey(null);
  }

  function addReviewer() {
    const reviewer = defaultReviewerNode("New Reviewer");
    if (graphNodes.length === 0) {
      commitGraph([startNode(), reviewer, endNode()], [
        { from_node_key: "start", to_node_key: reviewer.node_key, action: "always" },
        { from_node_key: reviewer.node_key, to_node_key: "end", action: "approve" },
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
      { from_node_key: source, to_node_key: reviewer.node_key, action: source === "start" ? "always" as const : "approve" as const },
      ...(outgoing.length > 0 ? outgoing.map((edge) => ({ ...edge, from_node_key: reviewer.node_key })) : [{ from_node_key: reviewer.node_key, to_node_key: "end", action: "approve" as const }]),
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
      ...parentKeys.map((parent) => ({ from_node_key: parent, to_node_key: parallel.node_key, action: parent === "start" ? "always" as const : "approve" as const })),
      { from_node_key: selected.node_key, to_node_key: merge.node_key, action: "approve" as const },
      { from_node_key: parallel.node_key, to_node_key: merge.node_key, action: "approve" as const },
      ...targetKeys.map((target) => ({ from_node_key: merge.node_key, to_node_key: target, action: "always" as const })),
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
          ? { ...edge, action: edge.action?.startsWith("condition") ? edge.action : "condition_true", condition_json: edge.condition_json || { field: "", op: "equals", value: "" }, label: edge.label || "Condition" }
          : edge
      )
    );
    setMobileTab("inspector");
  }

  function addConditionalBranch() {
    const defaultCondition = {
      field: selectedApplicationFields[0]?.field_key || "",
      op: selectedApplicationFields[0]?.input_type === "number" ? "gt" : "equals",
      value: selectedApplicationFields[0]?.input_type === "number" ? 200000 : "",
    };
    const gate = conditionNode("If / Else");
    const conditionalReviewer = defaultReviewerNode("Conditional Review");
    let fromKey: string | null = null;
    let toKey: string | null = null;
    let incomingAction: StudioEdgeAction | null | undefined = null;

    if (selectedEdgeKey) {
      const [selectedFrom, selectedTo] = selectedEdgeKey.split("->");
      const selectedRoute = graphEdges.find((edge) => edge.from_node_key === selectedFrom && edge.to_node_key === selectedTo);
      fromKey = selectedFrom;
      toKey = selectedTo;
      incomingAction = selectedRoute?.action;
    } else if (selectedNodeKey) {
      const selectedNode = graphNodes.find((node) => node.node_key === selectedNodeKey);
      if (!selectedNode || selectedNode.node_type === "end") {
        setError("Select a route or a non-terminal node before adding a conditional branch.");
        return;
      }
      fromKey = selectedNode.node_key;
      toKey = graphEdges.find((edge) => edge.from_node_key === selectedNode.node_key)?.to_node_key || graphNodes.find((node) => node.node_type === "end")?.node_key || "end";
    }

    if (!fromKey || !toKey) {
      setError("Select an existing route or node before adding a conditional branch.");
      return;
    }

    const fromNode = graphNodes.find((node) => node.node_key === fromKey);
    const hasTargetEnd = graphNodes.some((node) => node.node_key === toKey);
    const targetEnd = hasTargetEnd ? [] : [endNode()];
    const withoutSelectedRoute = graphEdges.filter((edge) => !(edge.from_node_key === fromKey && edge.to_node_key === toKey));
    const nextEdges: StudioGraphEdge[] = [
      ...withoutSelectedRoute,
      { from_node_key: fromKey, to_node_key: gate.node_key, action: incomingAction || defaultRouteAction(fromNode), label: "Evaluate condition" },
      { from_node_key: gate.node_key, to_node_key: conditionalReviewer.node_key, action: "condition_true", condition_json: defaultCondition, label: "If true" },
      { from_node_key: gate.node_key, to_node_key: toKey, action: "condition_false", condition_json: defaultCondition, label: "If false" },
      { from_node_key: conditionalReviewer.node_key, to_node_key: toKey, action: "approve", label: "Approve and continue" },
    ];

    commitGraph([...graphNodes, ...targetEnd, gate, conditionalReviewer], dedupeEdges(nextEdges));
    setSelectedEdgeKey(`${gate.node_key}->${conditionalReviewer.node_key}`);
    setSelectedNodeKey(null);
    setNotice("Conditional branch added. Configure the field rule and reviewer in the inspector.");
    setMobileTab("inspector");
  }

  function addJoin() {
    const selected = graphNodes.find((node) => node.node_key === selectedNodeKey);
    if (!selected || selected.node_type === "end") {
      setError("Select a non-terminal graph node before adding a join.");
      return;
    }
    const join = joinNode();
    const outgoing = graphEdges.filter((edge) => edge.from_node_key === selected.node_key);
    const targetKeys = outgoing.length > 0 ? outgoing.map((edge) => edge.to_node_key) : [graphNodes.find((node) => node.node_type === "end")?.node_key || "end"];
    const targetEnd = graphNodes.some((node) => node.node_key === "end") ? [] : [endNode()];
    const remaining = graphEdges.filter((edge) => edge.from_node_key !== selected.node_key);
    const nextEdges: StudioGraphEdge[] = [
      ...remaining,
      { from_node_key: selected.node_key, to_node_key: join.node_key, action: defaultRouteAction(selected), label: "Join after approval" },
      ...targetKeys.map((target) => ({ from_node_key: join.node_key, to_node_key: target, action: "always" as const, label: "Continue after merge" })),
    ];
    commitGraph([...graphNodes, ...targetEnd, join], dedupeEdges(nextEdges));
    setSelectedNodeKey(join.node_key);
    setSelectedEdgeKey(null);
    setNotice("Join / merge node added. Use Connect to route other branches into it.");
  }

  function addRejectRoute() {
    const selected = graphNodes.find((node) => node.node_key === selectedNodeKey);
    if (!selected || selected.node_type !== "reviewer") {
      setError("Select a reviewer node before adding a reject route.");
      return;
    }
    const existingRejectEnd = graphNodes.find((node) => node.node_type === "end" && node.metadata?.final_status === "REJECTED");
    const rejectEnd = existingRejectEnd || rejectedEndNode();
    const nextNodes = existingRejectEnd ? graphNodes : [...graphNodes, rejectEnd];
    const nextEdges = dedupeEdges([
      ...graphEdges,
      { from_node_key: selected.node_key, to_node_key: rejectEnd.node_key, action: "reject", label: "Deny / reject" },
    ]);
    commitGraph(nextNodes, nextEdges);
    setSelectedEdgeKey(`${selected.node_key}->${rejectEnd.node_key}`);
    setSelectedNodeKey(null);
    setNotice("Reject route added. A denied application will close on the rejected path.");
  }

  function startConnectMode() {
    const connectableCount = graphNodes.filter((node) => node.node_type !== "end").length;
    if (connectableCount < 1 || graphNodes.length < 2) {
      setError("Add at least two graph nodes before creating a connection.");
      return;
    }
    setError(null);
    setSelectedEdgeKey(null);
    setConnectSourceKey((prev) => {
      if (prev) {
        setNotice("Connect mode cleared.");
        return null;
      }
      setNotice("Connect mode started. Select the source node, then the destination node.");
      return "__pending__";
    });
  }

  function handleNodeSelection(nodeKey: string | null) {
    if (!nodeKey) {
      setSelectedNodeKey(null);
      if (connectSourceKey && connectSourceKey !== "__pending__") {
        setNotice("Connect mode cancelled.");
        setConnectSourceKey(null);
      }
      return;
    }

    const node = graphNodes.find((item) => item.node_key === nodeKey) || null;
    setSelectedNodeKey(nodeKey);
    setSelectedEdgeKey(null);

    if (!connectSourceKey) return;

    if (connectSourceKey === "__pending__") {
      if (!node || node.node_type === "end") {
        setError("The first connection point must be a non-terminal source node.");
        return;
      }
      setConnectSourceKey(nodeKey);
      setNotice(`Connect mode: selected ${node.display_name || node.node_key}. Now choose a different destination node.`);
      return;
    }

    if (connectSourceKey === nodeKey) {
      setError("Select a different reviewer to complete the connection.");
      return;
    }
    if (!node) {
      setError("Select a valid destination node.");
      setConnectSourceKey(null);
      return;
    }

    const edgeExists = graphEdges.some((edge) => edge.from_node_key === connectSourceKey && edge.to_node_key === nodeKey);
    if (edgeExists) {
      setError("These graph nodes are already connected.");
      setConnectSourceKey(null);
      return;
    }

    if (node.node_type === "start") {
      setError("A route cannot point back into Start.");
      setConnectSourceKey(null);
      return;
    }

    const source = graphNodes.find((item) => item.node_key === connectSourceKey);
    commitGraph(graphNodes, dedupeEdges([...graphEdges, { from_node_key: connectSourceKey, to_node_key: nodeKey, action: defaultRouteAction(source) }]));
    setSelectedEdgeKey(`${connectSourceKey}->${nodeKey}`);
    setNotice("Reviewer connection added.");
  }

  function moveNode(nodeKeyToMove: string, position: { x: number; y: number }) {
    pushHistory();
    setGraphNodes((prev) =>
      prev.map((node) =>
        node.node_key === nodeKeyToMove
          ? {
              ...node,
              metadata: {
                ...node.metadata,
                canvas_position: {
                  x: Math.round(position.x),
                  y: Math.round(position.y),
                },
              },
            }
          : node
      )
    );
  }

  function resetGraphLayout() {
    pushHistory();
    setGraphNodes((prev) =>
      prev.map((node) => {
        const nextMetadata = { ...node.metadata };
        delete nextMetadata.canvas_position;
        return { ...node, metadata: nextMetadata };
      })
    );
    setNotice("Graph returned to auto layout.");
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
    const bridged = incoming.flatMap((inEdge) => outgoing.map((outEdge) => ({ from_node_key: inEdge.from_node_key, to_node_key: outEdge.to_node_key, action: inEdge.action || outEdge.action || "always" })));
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

  function buildDraftPayload() {
    return {
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
        detail_fields: detailFields.map((field, index) => ({
          field_key: field.field_key || `detail_${index + 1}`,
          label: field.label,
          value: field.value,
          value_type: field.value_type || "text",
          display_order: index + 1,
          is_student_visible: field.is_student_visible,
        })),
        ai_summary_bullets: opportunity.ai_summary_bullets || [],
        visibility: "plaksha_only",
      },
      graph: { nodes: graphNodes, edges: graphEdges },
      clarifyingQuestions: openQuestions,
      warnings: draftOutput?.warnings || [],
      confidence: draftOutput?.confidence ?? 0.78,
      isFallback: fallbackUsed,
    };
  }

  function applyDraftData(draftData: DraftOutput) {
    setDraftOutput(draftData);
    const draftDetails = [
      ...(draftData.opportunity.detail_fields || []),
      detailFieldFromDraft("destination", "Destination", draftData.opportunity.destination || draftData.opportunity.host_institution),
      detailFieldFromDraft("term", "Term", draftData.opportunity.term || draftData.opportunity.program_type),
      detailFieldFromDraft("application_deadline", "Application Deadline", draftData.opportunity.deadline, "date"),
      detailFieldFromDraft("seats", "Seats", draftData.opportunity.seats, "number"),
    ].filter(Boolean) as OpportunityDetailField[];
    setOpportunity((prev) => ({
      ...prev,
      code: draftData.opportunity.code || prev.code,
      title: draftData.opportunity.title || prev.title,
      description: draftData.opportunity.description || prev.description,
      ai_summary_bullets: draftData.opportunity.ai_summary_bullets?.length ? draftData.opportunity.ai_summary_bullets : prev.ai_summary_bullets,
    }));
    if (draftDetails.length > 0) {
      setDetailFields((prev) => mergeDetailFields(prev, draftDetails));
    }
    commitGraph(draftData.graph.nodes, draftData.graph.edges);
    if (draftData.applicant_form_fields?.length) {
      const available = new Set(selectableFields.map((f) => f.field_key));
      const aiFields = draftData.applicant_form_fields.filter((key) => available.has(key));
      if (aiFields.length > 0) setSelectedFields(aiFields);
    }
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
      const draftData = normalizeDraftRow(body.draft);
      setCurrentDraftId(Number(body.draft_id || body.draft?.id || 0) || null);
      setAnswers({});
      applyDraftData(draftData);
      const shouldAdvanceToPipeline = draftData.clarifying_questions.length === 0 && draftData.confidence >= 0.8;
      if (shouldAdvanceToPipeline) setStudioStep("pipeline");
      setNotice(
        shouldAdvanceToPipeline
          ? "PRISM filled the draft and moved you to the pipeline."
          : Date.now() - started > 5000
            ? "PRISM filled a draft. It took a little longer than usual."
            : "PRISM filled the draft. Review details, then continue to the pipeline."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate draft.");
    } finally {
      setAiGenerating(false);
    }
  }

  async function submitAnswers() {
    if (!currentDraftId) {
      setError("Generate a draft first before submitting clarification answers.");
      return;
    }
    setAnswering(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/workflow-drafts/${currentDraftId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.detail || "Unable to regenerate workflow draft.");
      if (body?.draft) {
        const draftData = normalizeDraftRow(body.draft);
        // Prefer fields returned directly by the endpoint (already applied to DB)
        // over the ones embedded in draft_output, but both point to the same list.
        if (body.applicant_form_fields?.length) {
          draftData.applicant_form_fields = body.applicant_form_fields;
        }
        setCurrentDraftId(Number(body.draft_id || body.draft?.id || currentDraftId) || currentDraftId);
        setAnswers({});
        applyDraftData(draftData);
        if (draftData.clarifying_questions.length === 0) setStudioStep("pipeline");
      }
      setNotice(
        body?.fields_applied
          ? "PRISM regenerated the draft and applied the application fields."
          : "PRISM regenerated the draft with your answers."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to regenerate workflow draft.");
    } finally {
      setAnswering(false);
    }
  }

  async function validateForPublish() {
    setValidating(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/workflow-drafts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDraftPayload()),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.detail || "Unable to validate workflow draft.");
      const warnings = Array.isArray(body?.warnings) ? body.warnings.map(String) : validateGraph(graphNodes, graphEdges);
      setPublishReady(Boolean(body?.publish_ready));
      setNotice(warnings.length === 0 ? "Validation passed." : "Validation found issues on the graph.");
      return warnings;
    } catch (err) {
      const warnings = validateGraph(graphNodes, graphEdges);
      setPublishReady(warnings.length === 0 && !fallbackUsed && openQuestions.length === 0);
      setError(err instanceof Error ? err.message : "Unable to validate workflow draft.");
      return warnings;
    } finally {
      setValidating(false);
    }
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
    const warnings = await validateForPublish();
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
      if (targetOpportunityId) {
        await persistOpportunityConfiguration(targetOpportunityId);
      }
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
      body: JSON.stringify(buildDraftPayload()),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.detail || "Unable to save workflow draft.");
    setCurrentDraftId(Number(body?.draft_id || body?.draft?.id || 0) || null);
    if (body?.draft) {
      setDraftOutput(normalizeDraftRow(body.draft));
    }
    return body;
  }

  async function persistOpportunityConfiguration(opportunityIdToSave: string | number) {
    const response = await fetch(`/api/admin/opportunities/${opportunityIdToSave}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formFields: selectedFields,
        customFields: customFields.map((field) => ({
          key: field.field_key,
          label: field.label,
          description: field.description,
          fieldHint: field.fieldHint,
          inputType: field.inputType,
          options: field.optionsText.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean),
          persistForFuture: field.persistForFuture !== false,
        })),
        generatorVisibilityRules: visibilityRules,
        detailFields: detailFields.map((field, index) => ({
          key: field.field_key,
          label: field.label,
          value: field.value,
          valueType: field.value_type,
          displayOrder: index + 1,
          isStudentVisible: field.is_student_visible,
        })),
        aiSummaryBullets: opportunity.ai_summary_bullets || [],
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.detail || "Unable to persist opportunity configuration.");
    return body;
  }

  return (
    <div className="relative -m-6 flex h-[calc(100vh-96px)] flex-col overflow-hidden bg-white">
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
            {studioStep === "details" ? (
              <p className="min-w-[180px] flex-1 truncate text-lg font-semibold text-slate-900">{opportunity.title || "New opportunity"}</p>
            ) : (
              <input
                className="min-w-[180px] flex-1 border-b border-transparent bg-transparent text-lg font-semibold text-slate-900 outline-none hover:border-slate-300 focus:border-primary"
                value={opportunity.title}
                onChange={(event) => setOpportunity({ ...opportunity, title: event.target.value })}
                placeholder="Untitled opportunity"
              />
            )}
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{mode === "create" ? "Draft" : opportunity.status}</span>
            <div className="hidden items-center gap-1 rounded-lg bg-slate-100 p-1 md:flex">
              <button
                type="button"
                onClick={() => setStudioStep("details")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${studioStep === "details" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                1 Details
              </button>
              <button
                type="button"
                onClick={() => setStudioStep("form")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${studioStep === "form" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                2 Application Form
              </button>
              <button
                type="button"
                onClick={() => setStudioStep("pipeline")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${studioStep === "pipeline" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                3 Pipeline
              </button>
            </div>
          </div>
          <button type="button" onClick={saveDraftOnly} disabled={saving} className="min-h-[40px] rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
            {saving ? "Saving..." : "Save Draft"}
          </button>
          {studioStep === "pipeline" ? (
            <>
              <button type="button" onClick={() => void validateForPublish()} disabled={validating} className="min-h-[40px] rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {validating ? "Validating..." : publishReady ? "Validated" : "Validate"}
              </button>
              <button type="button" onClick={() => void publishWorkflow()} disabled={publishing} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white shadow-sm disabled:opacity-50">
                {publishing ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">publish</span>}
                Publish Workflow
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setStudioStep(studioStep === "details" ? "form" : "pipeline")} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white shadow-sm">
              {studioStep === "details" ? "Application Form" : "Build Pipeline"}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          )}
        </div>
        {(error || notice) && (
          <div className={`border-t px-4 py-2 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {error || notice}
          </div>
        )}
      </header>

      {studioStep === "details" ? (
        <SetupScreen
          opportunity={opportunity}
          setOpportunity={setOpportunity}
          detailFields={detailFields}
          setDetailFields={setDetailFields}
          summaryIsStale={(opportunity.ai_summary_bullets || []).length > 0 && summarySourceSnapshot !== summarySourceText(opportunity, detailFields)}
          onGenerateSummary={() => {
            const next = generateSummaryBullets(opportunity, detailFields);
            setOpportunity((prev) => ({ ...prev, ai_summary_bullets: next }));
            setSummarySourceSnapshot(summarySourceText(opportunity, detailFields));
          }}
          aiPrompt={aiPrompt}
          setAiPrompt={setAiPrompt}
          aiGenerating={aiGenerating}
          draftOutput={draftOutput}
          answers={answers}
          answering={answering}
          openQuestions={openQuestions}
          onGenerateDraft={generateDraft}
          onAnswerChange={(question, answer) => setAnswers((prev) => ({ ...prev, [question]: answer }))}
          onSubmitAnswers={submitAnswers}
          onContinue={() => setStudioStep("form")}
        />
      ) : studioStep === "form" ? (
        <ApplicationFormScreen
          selectedFields={selectedFields}
          setSelectedFields={setSelectedFields}
          selectableFields={selectableFields}
          customFields={customFields}
          setCustomFields={setCustomFields}
          visibilityRules={visibilityRules}
          setVisibilityRules={setVisibilityRules}
          onBack={() => setStudioStep("details")}
          onContinue={() => setStudioStep("pipeline")}
        />
      ) : (
        <div className="hidden flex-1 lg:grid lg:grid-cols-[220px_1fr_280px]">
          <PipelineRail
            opportunity={opportunity}
            nodes={graphNodes}
            edges={graphEdges}
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            validationWarnings={validationWarnings}
            openQuestions={openQuestions.length}
            publishReady={publishReady}
            onBack={() => setStudioStep("form")}
            onAddReviewer={addReviewer}
            onAddParallel={addParallelGroup}
            onAddConditionalBranch={addConditionalBranch}
            onAddJoin={addJoin}
            onAddRejectRoute={addRejectRoute}
            onStartConnect={startConnectMode}
          />
          <main className="flex min-w-0 flex-col">
            <StudioGraph
              nodes={graphNodes}
              edges={graphEdges}
              selectedNodeKey={selectedNodeKey}
              selectedEdgeKey={selectedEdgeKey}
              validationWarnings={validationWarnings}
              connectMode={Boolean(connectSourceKey)}
              onSelectNode={handleNodeSelection}
              onSelectEdge={setSelectedEdgeKey}
              onAddReviewer={addReviewer}
              onAddParallel={addParallelGroup}
              onAddConditionalBranch={addConditionalBranch}
              onAddJoin={addJoin}
              onAddRejectRoute={addRejectRoute}
              onStartConnect={startConnectMode}
              onAddCondition={addCondition}
              onMoveNode={moveNode}
              onResetLayout={resetGraphLayout}
              onUndo={undo}
              onRedo={redo}
            />
          </main>
          <StudioInspector
            node={selectedNode}
            edge={selectedEdge}
            nodes={graphNodes}
            availableFields={selectedApplicationFields}
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
      )}

      {studioStep === "pipeline" && (
        <div className="flex flex-1 flex-col lg:hidden">
          {mobileTab === "graph" && (
            <StudioGraph
              mobile
              nodes={graphNodes}
              edges={graphEdges}
              selectedNodeKey={selectedNodeKey}
              selectedEdgeKey={selectedEdgeKey}
              validationWarnings={validationWarnings}
              connectMode={Boolean(connectSourceKey)}
              onSelectNode={(key) => {
                handleNodeSelection(key);
                if (key) setMobileTab("inspector");
              }}
              onSelectEdge={setSelectedEdgeKey}
              onAddReviewer={addReviewer}
              onAddParallel={addParallelGroup}
              onAddConditionalBranch={addConditionalBranch}
              onAddJoin={addJoin}
              onAddRejectRoute={addRejectRoute}
              onStartConnect={startConnectMode}
              onAddCondition={addCondition}
              onMoveNode={moveNode}
              onResetLayout={resetGraphLayout}
              onUndo={undo}
              onRedo={redo}
            />
          )}
          {mobileTab === "inspector" && (
            <StudioInspector
              node={selectedNode}
              edge={selectedEdge}
              nodes={graphNodes}
              availableFields={selectedApplicationFields}
              validationWarnings={validationWarnings}
              onClose={() => setMobileTab("graph")}
              onUpdateNode={updateNode}
              onUpdateEdge={updateEdge}
              onRemoveNode={removeNode}
            />
          )}
          <nav className="mt-auto grid grid-cols-3 border-t border-slate-200 bg-white">
            <button type="button" onClick={() => setStudioStep("form")} className="min-h-[56px] text-sm font-semibold text-slate-500">
              Form
            </button>
            {(["graph", "inspector"] as const).map((tab) => (
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
      )}

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

function SetupScreen({
  opportunity,
  setOpportunity,
  detailFields,
  setDetailFields,
  summaryIsStale,
  onGenerateSummary,
  aiPrompt,
  setAiPrompt,
  aiGenerating,
  draftOutput,
  answers,
  answering,
  openQuestions,
  onGenerateDraft,
  onAnswerChange,
  onSubmitAnswers,
  onContinue,
}: {
  opportunity: OpportunityData;
  setOpportunity: React.Dispatch<React.SetStateAction<OpportunityData>>;
  detailFields: OpportunityDetailField[];
  setDetailFields: React.Dispatch<React.SetStateAction<OpportunityDetailField[]>>;
  summaryIsStale: boolean;
  onGenerateSummary: () => void;
  aiPrompt: string;
  setAiPrompt: (value: string) => void;
  aiGenerating: boolean;
  draftOutput: DraftOutput | null;
  answers: Record<string, string>;
  answering: boolean;
  openQuestions: string[];
  onGenerateDraft: () => void;
  onAnswerChange: (question: string, answer: string) => void;
  onSubmitAnswers: () => void;
  onContinue: () => void;
}) {
  return (
    <main className="flex-1 overflow-y-auto bg-slate-50">
      <div className="mx-auto grid max-w-7xl gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 border-b border-slate-100 pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Details</p>
              <h2 className="mt-1 font-display text-xl font-semibold text-slate-900">Opportunity setup</h2>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <CompactInput label="Title" value={opportunity.title} onChange={(value) => setOpportunity((prev) => ({ ...prev, title: value }))} />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Code</span>
              <input
                className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm font-semibold text-slate-500"
                value={opportunity.code || "Auto-generated on save"}
                readOnly
              />
            </label>
          </div>

          <div className="mt-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Description</span>
              <textarea
                rows={3}
                className="w-full resize-none rounded-lg border border-slate-200 p-3 text-sm leading-6 text-slate-700 outline-none focus:border-primary"
                value={opportunity.description}
                onChange={(event) => setOpportunity((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Program summary, eligibility notes, funding context, and application expectations"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <RailSection title={`Student Detail Fields (${detailFields.length})`}>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDetailFields((prev) => [
                      ...prev,
                      {
                        field_key: `detail_${Date.now()}`,
                        label: "Custom Detail",
                        value: "",
                        value_type: "text",
                        display_order: prev.length + 1,
                        is_student_visible: true,
                      },
                    ])
                  }
                  className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-primary-dark"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Add Detail
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDetailFields((prev) =>
                      mergeDetailFields(prev, [
                        {
                          field_key: "application_deadline",
                          label: "Application Deadline",
                          value: "",
                          value_type: "date",
                          display_order: prev.length + 1,
                          is_student_visible: true,
                        },
                      ])
                    )
                  }
                  className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-amber-700"
                >
                  <span className="material-symbols-outlined text-[18px]">event</span>
                  Add Deadline
                </button>
              </div>
              <div className="space-y-2">
                {detailFields.length === 0 && <p className="text-sm text-slate-500">No custom student-facing details yet.</p>}
                {detailFields.map((field, index) => (
                  <div key={field.field_key} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 md:grid-cols-[minmax(120px,0.8fr)_110px_minmax(160px,1.2fr)_40px]">
                    <input
                      className="min-h-[38px] rounded-md border border-slate-200 bg-white px-2 text-sm"
                      value={field.label}
                      onChange={(event) =>
                        setDetailFields((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))
                      }
                      placeholder="Label"
                    />
                    <select
                      className="min-h-[38px] rounded-md border border-slate-200 bg-white px-2 text-sm"
                      value={field.value_type}
                      onChange={(event) =>
                        setDetailFields((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, value_type: event.target.value as OpportunityDetailField["value_type"] } : item)))
                      }
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                    </select>
                    <input
                      type={field.value_type === "date" ? "date" : field.value_type === "number" ? "number" : "text"}
                      className="min-h-[38px] rounded-md border border-slate-200 bg-white px-2 text-sm"
                      value={field.value}
                      onChange={(event) =>
                        setDetailFields((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, value: event.target.value } : item)))
                      }
                      placeholder="Value"
                    />
                    <button
                      type="button"
                      className="flex min-h-[38px] items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-red-600"
                      onClick={() => setDetailFields((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                      aria-label={`Remove ${field.label || "detail field"}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </RailSection>

            <RailSection title="Student Summary">
              <div className="space-y-2">
                {summaryIsStale && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    Summary may be stale after your edits.
                  </div>
                )}
                {(opportunity.ai_summary_bullets || []).map((bullet, index) => (
                  <input
                    key={`${index}-${bullet}`}
                    className="min-h-[38px] w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                    value={bullet}
                    onChange={(event) =>
                      setOpportunity((prev) => ({
                        ...prev,
                        ai_summary_bullets: (prev.ai_summary_bullets || []).map((item, itemIndex) => (itemIndex === index ? event.target.value : item)),
                      }))
                    }
                    placeholder="Summary bullet"
                  />
                ))}
                {(opportunity.ai_summary_bullets || []).length === 0 && <p className="text-sm text-slate-500">Generate or add a few bullets for students.</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onGenerateSummary} className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-primary-dark">
                  <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
                  Generate Summary
                </button>
                <button
                  type="button"
                  onClick={() => setOpportunity((prev) => ({ ...prev, ai_summary_bullets: [...(prev.ai_summary_bullets || []), ""] }))}
                  className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-slate-600"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Add Bullet
                </button>
              </div>
            </RailSection>
          </div>
        </section>

        <AIAssistantPanel
          aiPrompt={aiPrompt}
          setAiPrompt={setAiPrompt}
          aiGenerating={aiGenerating}
          draftOutput={draftOutput}
          answers={answers}
          answering={answering}
          openQuestions={openQuestions}
          onGenerateDraft={onGenerateDraft}
          onAnswerChange={onAnswerChange}
          onSubmitAnswers={onSubmitAnswers}
        />
      </div>
    </main>
  );
}

function ApplicationFormScreen({
  selectedFields,
  setSelectedFields,
  selectableFields,
  customFields,
  setCustomFields,
  visibilityRules,
  setVisibilityRules,
  onBack,
  onContinue,
}: {
  selectedFields: string[];
  setSelectedFields: React.Dispatch<React.SetStateAction<string[]>>;
  selectableFields: CatalogField[];
  customFields: CustomFieldDraft[];
  setCustomFields: React.Dispatch<React.SetStateAction<CustomFieldDraft[]>>;
  visibilityRules: GeneratorVisibilityRule[];
  setVisibilityRules: React.Dispatch<React.SetStateAction<GeneratorVisibilityRule[]>>;
  onBack: () => void;
  onContinue: () => void;
}) {
  const selectedSet = new Set(selectedFields);

  function addCustomField() {
    const fieldKey = `custom_${Date.now()}`;
    setCustomFields((prev) => [
      ...prev,
      {
        field_key: fieldKey,
        label: "Custom Field",
        description: "",
        fieldHint: "",
        inputType: "text",
        optionsText: "",
        persistForFuture: true,
      },
    ]);
    setSelectedFields((prev) => [...prev, fieldKey]);
  }

  function updateCustomField(index: number, patch: Partial<CustomFieldDraft>) {
    setCustomFields((prev) => prev.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)));
  }

  function removeCustomField(index: number) {
    const field = customFields[index];
    setCustomFields((prev) => prev.filter((_, fieldIndex) => fieldIndex !== index));
    if (field) setSelectedFields((prev) => prev.filter((key) => key !== field.field_key));
  }

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50">
      <div className="mx-auto grid max-w-7xl gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Application Form</p>
              <h2 className="mt-1 font-display text-xl font-semibold text-slate-900">Applicant fields</h2>
            </div>
            <button type="button" onClick={addCustomField} className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Field
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <RailSection title={`Selected Fields (${selectedFields.length})`}>
              <div className="flex flex-wrap gap-2">
                {selectableFields.map((field) => {
                  const checked = selectedSet.has(field.field_key);
                  return (
                    <button
                      key={field.field_key}
                      type="button"
                      onClick={() => setSelectedFields((prev) => (checked ? prev.filter((key) => key !== field.field_key) : [...prev, field.field_key]))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        checked ? "border-primary bg-primary text-white" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                      }`}
                    >
                      {field.label}
                    </button>
                  );
                })}
              </div>
            </RailSection>

            <RailSection title="Field Inspector">
              <div className="space-y-3">
                {customFields.length === 0 && <p className="text-sm text-slate-500">Add a custom applicant field to edit labels, hints, options, and reuse.</p>}
                {customFields.map((field, index) => (
                  <div key={field.field_key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_36px]">
                      <input
                        className="min-h-[38px] rounded-md border border-slate-200 bg-white px-2 text-sm"
                        value={field.label}
                        onChange={(event) => updateCustomField(index, { label: event.target.value })}
                        placeholder="Field label"
                      />
                      <select
                        className="min-h-[38px] rounded-md border border-slate-200 bg-white px-2 text-sm"
                        value={field.inputType}
                        onChange={(event) => updateCustomField(index, { inputType: event.target.value as CustomFieldDraft["inputType"] })}
                      >
                        <option value="text">Text box</option>
                        <option value="textarea">Textarea</option>
                        <option value="single_select">Single select</option>
                        <option value="multiselect">Multiselect</option>
                      </select>
                      <button type="button" onClick={() => removeCustomField(index)} className="flex min-h-[38px] items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-red-600">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      className="mt-2 w-full resize-none rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                      value={field.description}
                      onChange={(event) => updateCustomField(index, { description: event.target.value })}
                      placeholder="Description shown under the field"
                    />
                    <input
                      className="mt-2 min-h-[38px] w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                      value={field.fieldHint}
                      onChange={(event) => updateCustomField(index, { fieldHint: event.target.value })}
                      placeholder="Student-facing hint"
                    />
                    {(field.inputType === "single_select" || field.inputType === "multiselect") && (
                      <textarea
                        rows={2}
                        className="mt-2 w-full resize-none rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                        value={field.optionsText}
                        onChange={(event) => updateCustomField(index, { optionsText: event.target.value })}
                        placeholder="Options separated by commas or new lines"
                      />
                    )}
                    <label className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={field.persistForFuture !== false}
                        onChange={(event) => updateCustomField(index, { persistForFuture: event.target.checked })}
                      />
                      Persist this field for future opportunities
                    </label>
                  </div>
                ))}
              </div>
            </RailSection>
          </div>
        </section>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4 xl:self-start">
          <RailSection title="Eligibility">
            <div className="space-y-2">
              {visibilityRules.map((rule, index) => (
                <div key={`${rule.ruleType}-${index}`} className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
                  <select
                    className="min-h-[40px] rounded-lg border border-slate-200 bg-white p-2 text-sm"
                    value={rule.ruleType}
                    onChange={(event) =>
                      setVisibilityRules((prev) => prev.map((item, ruleIndex) => (ruleIndex === index ? { ...item, ruleType: event.target.value as GeneratorVisibilityRule["ruleType"] } : item)))
                    }
                  >
                    <option value="GROUP_EMAIL">Group</option>
                    <option value="EMAIL">Email</option>
                  </select>
                  <input
                    className="min-h-[40px] rounded-lg border border-slate-200 p-2 text-sm"
                    value={rule.ruleValue}
                    onChange={(event) => setVisibilityRules((prev) => prev.map((item, ruleIndex) => (ruleIndex === index ? { ...item, ruleValue: event.target.value } : item)))}
                    placeholder="e.g. ug2024@university.edu"
                  />
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setVisibilityRules((prev) => [...prev, { ruleType: "EMAIL", ruleValue: "" }])} className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-primary-dark">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Rule
            </button>
          </RailSection>
          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onBack} className="min-h-[40px] rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Back
            </button>
            <button type="button" onClick={onContinue} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white shadow-sm">
              Build Pipeline
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}

function AIAssistantPanel({
  aiPrompt,
  setAiPrompt,
  aiGenerating,
  draftOutput,
  answers,
  answering,
  openQuestions,
  onGenerateDraft,
  onAnswerChange,
  onSubmitAnswers,
}: {
  aiPrompt: string;
  setAiPrompt: (value: string) => void;
  aiGenerating: boolean;
  draftOutput: DraftOutput | null;
  answers: Record<string, string>;
  answering: boolean;
  openQuestions: string[];
  onGenerateDraft: () => void;
  onAnswerChange: (question: string, answer: string) => void;
  onSubmitAnswers: () => void;
}) {
  const allQuestionsAnswered = (draftOutput?.clarifying_questions || []).length > 0 && openQuestions.length === 0;

  return (
    <aside className="rounded-xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-4 lg:self-start">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined rounded-full bg-primary/10 p-2 text-[20px] text-primary-dark">auto_awesome</span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">PRISM assistant</h2>
            <p className="text-xs text-slate-500">Paste a brief, ask for missing details, or revise the draft.</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-3">
        {draftOutput && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-emerald-800">Draft filled</p>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-emerald-700">{Math.round((draftOutput.confidence || 0) * 100)}%</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-emerald-800">
              {draftOutput.graph.nodes.filter((node) => node.node_type === "reviewer").length} reviewer node
              {draftOutput.graph.nodes.filter((node) => node.node_type === "reviewer").length === 1 ? "" : "s"} prepared.
            </p>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-sm font-medium text-slate-700">What should PRISM help fill?</p>
          <textarea
            rows={5}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 outline-none focus:border-primary"
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
            placeholder="Paste the opportunity email, or ask: Fill in the missing basics and propose a reviewer pipeline."
          />
          <button
            type="button"
            onClick={onGenerateDraft}
            disabled={aiGenerating}
            className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {aiGenerating ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>}
            {aiGenerating ? "PRISM is filling..." : draftOutput ? "Ask PRISM to revise" : "Ask PRISM to fill this in"}
          </button>
        </div>

        {draftOutput?.clarifying_questions && draftOutput.clarifying_questions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Questions</p>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${openQuestions.length === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {openQuestions.length === 0 ? "All answered" : `${openQuestions.length} open`}
              </span>
            </div>
            {draftOutput.clarifying_questions.slice(0, 2).map((question) => (
              <label key={question} className="block rounded-lg border border-slate-200 bg-white p-3">
                <span className="block text-sm leading-5 text-slate-700">PRISM: {question}</span>
                <input
                  className="mt-3 w-full border-0 border-b border-slate-300 bg-transparent px-0 py-2 text-sm outline-none focus:border-primary"
                  value={answers[question] || ""}
                  onChange={(event) => onAnswerChange(question, event.target.value)}
                  placeholder="Your answer"
                />
              </label>
            ))}
            {draftOutput.clarifying_questions.length > 2 && <p className="text-xs text-slate-500">{draftOutput.clarifying_questions.length - 2} more questions hidden until these are answered.</p>}
            <button
              type="button"
              onClick={onSubmitAnswers}
              disabled={!allQuestionsAnswered || answering}
              className="inline-flex min-h-[40px] w-full items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              {answering ? "Regenerating..." : "Submit and Regenerate"}
            </button>
          </div>
        )}

        {draftOutput?.warnings && draftOutput.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-800">Warnings</p>
            <div className="space-y-1">
              {draftOutput.warnings.slice(0, 3).map((warning, index) => (
                <p key={`${index}-${warning}`} className="text-sm leading-5 text-amber-900">{warning}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function PipelineRail({
  opportunity,
  nodes,
  edges,
  selectedNode,
  selectedEdge,
  validationWarnings,
  openQuestions,
  publishReady,
  onBack,
  onAddReviewer,
  onAddParallel,
  onAddConditionalBranch,
  onAddJoin,
  onAddRejectRoute,
  onStartConnect,
}: {
  opportunity: OpportunityData;
  nodes: StudioGraphNode[];
  edges: StudioGraphEdge[];
  selectedNode: StudioGraphNode | null;
  selectedEdge: StudioGraphEdge | null;
  validationWarnings: string[];
  openQuestions: number;
  publishReady: boolean;
  onBack: () => void;
  onAddReviewer: () => void;
  onAddParallel: () => void;
  onAddConditionalBranch: () => void;
  onAddJoin: () => void;
  onAddRejectRoute: () => void;
  onStartConnect: () => void;
}) {
  const reviewerCount = nodes.filter((node) => node.node_type === "reviewer").length;
  const conditionCount = nodes.filter((node) => node.node_type === "conditional").length;
  const joinCount = nodes.filter((node) => node.node_type === "join_all" || node.node_type === "join_any").length;

  return (
    <aside className="overflow-y-auto border-r border-slate-200 bg-[#f8fafc]">
      <div className="border-b border-slate-200 bg-white p-4">
      <button type="button" onClick={onBack} className="mb-5 inline-flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Form
      </button>

      <RailSection title="Setup">
        <div className="space-y-2 text-sm">
          <p className="font-semibold leading-5 text-slate-800">{opportunity.title || "Untitled opportunity"}</p>
          <p className="text-slate-500">{opportunity.code || "Code auto-generated"}</p>
        </div>
      </RailSection>
      </div>

      <div className="border-b border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Workflow Elements</h3>
          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${validationWarnings.length ? "bg-red-100 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
            {validationWarnings.length || 0} Problems
          </span>
        </div>
        <div className="space-y-2">
          <PaletteButton icon="person_add" label="Reviewer" description="Add a stakeholder approval task." onClick={onAddReviewer} />
          <PaletteButton icon="verified" label="Approval" description="Reviewer node with approve/reject/actions." onClick={onAddReviewer} />
          <PaletteButton
            icon="rule"
            label="If / Else Condition"
            description={selectedEdge ? "Split the selected route into true/else paths." : "Insert a field-based routing gate."}
            onClick={onAddConditionalBranch}
            disabled={!selectedEdge && (!selectedNode || selectedNode.node_type === "end")}
          />
          <PaletteButton
            icon="call_split"
            label="Parallel Review"
            description="Add a sibling reviewer and merge point."
            onClick={onAddParallel}
            disabled={!selectedNode || selectedNode.node_type !== "reviewer"}
          />
          <PaletteButton
            icon="merge_type"
            label="Join / Merge"
            description="Bring branches back together safely."
            onClick={onAddJoin}
            disabled={!selectedNode || selectedNode.node_type === "end"}
          />
          <PaletteButton
            icon="block"
            label="Deny / Reject End"
            description="Add a reject path from the selected reviewer."
            onClick={onAddRejectRoute}
            disabled={!selectedNode || selectedNode.node_type !== "reviewer"}
          />
          <PaletteButton
            icon="link"
            label="Connect"
            description="Select source and destination nodes to draw an arrow."
            onClick={onStartConnect}
            disabled={nodes.length < 2}
          />
        </div>
      </div>

      <div className="border-b border-slate-200 bg-white p-4">
        <RailSection title="Topology">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <TopologyMetric label="Reviewers" value={reviewerCount} />
            <TopologyMetric label="Routes" value={edges.length} />
            <TopologyMetric label="Conditions" value={conditionCount} />
            <TopologyMetric label="Joins" value={joinCount} />
          </div>
        </RailSection>
      </div>

      <div className="p-4">
      <RailSection title="Warnings">
        {validationWarnings.length === 0 ? (
          <p className="text-sm text-slate-400">None</p>
        ) : (
          validationWarnings.map((warning, index) => (
            <p key={`${index}-${warning}`} className="mb-1 text-sm text-red-700">
              {warning}
            </p>
          ))
        )}
      </RailSection>

      <RailSection title="Checklist">
        <ChecklistRow done={publishReady} label="Validated" />
        <ChecklistRow done={openQuestions === 0} label={openQuestions === 0 ? "No questions" : `${openQuestions} open questions`} />
        <ChecklistRow done={validationWarnings.length === 0} label={validationWarnings.length === 0 ? "No warnings" : "Warnings remain"} />
      </RailSection>
      </div>
    </aside>
  );
}

function PaletteButton({
  icon,
  label,
  description,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="material-symbols-outlined mt-0.5 rounded-lg bg-slate-100 p-1.5 text-[18px] text-slate-600 group-hover:text-primary-dark">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-bold text-slate-800">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
    </button>
  );
}

function TopologyMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-800">{value}</p>
    </div>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      <div className="space-y-2">{children}</div>
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

function validateGraph(nodes: StudioGraphNode[], edges: StudioGraphEdge[]) {
  const warnings: string[] = [];
  const nodeKeys = new Set(nodes.map((node) => node.node_key));
  const edgeKeys = new Set<string>();
  const adjacency = new Map<string, string[]>();
  if (nodes.length === 0) warnings.push("Add at least one reviewer node.");
  if (nodes.filter((node) => node.node_type === "start").length !== 1) warnings.push("Graph needs exactly one start node.");
  if (nodes.filter((node) => node.node_type === "end").length < 1) warnings.push("Graph needs at least one end node.");
  for (const node of nodes.filter((item) => item.node_type === "reviewer")) {
    if (!node.reviewer_email || !validEmail(node.reviewer_email)) {
      warnings.push(`${node.display_name || node.node_key} needs a valid reviewer email.`);
    }
    if (!Number(node.metadata?.sla_hours || 0)) {
      warnings.push(`${node.display_name || node.node_key} needs an SLA.`);
    }
  }
  for (const edge of edges) {
    const routeKey = `${edge.from_node_key}->${edge.to_node_key}`;
    if (edgeKeys.has(routeKey)) {
      warnings.push(`Duplicate route ${edge.from_node_key} -> ${edge.to_node_key} is not allowed.`);
    }
    edgeKeys.add(routeKey);
    if (edge.from_node_key === edge.to_node_key) {
      warnings.push(`Route ${edge.from_node_key} cannot point to itself.`);
    }
    const from = nodes.find((item) => item.node_key === edge.from_node_key);
    const to = nodes.find((item) => item.node_key === edge.to_node_key);
    if (!from || !to) {
      warnings.push(`Route ${edge.from_node_key} -> ${edge.to_node_key} references a missing node.`);
      continue;
    }
    adjacency.set(edge.from_node_key, [...(adjacency.get(edge.from_node_key) || []), edge.to_node_key]);
    if ((edge.action === "condition_true" || edge.action === "condition_false") && !edge.condition_json?.field) {
      warnings.push(`Conditional route to ${to.display_name || to.node_key} needs an application field.`);
    }
    if ((edge.action === "condition_true" || edge.action === "condition_false") && !edge.condition_json?.op) {
      warnings.push(`Conditional route to ${to.display_name || to.node_key} needs an operator.`);
    }
    const op = edge.condition_json?.op;
    if (edge.condition_json && op !== "exists" && op !== "empty" && !Object.prototype.hasOwnProperty.call(edge.condition_json, "value")) {
      warnings.push(`Conditional route to ${to.display_name || to.node_key} needs a comparison value.`);
    }
    if (from.node_type === "reviewer" && edge.action === "always") {
      warnings.push(`${from.display_name || from.node_key} has an always route; use approve, reject, request changes, or a condition to avoid accidental reviewer bypass.`);
    }
  }
  const start = nodes.find((node) => node.node_type === "start");
  if (start) {
    const reachable = new Set<string>();
    const stack = [start.node_key];
    while (stack.length > 0) {
      const key = stack.pop() as string;
      if (reachable.has(key)) continue;
      reachable.add(key);
      for (const next of adjacency.get(key) || []) stack.push(next);
    }
    for (const node of nodes) {
      if (!reachable.has(node.node_key)) {
        warnings.push(`${node.display_name || node.node_key} is not reachable from Start.`);
      }
    }
  }
  for (const node of nodes.filter((item) => item.node_type !== "end")) {
    if (!pathCanReachEnd(node.node_key, nodes, adjacency)) {
      warnings.push(`${node.display_name || node.node_key} does not have a route to an end state.`);
    }
  }
  return Array.from(new Set(warnings));
}

function pathCanReachEnd(nodeKey: string, nodes: StudioGraphNode[], adjacency: Map<string, string[]>) {
  const nodeByKey = new Map(nodes.map((node) => [node.node_key, node]));
  const seen = new Set<string>();
  const stack = [nodeKey];
  while (stack.length > 0) {
    const key = stack.pop() as string;
    if (seen.has(key)) continue;
    seen.add(key);
    const node = nodeByKey.get(key);
    if (node?.node_type === "end") return true;
    for (const next of adjacency.get(key) || []) stack.push(next);
  }
  return false;
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
    applicant_form_fields: Array.isArray(parsed.applicant_form_fields) ? parsed.applicant_form_fields : undefined,
    clarifying_questions: parseJson<string[]>(row?.clarifying_questions, parsed.clarifying_questions || []),
    warnings: parseJson<string[]>(row?.warnings, parsed.warnings || []),
    confidence: Number(row?.confidence ?? parsed.confidence ?? 0),
  };
}
