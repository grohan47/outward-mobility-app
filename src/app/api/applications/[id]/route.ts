import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/schema";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureDbInitialized();
  const db = getDb();
  const applicationId = Number(params.id);

  const application = db
    .prepare(`SELECT * FROM applications WHERE id = ?`)
    .get(applicationId) as any;
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const opportunity = db
    .prepare(`SELECT * FROM opportunities WHERE id = ?`)
    .get(application.opportunity_id);
  const profile = db
    .prepare(`SELECT * FROM student_profiles WHERE id = ?`)
    .get(application.student_profile_id);
  const user = profile
    ? db.prepare(`SELECT * FROM users WHERE id = ?`).get((profile as any).user_id)
    : null;
  const snapshot = db
    .prepare(`SELECT * FROM application_student_snapshot WHERE application_id = ?`)
    .get(applicationId);

  const reviews = db
    .prepare(`SELECT * FROM application_reviews WHERE application_id = ? ORDER BY id ASC`)
    .all(applicationId);
  const decisions = db
    .prepare(`SELECT * FROM application_decisions WHERE application_id = ? ORDER BY id ASC`)
    .all(applicationId);

  const timelineRows = db
    .prepare(`SELECT * FROM timeline_events WHERE application_id = ? ORDER BY id ASC`)
    .all(applicationId) as any[];
  const timeline = timelineRows.map((row) => ({
    ...row,
    event_payload: row.event_payload ? JSON.parse(row.event_payload) : null,
  }));

  const comments = db
    .prepare(`SELECT * FROM comments WHERE application_id = ? ORDER BY id ASC`)
    .all(applicationId);
  const deficiencies = db
    .prepare(`SELECT * FROM deficiency_items WHERE application_id = ? ORDER BY id ASC`)
    .all(applicationId);
  const stepInstances = db
    .prepare(`SELECT * FROM workflow_step_instances WHERE application_id = ? ORDER BY id ASC`)
    .all(applicationId);

  const stageLabels: Record<string, string> = {
    STUDENT_SUBMISSION: "Student Submission",
    STUDENT_LIFE: "Student Life Review",
    PROGRAM_CHAIR: "Program Chair Review",
    OGE: "OGE Office",
    DEAN: "Dean Academics Final",
    CLOSED: "Closed",
  };

  const reviewerAssignments = db
    .prepare(`
      SELECT ra.*, wst.step_order 
      FROM reviewer_assignments ra
      JOIN workflow_step_templates wst ON wst.id = ra.workflow_step_template_id
      WHERE wst.workflow_template_id = ?
    `)
    .all((opportunity as any).workflow_template_id);

  return NextResponse.json({
    application,
    opportunity,
    student_profile: profile,
    student_user: user,
    snapshot,
    reviews,
    decisions,
    timeline,
    comments,
    deficiencies,
    step_instances: stepInstances,
    reviewerAssignments,
    workflow: {
      stageCode: application.current_stage,
      stageLabel: stageLabels[application.current_stage] ?? application.current_stage,
      currentStakeholder: application.final_status
        ? "Completed"
        : stageLabels[application.current_stage] ?? "Unknown",
      finalStatus: application.final_status,
    },
  });
}
