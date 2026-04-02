/**
 * GET /api/agent-logs
 *
 * Query params:
 *   session_id — filter by session
 *   job_id     — filter by job
 *   level      — filter by level (info | warn | error)
 *   limit      — max rows (default 100)
 *
 * Used by Claude Code to read agent errors and behavior without the user
 * having to paste error messages manually.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAgentLogs } from "@/lib/db";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const logs = await getAgentLogs({
    sessionId: p.get("session_id") ?? undefined,
    jobId: p.get("job_id") ?? undefined,
    level: (p.get("level") ?? undefined) as "info" | "warn" | "error" | undefined,
    limit: p.get("limit") ? Number(p.get("limit")) : 100,
  });
  return NextResponse.json({ logs, count: logs.length });
}
