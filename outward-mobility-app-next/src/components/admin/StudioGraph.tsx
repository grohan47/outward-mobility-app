"use client";

import { useCallback, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Handle,
  MarkerType,
  Position,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { Icon } from "@/components/ui/Icon";
import type { StudioGraphEdge, StudioGraphNode } from "./studioTypes";

type StudioGraphProps = {
  nodes: StudioGraphNode[];
  edges: StudioGraphEdge[];
  selectedNodeKey: string | null;
  selectedEdgeKey: string | null;
  validationWarnings: string[];
  connectMode?: boolean;
  mobile?: boolean;
  onSelectNode: (nodeKey: string | null) => void;
  onSelectEdge: (edgeKey: string | null) => void;
  onAddReviewer: () => void;
  onAddParallel: () => void;
  onAddConditionalBranch: () => void;
  onAddJoin: () => void;
  onAddRejectRoute: () => void;
  onStartConnect: () => void;
  onAddCondition: () => void;
  onMoveNode: (nodeKey: string, position: { x: number; y: number }) => void;
  onResetLayout: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

function reviewerVisualState(selected: boolean, hasWarning: boolean) {
  if (selected) {
    return "border-indigo-500 shadow-[0_8px_18px_rgba(79,70,229,0.16)]";
  }
  if (hasWarning) {
    return "border-red-300 shadow-[0_8px_18px_rgba(239,68,68,0.08)]";
  }
  return "border-primary shadow-[0_10px_22px_rgba(34,197,94,0.12)]";
}

function slaTone(hours?: number) {
  if (!hours) return "bg-slate-50 text-slate-400 border-slate-200";
  if (hours <= 48) return "bg-red-50 text-red-600 border-red-100";
  if (hours <= 120) return "bg-orange-50 text-orange-600 border-orange-100";
  return "bg-emerald-50 text-emerald-700 border-emerald-100";
}

function nodeLabel(nodes: StudioGraphNode[], nodeKey: string) {
  const node = nodes.find((item) => item.node_key === nodeKey);
  if (!node) return nodeKey;
  return node.display_name || (node.node_type === "start" ? "Start" : node.node_type === "end" ? "End" : node.node_key);
}

function conditionLabel(condition?: Record<string, unknown> | null) {
  if (!condition?.field || !condition?.op) return "condition";
  const op = String(condition.op).replace(/_/g, " ");
  if (condition.op === "exists") return `${condition.field} exists`;
  if (condition.op === "empty") return `${condition.field} empty`;
  const value = Array.isArray(condition.value) ? condition.value.join(", ") : condition.value;
  return `${condition.field} ${op} ${value ?? ""}`.trim();
}

function edgeLabel(edge: StudioGraphEdge, nodes: StudioGraphNode[]) {
  if (edge.action === "condition_true") return "If true";
  if (edge.action === "condition_false") return "If false";
  if (edge.label) return edge.label;
  const destination = nodeLabel(nodes, edge.to_node_key);
  if (edge.action === "approve") return `Approve -> ${destination}`;
  if (edge.action === "reject") return `Reject -> ${destination}`;
  if (edge.action === "request_changes") return `Changes -> ${destination}`;
  if (edge.condition_json) return `If ${conditionLabel(edge.condition_json)} -> ${destination}`;
  return destination !== "End" ? `Next -> ${destination}` : undefined;
}

function canvasPosition(node: StudioGraphNode): { x: number; y: number } | null {
  const raw = node.metadata?.canvas_position;
  if (!raw || typeof raw !== "object") return null;
  const position = raw as { x?: unknown; y?: unknown };
  if (typeof position.x !== "number" || typeof position.y !== "number") return null;
  return { x: position.x, y: position.y };
}

export function SLAChip({ hours }: { hours?: number }) {
  const label = !hours ? "No SLA" : hours < 24 ? `${hours}h SLA` : `${Math.round(hours / 24)}d SLA`;
  return <span className={`rounded-md border px-2 py-1 text-[10px] font-bold ${slaTone(hours)}`}>{label}</span>;
}

function ReviewerNode({ data, selected }: NodeProps<{ displayName: string; reviewerEmail?: string; slaHours?: number; hasWarning: boolean }>) {
  return (
    <div
      className={`min-w-[220px] rounded-2xl border-2 bg-white px-5 py-5 text-center transition-all ${reviewerVisualState(selected, data.hasWarning)}`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-slate-300" />
      <p className="text-[13px] font-bold text-slate-900">{data.displayName || "Configure this reviewer"}</p>
      <p className="mt-1 text-[11px] text-slate-400">{data.reviewerEmail || "No email set"}</p>
      <div className="mt-3 flex justify-center">
        <SLAChip hours={data.slaHours} />
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-slate-300" />
    </div>
  );
}

function StartEndNode({ data, selected }: NodeProps<{ label: string }>) {
  return (
    <div
      className={`min-w-[104px] rounded-full border border-slate-200 bg-white px-6 py-3 text-center text-sm font-medium text-slate-500 shadow-sm ${
        selected ? "ring-2 ring-indigo-200" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-slate-300" />
      {data.label}
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-slate-300" />
    </div>
  );
}

function UtilityNode({ data, selected }: NodeProps<{ label: string; nodeType: StudioGraphNode["node_type"] }>) {
  const isConditional = data.nodeType === "conditional";
  return (
    <div
      className={`flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-sm font-semibold text-slate-400 shadow-inner ${
        selected ? "ring-2 ring-indigo-200" : ""
      }`}
      title={data.label}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-slate-300" />
      {isConditional ? "if" : "..."}
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-slate-300" />
    </div>
  );
}

const nodeTypes = {
  reviewer: ReviewerNode,
  startEnd: StartEndNode,
  utility: UtilityNode,
};

function layoutNodes(
  nodes: StudioGraphNode[],
  edges: StudioGraphEdge[],
  selectedNodeKey: string | null,
  validationWarnings: string[]
): Node[] {
  const incoming = new Map<string, number>();
  const children = new Map<string, string[]>();

  for (const node of nodes) incoming.set(node.node_key, 0);
  for (const edge of edges) {
    incoming.set(edge.to_node_key, (incoming.get(edge.to_node_key) || 0) + 1);
    children.set(edge.from_node_key, [...(children.get(edge.from_node_key) || []), edge.to_node_key]);
  }

  const depth = new Map<string, number>();
  const queue = nodes.filter((node) => (incoming.get(node.node_key) || 0) === 0).map((node) => node.node_key);
  if (queue.length === 0 && nodes[0]) queue.push(nodes[0].node_key);
  for (const key of queue) depth.set(key, 0);

  while (queue.length > 0) {
    const key = queue.shift() as string;
    const nextDepth = (depth.get(key) || 0) + 1;
    for (const child of children.get(key) || []) {
      if (!depth.has(child) || nextDepth > (depth.get(child) || 0)) {
        depth.set(child, nextDepth);
        queue.push(child);
      }
    }
  }

  const buckets = new Map<number, StudioGraphNode[]>();
  for (const node of nodes) {
    const bucketDepth = depth.get(node.node_key) ?? 0;
    buckets.set(bucketDepth, [...(buckets.get(bucketDepth) || []), node]);
  }

  return nodes.map((node) => {
    const nodeDepth = depth.get(node.node_key) ?? 0;
    const bucket = buckets.get(nodeDepth) || [];
    const index = bucket.findIndex((item) => item.node_key === node.node_key);
    const manualPosition = canvasPosition(node);
    const x = manualPosition?.x ?? 180 + (index - (bucket.length - 1) / 2) * 280;
    const y = manualPosition?.y ?? 48 + nodeDepth * 170;
    const label = node.display_name || (node.node_type === "start" ? "Start" : node.node_type === "end" ? "End" : node.node_key);
    const hasWarning = validationWarnings.some((warning) =>
      warning.includes(node.display_name || "") || warning.includes(node.node_key)
    );

    if (node.node_type === "reviewer") {
      return {
        id: node.node_key,
        type: "reviewer",
        position: { x, y },
        selected: selectedNodeKey === node.node_key,
        data: {
          displayName: label,
          reviewerEmail: node.reviewer_email || undefined,
          slaHours: Number(node.metadata?.sla_hours || 0) || undefined,
          hasWarning,
        },
      };
    }

    if (node.node_type === "start" || node.node_type === "end") {
      return {
        id: node.node_key,
        type: "startEnd",
        position: { x, y },
        selected: selectedNodeKey === node.node_key,
        data: { label },
      };
    }

    return {
      id: node.node_key,
      type: "utility",
      position: { x, y },
      selected: selectedNodeKey === node.node_key,
      data: {
        label,
        nodeType: node.node_type,
      },
    };
  });
}

export default function StudioGraph({
  nodes,
  edges,
  selectedNodeKey,
  selectedEdgeKey,
  validationWarnings,
  connectMode = false,
  mobile = false,
  onSelectNode,
  onSelectEdge,
  onAddReviewer,
  onAddParallel,
  onAddConditionalBranch,
  onAddJoin,
  onAddRejectRoute,
  onStartConnect,
  onAddCondition,
  onMoveNode,
  onResetLayout,
  onUndo,
  onRedo,
}: StudioGraphProps) {
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);

  const reactFlowNodes = useMemo(
    () => layoutNodes(nodes, edges, selectedNodeKey, validationWarnings),
    [nodes, edges, selectedNodeKey, validationWarnings]
  );
  const reactFlowEdges = useMemo<Edge[]>(
    () =>
      edges.map((edge) => ({
        id: `${edge.from_node_key}->${edge.to_node_key}`,
        source: edge.from_node_key,
        target: edge.to_node_key,
        label: edgeLabel(edge, nodes),
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: edge.action === "reject" ? "#fca5a5" : edge.action?.startsWith("condition") ? "#93c5fd" : "#cbd5e1" },
        selected: selectedEdgeKey === `${edge.from_node_key}->${edge.to_node_key}`,
        style: {
          stroke: selectedEdgeKey === `${edge.from_node_key}->${edge.to_node_key}` ? "#4f46e5" : edge.action === "reject" ? "#fca5a5" : edge.action?.startsWith("condition") ? "#93c5fd" : "#cbd5e1",
          strokeWidth: selectedEdgeKey === `${edge.from_node_key}->${edge.to_node_key}` ? 2 : 1.75,
        },
        labelShowBg: true,
        labelBgPadding: [8, 4],
        labelBgBorderRadius: 999,
        labelBgStyle: {
          fill: edge.action === "condition_true" ? "#dcfce7" : edge.action === "condition_false" ? "#eff6ff" : edge.action === "reject" ? "#fee2e2" : "#ffffff",
          stroke: edge.action === "condition_true" ? "#86efac" : edge.action === "condition_false" ? "#bfdbfe" : edge.action === "reject" ? "#fecaca" : "#e2e8f0",
        },
        labelStyle: {
          fontSize: 11,
          fill: edge.action === "condition_true" ? "#15803d" : edge.action === "condition_false" ? "#1d4ed8" : edge.action === "reject" ? "#dc2626" : "#64748b",
          fontWeight: 700,
        },
      })),
    [edges, nodes, selectedEdgeKey]
  );

  const selectedNode = nodes.find((node) => node.node_key === selectedNodeKey);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        onSelectNode(null);
        onSelectEdge(null);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        onUndo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        onRedo();
      }
      if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key) && nodes.length > 0) {
        event.preventDefault();
        const index = Math.max(0, nodes.findIndex((node) => node.node_key === selectedNodeKey));
        const delta = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;
        const next = nodes[(index + delta + nodes.length) % nodes.length];
        onSelectNode(next.node_key);
      }
    },
    [nodes, onRedo, onSelectEdge, onSelectNode, onUndo, selectedNodeKey]
  );

  if (mobile) {
    return (
      <div className="space-y-3 bg-[#f9fafb] p-4">
        {nodes.length === 0 ? (
          <EmptyCanvas onAddReviewer={onAddReviewer} onAddParallel={onAddParallel} />
        ) : (
          nodes.map((node) => (
            <button
              key={node.node_key}
              type="button"
              onClick={() => onSelectNode(node.node_key)}
              className={`flex min-h-[72px] w-full items-center justify-between rounded-2xl border bg-white px-4 py-4 text-left ${
                selectedNodeKey === node.node_key ? "border-indigo-400 ring-2 ring-indigo-200" : "border-slate-200"
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{node.display_name || node.node_key}</p>
                <p className="text-xs text-slate-500">{node.node_type.replace("_", " ")}</p>
              </div>
              {node.node_type === "reviewer" && <SLAChip hours={Number(node.metadata?.sla_hours || 0) || undefined} />}
            </button>
          ))
        )}
      </div>
    );
  }

  return (
    <section className="relative flex min-h-[780px] flex-1 flex-col overflow-hidden bg-[#fcfcfd]">
      <div
        className="relative flex-1 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-[size:20px_20px]"
        role="application"
        aria-label="Approval workflow graph editor"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {validationWarnings.length > 0 && (
          <div className="pointer-events-none absolute left-1/2 top-10 z-20 -translate-x-1/2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600 shadow-sm">
            {validationWarnings.length} validation issue{validationWarnings.length === 1 ? "" : "s"} need attention before publishing.
          </div>
        )}

        {validationWarnings.length > 0 && (
          <div className="absolute left-5 top-1/4 z-20 rounded-full bg-red-100 px-3 py-6 text-[11px] font-bold text-red-600 shadow-sm">
            {validationWarnings.length} Issue{validationWarnings.length === 1 ? "" : "s"}
          </div>
        )}

        {connectMode && (
          <div className="pointer-events-none absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-[12px] font-medium text-indigo-700 shadow-sm">
            Connect mode: select a source node, then a destination node to create an arrow.
          </div>
        )}

        {!connectMode && nodes.length > 0 && (
          <div className="pointer-events-none absolute right-5 top-5 z-20 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-[11px] font-medium text-slate-500 shadow-sm">
            Drag nodes to arrange the canvas. Use Fit or Auto layout anytime.
          </div>
        )}

        {nodes.length === 0 ? (
          <EmptyCanvas onAddReviewer={onAddReviewer} onAddParallel={onAddParallel} />
        ) : (
          <ReactFlow
            nodes={reactFlowNodes}
            edges={reactFlowEdges}
            nodeTypes={nodeTypes}
            nodesDraggable
            fitView
            fitViewOptions={{ padding: 0.28 }}
            panOnDrag
            onInit={setFlowInstance}
            onNodeDragStop={(_, node) => onMoveNode(node.id, node.position)}
            onNodeClick={(_, node) => {
              onSelectNode(node.id);
              onSelectEdge(null);
            }}
            onEdgeClick={(_, edge) => {
              onSelectEdge(edge.id);
              onSelectNode(null);
            }}
            onPaneClick={() => {
              onSelectNode(null);
              onSelectEdge(null);
            }}
          >
            <Background color="#e5e7eb" gap={20} />
          </ReactFlow>
        )}

        <div className="absolute bottom-8 left-8 z-20 flex flex-col gap-2">
          <CanvasIconButton icon="add" label="Zoom in" onClick={() => void flowInstance?.zoomIn()} />
          <CanvasIconButton icon="remove" label="Zoom out" onClick={() => void flowInstance?.zoomOut()} />
          <CanvasIconButton icon="fit_screen" label="Fit graph" onClick={() => void flowInstance?.fitView({ padding: 0.28 })} />
          <CanvasIconButton icon="auto_fix_high" label="Auto layout" onClick={onResetLayout} />
        </div>

        <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-200/70">
          <ToolbarButton icon="person_add" label="Reviewer" onClick={onAddReviewer} />
          <ToolbarDivider />
          <ToolbarButton icon="call_split" label="Parallel" onClick={onAddParallel} disabled={!selectedNode || selectedNode.node_type !== "reviewer"} />
          <ToolbarDivider />
          <ToolbarButton icon="rule" label="If / Else" onClick={onAddConditionalBranch} disabled={!selectedEdgeKey && (!selectedNode || selectedNode.node_type === "end")} />
          <ToolbarDivider />
          <ToolbarButton icon="merge_type" label="Join" onClick={onAddJoin} disabled={!selectedNode || selectedNode.node_type === "end"} />
          <ToolbarDivider />
          <ToolbarButton icon="block" label="Reject End" onClick={onAddRejectRoute} disabled={!selectedNode || selectedNode.node_type !== "reviewer"} />
          <ToolbarDivider />
          <ToolbarButton icon="link" label="Connect" onClick={onStartConnect} active={connectMode} disabled={nodes.filter((node) => node.node_type === "reviewer").length < 2} />
          <ToolbarDivider />
          <ToolbarButton icon="description" label="Condition" onClick={onAddCondition} disabled={!selectedEdgeKey} />
          <ToolbarDivider />
          <ToolbarButton icon="undo" label="Undo" onClick={onUndo} />
          <ToolbarButton icon="redo" label="Redo" onClick={onRedo} />
        </div>
      </div>
    </section>
  );
}

function EmptyCanvas({ onAddReviewer, onAddParallel }: { onAddReviewer: () => void; onAddParallel: () => void }) {
  return (
    <div className="flex h-full min-h-[620px] items-center justify-center p-8">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white/95 p-10 text-center shadow-sm">
        <Icon name="account_tree" className="mx-auto h-12 w-12 text-slate-300" />
        <h3 className="mt-4 text-lg font-semibold text-slate-900">Start the approval workflow</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Add the first reviewer node, then branch into parallel reviews or conditional paths as needed.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onAddReviewer}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            + Reviewer
          </button>
          <button
            type="button"
            onClick={onAddParallel}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            + Parallel Group
          </button>
        </div>
      </div>
    </div>
  );
}

function CanvasIconButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
    >
      <Icon name={icon} className="h-[18px] w-[18px]" />
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-6 w-px bg-slate-200" />;
}

function ToolbarButton({
  icon,
  label,
  disabled,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:text-slate-300 ${
        active ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <Icon name={icon} className="h-[18px] w-[18px]" />
      <span>{label}</span>
    </button>
  );
}
