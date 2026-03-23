import type { CreditCard, CreditCardRecommendationCard, SpendingProfile } from "./types";
import cardsData from "../data/credit-cards.json";

// ─── Normalize raw JSON cards into the flat internal CreditCard shape ─────────

type RawRates = Record<string, number>;
type RawCurrency = { cpp_cash: number; cpp_travel?: number; cpp_travel_portal?: number };
type RawSignupBonus = { points: number; spend_requirement: number; timeframe_months: number };
type RawCard = {
  id: string; name: string; issuer: string; annual_fee: number; rewards_currency: string;
  category_rates: RawRates;
  signup_bonus: RawSignupBonus;
  foreign_transaction_fee: boolean;
  min_credit_score?: number;
  notes?: string[];
  eligibility_notes?: string[];
  mutually_exclusive_with?: string[];
  last_verified: string;
};

// Keys that denote spending caps (dollar amounts), not reward rates
const CAP_KEYWORDS = ["_cap", "_limit", "_max"];

// Specialty-merchant suffixes: these rates only apply at specific brick-and-mortar stores,
// not at general spend in the category. Excluded from the general-category rate.
// Note: _amazon is NOT excluded — Amazon.com represents a large share of general online shopping.
const SPECIALTY_MERCHANT_SUFFIXES = ["_whole_foods", "_costco", "_warehouse", "_wholesale_clubs"];

// Portal rates only apply when booking through a specific issuer portal (e.g. Capital One Travel,
// Chase Travel, Amex Travel hotels). Direct bookings earn the card's base travel rate instead.
// Excluded from the normalized travel rate so we don't over-state earnings for direct bookers.
const PORTAL_BOOKING_KEYWORD = "_portal";

function isCapField(key: string, value: number): boolean {
  return CAP_KEYWORDS.some((kw) => key.includes(kw)) || value > 20;
}

function isSpecialtyMerchant(key: string): boolean {
  return SPECIALTY_MERCHANT_SUFFIXES.some((s) => key.endsWith(s));
}

function isPortalOnlyRate(key: string): boolean {
  return key.includes(PORTAL_BOOKING_KEYWORD);
}

function maxByPrefix(rates: RawRates, prefix: string, excludePortal = false): number {
  const vals = Object.entries(rates)
    .filter(([k, v]) =>
      (k === prefix || k.startsWith(prefix + "_")) &&
      !isCapField(k, v) &&
      !isSpecialtyMerchant(k) &&
      !(excludePortal && isPortalOnlyRate(k))
    )
    .map(([, v]) => v);
  return vals.length > 0 ? Math.max(...vals) : 1;
}

function normalizeCard(raw: RawCard): CreditCard {
  const currencies = cardsData.point_currencies as Record<string, RawCurrency>;
  const currency = currencies[raw.rewards_currency] ?? currencies["cash"];
  const rates = raw.category_rates;
  return {
    id: raw.id,
    name: raw.name,
    issuer: raw.issuer,
    annual_fee: raw.annual_fee,
    rewards_currency: raw.rewards_currency,
    category_rates: {
      dining:          rates["dining"] ?? 1,
      groceries:       maxByPrefix(rates, "groceries"),
      travel:          maxByPrefix(rates, "travel", true), // excludes portal-only rates (C1/Chase/Amex portal)
      gas:             maxByPrefix(rates, "gas"),
      online_shopping: maxByPrefix(rates, "online_shopping"),
      streaming:       maxByPrefix(rates, "streaming"),
      entertainment:   rates["entertainment"] ?? 0, // 0 = most cards don't earn on entertainment
      pharmacy:        rates["pharmacy"] ?? 1,
      rent:            rates["rent"] ?? 0,           // 0 = card doesn't earn on rent
      other:           rates["other"] ?? 1,
    },
    point_value_cash:               currency.cpp_cash,
    point_value_travel:             currency.cpp_travel ?? currency.cpp_travel_portal ?? currency.cpp_cash,
    signup_bonus_points:            raw.signup_bonus?.points ?? 0,
    signup_bonus_spend_requirement: raw.signup_bonus?.spend_requirement ?? 0,
    signup_bonus_timeframe_months:  raw.signup_bonus?.timeframe_months ?? 3,
    foreign_transaction_fee:        raw.foreign_transaction_fee,
    min_credit_score:               raw.min_credit_score,
    notes:                          raw.notes,
    eligibility_notes:              raw.eligibility_notes,
    mutually_exclusive_with:        raw.mutually_exclusive_with,
    last_verified:                  raw.last_verified,
  };
}

const ALL_CARDS: CreditCard[] = (cardsData.cards as unknown as RawCard[]).map(normalizeCard);

const SPEND_CATEGORIES = [
  "dining",
  "groceries",
  "travel",
  "gas",
  "online_shopping",
  "streaming",
  "entertainment",
  "pharmacy",
  "rent",
  "other",
] as const;

type SpendCategory = typeof SPEND_CATEGORIES[number];

/** Compute annual rewards value for a portfolio of cards given a spending profile. */
function computeAnnualRewards(
  cards: CreditCard[],
  spending: SpendingProfile,
  rewardPreference: "cash" | "travel"
): number {
  if (cards.length === 0) return 0;
  let total = 0;
  for (const cat of SPEND_CATEGORIES) {
    const monthlySpend = spending[cat];
    if (monthlySpend <= 0) continue;
    // rent and entertainment default to 0 (most cards don't earn on these)
    const baselineRate = (cat === "rent" || cat === "entertainment") ? 0 : 1;
    const bestRate = Math.max(
      ...cards.map((c) => c.category_rates[cat] ?? baselineRate)
    );
    if (bestRate <= 0) continue; // no card earns on this category
    const pointValue =
      rewardPreference === "travel"
        ? Math.max(...cards.map((c) => c.point_value_travel))
        : Math.max(...cards.map((c) => c.point_value_cash));
    // Use the card that contributes the best rate's point value
    const bestCard = cards.reduce((acc, c) =>
      (c.category_rates[cat] ?? baselineRate) >= (acc.category_rates[cat] ?? baselineRate) ? c : acc
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
  rewardPreference: "cash" | "travel",
  noCardsAtAll: boolean
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

    // Baseline rate when user has no named cards:
    // - rent/entertainment: 0 (most cards don't earn here)
    // - everything else: 1 (assume at least a generic 1x card exists)
    // Exception: if user is truly card-less (confirmed first card), use 0x everywhere.
    const zeroBaselineCats = cat === "rent" || cat === "entertainment";
    const baselineRate = zeroBaselineCats ? 0 : (noCardsAtAll ? 0 : 1);
    const oldRate =
      currentCards.length > 0
        ? Math.max(...currentCards.map((c) => c.category_rates[cat] ?? (zeroBaselineCats ? 0 : 1)))
        : baselineRate;
    const newRate = candidate.category_rates[cat] ?? baselineRate;

    if (newRate <= oldRate) continue; // candidate doesn't help this category

    const pointValue =
      rewardPreference === "travel"
        ? candidate.point_value_travel
        : candidate.point_value_cash;

    // Use the existing best card's cpp for the "old" value so the gain accurately
    // reflects both the rate improvement AND any point-value improvement.
    // When no named cards exist, fall back to a generic 1cpp baseline.
    const oldPointValue: number = (() => {
      if (currentCards.length === 0) return 0.01; // generic baseline cpp for unnamed/no cards
      const bestExisting = currentCards.reduce((best, c) =>
        (c.category_rates[cat] ?? (zeroBaselineCats ? 0 : 1)) >= (best.category_rates[cat] ?? (zeroBaselineCats ? 0 : 1)) ? c : best
      );
      return rewardPreference === "travel"
        ? bestExisting.point_value_travel
        : bestExisting.point_value_cash;
    })();

    const annualGain = monthlySpend * 12 * (newRate * pointValue - oldRate * oldPointValue);

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

const CAT_LABELS: Record<string, string> = {
  online_shopping: "online shopping",
  rent: "rent",
};

// Cards in the same product family — used to detect "upgrade" scenarios
const CARD_FAMILY_PREFIXES: Record<string, string> = {
  "amex-blue-cash-preferred": "amex-blue-cash",
  "amex-blue-cash-everyday": "amex-blue-cash",
  "chase-sapphire-preferred": "chase-sapphire",
  "chase-sapphire-reserve": "chase-sapphire",
  "capital-one-venture-x": "capital-one-venture",
  "capital-one-venture": "capital-one-venture",
};

/** Generate a brief human-readable reason for recommending the card. */
function buildWhyRecommended(
  candidate: CreditCard,
  breakdown: CreditCardRecommendationCard["category_breakdown"],
  marginalValue: number,
  rewardPreference: "cash" | "travel",
  existingCardIds: string[]
): string {
  let base: string;
  if (breakdown.length === 0) {
    base = `Adds broad ${rewardPreference === "travel" ? "travel rewards" : "cash back"} potential with no annual fee.`;
  } else {
    const topCategory = breakdown.sort((a, b) => b.annual_gain - a.annual_gain)[0];
    const catLabel = CAT_LABELS[topCategory.category] ?? topCategory.category;
    const gain = Math.round(topCategory.annual_gain);
    const totalGain = Math.round(marginalValue);
    base = `Earns ${topCategory.new_rate}x on ${catLabel} (up from ${topCategory.old_rate}x), adding ~$${gain}/year in that category alone. Net annual gain: ~$${totalGain}.`;
  }
  // Detect upgrade scenario: candidate is in the same family as an existing card
  const candidateFamily = CARD_FAMILY_PREFIXES[candidate.id];
  if (candidateFamily) {
    const upgradedFrom = existingCardIds.find(
      (id) => CARD_FAMILY_PREFIXES[id] === candidateFamily && id !== candidate.id
    );
    if (upgradedFrom) {
      const fromCard = ALL_CARDS.find((c) => c.id === upgradedFrom);
      if (fromCard) {
        base += ` This would replace (or complement) your existing ${fromCard.name}.`;
      }
    }
  }
  // Append the card's most distinctive note to differentiate similar flat-rate cards
  const distinctiveNote = candidate.notes?.find(
    (n) => !n.toLowerCase().includes("flat") || n.toLowerCase().includes("phone") || n.toLowerCase().includes("fidelity") || n.toLowerCase().includes("foreign")
  ) ?? candidate.notes?.[0];
  if (distinctiveNote) {
    base += ` Note: ${distinctiveNote}`;
  }
  return base;
}

// Currencies that are transferable points (not direct cash back)
const TRANSFERABLE_POINT_CURRENCIES = new Set([
  "chase_ur", "amex_mr", "citi_ty", "capital_one_miles",
  "bilt_points", "marriott_bonvoy", "delta_skymiles", "hilton_honors",
]);

/** Generate watch-out notes for a card recommendation. */
function buildWatchOut(
  candidate: CreditCard,
  rewardPreference: "cash" | "travel",
  preferNoAnnualFee?: "hard" | "soft" | false,
  userCreditScore?: number,
  totalMonthlySpend?: number
): string[] {
  const notes: string[] = [];
  // Hard prerequisites first — user must have these before applying
  if (candidate.eligibility_notes?.length) {
    notes.push(...candidate.eligibility_notes.map((n) => `⚠ Prerequisite: ${n}`));
  }
  // Credit score warning: user's stated score is meaningfully below the card's minimum.
  // Skip for creditScore=0 (no credit history) — useChat.ts already shows a header advisory
  // for that case, and the cards shown are specifically the most accessible options.
  if (userCreditScore !== undefined && userCreditScore > 0 && candidate.min_credit_score && userCreditScore < candidate.min_credit_score) {
    notes.push(
      `⚠ Approval risk: your stated credit score (${userCreditScore}) is below this card's typical minimum (~${candidate.min_credit_score}). Approval is possible but not guaranteed — consider building credit first or applying for secured/starter cards.`
    );
  }
  // Signup bonus spend requirement: warn if user's monthly spend can't hit it in time
  if (totalMonthlySpend !== undefined && candidate.signup_bonus_spend_requirement > 0) {
    const monthsRequired = candidate.signup_bonus_timeframe_months;
    const reachable = totalMonthlySpend * monthsRequired;
    if (reachable < candidate.signup_bonus_spend_requirement) {
      notes.push(
        `⚠ Signup bonus requires $${candidate.signup_bonus_spend_requirement.toLocaleString()} in ${monthsRequired} months — your total spend (~$${Math.round(reachable).toLocaleString()}) falls short. You'd need to time this card with a large one-time purchase to hit the requirement.`
      );
    }
  }
  // Soft no-annual-fee preference: note the fee if user prefers no fee but card has one
  if (preferNoAnnualFee === "soft" && candidate.annual_fee > 0) {
    notes.push(
      `Has $${candidate.annual_fee} annual fee — you mentioned preferring no fee, but at your spending level the rewards likely exceed this cost.`
    );
  }
  // Warn cash-preferring users that transferable points ≠ cash back
  // Exception: citi-double-cash is effectively 2% cash back despite using TY points
  const isCashEquivalent = EFFECTIVE_CASH_CARDS.has(candidate.id);
  if (rewardPreference === "cash" && TRANSFERABLE_POINT_CURRENCIES.has(candidate.rewards_currency) && !isCashEquivalent) {
    notes.push(
      `This card earns transferable points (${candidate.rewards_currency.replace(/_/g, " ")}), not direct cash back. ` +
      `Cash redemption value is lower than shown — best value requires transferring to airline/hotel partners. ` +
      `If you want true cash back, consider a flat-rate card instead.`
    );
  }
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
      (n) => n.toLowerCase().includes("up to") || n.toLowerCase().includes("require") || n.toLowerCase().includes("only") || n.toLowerCase().includes("limit")
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
// Co-branded hotel/airline currencies that aren't practical cash back
const HOTEL_AIRLINE_CURRENCIES = new Set(["hilton_honors", "marriott_bonvoy", "delta_skymiles"]);
// Currencies that ARE effectively cash back despite being "points"
const EFFECTIVE_CASH_CARDS = new Set(["citi-double-cash"]);

export function recommendCreditCards(
  spending: SpendingProfile,
  existingCardIds: string[],
  rewardPreference: "cash" | "travel",
  creditScore?: number,
  preferNoAnnualFee?: "hard" | "soft" | false,
  preferFlatRate?: boolean,
  hasExistingCards?: boolean
): CreditCardRecommendationCard[] {
  const existingCards = ALL_CARDS.filter((c) => existingCardIds.includes(c.id));

  // noCardsAtAll = user confirmed they have zero cards (not just unnamed cards)
  const noCardsAtAll = existingCards.length === 0 && !hasExistingCards;

  // Credit score filtering — +10 buffer allows cards that are close to the user's score
  // (accounts for score fluctuations and leniency). Cards well above the score are filtered.
  const effectiveScore = creditScore !== undefined ? Math.max(creditScore, 640) : 700;
  const scoreFilter = creditScore !== undefined
    ? (c: CreditCard) => !c.min_credit_score || c.min_credit_score <= effectiveScore + 10
    : () => true;

  // No-annual-fee filter: hard = exclude; soft = include but note in watchOut
  const feeFilter = preferNoAnnualFee === "hard"
    ? (c: CreditCard) => c.annual_fee === 0
    : () => true;

  // Reward type filters
  // Travel users: exclude pure cash cards AND effective-cash cards (citi-double-cash is functionally cash back)
  // Cash users: exclude hotel/airline co-brands (poor cash redemption value)
  const rewardTypeFilter = rewardPreference === "travel"
    ? (c: CreditCard) => c.rewards_currency !== "cash" && !EFFECTIVE_CASH_CARDS.has(c.id)
    : (c: CreditCard) => !HOTEL_AIRLINE_CURRENCIES.has(c.rewards_currency);

  // Flat-rate filter: only cards where all non-zero category rates are equal
  const flatRateFilter = preferFlatRate
    ? (c: CreditCard) => {
        const rates = Object.values(c.category_rates).filter((r) => r > 0);
        return rates.length > 0 && rates.every((r) => r === rates[0]);
      }
    : () => true;

  // Mutual exclusion filter
  const mutualExclusionFilter = (c: CreditCard) =>
    !(c.mutually_exclusive_with?.some((id) => existingCardIds.includes(id)));

  const candidates = ALL_CARDS.filter(
    (c) =>
      !existingCardIds.includes(c.id) &&
      scoreFilter(c) &&
      feeFilter(c) &&
      rewardTypeFilter(c) &&
      flatRateFilter(c) &&
      mutualExclusionFilter(c)
  );

  const totalMonthlySpend = Object.values(spending).reduce((a, b) => a + b, 0);

  const scored = candidates.map((candidate) => {
    const { marginalValue, annualNetBenefit, categoryBreakdown } =
      computeMarginalValue(candidate, existingCards, spending, rewardPreference, noCardsAtAll);

    const pointValue =
      rewardPreference === "travel"
        ? candidate.point_value_travel
        : candidate.point_value_cash;
    const signupBonusValue = candidate.signup_bonus_points * pointValue;

    const why = buildWhyRecommended(
      candidate,
      [...categoryBreakdown],
      marginalValue,
      rewardPreference,
      existingCardIds
    );
    const watchOut = buildWatchOut(candidate, rewardPreference, preferNoAnnualFee, creditScore, totalMonthlySpend);

    return {
      card: candidate,
      rank: 0,
      annual_net_benefit: annualNetBenefit,
      marginal_value: marginalValue,
      category_breakdown: categoryBreakdown,
      signup_bonus_value: signupBonusValue,
      reward_preference: rewardPreference,
      why_recommended: why,
      watch_out: watchOut,
    } satisfies CreditCardRecommendationCard;
  });

  // Sort by marginal value descending, take top 5, assign ranks
  const sorted = scored.sort((a, b) => b.marginal_value - a.marginal_value);

  // If portfolio is already well-covered, still return top options but
  // rank 1 will have a very low/negative marginal value — the UI handles the messaging.
  return sorted
    .slice(0, 5)
    .map((card, i) => ({ ...card, rank: i + 1 }));
}

/**
 * G-2: Portfolio gap analysis.
 * Given a user's existing card IDs and spending profile, returns which spending
 * categories are poorly covered (< 2x) and the effective rates per category.
 */
export function buildPortfolioGapAnalysis(
  existingCardIds: string[],
  spending: SpendingProfile
): { uncovered_categories: string[]; effective_rates: Record<string, number> } {
  const ownedCards = ALL_CARDS.filter((c) => existingCardIds.includes(c.id));

  const categories = ["dining", "groceries", "travel", "gas", "online_shopping", "streaming", "entertainment", "pharmacy"] as const;

  // Max earn rate across existing cards per category
  const effective_rates: Record<string, number> = {};
  for (const cat of categories) {
    effective_rates[cat] = ownedCards.reduce((max, card) => {
      const rate = card.category_rates[cat] ?? card.category_rates.other ?? 1;
      return Math.max(max, rate);
    }, 1);
  }

  // Categories where existing stack earns <2x AND user spends meaningfully (>$50/mo)
  const uncovered_categories = categories.filter(
    (cat) => effective_rates[cat] < 2 && (spending[cat] ?? 0) > 50
  );

  return { uncovered_categories, effective_rates };
}

/** Lookup a card by id (used for points linkage). */
export function getCardById(id: string): CreditCard | undefined {
  return ALL_CARDS.find((c) => c.id === id);
}

/** Return all card ids (for UI multi-select). */
export function getAllCards(): CreditCard[] {
  return ALL_CARDS;
}
