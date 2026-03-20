import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/schema";

// GET comments for an application
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureDbInitialized();
  const db = getDb();
  const applicationId = Number(params.id);

  const comments = db
    .prepare(`SELECT * FROM comments WHERE application_id = ? ORDER BY created_at ASC`)
    .all(applicationId);

  return NextResponse.json({ comments });
}

// POST a new comment
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  ensureDbInitialized();
  const db = getDb();
  const applicationId = Number(params.id);

  try {
    const body = await req.json();
    const { authorEmail, text, visibility = "internal" } = body;

    if (!authorEmail || !text) {
      return NextResponse.json(
        { error: "authorEmail and text are required." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO comments (application_id, author_email, text, visibility, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(applicationId, authorEmail, text, visibility, now);

    const comment = db
      .prepare(`SELECT * FROM comments WHERE id = ?`)
      .get(result.lastInsertRowid);

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
