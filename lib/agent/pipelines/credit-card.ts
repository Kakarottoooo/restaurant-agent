import { CreditCardIntent, CreditCardRecommendationCard, SpendingProfile } from "../../types";
import { recommendCreditCards } from "../../creditCardEngine";

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

  return { creditCardRecommendations };
}
