/**
 * Skill: search_flight
 *
 * Uses the universal Stagehand browser executor to find and select a flight.
 * Navigates Google Flights / Kayak, selects the best option, proceeds to checkout.
 */

import type { Skill, SkillContext, StepOutcome, RecoveryStrategy } from "../types";
import type { BrowserTaskResult } from "@/lib/booking-autopilot/types";
import { buildFlightTask } from "@/lib/booking-autopilot/stagehand-executor";

export interface SearchFlightInput extends Record<string, unknown> {
  origin: string;       // airport code or city
  destination: string;
  departDate: string;   // ISO date
  returnDate?: string;
  passengers: number;
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  maxBudget?: number;
  preferNonstop?: boolean;
  notes?: string;
  bookingProfile?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
}

export const searchFlightSkill: Skill<SearchFlightInput> = {
  id: "search_flight",
  label: "Find flights",
  emoji: "✈️",
  stepType: "flight",

  async execute(input, ctx: SkillContext): Promise<StepOutcome> {
    const { baseUrl, autonomy, jobId } = ctx;
    const flt = autonomy.flight;

    ctx.log({
      type: "attempt",
      message: `Searching flights ${input.origin}→${input.destination} on ${input.departDate}`,
    });

    const profile = input.bookingProfile ?? {
      first_name: "", last_name: "", email: "", phone: "",
    };

    const preferNonstop = input.preferNonstop ?? !flt.allowLayover;

    // Google Flights as the starting URL
    const startUrl = `https://www.google.com/travel/flights/search?tfs=CBwQAhojagcIARIDJFK${encodeURIComponent(input.origin)}r${encodeURIComponent(input.destination)}`;
    // Simpler Kayak fallback URL
    const kayakUrl = `https://www.kayak.com/flights/${input.origin}-${input.destination}/${input.departDate}${input.returnDate ? `/${input.returnDate}` : ""}/${input.passengers}`;

    const { task } = buildFlightTask({
      origin: input.origin,
      destination: input.destination,
      date: input.departDate,
      passengers: input.passengers,
      preferNonstop,
      profile,
    });

    const taskWithContext = [
      task,
      input.cabinClass && input.cabinClass !== "economy" ? `Prefer ${input.cabinClass} class.` : "",
      input.maxBudget ? `Maximum budget: $${input.maxBudget}.` : "",
      input.returnDate ? `Return date: ${input.returnDate}.` : "",
    ].filter(Boolean).join(" ");

    try {
      const res = await fetch(`${baseUrl}/api/booking-autopilot/universal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrl: kayakUrl,
          task: taskWithContext,
          profile,
          jobId,
          stepIndex: 0,
        }),
        signal: ctx.signal,
      });

      if (!res.ok) {
        return { status: "failed", reason: `HTTP ${res.status} from universal autopilot` };
      }

      const data = await res.json() as BrowserTaskResult;
      return mapBrowserResult(data, input.origin, input.destination, input.departDate);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { status: "blocked", reason: "Execution cancelled" };
      }
      return { status: "failed", reason: err instanceof Error ? err.message : String(err) };
    }
  },

  getFallbackStrategies(_reason: string, ctx: SkillContext): RecoveryStrategy[] {
    const strategies: RecoveryStrategy[] = [];
    const flt = ctx.autonomy.flight;

    if (flt.departureFlexMinutes > 0) {
      strategies.push({
        type: "adjust_time",
        priority: 1,
        params: { windowMinutes: flt.departureFlexMinutes },
        description: `Try flights ±${flt.departureFlexMinutes} min from requested departure`,
      });
    }

    if (!flt.allowLayover) {
      strategies.push({
        type: "retry_alternative",
        priority: 2,
        params: { allowLayover: true },
        description: "Try 1-stop options if no direct flights found",
      });
    }

    if (flt.allowAlternateAirport) {
      strategies.push({
        type: "adjust_location",
        priority: 3,
        description: "Try nearby airports",
      });
    }

    strategies.push({
      type: "escalate_to_user",
      priority: 10,
      description: "Ask user to select flight manually",
    });

    return strategies;
  },
};

function mapBrowserResult(
  data: BrowserTaskResult,
  origin: string,
  destination: string,
  date: string
): StepOutcome {
  const result = {
    summary: data.summary,
    entityLabel: `${origin} → ${destination}`,
    handoffUrl: data.handoffUrl,
    screenshotBase64: data.screenshotBase64,
    sessionUrl: data.sessionUrl,
    scheduledAt: `${date}T00:00`,
  };

  switch (data.status) {
    case "completed":
    case "paused_payment":
      return { status: "succeeded", result: { ...result, requiresPayment: data.status === "paused_payment" } };
    case "no_availability":
      return { status: "blocked", reason: "No flights found", actionItem: "Search flights manually" };
    case "needs_login":
      return { status: "blocked", reason: "Site requires login", actionItem: "Sign in and book manually" };
    case "captcha":
      return { status: "blocked", reason: "Blocked by anti-bot system", actionItem: "Book flight manually" };
    default:
      return { status: "failed", reason: data.error ?? data.summary };
  }
}
