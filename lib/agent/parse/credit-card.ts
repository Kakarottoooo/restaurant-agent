import { CreditCardIntent } from "../../types";
import { minimaxChat } from "../../minimax";

export async function parseCreditCardIntent(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<CreditCardIntent> {
  // Combine conversation for context
  const context = conversationHistory
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const text = await minimaxChat({
    messages: [
      {
        role: "user",
        content: `Extract credit card recommendation requirements from this conversation. Return ONLY valid JSON.

User message: "${userMessage}"
${context ? `Recent conversation:\n${context}` : ""}

Return JSON:
{
  "category": "credit_card",
  "has_spending_info": true or false,
  "reward_preference": "cash" | "travel" | null,
  "existing_cards": ["card id string", ...] or [],
  "credit_score": number or null,
  "prefer_no_annual_fee": "hard" | "soft" | false,
  "prefer_flat_rate": true or false,
  "has_existing_cards": true or false,
  "optimization_mode": "first_card" | "add_to_stack" | "portfolio_review",
  "spending_profile": {
    "dining": monthly_usd or 0,
    "groceries": monthly_usd or 0,
    "travel": monthly_usd or 0,
    "gas": monthly_usd or 0,
    "online_shopping": monthly_usd or 0,
    "streaming": monthly_usd or 0,
    "entertainment": monthly_usd or 0,
    "pharmacy": monthly_usd or 0,
    "rent": monthly_usd or 0,
    "other": monthly_usd or 0
  }
}

SPENDING CATEGORY MAPPING RULES:
- "entertainment", "bars", "nightlife", "concerts" → split between dining and other
- "subscriptions", "streaming services", "Netflix/Spotify/etc" → streaming
- "transit", "subway", "metro", "Uber", "Lyft", "commuting", "train", "bus" → travel (NOT gas; transit earns under travel on most cards)
- "gas", "gas station", "fuel" → gas
- "rent", "monthly rent", "apartment", "lease payment", "housing cost", "place costs", "my apartment costs" → rent (NOT other)
- "Amazon", "Amazon.com" → online_shopping
- "Whole Foods" → groceries
- "software", "SaaS", "online tools", "cloud services" → online_shopping
- "office supplies", "home office" → other
- "entertainment", "movies", "concerts", "sports events", "theme parks", "activities" → entertainment
- "kids activities" → entertainment
- "childcare", "education", "tuition" → other
- "client entertainment" → dining
- IMPORTANT: do not invent spending categories. If amounts don't add up to total, put remainder in "other"

CREDIT SCORE:
- Set credit_score to the number if user mentions their score (e.g. "my score is 720" → 720)
- "no credit history" / "first card" / "never had a card" → credit_score: 0
- "fair credit" → 640, "good credit" → 700, "excellent credit" → 750
- If not mentioned → null

PREFER NO ANNUAL FEE:
- "hard" if user says "no annual fee", "no yearly fee", "free card only", "must be free"
- "soft" if user says "no annual fee if possible", "prefer no fee", "ideally no fee"
- false if not mentioned

PREFER FLAT RATE:
- true if user says "flat rate", "same rate everywhere", "don't want to track categories", "one card for everything", "simple", "just one card"
- false otherwise

HAS EXISTING CARDS:
- true if user mentions having any cards (even without naming them), e.g. "I have 4 cards", "I already have some cards", "my current cards"
- false if user says they have no cards or this is their first card

SPENDING INFO:
- Set has_spending_info to true if user gave ANY dollar amounts OR described spending patterns with enough detail to estimate (e.g. "3-4 flights a month", "eat out daily", "mostly Amazon shopping")
- Set to false ONLY if user gave zero spending context at all

For existing_cards, use these ids: chase-sapphire-preferred, chase-sapphire-reserve, chase-freedom-unlimited, chase-freedom-flex, amex-platinum, amex-gold, amex-blue-cash-preferred (6% groceries, $95/yr fee), amex-blue-cash-everyday (3% groceries, no fee), citi-strata-premier, citi-double-cash, capital-one-venture-x, capital-one-venture, capital-one-savor-one, discover-it-cash-back, wells-fargo-active-cash, bilt-mastercard, chase-ink-business-preferred, amex-business-gold.
If user says "Amex Blue" without specifying → amex-blue-cash-everyday. If user says "a Visa/Mastercard/card but doesn't know the name" → ignore (don't add to existing_cards).

OPTIMIZATION MODE:
- "portfolio_review": user names ≥1 specific card AND asks "what am I missing?" / "what should I add?" / "optimize" / "还需要什么" / "gap" / "complement"
- "add_to_stack": user has cards (has_existing_cards=true) but just asks for a recommendation without specifically asking what's missing
- "first_card": credit_score=0 OR user says "never had a card" / "first card"
- default: "add_to_stack"

If user has not provided spending details, use these defaults: dining=300, groceries=400, travel=200, gas=100, online_shopping=150, streaming=30, pharmacy=50, rent=0, other=200.
If user has not stated reward_preference, default to "travel".`,
      },
    ],
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      category: "credit_card",
      reward_preference: "travel",
      existing_cards: [],
      spending_profile: {
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
      },
    };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const needs_spending_info = parsed.has_spending_info === false;
    return { category: "credit_card", ...parsed, needs_spending_info };
  } catch {
    return { category: "credit_card", reward_preference: "travel", existing_cards: [], needs_spending_info: true };
  }
}
