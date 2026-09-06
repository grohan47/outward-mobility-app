"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReviewLevel } from "./levels";
import type { StudioGraphNode } from "./studioTypes";

export default function StudioGraph({ levels, selected, onSelect, onAddNode, onAddLevel, onMoveLevel, onRemoveLevel, onRenameLevel }: {
  levels: ReviewLevel[]; selected: string | null; onSelect: (key: string) => void;
  onAddNode: (levelId: string) => void; onAddLevel: () => void;
  onMoveLevel: (index: number, delta: number) => void; onRemoveLevel: (id: string) => void;
  onRenameLevel: (id: string, name: string) => void;
}) {
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("vertical");
  const [paths, setPaths] = useState<string[]>([]);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [tip, setTip] = useState<{ node: StudioGraphNode; x: number; y: number } | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = canvas.current;
    if (!root) return;
    const update = () => {
      const bounds = root.getBoundingClientRect();
      const point = (key: string, outgoing: boolean) => {
        const el = root.querySelector<HTMLElement>(`[data-node="${key}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return orientation === "horizontal"
          ? { x: (outgoing ? r.right : r.left) - bounds.left, y: r.top + r.height / 2 - bounds.top }
          : { x: r.left + r.width / 2 - bounds.left, y: (outgoing ? r.bottom : r.top) - bounds.top };
      };
      const lines: string[] = [];
      for (let i = 0; i < levels.length - 1; i++) {
        const from = levels[i].reviewers.map((n) => point(n.node_key, true)).filter((p) => p !== null);
        const to = levels[i + 1].reviewers.map((n) => point(n.node_key, false)).filter((p) => p !== null);
        if (!from.length || !to.length) continue;
        if (orientation === "horizontal") {
          const middle = (Math.max(...from.map((p) => p.x)) + Math.min(...to.map((p) => p.x))) / 2;
          const ys = [...from, ...to].map((p) => p.y);
          lines.push(`M ${middle} ${Math.min(...ys)} V ${Math.max(...ys)}`);
          from.forEach((p) => lines.push(`M ${p.x} ${p.y} H ${middle}`));
          to.forEach((p) => lines.push(`M ${middle} ${p.y} H ${p.x - 5}`));
        } else {
          const middle = (Math.max(...from.map((p) => p.y)) + Math.min(...to.map((p) => p.y))) / 2;
          const xs = [...from, ...to].map((p) => p.x);
          lines.push(`M ${Math.min(...xs)} ${middle} H ${Math.max(...xs)}`);
          from.forEach((p) => lines.push(`M ${p.x} ${p.y} V ${middle}`));
          to.forEach((p) => lines.push(`M ${p.x} ${middle} V ${p.y - 5}`));
        }
      }
      setSize({ width: root.scrollWidth, height: root.scrollHeight }); setPaths(lines);
    };
    const observer = new ResizeObserver(update);
    observer.observe(root); root.querySelectorAll("[data-node]").forEach((el) => observer.observe(el));
    update(); return () => observer.disconnect();
  }, [levels, orientation]);
  return <section className="min-w-0 rounded-xl border bg-white" aria-label="Review workflow">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
      <div><h2 className="font-semibold">Review levels</h2><p className="text-sm text-slate-500">All reviewers in a level must approve to continue.</p></div>
      <label className="text-sm">Direction <select aria-label="Workflow orientation" value={orientation} onChange={(e) => {setOrientation(e.target.value as typeof orientation); setTip(null);}} className="ml-2 rounded border p-2"><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option></select></label>
    </div>
    <div className="overflow-auto p-4" onScroll={() => setTip(null)}>
      <div ref={canvas} className={`relative flex gap-12 ${orientation === "horizontal" ? "w-max min-w-full items-stretch" : "min-w-[280px] flex-col"}`}>
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 overflow-visible" width={size.width} height={size.height}>
          <defs><marker id="flow-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5" fill="#64748b" /></marker></defs>
          {paths.map((d, i) => <path key={i} d={d} fill="none" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#flow-arrow)" />)}
        </svg>
        {levels.map((level, index) => <section key={level.id} className={`relative rounded-xl border p-4 ${orientation === "horizontal" ? "w-72 shrink-0" : "w-full"} ${index % 2 ? "bg-indigo-50/70" : "bg-slate-50"}`}>
          <div className="relative z-20 mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">{index + 1}.</span>
            <input aria-label={`Level ${index + 1} name`} className="min-w-0 flex-1 rounded border border-transparent bg-transparent p-1 font-semibold focus:border-indigo-500" value={level.name} onChange={(e) => onRenameLevel(level.id, e.target.value)} />
            <button aria-label={`Move level ${index + 1} earlier`} disabled={!index} onClick={() => onMoveLevel(index, -1)} className="rounded border bg-white px-2 disabled:opacity-30">↑</button>
            <button aria-label={`Move level ${index + 1} later`} disabled={index === levels.length - 1} onClick={() => onMoveLevel(index, 1)} className="rounded border bg-white px-2 disabled:opacity-30">↓</button>
            {!level.reviewers.length && <button className="text-xs text-red-700" onClick={() => onRemoveLevel(level.id)}>Remove empty level</button>}
          </div>
          <div className={`relative grid gap-4 ${orientation === "vertical" ? "grid-cols-[repeat(auto-fit,minmax(210px,1fr))]" : "grid-cols-1"}`}>
            {level.reviewers.map((node) => <button key={node.node_key} data-node={node.node_key} aria-pressed={selected === node.node_key}
              onClick={() => {setTip(null); onSelect(node.node_key);}}
              onMouseEnter={(e) => {const r=e.currentTarget.getBoundingClientRect();setTip({node,x:Math.min(r.left,window.innerWidth-300),y:Math.min(r.bottom+8,window.innerHeight-180)});}}
              onFocus={(e) => {const r=e.currentTarget.getBoundingClientRect();setTip({node,x:Math.min(r.left,window.innerWidth-300),y:Math.min(r.bottom+8,window.innerHeight-180)});}}
              onMouseLeave={() => setTip(null)} onBlur={() => setTip(null)}
              className={`relative z-20 min-h-24 min-w-0 rounded-xl border-2 bg-white p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${selected===node.node_key ? "border-indigo-600" : "border-slate-200"}`}>
              <span className="block break-words font-medium">{node.display_name || "New reviewer"}</span><span className="mt-1 block break-all text-xs text-slate-500">{node.reviewer_email || "Email required"}</span>
              <span className="mt-2 block text-xs text-slate-500">{node.visible_sections.length} visible fields · {node.metadata.required_inputs.length} reviewer inputs</span>
            </button>)}
          </div>
          <button onClick={() => onAddNode(level.id)} className="relative z-20 mt-4 rounded-lg border border-dashed border-slate-400 bg-white px-3 py-2 text-sm font-medium">+ Add reviewer</button>
        </section>)}
      </div>
      <button onClick={onAddLevel} className="mt-6 rounded-lg border border-dashed border-indigo-400 px-4 py-3 font-medium text-indigo-700">+ Add level</button>
    </div>
    {tip && createPortal(<div role="tooltip" style={{left:Math.max(8,tip.x),top:Math.max(8,tip.y)}} className="pointer-events-none fixed z-50 w-72 rounded-lg bg-slate-900 p-3 text-xs text-white shadow-lg">
      <p className="font-semibold">{tip.node.display_name}</p><p className="mt-1 break-all">{tip.node.reviewer_email || "No email"}</p>
      <p className="mt-2">Fields: {tip.node.visible_sections.join(", ") || "None"}</p>
      <p>Required: {tip.node.metadata.required_inputs.filter((f)=>f.required).map((f)=>f.label).join(", ") || "None"}</p>
      <p>Comments: {tip.node.metadata.can_view_comments ? "Visible" : "Hidden"}</p>
      <p>Return: {String(tip.node.metadata.return_target || "student")}</p>
    </div>, document.body)}
  </section>;
}
