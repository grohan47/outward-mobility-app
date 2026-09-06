export type CommentVisibility = "internal" | "student_visible";

export type AudienceOption = {
  value: CommentVisibility;
  label: string;
  description: string;
};

export const STAFF_AUDIENCES: AudienceOption[] = [
  {
    value: "internal",
    label: "Review team",
    description: "Visible to administrators and authorized reviewers.",
  },
  {
    value: "student_visible",
    label: "Student and review team",
    description: "Visible to the student and authorized staff.",
  },
];

export const STUDENT_AUDIENCES: AudienceOption[] = [
  {
    value: "student_visible",
    label: "Student and review team",
    description: "Visible to you and authorized staff.",
  },
];

export function labelForVisibility(
  visibility: string | undefined,
): string {
  return visibility === "student_visible" ? "Student visible" : "Review team";
}
