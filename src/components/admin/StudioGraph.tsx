"use client";

import { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import type { StudioGraphEdge, StudioGraphNode } from "./studioTypes";

type StudioGraphProps = {
  nodes: StudioGraphNode[];
  edges: StudioGraphEdge[];
  selectedNodeKey: string | null;
  selectedEdgeKey: string | null;
  validationWarnings: string[];
  mobile?: boolean;
  onSelectNode: (nodeKey: string | null) => void;
  onSelectEdge: (edgeKey: string | null) => void;
  onAddReviewer: () => void;
  onAddParallel: () => void;
  onAddCondition: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

function slaClass(hours?: number) {
  if (!hours) return "bg-slate-100 text-slate-400 border border-dashed border-slate-300";
  if (hours <= 48) return "bg-red-50 text-red-700";
  if (hours <= 120) return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

export function SLAChip({ hours }: { hours?: number }) {
  if (!hours) {
    return <span className={`${slaClass()} rounded-full px-2 py-0.5 text-xs font-medium`}>No SLA</span>;
  }
  const label = hours < 24 ? `${hours}h SLA` : `${Math.round(hours / 24)}d SLA`;
  return <span className={`${slaClass(hours)} rounded-full px-2 py-0.5 text-xs font-medium`}>{label}</span>;
}

function ReviewerNode({ data, selected }: NodeProps<any>) {
  const status = data.hasWarning ? "has warnings" : "ready";
  return (
    <button
      type="button"
      role="button"
      aria-label={`${data.displayName || "Unnamed reviewer"} reviewer node, ${data.slaHours ? `${data.slaHours} hour` : "no"} SLA, ${status}`}
      className={`min-w-[168px] rounded-xl border border-l-4 border-slate-200 border-l-teal-500 bg-white p-3 text-left shadow-sm transition ${
        selected ? "border-indigo-400 ring-2 ring-indigo-400" : "hover:border-slate-300"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <p className="text-sm font-semibold text-slate-800">{data.displayName || "Unnamed Reviewer"}</p>
      <p className="mt-0.5 max-w-[150px] truncate text-xs text-slate-500">{data.reviewerEmail || "No email set"}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <SLAChip hours={data.slaHours} />
        {data.hasWarning && <span className="material-symbols-outlined text-[18px] text-amber-500">warning</span>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
    </button>
  );
}

function StartEndNode({ data, selected }: NodeProps<any>) {
  return (
    <button
      type="button"
      role="button"
      aria-label={`${data.label} workflow node`}
      className={`rounded-full border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 transition ${
        selected ? "border-indigo-400 ring-2 ring-indigo-400" : "hover:border-slate-400"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      {data.label}
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
    </button>
  );
}

function ForkMergeNode({ data, selected }: NodeProps<any>) {
  return (
    <button
      type="button"
      aria-label={`${data.type === "join_any" ? "merge any" : data.type === "join_all" ? "merge all" : "condition"} connector`}
      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-400 bg-slate-200 text-[10px] font-bold uppercase text-slate-600 ${
        selected ? "ring-2 ring-indigo-400" : ""
      }`}
      title={data.type}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      {data.type === "conditional" ? "if" : "↔"}
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
    </button>
  );
}

const nodeTypes = {
  reviewer: ReviewerNode,
  startEnd: StartEndNode,
  forkMerge: ForkMergeNode,
};

function layoutNodes(nodes: StudioGraphNode[], edges: StudioGraphEdge[]): Node[] {
  const incoming = new Map<string, number>();
  for (const node of nodes) incoming.set(node.node_key, 0);
  for (const edge of edges) incoming.set(edge.to_node_key, (incoming.get(edge.to_node_key) || 0) + 1);

  const children = new Map<string, string[]>();
  for (const edge of edges) {
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
    const d = depth.get(node.node_key) ?? 0;
    buckets.set(d, [...(buckets.get(d) || []), node]);
  }

  return nodes.map((node) => {
    const d = depth.get(node.node_key) ?? 0;
    const bucket = buckets.get(d) || [];
    const index = bucket.findIndex((item) => item.node_key === node.node_key);
    const x = 120 + (index - (bucket.length - 1) / 2) * 240;
    const type = node.node_type === "reviewer" ? "reviewer" : node.node_type === "start" || node.node_type === "end" ? "startEnd" : "forkMerge";
    return {
      id: node.node_key,
      type,
      position: { x, y: 50 + d * 140 },
      data: {
        label: node.display_name || (node.node_type === "end" ? "End" : "Start"),
        type: node.node_type,
        displayName: node.display_name,
        reviewerEmail: node.reviewer_email,
        slaHours: Number(node.metadata?.sla_hours || 0) || undefined,
        hasWarning: false,
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
  mobile = false,
  onSelectNode,
  onSelectEdge,
  onAddReviewer,
  onAddParallel,
  onAddCondition,
  onUndo,
  onRedo,
}: StudioGraphProps) {
  const reactFlowNodes = useMemo(() => layoutNodes(nodes, edges), [nodes, edges]);
  const reactFlowEdges = useMemo<Edge[]>(
    () =>
      edges.map((edge) => ({
        id: `${edge.from_node_key}->${edge.to_node_key}`,
        source: edge.from_node_key,
        target: edge.to_node_key,
        label: edge.label || undefined,
        markerEnd: { type: MarkerType.ArrowClosed },
        selected: selectedEdgeKey === `${edge.from_node_key}->${edge.to_node_key}`,
        style: { stroke: "#cbd5e1", strokeWidth: 1.5 },
        labelStyle: { fontSize: 11, fill: "#64748b", fontWeight: 600 },
      })),
    [edges, selectedEdgeKey]
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
      if (event.key === "Enter" && selectedNode) {
        onSelectNode(selectedNode.node_key);
      }
    },
    [nodes, onRedo, onSelectEdge, onSelectNode, onUndo, selectedNode, selectedNodeKey]
  );

  if (mobile) {
    return (
      <div className="space-y-3 p-4">
        {nodes.length === 0 ? (
          <EmptyCanvas onAddReviewer={onAddReviewer} onAddParallel={onAddParallel} />
        ) : (
          nodes.map((node) => (
            <button
              key={node.node_key}
              type="button"
              onClick={() => onSelectNode(node.node_key)}
              className={`flex min-h-[64px] w-full items-center justify-between rounded-lg border bg-white px-4 py-3 text-left ${
                selectedNodeKey === node.node_key ? "border-indigo-400 ring-2 ring-indigo-200" : "border-slate-200"
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">{node.display_name || node.node_key}</p>
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
    <section className="relative flex min-h-[680px] flex-1 flex-col overflow-hidden bg-slate-50">
      {validationWarnings.length > 0 && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
          {validationWarnings.length} validation issue{validationWarnings.length === 1 ? "" : "s"} need attention before publishing.
        </div>
      )}
      <div
        className="relative flex-1 bg-slate-50 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-[size:20px_20px]"
        role="application"
        aria-label="Approval workflow graph editor"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {nodes.length === 0 ? (
          <EmptyCanvas onAddReviewer={onAddReviewer} onAddParallel={onAddParallel} />
        ) : (
          <ReactFlow
            nodes={reactFlowNodes}
            edges={reactFlowEdges}
            nodeTypes={nodeTypes}
            nodesDraggable
            fitView
            fitViewOptions={{ padding: 0.2 }}
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
            <Background color="#e2e8f0" gap={20} />
            <Controls />
            <MiniMap pannable zoomable nodeColor="#94a3b8" />
          </ReactFlow>
        )}

        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
          <ToolbarButton icon="person_add" label="Reviewer" onClick={onAddReviewer} />
          <ToolbarButton icon="call_split" label="Parallel" onClick={onAddParallel} disabled={!selectedNode || selectedNode.node_type !== "reviewer"} />
          <ToolbarButton icon="rule" label="Condition" onClick={onAddCondition} disabled={!selectedEdgeKey} />
          <ToolbarButton icon="undo" label="Undo" onClick={onUndo} />
          <ToolbarButton icon="redo" label="Redo" onClick={onRedo} />
        </div>
      </div>
    </section>
  );
}

function EmptyCanvas({ onAddReviewer, onAddParallel }: { onAddReviewer: () => void; onAddParallel: () => void }) {
  return (
    <div className="flex h-full min-h-[520px] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border-2 border-dashed border-slate-300 bg-white/70 p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-slate-300">account_tree</span>
        <p className="mt-3 text-sm font-semibold text-slate-700">Add your first reviewer node to start the workflow</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={onAddReviewer} className="min-h-[44px] rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            + Reviewer
          </button>
          <button type="button" onClick={onAddParallel} className="min-h-[44px] rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            + Parallel Group
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}
