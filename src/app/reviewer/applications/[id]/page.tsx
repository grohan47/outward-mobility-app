"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApplicationChatWidget } from "@/components/application/ApplicationChatWidget";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type SessionUser = {
  email: string;
  role: string;
};

type StepRequiredInput = {
  input_key: string;
  input_label?: string;
  label?: string;
  input_type: "text" | "number" | "dropdown" | "multiselect" | "select" | "checkbox";
  options?: string[];
  is_required: number;
};

type PipelineStep = {
  id: number;
  step_order: number;
  step_name: string;
  reviewer_email: string;
  reviewer_display_name?: string;
  visible_fields: string[];
  can_view_comments: number;
  required_inputs: StepRequiredInput[];
};

type ReviewRecord = {
  id: number;
  reviewer_name?: string;
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

type GraphNodeInfo = {
  task_id?: number;
  node_key: string;
  display_name: string;
  allowed_actions: string[];
  visible_sections: string[];
  required_inputs: StepRequiredInput[];
};

type DetailPayload = {
  application?: {
    id: number;
    current_step_order: number;
    current_stage_label: string;
    final_status: string | null;
    submitted_data_json: string | null;
  };
  opportunity?: { title?: string };
  student_user?: { full_name?: string };
  student_profile?: { student_id?: string; official_cgpa?: number; program?: string };
  reviews?: ReviewRecord[];
  comments?: Array<{ id: number; author_email: string; text: string; created_at: string }>;
  timeline?: TimelineRecord[];
  pipeline_steps?: PipelineStep[];
  graph_node_info?: GraphNodeInfo;
  application_file?: Record<string, unknown>;
  field_labels?: Record<string, string>;
  permissions?: { can_view_comments?: boolean };
};

type ApprovalAssist = {
  recommendation?: string;
  rationale?: string;
  quality_checks?: Array<{ field?: string; label?: string; status?: string; note?: string }>;
  draft_remarks?: string;
  is_dummy_ai?: boolean;
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

export default function ReviewerApplicationDetail() {
  const params = useParams();
  const router = useRouter();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [dynamicInputs, setDynamicInputs] = useState<Record<string, unknown>>({});
  const [targetStepOrder, setTargetStepOrder] = useState<number | null>(null);
  const [assist, setAssist] = useState<ApprovalAssist | null>(null);
  const [assistOpen, setAssistOpen] = useState(false);
  const [assistLoading, setAssistLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      // Frontend -> API: GET /api/auth/me
      fetch("/api/auth/me").then((r) => r.json()),
      // Frontend -> API: GET /api/applications/:id
      fetch(`/api/applications/${params.id}`).then((r) => r.json()),
    ])
      .then(([userData, detail]) => {
        setUser(userData.user || null);
        setData(detail);

        const isGraphApp = Boolean(detail?.graph_node_info);
        if (isGraphApp) {
          // Graph apps always allow send-back to student; pre-select step 0 (student).
          setTargetStepOrder(0);
        } else {
          const currentStepOrder = Number(detail?.application?.current_step_order || 0);
          const priorSteps = (detail?.pipeline_steps || []).filter((step: PipelineStep) => step.step_order < currentStepOrder);
          if (priorSteps.length > 0) {
            setTargetStepOrder(priorSteps[priorSteps.length - 1].step_order);
          } else if (currentStepOrder > 0) {
            setTargetStepOrder(0);
          } else {
            setTargetStepOrder(null);
          }
        }

        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    let mounted = true;
    setAssistLoading(true);
    fetch(`/api/applications/${params.id}/ai-approval-assist`)
      .then((response) => response.json())
      .then((body) => {
        if (mounted) setAssist(body || null);
      })
      .catch(() => {
        if (mounted) setAssist(null);
      })
      .finally(() => {
        if (mounted) setAssistLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [params.id]);

  const application = useMemo(
    () => ({
      id: Number(data?.application?.id || 0),
      current_step_order: Number(data?.application?.current_step_order || 0),
      current_stage_label: data?.application?.current_stage_label || "In review",
      final_status: data?.application?.final_status || null,
      submitted_data_json: data?.application?.submitted_data_json || null,
    }),
    [data]
  );

  const graphNodeInfo = data?.graph_node_info ?? null;
  const isGraphApp = graphNodeInfo !== null;
  const allowedActions = graphNodeInfo?.allowed_actions || [];

  const pipelineSteps = useMemo(() => (Array.isArray(data?.pipeline_steps) ? data.pipeline_steps : []), [data?.pipeline_steps]);
  const reviews = useMemo(() => (Array.isArray(data?.reviews) ? data.reviews : []), [data?.reviews]);
  const timeline = useMemo(() => (Array.isArray(data?.timeline) ? data.timeline : []), [data?.timeline]);
  const comments = useMemo(() => (Array.isArray(data?.comments) ? data.comments : []), [data?.comments]);

  const applicationFile = useMemo(() => {
    if (data?.application_file && typeof data.application_file === "object") {
      return data.application_file as Record<string, unknown>;
    }
    if (!application.submitted_data_json) return {};
    try {
      return JSON.parse(application.submitted_data_json) as Record<string, unknown>;
    } catch {
      return {};
    }
  }, [application.submitted_data_json, data]);

  const currentStep = useMemo(() => {
    if (!data || isGraphApp) return null;
    return pipelineSteps.find((step) => step.step_order === application.current_step_order) || null;
  }, [application.current_step_order, data, isGraphApp, pipelineSteps]);

  // For graph apps use node metadata; for legacy apps use pipeline step data.
  const requiredInputs: StepRequiredInput[] = isGraphApp
    ? (graphNodeInfo?.required_inputs ?? [])
    : (currentStep?.required_inputs ?? []);
  const canViewComments = Boolean(data?.permissions?.can_view_comments);
  const fieldLabels = data?.field_labels || {};

  const visibleDataEntries = useMemo(() => {
    const entries = Object.entries(applicationFile);
    if (isGraphApp) {
      const sections = graphNodeInfo?.visible_sections ?? [];
      if (sections.length === 0 || sections.includes("all")) return entries;
      return entries.filter(([key]) => sections.includes(key));
    }
    const visibleFields = currentStep?.visible_fields || [];
    if (visibleFields.length === 0) return [];
    return entries.filter(([key]) => visibleFields.includes(key));
  }, [applicationFile, currentStep, graphNodeInfo, isGraphApp]);

  const visibleDataMap = useMemo(() => Object.fromEntries(visibleDataEntries), [visibleDataEntries]);

  const priorSteps = useMemo(() => {
    if (!data || isGraphApp) return [];
    return pipelineSteps.filter((step) => step.step_order < application.current_step_order);
  }, [application.current_step_order, data, isGraphApp, pipelineSteps]);

  const sendBackTargets = useMemo(() => {
    if (!data) return [];
    if (isGraphApp) {
      // Graph apps can always be sent back to the student for rework.
      return [{ stepOrder: 0, label: "Student (Rework)" }];
    }
    if (application.current_step_order <= 0) return [];
    return [
      { stepOrder: 0, label: "Student (Generator)" },
      ...priorSteps.map((step) => ({ stepOrder: step.step_order, label: step.step_name })),
    ];
  }, [application.current_step_order, data, isGraphApp, priorSteps]);

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

      // Frontend -> API: POST /api/applications/:id/{approve|request-changes|reject}
      const res = await fetch(`/api/applications/${application.id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push("/reviewer");
        router.refresh();
      } else {
        const body = await res.json();
        alert(body?.detail || "Action failed.");
      }
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <button
            onClick={() => router.back()}
            className="text-sm font-bold text-slate-500 hover:text-slate-900 mb-4 inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Inbox
          </button>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Application #{application.id} <span className="text-slate-400">- {data.student_user?.full_name}</span>
          </h1>
          <p className="text-slate-500 mt-1">{data.opportunity?.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="space-y-6">
          <Card className="bg-slate-50 border-slate-200 shadow-none">
            <div className="flex flex-col items-center text-center pb-6 border-b border-slate-200">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary-dark font-black text-2xl mb-4">
                {(data.student_user?.full_name || "User")
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </div>
              <h3 className="font-bold text-lg text-slate-900">{data.student_user?.full_name}</h3>
              <p className="text-sm font-semibold text-slate-500">{formatValue(visibleDataMap.student_id)}</p>
            </div>
            <div className="pt-6 space-y-4 text-sm">
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-3">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">CGPA</span>
                <span className="font-semibold text-slate-800">{formatValue(visibleDataMap.cgpa)}</span>
              </div>
              <div className="flex flex-col border-b border-dashed border-slate-200 pb-3">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">PROGRAM</span>
                <span className="font-semibold text-slate-800 text-xs">{formatValue(visibleDataMap.program)}</span>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border-indigo-500/20">
            <div className="flex items-center gap-3 text-indigo-800 mb-2">
              <span className="material-symbols-outlined">rule</span>
              <span className="font-bold text-sm tracking-wide">Current Stage</span>
            </div>
            <p className="text-indigo-900/80 text-xs leading-relaxed font-semibold">{application.current_stage_label}</p>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <Card className="border-indigo-100 bg-indigo-50/40">
            <button
              type="button"
              onClick={() => setAssistOpen((value) => !value)}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined rounded-lg bg-indigo-100 p-2 text-indigo-700">auto_awesome</span>
                <div>
                  <p className="text-sm font-black uppercase tracking-wider text-indigo-900">PRISM AI - review assist</p>
                  <p className="mt-1 text-sm text-indigo-800">
                    {assistLoading ? "Preparing recommendation..." : assist?.recommendation || "Open for a field quality scan"}
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-indigo-700">{assistOpen ? "expand_less" : "expand_more"}</span>
            </button>
            {assistOpen && (
              <div className="mt-4 border-t border-indigo-100 pt-4">
                <p className="text-sm leading-6 text-indigo-950">{assist?.rationale || "No AI recommendation available yet."}</p>
                {assist?.quality_checks && assist.quality_checks.length > 0 && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {assist.quality_checks.slice(0, 6).map((check, index) => (
                      <div key={`${check.field || index}`} className="rounded-lg border border-indigo-100 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{check.label || check.field}</p>
                          <Badge variant={check.status === "missing" ? "warning" : "success"}>{check.status || "review"}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-700">{check.note}</p>
                      </div>
                    ))}
                  </div>
                )}
                {assist?.draft_remarks && (
                  <button
                    type="button"
                    onClick={() => setRemarks(assist.draft_remarks || "")}
                    className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-bold text-white"
                  >
                    <span className="material-symbols-outlined text-[17px]">edit_note</span>
                    Use Draft Remarks
                  </button>
                )}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Application File" />
            <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-4 text-sm text-slate-700">
              {visibleDataEntries.length === 0 ? (
                <p className="text-slate-400 italic">No application data visible at this stage.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleDataEntries.map(([key, value]) => (
                    <div key={key}>
                      <p className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                        {fieldLabels[key] || labelFromKey(key)}
                      </p>
                      <p className="font-medium text-slate-800">{formatValue(value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Review Inputs and Decision" />
            <div className="p-4 border-t border-slate-100 space-y-4">
              {requiredInputs.length === 0 ? (
                <p className="text-sm text-slate-500">No stage-specific inputs required.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {requiredInputs.map((input) => (
                    <Card key={input.input_key} className="border border-slate-200 shadow-none">
                      <div className="p-4">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          {input.input_label || input.label || labelFromKey(input.input_key)}
                        </label>

                        {(input.input_type === "text" || input.input_type === "number") && (
                          <input
                            type={input.input_type === "number" ? "number" : "text"}
                            value={String(dynamicInputs[input.input_key] || "")}
                            onChange={(e) => setDynamicInputs((prev) => ({ ...prev, [input.input_key]: e.target.value }))}
                            className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm bg-white"
                          />
                        )}

                        {(input.input_type === "dropdown" || input.input_type === "select") && (
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

                        {input.input_type === "checkbox" && (
                          <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={Boolean(dynamicInputs[input.input_key])}
                              onChange={(e) => setDynamicInputs((prev) => ({ ...prev, [input.input_key]: e.target.checked }))}
                            />
                            Confirmed
                          </label>
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
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Overall Reviewer Comment
                </label>
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
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Send Back To
                    </label>
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

                <Button
                  variant="danger"
                  size="md"
                  loading={actionLoading}
                  onClick={() => handleAction("reject")}
                  disabled={!remarks || (isGraphApp ? !allowedActions.includes("reject") : user?.role !== "ADMIN")}
                >
                  Reject
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  icon="flag"
                  loading={actionLoading}
                  onClick={() => handleAction("request-changes")}
                  disabled={!remarks || targetStepOrder === null}
                >
                  Request Changes
                </Button>
                <Button variant="primary" size="md" icon="check_circle" loading={actionLoading} onClick={() => handleAction("approve")}>
                  Approve and Forward
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Timeline" />
            <div className="p-4 border-t border-slate-100 space-y-4">
              {timeline.length === 0 && <p className="text-sm text-slate-500">No events recorded yet.</p>}
              {timeline.map((event, index) => (
                <div key={event.id} className="relative pl-7 pb-2">
                  {index < timeline.length - 1 && <div className="absolute left-[7px] top-5 h-[calc(100%-0.2rem)] w-0.5 bg-slate-200" />}
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

          {canViewComments ? (
            <Card>
              <CardHeader title="Review History" />
              <div className="space-y-4 p-4 border-t border-slate-100">
                {reviews.length === 0 && <p className="text-slate-400 italic text-sm">No review entries yet.</p>}
                {reviews.map((review) => (
                  <div key={review.id} className="pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                    <p className="text-sm font-bold text-slate-900">{review.reviewer_name || review.reviewer_role}</p>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider mt-1">{review.decision}</p>
                    <p className="text-sm text-slate-700 mt-2">{review.remarks || "No remarks."}</p>
                    <p className="text-[10px] text-slate-400 font-bold tracking-wider mt-2 uppercase">
                      {new Date(review.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="border-amber-200 bg-amber-50">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-600">visibility_off</span>
                <div>
                  <p className="font-semibold text-amber-900">Review comments are hidden for this stage.</p>
                  <p className="text-sm text-amber-800 mt-1">You can still use timeline events to track workflow movement.</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <ApplicationChatWidget
        applicationId={application.id}
        contextLabel={`#${application.id} · ${data.opportunity?.title || "Application thread"}`}
        studentName={data.student_user?.full_name || "Student"}
        pipelineSteps={pipelineSteps}
      />
    </div>
  );
}
