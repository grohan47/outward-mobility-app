import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/schema";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureDbInitialized();
  const db = getDb();
  const applicationId = Number(params.id);

  try {
    const body = await req.json();
    const { reviewerEmail, remarks } = body;

    const application = db
      .prepare(`SELECT * FROM applications WHERE id = ?`)
      .get(applicationId) as any;
    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    if (application.final_status || application.current_stage === "CLOSED") {
      return NextResponse.json({ error: "Application is already closed" }, { status: 400 });
    }

    const reviewer = db.prepare(`SELECT * FROM users WHERE email = ?`).get(reviewerEmail) as any;
    const now = new Date().toISOString();

    // Send back to student submission for corrections
    db.prepare(
      `UPDATE applications SET current_stage = 'STUDENT_SUBMISSION', updated_at = ? WHERE id = ?`
    ).run(now, applicationId);

    // Record review
    db.prepare(
      `INSERT INTO application_reviews (application_id, review_role, verification_outcome, remarks, visibility_scope, created_by, created_at)
       VALUES (?, ?, 'FLAG', ?, 'STUDENT_VISIBLE', ?, ?)`
    ).run(applicationId, application.current_stage, remarks ?? "Changes requested.", reviewer?.id ?? 0, now);

    // Timeline event
    db.prepare(
      `INSERT INTO timeline_events (application_id, event_type, event_payload, actor_user_id, created_at)
       VALUES (?, 'DECISION_RECORDED', ?, ?, ?)`
    ).run(
      applicationId,
      JSON.stringify({
        decision: "FLAG",
        from_stage: application.current_stage,
        to_stage: "STUDENT_SUBMISSION",
      }),
      reviewer?.id ?? 0,
      now
    );

    const updated = db.prepare(`SELECT * FROM applications WHERE id = ?`).get(applicationId);
    return NextResponse.json({ application: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
