"use client";

import type { DraftOutput } from "./studioTypes";

type AIReviewPanelProps = {
  draft: DraftOutput | null;
  answers: Record<string, string>;
  mode: "ai" | "manual";
  expandedSection: "summary" | "questions" | "warnings" | "confidence" | null;
  answering: boolean;
  onExpand: (section: "summary" | "questions" | "warnings" | "confidence" | null) => void;
  onAnswerChange: (question: string, answer: string) => void;
  onSubmitAnswers: () => void;
};

export default function AIReviewPanel({
  draft,
  answers,
  mode,
  expandedSection,
  answering,
  onExpand,
  onAnswerChange,
  onSubmitAnswers,
}: AIReviewPanelProps) {
  if (mode !== "ai" || !draft) return null;

  const openQuestions = draft.clarifying_questions.filter((question) => !answers[question]?.trim());
  const warnings = draft.warnings || [];
  const confidencePct = Math.round((draft.confidence || 0) * 100);

  return (
    <section className="border-b border-amber-200 bg-amber-50/50">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <Chip
          active={expandedSection === "summary"}
          tone="green"
          label="Summary"
          icon="check_circle"
          onClick={() => onExpand(expandedSection === "summary" ? null : "summary")}
        />
        <Chip
          active={expandedSection === "questions"}
          tone={openQuestions.length > 0 ? "amber" : "green"}
          label={openQuestions.length > 0 ? `${openQuestions.length} Questions pending` : "All answered"}
          icon={openQuestions.length > 0 ? "help" : "check_circle"}
          onClick={() => onExpand(expandedSection === "questions" ? null : "questions")}
        />
        <Chip
          active={expandedSection === "warnings"}
          tone={warnings.length > 0 ? "amber" : "green"}
          label={warnings.length > 0 ? `${warnings.length} Warnings` : "No Warnings"}
          icon={warnings.length > 0 ? "warning" : "check_circle"}
          onClick={() => onExpand(expandedSection === "warnings" ? null : "warnings")}
        />
        <Chip
          active={expandedSection === "confidence"}
          tone={confidencePct >= 80 ? "green" : confidencePct >= 60 ? "amber" : "red"}
          label={`${confidencePct}% confidence`}
          icon="radio_button_checked"
          onClick={() => onExpand(expandedSection === "confidence" ? null : "confidence")}
        />
      </div>

      {expandedSection && (
        <div className="border-t border-amber-100 bg-white/60 px-4 py-4">
          {expandedSection === "summary" && (
            <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <SummaryItem label="Title" value={draft.opportunity.title} />
              <SummaryItem label="Host" value={draft.opportunity.host_institution || draft.opportunity.destination || "Not specified"} />
              <SummaryItem label="Program type" value={draft.opportunity.program_type || draft.opportunity.term || "Not specified"} />
              <SummaryItem label="Eligibility" value={draft.opportunity.eligibility_criteria || draft.opportunity.visibility || "Plaksha only"} />
              <div className="md:col-span-2">
                <SummaryItem label="Description" value={draft.opportunity.description} />
              </div>
            </div>
          )}

          {expandedSection === "questions" && (
            <div className="space-y-3">
              {draft.clarifying_questions.length === 0 ? (
                <p className="text-sm font-medium text-emerald-700">No questions - ready to review.</p>
              ) : (
                <>
                  {draft.clarifying_questions.slice(0, 2).map((question) => (
                    <div key={question} className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-sm text-slate-700">PRISM: {question}</p>
                      <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Your answer
                        <input
                          className="mt-1 w-full border-0 border-b border-slate-300 bg-transparent px-0 py-2 text-sm normal-case tracking-normal outline-none focus:border-indigo-400"
                          value={answers[question] || ""}
                          onChange={(event) => onAnswerChange(question, event.target.value)}
                        />
                      </label>
                    </div>
                  ))}
                  {draft.clarifying_questions.length > 2 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      {draft.clarifying_questions.length - 2} more questions collapsed
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={onSubmitAnswers}
                    disabled={answering || openQuestions.length > 0}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {answering && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                    Reanalyze with answers
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </>
              )}
            </div>
          )}

          {expandedSection === "warnings" && (
            <div className="space-y-2">
              {warnings.length === 0 ? (
                <p className="text-sm font-medium text-emerald-700">No warnings detected.</p>
              ) : (
                warnings.map((warning) => (
                  <div key={warning} className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <span className="material-symbols-outlined text-[18px]">warning</span>
                    <span>{warning}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {expandedSection === "confidence" && (
            <div className="max-w-xl">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-primary" style={{ width: `${confidencePct}%` }} />
              </div>
              <p className="mt-3 text-sm text-slate-600">
                PRISM is confident about the reviewer structure when the graph validates and all clarifying questions are answered.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Chip({
  active,
  icon,
  label,
  tone,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  tone: "green" | "amber" | "red";
  onClick: () => void;
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${tones[tone]} ${
        active ? "ring-2 ring-indigo-300" : ""
      }`}
    >
      <span className="material-symbols-outlined text-[15px]">{icon}</span>
      {label}
    </button>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value}</p>
    </div>
  );
}
