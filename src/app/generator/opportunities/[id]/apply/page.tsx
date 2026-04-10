"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type RequiredField = {
  field_key: string;
  label: string;
  description?: string | null;
  field_hint?: string | null;
  input_type: string;
  options?: string[];
  section_key: string;
};

type OpportunityDetailPayload = {
  opportunity: {
    id: number;
    title: string;
    description: string | null;
    term: string | null;
    destination: string | null;
    deadline: string | null;
  };
  required_fields: RequiredField[];
};

function inputTypeForField(fieldType: string): "text" | "email" | "number" {
  if (fieldType === "email") return "email";
  if (fieldType === "number") return "number";
  return "text";
}

export default function OpportunityApplyPage() {
  const params = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<OpportunityDetailPayload | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [ctaItems, setCtaItems] = useState<string[]>([]);

  useEffect(() => {
    // Frontend -> API: GET /api/opportunities/:id
    fetch(`/api/opportunities/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        const requiredFields = d.required_fields || [];
        const initialValues: Record<string, string> = {};
        for (const field of requiredFields) {
          initialValues[field.field_key] = "";
        }
        setValues(initialValues);
        setPayload(d);
        setLoading(false);
      })
      .catch(() => {
        setError("Unable to load opportunity form.");
        setLoading(false);
      });
  }, [params.id]);

  useEffect(() => {
    fetch(`/api/opportunities/${params.id}/ai-cta`)
      .then((r) => r.json())
      .then((d) => setCtaItems(Array.isArray(d.ctas) ? d.ctas : []))
      .catch(() => setCtaItems([]));
  }, [params.id]);

  const fields = useMemo(() => payload?.required_fields || [], [payload]);

  function setFieldValue(fieldKey: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldKey]: value }));
  }

  async function submitApplication() {
    if (!payload) return;
    setSaving(true);
    setError(null);

    try {
      // Frontend -> API: POST /api/applications
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: payload.opportunity.id,
          submittedData: values,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.detail || body?.error || "Could not submit application");
      }

      router.push(`/generator/applications/${body.application.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit application.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center text-slate-400">
        <span className="material-symbols-outlined animate-spin text-4xl mb-4">progress_activity</span>
        Loading application form...
      </div>
    );
  }

  if (!payload) {
    return (
      <Card className="py-20 text-center text-red-600 bg-red-50 border-red-200">
        <p className="font-bold">Unable to load opportunity details.</p>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div>
        <button
          onClick={() => router.back()}
          className="text-sm font-bold text-slate-500 hover:text-slate-900 mb-4 inline-flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Opportunities
        </button>

        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Apply: {payload.opportunity.title}</h1>
        <p className="text-slate-500 mt-1">
          {[payload.opportunity.term, payload.opportunity.destination].filter(Boolean).join(" • ")}
        </p>
        {payload.opportunity.description && (
          <div className="mt-5 grid gap-4 lg:grid-cols-[2fr,1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-600 mb-1">Opportunity Description</p>
              <p className="text-sm text-slate-700 leading-6">{payload.opportunity.description}</p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-semibold text-primary mb-2">AI-Suggested CTAs</p>
              <ul className="space-y-2">
                {ctaItems.map((cta) => (
                  <li key={cta} className="text-xs text-slate-700 bg-white border border-primary/20 rounded-lg px-2.5 py-2">
                    {cta}
                  </li>
                ))}
                {ctaItems.length === 0 && <li className="text-xs text-slate-500">No CTAs generated yet.</li>}
              </ul>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <Card className="p-6 space-y-5">
        <h2 className="text-xl font-bold text-slate-900">Application Form</h2>
        {fields.length === 0 ? (
          <p className="text-sm text-slate-500">No required fields configured for this opportunity.</p>
        ) : (
          fields.map((field) => {
            if (field.input_type === "textarea") {
              return (
                <div key={field.field_key}>
                  <label className="block text-sm font-medium mb-1 text-slate-700">{field.label}</label>
                {field.description && <p className="text-xs text-slate-500 mb-2">{field.description}</p>}
                {field.field_hint && <p className="text-xs text-primary mb-2">{field.field_hint}</p>}
                <textarea
                    rows={4}
                    className="w-full border rounded-lg p-3"
                    value={values[field.field_key] || ""}
                    onChange={(e) => setFieldValue(field.field_key, e.target.value)}
                  />
                </div>
              );
            }

            if (field.input_type === "single_select") {
              return (
                <div key={field.field_key}>
                  <label className="block text-sm font-medium mb-1 text-slate-700">{field.label}</label>
                  {field.description && <p className="text-xs text-slate-500 mb-2">{field.description}</p>}
                  {field.field_hint && <p className="text-xs text-primary mb-2">{field.field_hint}</p>}
                  <select
                    className="w-full border rounded-lg p-3 bg-white"
                    value={values[field.field_key] || ""}
                    onChange={(e) => setFieldValue(field.field_key, e.target.value)}
                  >
                    <option value="">Select an option</option>
                    {(field.options || []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            if (field.input_type === "multiselect") {
              const selected = (values[field.field_key] || "").split("||").filter(Boolean);
              return (
                <div key={field.field_key}>
                  <label className="block text-sm font-medium mb-1 text-slate-700">{field.label}</label>
                  {field.description && <p className="text-xs text-slate-500 mb-2">{field.description}</p>}
                  {field.field_hint && <p className="text-xs text-primary mb-2">{field.field_hint}</p>}
                  <div className="flex flex-wrap gap-2">
                    {(field.options || []).map((option) => {
                      const isActive = selected.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          className={`rounded-full border px-3 py-1.5 text-xs transition ${
                            isActive ? "border-primary bg-primary text-white" : "border-slate-300 text-slate-700 bg-white"
                          }`}
                          onClick={() => {
                            const next = isActive ? selected.filter((item) => item !== option) : [...selected, option];
                            setFieldValue(field.field_key, next.join("||"));
                          }}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            return (
              <div key={field.field_key}>
                <label className="block text-sm font-medium mb-1 text-slate-700">{field.label}</label>
                {field.description && <p className="text-xs text-slate-500 mb-2">{field.description}</p>}
                {field.field_hint && <p className="text-xs text-primary mb-2">{field.field_hint}</p>}
                <input
                  type={inputTypeForField(field.input_type)}
                  className="w-full border rounded-lg p-3"
                  placeholder={field.input_type === "file" ? "Paste document URL" : "Enter value"}
                  value={values[field.field_key] || ""}
                  onChange={(e) => setFieldValue(field.field_key, e.target.value)}
                />
              </div>
            );
          })
        )}

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <Button loading={saving} onClick={submitApplication}>
            Submit Application
          </Button>
        </div>
      </Card>
    </div>
  );
}
