"use client";
import type { CatalogField, CustomFieldDraft, DraftOutput, StudentVisibilityRule, OpportunityData, OpportunityDetailField } from "./studioTypes";

function mergeDetailFields(current: OpportunityDetailField[], additions: OpportunityDetailField[]): OpportunityDetailField[] {
  const existing = new Set(current.map((field) => field.field_key));
  return [...current, ...additions.filter((field) => !existing.has(field.field_key))];
}

export function SetupScreen({
  opportunity,
  setOpportunity,
  detailFields,
  setDetailFields,
  summaryIsStale,
  onGenerateSummary,
  aiPrompt,
  setAiPrompt,
  aiGenerating,
  draftOutput,
  answers,
  answering,
  openQuestions,
  onGenerateDraft,
  onAnswerChange,
  onSubmitAnswers,
  onContinue,
}: {
  opportunity: OpportunityData;
  setOpportunity: React.Dispatch<React.SetStateAction<OpportunityData>>;
  detailFields: OpportunityDetailField[];
  setDetailFields: React.Dispatch<React.SetStateAction<OpportunityDetailField[]>>;
  summaryIsStale: boolean;
  onGenerateSummary: () => void;
  aiPrompt: string;
  setAiPrompt: (value: string) => void;
  aiGenerating: boolean;
  draftOutput: DraftOutput | null;
  answers: Record<string, string>;
  answering: boolean;
  openQuestions: string[];
  onGenerateDraft: () => void;
  onAnswerChange: (question: string, answer: string) => void;
  onSubmitAnswers: () => void;
  onContinue: () => void;
}) {
  return (
    <main className="flex-1 overflow-y-auto bg-slate-50">
      <div className="mx-auto grid max-w-7xl gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 border-b border-slate-100 pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Details</p>
              <h2 className="mt-1 font-display text-xl font-semibold text-slate-900">Opportunity setup</h2>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <CompactInput label="Title" value={opportunity.title} onChange={(value) => setOpportunity((prev) => ({ ...prev, title: value }))} />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Code</span>
              <input
                className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm font-semibold text-slate-500"
                value={opportunity.code || "Auto-generated on save"}
                readOnly
              />
            </label>
          </div>

          <div className="mt-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Description</span>
              <textarea
                rows={3}
                className="w-full resize-none rounded-lg border border-slate-200 p-3 text-sm leading-6 text-slate-700 outline-none focus:border-primary"
                value={opportunity.description}
                onChange={(event) => setOpportunity((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Program summary, eligibility notes, funding context, and application expectations"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CompactInput label="Destination" value={opportunity.destination} onChange={(value) => setOpportunity((prev) => ({ ...prev, destination: value }))} />
            <CompactInput label="Term" value={opportunity.term} onChange={(value) => setOpportunity((prev) => ({ ...prev, term: value }))} />
            <CompactInput label="Application deadline" type="date" value={opportunity.deadline} onChange={(value) => setOpportunity((prev) => ({ ...prev, deadline: value }))} />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Seats</span>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                value={opportunity.seats || ""}
                onChange={(event) => setOpportunity((prev) => ({ ...prev, seats: Number(event.target.value) || 0 }))}
              />
            </label>
          </div>
          <div className="mt-3">
            <CompactInput label="Cover image URL" type="url" value={opportunity.cover_image_url} onChange={(value) => setOpportunity((prev) => ({ ...prev, cover_image_url: value }))} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <RailSection title={`Student Detail Fields (${detailFields.length})`}>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDetailFields((prev) => [
                      ...prev,
                      {
                        field_key: `detail_${Date.now()}`,
                        label: "Custom Detail",
                        value: "",
                        value_type: "text",
                        display_order: prev.length + 1,
                        is_student_visible: true,
                      },
                    ])
                  }
                  className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-primary-dark"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Add Detail
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDetailFields((prev) =>
                      mergeDetailFields(prev, [
                        {
                          field_key: "application_deadline",
                          label: "Application Deadline",
                          value: "",
                          value_type: "date",
                          display_order: prev.length + 1,
                          is_student_visible: true,
                        },
                      ])
                    )
                  }
                  className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-amber-700"
                >
                  <span className="material-symbols-outlined text-[18px]">event</span>
                  Add Deadline
                </button>
              </div>
              <div className="space-y-2">
                {detailFields.length === 0 && <p className="text-sm text-slate-500">No custom student-facing details yet.</p>}
                {detailFields.map((field, index) => (
                  <div key={field.field_key} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 md:grid-cols-[minmax(120px,0.8fr)_110px_minmax(160px,1.2fr)_40px]">
                    <input
                      className="min-h-[38px] rounded-md border border-slate-200 bg-white px-2 text-sm"
                      value={field.label}
                      onChange={(event) =>
                        setDetailFields((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))
                      }
                      placeholder="Label"
                    />
                    <select
                      className="min-h-[38px] rounded-md border border-slate-200 bg-white px-2 text-sm"
                      value={field.value_type}
                      onChange={(event) =>
                        setDetailFields((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, value_type: event.target.value as OpportunityDetailField["value_type"] } : item)))
                      }
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                    </select>
                    <input
                      type={field.value_type === "date" ? "date" : field.value_type === "number" ? "number" : "text"}
                      className="min-h-[38px] rounded-md border border-slate-200 bg-white px-2 text-sm"
                      value={field.value}
                      onChange={(event) =>
                        setDetailFields((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, value: event.target.value } : item)))
                      }
                      placeholder="Value"
                    />
                    <button
                      type="button"
                      className="flex min-h-[38px] items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-red-600"
                      onClick={() => setDetailFields((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                      aria-label={`Remove ${field.label || "detail field"}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </RailSection>

            <RailSection title="Student Summary">
              <div className="space-y-2">
                {summaryIsStale && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    Summary may be stale after your edits.
                  </div>
                )}
                {(opportunity.ai_summary_bullets || []).map((bullet, index) => (
                  <input
                    key={index}
                    className="min-h-[38px] w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                    value={bullet}
                    onChange={(event) =>
                      setOpportunity((prev) => ({
                        ...prev,
                        ai_summary_bullets: (prev.ai_summary_bullets || []).map((item, itemIndex) => (itemIndex === index ? event.target.value : item)),
                      }))
                    }
                    placeholder="Summary bullet"
                  />
                ))}
                {(opportunity.ai_summary_bullets || []).length === 0 && <p className="text-sm text-slate-500">Generate or add a few bullets for students.</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onGenerateSummary} className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-primary-dark">
                  <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
                  Generate Summary
                </button>
                <button
                  type="button"
                  onClick={() => setOpportunity((prev) => ({ ...prev, ai_summary_bullets: [...(prev.ai_summary_bullets || []), ""] }))}
                  className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-slate-600"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Add Bullet
                </button>
              </div>
            </RailSection>
          </div>
        </section>

        <AIAssistantPanel
          aiPrompt={aiPrompt}
          setAiPrompt={setAiPrompt}
          aiGenerating={aiGenerating}
          draftOutput={draftOutput}
          answers={answers}
          answering={answering}
          openQuestions={openQuestions}
          onGenerateDraft={onGenerateDraft}
          onAnswerChange={onAnswerChange}
          onSubmitAnswers={onSubmitAnswers}
        />
      </div>
    </main>
  );
}

export function ApplicationFormScreen({
  selectedFields,
  setSelectedFields,
  selectableFields,
  customFields,
  setCustomFields,
  visibilityRules,
  setVisibilityRules,
  onBack,
  onContinue,
}: {
  selectedFields: string[];
  setSelectedFields: React.Dispatch<React.SetStateAction<string[]>>;
  selectableFields: CatalogField[];
  customFields: CustomFieldDraft[];
  setCustomFields: React.Dispatch<React.SetStateAction<CustomFieldDraft[]>>;
  visibilityRules: StudentVisibilityRule[];
  setVisibilityRules: React.Dispatch<React.SetStateAction<StudentVisibilityRule[]>>;
  onBack: () => void;
  onContinue: () => void;
}) {
  const selectedSet = new Set(selectedFields);

  function addCustomField() {
    const fieldKey = `custom_${Date.now()}`;
    setCustomFields((prev) => [
      ...prev,
      {
        field_key: fieldKey,
        label: "Custom Field",
        description: "",
        fieldHint: "",
        inputType: "text",
        optionsText: "",
        persistForFuture: true,
      },
    ]);
    setSelectedFields((prev) => [...prev, fieldKey]);
  }

  function updateCustomField(index: number, patch: Partial<CustomFieldDraft>) {
    setCustomFields((prev) => prev.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)));
  }

  function removeCustomField(index: number) {
    const field = customFields[index];
    setCustomFields((prev) => prev.filter((_, fieldIndex) => fieldIndex !== index));
    if (field) setSelectedFields((prev) => prev.filter((key) => key !== field.field_key));
  }

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50">
      <div className="mx-auto grid max-w-7xl gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Application Form</p>
              <h2 className="mt-1 font-display text-xl font-semibold text-slate-900">Applicant fields</h2>
            </div>
            <button type="button" onClick={addCustomField} className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Field
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <RailSection title={`Selected Fields (${selectedFields.length})`}>
              <div className="flex flex-wrap gap-2">
                {selectableFields.map((field) => {
                  const checked = selectedSet.has(field.field_key);
                  return (
                    <button
                      key={field.field_key}
                      type="button"
                      onClick={() => setSelectedFields((prev) => (checked ? prev.filter((key) => key !== field.field_key) : [...prev, field.field_key]))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        checked ? "border-primary bg-primary text-white" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                      }`}
                    >
                      {field.label}
                    </button>
                  );
                })}
              </div>
            </RailSection>

            <RailSection title="Field Inspector">
              <div className="space-y-3">
                {customFields.length === 0 && <p className="text-sm text-slate-500">Add a custom applicant field to edit labels, hints, options, and reuse.</p>}
                {customFields.map((field, index) => (
                  <div key={field.field_key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_36px]">
                      <input
                        className="min-h-[38px] rounded-md border border-slate-200 bg-white px-2 text-sm"
                        value={field.label}
                        onChange={(event) => updateCustomField(index, { label: event.target.value })}
                        placeholder="Field label"
                      />
                      <select
                        className="min-h-[38px] rounded-md border border-slate-200 bg-white px-2 text-sm"
                        value={field.inputType}
                        onChange={(event) => updateCustomField(index, { inputType: event.target.value as CustomFieldDraft["inputType"] })}
                      >
                        <option value="text">Text box</option>
                        <option value="textarea">Textarea</option>
                        <option value="single_select">Single select</option>
                        <option value="multiselect">Multiselect</option>
                      </select>
                      <button type="button" onClick={() => removeCustomField(index)} className="flex min-h-[38px] items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-red-600">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      className="mt-2 w-full resize-none rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                      value={field.description}
                      onChange={(event) => updateCustomField(index, { description: event.target.value })}
                      placeholder="Description shown under the field"
                    />
                    <input
                      className="mt-2 min-h-[38px] w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                      value={field.fieldHint}
                      onChange={(event) => updateCustomField(index, { fieldHint: event.target.value })}
                      placeholder="Student-facing hint"
                    />
                    {(field.inputType === "single_select" || field.inputType === "multiselect") && (
                      <textarea
                        rows={2}
                        className="mt-2 w-full resize-none rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
                        value={field.optionsText}
                        onChange={(event) => updateCustomField(index, { optionsText: event.target.value })}
                        placeholder="Options separated by commas or new lines"
                      />
                    )}
                    <label className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={field.persistForFuture !== false}
                        onChange={(event) => updateCustomField(index, { persistForFuture: event.target.checked })}
                      />
                      Persist this field for future opportunities
                    </label>
                  </div>
                ))}
              </div>
            </RailSection>
          </div>
        </section>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4 xl:self-start">
          <RailSection title="Eligibility">
            <div className="space-y-2">
              {visibilityRules.map((rule, index) => (
                <div key={`${rule.ruleValue || "visibility"}-${index}`}>
                  <input
                    className="min-h-[40px] w-full rounded-lg border border-slate-200 p-2 text-sm"
                    value={rule.ruleValue}
                    onChange={(event) => setVisibilityRules((prev) => prev.map((item, ruleIndex) => (ruleIndex === index ? { ...item, ruleValue: event.target.value } : item)))}
                    placeholder="e.g. ug.2024@plaksha.edu.in"
                  />
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setVisibilityRules((prev) => [...prev, { ruleValue: "" }])} className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-primary-dark">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Email
            </button>
          </RailSection>
          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onBack} className="min-h-[40px] rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Back
            </button>
            <button type="button" onClick={onContinue} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white shadow-sm">
              Build Pipeline
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}

function AIAssistantPanel({
  aiPrompt,
  setAiPrompt,
  aiGenerating,
  draftOutput,
  answers,
  answering,
  openQuestions,
  onGenerateDraft,
  onAnswerChange,
  onSubmitAnswers,
}: {
  aiPrompt: string;
  setAiPrompt: (value: string) => void;
  aiGenerating: boolean;
  draftOutput: DraftOutput | null;
  answers: Record<string, string>;
  answering: boolean;
  openQuestions: string[];
  onGenerateDraft: () => void;
  onAnswerChange: (question: string, answer: string) => void;
  onSubmitAnswers: () => void;
}) {
  const allQuestionsAnswered = (draftOutput?.clarifying_questions || []).length > 0 && openQuestions.length === 0;

  return (
    <aside className="rounded-xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-4 lg:self-start">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined rounded-full bg-primary/10 p-2 text-[20px] text-primary-dark">auto_awesome</span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">PRISM assistant</h2>
            <p className="text-xs text-slate-500">Paste a brief, ask for missing details, or revise the draft.</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-3">
        {draftOutput && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-emerald-800">Draft filled</p>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-emerald-700">{Math.round((draftOutput.confidence || 0) * 100)}%</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-emerald-800">
              {(draftOutput.graph.levels?.flatMap((level) => level.reviewers).length ?? draftOutput.graph.nodes?.filter((node) => node.node_type === "reviewer").length ?? 0)} reviewer node
              {(draftOutput.graph.levels?.flatMap((level) => level.reviewers).length ?? draftOutput.graph.nodes?.filter((node) => node.node_type === "reviewer").length ?? 0) === 1 ? "" : "s"} prepared.
            </p>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-sm font-medium text-slate-700">What should PRISM help fill?</p>
          <textarea
            rows={5}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 outline-none focus:border-primary"
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
            placeholder="Paste the opportunity email, or ask: Fill in the missing basics and propose a reviewer pipeline."
          />
          <button
            type="button"
            onClick={onGenerateDraft}
            disabled={aiGenerating}
            className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {aiGenerating ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> : <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>}
            {aiGenerating ? "PRISM is filling..." : draftOutput ? "Ask PRISM to revise" : "Ask PRISM to fill this in"}
          </button>
        </div>

        {draftOutput?.clarifying_questions && draftOutput.clarifying_questions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Questions</p>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${openQuestions.length === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {openQuestions.length === 0 ? "All answered" : `${openQuestions.length} open`}
              </span>
            </div>
            {draftOutput.clarifying_questions.slice(0, 2).map((question) => (
              <label key={question} className="block rounded-lg border border-slate-200 bg-white p-3">
                <span className="block text-sm leading-5 text-slate-700">PRISM: {question}</span>
                <input
                  className="mt-3 w-full border-0 border-b border-slate-300 bg-transparent px-0 py-2 text-sm outline-none focus:border-primary"
                  value={answers[question] || ""}
                  onChange={(event) => onAnswerChange(question, event.target.value)}
                  placeholder="Your answer"
                />
              </label>
            ))}
            {draftOutput.clarifying_questions.length > 2 && <p className="text-xs text-slate-500">{draftOutput.clarifying_questions.length - 2} more questions hidden until these are answered.</p>}
            <button
              type="button"
              onClick={onSubmitAnswers}
              disabled={!allQuestionsAnswered || answering}
              className="inline-flex min-h-[40px] w-full items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              {answering ? "Regenerating..." : "Submit and Regenerate"}
            </button>
          </div>
        )}

        {draftOutput?.warnings && draftOutput.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-800">Warnings</p>
            <div className="space-y-1">
              {draftOutput.warnings.slice(0, 3).map((warning, index) => (
                <p key={`${index}-${warning}`} className="text-sm leading-5 text-amber-900">{warning}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function CompactInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <input type={type} className="w-full rounded-lg border border-slate-200 p-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
