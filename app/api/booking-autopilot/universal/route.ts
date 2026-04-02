/**
 * POST /api/booking-autopilot/universal
 *
 * Universal booking endpoint — works on any website.
 * Accepts a starting URL + natural-language task + user profile,
 * runs Stagehand (AI browser), and returns the result.
 *
 * Used by the skill system for restaurant / hotel / flight steps.
 * Replaces the platform-specific /restaurant, /hotel, /flight endpoints.
 */

import { NextRequest, NextResponse } from "next/server";
import { runBrowserTask } from "../../../../lib/booking-autopilot/stagehand-executor";
import type { BrowserTaskInput } from "../../../../lib/booking-autopilot/types";

export const maxDuration = 300; // 5 min — Vercel Pro allows up to 300s

export async function POST(req: NextRequest) {
  let body: Partial<BrowserTaskInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.startUrl || !body.task || !body.profile) {
    return NextResponse.json(
      { error: "Missing required fields: startUrl, task, profile (first_name, last_name, email, phone)" },
      { status: 400 }
    );
  }

  if (
    !body.profile.first_name ||
    !body.profile.last_name ||
    !body.profile.email ||
    !body.profile.phone
  ) {
    return NextResponse.json(
      { error: "profile must include first_name, last_name, email, phone" },
      { status: 400 }
    );
  }

  const input: BrowserTaskInput = {
    startUrl: body.startUrl,
    task: body.task,
    profile: body.profile,
    jobId: body.jobId ?? "manual",
    stepIndex: body.stepIndex ?? 0,
  };

  const result = await runBrowserTask(input);
  return NextResponse.json(result);
}
