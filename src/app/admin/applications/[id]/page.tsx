"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type SessionUser = {
  email: string;
  role: string;
};

type StepRequiredInput = {
  input_key: string;
  input_label: string;
  input_type: "text" | "number" | "dropdown" | "multiselect";
  options?: string[];
};

type PipelineStep = {
  step_order: number;
  step_name: string;
  required_inputs: StepRequiredInput[];
};

type ReviewRecord = {
  id: number;
  reviewer_role: string;
  decision: string;
  remarks: string | null;
  created_at: string;
};

type TimelineRecord = {
  id: number;
  event_type: string;
  created_at: string;
  event_payload?: { to_stage?: string } | null;
};

type DetailPayload = {
  application: {
    id: number;
    current_step_order: number;
    current_stage_label: string;
    final_status: string | null;
    submitted_data_json: string | null;
  };
  opportunity?: { title?: string };
  student_user?: { full_name?: string };
  reviews: ReviewRecord[];
  timeline: TimelineRecord[];
  pipeline_steps: PipelineStep[];
  application_file?: Record<string, unknown>;
};

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join(", ");
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function labelFromKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function parseDraftValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (trimmed.includes(",") && !/^\d+(\.\d+)?$/.test(trimmed)) {
    return trimmed
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return value;
}

export default function AdminApplicationReviewPage() {
  const params = useParams();
  const router = useRouter();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingFile, setSavingFile] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [dynamicInputs, setDynamicInputs] = useState<Record<string, unknown>>({});
  const [targetStepOrder, setTargetStepOrder] = useState<number | null>(null);
  const [fileDraft, setFileDraft] = useState<Record<string, string>>({});

  function hydrate(detail: DetailPayload) {
    setData(detail);
    const currentStepOrder = Number(detail.application.current_step_order || 0);
    const priorSteps = detail.pipeline_steps.filter((step) => step.step_order < currentStepOrder);
    if (priorSteps.length > 0) {
      setTargetStepOrder(priorSteps[priorSteps.length - 1].step_order);
    } else if (currentStepOrder > 0) {
      setTargetStepOrder(0);
    } else {
      setTargetStepOrder(null);
    }

    const sourceFile =
      detail.application_file && typeof detail.application_file === "object"
        ? (detail.application_file as Record<string, unknown>)
        : detail.application.submitted_data_json
          ? (JSON.parse(detail.application.submitted_data_json) as Record<string, unknown>)
          : {};
    const draft: Record<string, string> = {};
    for (const [key, value] of Object.entries(sourceFile)) {
      draft[key] = Array.isArray(value) ? value.join(", ") : String(value ?? "");
    }
    setFileDraft(draft);
  }

  async function reloadDetail() {
    const detailRes = await fetch(`/api/applications/${params.id}`);
    const detail = await detailRes.json();
    hydrate(detail);
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch(`/api/applications/${params.id}`).then((r) => r.json()),
    ])
      .then(([userData, detail]) => {
        setUser(userData.user || null);
        hydrate(detail);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  const currentStep = useMemo(() => {
    if (!data) return null;
    return data.pipeline_steps.find((step) => step.step_order === data.application.current_step_order) || null;
  }, [data]);

  const requiredInputs = currentStep?.required_inputs || [];

  const priorSteps = useMemo(() => {
    if (!data) return [];
    return data.pipeline_steps.filter((step) => step.step_order < data.application.current_step_order);
  }, [data]);

  const sendBackTargets = useMemo(() => {
    if (!data || data.application.current_step_order <= 0) return [];
    return [
      { stepOrder: 0, label: "Student (Generator)" },
      ...priorSteps.map((step) => ({ stepOrder: step.step_order, label: step.step_name })),
    ];
  }, [data, priorSteps]);

  async function saveApplicationFile() {
    if (!data) return;
    setSavingFile(true);
    try {
      const submittedData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fileDraft)) {
        submittedData[key] = parseDraftValue(value);
      }

      const res = await fetch(`/api/admin/applications/${data.application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submittedData }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.detail || "Unable to save application file.");
      }
      await reloadDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to save application file.");
    } finally {
      setSavingFile(false);
    }
  }

  async function handleAction(endpoint: "approve" | "request-changes" | "reject") {
    if (!data || !user) return;
    setActionLoading(true);
    try {
      const payload: Record<string, unknown> = {
        remarks,
        reason: remarks,
        reviewerEmail: user.email,
        requiredInputs: dynamicInputs,
      };
      if (endpoint === "request-changes" && targetStepOrder !== null) {
        payload.targetStepOrder = targetStepOrder;
      }

      const res = await fetch(`/api/applications/${data.application.id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.detail || "Action failed.");
      }
      await reloadDetail();
      setRemarks("");
      setDynamicInputs({});
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="py-20 flex flex-col items-center text-slate-400">
        <span className="material-symbols-outlined animate-spin text-4xl mb-4">progress_activity</span>
      </div>
    );
  }

  const closed = Boolean(data.application.final_status);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      <div className="flex items-center justify-between gap-4">
        <div>
          <button
            onClick={() => router.push("/admin/applications")}
            className="text-sm font-bold text-slate-500 hover:text-slate-900 mb-4 inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Ledger
          </button>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            OGE Review Desk: #{data.application.id}
          </h1>
          <p className="text-slate-500 mt-1">
            {data.student_user?.full_name} • {data.opportunity?.title}
          </p>
        </div>
        <Link
          href="/admin/messages"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100"
        >
          <span className="material-symbols-outlined text-[18px]">chat</span>
          Messaging (WIP)
        </Link>
      </div>

      <Card className="bg-slate-900 text-white border-slate-800">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-300 font-semibold">Current Stage</p>
            <p className="text-lg font-black">{data.application.current_stage_label}</p>
          </div>
          {data.application.final_status ? (
            <Badge variant={data.application.final_status === "REJECTED" ? "danger" : "success"}>
              {data.application.final_status}
            </Badge>
          ) : (
            <Badge variant="info">OPEN</Badge>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Application File (Editable)" subtitle="OGE can edit submitted values directly from the ledger desk." />
        <div className="p-4 border-t border-slate-100 space-y-4">
          {Object.keys(fileDraft).length === 0 ? (
            <p className="text-sm text-slate-500">No submitted values found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(fileDraft).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{labelFromKey(key)}</label>
                  <input
                    value={value}
                    onChange={(e) => setFileDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={saveApplicationFile} loading={savingFile}>
              Save Application File
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Review Inputs and Decision" />
        <div className="p-4 border-t border-slate-100 space-y-4">
          {requiredInputs.length === 0 ? (
            <p className="text-sm text-slate-500">No required inputs configured for this stage.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requiredInputs.map((input) => (
                <Card key={input.input_key} className="border border-slate-200 shadow-none">
                  <div className="p-4">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{input.input_label}</label>
                    {(input.input_type === "text" || input.input_type === "number") && (
                      <input
                        type={input.input_type === "number" ? "number" : "text"}
                        value={String(dynamicInputs[input.input_key] || "")}
                        onChange={(e) => setDynamicInputs((prev) => ({ ...prev, [input.input_key]: e.target.value }))}
                        className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm bg-white"
                      />
                    )}
                    {input.input_type === "dropdown" && (
                      <select
                        className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm bg-white"
                        value={String(dynamicInputs[input.input_key] || "")}
                        onChange={(e) => setDynamicInputs((prev) => ({ ...prev, [input.input_key]: e.target.value }))}
                      >
                        <option value="">Select option</option>
                        {(input.options || []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    )}
                    {input.input_type === "multiselect" && (
                      <div className="border border-slate-200 rounded-lg p-2 bg-white space-y-2 max-h-32 overflow-y-auto">
                        {(input.options || []).map((option) => {
                          const selected = Array.isArray(dynamicInputs[input.input_key])
                            ? (dynamicInputs[input.input_key] as string[])
                            : [];
                          const checked = selected.includes(option);
                          return (
                            <label key={option} className="flex items-center gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const current = Array.isArray(dynamicInputs[input.input_key])
                                    ? [...(dynamicInputs[input.input_key] as string[])]
                                    : [];
                                  const next = e.target.checked
                                    ? [...current, option]
                                    : current.filter((entry) => entry !== option);
                                  setDynamicInputs((prev) => ({ ...prev, [input.input_key]: next }));
                                }}
                              />
                              {option}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Overall Reviewer Comment</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white"
            />
          </div>

          <div className="flex flex-wrap items-end gap-4">
            {sendBackTargets.length > 0 && (
              <div className="w-72">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Send Back To</label>
                <select
                  className="w-full h-11 border border-slate-200 rounded-xl px-3 text-sm bg-white"
                  value={targetStepOrder ?? ""}
                  onChange={(e) => setTargetStepOrder(Number(e.target.value))}
                >
                  {sendBackTargets.map((target) => (
                    <option key={target.stepOrder} value={target.stepOrder}>
                      {target.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button variant="danger" size="md" loading={actionLoading} disabled={closed || !remarks} onClick={() => handleAction("reject")}>
              Reject
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon="flag"
              loading={actionLoading}
              disabled={closed || !remarks || targetStepOrder === null}
              onClick={() => handleAction("request-changes")}
            >
              Request Changes
            </Button>
            <Button variant="primary" size="md" icon="check_circle" loading={actionLoading} disabled={closed} onClick={() => handleAction("approve")}>
              Approve and Forward
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Timeline" />
          <div className="p-4 border-t border-slate-100 space-y-4">
            {data.timeline.length === 0 && <p className="text-sm text-slate-500">No events recorded yet.</p>}
            {data.timeline.map((event, index) => (
              <div key={event.id} className="relative pl-7 pb-2">
                {index < data.timeline.length - 1 && <div className="absolute left-[7px] top-5 h-[calc(100%-0.2rem)] w-0.5 bg-slate-200" />}
                <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-primary bg-white" />
                <p className="text-sm font-semibold text-slate-900">{event.event_type.replace(/_/g, " ")}</p>
                <p className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</p>
                {event.event_payload?.to_stage && (
                  <Badge variant="neutral" className="mt-2 text-[10px]">
                    {event.event_payload.to_stage}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Review History" />
          <div className="space-y-4 p-4 border-t border-slate-100">
            {data.reviews.length === 0 && <p className="text-slate-400 italic text-sm">No review entries yet.</p>}
            {data.reviews.map((review) => (
              <div key={review.id} className="pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                <p className="text-sm font-bold text-slate-900">{review.reviewer_role}</p>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mt-1">{review.decision}</p>
                <p className="text-sm text-slate-700 mt-2">{review.remarks || "No remarks."}</p>
                <p className="text-[10px] text-slate-400 font-bold tracking-wider mt-2 uppercase">
                  {new Date(review.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
