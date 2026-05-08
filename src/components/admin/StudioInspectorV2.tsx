"use client";

import type React from "react";
import type { CatalogField, StudioEdgeAction, StudioGraphEdge, StudioGraphNode, StudioRequiredInput } from "./studioTypes";

type StudioInspectorV2Props = {
  node: StudioGraphNode | null;
  edge: StudioGraphEdge | null;
  nodes: StudioGraphNode[];
  edges: StudioGraphEdge[];
  availableFields: CatalogField[];
  validationWarnings: string[];
  onClose: () => void;
  onUpdateNode: (nodeKey: string, patch: Partial<StudioGraphNode>) => void;
  onUpdateEdge: (edgeKey: string, patch: Partial<StudioGraphEdge>) => void;
  onRemoveNode: (nodeKey: string) => void;
  onRemoveEdge: (edgeKey: string) => void;
};

const SLA_OPTIONS = [24, 48, 72, 120, 168];
const STANDARD_ACTIONS = ["approve", "flag", "request_changes", "comment"];
const FINAL_ACTIONS = ["approve", "reject", "flag", "request_changes", "comment"];

const EDGE_ACTIONS: Array<{ value: StudioEdgeAction; label: string }> = [
  { value: "always", label: "Always" },
  { value: "approve", label: "Approve" },
  { value: "reject", label: "Reject" },
  { value: "request_changes", label: "Request changes" },
  { value: "condition_true", label: "If true" },
  { value: "condition_false", label: "If false" },
];

const CONDITION_OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "greater than or equal" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "less than or equal" },
  { value: "contains", label: "contains" },
  { value: "in", label: "is one of" },
  { value: "not_in", label: "is not one of" },
  { value: "exists", label: "exists" },
  { value: "empty", label: "is empty" },
];

function graphNodeLabel(nodes: StudioGraphNode[], nodeKey: string) {
  const node = nodes.find((item) => item.node_key === nodeKey);
  if (!node) return nodeKey;
  if (node.display_name) return node.display_name;
  if (node.node_type === "start") return "Start";
  if (node.node_type === "end") return "End";
  return node.node_key;
}

function inputTypeToGraph(value: string): StudioRequiredInput["input_type"] {
  if (value === "number" || value === "select" || value === "checkbox") return value;
  return "text";
}

function conditionValueForInput(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === undefined || value === null) return "";
  return String(value);
}

function parseConditionInputValue(value: string, operator: string) {
  if (operator === "in" || operator === "not_in") {
    return value
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (["gt", "gte", "lt", "lte"].includes(operator)) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : value;
  }
  return value;
}

function getAncestors(nodeKey: string, edges: StudioGraphEdge[]) {
  const result = new Set<string>();
  const queue = [nodeKey];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    for (const parent of edges.filter((edge) => edge.to_node_key === current).map((edge) => edge.from_node_key)) {
      if (!result.has(parent)) {
        result.add(parent);
        queue.push(parent);
      }
    }
  }
  return result;
}

function upstreamInputs(nodeKey: string, nodes: StudioGraphNode[], edges: StudioGraphEdge[]) {
  const ancestors = getAncestors(nodeKey, edges);
  return Array.from(ancestors).flatMap((ancestorKey) => {
    const ancestor = nodes.find((node) => node.node_key === ancestorKey);
    if (!ancestor || ancestor.node_type !== "reviewer") return [];
    return (ancestor.metadata.required_inputs || []).map((input) => ({
      key: `${ancestor.node_key}::${input.input_key}`,
      label: input.label || "Untitled input",
      source: ancestor.display_name || ancestor.node_key,
    }));
  });
}

export default function StudioInspectorV2({
  node,
  edge,
  nodes,
  edges,
  availableFields,
  validationWarnings,
  onClose,
  onUpdateNode,
  onUpdateEdge,
  onRemoveNode,
  onRemoveEdge,
}: StudioInspectorV2Props) {
  if (edge) {
    const edgeKey = `${edge.from_node_key}->${edge.to_node_key}`;
    const action = edge.action || "always";
    const condition = (edge.condition_json || {}) as Record<string, unknown>;
    const operator = String(condition.op || "equals");
    const needsCondition = action === "condition_true" || action === "condition_false" || Boolean(edge.condition_json);
    const needsValue = needsCondition && operator !== "exists" && operator !== "empty";
    const selectedField = availableFields.find((field) => field.field_key === condition.field);

    return (
      <PanelShell title="Route" subtitle={`${graphNodeLabel(nodes, edge.from_node_key)} -> ${graphNodeLabel(nodes, edge.to_node_key)}`} onClose={onClose} onDelete={() => onRemoveEdge(edgeKey)}>
        <PanelField label="Action">
          <select
            className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
            value={action}
            onChange={(event) =>
              onUpdateEdge(edgeKey, {
                action: event.target.value as StudioEdgeAction,
                condition_json: event.target.value.startsWith("condition")
                  ? { field: condition.field || "", op: condition.op || "equals", value: condition.value ?? "" }
                  : edge.condition_json,
              })
            }
          >
            {EDGE_ACTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </PanelField>

        {needsCondition && (
          <>
            <PanelField label="Application Field">
              <select
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                value={String(condition.field || "")}
                onChange={(event) => onUpdateEdge(edgeKey, { condition_json: { ...condition, field: event.target.value, op: condition.op || "equals" } })}
              >
                <option value="">Choose a field</option>
                {availableFields.map((field) => (
                  <option key={field.field_key} value={field.field_key}>
                    {field.label}
                  </option>
                ))}
              </select>
            </PanelField>
            <PanelField label="Operator">
              <select
                className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                value={operator}
                onChange={(event) => {
                  const next: Record<string, unknown> = { ...condition, op: event.target.value };
                  if (event.target.value === "exists" || event.target.value === "empty") delete next.value;
                  onUpdateEdge(edgeKey, { condition_json: next });
                }}
              >
                {CONDITION_OPERATORS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </PanelField>
            {needsValue && (
              <PanelField label={operator === "in" || operator === "not_in" ? "Values" : "Value"}>
                <input
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                  type={["gt", "gte", "lt", "lte"].includes(operator) || selectedField?.input_type === "number" ? "number" : "text"}
                  value={conditionValueForInput(condition.value)}
                  onChange={(event) => onUpdateEdge(edgeKey, { condition_json: { ...condition, value: parseConditionInputValue(event.target.value, operator) } })}
                  placeholder={operator === "in" || operator === "not_in" ? "value 1, value 2" : "7.5"}
                />
              </PanelField>
            )}
          </>
        )}

        <PanelField label="Label">
          <input
            className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
            value={edge.label || ""}
            onChange={(event) => onUpdateEdge(edgeKey, { label: event.target.value })}
            placeholder="Optional label"
          />
        </PanelField>
      </PanelShell>
    );
  }

  if (!node) {
    return (
      <PanelShell title="Inspector" onClose={onClose}>
        <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300">touch_app</span>
          <p className="mt-4 text-sm font-bold text-slate-700">Select a node or route.</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">Reviewer permissions, SLA, visible fields, and route rules appear here.</p>
        </div>
      </PanelShell>
    );
  }

  if (node.node_type !== "reviewer") {
    const canDelete = node.node_type !== "start" && !(node.node_type === "end" && nodes.filter((item) => item.node_type === "end").length === 1);
    return (
      <PanelShell title={node.node_type.replace("_", " ")} subtitle={node.display_name || node.node_key} onClose={onClose} onDelete={canDelete ? () => onRemoveNode(node.node_key) : undefined}>
        <PanelField label="Display Name">
          <input
            className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
            value={node.display_name || ""}
            onChange={(event) => onUpdateNode(node.node_key, { display_name: event.target.value })}
          />
        </PanelField>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          {node.node_type === "conditional"
            ? "Configure true and false route rules by selecting the outgoing edges from this condition node."
            : node.node_type === "join_all"
              ? "Join All waits for every incoming branch before continuing."
              : node.node_type === "join_any"
                ? "Join Any continues when the first incoming branch completes."
                : node.node_type === "start"
                  ? "Start is the submission entry point."
                  : "End is a terminal state for the workflow."}
        </div>
      </PanelShell>
    );
  }

  const requiredInputs = node.metadata.required_inputs || [];
  const slaHours = Number(node.metadata.sla_hours || 0) || 72;
  const hasFinalAuthority = node.allowed_actions.includes("reject");
  const priorInputs = upstreamInputs(node.node_key, nodes, edges);

  return (
    <PanelShell title="Reviewer Step" subtitle={node.display_name || node.node_key} onClose={onClose} onDelete={() => onRemoveNode(node.node_key)}>
      <PanelField label="Display Name / Role">
        <input
          autoFocus
          className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
          value={node.display_name || ""}
          onChange={(event) => onUpdateNode(node.node_key, { display_name: event.target.value })}
          placeholder="HOD Approval"
        />
      </PanelField>
      <PanelField label="Reviewer Email">
        <input
          className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
          value={node.reviewer_email || ""}
          onChange={(event) => onUpdateNode(node.node_key, { reviewer_email: event.target.value })}
          placeholder="reviewer@example.edu"
          type="email"
        />
      </PanelField>

      <PanelField label="Authority Level">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onUpdateNode(node.node_key, { allowed_actions: STANDARD_ACTIONS })}
            className={`rounded-lg border px-3 py-3 text-left text-xs font-bold ${!hasFinalAuthority ? "border-primary bg-primary/10 text-primary-dark" : "border-slate-200 bg-white text-slate-600"}`}
          >
            Standard
            <span className="mt-1 block text-[11px] font-medium text-slate-500">Approve, flag, changes</span>
          </button>
          <button
            type="button"
            onClick={() => onUpdateNode(node.node_key, { allowed_actions: FINAL_ACTIONS })}
            className={`rounded-lg border px-3 py-3 text-left text-xs font-bold ${hasFinalAuthority ? "border-primary bg-primary/10 text-primary-dark" : "border-slate-200 bg-white text-slate-600"}`}
          >
            Final
            <span className="mt-1 block text-[11px] font-medium text-slate-500">Includes reject</span>
          </button>
        </div>
      </PanelField>

      <PanelField label="SLA">
        <div className="grid grid-cols-5 gap-2">
          {SLA_OPTIONS.map((hours) => (
            <button
              key={hours}
              type="button"
              onClick={() => onUpdateNode(node.node_key, { metadata: { ...node.metadata, sla_hours: hours } })}
              className={`h-9 rounded-lg border text-[11px] font-bold ${slaHours === hours ? "border-primary bg-green-50 text-primary-dark" : "border-slate-200 bg-white text-slate-600"}`}
            >
              {hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`}
            </button>
          ))}
        </div>
        <input
          className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
          type="number"
          min={1}
          value={slaHours}
          onChange={(event) => onUpdateNode(node.node_key, { metadata: { ...node.metadata, sla_hours: Number(event.target.value) || 1 } })}
        />
      </PanelField>

      <PanelField label="Visible Fields">
        <div className="flex flex-wrap gap-2">
          <ChipToggle
            label="All"
            on={node.visible_sections.includes("all")}
            onClick={() => onUpdateNode(node.node_key, { visible_sections: ["all"] })}
          />
          {availableFields.map((field) => {
            const checked = node.visible_sections.includes("all") || node.visible_sections.includes(field.field_key);
            return (
              <ChipToggle
                key={field.field_key}
                label={field.label}
                on={checked}
                onClick={() => {
                  const current = node.visible_sections.includes("all") ? availableFields.map((item) => item.field_key) : node.visible_sections;
                  const next = checked ? current.filter((key) => key !== field.field_key) : [...current, field.field_key];
                  onUpdateNode(node.node_key, { visible_sections: next.length > 0 ? next : ["all"] });
                }}
              />
            );
          })}
          {availableFields.length === 0 && <p className="text-sm text-slate-400">No form fields selected.</p>}
        </div>
      </PanelField>

      {priorInputs.length > 0 && (
        <PanelField label="Prior Step Data">
          <div className="space-y-2">
            {priorInputs.map((input) => (
              <div key={input.key} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-800">
                <span className="font-bold">{input.label}</span>
                <span className="block text-violet-500">from {input.source}</span>
              </div>
            ))}
          </div>
        </PanelField>
      )}

      <label className="mb-5 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
        Can view all comments
        <input
          type="checkbox"
          checked={Boolean(node.metadata.can_view_comments)}
          onChange={(event) => onUpdateNode(node.node_key, { metadata: { ...node.metadata, can_view_comments: event.target.checked } })}
        />
      </label>

      <PanelField
        label="Required Inputs"
        action={
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-bold text-primary-dark"
            onClick={() =>
              onUpdateNode(node.node_key, {
                metadata: {
                  ...node.metadata,
                  required_inputs: [
                    ...requiredInputs,
                    { input_key: `input_${Date.now()}`, label: "", input_type: "text", options: [], required: true },
                  ],
                },
              })
            }
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            Add
          </button>
        }
      >
        <div className="space-y-2">
          {requiredInputs.length === 0 && <p className="text-sm text-slate-400">No reviewer inputs required.</p>}
          {requiredInputs.map((input, index) => (
            <RequiredInputEditor
              key={`${input.input_key}-${index}`}
              input={input}
              onChange={(patch) => {
                const next = [...requiredInputs];
                next[index] = { ...next[index], ...patch };
                onUpdateNode(node.node_key, { metadata: { ...node.metadata, required_inputs: next } });
              }}
              onRemove={() =>
                onUpdateNode(node.node_key, {
                  metadata: { ...node.metadata, required_inputs: requiredInputs.filter((_, inputIndex) => inputIndex !== index) },
                })
              }
            />
          ))}
        </div>
      </PanelField>

      <div className="rounded-xl border border-red-100 bg-red-50 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-red-700">Validation</p>
        {validationWarnings.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-700">No validation issues.</p>
        ) : (
          <ul className="mt-2 space-y-1 pl-4 text-sm leading-5 text-red-700">
            {validationWarnings.slice(0, 5).map((warning, index) => (
              <li key={`${index}-${warning}`} className="list-disc">
                {warning}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PanelShell>
  );
}

function RequiredInputEditor({
  input,
  onChange,
  onRemove,
}: {
  input: StudioRequiredInput;
  onChange: (patch: Partial<StudioRequiredInput>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex gap-2">
        <input
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary"
          value={input.label}
          onChange={(event) => onChange({ label: event.target.value })}
          placeholder="Input label"
        />
        <button type="button" onClick={onRemove} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-500 hover:bg-red-50" aria-label="Remove input">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <select
          className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-primary"
          value={input.input_type}
          onChange={(event) => onChange({ input_type: inputTypeToGraph(event.target.value) })}
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="select">Select</option>
          <option value="checkbox">Checkbox</option>
        </select>
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600">
          <input type="checkbox" checked={input.required} onChange={(event) => onChange({ required: event.target.checked })} />
          Required
        </label>
      </div>
      {input.input_type === "select" && (
        <textarea
          rows={2}
          className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:border-primary"
          value={(input.options || []).join(", ")}
          onChange={(event) =>
            onChange({
              options: event.target.value
                .split(/[,;\n]+/)
                .map((item) => item.trim())
                .filter(Boolean),
            })
          }
          placeholder="Option A, Option B"
        />
      )}
    </div>
  );
}

function PanelShell({
  title,
  subtitle,
  onClose,
  onDelete,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  return (
    <aside className="flex h-full min-h-0 flex-col bg-white" role="region" aria-label={`${title} inspector`}>
      <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 px-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
          {subtitle && <p className="truncate text-sm font-black text-slate-900">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800" aria-label="Close inspector">
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      {onDelete && (
        <div className="flex-shrink-0 border-t border-slate-100 p-4">
          <button type="button" onClick={onDelete} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-sm font-bold text-red-600 hover:bg-red-100">
            <span className="material-symbols-outlined text-[17px]">delete</span>
            Remove
          </button>
        </div>
      )}
    </aside>
  );
}

function PanelField({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function ChipToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
        on ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}
