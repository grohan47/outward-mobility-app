"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";

export default function AdminApplicationsLedger() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/applications")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setLoading(false);
      });
  }, []);

  async function deleteApplication(applicationId: number) {
    const confirmed = window.confirm("Delete this application permanently?");
    if (!confirmed) return;

    setDeletingId(applicationId);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.detail || "Unable to delete application.");
      }
      setItems((prev) => prev.filter((item) => item.id !== applicationId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to delete application.");
    } finally {
      setDeletingId(null);
    }
  }

  const columns = [
    {
      key: "id",
      header: "App ID",
      cell: (item: any) => <span className="font-mono text-xs text-slate-500">#{item.id}</span>,
      width: "80px",
    },
    {
      key: "applicant",
      header: "Applicant / Program",
      cell: (item: any) => (
        <div>
          <p className="font-bold text-slate-900">{item.student_user?.full_name}</p>
          <p className="text-[10px] text-slate-500">{item.student_profile?.program} • {item.student_profile?.student_id}</p>
        </div>
      ),
    },
    {
      key: "opportunity",
      header: "Opportunity",
      cell: (item: any) => <span className="text-sm text-slate-700 font-medium">{item.opportunity?.title}</span>,
    },
    {
      key: "status",
      header: "Workflow State",
      cell: (item: any) => {
        let variant: any = "info";
        if (item.workflow.finalStatus === "REJECTED") variant = "danger";
        if (item.workflow.finalStatus === "APPROVED") variant = "success";

        const steps = Array.isArray(item.pipeline_steps) ? item.pipeline_steps : [];
        const currentStep = Number(item.current_step_order || 0);
        const closed = Boolean(item.workflow?.finalStatus);

        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant={variant}>{item.workflow.stageLabel}</Badge>
            {item.workflow.finalStatus && (
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  item.workflow.finalStatus === "REJECTED" ? "text-red-500" : "text-green-600"
                }`}
              >
                {item.workflow.finalStatus}
              </span>
            )}
            <div className="w-48 mt-1">
              <div className="flex items-center gap-1">
                {steps.map((step: any, idx: number) => {
                  const stepOrder = Number(step.step_order);
                  const done = closed || stepOrder < currentStep;
                  const active = !closed && stepOrder === currentStep;
                  const dotClass = done
                    ? item.workflow.finalStatus === "REJECTED"
                      ? "bg-red-500 border-red-500"
                      : "bg-primary border-primary"
                    : active
                      ? "bg-white border-primary"
                      : "bg-white border-slate-300";

                  return (
                    <div key={`${item.id}-step-${stepOrder}`} className="flex items-center gap-1 min-w-0">
                      <div className={`h-2.5 w-2.5 rounded-full border ${dotClass}`} title={step.step_name} />
                      {idx < steps.length - 1 && <div className="h-0.5 w-5 bg-slate-200" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: "date",
      header: "Last Update",
      cell: (item: any) => <span className="text-xs text-slate-500 font-medium">{new Date(item.updated_at).toLocaleString()}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (item: any) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/applications/${item.id}`}
            className="px-2 py-1 text-xs font-bold text-primary border border-primary/20 rounded-md hover:bg-primary/5"
          >
            Review / Edit
          </Link>
          <button
            type="button"
            onClick={() => {
              void deleteApplication(item.id);
            }}
            disabled={deletingId === item.id}
            className="px-2 py-1 text-xs font-bold text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-60"
          >
            {deletingId === item.id ? "Deleting..." : "Delete"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Application Ledger</h1>
          <p className="text-slate-500 mt-2">Master view of all outward mobility applications.</p>
        </div>
        <Link
          href="/admin/messages"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100"
        >
          <span className="material-symbols-outlined text-[18px]">chat</span>
          Messaging (WIP)
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-2">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center">
            <span className="material-symbols-outlined animate-spin text-3xl mb-4">progress_activity</span>
            Loading ledger data...
          </div>
        ) : (
          <Table
            data={items}
            columns={columns}
            keyExtractor={(it) => it.id}
            emptyMessage="No applications found."
          />
        )}
      </div>
    </div>
  );
}
