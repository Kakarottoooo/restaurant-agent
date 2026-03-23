import { NextRequest, NextResponse } from "next/server";
import { sql, ensureVenueBaselinesTable, ensurePlanOutcomesTable } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureVenueBaselinesTable();
  await ensurePlanOutcomesTable();

  // Get baselines for plans with future event dates that haven't been alerted yet
  const baselines = await sql`
    SELECT vb.plan_id, vb.venue_id, vb.venue_name, vb.baseline_rating, vb.baseline_review_count
    FROM venue_baselines vb
    JOIN decision_plans dp ON vb.plan_id = dp.id
    WHERE (dp.plan_json->>'event_datetime')::timestamptz > NOW()
      AND NOT EXISTS (
        SELECT 1 FROM plan_outcomes po
        WHERE po.plan_id = vb.plan_id
          AND po.outcome_type = 'venue_quality_alert'
      )
    LIMIT 50
  `.then((r) => r.rows as Array<{
    plan_id: string;
    venue_id: string;
    venue_name: string;
    baseline_rating: number;
    baseline_review_count: number;
  }>);

  let alertCount = 0;
  for (const baseline of baselines) {
    try {
      const details = await fetchCurrentVenueRating(baseline.venue_id);
      if (!details) continue;

      const ratingDelta = details.rating - baseline.baseline_rating;
      const reviewDelta = details.review_count - baseline.baseline_review_count;

      // Alert if rating dropped ≥0.3 OR >50 new reviews with negative trend
      const shouldAlert = ratingDelta <= -0.3 || (reviewDelta > 50 && ratingDelta < -0.1);
      if (!shouldAlert) continue;

      await sql`
        INSERT INTO plan_outcomes (plan_id, session_id, outcome_type, metadata)
        VALUES (
          ${baseline.plan_id},
          'system',
          'venue_quality_alert',
          ${JSON.stringify({
            venue_id: baseline.venue_id,
            venue_name: baseline.venue_name,
            baseline_rating: baseline.baseline_rating,
            current_rating: details.rating,
            rating_delta: ratingDelta,
            review_count_delta: reviewDelta,
            checked_at: new Date().toISOString(),
          })}
        )
      `;
      alertCount++;
    } catch {
      // Non-fatal — continue checking other venues
    }
  }

  return NextResponse.json({ checked: baselines.length, alerts: alertCount });
}

async function fetchCurrentVenueRating(
  placeId: string
): Promise<{ rating: number; review_count: number } | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?fields=rating,userRatingCount&key=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { rating?: number; userRatingCount?: number };
    return { rating: data.rating ?? 0, review_count: data.userRatingCount ?? 0 };
  } catch {
    return null;
  }
}
