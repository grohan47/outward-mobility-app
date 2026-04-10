"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface AdminOpportunity {
  id: number;
  code: string;
  title: string;
  term: string | null;
  destination: string | null;
  status: string;
  deadline: string | null;
  seats: number | null;
  applicant_count: number;
}

export default function AdminOpportunitiesPage() {
  const [items, setItems] = useState<AdminOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    // Frontend -> API: GET /api/admin/opportunities
    fetch("/api/admin/opportunities")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function deleteOpportunity(opportunityId: number) {
    const confirmed = window.confirm("Delete this opportunity and all linked applications?");
    if (!confirmed) return;

    setDeletingId(opportunityId);
    try {
      // Frontend -> API: DELETE /api/admin/opportunities/:id
      const res = await fetch(`/api/admin/opportunities/${opportunityId}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.detail || "Unable to delete opportunity.");
      }
      setItems((prev) => prev.filter((item) => item.id !== opportunityId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unable to delete opportunity.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Opportunities</h1>
          <p className="text-slate-500 mt-2">Manage all published opportunities and their pipelines.</p>
        </div>
        <Link
          href="/admin/opportunities/new"
          className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors"
        >
          Create Opportunity
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 bg-slate-100 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="py-20 text-center text-slate-500">
          <span className="material-symbols-outlined text-4xl mb-4 text-slate-300">explore_off</span>
          <p className="text-lg font-medium">No opportunities found.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {items.map((opp) => (
            <Card key={opp.id} className="border border-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{opp.code}</p>
                  <h3 className="text-xl font-black text-slate-900 mt-1">{opp.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {[opp.term, opp.destination].filter(Boolean).join(" • ")}
                  </p>
                </div>
                <Badge variant={opp.status === "published" ? "success" : "neutral"}>{opp.status}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Applicants</p>
                  <p className="text-xl font-black text-slate-900">{opp.applicant_count}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Seats</p>
                  <p className="text-xl font-black text-slate-900">{opp.seats ?? "-"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Deadline</p>
                  <p className="text-sm font-bold text-slate-700">
                    {opp.deadline ? new Date(opp.deadline).toLocaleDateString() : "Not set"}
                  </p>
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end gap-2">
                <Link
                  href={`/admin/opportunities/${opp.id}`}
                  className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Edit Form & Pipeline
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    void deleteOpportunity(opp.id);
                  }}
                  disabled={deletingId === opp.id}
                  className="px-3 py-2 rounded-lg border border-red-200 text-red-700 text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-60"
                >
                  {deletingId === opp.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
