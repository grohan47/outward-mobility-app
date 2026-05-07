"use client";

import { Icon } from "@/components/ui/Icon";
import type { CatalogField, StudioEdgeAction, StudioGraphEdge, StudioGraphNode, StudioRequiredInput } from "./studioTypes";
import { SLAChip } from "./StudioGraph";

type StudioInspectorProps = {
  node: StudioGraphNode | null;
  edge: StudioGraphEdge | null;
  nodes: StudioGraphNode[];
  availableFields: CatalogField[];
  validationWarnings: string[];
  onClose: () => void;
  onUpdateNode: (nodeKey: string, patch: Partial<StudioGraphNode>) => void;
  onUpdateEdge: (edgeKey: string, patch: Partial<StudioGraphEdge>) => void;
  onRemoveNode: (nodeKey: string) => void;
};

const SLA_OPTIONS = [
  { label: "24h", value: 24 },
  { label: "48h", value: 48 },
  { label: "72h", value: 72 },
  { label: "5d", value: 120 },
  { label: "7d", value: 168 },
];

const EDGE_ACTION_OPTIONS: Array<{ value: StudioEdgeAction; label: string; hint: string }> = [
  { value: "always", label: "Always move forward", hint: "Use for start, merge, and normal connector routes." },
  { value: "approve", label: "If reviewer approves", hint: "This edge runs after an approve decision." },
  { value: "reject", label: "If reviewer rejects", hint: "This edge runs after a reject decision." },
  { value: "request_changes", label: "If reviewer requests changes", hint: "Overrides the default Student Rework return." },
  { value: "condition_true", label: "If condition is true", hint: "Runs when the application field rule matches." },
  { value: "condition_false", label: "If condition is false / else", hint: "Runs when the same application field rule does not match." },
];

const CONDITION_OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "greater than or equal" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "less than or equal" },
  { value: "in", label: "is one of" },
  { value: "not_in", label: "is not one of" },
  { value: "contains", label: "contains" },
  { value: "exists", label: "is present" },
  { value: "empty", label: "is empty" },
];

function inputTypeToGraph(value: string): StudioRequiredInput["input_type"] {
  if (value === "number" || value === "select" || value === "checkbox") return value;
  return "text";
}

export default function StudioInspector({
  node,
  edge,
  nodes,
  availableFields,
  validationWarnings,
  onClose,
  onUpdateNode,
  onUpdateEdge,
  onRemoveNode,
}: StudioInspectorProps) {
  if (edge) {
    const edgeKey = `${edge.from_node_key}->${edge.to_node_key}`;
    const condition = (edge.condition_json || {}) as Record<string, unknown>;
    const action = edge.action || "always";
    const selectedOperator = String(condition.op || "equals");
    const selectedField = availableFields.find((field) => field.field_key === condition.field);
    const needsCondition = action === "condition_true" || action === "condition_false" || Boolean(edge.condition_json);
    const needsValue = needsCondition && selectedOperator !== "exists" && selectedOperator !== "empty";
    const fromLabel = graphNodeLabel(nodes, edge.from_node_key);
    const toLabel = graphNodeLabel(nodes, edge.to_node_key);

    return (
      <aside className="flex h-full flex-col border-l border-slate-200 bg-white" role="region" aria-label="Condition configuration">
        <PanelHeader title="Route Rule" onClose={onClose} />
        <div className="space-y-5 overflow-y-auto p-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Route Destination</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              From <span className="font-semibold text-slate-900">{fromLabel}</span> to{" "}
              <span className="font-semibold text-slate-900">{toLabel}</span>.
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              This is the stakeholder/task the application moves to when the route condition below is satisfied.
            </p>
          </div>

          <FieldLabel label="When Should This Route Run?">
            <select
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-primary"
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
              {EDGE_ACTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FieldLabel>

          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
            {EDGE_ACTION_OPTIONS.find((option) => option.value === action)?.hint}
          </div>

          {needsCondition && (
            <>
              <FieldLabel label="Application Field">
                <select
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-primary"
                  value={String(condition.field || "")}
                  onChange={(event) =>
                    onUpdateEdge(edgeKey, {
                      condition_json: { ...condition, field: event.target.value, op: condition.op || "equals" },
                    })
                  }
                >
                  <option value="">Choose a field</option>
                  {availableFields.map((field) => (
                    <option key={field.field_key} value={field.field_key}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              <FieldLabel label="Operator">
                <select
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-primary"
                  value={selectedOperator}
                  onChange={(event) => {
                    const op = event.target.value;
                    const next: Record<string, unknown> = { ...condition, op };
                    if (op === "exists" || op === "empty") {
                      delete next.value;
                    }
                    onUpdateEdge(edgeKey, { condition_json: next });
                  }}
                >
                  {CONDITION_OPERATORS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              {needsValue && (
                <FieldLabel label={selectedOperator === "in" || selectedOperator === "not_in" ? "Values" : "Value"}>
                  <input
                    type={["gt", "gte", "lt", "lte"].includes(selectedOperator) || selectedField?.input_type === "number" ? "number" : "text"}
                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-700 outline-none focus:border-primary"
                    value={conditionValueForInput(condition.value)}
                    onChange={(event) =>
                      onUpdateEdge(edgeKey, {
                        condition_json: {
                          ...condition,
                          value: parseConditionInputValue(event.target.value, selectedOperator),
                        },
                      })
                    }
                    placeholder={selectedOperator === "in" || selectedOperator === "not_in" ? "value 1, value 2" : "200000"}
                  />
                </FieldLabel>
              )}
            </>
          )}

          <FieldLabel label="Graph Label">
            <input
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-700 outline-none focus:border-primary"
              value={edge.label || ""}
              onChange={(event) => onUpdateEdge(edgeKey, { label: event.target.value })}
              placeholder={action === "approve" ? `Approve to ${toLabel}` : action === "reject" ? `Reject to ${toLabel}` : "Scholarship track"}
            />
          </FieldLabel>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">
            Conditions are stored as structured PRISM rules. Arbitrary code is never executed at runtime, and approve/reject routes only run for their matching reviewer decision.
          </div>
        </div>
      </aside>
    );
  }

  if (!node) {
    return (
      <aside className="flex h-full flex-col border-l border-slate-200 bg-white" role="region" aria-label="Node configuration">
        <PanelHeader title="Reviewer Node" onClose={onClose} />
        <div className="flex min-h-[420px] flex-1 flex-col items-center justify-center px-8 text-center">
          <Icon name="touch_app" className="h-10 w-10 text-slate-300" />
          <p className="mt-4 text-sm font-semibold text-slate-700">Select a node on the graph to configure it.</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">Reviewer email, SLA, visible fields, and reviewer inputs all appear here.</p>
        </div>
      </aside>
    );
  }

  if (node.node_type !== "reviewer") {
    return (
      <aside className="flex h-full flex-col border-l border-slate-200 bg-white" role="region" aria-label="Node configuration">
        <PanelHeader title={`${node.node_type.replace("_", " ")} node`} onClose={onClose} />
        <div className="p-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">{node.display_name || node.node_key}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Connector nodes shape the workflow path. Reviewer configuration remains on reviewer nodes.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  const slaHours = Number(node.metadata?.sla_hours || 0) || undefined;
  const requiredInputs = node.metadata?.required_inputs || [];
  const customSla = slaHours && !SLA_OPTIONS.some((option) => option.value === slaHours);

  return (
    <aside className="flex h-full flex-col border-l border-slate-200 bg-white" role="region" aria-label="Node configuration">
      <PanelHeader title="Reviewer Node" onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="space-y-8">
          <FieldLabel label="Reviewer Email">
            <input
              autoFocus
              type="email"
              className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm text-slate-700 outline-none focus:border-primary"
              value={node.reviewer_email || ""}
              onChange={(event) => onUpdateNode(node.node_key, { reviewer_email: event.target.value })}
              placeholder="Enter email address"
            />
          </FieldLabel>

          <FieldLabel label="Display Name / Role">
            <input
              className="h-11 w-full rounded-lg border border-slate-300 px-4 text-sm text-slate-700 outline-none focus:border-primary"
              value={node.display_name || ""}
              onChange={(event) => onUpdateNode(node.node_key, { display_name: event.target.value })}
              placeholder="Configure this reviewer"
            />
          </FieldLabel>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">SLA-Response Window</p>
              <SLAChip hours={slaHours} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {SLA_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onUpdateNode(node.node_key, { metadata: { ...node.metadata, sla_hours: option.value } })}
                  className={`h-10 rounded-lg border text-[11px] font-semibold transition ${
                    slaHours === option.value
                      ? "border-primary bg-green-50 text-primary"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onUpdateNode(node.node_key, { metadata: { ...node.metadata, sla_hours: slaHours || 96 } })}
                className={`col-span-3 h-10 rounded-lg border text-[11px] font-semibold transition ${
                  customSla
                    ? "border-primary bg-green-50 text-primary"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Custom
              </button>
            </div>
            {customSla && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  className="h-11 w-28 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-primary"
                  value={slaHours}
                  onChange={(event) =>
                    onUpdateNode(node.node_key, { metadata: { ...node.metadata, sla_hours: Number(event.target.value) || 1 } })
                  }
                />
                <span className="text-sm text-slate-500">hours</span>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Visible Fields at this Stage</p>
            <div className="flex flex-wrap gap-2">
              {availableFields.map((field) => {
                const checked =
                  node.visible_sections.includes(field.field_key) || node.visible_sections.includes("all");
                return (
                  <button
                    key={field.field_key}
                    type="button"
                    onClick={() => {
                      const current = node.visible_sections.includes("all")
                        ? availableFields.map((item) => item.field_key)
                        : node.visible_sections;
                      const next = checked
                        ? current.filter((key) => key !== field.field_key)
                        : [...current, field.field_key];
                      onUpdateNode(node.node_key, { visible_sections: next });
                    }}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                      checked
                        ? "border-primary bg-primary text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {field.label}
                  </button>
                );
              })}
              {availableFields.length === 0 && <p className="text-sm text-slate-400">No application fields selected yet.</p>}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Reviewer Inputs</p>
              <button
                type="button"
                onClick={() =>
                  onUpdateNode(node.node_key, {
                    metadata: {
                      ...node.metadata,
                      required_inputs: [
                        ...requiredInputs,
                        {
                          input_key: `input_${Date.now()}`,
                          label: "New reviewer input",
                          input_type: "text",
                          options: [],
                          required: true,
                        },
                      ],
                    },
                  })
                }
                className="text-xs font-bold text-primary"
              >
                + Add Input
              </button>
            </div>

            <div className="space-y-3">
              {requiredInputs.length === 0 && (
                <p className="text-sm text-slate-400">No required inputs configured for this reviewer.</p>
              )}
              {requiredInputs.map((input, index) => (
                <div key={`${input.input_key}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <input
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary"
                    value={input.label}
                    onChange={(event) =>
                      updateRequiredInput(node, index, { label: event.target.value }, onUpdateNode)
                    }
                  />
                  <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
                    <select
                      className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary"
                      value={input.input_type}
                      onChange={(event) =>
                        updateRequiredInput(node, index, { input_type: inputTypeToGraph(event.target.value) }, onUpdateNode)
                      }
                    >
                      <option value="text">text</option>
                      <option value="number">number</option>
                      <option value="select">select</option>
                      <option value="checkbox">checkbox</option>
                    </select>
                    <label className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={input.required}
                        onChange={(event) =>
                          updateRequiredInput(node, index, { required: event.target.checked }, onUpdateNode)
                        }
                      />
                      required
                    </label>
                    <button
                      type="button"
                      onClick={() => removeRequiredInput(node, index, onUpdateNode)}
                      className="rounded-lg border border-red-200 bg-white px-3 text-red-500 hover:bg-red-50"
                    >
                      <Icon name="close" className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                  {input.input_type === "select" && (
                    <textarea
                      rows={2}
                      className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:border-primary"
                      value={(input.options || []).join(", ")}
                      onChange={(event) =>
                        updateRequiredInput(
                          node,
                          index,
                          {
                            options: event.target.value
                              .split(/[,;\n]+/)
                              .map((item) => item.trim())
                              .filter(Boolean),
                          },
                          onUpdateNode
                        )
                      }
                      placeholder="Options separated by commas or new lines"
                    />
                  )}
                </div>
              ))}
            </div>
          </section>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              checked={Boolean(node.metadata?.can_view_comments)}
              onChange={(event) =>
                onUpdateNode(node.node_key, { metadata: { ...node.metadata, can_view_comments: event.target.checked } })
              }
            />
            Allow this reviewer to see full review comments
          </label>

          <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lane F reserved settings</p>
            <p className="text-slate-400">Reminders - coming in SLA management</p>
            <p className="text-slate-400">Escalation - coming in SLA management</p>
          </div>

          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-red-700">Validation Status</h4>
            {validationWarnings.length === 0 ? (
              <p className="mt-2 text-sm text-emerald-700">No validation issues.</p>
            ) : (
              <ul className="mt-3 space-y-2 pl-4 text-sm leading-5 text-red-600">
                {validationWarnings.slice(0, 5).map((warning, index) => (
                  <li key={`${index}-${warning}`} className="list-disc">
                    {warning}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 p-5">
        <button
          type="button"
          onClick={() => onRemoveNode(node.node_key)}
          className="w-full rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-500 transition hover:bg-red-50"
        >
          Remove reviewer node
        </button>
      </div>
    </aside>
  );
}

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
      <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{title}</h2>
      <button type="button" onClick={onClose} className="text-[11px] font-semibold text-slate-400 hover:text-slate-600">
        close
      </button>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function graphNodeLabel(nodes: StudioGraphNode[], nodeKey: string) {
  const node = nodes.find((item) => item.node_key === nodeKey);
  if (!node) return nodeKey;
  if (node.display_name) return node.display_name;
  if (node.node_type === "start") return "Start";
  if (node.node_type === "end") return "End";
  return node.node_key;
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

function updateRequiredInput(
  node: StudioGraphNode,
  index: number,
  patch: Partial<StudioRequiredInput>,
  onUpdateNode: (nodeKey: string, patch: Partial<StudioGraphNode>) => void
) {
  const next = [...(node.metadata.required_inputs || [])];
  next[index] = { ...next[index], ...patch };
  onUpdateNode(node.node_key, { metadata: { ...node.metadata, required_inputs: next } });
}

function removeRequiredInput(
  node: StudioGraphNode,
  index: number,
  onUpdateNode: (nodeKey: string, patch: Partial<StudioGraphNode>) => void
) {
  const next = (node.metadata.required_inputs || []).filter((_, inputIndex) => inputIndex !== index);
  onUpdateNode(node.node_key, { metadata: { ...node.metadata, required_inputs: next } });
}
