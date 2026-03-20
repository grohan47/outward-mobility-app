"use client";

import { useEffect, useState } from "react";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export default function AdminApplicationsLedger() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/applications")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setLoading(false);
      });
  }, []);

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
        
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant={variant}>{item.workflow.stageLabel}</Badge>
            {item.workflow.finalStatus && (
              <span className={`text-[10px] font-bold uppercase tracking-wider ${item.workflow.finalStatus === 'REJECTED' ? 'text-red-500' : 'text-green-600'}`}>
                {item.workflow.finalStatus}
              </span>
            )}
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
      header: "",
      cell: (item: any) => (
        <a href={`/admin/applications/${item.id}`} className="text-sm font-bold text-primary hover:text-primary-dark">
          Manage &rarr;
        </a>
      ),
      align: "right" as const,
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Application Ledger</h1>
          <p className="text-slate-500 mt-2">Master view of all outward mobility applications across the platform.</p>
        </div>
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
