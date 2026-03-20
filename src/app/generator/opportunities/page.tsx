"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface Opportunity {
  id: number;
  title: string;
  code: string;
  destination: string;
  term: string;
  deadline: string;
  seats: number;
  cover_image_url?: string;
}

export default function GeneratorOpportunities() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/opportunities")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function applyToOpportunity(opportunityId: number) {
    router.push(`/generator/opportunities/${opportunityId}/apply`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Opportunities</h1>
          <p className="text-slate-500 mt-2">Discover and apply for exchange programs.</p>
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
              className="group hover:-translate-y-1 hover:shadow-lg transition-all duration-300 border border-slate-200 hover:border-primary/30 flex flex-col"
            >
              <div className="flex-1">
                {opp.cover_image_url && (
                  <img
                    src={opp.cover_image_url}
                    alt={opp.title}
                    className="w-full h-36 object-cover rounded-xl mb-4 border border-slate-100"
                  />
                )}

                <div className="flex items-start justify-between mb-4">
                  <Badge variant="neutral" icon="pin_drop">
                    {opp.destination}
                  </Badge>
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{opp.code}</span>
                </div>

                <h3 className="text-xl font-black text-slate-900 mb-2 group-hover:text-primary transition-colors">{opp.title}</h3>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Term</span>
                    <span className="text-sm font-semibold text-slate-700">{opp.term || "-"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Seats Available</span>
                    <span className="text-sm font-semibold text-slate-700">{opp.seats ?? "-"}</span>
                  </div>
                  <div className="flex flex-col col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Application Deadline</span>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-amber-600">
                      <span className="material-symbols-outlined text-[16px]">schedule</span>
                      {opp.deadline ? new Date(opp.deadline).toLocaleDateString() : "Not specified"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100">
                <Button
                  className="w-full"
                  icon="edit_document"
                  onClick={() => applyToOpportunity(opp.id)}
                >
                  Fill and Apply
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
