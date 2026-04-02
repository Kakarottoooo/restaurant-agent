/**
 * GET /api/metrics?session_id=...
 *
 * Returns the 5 core product KPIs for the Date Night agent.
 * These are the metrics that matter — not engineering metrics,
 * but agent product metrics:
 *
 *   1. Plan approval rate       — users who approve vs. dismiss the plan
 *   2. Autonomous completion    — jobs that complete without user intervention
 *   3. Manual intervention rate — which steps cause the most pull-back
 *   4. Acceptance after adjustment — agent-adjusted → user accepted
 *   5. Repeat usage by scenario — same user, same scenario, multiple sessions
 *
 * Pass session_id for per-user metrics, omit for aggregate (admin view).
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getAgentFeedbackEvents, getBookingJobsBySession } from "@/lib/db";
import { inferScenario } from "@/lib/memory";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  const aggregate = req.nextUrl.searchParams.get("aggregate") === "true";

  try {
    if (aggregate) {
      return NextResponse.json(await computeAggregateMetrics());
    }

    if (!sessionId) {
      return NextResponse.json({ error: "session_id or aggregate=true required" }, { status: 400 });
    }

    return NextResponse.json(await computeSessionMetrics(sessionId));
  } catch (err) {
    console.error("metrics GET error", err);
    return NextResponse.json({ error: "Failed to compute metrics" }, { status: 500 });
  }
}

// ── Per-session metrics ────────────────────────────────────────────────────

async function computeSessionMetrics(sessionId: string) {
  const [events, jobs] = await Promise.all([
    getAgentFeedbackEvents(sessionId, 500),
    getBookingJobsBySession(sessionId, 100),
  ]);

  return buildMetrics(events, jobs);
}

// ── Aggregate metrics (across all sessions) ────────────────────────────────

async function computeAggregateMetrics() {
  const jobsResult = await sql<{
    id: string; session_id: string; status: string;
    trip_label: string; steps: string; created_at: string;
  }>`SELECT id, session_id, status, trip_label, steps, created_at FROM booking_jobs ORDER BY created_at DESC LIMIT 500`;

  const eventsResult = await sql<{
    id: string; session_id: string; job_id: string;
    step_type: string; agent_decision: string; outcome: string; created_at: string;
  }>`SELECT * FROM agent_feedback_events ORDER BY created_at DESC LIMIT 2000`;

  return buildMetrics(eventsResult.rows as any, jobsResult.rows as any);
}

// ── Core metric computation ────────────────────────────────────────────────

function buildMetrics(events: any[], jobs: any[]) {
  const stepEvents = events.filter((e) => e.step_type !== "job");
  const jobEvents  = events.filter((e) => e.step_type === "job");

  // ── 1. Plan approval rate ──────────────────────────────────────────────
  // A job that moved from pending to running = user approved the plan.
  // Jobs that were never started = dismissed.
  const totalJobs    = jobs.length;
  const approvedJobs = jobs.filter((j) => j.status !== "pending").length;
  const planApprovalRate = totalJobs > 0 ? approvedJobs / totalJobs : null;

  // ── 2. Autonomous completion rate ──────────────────────────────────────
  // Jobs that reach "done" without any step having manual_override outcome.
  const runJobs = jobs.filter((j) => j.status === "done" || j.status === "failed");
  const autoCompleted = runJobs.filter((job) => {
    const jobStepEvents = stepEvents.filter((e) => e.job_id === job.id);
    return job.status === "done" && !jobStepEvents.some((e) => e.outcome === "manual_override");
  }).length;
  const autonomousCompletionRate = runJobs.length > 0 ? autoCompleted / runJobs.length : null;

  // ── 3. Manual intervention rate per step type ──────────────────────────
  // Which step types cause the most overrides?
  const interventionByType: Record<string, { overrides: number; total: number }> = {};
  for (const e of stepEvents) {
    const key = e.step_type ?? "unknown";
    if (!interventionByType[key]) interventionByType[key] = { overrides: 0, total: 0 };
    interventionByType[key].total++;
    if (e.outcome === "manual_override") interventionByType[key].overrides++;
  }
  const manualInterventionByStep = Object.entries(interventionByType).map(([stepType, { overrides, total }]) => ({
    stepType,
    interventionRate: total > 0 ? overrides / total : 0,
    count: total,
  })).sort((a, b) => b.interventionRate - a.interventionRate);

  // ── 4. Acceptance after adjustment ────────────────────────────────────
  // When the agent adjusted time or switched venue, did the user accept?
  const adjustedEvents = stepEvents.filter((e) =>
    e.agent_decision === "time_adjusted" || e.agent_decision === "venue_switched"
  );
  const adjustedAccepted = adjustedEvents.filter((e) => e.outcome === "accepted").length;
  const acceptanceAfterAdjustment = adjustedEvents.length > 0
    ? adjustedAccepted / adjustedEvents.length
    : null;

  // Breakdown by adjustment type
  const timeAdjustEvents  = adjustedEvents.filter((e) => e.agent_decision === "time_adjusted");
  const venueSwithEvents  = adjustedEvents.filter((e) => e.agent_decision === "venue_switched");
  const adjustmentBreakdown = {
    timeAdjust: {
      count: timeAdjustEvents.length,
      acceptanceRate: timeAdjustEvents.length > 0
        ? timeAdjustEvents.filter((e) => e.outcome === "accepted").length / timeAdjustEvents.length
        : null,
    },
    venueSwitch: {
      count: venueSwithEvents.length,
      acceptanceRate: venueSwithEvents.length > 0
        ? venueSwithEvents.filter((e) => e.outcome === "accepted").length / venueSwithEvents.length
        : null,
    },
  };

  // ── 5. Repeat usage by scenario ────────────────────────────────────────
  // Group sessions by scenario, count unique sessions per scenario
  const scenarioSessions: Record<string, Set<string>> = {};
  for (const job of jobs) {
    const { scenario } = inferScenario(job.trip_label ?? "");
    if (!scenarioSessions[scenario]) scenarioSessions[scenario] = new Set();
    scenarioSessions[scenario].add(job.session_id);
  }

  // How many sessions used a scenario more than once?
  const jobsBySession: Record<string, number> = {};
  for (const job of jobs) {
    jobsBySession[job.session_id] = (jobsBySession[job.session_id] ?? 0) + 1;
  }
  const repeatSessions = Object.values(jobsBySession).filter((count) => count > 1).length;
  const totalSessions  = Object.keys(jobsBySession).length;
  const repeatUsageRate = totalSessions > 0 ? repeatSessions / totalSessions : null;

  const repeatByScenario = Object.entries(scenarioSessions).map(([scenario, sessions]) => {
    const sessionList = [...sessions];
    const repeaters = sessionList.filter((s) => (jobsBySession[s] ?? 0) > 1).length;
    return {
      scenario,
      totalSessions: sessions.size,
      repeatSessions: repeaters,
      repeatRate: sessions.size > 0 ? repeaters / sessions.size : 0,
    };
  }).sort((a, b) => b.totalSessions - a.totalSessions);

  // ── Summary ────────────────────────────────────────────────────────────
  return {
    // KPIs
    planApprovalRate,
    autonomousCompletionRate,
    acceptanceAfterAdjustment,
    repeatUsageRate,
    manualInterventionByStep,
    adjustmentBreakdown,
    repeatByScenario,
    // Context
    totalJobs,
    totalEvents: events.length,
    // Health signal — if autonomous completion is < 50%, something is broken
    health: {
      planApproval: planApprovalRate === null ? "no_data" : planApprovalRate >= 0.6 ? "good" : planApprovalRate >= 0.4 ? "ok" : "poor",
      autonomousCompletion: autonomousCompletionRate === null ? "no_data" : autonomousCompletionRate >= 0.7 ? "good" : autonomousCompletionRate >= 0.5 ? "ok" : "poor",
      adjustmentAcceptance: acceptanceAfterAdjustment === null ? "no_data" : acceptanceAfterAdjustment >= 0.6 ? "good" : acceptanceAfterAdjustment >= 0.4 ? "ok" : "poor",
    },
  };
}
