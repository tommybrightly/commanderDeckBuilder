import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/health — Check DB connectivity (helps debug OAuth Callback errors).
 * Safe to call; returns { ok } or { error }.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const sessionCount = await prisma.session.count().catch(() => -1);
    return NextResponse.json({
      ok: true,
      db: "connected",
      sessionsExist: sessionCount >= 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[health] DB check failed:", message);
    return NextResponse.json(
      { ok: false, error: "Database check failed", detail: message },
      { status: 503 }
    );
  }
}
