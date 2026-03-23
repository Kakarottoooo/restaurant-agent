import { CreditCardIntent, CreditCardRecommendationCard, SpendingProfile } from "../../types";
import { recommendCreditCards, buildPortfolioGapAnalysis, getAllCards } from "../../creditCardEngine";

// ─── Phase 9: Credit Card Pipeline ───────────────────────────────────────────

export async function runCreditCardPipeline(
  intent: CreditCardIntent
): Promise<{ creditCardRecommendations: CreditCardRecommendationCard[] }> {
  const spending: SpendingProfile = intent.spending_profile ?? {
    dining: 300,
    groceries: 400,
    travel: 200,
    gas: 100,
    online_shopping: 150,
    streaming: 30,
    entertainment: 0,
    pharmacy: 50,
    rent: 0,
    other: 200,
  };
  const existingCards = intent.existing_cards ?? [];
  const rewardPreference = intent.reward_preference ?? "travel";
  // null means MiniMax said "not mentioned" → no filtering; undefined means field missing → same
  const creditScore = (intent.credit_score !== null && intent.credit_score !== undefined)
    ? intent.credit_score
    : undefined;
  const preferNoAnnualFee = intent.prefer_no_annual_fee ?? false;
  const preferFlatRate = intent.prefer_flat_rate ?? false;
  const hasExistingCards = intent.has_existing_cards ?? (existingCards.length > 0);

  const creditCardRecommendations = recommendCreditCards(
    spending,
    existingCards,
    rewardPreference,
    creditScore,
    preferNoAnnualFee,
    preferFlatRate,
    hasExistingCards
  );

  // G-2: Portfolio review mode — annotate cards with gap-fill notes
  if (intent.optimization_mode === "portfolio_review" && existingCards.length > 0) {
    const gap = buildPortfolioGapAnalysis(existingCards, spending);
    if (gap.uncovered_categories.length > 0) {
      const CARDS = getAllCards();
      const annotated: CreditCardRecommendationCard[] = creditCardRecommendations.map((rec) => {
        const card = CARDS.find((c) => c.id === rec.card.id);
        if (!card) return rec;
        const covered = gap.uncovered_categories.filter((cat) => {
          const key = cat as keyof typeof card.category_rates;
          const rate = card.category_rates[key] ?? 1;
          return rate >= 2;
        });
        if (covered.length === 0) return rec;
        const note = `Fills your ${gap.uncovered_categories.map((c) => c.replace(/_/g, " ")).join(", ")} gap${gap.uncovered_categories.length > 1 ? "s" : ""} — earns ${covered.map((cat) => `${card.category_rates[cat as keyof typeof card.category_rates]}× on ${cat.replace(/_/g, " ")}`).join(", ")}`;
        return { ...rec, portfolio_gap_note: note };
      });
      return { creditCardRecommendations: annotated };
    }
  }

  return { creditCardRecommendations };
}
