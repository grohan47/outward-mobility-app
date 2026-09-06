"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface Opportunity {
  id: number;
  title: string;
  description?: string | null;
  ai_ctas?: string[];
  ai_summary_bullets?: string[];
  code: string;
}

type DetailField = {
  field_key: string;
  label: string;
  value: string;
};

export default function StudentOpportunities() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, { opportunity: Opportunity; detail_fields: DetailField[] }>>({});
  const router = useRouter();

  useEffect(() => {
    // Frontend -> API: GET /api/opportunities
    fetch("/api/opportunities")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function applyToOpportunity(opportunityId: number) {
    router.push(`/student/opportunities/${opportunityId}/apply`);
  }

  const focusedOpportunity = items.find((item) => item.id === focusedId) || null;
  const focusedDetail = focusedId ? detailCache[focusedId] : null;

  useEffect(() => {
    if (!focusedId || detailCache[focusedId]) return;
    fetch(`/api/opportunities/${focusedId}`)
      .then((r) => r.json())
      .then((d) => {
        setDetailCache((prev) => ({
          ...prev,
          [focusedId]: {
            opportunity: d.opportunity || {},
            detail_fields: Array.isArray(d.detail_fields) ? d.detail_fields : [],
          },
        }));
      })
      .catch(() => {
        setDetailCache((prev) => ({
          ...prev,
          [focusedId]: { opportunity: focusedOpportunity || ({} as Opportunity), detail_fields: [] },
        }));
      });
  }, [detailCache, focusedId, focusedOpportunity]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Opportunities</h1>
          <p className="text-slate-500 mt-2">Discover available workflows and submit approval requests.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-slate-100 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="py-20 text-center text-slate-500">
          <span className="material-symbols-outlined text-4xl mb-4 text-slate-300">explore_off</span>
          <p className="text-lg font-medium">No open opportunities at this time.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
          {items.map((opp) => (
            <Card
              key={opp.id}
              onClick={() => setFocusedId((prev) => (prev === opp.id ? null : opp.id))}
              className={`group transition-all duration-500 border cursor-pointer flex flex-col ${
                focusedId === opp.id
                  ? "-translate-y-3 shadow-xl border-primary/50 ring-2 ring-primary/15"
                  : "hover:-translate-y-1 hover:shadow-lg border-slate-200 hover:border-primary/30"
              }`}
            >
              <div className="flex-1">
                <div className="flex items-start justify-between mb-4">
                  <Badge variant="neutral" icon="auto_awesome">
                    PRISM
                  </Badge>
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{opp.code}</span>
                </div>

                <h3 className="text-xl font-black text-slate-900 mb-2 group-hover:text-primary transition-colors">{opp.title}</h3>
                {!!opp.ai_ctas?.length && (
                  <ul className="mb-3 space-y-1">
                    {opp.ai_ctas.slice(0, 2).map((cta) => (
                      <li key={cta} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-[14px] text-primary mt-[1px]">auto_awesome</span>
                        <span>{cta}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {focusedId === opp.id && (
                  <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 transition-all duration-300">
                    <p className="text-xs uppercase tracking-wide font-semibold text-primary mb-1">Description</p>
                    <p className="text-sm text-slate-700 leading-6">{opp.description || "No description available."}</p>
                  </div>
                )}

                <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-400">Open details to review eligibility, dates, and other opportunity facts.</p>
              </div>

              {focusedId === opp.id && (
                <div className="mt-8 pt-4 border-t border-slate-100 transition-all duration-300">
                  <Button
                    className="w-full"
                    icon="rocket_launch"
                    onClick={(e) => {
                      e.stopPropagation();
                      applyToOpportunity(opp.id);
                    }}
                  >
                    Apply Now
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {focusedOpportunity && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/35 backdrop-blur-sm p-4 md:p-8 overflow-y-auto"
          onClick={() => setFocusedId(null)}
        >
          <div className="min-h-full flex items-center justify-center">
            <div
              className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl border border-white/70 overflow-hidden transition-all duration-500"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <div className="flex h-28 items-center bg-slate-900 px-6 text-white md:h-32">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-white/60">{focusedOpportunity.code}</p>
                    <p className="mt-1 text-2xl font-black tracking-tight">{focusedOpportunity.title}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFocusedId(null)}
                  className="absolute top-4 right-4 rounded-full bg-white/90 hover:bg-white h-10 w-10 flex items-center justify-center shadow"
                >
                  <span className="material-symbols-outlined text-slate-600">close</span>
                </button>
              </div>

              <div className="p-6 md:p-8">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <Badge variant="neutral" icon="auto_awesome">
                    PRISM
                  </Badge>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">{focusedOpportunity.code}</span>
                </div>

                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-6">{focusedOpportunity.title}</h2>

                <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                    <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">Description</p>
                    <p className="text-sm md:text-[15px] text-slate-700 leading-7 whitespace-pre-wrap">
                      {focusedOpportunity.description || "No description available for this opportunity yet."}
                    </p>
                  </div>

                  <aside className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                    <p className="text-xs uppercase tracking-wider font-semibold text-primary mb-3">PRISM Summary</p>
                    <ul className="space-y-2">
                      {(focusedDetail?.opportunity.ai_summary_bullets || focusedOpportunity.ai_ctas || []).map((cta) => (
                        <li key={cta} className="rounded-lg bg-white border border-primary/20 px-3 py-2 text-xs text-slate-700">
                          {cta}
                        </li>
                      ))}
                      {(focusedDetail?.opportunity.ai_summary_bullets || focusedOpportunity.ai_ctas || []).length === 0 && (
                        <li className="text-xs text-slate-500">No summary available.</li>
                      )}
                    </ul>
                  </aside>
                </div>

                {(focusedDetail?.detail_fields || []).length > 0 && (
                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                    {(focusedDetail?.detail_fields || []).map((field) => (
                      <div key={field.field_key} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{field.label}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{field.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                  <Button className="w-full md:w-auto md:min-w-56" icon="rocket_launch" onClick={() => applyToOpportunity(focusedOpportunity.id)}>
                    Apply Now
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
