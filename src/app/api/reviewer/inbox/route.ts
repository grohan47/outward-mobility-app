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

  // Find applications matching the reviewer's assigned step based on email
  // (Simplified for MVP: join assignments, templates, and applications based on active step)
  const rows = db.prepare(`
    SELECT DISTINCT a.*, o.title as opportunity_title, sp.student_id, u.full_name as student_name
    FROM applications a
    JOIN opportunities o ON a.opportunity_id = o.id
    JOIN student_profiles sp ON a.student_profile_id = sp.id
    JOIN users u ON sp.user_id = u.id
    JOIN workflow_step_templates wst ON wst.workflow_template_id = o.workflow_template_id
    JOIN reviewer_assignments ra ON ra.workflow_step_template_id = wst.id
    JOIN workflow_stages ws ON ws.code = a.current_stage
    WHERE ra.reviewer_email = ? 
      AND a.final_status IS NULL
      AND (
        (ws.sequence_order = wst.step_order) -- Approximate mapping for demo
      )
    ORDER BY a.updated_at DESC
  `).all(session.email);

  return NextResponse.json({ items: rows });
}
