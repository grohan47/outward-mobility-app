"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function CreateOpportunity() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      code: formData.get("code"),
      title: formData.get("title"),
      destination: formData.get("destination"),
      term: formData.get("term"),
      deadline: formData.get("deadline"),
      seats: Number(formData.get("seats")),
      description: formData.get("description"),
      // Hardcoded templates for MVP
      workflowTemplateId: 1, 
      formTemplateId: 1, 
    };

    try {
      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to create opportunity");
      }

      router.push("/admin");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <button onClick={() => router.back()} className="text-sm font-bold text-slate-500 hover:text-slate-900 mb-4 inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Create Opportunity</h1>
          <p className="text-slate-500 mt-2">Publish a new outward mobility program and attach its workflow.</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">Basic Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Internal Code*</label>
                <input required name="code" type="text" placeholder="e.g. MIT_SPRING_2026" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Program Title*</label>
                <input required name="title" type="text" placeholder="e.g. MIT Semester Exchange" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Description</label>
                <textarea name="description" rows={3} placeholder="Provide details about this program..." className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"></textarea>
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mt-8">Logistics</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Destination</label>
                <input name="destination" type="text" placeholder="e.g. Cambridge, MA" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Academic Term</label>
                <input name="term" type="text" placeholder="e.g. Spring 2026" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Application Deadline*</label>
                <input required name="deadline" type="date" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Available Seats</label>
                <input name="seats" type="number" min="1" placeholder="e.g. 5" className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mt-8">Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">account_tree</span>
                  Workflow Template
                </label>
                <select disabled className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm bg-white text-slate-500 cursor-not-allowed">
                  <option>OGE Outward Mobility Workflow (Default)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Fixed to default for midsem MVP</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">dynamic_form</span>
                  Form Template
                </label>
                <select disabled className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm bg-white text-slate-500 cursor-not-allowed">
                  <option>OGE Standard Application Form (Default)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1 font-medium italic">Fixed to default for midsem MVP</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-bold flex items-center gap-2">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          )}

          <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" loading={loading} icon="publish">Publish Opportunity</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
