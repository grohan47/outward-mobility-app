"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import Link from "next/link";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";

type DashboardStats = {
  total: number;
  pending: number;
  awaitingMe: number;
  approved: number;
  avgProcessingDays: number;
  flaggedRatio: number;
  activeOpportunities: Array<{ id: number; title: string; code: string; applicant_count: number }>;
};

type ApplicationRow = {
  id: number;
  updated_at: string;
  opportunity?: { title?: string };
  student_user?: { full_name?: string };
  student_profile?: { student_id?: string };
  workflow: { stageLabel: string; finalStatus: string | null };
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentApps, setRecentApps] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      // Frontend -> API: GET /api/admin/dashboard/summary
      fetch("/api/admin/dashboard/summary").then((r) => r.json()),
      // Frontend -> API: GET /api/admin/applications
      fetch("/api/admin/applications").then((r) => r.json()),
    ])
      .then(([statsData, appsData]) => {
        setStats(statsData);
        setRecentApps((appsData.items || []).slice(0, 5));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const columns = [
    {
      key: "id",
      header: "App ID",
      cell: (item: ApplicationRow) => <span className="font-mono text-xs text-slate-500">#{item.id}</span>,
    },
    {
      key: "applicant",
      header: "Applicant",
      cell: (item: ApplicationRow) => (
        <div>
          <p className="font-bold text-slate-900">{item.student_user?.full_name}</p>
          <p className="text-[10px] text-slate-500">{item.student_profile?.student_id}</p>
        </div>
      ),
    },
    {
      key: "opportunity",
      header: "Opportunity",
      cell: (item: ApplicationRow) => (
        <span className="text-sm text-slate-700 font-medium">{item.opportunity?.title}</span>
      ),
    },
    {
      key: "stage",
      header: "Current Stage",
      cell: (item: ApplicationRow) => {
        let variant: "danger" | "success" | "info" = "info";
        if (item.workflow.finalStatus === "REJECTED") variant = "danger";
        if (item.workflow.finalStatus === "APPROVED") variant = "success";
        return <Badge variant={variant}>{item.workflow.stageLabel}</Badge>;
      },
    },
    {
      key: "date",
      header: "Last Update",
      cell: (item: ApplicationRow) => (
        <span className="text-xs text-slate-500 font-medium">{new Date(item.updated_at).toLocaleDateString()}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">OGE Master Dashboard</h1>
          <p className="text-slate-500 mt-2">Platform overview and recent activity.</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/messages"
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors"
          >
            Messages
          </Link>
          <Link
            href="/admin/opportunities/new"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors"
          >
            New Opportunity
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-900 text-white border-slate-800">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Total Received</span>
            <span className="text-4xl font-black">{loading ? "-" : stats?.total ?? 0}</span>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border-indigo-500/20">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-indigo-800 uppercase tracking-wider mb-2">Active Workflows</span>
            <span className="text-4xl font-black text-indigo-900">{loading ? "-" : stats?.pending ?? 0}</span>
          </div>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/20">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-amber-800 uppercase tracking-wider mb-2">Awaiting OGE Action</span>
            <span className="text-4xl font-black text-amber-900">{loading ? "-" : stats?.awaitingMe ?? 0}</span>
          </div>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-green-800 uppercase tracking-wider mb-2">Fully Approved</span>
            <span className="text-4xl font-black text-green-900">{loading ? "-" : stats?.approved ?? 0}</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="p-6 pb-2 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900">Live Application Ledger</h3>
            <Link href="/admin/applications" className="text-sm font-bold text-primary hover:text-primary-dark">
              View Full Ledger &rarr;
            </Link>
          </div>
          <div className="px-2 pb-2">
            {!loading && (
              <Table
                data={recentApps}
                columns={columns}
                keyExtractor={(it: ApplicationRow) => it.id}
                emptyMessage="No applications received yet."
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="System Performance" />
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-bold text-slate-700">Average Processing Time</span>
                <span className="text-slate-500 font-medium">
                  {loading ? "-" : `${stats?.avgProcessingDays ?? 0} Days`}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-green-500 h-full"
                  style={{ width: `${Math.min((stats?.avgProcessingDays ?? 0) * 8, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-bold text-slate-700">Applications Flagged</span>
                <span className="text-amber-600 font-medium">
                  {loading ? "-" : `${stats?.flaggedRatio ?? 0}%`}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full" style={{ width: `${stats?.flaggedRatio ?? 0}%` }} />
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <h4 className="font-bold text-sm text-slate-900 mb-3">Active Opportunities</h4>
              <div className="space-y-3">
                {(stats?.activeOpportunities || []).map((opp) => (
                  <div
                    key={opp.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                      <span className="material-symbols-outlined">public</span>
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900">{opp.title}</p>
                      <p className="text-xs text-slate-500">{opp.applicant_count} Applicants</p>
                    </div>
                  </div>
                ))}
                {!loading && (stats?.activeOpportunities || []).length === 0 && (
                  <p className="text-sm text-slate-400">No published opportunities available.</p>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
