// import Anthropic from "@anthropic-ai/sdk";
// const client = new Anthropic();

import { googlePlacesSearch, tavilySearch, geocodeLocation, fetchReviewSignals, searchHotels, searchFlights, resolveMultiAirport } from "./tools";
import { UserRequirements, Restaurant, RecommendationCard, SessionPreferences, ScoringDimensions, HotelIntent, RestaurantIntent, FlightIntent, CreditCardIntent, LaptopIntent, LaptopUseCase, ParsedIntent, HotelRecommendationCard, FlightRecommendationCard, CreditCardRecommendationCard, LaptopRecommendationCard, SpendingProfile, CategoryType, Flight, SubscriptionIntent, SmartphoneIntent, SmartphoneUseCase, SmartphoneRecommendationCard, HeadphoneIntent, HeadphoneUseCase, HeadphoneRecommendationCard } from "./types";
import type { WatchCategory } from "./watchTypes";
import { CITIES, DEFAULT_CITY } from "./cities";
import { UserRequirementsSchema, RankedItemArraySchema } from "./schemas";
import { recommendCreditCards } from "./creditCardEngine";
import { recommendLaptops, classifyMentionedModels } from "./laptopEngine";
import { recommendSmartphones, classifyMentionedSmartphones } from "./smartphoneEngine";
import { recommendHeadphones, classifyMentionedHeadphones } from "./headphoneEngine";

const MINIMAX_API_URL = "https://api.minimaxi.chat/v1/chat/completions";
const MINIMAX_MODEL = "MiniMax-Text-01";

async function minimaxChat(params: {
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  max_tokens?: number;
}): Promise<string> {
  const messages = params.system
    ? [{ role: "system" as const, content: params.system }, ...params.messages]
    : params.messages;

  const res = await fetch(MINIMAX_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages,
      max_tokens: params.max_tokens ?? 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax API error: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── Phase 3.2: Weighted Scoring ─────────────────────────────────────────────

export const DEFAULT_WEIGHTS = {
  budget_match: 0.25,
  scene_match: 0.30,
  review_quality: 0.20,
  location_convenience: 0.15,
  preference_match: 0.10,
};

export function computeWeightedScore(
  dimensions: Omit<ScoringDimensions, "weighted_total">,
  weights: typeof DEFAULT_WEIGHTS = DEFAULT_WEIGHTS
): number {
  const raw =
    dimensions.budget_match * weights.budget_match +
    dimensions.scene_match * weights.scene_match +
    dimensions.review_quality * weights.review_quality +
    dimensions.location_convenience * weights.location_convenience +
    dimensions.preference_match * weights.preference_match;
  const penalized = raw - dimensions.red_flag_penalty;
  return Math.round(Math.max(0, Math.min(10, penalized)) * 10) / 10;
}

// ─── Phase 3.3a: Session Preference Extraction ───────────────────────────────

export async function extractRefinements(
  newMessage: string,
  currentPreferences: SessionPreferences
): Promise<SessionPreferences> {
  try {
    const text = await minimaxChat({
      messages: [
        {
          role: "user",
          content: `You are updating a user preference profile based on their latest refinement message.
Current preferences: ${JSON.stringify(currentPreferences)}
New message: "${newMessage}"

Extract any preference updates implied by the message. Return ONLY updated preferences JSON with the same schema.
Only update fields that are clearly implied. Do not invent preferences.
Examples:
- "more quiet" → noise_preference: "quiet"
- "cheaper options" → budget_ceiling reduced by ~30%
- "no chains please" → exclude_chains: true
- "remove Thai from results" → excluded_cuisines: [..., "Thai"]

Return the full updated JSON object.`,
        },
      ],
    });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return currentPreferences;
    const updated = JSON.parse(jsonMatch[0]);
    return {
      ...currentPreferences,
      ...updated,
      refined_from_query_count: currentPreferences.refined_from_query_count + 1,
    };
  } catch {
    return currentPreferences;
  }
}

function formatSessionPreferences(prefs: SessionPreferences): string {
  const parts: string[] = [];
  if (prefs.noise_preference) parts.push(`Noise preference: ${prefs.noise_preference}`);
  if (prefs.budget_ceiling) parts.push(`Budget ceiling: $${prefs.budget_ceiling}/person`);
  if (prefs.exclude_chains) parts.push("Exclude chains: yes");
  if (prefs.excluded_cuisines.length > 0)
    parts.push(`Excluded cuisines: ${prefs.excluded_cuisines.join(", ")}`);
  if (prefs.required_features.length > 0)
    parts.push(`Required features: ${prefs.required_features.join(", ")}`);
  if (prefs.occasion) parts.push(`Occasion: ${prefs.occasion}`);
  return parts.length > 0
    ? `User session preferences (accumulated from conversation):\n${parts.map((p) => `- ${p}`).join("\n")}\nPlease factor these into your recommendations.`
    : "";
}

// ─── Phase 7.1: Two-layer Intent Architecture ────────────────────────────────

export const HOTEL_DEFAULT_WEIGHTS = {
  budget_match: 0.30,
  scene_match: 0.25,
  review_quality: 0.20,
  location_convenience: 0.20,
  preference_match: 0.05,
};

async function detectCategory(message: string): Promise<CategoryType> {
  const lower = message.toLowerCase();
  const creditCardKeywords = [
    "credit card", "credit cards", "cash back", "cashback", "rewards card",
    "points card", "travel card", "which card", "best card", "card recommendation",
    "what card", "recommend a card", "suggest a card", "get a card", "apply for",
    "signup bonus", "sign-up bonus", "annual fee", "no annual fee",
    "spend on", "i spend", "monthly spend", "per month", "spending profile",
    "rewards points", "earn points", "points on", "miles on",
    "chase sapphire", "amex gold", "amex platinum", "venture x", "capital one",
    "no cards currently", "no card", "first card", "open to business cards",
    "prefer points", "prefer cash", "prefer travel rewards",
    "信用卡", "哪张卡", "积分卡", "返现卡", "推荐卡", "开卡奖励",
  ];

  // Spending-context signals: if user describes their monthly spend breakdown
  // AND asks for a recommendation, it's almost certainly a credit card query
  const hasSpendingContext = /\$[\d,]+\s*(\/month|per month|a month|monthly)/.test(lower)
    || /\d+[k]?\s*(\/month|per month|a month)/.test(lower)
    || lower.includes("monthly spend") || lower.includes("i spend about");
  const hasCardRecommendationAsk = lower.includes("recommend") || lower.includes("what should")
    || lower.includes("which") || lower.includes("suggest") || lower.includes("best")
    || lower.includes("what card") || lower.includes("open to");

  if (hasSpendingContext && hasCardRecommendationAsk) return "credit_card";

  const flightKeywords = [
    "flight", "flights", "fly", "flying", "plane", "airline", "airport",
    "ticket", "tickets", "one way", "round trip", "roundtrip", "nonstop",
    "economy class", "business class", "first class", "layover", "stopover",
    "depart", "departing", "arrive", "arriving", "boarding",
    "机票", "航班", "飞机", "起飞", "降落", "经济舱", "商务舱",
  ];
  const hotelKeywords = [
    "hotel", "motel", "inn", "resort", "lodge", "hostel", "airbnb",
    "check in", "check-in", "check out", "check-out", "nights", "night stay",
    "stay at", "book a room", "accommodation", "suite", "booking",
    "酒店", "旅馆", "住", "入住", "退房", "晚", "客房",
  ];
  const laptopKeywords = [
    "laptop", "notebooks", "notebook computer", "macbook", "thinkpad", "chromebook",
    "ultrabook", "gaming laptop", "business laptop", "laptop recommendation",
    "which laptop", "best laptop", "what laptop", "recommend a laptop", "suggest a laptop",
    "looking for a laptop", "need a laptop", "buy a laptop", "purchase a laptop",
    "software development laptop", "video editing laptop", "coding laptop",
    "work from home laptop", "wfh laptop", "college laptop", "student laptop",
    "light laptop", "portable laptop", "budget laptop", "laptop under",
    // use-case descriptions without explicit device name
    "photo editing", "photo edit", "video editing", "note-taking", "note taking", "notetaking",
    "college student", "for school", "for college", "for uni", "for university",
    "for coding", "for programming", "for development", "for gaming",
    "笔记本", "笔记本电脑", "电脑推荐", "哪款电脑", "苹果电脑", "游戏本",
    "轻薄本", "商务本", "编程用什么电脑", "剪辑用什么电脑",
  ];

  // Subscription detection — must come before other categories
  const subscriptionKeywords = [
    "tell me when", "let me know when", "notify me", "notify me when",
    "alert me", "alert me when", "keep me posted", "keep me updated",
    "watch for", "monitor for", "subscribe", "track releases",
    "when.*release", "when.*announce", "when.*come out", "when.*launch",
    "新品提醒", "发布提醒", "出了告诉我", "新款提醒",
  ];
  const hasSubscriptionTrigger = subscriptionKeywords.some((kw) =>
    kw.includes(".*") ? new RegExp(kw).test(lower) : lower.includes(kw)
  );
  // Also detect unsubscribe / list
  const hasUnsubscribe = lower.includes("stop notif") || lower.includes("unsubscribe") || lower.includes("取消订阅");
  const hasListSubs = (lower.includes("what am i") && lower.includes("watch")) ||
    lower.includes("my subscriptions") || lower.includes("show subscriptions") ||
    lower.includes("我的订阅");
  if (hasSubscriptionTrigger || hasUnsubscribe || hasListSubs) return "subscription";

  // Credit card check first to avoid collision with "travel card" → hotel
  if (creditCardKeywords.some((kw) => lower.includes(kw))) return "credit_card";

  // Smartphone keywords
  const smartphoneKeywords = [
    "phone", "smartphone", "iphone", "galaxy", "pixel phone", "android phone",
    "mobile phone", "cell phone", "which phone", "best phone", "new phone",
    "recommend a phone", "buy a phone", "upgrade my phone",
    "galaxy s", "galaxy a", "nothing phone", "oneplus", "xperia",
    "手机", "苹果手机", "安卓手机", "换手机", "买手机", "推荐手机",
  ];
  // Headphone keywords
  const headphoneKeywords = [
    "headphone", "headphones", "earbuds", "earphones", "airpods", "buds",
    "noise canceling", "noise cancelling", "noise-cancelling", "anc headphone",
    "over-ear", "in-ear", "wireless headphone", "wired headphone",
    "wh-1000xm", "wf-1000xm", "quietcomfort", "momentum wireless",
    "which headphones", "best headphones", "recommend headphones",
    "耳机", "无线耳机", "降噪耳机", "入耳式", "头戴式",
  ];

  if (headphoneKeywords.some((kw) => lower.includes(kw))) return "headphone";
  if (smartphoneKeywords.some((kw) => lower.includes(kw))) return "smartphone";
  // Laptop check before flight/hotel to avoid collision
  if (laptopKeywords.some((kw) => lower.includes(kw))) return "laptop";
  if (flightKeywords.some((kw) => lower.includes(kw))) return "flight";
  if (hotelKeywords.some((kw) => lower.includes(kw))) return "hotel";

  // No keyword matched — ask LLM to classify rather than blindly defaulting to restaurant
  try {
    const raw = await minimaxChat({
      system: `You are a query classifier. Given a user message, reply with exactly one word — the category it belongs to:
- "laptop"     : asking for a laptop, computer, notebook recommendation
- "smartphone" : asking for a phone, iPhone, Android phone recommendation
- "headphone"  : asking for headphones, earbuds, earphones recommendation
- "credit_card": asking for a credit card recommendation
- "flight"     : asking about flights or plane tickets
- "hotel"      : asking about hotel or accommodation
- "restaurant" : asking about food, dining, eating out, or a restaurant

Reply with only the single word. No explanation.`,
      messages: [{ role: "user", content: message }],
      max_tokens: 5,
    });
    const category = raw.trim().toLowerCase().replace(/[^a-z_]/g, "") as CategoryType;
    if (["laptop", "smartphone", "headphone", "credit_card", "flight", "hotel", "restaurant"].includes(category)) {
      return category;
    }
  } catch {
    // ignore, fall through to default
  }
  return "restaurant";
}

async function parseHotelIntent(
  userMessage: string,
  cityFullName: string,
  sessionPreferences?: SessionPreferences,
  profileContext?: string
): Promise<HotelIntent> {
  const text = await minimaxChat({
    messages: [
      {
        role: "user",
        content: `Extract hotel search requirements from this request. Return ONLY valid JSON.

User request: "${userMessage}"
Default city (use ONLY if user did not mention any location): ${cityFullName}
Today's date: ${new Date().toISOString().split("T")[0]}

IMPORTANT: For "location", look for any city, region, or place name in the user request (including typos like "las vagas"="Las Vegas", "new yok"="New York"). Only fall back to "${cityFullName}" if the user truly mentioned no location.

Return JSON with these fields (omit fields that aren't mentioned):
{
  "category": "hotel",
  "location": "<city from user message, or ${cityFullName} if none>",
  "check_in": "YYYY-MM-DD or null",
  "check_out": "YYYY-MM-DD or null",
  "nights": number or null,
  "guests": number or null,
  "star_rating": number or null (minimum star rating requested),
  "room_type": "single|double|suite|null",
  "amenities": ["pool", "gym", "parking", "breakfast", "wifi", etc],
  "budget_per_night": number or null,
  "budget_total": number or null,
  "neighborhood": "specific area or null",
  "purpose": "business|leisure|romantic|family|null",
  "constraints": ["no chains", "quiet", "pet-friendly", etc],
  "priorities": ["price", "location", "amenities", etc]
}

For relative dates: "tonight" = today, "tomorrow" = tomorrow, "next Friday" = nearest upcoming Friday, "2 nights" sets nights=2 and check_out = check_in + 2 days.`,
      },
    ],
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { category: "hotel", location: cityFullName };
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    // If nights given but no check_out, compute it
    if (parsed.check_in && parsed.nights && !parsed.check_out) {
      const d = new Date(parsed.check_in);
      d.setDate(d.getDate() + parsed.nights);
      parsed.check_out = d.toISOString().split("T")[0];
    }
    return { category: "hotel", ...parsed };
  } catch {
    return { category: "hotel", location: cityFullName };
  }
}

// ─── Layer 1: Intent Parsing ──────────────────────────────────────────────────

async function parseRestaurantIntent(
  userMessage: string,
  cityFullName: string,
  sessionPreferences?: SessionPreferences,
  profileContext?: string
): Promise<RestaurantIntent> {
  const prefContext = sessionPreferences
    ? formatSessionPreferences(sessionPreferences)
    : "";

  const text = await minimaxChat({
    messages: [
      {
        role: "user",
        content: `Extract structured requirements from this restaurant request. Return ONLY valid JSON.

User request: "${userMessage}"
Default city (use ONLY if user did not mention any location): ${cityFullName}
${prefContext ? `\n${prefContext}` : ""}
${profileContext ? `\nUser profile: ${profileContext}` : ""}

IMPORTANT: For "location", look for any city or place name in the user request (including typos). Only fall back to "${cityFullName}" if the user truly mentioned no location.

Return JSON with these fields (omit fields that aren't mentioned):
{
  "cuisine": "string or null",
  "purpose": "date|business|family|friends|solo|group|null",
  "budget_per_person": number or null,
  "budget_total": number or null,
  "atmosphere": ["romantic", "quiet", "lively", "cozy", "trendy", etc],
  "noise_level": "quiet|moderate|lively|any",
  "location": "<city from user message, or ${cityFullName} if none>",
  "neighborhood": "specific neighborhood or null",
  "near_location": "specific landmark, address, or area to search near (e.g. 'Union Square', 'Times Square'), or null",
  "party_size": number or null,
  "constraints": ["no chains", "no tourist traps", "no wait", etc],
  "priorities": ["atmosphere", "food quality", "price", "service", etc]
}`,
      },
    ],
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { category: "restaurant" } as RestaurantIntent;
  try {
    const parsed = UserRequirementsSchema.safeParse(JSON.parse(jsonMatch[0]));
    return parsed.success ? ({ category: "restaurant", ...parsed.data } as RestaurantIntent) : { category: "restaurant" };
  } catch {
    return { category: "restaurant" } as RestaurantIntent;
  }
}

async function parseFlightIntent(
  userMessage: string,
  cityFullName: string
): Promise<FlightIntent> {
  const text = await minimaxChat({
    messages: [
      {
        role: "user",
        content: `Extract flight search requirements from this request. Return ONLY valid JSON.

User request: "${userMessage}"
Default city (use ONLY if user did not mention departure): ${cityFullName}
Today's date: ${new Date().toISOString().split("T")[0]}

Return JSON with these fields (omit fields not mentioned):
{
  "category": "flight",
  "departure_city": "<city or IATA code from user message>",
  "arrival_city": "<destination city or IATA code>",
  "date": "YYYY-MM-DD or null",
  "return_date": "YYYY-MM-DD or null (only for round trip)",
  "is_round_trip": true or false,
  "passengers": number or null,
  "cabin_class": "economy|business|first or null",
  "prefer_direct": true or false (true if user says 'nonstop', 'direct', '直飞'),
  "max_stops": null or 0 (nonstop only) or 1 (at most 1 stop) — set when user explicitly limits stops, otherwise null,
  "budget_total": number or null
}

For relative dates: "tomorrow" = tomorrow, "next Friday" = nearest upcoming Friday, "this weekend" = nearest Saturday.
For "round trip"/"往返": set is_round_trip=true.
Default cabin_class to "economy" if not specified.`,
      },
    ],
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { category: "flight" };
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return { category: "flight", ...parsed };
  } catch {
    return { category: "flight" };
  }
}

async function parseCreditCardIntent(
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

// ─── Phase 9: Credit Card Pipeline ───────────────────────────────────────────

async function runCreditCardPipeline(
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

// ─── Subscription Intent Parsing ─────────────────────────────────────────────

async function parseSubscriptionIntent(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<SubscriptionIntent> {
  const recentHistory = conversationHistory.slice(-4);
  const fallback: SubscriptionIntent = {
    category: "subscription",
    action: "subscribe",
    watch_category: null,
    brands: [],
    keywords: [],
    label: "new product releases",
  };

  try {
    const text = await minimaxChat({
      system: `You parse product release subscription requests.
Return ONLY a valid JSON object:
{
  "action": "subscribe",       // "subscribe" | "unsubscribe" | "list"
  "watch_category": "laptop",  // "laptop" | "gpu" | "phone" | "car" | "tablet" | "monitor" | null
  "brands": [],                // brand names explicitly mentioned, e.g. ["Apple","NVIDIA"]
  "keywords": [],              // specific product line keywords, e.g. ["MacBook Pro","RTX 5090"]
  "label": ""                  // short human-readable label, e.g. "Apple MacBook releases"
}

Rules:
- action: "list" if user asks what they're subscribed to
- action: "unsubscribe" if user wants to stop notifications
- watch_category: detect from context:
    laptop → laptop, MacBook, ThinkPad, notebook computer
    gpu → GPU, graphics card, RTX, Radeon, GeForce
    phone → phone, iPhone, smartphone, Galaxy, Pixel
    car → car, EV, Tesla, electric vehicle
    tablet → tablet, iPad
    monitor → monitor, display, screen
- brands: only names explicitly stated, no inference
- keywords: specific product names mentioned (e.g. "RTX 5090") but NOT generic category words
- label: concise English summary, max 6 words`,
      messages: [
        ...recentHistory,
        { role: "user" as const, content: userMessage },
      ],
      max_tokens: 256,
    });

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]);

    const validActions = ["subscribe", "unsubscribe", "list"];
    const validCategories: WatchCategory[] = ["laptop", "smartphone", "headphone", "gpu", "car", "tablet", "monitor"];

    return {
      category: "subscription",
      action: validActions.includes(parsed.action) ? parsed.action : "subscribe",
      watch_category: validCategories.includes(parsed.watch_category) ? parsed.watch_category : null,
      brands: Array.isArray(parsed.brands) ? parsed.brands : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      label: typeof parsed.label === "string" ? parsed.label : fallback.label,
    };
  } catch {
    return fallback;
  }
}

// ─── Smartphone Intent Parsing ───────────────────────────────────────────────

async function parseSmartphoneIntent(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<SmartphoneIntent> {
  const recentHistory = conversationHistory.slice(-6);
  const fallback: SmartphoneIntent = {
    category: "smartphone",
    use_cases: [],
    budget_usd_max: null,
    budget_usd_min: null,
    os_preference: "any",
    avoid_brands: [],
    needs_use_case_info: true,
    mentioned_models: [],
  };
  try {
    const text = await minimaxChat({
      system: `You extract smartphone purchase intent from user messages.
Return ONLY a valid JSON object:
{
  "use_cases": [],           // array of: "photography","gaming","business","everyday","budget_value"
  "budget_usd_max": null,    // number or null
  "budget_usd_min": null,    // number or null
  "os_preference": "any",    // "ios","android","any"
  "avoid_brands": [],        // brands to exclude
  "needs_use_case_info": false, // true if unclear what they'll use it for
  "mentioned_models": []     // specific models named e.g. ["iPhone 17","Galaxy S26"]
}
Rules:
- photography, camera, vlogging, TikTok, YouTube, content creation, selfie, front camera, video stabilization → "photography"
- gaming, high performance, benchmark, fps → "gaming"
- work, email, productivity, business → "business"
- general/all-around, display, battery, everyday use, screen, SOT, storage → "everyday"
- cheap, affordable, budget, under $X, value → "budget_value"
- "iOS","iPhone","Apple phone" → os_preference:"ios"
- "Android" → os_preference:"android"
- If user mentions battery life, screen quality, storage as primary concerns with no specific use case → "everyday"
- needs_use_case_info should be false whenever there is enough context to pick at least one use_case
- Extract budget ranges precisely`,
      messages: [...recentHistory, { role: "user" as const, content: userMessage }],
      max_tokens: 384,
    });
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const p = JSON.parse(match[0]);
    const validUC: SmartphoneUseCase[] = ["photography", "gaming", "business", "everyday", "budget_value"];
    const use_cases = (p.use_cases ?? []).filter((u: string) => validUC.includes(u as SmartphoneUseCase));
    return {
      category: "smartphone",
      use_cases,
      budget_usd_max: p.budget_usd_max ?? null,
      budget_usd_min: p.budget_usd_min ?? null,
      os_preference: ["ios","android","any"].includes(p.os_preference) ? p.os_preference : "any",
      avoid_brands: Array.isArray(p.avoid_brands) ? p.avoid_brands : [],
      needs_use_case_info: p.needs_use_case_info ?? (use_cases.length === 0),
      mentioned_models: Array.isArray(p.mentioned_models) ? p.mentioned_models : [],
    };
  } catch {
    return fallback;
  }
}

// ─── Headphone Intent Parsing ─────────────────────────────────────────────────

async function parseHeadphoneIntent(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<HeadphoneIntent> {
  const recentHistory = conversationHistory.slice(-6);
  const fallback: HeadphoneIntent = {
    category: "headphone",
    use_cases: [],
    budget_usd_max: null,
    budget_usd_min: null,
    form_factor_preference: "any",
    wireless_required: null,
    avoid_brands: [],
    needs_use_case_info: true,
    mentioned_models: [],
  };
  try {
    const text = await minimaxChat({
      system: `You extract headphone purchase intent from user messages.
Return ONLY a valid JSON object:
{
  "use_cases": [],                   // array of: "commute","work_from_home","audiophile","sport","casual"
  "budget_usd_max": null,            // number or null
  "budget_usd_min": null,            // number or null
  "form_factor_preference": "any",   // "over_ear","in_ear","on_ear","any"
  "wireless_required": null,         // true/false/null
  "avoid_brands": [],
  "needs_use_case_info": false,
  "mentioned_models": []             // e.g. ["WH-1000XM6","AirPods Pro 3"]
}
Rules:
- commute, travel, subway, plane → "commute"
- office, work, calls, meetings → "work_from_home"
- audiophile, critical listening, studio, hi-fi → "audiophile"
- gym, running, workout, sport → "sport"
- general, everyday, music → "casual"
- over-ear, over ear, headphones → form_factor:"over_ear"
- in-ear, earbuds, earphones → form_factor:"in_ear"
- "wireless","bluetooth" → wireless_required:true
- "wired" → wireless_required:false`,
      messages: [...recentHistory, { role: "user" as const, content: userMessage }],
      max_tokens: 384,
    });
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const p = JSON.parse(match[0]);
    const validUC: HeadphoneUseCase[] = ["commute", "work_from_home", "audiophile", "sport", "casual"];
    const use_cases = (p.use_cases ?? []).filter((u: string) => validUC.includes(u as HeadphoneUseCase));
    return {
      category: "headphone",
      use_cases,
      budget_usd_max: p.budget_usd_max ?? null,
      budget_usd_min: p.budget_usd_min ?? null,
      form_factor_preference: ["over_ear","in_ear","on_ear","any"].includes(p.form_factor_preference) ? p.form_factor_preference : "any",
      wireless_required: p.wireless_required ?? null,
      avoid_brands: Array.isArray(p.avoid_brands) ? p.avoid_brands : [],
      needs_use_case_info: p.needs_use_case_info ?? (use_cases.length === 0),
      mentioned_models: Array.isArray(p.mentioned_models) ? p.mentioned_models : [],
    };
  } catch {
    return fallback;
  }
}

// ─── Phase 10: Laptop Intent Parsing ─────────────────────────────────────────

async function parseLaptopIntent(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<LaptopIntent> {
  const recentHistory = conversationHistory.slice(-6);
  try {
    const text = await minimaxChat({
      system: `You are a laptop recommendation assistant. Extract structured intent from user messages.
Return ONLY a valid JSON object with exactly these fields:
{
  "use_cases": [],           // array of: "light_productivity","software_dev","video_editing","3d_creative","gaming","data_science","business_travel"
  "budget_usd_max": null,    // number or null
  "budget_usd_min": null,    // number or null
  "os_preference": "any",    // "mac","windows","linux","any"
  "portability_priority": "flexible",  // "critical","preferred","flexible"
  "gaming_required": false,  // boolean
  "display_size_preference": "any",    // "<14","14-15","15+","any"
  "avoid_brands": [],        // e.g. ["Dell","HP"]
  "needs_use_case_info": false,  // true if user didn't clearly specify what they'll use it for
  "mentioned_models": []     // specific device names or chip generations explicitly named by the user, e.g. ["MacBook Pro M5","M4 Pro","RTX 5090"]. Empty if none mentioned.
}

Rules:
- If user says "for coding" or "developer" → use_cases: ["software_dev"]
- If user says "video editing" → use_cases: ["video_editing"]
- If user says "gaming" → use_cases: ["gaming"], gaming_required: true
- If user says "data science","ML","AI" → use_cases: ["data_science"]
- If user says "travel","on the go","lightweight","portable" → use_cases: ["business_travel"], portability_priority: "critical" or "preferred"
- If user says "everyday","general use","Office" → use_cases: ["light_productivity"]
- Multiple use cases are allowed
- If user says "MacBook" or "Mac" or "Apple" → os_preference: "mac"
- If user says "Windows" → os_preference: "windows"
- Extract budget: "$1000-1500" → budget_usd_min:1000, budget_usd_max:1500; "under $1200" → budget_usd_max:1200; "budget" → budget_usd_max:800
- If user doesn't mention what they'll use it for, set needs_use_case_info: true
- For mentioned_models: only include names the user explicitly stated, not inferred ones`,
      messages: [
        ...recentHistory,
        { role: "user" as const, content: userMessage },
      ],
      max_tokens: 512,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]);

    const use_cases: LaptopUseCase[] = (parsed.use_cases ?? []).filter((u: string) =>
      ["light_productivity","software_dev","video_editing","3d_creative","gaming","data_science","business_travel"].includes(u)
    );

    return {
      category: "laptop",
      use_cases: use_cases.length > 0 ? use_cases : [],
      budget_usd_max: parsed.budget_usd_max ?? null,
      budget_usd_min: parsed.budget_usd_min ?? null,
      os_preference: parsed.os_preference ?? "any",
      portability_priority: parsed.portability_priority ?? "flexible",
      gaming_required: parsed.gaming_required ?? false,
      display_size_preference: parsed.display_size_preference ?? "any",
      avoid_brands: parsed.avoid_brands ?? [],
      needs_use_case_info: parsed.needs_use_case_info ?? (use_cases.length === 0),
      mentioned_models: Array.isArray(parsed.mentioned_models) ? parsed.mentioned_models : [],
    };
  } catch {
    return {
      category: "laptop",
      use_cases: [],
      budget_usd_max: null,
      budget_usd_min: null,
      os_preference: "any",
      portability_priority: "flexible",
      gaming_required: false,
      display_size_preference: "any",
      avoid_brands: [],
      needs_use_case_info: true,
      mentioned_models: [],
    };
  }
}

// ─── Phase 10: Laptop Pipeline ────────────────────────────────────────────────

async function runLaptopPipeline(
  intent: LaptopIntent
): Promise<{ laptopRecommendations: LaptopRecommendationCard[]; laptop_db_gap_warning: string | null }> {
  // Default to light_productivity if no use case specified
  const effectiveIntent: LaptopIntent = {
    ...intent,
    use_cases: intent.use_cases.length > 0 ? intent.use_cases : ["light_productivity"],
  };
  const laptopRecommendations = recommendLaptops(effectiveIntent);

  // Check if user mentioned specific models not covered by our database
  let laptop_db_gap_warning: string | null = null;
  if (intent.mentioned_models.length > 0) {
    const { announced, unknown } = classifyMentionedModels(intent.mentioned_models);
    const parts: string[] = [];
    if (announced.length > 0) {
      parts.push(
        `${announced.join(", ")} ${announced.length > 1 ? "have" : "has"} been announced — we're tracking ${announced.length > 1 ? "them" : "it"} but don't have full review data yet.`
      );
    }
    if (unknown.length > 0) {
      parts.push(
        `${unknown.join(", ")} ${unknown.length > 1 ? "aren't" : "isn't"} in our database yet.`
      );
    }
    if (parts.length > 0) {
      laptop_db_gap_warning =
        parts.join(" ") +
        " The recommendations below are the best matches from our current reviewed dataset.";
    }
  }

  return { laptopRecommendations, laptop_db_gap_warning };
}

// ─── Smartphone Pipeline ──────────────────────────────────────────────────────

function buildDbGapWarning(announced: string[], unknown: string[]): string | null {
  const parts: string[] = [];
  if (announced.length > 0)
    parts.push(`${announced.join(", ")} ${announced.length > 1 ? "have" : "has"} been announced — we're tracking ${announced.length > 1 ? "them" : "it"} but don't have full review data yet.`);
  if (unknown.length > 0)
    parts.push(`${unknown.join(", ")} ${unknown.length > 1 ? "aren't" : "isn't"} in our database yet.`);
  return parts.length > 0
    ? parts.join(" ") + " The recommendations below are the best matches from our current reviewed dataset."
    : null;
}

async function runSmartphonePipeline(
  intent: SmartphoneIntent
): Promise<{ smartphoneRecommendations: SmartphoneRecommendationCard[]; db_gap_warning: string | null }> {
  const effectiveIntent: SmartphoneIntent = {
    ...intent,
    use_cases: intent.use_cases.length > 0 ? intent.use_cases : ["everyday"],
  };
  const smartphoneRecommendations = recommendSmartphones(effectiveIntent);
  let db_gap_warning: string | null = null;
  if (intent.mentioned_models.length > 0) {
    const { announced, unknown } = classifyMentionedSmartphones(intent.mentioned_models);
    db_gap_warning = buildDbGapWarning(announced, unknown);
  }
  return { smartphoneRecommendations, db_gap_warning };
}

// ─── Headphone Pipeline ───────────────────────────────────────────────────────

async function runHeadphonePipeline(
  intent: HeadphoneIntent
): Promise<{ headphoneRecommendations: HeadphoneRecommendationCard[]; db_gap_warning: string | null }> {
  const effectiveIntent: HeadphoneIntent = {
    ...intent,
    use_cases: intent.use_cases.length > 0 ? intent.use_cases : ["casual"],
  };
  const headphoneRecommendations = recommendHeadphones(effectiveIntent);
  let db_gap_warning: string | null = null;
  if (intent.mentioned_models.length > 0) {
    const { announced, unknown } = classifyMentionedHeadphones(intent.mentioned_models);
    db_gap_warning = buildDbGapWarning(announced, unknown);
  }
  return { headphoneRecommendations, db_gap_warning };
}

export async function parseIntent(
  userMessage: string,
  cityFullName: string,
  sessionPreferences?: SessionPreferences,
  profileContext?: string,
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
): Promise<ParsedIntent> {
  const category = await detectCategory(userMessage);
  if (category === "subscription") {
    return parseSubscriptionIntent(userMessage, conversationHistory ?? []);
  }
  if (category === "credit_card") {
    return parseCreditCardIntent(userMessage, conversationHistory ?? []);
  }
  if (category === "laptop") {
    return parseLaptopIntent(userMessage, conversationHistory ?? []);
  }
  if (category === "smartphone") {
    return parseSmartphoneIntent(userMessage, conversationHistory ?? []);
  }
  if (category === "headphone") {
    return parseHeadphoneIntent(userMessage, conversationHistory ?? []);
  }
  if (category === "flight") {
    return parseFlightIntent(userMessage, cityFullName);
  }
  if (category === "hotel") {
    return parseHotelIntent(userMessage, cityFullName, sessionPreferences, profileContext);
  }
  return parseRestaurantIntent(userMessage, cityFullName, sessionPreferences, profileContext);
}

// ─── Layer 2+3: Search & Collect (parallel) ──────────────────────────────────

// Phase 4.1: StreamCallbacks type
export type StreamCallbacks = {
  onPartial?: (cards: RecommendationCard[], requirements: UserRequirements) => void;
};

async function gatherCandidates(
  requirements: UserRequirements,
  cityId: string,
  gpsCoords: { lat: number; lng: number } | null = null,
  uiNearLocation?: string
): Promise<{ restaurants: Restaurant[]; semanticSignals: string; tavilyQuery: string }> {
  const city = CITIES[cityId] ?? CITIES[DEFAULT_CITY];

  // UI near_location takes priority over parsed near_location from message
  const effectiveNearLocation = uiNearLocation ?? requirements.near_location;

  // Geocode near_location if provided
  let nearLocationCoords: { lat: number; lng: number } | undefined;
  if (effectiveNearLocation) {
    const geocoded = await geocodeLocation(effectiveNearLocation);
    if (geocoded) nearLocationCoords = geocoded;
  }

  const cityCenter = nearLocationCoords ?? gpsCoords ?? city.center;

  const location = gpsCoords
    ? "Nearby"
    : effectiveNearLocation
    ? effectiveNearLocation
    : requirements.neighborhood
    ? `${requirements.neighborhood}, ${city.fullName}`
    : city.fullName;

  // Map budget to price filter
  let priceFilter: string | undefined;
  const bpp = requirements.budget_per_person;
  if (bpp) {
    if (bpp <= 15) priceFilter = "1";
    else if (bpp <= 30) priceFilter = "1,2";
    else if (bpp <= 60) priceFilter = "2,3";
    else if (bpp <= 100) priceFilter = "3,4";
    else priceFilter = "4";
  }

  const searchQuery = [
    requirements.cuisine,
    requirements.purpose === "date" ? "romantic" : "",
    requirements.noise_level === "quiet" ? "quiet" : "",
    priceFilter ? (parseInt(priceFilter[0]) <= 2 ? "affordable" : "upscale") : "",
    "restaurant",
  ]
    .filter(Boolean)
    .join(" ");

  // Phase 4.4: Broadened search (no cuisine, no price filter)
  const broadSearchQuery = [
    requirements.purpose === "date" ? "romantic" : "",
    requirements.noise_level === "quiet" ? "quiet" : "",
    "restaurant",
  ]
    .filter(Boolean)
    .join(" ");

  const tavilyQuery = [
    requirements.cuisine,
    `restaurant ${city.fullName}`,
    requirements.purpose === "date" ? "romantic date night" : "",
    requirements.atmosphere?.join(" "),
    requirements.noise_level === "quiet" ? "quiet atmosphere" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Phase 4.4: Run primary AND broadened search in parallel, plus Tavily
  const [primaryRestaurants, broadRestaurants, tavilyResult] = await Promise.all([
    googlePlacesSearch({
      query: searchQuery,
      location,
      cityCenter,
      nearLocationCoords,
      maxResults: 20,
    }),
    googlePlacesSearch({
      query: broadSearchQuery,
      location,
      cityCenter,
      nearLocationCoords,
      maxResults: 20,
    }).catch(() => [] as Restaurant[]),
    tavilySearch(`best ${tavilyQuery} reviews 2024`).catch((err) => {
      console.warn("Tavily search failed:", err);
      return { results: "", failed: true };
    }),
  ]);
  const semanticSignals = tavilyResult.failed ? "" : tavilyResult.results;

  // Phase 4.4: Merge and deduplicate by id
  const seenIds = new Set<string>();
  const merged: Restaurant[] = [];
  for (const r of [...primaryRestaurants, ...broadRestaurants]) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      merged.push(r);
    }
  }

  // Phase 4.4: Three-stage funnel
  // Stage 1 (Recall): pool of 30-60 raw candidates → we have merged (up to 40)
  // Stage 2 (Pre-filter): remove rating < 3.5 AND review_count < 30; sort by score, take top 15
  const preFiltered = merged
    .filter((r) => r.rating >= 3.5 && r.review_count >= 30)
    .sort((a, b) => b.rating * Math.log(b.review_count + 1) - a.rating * Math.log(a.review_count + 1))
    .slice(0, 15);

  return { restaurants: preFiltered, semanticSignals, tavilyQuery };
}

// ─── Layer 4+5+6: Rank, Score, Explain ───────────────────────────────────────

async function rankAndExplain(
  requirements: UserRequirements,
  restaurants: Restaurant[],
  semanticSignals: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  cityFullName: string,
  sessionPreferences?: SessionPreferences,
  profileContext?: string,
  customWeights?: Partial<typeof DEFAULT_WEIGHTS>
): Promise<{ cards: RecommendationCard[]; suggested_refinements: string[] }> {
  const restaurantList = restaurants
    .map((r, i) => {
      const signals = r.review_signals;
      let signalLine = "";
      if (signals) {
        const parts = [
          signals.noise_level !== "unknown" ? `noise=${signals.noise_level}` : null,
          signals.wait_time ? `wait=${signals.wait_time}` : null,
          `date_suitability=${signals.date_suitability}/10`,
          signals.red_flags.length > 0 ? `red_flags=${JSON.stringify(signals.red_flags)}` : null,
          signals.notable_dishes.length > 0
            ? `notable=${JSON.stringify(signals.notable_dishes)}`
            : null,
        ].filter(Boolean);
        if (parts.length > 0) signalLine = `\n   Review signals: ${parts.join(", ")}`;
      }
      return `${i + 1}. ${r.name} | ${r.cuisine} | ${r.price} | ⭐${r.rating} (${r.review_count} reviews) | ${r.address}${signalLine}`;
    })
    .join("\n");

  const prefContext = sessionPreferences
    ? formatSessionPreferences(sessionPreferences)
    : "";

  const systemPrompt = `You are an expert ${cityFullName} restaurant advisor. Your job is to pick the best restaurants for the user's specific needs and explain exactly why each one fits or doesn't fit.

Be honest about downsides. Don't recommend places that don't fit. Quality of matching matters more than quantity.`;

  const messages = [
    ...conversationHistory,
    {
      role: "user" as const,
      content: `User requirements: ${JSON.stringify(requirements, null, 2)}
${prefContext ? `\n${prefContext}` : ""}
${profileContext ? `\nUser profile: ${profileContext}` : ""}

Candidate restaurants:
${restaurantList}

Additional context from web search:
${semanticSignals}

Pick the TOP 10 restaurants that best match the user's needs. For each one, fill in scoring dimensions honestly, then write the explanation.

Also, based on the current results and user requirements, suggest 3-5 refinements the user might want to make (in Chinese), such as "更安静一点", "再便宜一点", "离地铁近一点" etc.

Return a JSON array:
[
  {
    "rank": 1,
    "restaurant_index": 0,
    "scoring": {
      "budget_match": 8,
      "scene_match": 9,
      "review_quality": 7,
      "location_convenience": 6,
      "preference_match": 5,
      "red_flag_penalty": 0
    },
    "why_recommended": "Perfect for a first date — intimate booths, candlelit, conversation-friendly noise level",
    "best_for": "Romantic dates, special occasions",
    "watch_out": "Book at least 3 days ahead, parking is tough",
    "not_great_if": "You're on a tight budget or want a lively atmosphere",
    "estimated_total": "$80-100 for two with drinks",
    "suggested_refinements": ["更安静一点", "再便宜一点", "离地铁近一点"]
  }
]

Return ONLY the JSON array, no other text.`,
    },
  ];

  const text = await minimaxChat({
    system: systemPrompt,
    messages,
    max_tokens: 4096,
  });

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return { cards: [], suggested_refinements: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(jsonMatch[0]);
  } catch {
    return { cards: [], suggested_refinements: [] };
  }
  const parsed = RankedItemArraySchema.safeParse(raw);
  if (!parsed.success) return { cards: [], suggested_refinements: [] };

  // Extract suggested_refinements from first item (they should all be the same)
  const suggested_refinements: string[] = parsed.data[0]?.suggested_refinements ?? [];

  // Merge custom weights with defaults
  const effectiveWeights = customWeights
    ? { ...DEFAULT_WEIGHTS, ...customWeights }
    : DEFAULT_WEIGHTS;

  // Phase 3.2: compute weighted_total and re-sort by it
  type MappedItem = {
    rank: number;
    restaurant_index: number;
    score: number;
    scoring?: ScoringDimensions;
    why_recommended: string;
    best_for: string;
    watch_out: string;
    not_great_if: string;
    estimated_total: string;
    restaurant: Restaurant;
  };
  const cards: MappedItem[] = parsed.data
    .filter((item) => item.restaurant_index < restaurants.length)
    .map((item): MappedItem => {
      if (item.scoring) {
        const weighted_total = computeWeightedScore(item.scoring, effectiveWeights);
        return {
          ...item,
          score: weighted_total,
          scoring: { ...item.scoring, weighted_total },
          restaurant: restaurants[item.restaurant_index],
        };
      }
      return {
        ...item,
        scoring: undefined,
        restaurant: restaurants[item.restaurant_index],
      };
    })
    .sort((a, b) => {
      const aScore = (a.scoring as ScoringDimensions | undefined)?.weighted_total ?? a.score ?? 0;
      const bScore = (b.scoring as ScoringDimensions | undefined)?.weighted_total ?? b.score ?? 0;
      return bScore - aScore;
    })
    .map((item, i) => ({ ...item, rank: i + 1 }));

  return { cards, suggested_refinements };
}

// ─── Phase 7.2: Hotel Pipeline ───────────────────────────────────────────────

async function runHotelPipeline(
  intent: HotelIntent,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  cityFullName: string,
): Promise<{ hotelRecommendations: HotelRecommendationCard[]; suggested_refinements: string[] }> {
  const hotels = await searchHotels({
    location: intent.location ?? cityFullName,
    check_in: intent.check_in,
    check_out: intent.check_out,
    guests: intent.guests,
    hotel_class: intent.star_rating,
    maxResults: 20,
  });

  if (hotels.length === 0) {
    return { hotelRecommendations: [], suggested_refinements: [] };
  }

  // Pre-filter: rating >= 3.5 and some reviews
  const filtered = hotels
    .filter((h) => h.rating >= 3.5 || h.review_count === 0)
    .slice(0, 15);

  const hotelList = filtered
    .map(
      (h, i) =>
        `${i + 1}. ${h.name} | ${h.star_rating}★ | ⭐${h.rating} (${h.review_count} reviews) | $${h.price_per_night}/night | ${h.address} | Amenities: ${h.amenities.slice(0, 5).join(", ")}`
    )
    .join("\n");

  const nights = intent.nights ?? 1;
  const systemPrompt = `You are an expert hotel advisor. Pick the best hotels for the user's specific needs and explain exactly why each one fits.`;

  const text = await minimaxChat({
    system: systemPrompt,
    messages: [
      ...conversationHistory,
      {
        role: "user" as const,
        content: `User hotel requirements: ${JSON.stringify(intent, null, 2)}

Candidate hotels:
${hotelList}

Pick the TOP 10 hotels that best match. For each, score honestly across dimensions, then explain.

Also suggest 3-4 refinement queries (in Chinese) like "更便宜一点", "离市中心近一点", "带早餐的".

Return a JSON array:
[
  {
    "rank": 1,
    "hotel_index": 0,
    "scoring": {
      "budget_match": 8,
      "scene_match": 9,
      "review_quality": 7,
      "location_convenience": 8,
      "preference_match": 7,
      "red_flag_penalty": 0
    },
    "why_recommended": "Perfect for business travel with strong WiFi and close to the convention center",
    "best_for": "Business travelers, solo professionals",
    "watch_out": "Street noise at night, parking is extra",
    "not_great_if": "You want a quiet retreat or romantic getaway",
    "price_summary": "$${Math.round((filtered[0]?.price_per_night ?? 150))} /night · ${nights} nights $${Math.round((filtered[0]?.price_per_night ?? 150) * nights)} total",
    "location_summary": "Downtown, 5 min walk to convention center",
    "suggested_refinements": ["更便宜一点", "离市中心近一点", "带早餐的"]
  }
]

Return ONLY the JSON array.`,
      },
    ],
    max_tokens: 4096,
  });

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return { hotelRecommendations: [], suggested_refinements: [] };

  let raw: unknown;
  try {
    raw = JSON.parse(jsonMatch[0]);
  } catch {
    return { hotelRecommendations: [], suggested_refinements: [] };
  }

  if (!Array.isArray(raw)) return { hotelRecommendations: [], suggested_refinements: [] };

  const suggested_refinements: string[] = (raw[0] as Record<string, unknown>)?.suggested_refinements as string[] ?? [];

  const cards: HotelRecommendationCard[] = (raw as Array<Record<string, unknown>>)
    .filter((item) => typeof item.hotel_index === "number" && (item.hotel_index as number) < filtered.length)
    .map((item, i): HotelRecommendationCard => {
      const hotel = filtered[item.hotel_index as number];
      const scoring = item.scoring as Omit<ScoringDimensions, "weighted_total"> | undefined;
      const weighted_total = scoring ? computeWeightedScore(scoring, HOTEL_DEFAULT_WEIGHTS) : 0;
      return {
        hotel,
        rank: i + 1,
        score: weighted_total,
        why_recommended: String(item.why_recommended ?? ""),
        best_for: String(item.best_for ?? ""),
        watch_out: String(item.watch_out ?? ""),
        not_great_if: String(item.not_great_if ?? ""),
        price_summary: String(item.price_summary ?? `$${hotel.price_per_night}/night`),
        location_summary: String(item.location_summary ?? hotel.address),
        scoring: scoring ? { ...scoring, weighted_total } : undefined,
        suggested_refinements: [],
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((card, i) => ({ ...card, rank: i + 1 }));

  return { hotelRecommendations: cards, suggested_refinements };
}

// ─── Phase 8: Flight Pipeline ─────────────────────────────────────────────────

async function runFlightPipeline(
  intent: FlightIntent,
): Promise<{ flightRecommendations: FlightRecommendationCard[]; missing_fields: string[]; no_direct_available: boolean }> {
  // Check required fields
  const missing: string[] = [];
  if (!intent.departure_city) missing.push("departure city");
  if (!intent.arrival_city) missing.push("destination city");
  if (!intent.date) missing.push("travel date");

  console.log("[flight-pipeline] intent:", JSON.stringify({ dep: intent.departure_city, arr: intent.arrival_city, date: intent.date, prefer_direct: intent.prefer_direct }));

  if (missing.length > 0) {
    console.log("[flight-pipeline] missing fields:", missing);
    return { flightRecommendations: [], missing_fields: missing, no_direct_available: false };
  }

  const searchParams = {
    arrival_city: intent.arrival_city!,
    date: intent.date!,
    return_date: intent.return_date,
    is_round_trip: intent.is_round_trip,
    passengers: intent.passengers,
    cabin_class: intent.cabin_class,
    prefer_direct: intent.prefer_direct,
    max_stops: intent.max_stops,
  };

  // Multi-airport city handling: search primary airport + cheapest from alternates
  const depMulti = resolveMultiAirport(intent.departure_city!);
  const arrMulti = resolveMultiAirport(intent.arrival_city!);

  let flights: Flight[];

  if (depMulti && depMulti.all.length > 1) {
    // Parallel search: primary airport + each alternate airport
    const alternates = depMulti.all.filter((code) => code !== depMulti.primary);
    const [primaryFlights, ...altFlightGroups] = await Promise.all([
      searchFlights({ ...searchParams, departure_city: depMulti.primary, maxResults: 8 }),
      ...alternates.map((alt) =>
        searchFlights({ ...searchParams, departure_city: alt, maxResults: 4 })
      ),
    ]);

    // Take best 3 from primary airport
    const primaryBest = primaryFlights.slice(0, 3);

    // Find cheapest flight from any alternate airport (only if cheaper than primary cheapest)
    const primaryCheapest = primaryFlights.reduce((min, f) => (f.price > 0 && f.price < min ? f.price : min), Infinity);
    const allAltFlights = altFlightGroups.flat().filter((f) => f.price > 0);
    const cheapestAlt = allAltFlights.sort((a, b) => a.price - b.price)[0];

    if (cheapestAlt && cheapestAlt.price < primaryCheapest) {
      flights = [...primaryBest, cheapestAlt];
    } else {
      // Also add a 1-stop / 2-stop from alternates if available
      const altOneStop = allAltFlights.find((f) => f.stops === 1);
      flights = altOneStop ? [...primaryBest, altOneStop] : primaryBest;
    }
  } else if (arrMulti && arrMulti.all.length > 1) {
    // Multi-airport arrival (less common but handled symmetrically)
    const [primaryFlights, ...altFlightGroups] = await Promise.all([
      searchFlights({ ...searchParams, departure_city: intent.departure_city!, arrival_city: arrMulti.primary, maxResults: 8 }),
      ...arrMulti.all
        .filter((c) => c !== arrMulti.primary)
        .map((alt) =>
          searchFlights({ ...searchParams, departure_city: intent.departure_city!, arrival_city: alt, maxResults: 4 })
        ),
    ]);
    const primaryBest = primaryFlights.slice(0, 3);
    const allAltFlights = altFlightGroups.flat().filter((f) => f.price > 0);
    const cheapestAlt = allAltFlights.sort((a, b) => a.price - b.price)[0];
    const primaryCheapest = primaryFlights.reduce((min, f) => (f.price > 0 && f.price < min ? f.price : min), Infinity);
    flights = cheapestAlt && cheapestAlt.price < primaryCheapest
      ? [...primaryBest, cheapestAlt]
      : primaryBest;
  } else {
    flights = await searchFlights({
      ...searchParams,
      departure_city: intent.departure_city!,
      maxResults: 8,
    });
  }

  if (flights.length === 0) {
    return { flightRecommendations: [], missing_fields: [], no_direct_available: false };
  }

  const wantedNonstop = intent.prefer_direct === true || intent.max_stops === 0;
  const no_direct_available = wantedNonstop && flights.every((f) => f.stops > 0);

  // Identify cheapest flight (only when not filtering by stop preference)
  const isFiltered = wantedNonstop || intent.max_stops === 1;
  const cheapestId = !isFiltered && flights.length > 0
    ? flights.filter(f => f.price > 0).sort((a, b) => a.price - b.price)[0]?.id
    : null;

  const cards: FlightRecommendationCard[] = flights.map((flight, i) => {
    const isCheapest = !isFiltered && flight.id === cheapestId;
    const group: FlightRecommendationCard["group"] = isCheapest
      ? "cheapest"
      : flight.stops === 0 ? "direct" : flight.stops === 1 ? "one_stop" : "two_stop";

    const why = isCheapest
      ? `Lowest price found — $${flight.price}${flight.stops > 0 ? ` with ${flight.stops} stop${flight.stops > 1 ? "s" : ""}` : ", nonstop"}`
      : flight.stops === 0
      ? `Nonstop flight — fastest option at ${flight.duration}`
      : flight.stops === 1
      ? `1 stop via ${flight.layover_city ?? "connecting city"} (${flight.layover_duration ?? ""} layover)`
      : `${flight.stops} stops — most affordable option`;

    return {
      flight,
      rank: i + 1,
      group,
      why_recommended: why,
    };
  });

  return { flightRecommendations: cards, missing_fields: [], no_direct_available };
}

// ─── Main Agent Function ──────────────────────────────────────────────────────

export async function runAgent(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [],
  cityId: string = DEFAULT_CITY,
  gpsCoords: { lat: number; lng: number } | null = null,
  nearLocation?: string,
  sessionPreferences?: SessionPreferences,
  profileContext?: string,
  streamCallbacks?: StreamCallbacks,
  customWeights?: Partial<typeof DEFAULT_WEIGHTS>
): Promise<{
  requirements: UserRequirements | HotelIntent | FlightIntent | CreditCardIntent | LaptopIntent | SmartphoneIntent | HeadphoneIntent | SubscriptionIntent;
  recommendations: RecommendationCard[];
  hotelRecommendations: HotelRecommendationCard[];
  flightRecommendations: FlightRecommendationCard[];
  creditCardRecommendations: CreditCardRecommendationCard[];
  laptopRecommendations: LaptopRecommendationCard[];
  laptop_db_gap_warning: string | null;
  smartphoneRecommendations: SmartphoneRecommendationCard[];
  headphoneRecommendations: HeadphoneRecommendationCard[];
  device_db_gap_warning: string | null;
  subscriptionIntent: SubscriptionIntent | null;
  missing_credit_card_fields: string[];
  missing_flight_fields: string[];
  no_direct_available: boolean;
  suggested_refinements: string[];
  category: CategoryType;
}> {
  const city = CITIES[cityId] ?? CITIES[DEFAULT_CITY];
  const cityFullName = gpsCoords ? "your current location" : city.fullName;

  // Layer 1: Parse intent (with session preferences + profile context)
  const intent = await parseIntent(
    userMessage,
    cityFullName,
    sessionPreferences,
    profileContext,
    conversationHistory
  );

  // Route to subscription intent — no server-side pipeline, client handles storage
  if (intent.category === "subscription") {
    return {
      requirements: intent,
      recommendations: [],
      hotelRecommendations: [],
      flightRecommendations: [],
      creditCardRecommendations: [],
      laptopRecommendations: [],
      laptop_db_gap_warning: null,
      smartphoneRecommendations: [],
      headphoneRecommendations: [],
      device_db_gap_warning: null,
      subscriptionIntent: intent,
      missing_credit_card_fields: [],
      missing_flight_fields: [],
      no_direct_available: false,
      suggested_refinements: [],
      category: "subscription",
    };
  }

  // Route to credit card pipeline if needed
  if (intent.category === "credit_card") {
    if (intent.needs_spending_info) {
      return {
        requirements: intent,
        recommendations: [],
        hotelRecommendations: [],
        flightRecommendations: [],
        creditCardRecommendations: [],
        laptopRecommendations: [],
        laptop_db_gap_warning: null,
        smartphoneRecommendations: [],
        headphoneRecommendations: [],
        device_db_gap_warning: null,
        subscriptionIntent: null,
        missing_credit_card_fields: ["monthly spending by category", "cash back or travel rewards preference", "any cards you already hold"],
        missing_flight_fields: [],
        no_direct_available: false,
        suggested_refinements: [],
        category: "credit_card",
      };
    }
    const { creditCardRecommendations } = await runCreditCardPipeline(intent);
    return {
      requirements: intent,
      recommendations: [],
      hotelRecommendations: [],
      flightRecommendations: [],
      creditCardRecommendations,
      laptopRecommendations: [],
      laptop_db_gap_warning: null,
      smartphoneRecommendations: [],
      headphoneRecommendations: [],
      device_db_gap_warning: null,
      subscriptionIntent: null,
      missing_credit_card_fields: [],
      missing_flight_fields: [],
      no_direct_available: false,
      suggested_refinements: [],
      category: "credit_card",
    };
  }

  // Route to laptop pipeline if needed
  if (intent.category === "laptop") {
    if (intent.needs_use_case_info) {
      return {
        requirements: intent,
        recommendations: [],
        hotelRecommendations: [],
        flightRecommendations: [],
        creditCardRecommendations: [],
        laptopRecommendations: [],
        laptop_db_gap_warning: null,
        smartphoneRecommendations: [],
        headphoneRecommendations: [],
        device_db_gap_warning: null,
        subscriptionIntent: null,
        missing_credit_card_fields: [],
        missing_flight_fields: ["use_case"],
        no_direct_available: false,
        suggested_refinements: [],
        category: "laptop",
      };
    }
    const { laptopRecommendations, laptop_db_gap_warning } = await runLaptopPipeline(intent);
    return {
      requirements: intent,
      recommendations: [],
      hotelRecommendations: [],
      flightRecommendations: [],
      creditCardRecommendations: [],
      laptopRecommendations,
      laptop_db_gap_warning,
      smartphoneRecommendations: [],
      headphoneRecommendations: [],
      device_db_gap_warning: null,
      subscriptionIntent: null,
      missing_credit_card_fields: [],
      missing_flight_fields: [],
      no_direct_available: false,
      suggested_refinements: [],
      category: "laptop",
    };
  }

  // Route to smartphone pipeline if needed
  if (intent.category === "smartphone") {
    if ((intent as SmartphoneIntent).needs_use_case_info) {
      return {
        requirements: intent,
        recommendations: [],
        hotelRecommendations: [],
        flightRecommendations: [],
        creditCardRecommendations: [],
        laptopRecommendations: [],
        laptop_db_gap_warning: null,
        smartphoneRecommendations: [],
        headphoneRecommendations: [],
        device_db_gap_warning: null,
        subscriptionIntent: null,
        missing_credit_card_fields: [],
        missing_flight_fields: ["use_case"],
        no_direct_available: false,
        suggested_refinements: [],
        category: "smartphone",
      };
    }
    const { smartphoneRecommendations, db_gap_warning } = await runSmartphonePipeline(intent as SmartphoneIntent);
    return {
      requirements: intent,
      recommendations: [],
      hotelRecommendations: [],
      flightRecommendations: [],
      creditCardRecommendations: [],
      laptopRecommendations: [],
      laptop_db_gap_warning: null,
      smartphoneRecommendations,
      headphoneRecommendations: [],
      device_db_gap_warning: db_gap_warning,
      subscriptionIntent: null,
      missing_credit_card_fields: [],
      missing_flight_fields: [],
      no_direct_available: false,
      suggested_refinements: [],
      category: "smartphone",
    };
  }

  // Route to headphone pipeline if needed
  if (intent.category === "headphone") {
    if ((intent as HeadphoneIntent).needs_use_case_info) {
      return {
        requirements: intent,
        recommendations: [],
        hotelRecommendations: [],
        flightRecommendations: [],
        creditCardRecommendations: [],
        laptopRecommendations: [],
        laptop_db_gap_warning: null,
        smartphoneRecommendations: [],
        headphoneRecommendations: [],
        device_db_gap_warning: null,
        subscriptionIntent: null,
        missing_credit_card_fields: [],
        missing_flight_fields: ["use_case"],
        no_direct_available: false,
        suggested_refinements: [],
        category: "headphone",
      };
    }
    const { headphoneRecommendations, db_gap_warning } = await runHeadphonePipeline(intent as HeadphoneIntent);
    return {
      requirements: intent,
      recommendations: [],
      hotelRecommendations: [],
      flightRecommendations: [],
      creditCardRecommendations: [],
      laptopRecommendations: [],
      laptop_db_gap_warning: null,
      smartphoneRecommendations: [],
      headphoneRecommendations,
      device_db_gap_warning: db_gap_warning,
      subscriptionIntent: null,
      missing_credit_card_fields: [],
      missing_flight_fields: [],
      no_direct_available: false,
      suggested_refinements: [],
      category: "headphone",
    };
  }

  // Route to flight pipeline if needed
  if (intent.category === "flight") {
    const { flightRecommendations, missing_fields, no_direct_available } = await runFlightPipeline(intent);
    return {
      requirements: intent,
      recommendations: [],
      hotelRecommendations: [],
      flightRecommendations,
      creditCardRecommendations: [],
      laptopRecommendations: [],
      laptop_db_gap_warning: null,
      smartphoneRecommendations: [],
      headphoneRecommendations: [],
      device_db_gap_warning: null,
      subscriptionIntent: null,
      missing_credit_card_fields: [],
      missing_flight_fields: missing_fields,
      no_direct_available,
      suggested_refinements: [],
      category: "flight",
    };
  }

  // Route to hotel pipeline if needed
  if (intent.category === "hotel") {
    const { hotelRecommendations, suggested_refinements } = await runHotelPipeline(
      intent,
      conversationHistory,
      cityFullName,
    );
    return {
      requirements: intent,
      recommendations: [],
      hotelRecommendations,
      flightRecommendations: [],
      creditCardRecommendations: [],
      laptopRecommendations: [],
      laptop_db_gap_warning: null,
      smartphoneRecommendations: [],
      headphoneRecommendations: [],
      device_db_gap_warning: null,
      subscriptionIntent: null,
      missing_credit_card_fields: [],
      missing_flight_fields: [],
      no_direct_available: false,
      suggested_refinements,
      category: "hotel",
    };
  }

  // Otherwise continue with restaurant pipeline
  const requirements: UserRequirements = intent;

  // Layer 2+3: Gather candidates (parallel search)
  const { restaurants, semanticSignals, tavilyQuery } = await gatherCandidates(
    requirements,
    cityId,
    gpsCoords,
    nearLocation
  );

  // Phase 4.1: Send partial results after candidate gathering
  if (streamCallbacks?.onPartial) {
    // Quick top 3 sorted by rating * log(review_count + 1)
    const quickTop3: RecommendationCard[] = restaurants
      .slice()
      .sort((a, b) => b.rating * Math.log(b.review_count + 1) - a.rating * Math.log(a.review_count + 1))
      .slice(0, 3)
      .map((r, i) => ({
        restaurant: r,
        rank: i + 1,
        score: r.rating,
        why_recommended: `${r.name} — ⭐${r.rating} (${r.review_count} reviews)`,
        best_for: r.cuisine,
        watch_out: "",
        not_great_if: "",
        estimated_total: r.price,
      }));
    streamCallbacks.onPartial(quickTop3, requirements);
  }

  // Phase 3.1: Extract review signals for top candidates (non-blocking)
  const reviewSignalsMap = await fetchReviewSignals(
    restaurants.slice(0, 12),
    tavilyQuery,
    cityFullName
  ).catch(() => new Map());

  // Inject review signals into restaurant objects
  const candidatesWithSignals = restaurants.map((r) => ({
    ...r,
    review_signals: reviewSignalsMap.get(r.name),
  }));

  // Layer 4+5+6: Rank and explain (with scoring + preferences)
  const { cards, suggested_refinements } = await rankAndExplain(
    requirements,
    candidatesWithSignals,
    semanticSignals,
    conversationHistory,
    cityFullName,
    sessionPreferences,
    profileContext,
    customWeights
  );

  // Add OpenTable search URLs
  const withOpenTable = cards.map((card) => ({
    ...card,
    opentable_url: card.restaurant?.name
      ? `https://www.opentable.com/s?term=${encodeURIComponent(card.restaurant.name + " " + city.fullName)}&covers=${requirements.party_size ?? 2}`
      : undefined,
  }));

  return { requirements, recommendations: withOpenTable, hotelRecommendations: [], flightRecommendations: [], creditCardRecommendations: [], laptopRecommendations: [], laptop_db_gap_warning: null, smartphoneRecommendations: [], headphoneRecommendations: [], device_db_gap_warning: null, subscriptionIntent: null, missing_credit_card_fields: [], missing_flight_fields: [], no_direct_available: false, suggested_refinements, category: "restaurant" };
}
