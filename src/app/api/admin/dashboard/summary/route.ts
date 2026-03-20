import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/schema";
import { getSession } from "@/lib/session";

export async function GET() {
  ensureDbInitialized();
  const session = getSession();

  if (session?.role !== "OGE_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const db = getDb();

  const total = (db.prepare(`SELECT COUNT(*) as c FROM applications`).get() as any).c;
  
  const pending = (db.prepare(`
    SELECT COUNT(*) as c FROM applications 
    WHERE final_status IS NULL AND current_stage != 'CLOSED'
  `).get() as any).c;

  const awaitingMe = (db.prepare(`
    SELECT COUNT(*) as c FROM applications 
    WHERE current_stage = 'OGE' AND final_status IS NULL
  `).get() as any).c;

  const approved = (db.prepare(`
    SELECT COUNT(*) as c FROM applications 
    WHERE final_status = 'APPROVED'
  `).get() as any).c;

  return NextResponse.json({
    total,
    pending,
    awaitingMe,
    approved
  });
}
