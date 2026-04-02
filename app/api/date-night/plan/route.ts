/**
 * POST /api/date-night/plan
 *
 * Takes user preferences → searches for restaurants → returns a structured
 * plan with BookingJobStep[] pre-built and stored in DB (status: pending).
 *
 * The frontend shows this plan for approval, then calls
 * POST /api/booking-jobs/:id/start to execute it.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { googlePlacesSearch } from "@/lib/tools";
import { createBookingJob } from "@/lib/db";
import type { BookingJobStep } from "@/lib/db";
import { DEFAULT_AUTONOMY } from "@/lib/autonomy";
import { auth } from "@clerk/nextjs/server";
import { buildKayakFlightsUrl } from "@/lib/agent/planners/booking-links";

// Time fallbacks spaced around the requested time
function buildTimeFallbacks(time: string, windowMinutes: number): string[] {
  const [h, m] = time.split(":").map(Number);
  const base = (h ?? 19) * 60 + (m ?? 0);
  const steps = [30, 60].filter((s) => s <= windowMinutes);
  const fallbacks: string[] = [];
  for (const delta of steps) {
    for (const sign of [1, -1]) {
      const t = base + sign * delta;
      const hh = Math.floor(t / 60).toString().padStart(2, "0");
      const mm = (t % 60).toString().padStart(2, "0");
      fallbacks.push(`${hh}:${mm}`);
    }
  }
  return fallbacks.filter((t) => t >= "11:00" && t <= "23:00");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    sessionId?: string;
    location?: string;
    date?: string;
    time?: string;
    partySize?: number;
    vibe?: string;
    budget?: string;
    followUp?: string;
    targetRestaurant?: string;
    autonomySettings?: typeof DEFAULT_AUTONOMY;
  };

  const {
    sessionId,
    location = "New York",
    date,
    time = "19:00",
    partySize = 2,
    vibe = "romantic",
    budget = "mid-range",
    followUp = "open",
    targetRestaurant,
    autonomySettings = DEFAULT_AUTONOMY,
  } = body;

  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  if (!date)      return NextResponse.json({ error: "date required" }, { status: 400 });

  const { userId } = await auth();

  // ── Search for restaurants ──────────────────────────────────────────────
  const query = [
    targetRestaurant ?? "",
    vibe === "romantic" ? "romantic dinner restaurant" :
    vibe === "intimate" ? "cozy intimate restaurant" :
    vibe === "upscale"  ? "upscale fine dining" :
    "nice restaurant for two",
  ].filter(Boolean).join(" ");

  const candidates = await googlePlacesSearch({
    query,
    location,
    maxResults: 6,
  }).catch(() => []);

  const sorted = candidates
    .filter((r) => r.rating >= 4.0)
    .sort((a, b) => b.rating - a.rating);

  const primary = sorted[0];
  const fallbacks = sorted.slice(1, 4);

  if (!primary) {
    return NextResponse.json({ error: "No restaurants found for that location and vibe" }, { status: 422 });
  }

  const timeFallbacks = buildTimeFallbacks(time, autonomySettings.restaurant.timeWindowMinutes);

  // ── Build BookingJobStep[] ───────────────────────────────────────────────
  const steps: BookingJobStep[] = [];

  // Optional pre-dinner cocktails (activity step)
  if (vibe === "intimate" || followUp === "cocktail") {
    steps.push({
      type: "restaurant",
      emoji: "🍸",
      label: "Pre-dinner cocktails",
      apiEndpoint: "/api/autopilot/restaurant",
      fallbackUrl: `https://www.google.com/search?q=cocktail+bar+${encodeURIComponent(location)}`,
      body: {
        query: `cocktail bar ${location}`,
        date,
        time: adjustTime(time, -90),
        partySize,
        notes: "Upscale cocktail bar, pre-dinner drinks",
      },
      status: "pending",
    });
  }

  // ── Primary dinner step ─────────────────────────────────────────────────
  const fallbackCandidates = fallbacks.map((r) => ({
    label: r.name,
    body: {
      venueName: r.name,
      date,
      time,
      partySize,
      address: r.address,
    },
    fallbackUrl: r.url ?? `https://www.opentable.com/s?term=${encodeURIComponent(r.name)}&covers=${partySize}&datetime=${date}T${time}`,
  }));

  steps.push({
    type: "restaurant",
    emoji: "🍽️",
    label: `Dinner at ${primary.name}`,
    apiEndpoint: "/api/autopilot/restaurant",
    fallbackUrl: primary.url ?? `https://www.opentable.com/s?term=${encodeURIComponent(primary.name)}&covers=${partySize}&datetime=${date}T${time}`,
    body: {
      venueName: primary.name,
      date,
      time,
      partySize,
      address: primary.address,
      notes: `${vibe} atmosphere${budget === "luxury" ? ", fine dining" : ""}`,
    },
    timeFallbacks,
    fallbackCandidates,
    status: "pending",
  });

  // Optional after-dinner step
  if (followUp && followUp !== "none") {
    const afterEmoji = followUp === "dessert" ? "🍰" : followUp === "walk" ? "🌙" : "🥂";
    const afterLabel =
      followUp === "dessert" ? "Dessert spot" :
      followUp === "walk"    ? "Evening walk" :
      "After-dinner drinks";
    const afterQuery =
      followUp === "dessert" ? `dessert cafe ${location}` :
      followUp === "walk"    ? `scenic walk ${location}` :
      `cocktail bar wine bar ${location}`;

    steps.push({
      type: "restaurant",
      emoji: afterEmoji,
      label: afterLabel,
      apiEndpoint: "/api/autopilot/restaurant",
      fallbackUrl: `https://www.google.com/search?q=${encodeURIComponent(afterQuery)}`,
      body: {
        query: afterQuery,
        date,
        time: adjustTime(time, 120),
        partySize,
        notes: afterLabel,
      },
      status: "pending",
    });
  }

  // ── Create the booking job ───────────────────────────────────────────────
  const jobId = randomUUID();
  const tripLabel = `Date Night — ${primary.name}, ${location}`;

  await createBookingJob({
    id: jobId,
    sessionId,
    userId: userId ?? null,
    tripLabel,
    steps,
    autonomySettings,
  });

  // ── Build the response payload for plan display ──────────────────────────
  const planSteps = steps.map((s, i) => ({
    index: i,
    emoji: s.emoji,
    label: s.label,
    type: s.type,
    time: (s.body as Record<string, unknown>).time as string | undefined,
    venue: (s.body as Record<string, unknown>).venueName as string | undefined ?? (s.body as Record<string, unknown>).query as string | undefined,
    fallbackCount: s.fallbackCandidates?.length ?? 0,
    timeFallbackCount: s.timeFallbacks?.length ?? 0,
  }));

  // Trust signals — what the agent is allowed to do
  const trustSignals: string[] = [];
  if (autonomySettings.restaurant.timeWindowMinutes > 0) {
    trustSignals.push(`Adjust dinner time by up to ±${autonomySettings.restaurant.timeWindowMinutes} min`);
  }
  if (autonomySettings.restaurant.allowVenueSwitch && fallbacks.length > 0) {
    trustSignals.push(`Switch to ${fallbacks.length} vetted backup restaurants if ${primary.name} is unavailable`);
  }

  return NextResponse.json({
    jobId,
    tripLabel,
    primaryRestaurant: {
      name: primary.name,
      rating: primary.rating,
      reviewCount: primary.review_count,
      address: primary.address,
      cuisine: primary.cuisine,
    },
    fallbackRestaurants: fallbacks.map((r) => ({ name: r.name, rating: r.rating })),
    planSteps,
    trustSignals,
    date,
    time,
    partySize,
    location,
  });
}

function adjustTime(time: string, deltaMinutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h ?? 19) * 60 + (m ?? 0) + deltaMinutes;
  const clamped = Math.max(11 * 60, Math.min(23 * 60, total));
  const hh = Math.floor(clamped / 60).toString().padStart(2, "0");
  const mm = (clamped % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}
