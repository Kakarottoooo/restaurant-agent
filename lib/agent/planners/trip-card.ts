import { recommendCreditCards } from "../../creditCardEngine";
import type { CreditCardRecommendationCard, SpendingProfile } from "../../types";

/**
 * 3b-5: Credit card cross-reference for trip planning.
 *
 * Given trip costs, find the best card to use (or sign up for) to book the trip.
 * Spreads one-time trip spend over 3 months to align with typical signup-bonus windows.
 * Always returns the top "new card" recommendation (empty existing-cards pool) with
 * travel reward preference — this is intentionally about what card to get FOR this trip.
 */
export function getBestCardForTrip(spend: {
  flight_usd?: number;
  hotel_usd?: number;
  dining_usd?: number;
}): CreditCardRecommendationCard | null {
  const total =
    (spend.flight_usd ?? 0) + (spend.hotel_usd ?? 0) + (spend.dining_usd ?? 0);
  if (total < 200) return null;

  // Spread trip spend over 3 months (typical signup-bonus window)
  const months = 3;
  const profile: SpendingProfile = {
    travel: Math.round(((spend.flight_usd ?? 0) + (spend.hotel_usd ?? 0)) / months),
    dining: Math.round((spend.dining_usd ?? 0) / months),
    groceries: 0,
    gas: 0,
    online_shopping: 0,
    streaming: 0,
    entertainment: 0,
    pharmacy: 0,
    rent: 0,
    other: 0,
  };

  const results = recommendCreditCards(profile, [], "travel");
  return results[0] ?? null;
}

/**
 * Builds a concise one-line callout string for the trip card recommendation.
 * Suitable for rendering as a subtle info strip in the plan view.
 *
 * Example (EN): "Pay with Chase Sapphire Preferred ($95/yr) — earns 3x on travel and dining · sign-up bonus worth ~$750"
 */
export function buildTripCardCallout(
  card: CreditCardRecommendationCard,
  lang: "en" | "zh"
): string {
  const feeStr =
    card.card.annual_fee > 0
      ? lang === "zh"
        ? `（年费 $${card.card.annual_fee}）`
        : ` ($${card.card.annual_fee}/yr)`
      : "";

  const bonusStr =
    card.signup_bonus_value >= 100
      ? lang === "zh"
        ? `，开卡奖励约 $${Math.round(card.signup_bonus_value)}`
        : ` · sign-up bonus worth ~$${Math.round(card.signup_bonus_value)}`
      : "";

  if (lang === "zh") {
    return `用 ${card.card.name}${feeStr} 订这趟旅行——${card.why_recommended}${bonusStr}`;
  }
  return `Pay with ${card.card.name}${feeStr} — ${card.why_recommended}${bonusStr}`;
}
