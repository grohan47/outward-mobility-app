"use client";
import { useEffect, useRef } from "react";
import type { CatalogField, StudioGraphNode, StudioRequiredInput } from "./studioTypes";
import { id, type ReviewLevel } from "./levels";

export default function StudioInspector({ node, levels, fields, onUpdate, onRemove, onClose }: {
  node: StudioGraphNode; levels: ReviewLevel[]; fields: CatalogField[];
  onUpdate: (node: StudioGraphNode) => void; onRemove: () => void; onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [node.node_key]);
  const index = levels.findIndex((l) => l.reviewers.some((n) => n.node_key === node.node_key));
  const outputFields = levels
    .slice(0, Math.max(0, index))
    .flatMap((level) => level.reviewers)
    .flatMap((reviewer) => reviewer.metadata.required_inputs.map((field) => ({ key: field.input_key, label: `${reviewer.display_name}: ${field.label}` })));
  const options = [...fields.map((f)=>({key:f.field_key,label:f.label})), ...outputFields];
  const returnRuleOptions = [
    ...options,
    ...node.metadata.required_inputs.map((field) => ({ key: field.input_key, label: `This reviewer: ${field.label}` })),
  ].filter((field, position, all) => all.findIndex((candidate) => candidate.key === field.key) === position);
  const patch = (value: Partial<StudioGraphNode>) => onUpdate({...node,...value});
  const metadata = (value: Record<string, unknown>) => patch({metadata:{...node.metadata,...value}});
  const updateInput = (key: string, value: Partial<StudioRequiredInput>) => metadata({required_inputs:node.metadata.required_inputs.map((f)=>f.input_key===key?{...f,...value}:f)});
  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm";
  const rule = node.metadata.return_rule as {field:string; value:string; target:string} | undefined;
  return <aside role="dialog" aria-labelledby="reviewer-settings-heading" onKeyDown={(e)=>{if(e.key==="Escape")onClose();}} className="fixed inset-x-2 bottom-2 top-20 z-40 overflow-auto rounded-xl border bg-white p-5 shadow-xl lg:sticky lg:inset-auto lg:top-20 lg:max-h-[calc(100vh-100px)] lg:shadow-none">
    <div className="mb-5 flex justify-between gap-2"><h2 ref={heading} tabIndex={-1} id="reviewer-settings-heading" className="font-semibold">Reviewer settings</h2><button onClick={onClose} aria-label="Close reviewer settings">✕</button></div>
    <div className="space-y-5">
      <label className="block text-sm">Name<input className={inputClass} value={node.display_name || ""} onChange={(e)=>patch({display_name:e.target.value})}/></label>
      <label className="block text-sm">Email<input type="email" className={inputClass} value={node.reviewer_email || ""} onChange={(e)=>patch({reviewer_email:e.target.value})}/></label>
      <fieldset><legend className="text-sm font-semibold">Visible student and reviewer fields</legend><p className="my-2 text-xs text-slate-500">Only selected fields are sent to this reviewer. Later outputs become available only after those reviews.</p>
        <div className="max-h-48 space-y-2 overflow-auto rounded border p-2">{options.map((f)=><label key={f.key} className="flex gap-2 text-sm"><input type="checkbox" checked={node.visible_sections.includes(f.key)} onChange={(e)=>patch({visible_sections:e.target.checked?[...node.visible_sections,f.key]:node.visible_sections.filter((k)=>k!==f.key)})}/>{f.label}</label>)}</div>
      </fieldset>
      <fieldset><legend className="text-sm font-semibold">Allowed actions</legend><div className="mt-2 flex flex-wrap gap-3">{["approve","request_changes","reject","comment"].map((action)=><label key={action} className="flex gap-1 text-xs"><input type="checkbox" checked={node.allowed_actions.includes(action)} onChange={(e)=>patch({allowed_actions:e.target.checked?[...node.allowed_actions,action]:node.allowed_actions.filter((a)=>a!==action)})}/>{action.replaceAll("_"," ")}</label>)}</div></fieldset>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={!!node.metadata.can_view_comments} onChange={(e)=>metadata({can_view_comments:e.target.checked})}/>Can read internal reviewer comments</label>
      <label className="block text-sm">Review deadline (hours)<input type="number" min={1} max={720} className={inputClass} value={node.metadata.sla_hours || 72} onChange={(e)=>metadata({sla_hours:Number(e.target.value)})}/></label>
      <label className="block text-sm">When this reviewer requests changes<select className={inputClass} value={String(node.metadata.return_target || "student")} onChange={(e)=>metadata({return_target:e.target.value})}><option value="student">Return to student</option>{levels.slice(0,index).map((l)=><option key={l.id} value={l.id}>Return to {l.name}</option>)}</select></label>
      <fieldset><legend className="text-sm font-semibold">Fields this reviewer adds</legend>
        {node.metadata.required_inputs.map((f)=><div key={f.input_key} className="mt-3 space-y-2 rounded-lg border p-3">
          <label className="block text-xs">Label<input className={inputClass} value={f.label} onChange={(e)=>updateInput(f.input_key,{label:e.target.value})}/></label>
          <label className="block text-xs">Type<select className={inputClass} value={f.input_type} onChange={(e)=>updateInput(f.input_key,{input_type:e.target.value as StudioRequiredInput["input_type"]})}><option value="text">Text</option><option value="number">Number</option><option value="select">Select one</option><option value="checkbox">Yes / no</option></select></label>
          {f.input_type==="select"&&<label className="block text-xs">Options, separated by commas<input className={inputClass} value={f.options.join(", ")} onChange={(e)=>updateInput(f.input_key,{options:e.target.value.split(",").map((s)=>s.trim())})}/></label>}
          <label className="flex gap-2 text-xs"><input type="checkbox" checked={f.required} onChange={(e)=>updateInput(f.input_key,{required:e.target.checked})}/>Required for approval</label>
          <label className="flex gap-2 text-xs"><input type="checkbox" checked={(node.metadata.student_visible_fields ?? []).includes(f.input_key)} onChange={(e)=>metadata({student_visible_fields:e.target.checked?[...(node.metadata.student_visible_fields ?? []),f.input_key]:(node.metadata.student_visible_fields ?? []).filter((key)=>key!==f.input_key)})}/>Visible to the student after review</label>
          <button className="text-xs text-red-700" onClick={()=>metadata({required_inputs:node.metadata.required_inputs.filter((i)=>i.input_key!==f.input_key),student_visible_fields:(node.metadata.student_visible_fields ?? []).filter((key)=>key!==f.input_key)})}>Remove field</button>
        </div>)}
        <button className="mt-3 text-sm font-medium text-indigo-700" onClick={()=>metadata({required_inputs:[...node.metadata.required_inputs,{input_key:id("field"),label:"New field",input_type:"text",required:true,options:[]}]})}>+ Add reviewer field</button>
      </fieldset>
      <fieldset><legend className="text-sm font-semibold">Automatic return after this level</legend><label className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={!!rule} onChange={(e)=>metadata({return_rule:e.target.checked?{field:"",value:"",target:"student"}:null})}/>Return when a field equals a value</label>
        {rule&&<div className="space-y-2"><label className="block text-xs">Field<select className={inputClass} value={rule.field} onChange={(e)=>metadata({return_rule:{...rule,field:e.target.value}})}><option value="">Choose field</option>{returnRuleOptions.map((f)=><option key={f.key} value={f.key}>{f.label}</option>)}</select></label><label className="block text-xs">Equals<input className={inputClass} value={rule.value} onChange={(e)=>metadata({return_rule:{...rule,value:e.target.value}})}/></label><label className="block text-xs">Return destination<select className={inputClass} value={rule.target} onChange={(e)=>metadata({return_rule:{...rule,target:e.target.value}})}><option value="student">Student</option>{levels.slice(0,index).map((l)=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label></div>}
      </fieldset>
      <button className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700" onClick={onRemove}>Remove reviewer</button>
    </div>
  </aside>;
}
