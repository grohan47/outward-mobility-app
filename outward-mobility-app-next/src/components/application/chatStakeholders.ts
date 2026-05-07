export type StakeholderOption = {
  key: string;
  label: string;
  subtitle?: string;
};

type PipelineStepLike = {
  step_name?: string;
  reviewer_email?: string;
  reviewer_display_name?: string;
  reviewerName?: string;
};

function dedupeOptions(options: StakeholderOption[]): StakeholderOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (!option.key || seen.has(option.key)) {
      return false;
    }
    seen.add(option.key);
    return true;
  });
}

export function buildStakeholderOptions(args: {
  studentName?: string | null;
  pipelineSteps?: PipelineStepLike[] | null;
}): StakeholderOption[] {
  const options: StakeholderOption[] = [
    {
      key: "internal",
      label: "General",
      subtitle: "Shared application thread",
    },
  ];

  if (args.studentName) {
    options.push({
      key: "recipient:student",
      label: args.studentName,
      subtitle: "Student",
    });
  }

  for (const step of args.pipelineSteps || []) {
    const reviewerEmail = step.reviewer_email?.trim().toLowerCase();
    if (!reviewerEmail) continue;

    options.push({
      key: `recipient:${reviewerEmail}`,
      label: step.reviewer_display_name || step.reviewerName || step.step_name || reviewerEmail,
      subtitle: step.step_name || reviewerEmail,
    });
  }

  return dedupeOptions(options);
}

export function labelForVisibility(
  visibility: string | undefined,
  options: StakeholderOption[],
): string | null {
  const normalized = (visibility || "internal").trim().toLowerCase();
  if (normalized === "internal") return null;

  return options.find((option) => option.key === normalized)?.label || null;
}
