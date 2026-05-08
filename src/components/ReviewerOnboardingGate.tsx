"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/types";

type ProfileState = {
  displayName: string;
  pronouns: string;
  department: string;
  notifyEmail: boolean;
  notifyDigest: boolean;
};

export function ReviewerOnboardingGate({
  initialUser,
  children,
}: {
  initialUser: SessionUser;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [complete, setComplete] = useState(Boolean(initialUser.reviewerOnboarded));
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileState>({
    displayName: initialUser.name || "",
    pronouns: initialUser.pronouns || "",
    department: initialUser.department || "",
    notifyEmail: initialUser.notifyEmail !== false,
    notifyDigest: Boolean(initialUser.notifyDigest),
  });

  async function finish() {
    if (!profile.displayName.trim()) {
      setStep(1);
      setError("Display name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/reviewer/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.detail || "Unable to complete onboarding.");
      setComplete(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete onboarding.");
    } finally {
      setSaving(false);
    }
  }

  if (complete) return <>{children}</>;

  const steps = [
    { label: "Welcome", icon: "waving_hand" },
    { label: "Profile", icon: "person" },
    { label: "Inbox", icon: "inbox" },
  ];

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,_#f8fafc_0%,_#eefbf2_50%,_#e7f7ec_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl flex-col items-center justify-center">
        <div className="mb-9 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
            <svg viewBox="0 0 48 48" className="h-5 w-5" fill="currentColor">
              <path
                clipRule="evenodd"
                d="M47.2426 24L24 47.2426L0.757355 24L24 0.757355L47.2426 24ZM12.2426 21H35.7574L24 9.24264L12.2426 21Z"
                fillRule="evenodd"
              />
            </svg>
          </div>
          <span className="text-xl font-black text-slate-950">PRISM</span>
        </div>

        <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
          {steps.map((item, index) => (
            <div
              key={item.label}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold ${
                index === step
                  ? "border-primary bg-primary text-white"
                  : index < step
                    ? "border-primary/30 bg-primary/10 text-primary-dark"
                    : "border-slate-200 bg-white text-slate-400"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{index < step ? "check_circle" : item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>

        <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
          {step === 0 && (
            <section className="p-8 sm:p-10">
              <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                <span className="material-symbols-outlined text-4xl text-primary">waving_hand</span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950">You've been added to a review chain</h1>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                PRISM is used by Plaksha to manage outward mobility approvals. Your email was added as a reviewer, so we created your reviewer workspace automatically.
              </p>
              <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400">Signed in as</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{initialUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary-dark"
              >
                Get started
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </section>
          )}

          {step === 1 && (
            <section className="p-8 sm:p-10">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">Your profile</h2>
              <p className="mt-2 text-sm text-slate-500">This is how colleagues will see you in review activity.</p>
              <div className="mt-7 space-y-5">
                <LabeledInput
                  label="Display name"
                  value={profile.displayName}
                  onChange={(value) => setProfile((current) => ({ ...current, displayName: value }))}
                  placeholder="Dr. Ananya Krishnan"
                  required
                />
                <LabeledInput
                  label="Pronouns"
                  value={profile.pronouns}
                  onChange={(value) => setProfile((current) => ({ ...current, pronouns: value }))}
                  placeholder="Optional"
                />
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Department / team</span>
                  <select
                    value={profile.department}
                    onChange={(event) => setProfile((current) => ({ ...current, department: event.target.value }))}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select department</option>
                    {["Faculty", "Academic Affairs", "International Relations", "Student Affairs", "Administration", "Other"].map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400">Notifications</p>
                  <ToggleRow
                    label="Email me when an application needs my action"
                    checked={profile.notifyEmail}
                    onChange={(value) => setProfile((current) => ({ ...current, notifyEmail: value }))}
                  />
                  <ToggleRow
                    label="Send a daily digest"
                    checked={profile.notifyDigest}
                    onChange={(value) => setProfile((current) => ({ ...current, notifyDigest: value }))}
                  />
                </div>
              </div>
              {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}
              <div className="mt-8 flex gap-3">
                <button type="button" onClick={() => setStep(0)} className="h-11 rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-700">Back</button>
                <button
                  type="button"
                  onClick={() => profile.displayName.trim() ? setStep(2) : setError("Display name is required.")}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white hover:bg-primary-dark"
                >
                  Continue
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="p-8 sm:p-10">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">Your reviewer inbox</h2>
              <div className="mt-6 space-y-3">
                {[
                  ["inbox", "Assigned applications land in your task inbox."],
                  ["fact_check", "Open a task to review applicant data and record a decision."],
                  ["lock", "Each workflow controls which fields you can see at your stage."],
                ].map(([icon, text]) => (
                  <div key={text} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <span className="material-symbols-outlined text-primary">{icon}</span>
                    <p className="text-sm font-medium text-slate-700">{text}</p>
                  </div>
                ))}
              </div>
              {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}
              <div className="mt-8 flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="h-11 rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-700">Back</button>
                <button
                  type="button"
                  onClick={finish}
                  disabled={saving}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Go to my inbox"}
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 py-2 text-left"
    >
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-primary" : "bg-slate-300"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </span>
    </button>
  );
}
