import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/schema";

export async function GET() {
  ensureDbInitialized();
  const db = getDb();
  const ops = db.prepare(`SELECT * FROM opportunities ORDER BY created_at DESC`).all();
  return NextResponse.json({ items: ops });
}

export async function POST(req: NextRequest) {
  ensureDbInitialized();
  const db = getDb();
  
  try {
    const body = await req.json();
    const { opportunity, formFields, workflowSteps } = body;

    // Start transaction
    const transaction = db.transaction(() => {
      const now = new Date().toISOString();

      // 1. Create Form Template
      const formSchemaStr = JSON.stringify({
        sections: [
          {
            id: "dynamic_fields",
            title: "Application Details",
            fields: formFields.map((f: string) => ({
              id: f,
              label: f.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
              type: f.includes("upload") || f.includes("transcript") ? "file" : "text",
              required: true
            }))
          }
        ]
      });

      const formResult = db.prepare(
        `INSERT INTO form_templates (name, description, schema_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      ).run(`Form for ${opportunity.code}`, `Auto-generated form`, formSchemaStr, now, now);
      const formTemplateId = formResult.lastInsertRowid;

      // 2. Create Workflow Template
      const wfResult = db.prepare(
        `INSERT INTO workflow_templates (name, description, created_at, updated_at) VALUES (?, ?, ?, ?)`
      ).run(`Workflow for ${opportunity.code}`, `Auto-generated workflow`, now, now);
      const wfTemplateId = wfResult.lastInsertRowid;

      // 3. Create Workflow Steps & Assignments
      const insertStepTemplate = db.prepare(`
        INSERT INTO workflow_step_templates (workflow_template_id, step_order, name, description) VALUES (?, ?, ?, ?)
      `);
      const insertAssignment = db.prepare(`
        INSERT INTO reviewer_assignments (workflow_step_template_id, reviewer_email, reviewer_display_name, access_level, allowed_actions, visible_sections, required_inputs)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      workflowSteps.forEach((step: any, idx: number) => {
        const stepRes = insertStepTemplate.run(wfTemplateId, idx + 1, step.name || `Review Step ${idx + 1}`, "Custom review step");
        const stepId = stepRes.lastInsertRowid;
        
        insertAssignment.run(
          stepId,
          step.reviewerEmail,
          step.reviewerName,
          idx === workflowSteps.length - 1 ? 'final' : 'standard',
          '["approve","reject","request_changes","comment"]',
          JSON.stringify(step.visibleFields || []),
          JSON.stringify(step.requiredInputs || [])
        );
      });

      // 4. Create Opportunity
      const oppResult = db.prepare(`
        INSERT INTO opportunities (code, title, description, term, destination, deadline, seats, status, form_template_id, workflow_template_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        opportunity.code, opportunity.title, opportunity.description, opportunity.term, opportunity.destination, 
        opportunity.deadline, opportunity.seats, "published", formTemplateId, wfTemplateId, now, now
      );

      return oppResult.lastInsertRowid;
    });

    const newId = transaction();
    return NextResponse.json({ id: newId }, { status: 201 });

  } catch (error: any) {
    console.error("Opp creation error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
