import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/schema";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  ensureDbInitialized();
  const db = getDb();

  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get student profile ID
  const profile = db
    .prepare(`SELECT id FROM student_profiles WHERE user_id = ?`)
    .get(session.userId) as any;

  if (!profile) {
    return NextResponse.json({ error: "Student profile not found for user" }, { status: 404 });
  }

  const rows = db
    .prepare(`SELECT * FROM applications WHERE student_profile_id = ? ORDER BY id DESC`)
    .all(profile.id);

  const enriched = (rows as any[]).map((row) => {
    const opportunity = db
      .prepare(`SELECT * FROM opportunities WHERE id = ?`)
      .get(row.opportunity_id);

    const stageLabels: Record<string, string> = {
      STUDENT_SUBMISSION: "Student Submission",
      STUDENT_LIFE: "Student Life Review",
      PROGRAM_CHAIR: "Program Chair Review",
      OGE: "OGE Office",
      DEAN: "Dean Academics Final",
      CLOSED: "Closed",
    };

    return {
      ...row,
      opportunity,
      workflow: {
        stageCode: row.current_stage,
        stageLabel: stageLabels[row.current_stage] ?? row.current_stage,
        currentStakeholder: row.final_status
          ? "Completed"
          : stageLabels[row.current_stage] ?? "Unknown",
        finalStatus: row.final_status,
      },
    };
  });

  return NextResponse.json({ items: enriched });
}
