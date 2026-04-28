import { NextResponse } from "next/server";

/** Lightweight health check for platform deploy hooks (e.g. Railway). */
export async function GET() {
  return NextResponse.json({ ok: true });
}
