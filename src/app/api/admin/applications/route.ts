import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/schema";

export async function GET(req: NextRequest) {
  ensureDbInitialized();
  const db = getDb();

  const rows = db.prepare(`SELECT * FROM applications ORDER BY id DESC`).all();

  const enriched = (rows as any[]).map((row) => {
    const opportunity = db.prepare(`SELECT * FROM opportunities WHERE id = ?`).get(row.opportunity_id);
    const profile = db.prepare(`SELECT * FROM student_profiles WHERE id = ?`).get(row.student_profile_id);
    const user = profile
      ? db.prepare(`SELECT * FROM users WHERE id = ?`).get((profile as any).user_id)
      : null;

    return {
      ...row,
      opportunity,
      student_profile: profile,
      student_user: user,
      workflow: {
        stageCode: row.current_stage,
        stageLabel: row.current_stage,
        finalStatus: row.final_status,
      },
    };
  });

  return NextResponse.json({ items: enriched });
}
