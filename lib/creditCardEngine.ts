import type { CreditCard, CreditCardRecommendationCard, SpendingProfile } from "./types";
import cardsData from "../data/credit-cards.json";

const ALL_CARDS: CreditCard[] = cardsData.cards as CreditCard[];

const SPEND_CATEGORIES = [
  "dining",
  "groceries",
  "travel",
  "gas",
  "online_shopping",
  "streaming",
  "pharmacy",
  "other",
] as const;

type SpendCategory = typeof SPEND_CATEGORIES[number];

/** Compute annual rewards value for a portfolio of cards given a spending profile. */
function computeAnnualRewards(
  cards: CreditCard[],
  spending: SpendingProfile,
  rewardPreference: "cash" | "travel"
): number {
  let total = 0;
  for (const cat of SPEND_CATEGORIES) {
    const monthlySpend = spending[cat];
    if (monthlySpend <= 0) continue;
    const bestRate = Math.max(
      ...cards.map((c) => c.category_rates[cat] ?? 1)
    );
    const pointValue =
      rewardPreference === "travel"
        ? Math.max(...cards.map((c) => c.point_value_travel))
        : Math.max(...cards.map((c) => c.point_value_cash));
    // Use the card that contributes the best rate's point value
    const bestCard = cards.reduce((acc, c) =>
      (c.category_rates[cat] ?? 1) >= (acc.category_rates[cat] ?? 1) ? c : acc
    );
    const effectivePointValue =
      rewardPreference === "travel"
        ? bestCard.point_value_travel
        : bestCard.point_value_cash;
    total += monthlySpend * 12 * bestRate * effectivePointValue;
  }
  return total;
}

/** Compute total annual fees for a portfolio. */
function computeAnnualFees(cards: CreditCard[]): number {
  return cards.reduce((sum, c) => sum + c.annual_fee, 0);
}

/** Net annual benefit of a portfolio. */
function portfolioNetBenefit(
  cards: CreditCard[],
  spending: SpendingProfile,
  rewardPreference: "cash" | "travel"
): number {
  return computeAnnualRewards(cards, spending, rewardPreference) - computeAnnualFees(cards);
}

/**
 * Compute marginal value of adding `candidate` to `currentCards`.
 * Returns the per-category breakdown and overall marginal value.
 */
function computeMarginalValue(
  candidate: CreditCard,
  currentCards: CreditCard[],
  spending: SpendingProfile,
  rewardPreference: "cash" | "travel"
): {
  marginalValue: number;
  annualNetBenefit: number;
  categoryBreakdown: CreditCardRecommendationCard["category_breakdown"];
} {
  const currentBenefit = portfolioNetBenefit(currentCards, spending, rewardPreference);
  const newPortfolio = [...currentCards, candidate];
  const newBenefit = portfolioNetBenefit(newPortfolio, spending, rewardPreference);
  const marginalValue = newBenefit - currentBenefit;

  // Per-category breakdown: only show categories where the candidate improves the rate
  const categoryBreakdown: CreditCardRecommendationCard["category_breakdown"] = [];

  for (const cat of SPEND_CATEGORIES) {
    const monthlySpend = spending[cat];
    if (monthlySpend <= 0) continue;

    const oldRate =
      currentCards.length > 0
        ? Math.max(...currentCards.map((c) => c.category_rates[cat] ?? 1))
        : 1;
    const newRate = candidate.category_rates[cat] ?? 1;

    if (newRate <= oldRate) continue; // candidate doesn't help this category

    const pointValue =
      rewardPreference === "travel"
        ? candidate.point_value_travel
        : candidate.point_value_cash;

    const annualGain = monthlySpend * 12 * (newRate - oldRate) * pointValue;

    categoryBreakdown.push({
      category: cat,
      old_rate: oldRate,
      new_rate: newRate,
      monthly_spend: monthlySpend,
      annual_gain: annualGain,
    });
  }

  return {
    marginalValue,
    annualNetBenefit: newBenefit,
    categoryBreakdown,
  };
}

/** Generate a brief human-readable reason for recommending the card. */
function buildWhyRecommended(
  candidate: CreditCard,
  breakdown: CreditCardRecommendationCard["category_breakdown"],
  marginalValue: number,
  rewardPreference: "cash" | "travel"
): string {
  if (breakdown.length === 0) {
    return `Adds broad ${rewardPreference === "travel" ? "travel rewards" : "cash back"} potential with no annual fee.`;
  }
  const topCategory = breakdown.sort((a, b) => b.annual_gain - a.annual_gain)[0];
  const catLabel =
    topCategory.category === "online_shopping"
      ? "online shopping"
      : topCategory.category;
  const gain = Math.round(topCategory.annual_gain);
  const totalGain = Math.round(marginalValue);
  return `Earns ${topCategory.new_rate}x on ${catLabel} (up from ${topCategory.old_rate}x), adding ~$${gain}/year in that category alone. Net annual gain: ~$${totalGain}.`;
}

/** Generate watch-out notes for a card recommendation. */
function buildWatchOut(candidate: CreditCard): string[] {
  const notes: string[] = [];
  if (candidate.foreign_transaction_fee) {
    notes.push("Has foreign transaction fee — avoid for international use.");
  }
  if (candidate.min_credit_score && candidate.min_credit_score >= 720) {
    notes.push(`Requires excellent credit (${candidate.min_credit_score}+).`);
  }
  if (candidate.annual_fee >= 400) {
    notes.push(
      `High annual fee ($${candidate.annual_fee}) — ensure credits and rewards exceed the cost.`
    );
  }
  if (candidate.notes) {
    const capNotes = candidate.notes.filter(
      (n) => n.toLowerCase().includes("up to") || n.toLowerCase().includes("require")
    );
    notes.push(...capNotes.slice(0, 2));
  }
  notes.push(
    `Data last verified: ${candidate.last_verified}. Confirm current terms at the issuer's website before applying.`
  );
  return notes;
}

/**
 * Main engine: given user's spending profile, existing card ids, and reward
 * preference, return top-5 recommended cards sorted by marginal value.
 */
export function recommendCreditCards(
  spending: SpendingProfile,
  existingCardIds: string[],
  rewardPreference: "cash" | "travel"
): CreditCardRecommendationCard[] {
  const existingCards = ALL_CARDS.filter((c) => existingCardIds.includes(c.id));
  // Exclude cards the user already has
  const candidates = ALL_CARDS.filter((c) => !existingCardIds.includes(c.id));

  const scored = candidates.map((candidate) => {
    const { marginalValue, annualNetBenefit, categoryBreakdown } =
      computeMarginalValue(candidate, existingCards, spending, rewardPreference);

    const pointValue =
      rewardPreference === "travel"
        ? candidate.point_value_travel
        : candidate.point_value_cash;
    const signupBonusValue = candidate.signup_bonus_points * pointValue;

    const why = buildWhyRecommended(
      candidate,
      [...categoryBreakdown],
      marginalValue,
      rewardPreference
    );
    const watchOut = buildWatchOut(candidate);

    return {
      card: candidate,
      rank: 0,
      annual_net_benefit: annualNetBenefit,
      marginal_value: marginalValue,
      category_breakdown: categoryBreakdown,
      signup_bonus_value: signupBonusValue,
      why_recommended: why,
      watch_out: watchOut,
    } satisfies CreditCardRecommendationCard;
  });

  // Sort by marginal value descending, take top 5, assign ranks
  return scored
    .sort((a, b) => b.marginal_value - a.marginal_value)
    .slice(0, 5)
    .map((card, i) => ({ ...card, rank: i + 1 }));
}

/** Lookup a card by id (used for points linkage). */
export function getCardById(id: string): CreditCard | undefined {
  return ALL_CARDS.find((c) => c.id === id);
}

/** Return all card ids (for UI multi-select). */
export function getAllCards(): CreditCard[] {
  return ALL_CARDS;
}
