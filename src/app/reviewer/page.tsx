"use client";

import { useEffect, useState } from "react";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useRouter } from "next/navigation";

export default function ReviewerInbox() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/reviewer/inbox")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setLoading(false);
      });
  }, []);

  const pendingItems = items.filter(i => true); // Normally would filter by "in my queue vs acted upon"

  const columns = [
    {
      key: "id",
      header: "App ID",
      cell: (item: any) => <span className="font-mono text-xs text-slate-500">#{item.id}</span>,
      width: "80px",
    },
    {
      key: "applicant",
      header: "Applicant",
      cell: (item: any) => (
        <div>
          <p className="font-bold text-slate-900">{item.student_name}</p>
          <p className="text-xs text-slate-500">{item.student_id}</p>
        </div>
      ),
    },
    {
      key: "opportunity",
      header: "Opportunity",
      cell: (item: any) => <span className="text-sm text-slate-700">{item.opportunity_title}</span>,
    },
    {
      key: "stage",
      header: "Stage",
      cell: (item: any) => <Badge variant="info">{item.current_stage}</Badge>,
    },
    {
      key: "deadline",
      header: "SLA Deadline",
      cell: (item: any) => (
        <span className="text-sm font-bold text-amber-600">
           {new Date(Date.now() + 86400000 * 3).toLocaleDateString()}
        </span>
      ), // Simulated deadline
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Task Inbox</h1>
          <p className="text-slate-500 mt-2">Applications awaiting your review and action.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Pending My Review</span>
            <span className="text-3xl font-black text-slate-900">{loading ? "—" : pendingItems.length}</span>
          </div>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/20">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-amber-800 uppercase tracking-wider mb-2">Due Soon</span>
            <span className="text-3xl font-black text-amber-700">{loading ? "—" : Math.min(pendingItems.length, 2)}</span>
          </div>
        </Card>
        <Card>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Total Processed (Term)</span>
            <span className="text-3xl font-black text-slate-900">14</span>
          </div>
        </Card>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center">
            <span className="material-symbols-outlined animate-spin text-3xl mb-4">progress_activity</span>
            Loading your tasks...
          </div>
        ) : (
          <Table
            data={pendingItems}
            columns={columns}
            keyExtractor={(it) => it.id}
            onRowClick={(item) => router.push(`/reviewer/applications/${item.id}`)}
            emptyMessage="Your inbox is clear! No applications waiting for review."
          />
        )}
      </div>
    </div>
  );
}
