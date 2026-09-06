"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApplicationChatWidget } from "@/components/application/ApplicationChatWidget";
import { labelForVisibility } from "@/components/application/chatStakeholders";
import { StepProgressBar } from "@/components/application/StepProgressBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import type { ApplicationDetailPayload, FieldValue, FormField } from "@/lib/types";

function parseSubmittedData(data: ApplicationDetailPayload): Record<string, FieldValue> {
  if (data.application_file) return data.application_file;
  try {
    return JSON.parse(data.application.submitted_data_json || "{}") as Record<string, FieldValue>;
  } catch {
    return {};
  }
}

function fieldRequired(field: FormField): boolean {
  return field.required !== false && field.is_required !== 0;
}

function formatValue(value: FieldValue | undefined): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export default function ApplicationDetailView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ApplicationDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [studentResponse, setStudentResponse] = useState("");
  const [reworkValues, setReworkValues] = useState<Record<string, FieldValue>>({});
  const [resubmitting, setResubmitting] = useState(false);

  const reloadDetail = useCallback(async () => {
    try {
      const response = await fetch(`/api/applications/${params.id}`);
      const payload: ApplicationDetailPayload & { detail?: string } = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Unable to load this application.");
      setData(payload);
      setReworkValues(parseSubmittedData(payload));
      setLoadError(null);
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "Unable to load this application.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void reloadDetail();
  }, [reloadDetail]);

  const submittedData = useMemo(() => (data ? parseSubmittedData(data) : {}), [data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center py-20 text-slate-400">
        <span className="material-symbols-outlined mb-4 animate-spin text-4xl">progress_activity</span>
        <p>Loading application details...</p>
      </div>
    );
  }

  if (!data || loadError) {
    return (
      <Card className="border-red-200 bg-red-50 py-20 text-center text-red-500">
        <span className="material-symbols-outlined mb-4 text-4xl text-red-400">error</span>
        <p className="font-bold">{loadError || "Unable to load this application."}</p>
      </Card>
    );
  }

  const applicationId = data.application.id;
  const waitingOnStudent = !data.application.final_status && data.application.current_step_order === 0;
  const stages = [
    { code: "STUDENT_REWORK", label: waitingOnStudent ? "Student Rework" : "Submitted" },
    ...data.pipeline_steps.map((step) => ({ code: `STEP_${step.step_order}`, label: step.step_name })),
  ];
  const formSchema = data.form_schema || [];
  const fieldLabels = data.field_labels || {};

  function setFieldValue(key: string, value: FieldValue) {
    setReworkValues((current) => ({ ...current, [key]: value }));
  }

  async function deleteApplication() {
    if (!window.confirm("Delete this application permanently?")) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/applications/${applicationId}`, { method: "DELETE" });
      const payload: { detail?: string } = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Unable to delete application.");
      router.push("/student/applications");
      router.refresh();
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Unable to delete application.");
      setDeleting(false);
    }
  }

  async function submitStudentResponse() {
    if (!studentResponse.trim()) {
      alert("Please explain what you changed before resubmitting.");
      return;
    }
    setResubmitting(true);
    try {
      const response = await fetch(`/api/applications/${applicationId}/student-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: studentResponse.trim(), submittedData: reworkValues }),
      });
      const payload: { detail?: string } = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Unable to resubmit application.");
      setStudentResponse("");
      await reloadDetail();
      router.refresh();
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Unable to resubmit application.");
    } finally {
      setResubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-900">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Applications
          </button>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Application #{applicationId}</h1>
          <p className="mt-1 text-slate-500">{data.opportunity?.title} · {data.opportunity?.term}</p>
        </div>
        <Button variant="danger" size="sm" loading={deleting} onClick={deleteApplication}>Delete Application</Button>
      </div>

      <Card className="overflow-visible px-12 pb-16 pt-10">
        <h2 className="mb-8 text-center text-sm font-bold uppercase tracking-widest text-slate-900">Approval Progress</h2>
        <StepProgressBar
          stages={stages}
          currentStage={waitingOnStudent ? "STUDENT_REWORK" : `STEP_${data.application.current_step_order}`}
          finalStatus={data.workflow.finalStatus}
        />
        {waitingOnStudent && <p className="mt-8 text-center text-xs font-semibold text-amber-700">Your updates are required before review can resume.</p>}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {waitingOnStudent && (
            <Card>
              <CardHeader title="Action Required: Update Application" subtitle="Edit the requested fields, explain the changes, and resubmit." />
              <div className="space-y-5 border-t border-slate-100 p-4">
                {formSchema.map((field) => (
                  <div key={field.field_key}>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      {field.label}{fieldRequired(field) && <span className="ml-1 text-red-500">*</span>}
                    </label>
                    {field.description && <p className="mb-2 text-xs text-slate-500">{field.description}</p>}
                    <ReworkField field={field} value={reworkValues[field.field_key]} onChange={(value) => setFieldValue(field.field_key, value)} />
                  </div>
                ))}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Summary of changes</label>
                  <textarea
                    value={studentResponse}
                    onChange={(event) => setStudentResponse(event.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    placeholder="Explain the corrections or additional information you provided."
                  />
                </div>
                <div className="flex justify-end">
                  <Button loading={resubmitting} onClick={submitStudentResponse}>Resubmit for Review</Button>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Submitted Data" subtitle="Current values saved with this application" />
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              {Object.keys(submittedData).length === 0 ? (
                <p className="text-sm text-slate-500">No submitted fields were found for this application.</p>
              ) : Object.entries(submittedData).map(([key, value]) => (
                <div key={key} className="border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{fieldLabels[key] || key.replace(/_/g, " ")}</p>
                  <p className="text-sm font-medium text-slate-800">{formatValue(value)}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Student-visible Feedback" />
            <div className="space-y-3">
              {data.comments.length === 0 ? (
                <p className="text-sm text-slate-500">No feedback yet.</p>
              ) : data.comments.map((comment) => (
                <div key={comment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <span>{comment.author_email}</span>
                    <span>{new Date(comment.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{comment.text}</p>
                  <Badge variant="neutral" className="mt-2 text-[10px]">{labelForVisibility(comment.visibility)}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Timeline" />
          <div className="space-y-5">
            {data.timeline.map((event, index) => (
              <div key={event.id} className="relative pb-2 pl-7">
                {index !== data.timeline.length - 1 && <div className="absolute left-[7px] top-5 h-[calc(100%-0.2rem)] w-0.5 bg-slate-200" />}
                <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-primary bg-white" />
                <p className="text-sm font-bold text-slate-900">{event.event_type.replace(/_/g, " ")}</p>
                <p className="mt-0.5 text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <ApplicationChatWidget applicationId={applicationId} contextLabel={`#${applicationId} · ${data.opportunity?.title || "Application thread"}`} audience="student" />
    </div>
  );
}

function ReworkField({ field, value, onChange }: { field: FormField; value: FieldValue | undefined; onChange: (value: FieldValue) => void }) {
  const options = field.options || [];
  if (["single_select", "select", "dropdown"].includes(field.input_type)) {
    return (
      <select value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
        <option value="">Select an option</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }
  if (field.input_type === "multiselect") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))}
            />
            {option}
          </label>
        ))}
      </div>
    );
  }
  if (field.input_type === "textarea") {
    return <textarea rows={4} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />;
  }
  return (
    <input
      type={field.input_type === "number" ? "number" : field.input_type === "file" ? "url" : "text"}
      value={typeof value === "string" || typeof value === "number" ? value : ""}
      onChange={(event) => onChange(field.input_type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value)}
      placeholder={field.input_type === "file" ? "Paste document URL" : undefined}
      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
    />
  );
}
