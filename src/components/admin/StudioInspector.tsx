"use client";

import type { CatalogField, StudioGraphEdge, StudioGraphNode, StudioRequiredInput } from "./studioTypes";
import { SLAChip } from "./StudioGraph";

type StudioInspectorProps = {
  node: StudioGraphNode | null;
  edge: StudioGraphEdge | null;
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

function inputTypeToGraph(value: string): StudioRequiredInput["input_type"] {
  if (value === "number" || value === "select" || value === "checkbox") return value;
  return "text";
}

export default function StudioInspector({
  node,
  edge,
  availableFields,
  validationWarnings,
  onClose,
  onUpdateNode,
  onUpdateEdge,
  onRemoveNode,
}: StudioInspectorProps) {
  if (edge) {
    const edgeKey = `${edge.from_node_key}->${edge.to_node_key}`;
    const condition = (edge.condition_json || {}) as Record<string, string>;
    return (
      <aside className="h-full overflow-y-auto border-l border-slate-200 bg-white p-4" role="region" aria-label="Condition configuration">
        <PanelHeader title="Condition Rule" onClose={onClose} />
        <div className="space-y-4">
          <FieldLabel label="Field">
            <select
              className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
              value={condition.field || ""}
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
              className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
              value={condition.op || "equals"}
              onChange={(event) => onUpdateEdge(edgeKey, { condition_json: { ...condition, op: event.target.value } })}
            >
              <option value="equals">equals</option>
              <option value="in">is one of</option>
              <option value="gt">greater than</option>
              <option value="lt">less than</option>
              <option value="exists">is present</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Value">
            <input
              className="w-full rounded-lg border border-slate-200 p-2 text-sm"
              value={condition.value || ""}
              onChange={(event) => onUpdateEdge(edgeKey, { condition_json: { ...condition, value: event.target.value } })}
            />
          </FieldLabel>
          <FieldLabel label="Label shown on graph edge">
            <input
              className="w-full rounded-lg border border-slate-200 p-2 text-sm"
              value={edge.label || ""}
              onChange={(event) => onUpdateEdge(edgeKey, { label: event.target.value })}
              placeholder="Scholarship track"
            />
          </FieldLabel>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
            Conditions are saved as inspectable PRISM rules. Arbitrary code is never executed.
          </div>
        </div>
      </aside>
    );
  }

  if (!node) {
    return (
      <aside className="h-full overflow-y-auto border-l border-slate-200 bg-white p-5" role="region" aria-label="Node configuration">
        <div className="flex h-full min-h-[360px] flex-col justify-center text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300">touch_app</span>
          <p className="mt-3 text-sm font-semibold text-slate-700">Select a node on the canvas to configure it.</p>
          <div className="mt-6 rounded-lg bg-slate-50 p-4 text-left text-sm text-slate-500">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Node types</p>
            <p>Reviewer - single approver</p>
            <p>Parallel - runs simultaneously</p>
            <p>Condition - branches on data</p>
          </div>
        </div>
      </aside>
    );
  }

  if (node.node_type !== "reviewer") {
    return (
      <aside className="h-full overflow-y-auto border-l border-slate-200 bg-white p-4" role="region" aria-label="Node configuration">
        <PanelHeader title={`${node.node_type.replace("_", " ")} node`} onClose={onClose} />
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">{node.display_name || node.node_key}</p>
          <p className="mt-1 text-sm text-slate-500">Connector nodes are visual workflow structure. Reviewer settings live on reviewer nodes.</p>
        </div>
      </aside>
    );
  }

  const slaHours = Number(node.metadata?.sla_hours || 0) || undefined;
  const requiredInputs = node.metadata?.required_inputs || [];
  const customSla = slaHours && !SLA_OPTIONS.some((option) => option.value === slaHours);

  return (
    <aside className="h-full overflow-y-auto border-l border-slate-200 bg-white p-4" role="region" aria-label="Node configuration">
      <PanelHeader title="Reviewer Node" onClose={onClose} />
      <div className="space-y-5">
        <FieldLabel label="Reviewer email">
          <input
            autoFocus
            type="email"
            className="w-full rounded-lg border border-slate-200 p-2 text-sm"
            value={node.reviewer_email || ""}
            onChange={(event) => onUpdateNode(node.node_key, { reviewer_email: event.target.value })}
          />
        </FieldLabel>
        <FieldLabel label="Display name / Role">
          <input
            className="w-full rounded-lg border border-slate-200 p-2 text-sm"
            value={node.display_name || ""}
            onChange={(event) => onUpdateNode(node.node_key, { display_name: event.target.value })}
          />
        </FieldLabel>

        <section className={!slaHours ? "rounded-lg border border-amber-200 bg-amber-50/40 p-3" : ""}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">SLA - Response window</p>
            <SLAChip hours={slaHours} />
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
            {SLA_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onUpdateNode(node.node_key, { metadata: { ...node.metadata, sla_hours: option.value } })}
                className={`min-h-[36px] rounded-md px-3 text-sm font-medium ${
                  slaHours === option.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onUpdateNode(node.node_key, { metadata: { ...node.metadata, sla_hours: slaHours || 96 } })}
              className={`min-h-[36px] rounded-md px-3 text-sm font-medium ${customSla ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              Custom
            </button>
          </div>
          {customSla && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                className="w-24 rounded-lg border border-slate-200 p-2 text-sm"
                value={slaHours}
                onChange={(event) => onUpdateNode(node.node_key, { metadata: { ...node.metadata, sla_hours: Number(event.target.value) || 1 } })}
              />
              <span className="text-sm text-slate-500">hours</span>
            </div>
          )}
        </section>

        <FieldLabel label="Visible fields at this stage">
          <div className="flex flex-wrap gap-2">
            {availableFields.map((field) => {
              const checked = node.visible_sections.includes(field.field_key) || node.visible_sections.includes("all");
              return (
                <button
                  key={field.field_key}
                  type="button"
                  onClick={() => {
                    const current = node.visible_sections.includes("all") ? availableFields.map((item) => item.field_key) : node.visible_sections;
                    const next = checked ? current.filter((key) => key !== field.field_key) : [...current, field.field_key];
                    onUpdateNode(node.node_key, { visible_sections: next });
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    checked ? "border-primary bg-primary text-white" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {field.label}
                </button>
              );
            })}
          </div>
        </FieldLabel>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Required inputs from this reviewer</p>
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
              className="text-xs font-semibold text-primary-dark"
            >
              + Add Input
            </button>
          </div>
          <div className="space-y-2">
            {requiredInputs.length === 0 && <p className="text-sm text-slate-400">No required reviewer inputs.</p>}
            {requiredInputs.map((input, index) => (
              <div key={`${input.input_key}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input
                  className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm"
                  value={input.label}
                  onChange={(event) => updateRequiredInput(node, index, { label: event.target.value }, onUpdateNode)}
                />
                <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-2">
                  <select
                    className="rounded-md border border-slate-200 bg-white p-2 text-sm"
                    value={input.input_type}
                    onChange={(event) => updateRequiredInput(node, index, { input_type: inputTypeToGraph(event.target.value) }, onUpdateNode)}
                  >
                    <option value="text">text</option>
                    <option value="number">number</option>
                    <option value="select">select</option>
                    <option value="checkbox">checkbox</option>
                  </select>
                  <label className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={input.required}
                      onChange={(event) => updateRequiredInput(node, index, { required: event.target.checked }, onUpdateNode)}
                    />
                    required
                  </label>
                  <button type="button" onClick={() => removeRequiredInput(node, index, onUpdateNode)} className="rounded-md p-2 text-red-500 hover:bg-red-50">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <input
            type="checkbox"
            checked={Boolean(node.metadata?.can_view_comments)}
            onChange={(event) => onUpdateNode(node.node_key, { metadata: { ...node.metadata, can_view_comments: event.target.checked } })}
          />
          Allow this reviewer to see full review comments
        </label>

        <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lane F reserved settings</p>
          <p className="text-slate-400">Reminders - coming in SLA management</p>
          <p className="text-slate-400">Escalation - coming in SLA management</p>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Validation status</p>
          {validationWarnings.length === 0 ? (
            <p className="mt-1 text-sm font-medium text-emerald-700">No issues</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-red-700">
              {validationWarnings.slice(0, 3).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => onRemoveNode(node.node_key)}
          className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          Remove reviewer node
        </button>
      </div>
    </aside>
  );
}

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
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
