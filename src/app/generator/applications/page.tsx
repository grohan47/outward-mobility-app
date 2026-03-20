"use client";

import { useEffect, useState } from "react";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { useRouter } from "next/navigation";

export default function MyApplications() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/my/applications")
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
      key: "opportunity",
      header: "Opportunity",
      cell: (item: any) => (
        <div>
          <p className="font-bold text-slate-900">{item.opportunity?.title}</p>
          <p className="text-xs text-slate-500">{item.opportunity?.term}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Current Status",
      cell: (item: any) => {
        let variant: "neutral" | "warning" | "success" | "danger" | "info" = "info";
        let icon = "pending";

        if (item.workflow?.finalStatus === "REJECTED") {
          variant = "danger";
          icon = "cancel";
        } else if (item.workflow?.finalStatus === "APPROVED") {
          variant = "success";
          icon = "check_circle";
        } else if (item.current_stage === "STUDENT_SUBMISSION") {
          variant = "warning";
          icon = "edit_document";
        }

        return (
          <Badge variant={variant} icon={icon}>
            {item.workflow?.currentStakeholder || "Unknown"}
          </Badge>
        );
      },
    },
    {
      key: "date",
      header: "Last Updated",
      cell: (item: any) => <span className="text-sm text-slate-500">{new Date(item.updated_at).toLocaleDateString()}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">My Applications</h1>
          <p className="text-slate-500 mt-2">Track the status of your outward mobility requests.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center">
            <span className="material-symbols-outlined animate-spin text-3xl mb-4">progress_activity</span>
            Loading your applications...
          </div>
        ) : (
          <Table
            data={items}
            columns={columns}
            keyExtractor={(it) => it.id}
            onRowClick={(item) => router.push(`/generator/applications/${item.id}`)}
            emptyMessage="You haven't submitted any applications yet."
          />
        )}
      </div>
    </div>
  );
}
