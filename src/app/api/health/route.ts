import { NextResponse } from "next/server";
import { rawSqlite } from "@/lib/db";

/** Readiness-style check: verifies SQLite is reachable (Railway healthchecks). */
export async function GET() {
  try {
    rawSqlite.prepare("SELECT 1").get();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
