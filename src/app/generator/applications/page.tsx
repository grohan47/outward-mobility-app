"use client";

import { useEffect, useState } from "react";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { useRouter } from "next/navigation";

export default function MyApplications() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Frontend -> API: GET /api/my/applications
    fetch("/api/my/applications")
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
      // Frontend -> API: DELETE /api/applications/:id
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
        } else if (Number(item.current_step_order) === 0 || item.workflow?.stageCode === "STUDENT_REWORK") {
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
    {
      key: "actions",
      header: "Actions",
      cell: (item: any) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void deleteApplication(item.id);
          }}
          disabled={deletingId === item.id}
          className="px-2 py-1 text-xs font-bold text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-60"
        >
          {deletingId === item.id ? "Deleting..." : "Delete"}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">My Applications</h1>
          <p className="text-slate-500 mt-2">Track the status of your approval requests.</p>
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
