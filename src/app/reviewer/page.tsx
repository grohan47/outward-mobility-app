"use client";

import { useEffect, useMemo, useState } from "react";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useRouter } from "next/navigation";
import Link from "next/link";

type InboxItem = {
  id: number;
  student_name: string;
  student_id: string;
  opportunity_title: string;
  current_stage: string;
  updated_at: string;
  sla_deadline: string | null;
};

type InboxStats = {
  pending: number;
  dueSoon: number;
  processed: number;
};

export default function ReviewerInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [stats, setStats] = useState<InboxStats>({ pending: 0, dueSoon: 0, processed: 0 });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Frontend -> API: GET /api/reviewer/inbox
    fetch("/api/reviewer/inbox")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setStats(d.stats || { pending: 0, dueSoon: 0, processed: 0 });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const pendingItems = useMemo(() => items, [items]);

  const columns = [
    {
      key: "id",
      header: "App ID",
      cell: (item: InboxItem) => <span className="font-mono text-xs text-slate-500">#{item.id}</span>,
      width: "80px",
    },
    {
      key: "applicant",
      header: "Applicant",
      cell: (item: InboxItem) => (
        <div>
          <p className="font-bold text-slate-900">{item.student_name}</p>
          <p className="text-xs text-slate-500">{item.student_id}</p>
        </div>
      ),
    },
    {
      key: "opportunity",
      header: "Opportunity",
      cell: (item: InboxItem) => <span className="text-sm text-slate-700">{item.opportunity_title}</span>,
    },
    {
      key: "stage",
      header: "Stage",
      cell: (item: InboxItem) => <Badge variant="info">{item.current_stage}</Badge>,
    },
    {
      key: "deadline",
      header: "SLA Deadline",
      cell: (item: InboxItem) => (
        <span className="text-sm font-bold text-amber-600">
          {item.sla_deadline ? new Date(item.sla_deadline).toLocaleDateString() : "N/A"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Task Inbox</h1>
          <p className="text-slate-500 mt-2">Applications awaiting your review and action.</p>
        </div>
        <Link
          href="/reviewer/messages"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <span className="material-symbols-outlined text-[18px]">chat</span>
          Messages
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Pending My Review</span>
            <span className="text-3xl font-black text-slate-900">{loading ? "—" : stats.pending}</span>
          </div>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/20">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-amber-800 uppercase tracking-wider mb-2">Due Soon</span>
            <span className="text-3xl font-black text-amber-700">{loading ? "—" : stats.dueSoon}</span>
          </div>
        </Card>
        <Card>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Total Processed</span>
            <span className="text-3xl font-black text-slate-900">{loading ? "—" : stats.processed}</span>
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
            keyExtractor={(it: InboxItem) => it.id}
            onRowClick={(item: InboxItem) => router.push(`/reviewer/applications/${item.id}`)}
            emptyMessage="Your inbox is clear. No applications waiting for review."
          />
        )}
      </div>
    </div>
  );
}
