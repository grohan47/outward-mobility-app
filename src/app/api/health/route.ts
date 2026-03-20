import { NextResponse } from "next/server";
import { ensureDbInitialized } from "@/lib/schema";

export async function GET() {
  ensureDbInitialized();
  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
