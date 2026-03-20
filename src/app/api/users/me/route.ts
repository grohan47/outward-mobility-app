import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDb } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/schema";

export async function GET(req: NextRequest) {
  ensureDbInitialized();
  const session = getSession();
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Also get the full db user details if requested
  const db = getDb();
  const user = db.prepare(`SELECT id, email, full_name as name FROM users WHERE email = ?`).get(session.email);

  return NextResponse.json({ 
    user: { ...session, dbUserId: (user as any)?.id } 
  });
}
