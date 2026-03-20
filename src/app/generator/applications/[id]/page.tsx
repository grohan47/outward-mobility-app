"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { StepProgressBar } from "@/components/application/StepProgressBar";
import { Badge } from "@/components/ui/Badge";

export default function ApplicationDetailView() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/applications/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [params.id]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center text-slate-400">
        <span className="material-symbols-outlined animate-spin text-4xl mb-4">progress_activity</span>
        <p>Loading application details...</p>
      </div>
    );
  }

  if (data?.error) {
    return (
      <Card className="py-20 text-center text-red-500 bg-red-50 border-red-200">
        <span className="material-symbols-outlined text-4xl mb-4 text-red-400">error</span>
        <p className="font-bold">{data.error}</p>
      </Card>
    );
  }

  const stages = [
    { code: "STUDENT_SUBMISSION", label: "Submission" },
    { code: "STUDENT_LIFE", label: "Student Life" },
    { code: "PROGRAM_CHAIR", label: "Program Chair" },
    { code: "OGE", label: "OGE Office" },
    { code: "DEAN", label: "Final Approval" },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <button onClick={() => router.back()} className="text-sm font-bold text-slate-500 hover:text-slate-900 mb-4 inline-flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Applications
        </button>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Application #{data.application.id}</h1>
        <p className="text-slate-500 mt-1">{data.opportunity?.title} • {data.opportunity?.term}</p>
      </div>

      <Card className="overflow-visible z-10 p-8 pt-10 px-12 pb-16">
        <h3 className="text-lg font-bold text-slate-900 mb-8 text-center uppercase tracking-widest text-sm">Approval Progress</h3>
        <StepProgressBar 
          stages={stages} 
          currentStage={data.workflow.stageCode} 
          finalStatus={data.workflow.finalStatus} 
        />
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader title="Submitted Data Placeholder" subtitle="Dynamic form renderer goes here" />
            <div className="p-4 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-slate-500 text-sm">
              <p>For MVP: We see that the student profile snapshot was recorded at {new Date(data.snapshot.snapshot_captured_at).toLocaleDateString()}.</p>
              <pre className="mt-4 bg-slate-800 text-green-400 p-4 rounded-lg overflow-x-auto text-[11px] font-mono shadow-inner">
{JSON.stringify(data.snapshot, null, 2)}
              </pre>
            </div>
          </Card>
          
          <Card>
            <CardHeader title="Comments & Deficiencies" />
            <div className="space-y-4">
              {data.reviews?.length === 0 ? (
                <p className="text-slate-500 text-sm">No review comments yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.reviews.map((r: any) => (
                     <div key={r.id} className={`p-4 rounded-xl border ${r.verification_outcome === 'FLAG' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                       <div className="flex justify-between items-start mb-2">
                         <span className={`text-xs font-bold uppercase tracking-wider ${r.verification_outcome === 'FLAG' ? 'text-amber-800' : 'text-green-800'}`}>
                           {r.review_role} Review • {r.verification_outcome}
                         </span>
                         <span className="text-[10px] text-slate-400 font-medium">{new Date(r.created_at).toLocaleDateString()}</span>
                       </div>
                       <p className="text-sm text-slate-700">{r.remarks}</p>
                     </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader title="Timeline" />
            <div className="space-y-5">
              {data.timeline.map((event: any, idx: number) => (
                <div key={event.id} className="relative pl-6 pb-2">
                  {idx !== data.timeline.length - 1 && (
                    <div className="absolute top-2 bottom-0 left-[7px] w-0.5 bg-slate-100 -bottom-5" />
                  )}
                  <div className="absolute top-1.5 left-0 w-4 h-4 rounded-full bg-white border-2 border-primary shadow-sm" />
                  <p className="text-sm font-bold text-slate-900">{event.event_type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                     {new Date(event.created_at).toLocaleDateString()} {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {event.event_payload?.to_stage && (
                    <Badge variant="neutral" className="mt-2 text-[10px] bg-slate-50 border-slate-200 text-slate-500">
                      &rarr; {event.event_payload.to_stage.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
