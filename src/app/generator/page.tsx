"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import Link from "next/link";

type Opportunity = { id: number };

type MyApplication = {
  id: number;
  updated_at: string;
  opportunity?: { title?: string; term?: string };
  workflow?: { finalStatus: string | null; stageLabel: string };
};

type SessionUser = {
  name: string;
};

export default function GeneratorDashboard() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/opportunities").then((r) => r.json()),
      fetch("/api/my/applications").then((r) => r.json()),
    ])
      .then(([sessionData, oppData, appData]) => {
        setUser(sessionData.user || null);
        setOpportunities(oppData.items || []);
        setApplications(appData.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const inProgress = applications.filter((a) => !a.workflow?.finalStatus).length;
    const completed = applications.filter((a) => a.workflow?.finalStatus === "APPROVED").length;
    const recent = [...applications]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
    return {
      activeOpportunities: opportunities.length,
      inProgress,
      completed,
      recent,
    };
  }, [applications, opportunities]);

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-slate-500 mt-2 text-lg">Here is an overview of your approval requests and workflow activity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary-dark">
              <span className="material-symbols-outlined text-[24px]">explore</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-600 uppercase tracking-wider">Opportunities</p>
              <h3 className="text-2xl font-black text-slate-900">{loading ? "-" : `${stats.activeOpportunities} Active`}</h3>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined text-[24px]">pending_actions</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-600 uppercase tracking-wider">In Progress</p>
              <h3 className="text-2xl font-black text-slate-900">{loading ? "-" : stats.inProgress}</h3>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600">
              <span className="material-symbols-outlined text-[24px]">task_alt</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-600 uppercase tracking-wider">Completed</p>
              <h3 className="text-2xl font-black text-slate-900">{loading ? "-" : stats.completed}</h3>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent Applications"
            action={
              <Link href="/generator/applications" className="text-sm font-bold text-primary hover:text-primary-dark">
                View All &rarr;
              </Link>
            }
          />
          {loading ? (
            <div className="py-12 text-center text-slate-400">Loading activity...</div>
          ) : stats.recent.length === 0 ? (
            <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">description</span>
              <p>No applications submitted yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.recent.map((app) => (
                <div key={app.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">#{app.id} {app.opportunity?.title}</p>
                    <p className="text-xs text-slate-500">{app.opportunity?.term} • {app.workflow?.stageLabel}</p>
                  </div>
                  <span className="text-xs text-slate-500">{new Date(app.updated_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Next Steps" />
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex gap-4">
              <span className="material-symbols-outlined text-blue-500">info</span>
              <div>
                <h4 className="font-bold text-sm text-blue-900">Profile and Documents</h4>
                <p className="text-xs text-blue-700 mt-1">Keep your submitted details accurate before each review cycle.</p>
              </div>
            </div>

            <Link
              href="/generator/opportunities"
              className="block w-full py-3 text-center rounded-xl border-2 border-primary/20 text-primary font-bold hover:bg-primary hover:text-white transition-colors"
            >
              Browse Opportunities
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
