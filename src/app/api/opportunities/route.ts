import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/schema";

export async function GET() {
  ensureDbInitialized();
  const db = getDb();

  const opportunities = db
    .prepare(`SELECT * FROM opportunities ORDER BY id DESC`)
    .all();

  return NextResponse.json({ items: opportunities });
}

export async function POST(req: NextRequest) {
  ensureDbInitialized();
  const db = getDb();

  try {
    const body = await req.json();
    const { code, title, description, term, destination, deadline, seats, workflowTemplateId, formTemplateId } = body;

    if (!code || !title) {
      return NextResponse.json(
        { error: "code and title are required." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO opportunities (code, title, description, term, destination, deadline, seats, status, workflow_template_id, form_template_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?)`
      )
      .run(code, title, description ?? null, term ?? null, destination ?? null, deadline ?? null, seats ?? null, workflowTemplateId ?? 1, formTemplateId ?? 1, now, now);

    const opportunity = db
      .prepare(`SELECT * FROM opportunities WHERE id = ?`)
      .get(result.lastInsertRowid);

    return NextResponse.json({ opportunity }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
