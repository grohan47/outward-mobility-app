"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApplicationChatWidget } from "@/components/application/ApplicationChatWidget";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import type { ApplicationDetailPayload, FieldValue, ReviewerRequiredInput } from "@/lib/types";

function formatValue(value: FieldValue | undefined): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function labelFromKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function requiredInputLabel(input: ReviewerRequiredInput): string {
  return input.input_label || input.label || labelFromKey(input.input_key);
}

function normalizedInputType(input: ReviewerRequiredInput) {
  return input.input_type === "select" || input.input_type === "single_select" ? "dropdown" : input.input_type;
}

function isRequired(input: ReviewerRequiredInput): boolean {
  return input.required === true || input.is_required === 1;
}

export default function ReviewerApplicationDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ApplicationDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [dynamicInputs, setDynamicInputs] = useState<Record<string, FieldValue>>({});

  useEffect(() => {
    fetch(`/api/applications/${params.id}`)
      .then(async (response) => {
        const payload: ApplicationDetailPayload & { detail?: string } = await response.json();
        if (!response.ok) throw new Error(payload.detail || "Unable to load this review.");
        setData(payload);
      })
      .catch((reason: unknown) => {
        setLoadError(reason instanceof Error ? reason.message : "Unable to load this review.");
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center py-20 text-slate-400">
        <span className="material-symbols-outlined mb-4 animate-spin text-4xl">progress_activity</span>
        <p>Loading review...</p>
      </div>
    );
  }

  if (!data || loadError || !data.graph_node_info) {
    return (
      <Card className="border-red-200 bg-red-50 py-20 text-center text-red-600">
        <p className="font-bold">{loadError || "This review task is no longer available."}</p>
      </Card>
    );
  }

  const application = data.application;
  const graphNode = data.graph_node_info;
  const visibleEntries = Object.entries(data.application_file || {});
  const fieldLabels = data.field_labels || {};
  const allowedActions = new Set(graphNode.allowed_actions);
  const canViewComments = Boolean(data.permissions?.can_view_comments);
  const applicantName = data.student_user?.full_name || "Applicant";

  async function handleAction(endpoint: "approve" | "request-changes" | "reject") {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/applications/${application.id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remarks: remarks.trim() || null,
          reason: remarks.trim() || null,
          requiredInputs: dynamicInputs,
        }),
      });
      const payload: { detail?: string } = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Unable to record this decision.");
      router.push("/reviewer");
      router.refresh();
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Unable to record this decision.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24">
      <div className="mb-8">
        <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-900">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Inbox
        </button>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Application #{application.id} <span className="text-slate-400">· {applicantName}</span></h1>
        <p className="mt-1 text-slate-500">{data.opportunity?.title}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        <aside className="space-y-6">
          <Card className="border-slate-200 bg-slate-50 shadow-none">
            <div className="flex flex-col items-center border-b border-slate-200 pb-6 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-2xl font-black text-primary-dark">
                {applicantName.split(" ").map((part) => part[0]).join("").slice(0, 2)}
              </div>
              <h2 className="text-lg font-bold text-slate-900">{applicantName}</h2>
              {data.student_profile?.student_id && <p className="text-sm font-semibold text-slate-500">{data.student_profile.student_id}</p>}
            </div>
            <div className="space-y-3 pt-6 text-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Attempt</p>
              <p className="font-semibold text-slate-800">{application.attempt ?? 0}</p>
            </div>
          </Card>

          <Card className="border-indigo-500/20 bg-indigo-500/10">
            <div className="mb-2 flex items-center gap-3 text-indigo-800">
              <span className="material-symbols-outlined">rule</span>
              <span className="text-sm font-bold tracking-wide">Current Review</span>
            </div>
            <p className="text-sm font-semibold text-indigo-900/80">{graphNode.display_name}</p>
            <p className="mt-1 text-xs text-indigo-800/70">Level {(application.current_level ?? 0) + 1}</p>
          </Card>
        </aside>

        <main className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title="Application File" subtitle="Only fields granted to this review task are shown." />
            <div className="space-y-4 border-t border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
              {visibleEntries.length === 0 ? (
                <p className="italic text-slate-500">No application fields are visible for this review task.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {visibleEntries.map(([key, value]) => (
                    <div key={key}>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{fieldLabels[key] || labelFromKey(key)}</p>
                      <p className="font-medium text-slate-800">{formatValue(value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Review Inputs and Decision" subtitle="All reviewers at this level must approve before the application advances." />
            <div className="space-y-5 border-t border-slate-100 p-4">
              {graphNode.required_inputs.length === 0 ? (
                <p className="text-sm text-slate-500">No additional inputs are required for this review.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {graphNode.required_inputs.map((input) => (
                    <ReviewerInput
                      key={input.input_key}
                      input={input}
                      value={dynamicInputs[input.input_key]}
                      onChange={(value) => setDynamicInputs((current) => ({ ...current, [input.input_key]: value }))}
                    />
                  ))}
                </div>
              )}

              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Reviewer remarks</label>
                <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
              </div>

              {allowedActions.has("request_changes") && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Requesting changes returns this application to <strong>{labelFromKey(graphNode.return_target)}</strong>. On resubmission, every review level from that point onward runs again.
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                {allowedActions.has("reject") && <Button variant="danger" loading={actionLoading} disabled={!remarks.trim()} onClick={() => handleAction("reject")}>Reject</Button>}
                {allowedActions.has("request_changes") && <Button variant="secondary" icon="flag" loading={actionLoading} disabled={!remarks.trim()} onClick={() => handleAction("request-changes")}>Request Changes</Button>}
                {allowedActions.has("approve") && <Button variant="primary" icon="check_circle" loading={actionLoading} onClick={() => handleAction("approve")}>Record Approval</Button>}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Timeline" />
            <div className="space-y-4 border-t border-slate-100 p-4">
              {data.timeline.length === 0 && <p className="text-sm text-slate-500">No events recorded yet.</p>}
              {data.timeline.map((event, index) => (
                <div key={event.id} className="relative pb-2 pl-7">
                  {index < data.timeline.length - 1 && <div className="absolute left-[7px] top-5 h-[calc(100%-0.2rem)] w-0.5 bg-slate-200" />}
                  <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-primary bg-white" />
                  <p className="text-sm font-semibold text-slate-900">{event.event_type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</p>
                  {event.event_payload?.to_stage && <Badge variant="neutral" className="mt-2 text-[10px]">{String(event.event_payload.to_stage)}</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </main>
      </div>

      <ApplicationChatWidget
        applicationId={application.id}
        contextLabel={`#${application.id} · ${data.opportunity?.title || "Application thread"}`}
        visible={canViewComments && allowedActions.has("comment")}
      />
    </div>
  );
}

function ReviewerInput({ input, value, onChange }: { input: ReviewerRequiredInput; value: FieldValue | undefined; onChange: (value: FieldValue) => void }) {
  const type = normalizedInputType(input);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {requiredInputLabel(input)}{isRequired(input) && <span className="ml-1 text-red-500">*</span>}
      </label>
      {type === "dropdown" ? (
        <select value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
          <option value="">Select option</option>
          {(input.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : type === "checkbox" ? (
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />Confirm</label>
      ) : type === "multiselect" ? (
        <div className="space-y-2">
          {(input.options || []).map((option) => {
            const selected = Array.isArray(value) ? value : [];
            return <label key={option} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={selected.includes(option)} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />{option}</label>;
          })}
        </div>
      ) : (
        <input type={type === "number" ? "number" : "text"} value={typeof value === "string" || typeof value === "number" ? value : ""} onChange={(event) => onChange(type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" />
      )}
    </div>
  );
}
