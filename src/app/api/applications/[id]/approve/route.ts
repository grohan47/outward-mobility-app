import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/schema";

const STAGE_ORDER = [
  "STUDENT_SUBMISSION",
  "STUDENT_LIFE",
  "PROGRAM_CHAIR",
  "OGE",
  "DEAN",
];

function getNextStage(current: string): string {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return "CLOSED";
  return STAGE_ORDER[idx + 1];
}

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

    const reviewer = db
      .prepare(`SELECT * FROM users WHERE email = ?`)
      .get(reviewerEmail) as any;
    const reviewerUserId = reviewer?.id ?? 0;

    const now = new Date().toISOString();
    const nextStage = getNextStage(application.current_stage);
    const finalStatus = nextStage === "CLOSED" ? "APPROVED" : null;

    // Update application
    db.prepare(
      `UPDATE applications SET current_stage = ?, final_status = ?, updated_at = ? WHERE id = ?`
    ).run(nextStage, finalStatus, now, applicationId);

    // Record review
    db.prepare(
      `INSERT INTO application_reviews (application_id, review_role, verification_outcome, remarks, visibility_scope, created_by, created_at)
       VALUES (?, ?, 'APPROVE', ?, 'INTERNAL', ?, ?)`
    ).run(applicationId, application.current_stage, remarks ?? "Approved.", reviewerUserId, now);

    // Record decision
    db.prepare(
      `INSERT INTO application_decisions (application_id, stage_code, decision, reason, decided_by, decided_at)
       VALUES (?, ?, 'APPROVE', ?, ?, ?)`
    ).run(applicationId, application.current_stage, remarks, reviewerUserId, now);

    // Timeline event
    db.prepare(
      `INSERT INTO timeline_events (application_id, event_type, event_payload, actor_user_id, created_at)
       VALUES (?, 'DECISION_RECORDED', ?, ?, ?)`
    ).run(
      applicationId,
      JSON.stringify({
        decision: "APPROVE",
        from_stage: application.current_stage,
        to_stage: nextStage,
        final_status: finalStatus,
      }),
      reviewerUserId,
      now
    );

    const updated = db
      .prepare(`SELECT * FROM applications WHERE id = ?`)
      .get(applicationId);
    return NextResponse.json({ application: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
