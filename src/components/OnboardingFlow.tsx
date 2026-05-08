"use client";

import { useState } from "react";
import type { ReactNode } from "react";

type OnboardingFlowProps = {
  onComplete: (profile: { displayName: string; pronouns: string; department: string }) => void;
};

const steps = [
  { label: "Welcome", icon: "waving_hand" },
  { label: "Profile", icon: "person" },
  { label: "Tour", icon: "explore" },
];

const tourCards = [
  {
    icon: "inbox",
    title: "Your Task Inbox",
    body: "Applications assigned to you appear in the reviewer workspace with the current stage, applicant details, and due status.",
  },
  {
    icon: "fact_check",
    title: "Reviewing Applications",
    body: "Open an application to review visible fields, add stage inputs, comment, approve, flag, or request changes.",
  },
  {
    icon: "notifications",
    title: "SLA Alerts",
    body: "PRISM highlights work that is due soon or overdue so review chains do not stall silently.",
  },
  {
    icon: "lock",
    title: "Scoped Access",
    body: "Each workflow stage controls which applicant fields and prior comments you can see.",
  },
];

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [activeTour, setActiveTour] = useState(0);
  const [profile, setProfile] = useState({ displayName: "", pronouns: "", department: "" });
  const [error, setError] = useState<string | null>(null);

  function completeProfile() {
    if (!profile.displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    setError(null);
    setStep(2);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-xl">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
            <span className="material-symbols-outlined text-[20px]">diamond</span>
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900">PRISM</span>
        </div>

        <div className="mb-6 flex items-center justify-center gap-2">
          {steps.map((item, index) => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                  index === step
                    ? "border-primary bg-primary text-white"
                    : index < step
                      ? "border-primary/30 bg-primary/10 text-primary-dark"
                      : "border-slate-200 bg-white text-slate-400"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{index < step ? "check_circle" : item.icon}</span>
                {item.label}
              </div>
              {index < steps.length - 1 && <div className={`h-px w-6 ${index < step ? "bg-primary" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
          {step === 0 && (
            <div className="p-8">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary-dark">
                <span className="material-symbols-outlined text-4xl">waving_hand</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">You have been added to a review chain</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Set up your reviewer profile and take a quick tour before opening your PRISM workspace.
              </p>
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Your role</p>
                <p className="mt-1 text-sm font-bold text-slate-800">Reviewer / Approver</p>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white"
              >
                Get Started
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5 p-8">
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-900">Your Profile</h2>
                <p className="mt-1 text-sm text-slate-500">This is how colleagues will see you in PRISM.</p>
              </div>
              <Field label="Display Name" required error={error}>
                <input
                  value={profile.displayName}
                  onChange={(event) => setProfile((prev) => ({ ...prev, displayName: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                  placeholder="Dr. Ananya Krishnan"
                />
              </Field>
              <Field label="Pronouns">
                <input
                  value={profile.pronouns}
                  onChange={(event) => setProfile((prev) => ({ ...prev, pronouns: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                  placeholder="Optional"
                />
              </Field>
              <Field label="Department / Team">
                <select
                  value={profile.department}
                  onChange={(event) => setProfile((prev) => ({ ...prev, department: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">Select department</option>
                  {["Faculty", "Academic Affairs", "International Relations", "Student Affairs", "Administration", "Other"].map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </Field>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(0)} className="h-11 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700">
                  Back
                </button>
                <button type="button" onClick={completeProfile} className="h-11 flex-1 rounded-xl bg-primary px-4 text-sm font-bold text-white">
                  Save and Continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 p-8">
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-900">Quick Tour</h2>
                <p className="mt-1 text-sm text-slate-500">The reviewer workspace is built around focused action.</p>
              </div>
              <div className="space-y-2">
                {tourCards.map((card, index) => (
                  <button
                    key={card.title}
                    type="button"
                    onClick={() => setActiveTour(activeTour === index ? -1 : index)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary-dark">{card.icon}</span>
                      <span className="flex-1 text-sm font-bold text-slate-800">{card.title}</span>
                      <span className="material-symbols-outlined text-[18px] text-slate-400">expand_more</span>
                    </div>
                    {activeTour === index && <p className="mt-3 pl-9 text-sm leading-6 text-slate-600">{card.body}</p>}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(1)} className="h-11 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700">
                  Back
                </button>
                <button type="button" onClick={() => onComplete(profile)} className="h-11 flex-1 rounded-xl bg-primary px-4 text-sm font-bold text-white">
                  Go to My Inbox
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs font-semibold text-red-600">{error}</span> : null}
    </label>
  );
}
