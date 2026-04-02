/**
 * Policy Adaptation Engine
 *
 * Turns accumulated feedback signals into actionable strategy biases.
 * The agent's decisions get better with every booking.
 *
 * Signal weights (how strongly each outcome changes scores):
 *   satisfied       +3   strong positive — user explicitly happy
 *   ok              +1   weak positive — acceptable
 *   accepted        +1   weak positive — user used agent's link
 *   manual_override -2   strong negative — user rejected agent's choice
 *   unsatisfied     -3   strong negative — user explicitly unhappy
 *   failed          -3   strong negative — agent couldn't complete the task
 *
 * Three policy tiers:
 *   Global   — patterns across all users (provider reliability)
 *   Personal — patterns for this session/user (their specific tolerances)
 *
 * Bayesian smoothing prevents over-fitting on small sample sizes.
 * A venue needs MIN_EVENTS events before its score affects decisions.
 */

import type { AgentFeedbackEvent } from "./db";

// ── Signal weights ─────────────────────────────────────────────────────────

export const SIGNAL_WEIGHTS: Record<string, number> = {
  satisfied:       +3,
  ok:              +1,
  accepted:        +1,
  manual_override: -2,
  unsatisfied:     -3,
  failed:          -3,
} as const;

// Minimum events before we use the score in decisions
const MIN_EVENTS = 3;
// Bayesian smoothing — low-sample scores stay near 0
const SMOOTHING = 2;

// ── Core scoring ───────────────────────────────────────────────────────────

/** Compute a smoothed policy score from a set of feedback events. */
export function weightedScore(events: AgentFeedbackEvent[]): number {
  if (events.length === 0) return 0;
  const raw = events.reduce((sum, e) => sum + (SIGNAL_WEIGHTS[e.outcome] ?? 0), 0);
  return raw / (events.length + SMOOTHING);
}

/** Rate: fraction of events with the given outcome. */
function rate(events: AgentFeedbackEvent[], outcome: string): number {
  if (events.length === 0) return 0;
  return events.filter((e) => e.outcome === outcome).length / events.length;
}

// ── Policy types ───────────────────────────────────────────────────────────

export type Tolerance = "liberal" | "moderate" | "strict";

export interface VenuePolicy {
  venueName: string;
  score: number;      // smoothed policy score
  eventCount: number;
  interpretation: string; // human-readable
}

export interface ProviderPolicy {
  provider: string;
  score: number;
  acceptanceRate: number;
  eventCount: number;
  preferenceRank: number; // 1 = try first
}

export interface PersonalTolerance {
  /** How readily the agent should adjust time slots for this user. */
  timeAdjust: Tolerance;
  timeAdjustRate: number;   // 0–1, fraction of time_adjusted events accepted
  timeAdjustCount: number;

  /** How readily the agent should switch venues for this user. */
  venueSwitch: Tolerance;
  venueSwitchRate: number;
  venueSwitchCount: number;
}

export interface PolicyBias {
  /** Per-venue smoothed scores. Only venues with ≥MIN_EVENTS included. */
  venueScores: Record<string, number>;
  /** Sorted provider list — index 0 = highest policy score, try first. */
  providerRanking: ProviderPolicy[];
  /** Personal strategy tolerances derived from behavior (null = not enough data). */
  personalTolerance: PersonalTolerance | null;
  /** Raw stats for display. */
  topVenues: VenuePolicy[];  // sorted descending by score
  flaggedVenues: VenuePolicy[]; // venues with negative scores
  totalEvents: number;
  hasEnoughData: boolean;
}

// ── Main computation ───────────────────────────────────────────────────────

export function computePolicyBias(events: AgentFeedbackEvent[]): PolicyBias {
  const stepEvents = events.filter((e) => e.step_type !== "job");

  // ── Venue scores ──
  const byVenue = new Map<string, AgentFeedbackEvent[]>();
  for (const e of stepEvents) {
    if (!e.venue_name) continue;
    const arr = byVenue.get(e.venue_name) ?? [];
    arr.push(e);
    byVenue.set(e.venue_name, arr);
  }

  const venueScores: Record<string, number> = {};
  const allVenues: VenuePolicy[] = [];

  for (const [name, evts] of byVenue) {
    const score = weightedScore(evts);
    const policy: VenuePolicy = {
      venueName: name,
      score,
      eventCount: evts.length,
      interpretation:
        score > 1.5 ? "Agent's picks consistently trusted" :
        score > 0   ? "Generally accepted" :
        score === 0 ? "Mixed results" :
        score > -1  ? "Often overridden" :
                      "Frequently rejected — try alternatives first",
    };
    allVenues.push(policy);
    if (evts.length >= MIN_EVENTS) {
      venueScores[name] = score;
    }
  }

  allVenues.sort((a, b) => b.score - a.score);
  const topVenues = allVenues.filter((v) => v.score > 0).slice(0, 5);
  const flaggedVenues = allVenues.filter((v) => v.score < 0 && v.eventCount >= MIN_EVENTS).slice(0, 5);

  // ── Provider scores ──
  const byProvider = new Map<string, AgentFeedbackEvent[]>();
  for (const e of stepEvents) {
    if (!e.provider) continue;
    const arr = byProvider.get(e.provider) ?? [];
    arr.push(e);
    byProvider.set(e.provider, arr);
  }

  const providerRanking: ProviderPolicy[] = [];
  for (const [provider, evts] of byProvider) {
    providerRanking.push({
      provider,
      score: weightedScore(evts),
      acceptanceRate: rate(evts, "accepted"),
      eventCount: evts.length,
      preferenceRank: 0, // set after sort
    });
  }
  providerRanking.sort((a, b) => b.score - a.score);
  providerRanking.forEach((p, i) => { p.preferenceRank = i + 1; });

  // ── Personal tolerance ──
  const timeEvents = stepEvents.filter((e) => e.agent_decision === "time_adjusted");
  const venueEvents = stepEvents.filter((e) => e.agent_decision === "venue_switched");

  const hasTimeData = timeEvents.length >= MIN_EVENTS;
  const hasVenueData = venueEvents.length >= MIN_EVENTS;

  let personalTolerance: PersonalTolerance | null = null;

  if (hasTimeData || hasVenueData) {
    const timeRate = hasTimeData ? rate(timeEvents, "accepted") : 0.5;
    const venueRate = hasVenueData ? rate(venueEvents, "accepted") : 0.5;

    personalTolerance = {
      timeAdjust: timeRate >= 0.7 ? "liberal" : timeRate >= 0.4 ? "moderate" : "strict",
      timeAdjustRate: timeRate,
      timeAdjustCount: timeEvents.length,
      venueSwitch: venueRate >= 0.7 ? "liberal" : venueRate >= 0.4 ? "moderate" : "strict",
      venueSwitchRate: venueRate,
      venueSwitchCount: venueEvents.length,
    };
  }

  return {
    venueScores,
    providerRanking,
    personalTolerance,
    topVenues,
    flaggedVenues,
    totalEvents: events.length,
    hasEnoughData: events.length >= 5,
  };
}

// ── Helpers for the execution engine ──────────────────────────────────────

/**
 * Sort fallback candidates by policy score (best-trusted venue first).
 * Candidates without a score keep their original order.
 */
export function sortCandidatesByPolicy<T extends { label: string }>(
  candidates: T[],
  venueScores: Record<string, number>
): T[] {
  return [...candidates].sort((a, b) => {
    const sa = venueScores[a.label] ?? 0;
    const sb = venueScores[b.label] ?? 0;
    return sb - sa; // descending
  });
}

/**
 * Generate a log message explaining why a venue is being tried in a
 * particular order based on policy score.
 */
export function policyOrderExplanation(
  label: string,
  score: number,
  rank: number
): string {
  if (rank === 1 && score > 0) {
    return `Trying ${label} first — your history shows you trust the agent's picks here (score ${score.toFixed(1)})`;
  }
  if (score < 0) {
    return `Trying ${label} (lower priority — you've often chosen differently here, score ${score.toFixed(1)})`;
  }
  return `Trying ${label}`;
}

/**
 * Generate a tolerance note for the decision log — tells the user when
 * their observed behavior diverges from their settings.
 */
export function toleranceNote(
  tolerance: PersonalTolerance,
  decisionType: "time_adjusted" | "venue_switched"
): string | null {
  if (decisionType === "time_adjusted") {
    if (tolerance.timeAdjust === "strict" && tolerance.timeAdjustCount >= MIN_EVENTS) {
      return `Note: you override time adjustments often (${Math.round(tolerance.timeAdjustRate * 100)}% acceptance). Making extra attempts at your exact time before adjusting.`;
    }
    if (tolerance.timeAdjust === "liberal" && tolerance.timeAdjustCount >= MIN_EVENTS) {
      return `Adjusting time — your history shows you're comfortable with this (${Math.round(tolerance.timeAdjustRate * 100)}% acceptance).`;
    }
  }
  if (decisionType === "venue_switched") {
    if (tolerance.venueSwitch === "strict" && tolerance.venueSwitchCount >= MIN_EVENTS) {
      return `Note: you often override venue switches (${Math.round(tolerance.venueSwitchRate * 100)}% acceptance). Will try harder on the primary before switching.`;
    }
    if (tolerance.venueSwitch === "liberal" && tolerance.venueSwitchCount >= MIN_EVENTS) {
      return `Switching venue — your history shows you're flexible with alternatives (${Math.round(tolerance.venueSwitchRate * 100)}% acceptance).`;
    }
  }
  return null;
}
