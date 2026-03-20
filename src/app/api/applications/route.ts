import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/schema";

export async function GET(req: NextRequest) {
  ensureDbInitialized();
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const studentProfileId = searchParams.get("studentProfileId");

  let rows;
  if (studentProfileId) {
    rows = db
      .prepare(`SELECT * FROM applications WHERE student_profile_id = ? ORDER BY id DESC`)
      .all(Number(studentProfileId));
  } else {
    rows = db.prepare(`SELECT * FROM applications ORDER BY id DESC`).all();
  }

  const enriched = (rows as any[]).map((row) => {
    const opportunity = db.prepare(`SELECT * FROM opportunities WHERE id = ?`).get(row.opportunity_id);
    const profile = db.prepare(`SELECT * FROM student_profiles WHERE id = ?`).get(row.student_profile_id);
    const user = profile
      ? db.prepare(`SELECT * FROM users WHERE id = ?`).get((profile as any).user_id)
      : null;

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
      student_profile: profile,
      student_user: user,
      workflow: {
        stageCode: row.current_stage,
        stageLabel: stageLabels[row.current_stage] ?? row.current_stage,
        currentStakeholder: row.final_status ? "Completed" : stageLabels[row.current_stage] ?? "Unknown",
        finalStatus: row.final_status,
      },
    };
  });

  return NextResponse.json({ items: enriched });
}

export async function POST(req: NextRequest) {
  ensureDbInitialized();
  const db = getDb();

  try {
    const body = await req.json();
    const { studentProfileId, opportunityId } = body;

    if (!studentProfileId || !opportunityId) {
      return NextResponse.json(
        { error: "studentProfileId and opportunityId are required." },
        { status: 400 }
      );
    }

    const profile = db.prepare(`SELECT * FROM student_profiles WHERE id = ?`).get(Number(studentProfileId));
    if (!profile) {
      return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
    }

    const opportunity = db.prepare(`SELECT * FROM opportunities WHERE id = ?`).get(Number(opportunityId));
    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO applications (student_profile_id, opportunity_id, current_stage, submitted_at, created_at, updated_at)
         VALUES (?, ?, 'STUDENT_LIFE', ?, ?, ?)`
      )
      .run(Number(studentProfileId), Number(opportunityId), now, now, now);

    const application = db
      .prepare(`SELECT * FROM applications WHERE id = ?`)
      .get(result.lastInsertRowid);

    // Create snapshot
    db.prepare(
      `INSERT INTO application_student_snapshot (application_id, official_cgpa_at_submission, program_at_submission, snapshot_captured_at)
       VALUES (?, ?, ?, ?)`
    ).run(
      result.lastInsertRowid,
      (profile as any).official_cgpa,
      (profile as any).program,
      now
    );

    // Create timeline event
    db.prepare(
      `INSERT INTO timeline_events (application_id, event_type, event_payload, actor_user_id, created_at)
       VALUES (?, 'APPLICATION_CREATED', ?, ?, ?)`
    ).run(
      result.lastInsertRowid,
      JSON.stringify({ current_stage: "STUDENT_LIFE" }),
      (profile as any).user_id,
      now
    );

    return NextResponse.json({ application }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create application." },
      { status: 500 }
    );
  }
}
