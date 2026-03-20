import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/schema";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureDbInitialized();
  const db = getDb();
  const opportunityId = Number(params.id);

  const opportunity = db
    .prepare(`SELECT * FROM opportunities WHERE id = ?`)
    .get(opportunityId);

  if (!opportunity) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }

  // Also fetch the associated form schema
  const formTemplateId = (opportunity as any).form_template_id;
  let formTemplate = null;
  if (formTemplateId) {
    formTemplate = db
      .prepare(`SELECT * FROM form_templates WHERE id = ?`)
      .get(formTemplateId);
  }

  return NextResponse.json({ opportunity, form_template: formTemplate });
}
