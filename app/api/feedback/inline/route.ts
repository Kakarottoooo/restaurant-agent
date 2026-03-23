import { NextRequest, NextResponse } from "next/server";
import { upsertUserPreference } from "@/lib/db";
import type { FeedbackRecord } from "@/lib/types";

// Chinese issue label → preference key/value mapping
const ISSUE_TO_PREFERENCE: Record<string, { key: string; value: string }> = {
  "比描述的吵": { key: "noise_sensitivity", value: "high" },
  "价格偏高": { key: "budget_sensitivity", value: "high" },
  "等位太久": { key: "wait_sensitivity", value: "high" },
};

/**
 * POST /api/feedback/inline
 * Session-based (no auth required). Records a card-level feedback signal
 * and writes learned preference rows to user_preferences DB table.
 *
 * Body: { session_id: string; feedback: FeedbackRecord }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const session_id: string | null = body.session_id ?? null;
    const feedback: FeedbackRecord | null = body.feedback ?? null;

    if (!session_id || !feedback) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Only write preference signals for unsatisfied feedback with issues
    if (!feedback.satisfied && feedback.issues?.length) {
      const upserts = feedback.issues
        .map((issue) => ISSUE_TO_PREFERENCE[issue])
        .filter((p): p is { key: string; value: string } => p !== undefined);

      await Promise.all(
        upserts.map((pref) =>
          upsertUserPreference(session_id, pref.key, pref.value).catch(() => {})
        )
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to record feedback" }, { status: 500 });
  }
}
