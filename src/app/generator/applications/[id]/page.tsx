"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApplicationChatWidget } from "@/components/application/ApplicationChatWidget";
import { Card, CardHeader } from "@/components/ui/Card";
import { StepProgressBar } from "@/components/application/StepProgressBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type ApplicationDetailPayload = {
  application: {
    id: number;
    current_step_order: number;
    current_stage_label: string;
    final_status: string | null;
    submitted_data_json: string | null;
  };
  opportunity?: { title?: string; term?: string };
  student_user?: { full_name?: string };
  workflow: { stageLabel: string; finalStatus: string | null };
  reviews: Array<{ id: number; reviewer_name?: string; reviewer_role: string; decision: string; remarks: string | null; created_at: string }>;
  comments: Array<{ id: number; author_email: string; text: string; visibility: string; created_at: string }>;
  timeline: Array<{ id: number; event_type: string; created_at: string; event_payload: { to_stage?: string } | null }>;
  pipeline_steps: Array<{ step_order: number; step_name: string; reviewer_email?: string; reviewer_display_name?: string }>;
  field_labels?: Record<string, string>;
};

export default function ApplicationDetailView() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<ApplicationDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [studentResponse, setStudentResponse] = useState("");
  const [resubmitting, setResubmitting] = useState(false);

  useEffect(() => {
    reloadDetail();
  }, [params.id]);

  async function reloadDetail() {
    try {
      // Frontend -> API: GET /api/applications/:id
      const res = await fetch(`/api/applications/${params.id}`);
      const d = await res.json();
      setData(d);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  const submittedData = useMemo(() => {
    if (!data?.application?.submitted_data_json) return {};
    try {
      return JSON.parse(data.application.submitted_data_json) as Record<string, string>;
    } catch {
      return {};
    }
  }, [data]);
  const fieldLabels = data?.field_labels || {};

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center text-slate-400">
        <span className="material-symbols-outlined animate-spin text-4xl mb-4">progress_activity</span>
        <p>Loading application details...</p>
      </div>
    );
  }

  if (!data || (data as any)?.error) {
    return (
      <Card className="py-20 text-center text-red-500 bg-red-50 border-red-200">
        <span className="material-symbols-outlined text-4xl mb-4 text-red-400">error</span>
        <p className="font-bold">Unable to load this application.</p>
      </Card>
    );
  }

  const stages = data.pipeline_steps.map((step) => ({ code: `STEP_${step.step_order}`, label: step.step_name }));
  const waitingOnStudent = !data.application.final_status && Number(data.application.current_step_order) === 0;

  async function deleteApplication() {
    const confirmed = window.confirm("Delete this application permanently?");
    if (!confirmed) return;
    setDeleting(true);
    try {
      // Frontend -> API: DELETE /api/applications/:id
      const res = await fetch(`/api/applications/${data.application.id}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.detail || "Unable to delete application.");
      }
      router.push("/generator/applications");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to delete application.");
      setDeleting(false);
    }
  }

  async function submitStudentResponse() {
    if (!studentResponse.trim()) {
      alert("Please add a response before sending it back.");
      return;
    }

    setResubmitting(true);
    try {
      // Frontend -> API: POST /api/applications/:id/student-response
      const res = await fetch(`/api/applications/${data.application.id}/student-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: studentResponse.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.detail || "Unable to submit response.");
      }
      setStudentResponse("");
      await reloadDetail();
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to submit response.");
    } finally {
      setResubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => router.back()}
            className="text-sm font-bold text-slate-500 hover:text-slate-900 mb-4 inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Applications
          </button>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Application #{data.application.id}</h1>
          <p className="text-slate-500 mt-1">
            {data.opportunity?.title} • {data.opportunity?.term}
          </p>
        </div>
        <Button variant="danger" size="sm" loading={deleting} onClick={deleteApplication}>
          Delete Application
        </Button>
      </div>

      <Card className="overflow-visible z-10 p-8 pt-10 px-12 pb-16">
        <h3 className="text-lg font-bold text-slate-900 mb-8 text-center uppercase tracking-widest text-sm">Approval Progress</h3>
        <StepProgressBar
          stages={stages}
          currentStage={waitingOnStudent ? "STUDENT_REWORK" : `STEP_${data.application.current_step_order}`}
          finalStatus={data.workflow.finalStatus}
        />
        {waitingOnStudent && (
          <p className="text-center text-xs font-semibold text-amber-700 mt-8">
            Waiting on your response before it goes back to review.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {waitingOnStudent && (
            <Card>
              <CardHeader title="Action Required: Student Rework" subtitle="Add your clarification and send the application back to the reviewer." />
              <div className="p-4 border-t border-slate-100 space-y-4">
                <textarea
                  value={studentResponse}
                  onChange={(e) => setStudentResponse(e.target.value)}
                  rows={4}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white"
                  placeholder="Write your response here..."
                />
                <div className="flex justify-end">
                  <Button loading={resubmitting} onClick={submitStudentResponse}>
                    Send Back to Reviewer
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Submitted Data" subtitle="Values captured when this application was submitted" />
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              {Object.keys(submittedData).length === 0 ? (
                <p className="text-sm text-slate-500">No submitted fields were found for this application.</p>
              ) : (
                Object.entries(submittedData).map(([key, value]) => (
                  <div key={key} className="border-b border-slate-200 last:border-0 pb-2 last:pb-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      {fieldLabels[key] || key.replace(/_/g, " ")}
                    </p>
                    <p className="text-sm text-slate-800 font-medium">{String(value)}</p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Review Feedback" />
            <div className="space-y-4">
              {data.reviews.length === 0 ? (
                <p className="text-slate-500 text-sm">No review feedback yet.</p>
              ) : (
                data.reviews.map((review) => (
                  <div
                    key={review.id}
                    className={`p-4 rounded-xl border ${
                      review.decision === "REQUEST_CHANGES"
                        ? "bg-amber-50 border-amber-200"
                        : review.decision === "REJECT"
                          ? "bg-red-50 border-red-200"
                          : "bg-green-50 border-green-200"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        {(review.reviewer_name || review.reviewer_role)} • {review.decision}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{review.remarks || "No remarks provided."}</p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Application Comments" subtitle="Essential reviewer comments remain enabled" />
            <div className="space-y-3">
              {data.comments.length === 0 ? (
                <p className="text-sm text-slate-500">No comments yet.</p>
              ) : (
                data.comments.map((comment) => (
                  <div key={comment.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 uppercase tracking-wider font-bold">
                      <span>{comment.author_email}</span>
                      <span>{new Date(comment.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1">{comment.text}</p>
                    <Badge variant="neutral" className="mt-2 text-[10px]">
                      {comment.visibility}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Timeline" />
            <div className="space-y-5">
              {data.timeline.map((event, idx) => (
                <div key={event.id} className="relative pl-7 pb-2">
                  {idx !== data.timeline.length - 1 && (
                    <div className="absolute left-[7px] top-5 h-[calc(100%-0.2rem)] w-0.5 bg-slate-200" />
                  )}
                  <div className="absolute top-1.5 left-0 h-4 w-4 rounded-full bg-white border-2 border-primary shadow-sm" />
                  <p className="text-sm font-bold text-slate-900">{event.event_type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(event.created_at).toLocaleDateString()} {new Date(event.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {event.event_payload?.to_stage && (
                    <Badge variant="neutral" className="mt-2 text-[10px] bg-slate-50 border-slate-200 text-slate-500">
                      &rarr; {event.event_payload.to_stage}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <ApplicationChatWidget
        applicationId={data.application.id}
        contextLabel={`#${data.application.id} · ${data.opportunity?.title || "Application thread"}`}
        studentName={data.student_user?.full_name || "Student"}
        pipelineSteps={data.pipeline_steps}
      />
    </div>
  );
}
