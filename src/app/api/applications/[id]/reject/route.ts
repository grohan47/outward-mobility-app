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
    const { reviewerEmail, reason } = body;

    const application = db
      .prepare(`SELECT * FROM applications WHERE id = ?`)
      .get(applicationId) as any;
    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    if (application.final_status || application.current_stage === "CLOSED") {
      return NextResponse.json({ error: "Application is already closed" }, { status: 400 });
    }

    // Only OGE_ADMIN and DEAN_ACADEMICS can reject
    const allowedStages = ["OGE", "DEAN"];
    if (!allowedStages.includes(application.current_stage)) {
      return NextResponse.json(
        { error: "Reject is only allowed at OGE or Dean stage." },
        { status: 403 }
      );
    }

    const reviewer = db.prepare(`SELECT * FROM users WHERE email = ?`).get(reviewerEmail) as any;
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE applications SET current_stage = 'CLOSED', final_status = 'REJECTED', updated_at = ? WHERE id = ?`
    ).run(now, applicationId);

    db.prepare(
      `INSERT INTO application_decisions (application_id, stage_code, decision, reason, decided_by, decided_at)
       VALUES (?, ?, 'REJECT', ?, ?, ?)`
    ).run(applicationId, application.current_stage, reason ?? "Application rejected.", reviewer?.id ?? 0, now);

    db.prepare(
      `INSERT INTO timeline_events (application_id, event_type, event_payload, actor_user_id, created_at)
       VALUES (?, 'DECISION_RECORDED', ?, ?, ?)`
    ).run(
      applicationId,
      JSON.stringify({
        decision: "REJECT",
        from_stage: application.current_stage,
        to_stage: "CLOSED",
        final_status: "REJECTED",
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
