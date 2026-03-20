"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

// Simplified session user hook for client
function useSessionUser() {
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    fetch("/api/users/me").then(r => r.json()).then(d => {
      if (d.user) setUser(d.user);
    }).catch(() => {});
  }, []);
  return user;
}

export default function ReviewerApplicationDetail() {
  const params = useParams();
  const router = useRouter();
  const user = useSessionUser();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [remarks, setRemarks] = useState("");

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
      </div>
    );
  }

  async function handleAction(endpoint: "approve" | "request-changes" | "reject", reason?: string) {
    if (!user) return;
    setActionLoading(true);
    
    try {
      const res = await fetch(`/api/applications/${data.application.id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewerEmail: user.email,
          remarks: reason || remarks,
          reason: reason || remarks, // for reject
        }),
      });
      
      if (res.ok) {
        router.push("/reviewer");
      } else {
        alert("Action failed. See console.");
        console.error(await res.json());
      }
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-32">
      <div className="flex items-center justify-between mb-8">
        <div>
          <button onClick={() => router.back()} className="text-sm font-bold text-slate-500 hover:text-slate-900 mb-4 inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Inbox
          </button>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Application #{data.application.id} <span className="text-slate-400">— {data.student_user?.full_name}</span></h1>
          <p className="text-slate-500 mt-1">{data.opportunity?.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column - Applicant Overview */}
        <div className="space-y-6">
          <Card className="bg-slate-50 border-slate-200 shadow-none">
            <div className="flex flex-col items-center text-center pb-6 border-b border-slate-200">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary-dark font-black text-2xl mb-4">
                {data.student_user?.full_name.split(" ").map((n: string) => n[0]).join("")}
              </div>
              <h3 className="font-bold text-lg text-slate-900">{data.student_user?.full_name}</h3>
              <p className="text-sm font-semibold text-slate-500">{data.student_profile?.student_id}</p>
            </div>
            <div className="pt-6 space-y-4 text-sm">
              <div className="flex justify-between border-b border-dashed border-slate-200 pb-3">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">CGPA</span>
                <span className="font-semibold text-slate-800">{data.snapshot?.official_cgpa_at_submission.toFixed(2)}</span>
              </div>
              <div className="flex flex-col border-b border-dashed border-slate-200 pb-3">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">PROGRAM</span>
                <span className="font-semibold text-slate-800 text-xs">{data.snapshot?.program_at_submission}</span>
              </div>
            </div>
          </Card>
          
          <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border-indigo-500/20">
            <div className="flex items-center gap-3 text-indigo-800 mb-2">
              <span className="material-symbols-outlined">auto_awesome</span>
              <span className="font-bold text-sm tracking-wide">AI PRE-SCREEN</span>
            </div>
            <p className="text-indigo-900/80 text-xs leading-relaxed font-semibold">
              The applicant meets the minimum CGPA requirement (8.0). No disciplinary flags found. Document check passed automatically.
            </p>
          </Card>
        </div>

        {/* Right Column - Data & Actions */}
        <div className="lg:col-span-3 space-y-6">
          {/* Mock Sections based on permissions */}
          <Card>
            <CardHeader title="Academic Information" />
            <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-sm text-slate-700">
               <p><strong>Standing:</strong> Requirements Met</p>
               <p><strong>Credits:</strong> 90 completed</p>
            </div>
          </Card>
          
          <Card>
            <CardHeader title="Review History" />
            <div className="space-y-4">
               {data.reviews?.map((r: any) => (
                 <div key={r.id} className="flex gap-4">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${r.verification_outcome === "FLAG" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                     <span className="material-symbols-outlined text-[16px]">{r.verification_outcome === "FLAG" ? "warning" : "check"}</span>
                   </div>
                   <div className="flex-1 pb-4 border-b border-slate-100">
                     <p className="text-sm font-bold text-slate-900">{r.review_role} Reviewer</p>
                     <p className="text-sm text-slate-600 mt-1">{r.remarks}</p>
                     <p className="text-[10px] text-slate-400 font-bold tracking-wider mt-2 uppercase">{new Date(r.created_at).toLocaleString()}</p>
                   </div>
                 </div>
               ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-64 right-0 p-4 border-t border-slate-200 bg-white/80 backdrop-blur-md z-40 transform transition-transform">
        <div className="max-w-6xl mx-auto flex items-end gap-4">
          <div className="flex-1">
             <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Reviewer Remarks (Required for Flag/Reject)</label>
             <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Enter comments summarizing your decision..." className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all bg-white shadow-sm" />
          </div>
          
          <Button variant="danger" size="md" loading={actionLoading} onClick={() => handleAction("reject")} disabled={!remarks || !["OGE", "DEAN"].includes(data.application.current_stage)}>
            Reject
          </Button>
          <Button variant="secondary" size="md" icon="flag" loading={actionLoading} onClick={() => handleAction("request-changes")} disabled={!remarks}>
            Request Changes
          </Button>
          <Button variant="primary" size="md" icon="check_circle" loading={actionLoading} onClick={() => handleAction("approve")}>
            Approve & Forward
          </Button>
        </div>
      </div>
    </div>
  );
}
