"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import StudioInspectorV2 from "./StudioInspectorV2";
import type { CatalogField, StudioEdgeAction, StudioGraphEdge, StudioGraphNode } from "./studioTypes";

type StudioGraphV2Props = {
  nodes: StudioGraphNode[];
  edges: StudioGraphEdge[];
  selectedNodeKey: string | null;
  selectedEdgeKey: string | null;
  validationWarnings: string[];
  availableFields: CatalogField[];
  connectMode?: boolean;
  mobile?: boolean;
  onSelectNode: (nodeKey: string | null) => void;
  onSelectEdge: (edgeKey: string | null) => void;
  onAddReviewer: () => void;
  onAddParallel: () => void;
  onAddConditionalBranch: () => void;
  onAddJoin: () => void;
  onAddTerminalEnd: () => void;
  onAddRejectRoute: () => void;
  onStartConnect: () => void;
  onMoveNode: (nodeKey: string, position: { x: number; y: number }) => void;
  onResetLayout: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onUpdateNode: (nodeKey: string, patch: Partial<StudioGraphNode>) => void;
  onUpdateEdge: (edgeKey: string, patch: Partial<StudioGraphEdge>) => void;
  onRemoveNode: (nodeKey: string) => void;
  onRemoveEdge: (edgeKey: string) => void;
};

type CanvasNode = StudioGraphNode & {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragState = {
  nodeKey: string;
  startX: number;
  startY: number;
  nodeX: number;
  nodeY: number;
  moved: boolean;
};

const CANVAS_WIDTH = 4200;
const CANVAS_HEIGHT = 2400;

const NODE_META: Record<StudioGraphNode["node_type"], { color: string; bg: string; icon: string; width: number; height: number; label: string }> = {
  start: { color: "#16a34a", bg: "#ecfdf3", icon: "play_circle", width: 120, height: 52, label: "Start" },
  reviewer: { color: "#2563eb", bg: "#eff6ff", icon: "person", width: 220, height: 104, label: "Reviewer" },
  join_all: { color: "#d97706", bg: "#fffbeb", icon: "merge", width: 142, height: 56, label: "Join All" },
  join_any: { color: "#ea580c", bg: "#fff7ed", icon: "call_merge", width: 142, height: 56, label: "Join Any" },
  conditional: { color: "#7c3aed", bg: "#f5f3ff", icon: "device_hub", width: 166, height: 76, label: "Condition" },
  end: { color: "#64748b", bg: "#f8fafc", icon: "stop_circle", width: 120, height: 52, label: "End" },
};

const ACTION_META: Record<StudioEdgeAction, { color: string; label: string; dashed?: boolean }> = {
  always: { color: "#94a3b8", label: "always" },
  approve: { color: "#16a34a", label: "approve", dashed: true },
  reject: { color: "#ef4444", label: "reject", dashed: true },
  request_changes: { color: "#d97706", label: "changes", dashed: true },
  condition_true: { color: "#7c3aed", label: "if true", dashed: true },
  condition_false: { color: "#64748b", label: "if false", dashed: true },
};

function canvasPosition(node: StudioGraphNode): { x: number; y: number } | null {
  const raw = node.metadata?.canvas_position;
  if (!raw || typeof raw !== "object") return null;
  const position = raw as { x?: unknown; y?: unknown };
  if (typeof position.x !== "number" || typeof position.y !== "number") return null;
  return { x: position.x, y: position.y };
}

function nodeLabel(node: StudioGraphNode) {
  return node.display_name || NODE_META[node.node_type]?.label || node.node_key;
}

function edgeKey(edge: StudioGraphEdge) {
  return `${edge.from_node_key}->${edge.to_node_key}`;
}

function edgeAction(edge: StudioGraphEdge): StudioEdgeAction {
  return edge.action || "always";
}

function conditionLabel(condition?: Record<string, unknown> | null) {
  if (!condition?.field || !condition?.op) return "condition";
  const op = String(condition.op).replace(/_/g, " ");
  if (condition.op === "exists") return `${condition.field} exists`;
  if (condition.op === "empty") return `${condition.field} empty`;
  const value = Array.isArray(condition.value) ? condition.value.join(", ") : condition.value;
  return `${condition.field} ${op} ${value ?? ""}`.trim();
}

function edgeLabel(edge: StudioGraphEdge) {
  if (edge.label) return edge.label;
  if (edge.action === "condition_true") return "if true";
  if (edge.action === "condition_false") return "if false";
  if (edge.condition_json) return conditionLabel(edge.condition_json);
  return ACTION_META[edgeAction(edge)].label;
}

function layoutCanvasNodes(nodes: StudioGraphNode[], edges: StudioGraphEdge[], preview: Record<string, { x: number; y: number }> | null): CanvasNode[] {
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
  queue.forEach((key) => depth.set(key, 0));

  while (queue.length > 0) {
    const key = queue.shift();
    if (!key) continue;
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
    const bucket = depth.get(node.node_key) ?? 0;
    buckets.set(bucket, [...(buckets.get(bucket) || []), node]);
  }

  return nodes.map((node) => {
    const meta = NODE_META[node.node_type];
    const nodeDepth = depth.get(node.node_key) ?? 0;
    const bucket = buckets.get(nodeDepth) || [];
    const index = bucket.findIndex((item) => item.node_key === node.node_key);
    const manualPosition = canvasPosition(node);
    const previewPosition = preview?.[node.node_key];
    const x = previewPosition?.x ?? manualPosition?.x ?? 80 + nodeDepth * 280;
    const y = previewPosition?.y ?? manualPosition?.y ?? 120 + (index - (bucket.length - 1) / 2) * 160;

    return {
      ...node,
      x,
      y: Math.max(40, y),
      width: meta.width,
      height: meta.height,
    };
  });
}

function endpoint(node: CanvasNode, side: "left" | "right") {
  return {
    x: side === "left" ? node.x : node.x + node.width,
    y: node.y + node.height / 2,
  };
}

function edgePath(edge: StudioGraphEdge, canvasNodes: CanvasNode[]) {
  const from = canvasNodes.find((node) => node.node_key === edge.from_node_key);
  const to = canvasNodes.find((node) => node.node_key === edge.to_node_key);
  if (!from || !to) return "";
  const start = endpoint(from, "right");
  const end = endpoint(to, "left");
  const control = Math.max(90, Math.abs(end.x - start.x) / 2);
  return `M${start.x},${start.y} C${start.x + control},${start.y} ${end.x - control},${end.y} ${end.x},${end.y}`;
}

function edgeMidpoint(edge: StudioGraphEdge, canvasNodes: CanvasNode[]) {
  const from = canvasNodes.find((node) => node.node_key === edge.from_node_key);
  const to = canvasNodes.find((node) => node.node_key === edge.to_node_key);
  if (!from || !to) return { x: 0, y: 0 };
  const start = endpoint(from, "right");
  const end = endpoint(to, "left");
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 16 };
}

export default function StudioGraphV2({
  nodes,
  edges,
  selectedNodeKey,
  selectedEdgeKey,
  validationWarnings,
  availableFields,
  connectMode = false,
  mobile = false,
  onSelectNode,
  onSelectEdge,
  onAddReviewer,
  onAddParallel,
  onAddConditionalBranch,
  onAddJoin,
  onAddTerminalEnd,
  onAddRejectRoute,
  onStartConnect,
  onMoveNode,
  onResetLayout,
  onUndo,
  onRedo,
  onUpdateNode,
  onUpdateEdge,
  onRemoveNode,
  onRemoveEdge,
}: StudioGraphV2Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(0.9);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const preview = drag ? { [drag.nodeKey]: { x: drag.nodeX, y: drag.nodeY } } : null;
  const canvasNodes = useMemo(() => layoutCanvasNodes(nodes, edges, preview), [nodes, edges, preview]);
  const selectedNode = nodes.find((node) => node.node_key === selectedNodeKey) || null;
  const selectedEdge = selectedEdgeKey ? edges.find((edge) => edgeKey(edge) === selectedEdgeKey) || null : null;
  const reviewerCount = nodes.filter((node) => node.node_type === "reviewer").length;
  const editableCount = nodes.filter((node) => node.node_type !== "start" && node.node_type !== "end").length;

  const clearSelection = useCallback(() => {
    onSelectNode(null);
    onSelectEdge(null);
  }, [onSelectEdge, onSelectNode]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        onUndo();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        onRedo();
      } else if (event.key === "Tab") {
        event.preventDefault();
        onAddReviewer();
      } else if (event.key === "Escape") {
        clearSelection();
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedEdgeKey) {
        event.preventDefault();
        onRemoveEdge(selectedEdgeKey);
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedNodeKey) {
        event.preventDefault();
        onRemoveNode(selectedNodeKey);
      } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && selectedNodeKey) {
        const current = canvasNodes.find((node) => node.node_key === selectedNodeKey);
        if (!current) return;
        event.preventDefault();
        const step = event.shiftKey ? 60 : 20;
        onMoveNode(selectedNodeKey, {
          x: Math.max(0, current.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0)),
          y: Math.max(0, current.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0)),
        });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canvasNodes, clearSelection, onAddReviewer, onMoveNode, onRedo, onRemoveEdge, onRemoveNode, onUndo, selectedEdgeKey, selectedNodeKey]);

  useEffect(() => {
    if (!drag) return;
    const currentDrag = drag;
    function onPointerMove(event: PointerEvent) {
      const dx = (event.clientX - currentDrag.startX) / zoom;
      const dy = (event.clientY - currentDrag.startY) / zoom;
      setDrag({
        ...currentDrag,
        nodeX: Math.max(0, currentDrag.nodeX + dx),
        nodeY: Math.max(0, currentDrag.nodeY + dy),
        startX: event.clientX,
        startY: event.clientY,
        moved: currentDrag.moved || Math.abs(dx) + Math.abs(dy) > 2,
      });
    }
    function onPointerUp() {
      if (currentDrag.moved) onMoveNode(currentDrag.nodeKey, { x: currentDrag.nodeX, y: currentDrag.nodeY });
      setDrag(null);
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [drag, onMoveNode, zoom]);

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (event.target !== canvasRef.current && !target.dataset.canvasBg && !target.dataset.canvasStage) return;
    clearSelection();
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>, node: CanvasNode) {
    event.stopPropagation();
    onSelectNode(node.node_key);
    onSelectEdge(null);
    if (connectMode) return;
    setDrag({
      nodeKey: node.node_key,
      startX: event.clientX,
      startY: event.clientY,
      nodeX: node.x,
      nodeY: node.y,
      moved: false,
    });
  }

  function resetView() {
    setZoom(0.9);
    canvasRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  }

  if (nodes.length === 0) {
    return (
      <section className="flex min-h-[620px] flex-1 items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <span className="material-symbols-outlined text-5xl text-slate-300">account_tree</span>
          <h3 className="mt-4 text-lg font-black text-slate-900">Start the approval workflow</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">Add a reviewer to create Start, first review, and End nodes.</p>
          <button type="button" onClick={onAddReviewer} className="mt-6 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white">
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Reviewer
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`flex min-h-0 flex-1 overflow-hidden bg-white ${mobile ? "flex-col" : ""}`}>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-50">
        <div className="absolute left-4 top-4 z-30 flex max-w-[calc(100%-2rem)] flex-wrap gap-2">
          <ToolGroup label="Add">
            <ToolButton icon="person_add" label="Reviewer" onClick={onAddReviewer} />
            <ToolButton icon="merge" label="Join All" onClick={onAddJoin} disabled={!selectedNode || selectedNode.node_type === "end"} />
            <ToolButton icon="stop_circle" label="Terminal" onClick={onAddTerminalEnd} disabled={!selectedNode || selectedNode.node_type === "end"} />
            <ToolButton icon="device_hub" label="If / Else" onClick={onAddConditionalBranch} disabled={!selectedEdgeKey && (!selectedNode || selectedNode.node_type === "end")} />
            <ToolButton icon="block" label="Reject End" onClick={onAddRejectRoute} disabled={!selectedNode || selectedNode.node_type !== "reviewer"} />
          </ToolGroup>
          <ToolGroup label="View">
            <ToolButton icon="link" label="Connect" onClick={onStartConnect} active={connectMode} disabled={nodes.length < 2} />
            <ToolButton icon="undo" label="Undo" onClick={onUndo} />
            <ToolButton icon="redo" label="Redo" onClick={onRedo} />
            <ToolButton icon="zoom_in" label="Zoom in" onClick={() => setZoom((value) => Math.min(1.8, value + 0.12))} />
            <ToolButton icon="zoom_out" label="Zoom out" onClick={() => setZoom((value) => Math.max(0.35, value - 0.12))} />
            <ToolButton icon="fit_screen" label="Reset view" onClick={resetView} />
            <ToolButton icon="auto_fix_high" label="Auto layout" onClick={onResetLayout} />
            <ToolButton icon="keyboard" label="Shortcuts" onClick={() => setShowShortcuts((value) => !value)} active={showShortcuts} />
          </ToolGroup>
        </div>

        <div className="absolute right-4 top-4 z-30 hidden gap-2 xl:flex">
          <StatPill label="Steps" value={editableCount} />
          <StatPill label="Reviewers" value={reviewerCount} />
          <StatPill label="Routes" value={edges.length} />
          {validationWarnings.length > 0 && <StatPill label="Issues" value={validationWarnings.length} tone="red" />}
        </div>

        {connectMode && (
          <div className="pointer-events-none absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-lg">
            Select source, then destination
          </div>
        )}

        {showShortcuts && (
          <div className="absolute left-4 top-20 z-40 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Keyboard Shortcuts</p>
            {[
              ["Tab", "Add reviewer"],
              ["Delete", "Remove selected"],
              ["Ctrl/Cmd Z", "Undo"],
              ["Arrow keys", "Move selected node"],
              ["Escape", "Clear selection"],
              ["Scroll", "Zoom"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between border-b border-slate-100 py-1.5 text-xs">
                <span className="text-slate-600">{label}</span>
                <kbd className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600">{key}</kbd>
              </div>
            ))}
          </div>
        )}

        <div
          ref={canvasRef}
          className={`absolute inset-0 overflow-auto ${connectMode ? "cursor-crosshair" : "cursor-default"}`}
          onPointerDown={handleCanvasPointerDown}
          role="application"
          aria-label="Approval workflow graph editor"
        >
          <div
            className="relative"
            data-canvas-stage="1"
            style={{ width: CANVAS_WIDTH * zoom, height: CANVAS_HEIGHT * zoom, minWidth: "100%", minHeight: "100%" }}
          >
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              <defs>
                <pattern id="studio-v2-dotgrid" width={28 * zoom} height={28 * zoom} patternUnits="userSpaceOnUse">
                  <circle cx={14 * zoom} cy={14 * zoom} r="1" fill="#dbe3ee" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#studio-v2-dotgrid)" data-canvas-bg="1" />
            </svg>

            <div
              className="absolute left-0 top-0 origin-top-left"
              data-canvas-stage="1"
              style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${zoom})` }}
            >
              <svg className="absolute left-0 top-0 overflow-visible" width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
                <defs>
                  {Object.entries(ACTION_META).map(([action, meta]) => (
                    <marker key={action} id={`studio-v2-arrow-${action}`} markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
                      <path d="M0,0 L0,7 L9,3.5 z" fill={meta.color} />
                    </marker>
                  ))}
                </defs>
                {edges.map((edge) => {
                  const path = edgePath(edge, canvasNodes);
                  if (!path) return null;
                  const key = edgeKey(edge);
                  const selected = selectedEdgeKey === key;
                  const action = edgeAction(edge);
                  const meta = ACTION_META[action];
                  const mid = edgeMidpoint(edge, canvasNodes);
                  return (
                    <g key={key} className="cursor-pointer" onClick={(event) => {
                      event.stopPropagation();
                      onSelectEdge(key);
                      onSelectNode(null);
                    }}>
                      <path d={path} fill="none" stroke="transparent" strokeWidth={16} />
                      <path
                        d={path}
                        fill="none"
                        markerEnd={`url(#studio-v2-arrow-${action})`}
                        stroke={selected ? "#4f46e5" : meta.color}
                        strokeDasharray={meta.dashed ? "6 4" : undefined}
                        strokeWidth={selected ? 3 : 2}
                      />
                      {action !== "always" || edge.label ? (
                        <foreignObject x={mid.x - 58} y={mid.y - 12} width={116} height={26} className="pointer-events-none">
                          <div className="truncate rounded-md border bg-white px-2 py-1 text-center text-[10px] font-bold" style={{ borderColor: `${meta.color}55`, color: meta.color }}>
                            {edgeLabel(edge)}
                          </div>
                        </foreignObject>
                      ) : null}
                    </g>
                  );
                })}
              </svg>

              {canvasNodes.map((node) => (
                <GraphNode
                  key={node.node_key}
                  node={node}
                  selected={selectedNodeKey === node.node_key}
                  connectMode={connectMode}
                  onPointerDown={(event) => startDrag(event, node)}
                  onSelect={() => {
                    onSelectNode(node.node_key);
                    onSelectEdge(null);
                  }}
                  onAddParallel={onAddParallel}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {(selectedNode || selectedEdge) && (
        <div className={`${mobile ? "h-[48vh] w-full border-t" : "w-[340px] border-l"} min-h-0 flex-shrink-0 border-slate-200 bg-white`}>
          <StudioInspectorV2
            node={selectedNode}
            edge={selectedEdge}
            nodes={nodes}
            edges={edges}
            availableFields={availableFields}
            validationWarnings={validationWarnings}
            onClose={clearSelection}
            onUpdateNode={onUpdateNode}
            onUpdateEdge={onUpdateEdge}
            onRemoveNode={onRemoveNode}
            onRemoveEdge={onRemoveEdge}
          />
        </div>
      )}
    </section>
  );
}

function GraphNode({
  node,
  selected,
  connectMode,
  onPointerDown,
  onSelect,
  onAddParallel,
}: {
  node: CanvasNode;
  selected: boolean;
  connectMode: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onSelect: () => void;
  onAddParallel: () => void;
}) {
  const meta = NODE_META[node.node_type];
  const slaHours = Number(node.metadata.sla_hours || 0) || undefined;
  const requiredCount = node.metadata.required_inputs?.length || 0;

  return (
    <div
      className="absolute select-none"
      style={{ left: node.x, top: node.y, width: node.width, cursor: "grab" }}
      onPointerDown={onPointerDown}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      {node.node_type !== "start" && <Port side="left" color={meta.color} active={connectMode} />}
      <div
        className="overflow-hidden rounded-xl border-2 bg-white shadow-sm transition"
        style={{
          height: node.height,
          borderColor: selected ? meta.color : connectMode ? `${meta.color}88` : "#e2e8f0",
          boxShadow: selected ? `0 0 0 4px ${meta.color}22, 0 10px 30px rgba(15,23,42,0.12)` : "0 2px 8px rgba(15,23,42,0.07)",
        }}
      >
        <div className="flex items-center gap-2 px-3" style={{ height: node.node_type === "reviewer" ? 42 : node.height, background: selected ? meta.bg : "#f8fafc" }}>
          <span className="material-symbols-outlined flex h-7 w-7 items-center justify-center rounded-lg text-[16px]" style={{ background: selected ? meta.color : meta.bg, color: selected ? "white" : meta.color }}>
            {meta.icon}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-black" style={{ color: selected ? meta.color : "#334155" }}>
            {nodeLabel(node)}
          </span>
          {selected && node.node_type === "reviewer" && (
            <button
              type="button"
              title="Add parallel branch"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onAddParallel();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white"
            >
              <span className="material-symbols-outlined text-[16px]" style={{ color: meta.color }}>
                fork_right
              </span>
            </button>
          )}
        </div>
        {node.node_type === "reviewer" && (
          <div className="px-3 py-2">
            <p className={`truncate text-[11px] ${node.reviewer_email ? "text-slate-600" : "italic text-slate-400"}`}>{node.reviewer_email || "No reviewer set"}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Chip color="#2563eb">{slaHours ? `${slaHours}h` : "No SLA"}</Chip>
              {requiredCount > 0 && <Chip color="#7c3aed">{requiredCount} input{requiredCount === 1 ? "" : "s"}</Chip>}
              {node.allowed_actions.includes("reject") && <Chip color="#ef4444">final</Chip>}
            </div>
          </div>
        )}
        {node.node_type === "conditional" && (
          <div className="px-3 pb-2 text-[10px] font-bold text-violet-700">Select true/false routes to set rules</div>
        )}
      </div>
      {node.node_type !== "end" && <Port side="right" color={meta.color} active={connectMode} />}
    </div>
  );
}

function Port({ side, color, active }: { side: "left" | "right"; color: string; active: boolean }) {
  return (
    <span
      className={`absolute top-1/2 z-10 h-4 w-4 -translate-y-1/2 rounded-full border-2 bg-white ${side === "left" ? "-left-2" : "-right-2"}`}
      style={{ borderColor: color, boxShadow: active ? `0 0 0 4px ${color}22` : undefined }}
    />
  );
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="rounded-md border px-1.5 py-0.5 text-[10px] font-bold" style={{ color, background: `${color}18`, borderColor: `${color}33` }}>
      {children}
    </span>
  );
}

function ToolGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 px-2 py-1 shadow-sm">
      <span className="mr-1 text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      {children}
    </div>
  );
}

function ToolButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
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
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-35 ${
        active ? "bg-violet-100 text-violet-700" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <span className="material-symbols-outlined text-[17px]">{icon}</span>
    </button>
  );
}

function StatPill({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "red" }) {
  return (
    <div className={`rounded-full border bg-white px-3 py-1 text-xs font-bold shadow-sm ${tone === "red" ? "border-red-200 text-red-700" : "border-slate-200 text-slate-700"}`}>
      <span className="mr-1 font-medium text-slate-400">{label}</span>
      {value}
    </div>
  );
}
