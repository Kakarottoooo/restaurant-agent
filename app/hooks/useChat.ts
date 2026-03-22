import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { RecommendationCard as CardType, Message, SessionPreferences, HotelRecommendationCard, FlightRecommendationCard, CreditCardRecommendationCard, LaptopRecommendationCard, SmartphoneRecommendationCard, HeadphoneRecommendationCard, CategoryType, SubscriptionIntent, DecisionPlan, ResultMode, ScenarioTelemetryEvent, ScenarioType, OutputLanguage } from "@/lib/types";
import { LearnedWeights } from "@/lib/types";
import { WATCH_CATEGORY_META } from "@/lib/watchTypes";
import {
  buildFlightFoundCopy,
  buildFlightNeedInfoCopy,
  buildGenericErrorCopy,
  buildHotelFoundCopy,
  buildNoFlightCopy,
  buildNoHotelCopy,
  buildCityTripFollowupCopy,
  buildFitnessNoResultsCopy,
  buildWeekendTripFollowupCopy,
  pickLanguageCopy,
} from "@/lib/outputCopy";

export const LOADING_STEPS = [
  "Parsing your request...",
  "Searching targets...",
  "Gathering real signals...",
  "AI scoring & ranking...",
];

const DEFAULT_SESSION_PREFS: SessionPreferences = {
  exclude_chains: false,
  excluded_cuisines: [],
  required_features: [],
  refined_from_query_count: 0,
};

interface UseChatParams {
  cityId: string;
  gpsCoords: { lat: number; lng: number } | null;
  isNearMe: boolean;
  nearLocation: string;
  profileContext?: string;
  learnedWeights?: LearnedWeights | null;
  onSubscriptionIntent?: (intent: SubscriptionIntent) => void;
  userId?: string | null;
}

export function useChat({
  cityId,
  gpsCoords,
  isNearMe,
  nearLocation,
  profileContext,
  learnedWeights,
  onSubscriptionIntent,
  userId,
}: UseChatParams) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(-1);
  const [visibleCards, setVisibleCards] = useState<CardType[]>([]);
  const [allCards, setAllCards] = useState<CardType[]>([]);
  const [activePrice, setActivePrice] = useState<string | null>(null);
  const [activeCuisine, setActiveCuisine] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [shareToast, setShareToast] = useState(false);
  const [sessionPreferences, setSessionPreferences] = useState<SessionPreferences>(
    DEFAULT_SESSION_PREFS
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestedRefinements, setSuggestedRefinements] = useState<string[]>([]);
  const [allHotelCards, setAllHotelCards] = useState<HotelRecommendationCard[]>([]);
  const [allFlightCards, setAllFlightCards] = useState<FlightRecommendationCard[]>([]);
  const [allCreditCardCards, setAllCreditCardCards] = useState<CreditCardRecommendationCard[]>([]);
  const [allLaptopCards, setAllLaptopCards] = useState<LaptopRecommendationCard[]>([]);
  const [laptopDbGapWarning, setLaptopDbGapWarning] = useState<string | null>(null);
  const [allSmartphoneCards, setAllSmartphoneCards] = useState<SmartphoneRecommendationCard[]>([]);
  const [allHeadphoneCards, setAllHeadphoneCards] = useState<HeadphoneRecommendationCard[]>([]);
  const [deviceDbGapWarning, setDeviceDbGapWarning] = useState<string | null>(null);
  const [resultCategory, setResultCategory] = useState<CategoryType>("restaurant");
  const [resultMode, setResultMode] = useState<ResultMode>("category_cards");
  const [decisionPlan, setDecisionPlan] = useState<DecisionPlan | null>(null);
  const latestRequestIdRef = useRef<string | null>(null);
  const viewedPlanIdsRef = useRef<Set<string>>(new Set());

  const getTelemetrySessionId = useCallback(() => {
    if (typeof window === "undefined") return "anonymous";
    const key = "folio_scenario_session_id";
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = window.crypto?.randomUUID?.() ?? `session-${Date.now()}`;
    window.localStorage.setItem(key, created);
    return created;
  }, []);

  const trackScenarioEvent = useCallback((
    event: Omit<ScenarioTelemetryEvent, "session_id" | "timestamp"> & {
      timestamp?: string;
    }
  ) => {
    const payload: ScenarioTelemetryEvent = {
      ...event,
      session_id: getTelemetrySessionId(),
      timestamp: event.timestamp ?? new Date().toISOString(),
    };

    fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, [getTelemetrySessionId]);

  // Stable ref to always-current messages (avoids stale closure in sendMessage)
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  });

  // Reset chat whenever location changes
  const prevCityIdRef = useRef(cityId);
  const prevIsNearMeRef = useRef(isNearMe);
  const prevNearLocationRef = useRef(nearLocation);
  useEffect(() => {
    if (
      prevCityIdRef.current !== cityId ||
      prevIsNearMeRef.current !== isNearMe ||
      prevNearLocationRef.current !== nearLocation
    ) {
      setMessages([]);
      setVisibleCards([]);
      setAllCards([]);
      setAllHotelCards([]);
      setAllFlightCards([]);
      setAllCreditCardCards([]);
      setAllLaptopCards([]);
      setAllSmartphoneCards([]);
      setAllHeadphoneCards([]);
      setLaptopDbGapWarning(null);
      setDeviceDbGapWarning(null);
      setResultCategory("restaurant");
      setActivePrice(null);
      setActiveCuisine(null);
      setSessionPreferences(DEFAULT_SESSION_PREFS);
      setSuggestedRefinements([]);
      setResultMode("category_cards");
      setDecisionPlan(null);
      latestRequestIdRef.current = null;
      viewedPlanIdsRef.current.clear();
    }
    prevCityIdRef.current = cityId;
    prevIsNearMeRef.current = isNearMe;
    prevNearLocationRef.current = nearLocation;
  }, [cityId, isNearMe, nearLocation]);

  const displayCards = useMemo(
    () =>
      visibleCards.filter((card) => {
        if (activePrice && card.restaurant.price !== activePrice) return false;
        if (activeCuisine && card.restaurant.cuisine !== activeCuisine)
          return false;
        return true;
      }),
    [visibleCards, activePrice, activeCuisine]
  );

  const priceOptions = useMemo(
    () => [...new Set(allCards.map((c) => c.restaurant.price))].sort(),
    [allCards]
  );

  const cuisineOptions = useMemo(
    () =>
      [...new Set(allCards.map((c) => c.restaurant.cuisine))].slice(0, 6),
    [allCards]
  );

  function shareResults(query: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("q", query);
    navigator.clipboard.writeText(url.toString()).catch(() => {});
    window.history.replaceState({}, "", url.toString());
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  }

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      setActivePrice(null);
      setActiveCuisine(null);
      setViewMode("list");
      setSuggestedRefinements([]);
      setAllHotelCards([]);
      setAllFlightCards([]);
      setAllCreditCardCards([]);
      setAllLaptopCards([]);
      setAllSmartphoneCards([]);
      setAllHeadphoneCards([]);
      setLaptopDbGapWarning(null);
      setDeviceDbGapWarning(null);
      setResultCategory("restaurant");
      setResultMode("category_cards");
      setDecisionPlan(null);
      latestRequestIdRef.current = null;

      const url = new URL(window.location.href);
      url.searchParams.set("q", text);
      window.history.replaceState({}, "", url.toString());

      const userMessage: Message = { role: "user", content: text };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setLoading(true);
      setLoadingStep(0);
      setVisibleCards([]);
      setAllCards([]);

      const t1 = setTimeout(() => setLoadingStep(1), 900);
      const t2 = setTimeout(() => setLoadingStep(2), 2200);
      const t3 = setTimeout(() => setLoadingStep(3), 3800);

      const history = messagesRef.current.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Capture current session preferences at call time
      const currentSessionPrefs = sessionPreferences;

      // Build customWeights from learnedWeights if available
      const customWeights = learnedWeights
        ? {
            budget_match: learnedWeights.budget_match,
            scene_match: learnedWeights.scene_match,
            review_quality: learnedWeights.review_quality,
            location_convenience: learnedWeights.location_convenience,
            preference_match: learnedWeights.preference_match,
          }
        : undefined;

      const abortController = new AbortController();
      const STREAM_STALL_MS = 50_000; // cancel if no data for 50s
      let stallTimer: ReturnType<typeof setTimeout> | null = null;

      const resetStallTimer = () => {
        if (stallTimer) clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
          abortController.abort();
        }, STREAM_STALL_MS);
      };

      try {
        resetStallTimer();
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortController.signal,
          body: JSON.stringify({
            message: text,
            history,
            city: isNearMe ? null : cityId,
            gpsCoords: isNearMe ? gpsCoords : null,
            nearLocation: nearLocation || undefined,
            sessionPreferences:
              currentSessionPrefs.refined_from_query_count > 0
                ? currentSessionPrefs
                : undefined,
            profileContext: profileContext || undefined,
            customWeights,
            session_id: getTelemetrySessionId(),
            user_id: userId ?? undefined,
          }),
        });

        // Check for non-200 before reading as stream
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Request failed");
        }

        // Read SSE stream
        setIsStreaming(true);
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let finalRecommendations: CardType[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (!done) resetStallTimer();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === "partial") {
                // Show partial cards immediately
                const partialCards: CardType[] = event.cards ?? [];
                setAllCards(partialCards);
                setVisibleCards(partialCards);
                setLoadingStep(2);
              } else if (event.type === "complete") {
                const category: CategoryType = event.category ?? "restaurant";
                const mode: ResultMode = event.result_mode ?? "category_cards";
                const outputLanguage: OutputLanguage = event.output_language ?? "en";
                if (event.request_id) {
                  latestRequestIdRef.current = String(event.request_id);
                }
                setResultCategory(category);
                setResultMode(mode);
                const refinements: string[] = event.suggested_refinements ?? [];
                setSuggestedRefinements(refinements);
                if (mode !== "scenario_plan") {
                  setDecisionPlan(null);
                }

                if (mode === "followup_refinement" && event.scenarioIntent?.scenario === "weekend_trip") {
                  const missingFields: string[] = event.scenarioIntent?.missing_fields ?? [];
                  const assumptions: string[] = event.scenarioIntent?.planning_assumptions ?? [];

                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      content: buildWeekendTripFollowupCopy(
                        outputLanguage,
                        missingFields,
                        assumptions[0]
                      ),
                      category: "trip" as const,
                      result_mode: "followup_refinement",
                      scenario: "weekend_trip",
                      output_language: outputLanguage,
                    },
                  ]);
                  continue;
                }

                if (mode === "followup_refinement" && event.scenarioIntent?.scenario === "fitness") {
                  const fitnessIntent = event.scenarioIntent as { activity_label?: string };
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      content: buildFitnessNoResultsCopy(outputLanguage, fitnessIntent?.activity_label),
                      category: "fitness" as const,
                      result_mode: "followup_refinement",
                      scenario: "fitness",
                      output_language: outputLanguage,
                    },
                  ]);
                  continue;
                }

                if (mode === "followup_refinement" && event.scenarioIntent?.scenario === "city_trip") {
                  const missingFields: string[] = event.scenarioIntent?.missing_fields ?? [];
                  const assumptions: string[] = event.scenarioIntent?.planning_assumptions ?? [];

                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      content: buildCityTripFollowupCopy(
                        outputLanguage,
                        missingFields,
                        assumptions[0]
                      ),
                      category: "trip" as const,
                      result_mode: "followup_refinement",
                      scenario: "city_trip",
                      output_language: outputLanguage,
                    },
                  ]);
                  continue;
                }

                if (mode === "scenario_plan" && event.decisionPlan) {
                  const plan: DecisionPlan = event.decisionPlan;
                  const scenarioCategory = (event.category ?? "trip") as CategoryType;
                  setDecisionPlan(plan);
                  setAllCards(event.recommendations ?? []);
                  setVisibleCards(event.recommendations ?? []);
                  setAllHotelCards(event.hotelRecommendations ?? []);
                  setAllFlightCards(event.flightRecommendations ?? []);
                  setAllCreditCardCards(event.creditCardRecommendations ?? []);

                  const assistantMessage: Message = {
                    role: "assistant",
                    content: plan.summary,
                    cards: event.recommendations ?? [],
                    hotelCards: event.hotelRecommendations ?? [],
                    flightCards: event.flightRecommendations ?? [],
                    creditCardCards: event.creditCardRecommendations ?? [],
                    decisionPlan: plan,
                    category: scenarioCategory,
                    result_mode: "scenario_plan",
                    scenario: plan.scenario,
                    output_language: outputLanguage,
                  };
                  setMessages((prev) => [...prev, assistantMessage]);

                  if (!viewedPlanIdsRef.current.has(plan.id)) {
                    viewedPlanIdsRef.current.add(plan.id);
                    trackScenarioEvent({
                      type: "plan_viewed",
                      scenario: plan.scenario,
                      plan_id: plan.id,
                      option_id: plan.primary_plan.id,
                      request_id: latestRequestIdRef.current ?? undefined,
                      query: text,
                      metadata: {
                        backup_count: plan.backup_plans.length,
                        category: scenarioCategory,
                      },
                    });
                  }
                  continue;
                }

                if (category === "credit_card") {
                  const ccRecs: CreditCardRecommendationCard[] = event.creditCardRecommendations ?? [];
                  const missingCCFields: string[] = event.missing_credit_card_fields ?? [];

                  if (missingCCFields.length > 0) {
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: `To find the best card for you, I need a few details:\n\n1. **Monthly spending** — roughly how much do you spend on dining, groceries, travel, gas, and other categories each month?\n2. **Reward preference** — do you prefer cash back or travel points/miles?\n3. **Existing cards** — any cards you already hold? (I'll calculate the marginal value of adding a new one.)\n\nEven rough estimates work great!`,
                        category: "credit_card" as const,
                      },
                    ]);
                  } else if (ccRecs.length === 0) {
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: "I couldn't generate card recommendations. Please tell me your monthly spending and whether you prefer cash back or travel rewards.",
                        category: "credit_card" as const,
                      },
                    ]);
                  } else {
                    const topMarginal = ccRecs[0]?.marginal_value ?? 0;
                    const portfolioOptimized = topMarginal <= 0;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const ccIntent = event.requirements as any;
                    const creditScore: number | null = ccIntent?.credit_score ?? null;
                    const noHistory = creditScore === 0;
                    const lowCredit = creditScore !== null && creditScore > 0 && creditScore < 650;
                    // Unnamed existing cards: user mentioned having cards but didn't name them
                    const hasUnnamedCards =
                      ccIntent?.has_existing_cards === true &&
                      (ccIntent?.existing_cards ?? []).length === 0;
                    let content: string;
                    if (noHistory) {
                      content = `⚠ Since you have no credit history, most standard cards may be difficult to get approved for. Consider starting with a **secured card** or a **student card** (e.g. Discover it Student, Capital One Platinum Secured) to build your score first. That said, here are the best options from our database that have the lowest approval requirements:`;
                    } else if (lowCredit) {
                      content = `With a credit score of ${creditScore}, most standard rewards cards will be difficult to get approved for. Here are the cards most likely to approve you at your current score — all are designed for fair-credit applicants:`;
                    } else if (portfolioOptimized) {
                      content = `Your current card portfolio already covers your spending well — any new card would add little or no incremental value. Here are the closest options anyway, but adding them may not be worth the complexity.`;
                    } else {
                      content = `Here are the top ${ccRecs.length} credit cards ranked by annual net gain for your spending profile.`;
                    }
                    if (hasUnnamedCards) {
                      content += `\n\n*You mentioned having existing cards but didn't name them. Results use a 1× baseline — if your current cards already earn bonus rates, the actual incremental gain from adding a new card may be lower.*`;
                    }
                    const assistantMessage: Message = {
                      role: "assistant",
                      content,
                      creditCardCards: ccRecs,
                      category: "credit_card" as const,
                    };
                    setMessages((prev) => [...prev, assistantMessage]);
                    setAllCreditCardCards(ccRecs);
                  }
                } else if (category === "flight") {
                  const flightRecs: FlightRecommendationCard[] = event.flightRecommendations ?? [];
                  const missingFields: string[] = event.missing_flight_fields ?? [];

                  if (missingFields.length > 0) {
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: buildFlightNeedInfoCopy(outputLanguage, missingFields),
                        category: "flight" as const,
                        output_language: outputLanguage,
                      },
                    ]);
                  } else if (flightRecs.length === 0) {
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: buildNoFlightCopy(outputLanguage),
                        category: "flight" as const,
                        output_language: outputLanguage,
                      },
                    ]);
                  } else {
                    const assistantMessage: Message = {
                      role: "assistant",
                      content: buildFlightFoundCopy(
                        outputLanguage,
                        flightRecs.length,
                        event.no_direct_available ?? false
                      ),
                      flightCards: flightRecs,
                      category: "flight" as const,
                      output_language: outputLanguage,
                    };
                    setMessages((prev) => [...prev, assistantMessage]);
                    setAllFlightCards(flightRecs);
                  }
                } else if (category === "hotel") {
                  const hotelRecs: HotelRecommendationCard[] = event.hotelRecommendations ?? [];

                  if (hotelRecs.length === 0) {
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: buildNoHotelCopy(outputLanguage),
                        category: "hotel" as const,
                        output_language: outputLanguage,
                      },
                    ]);
                  } else {
                    const assistantMessage: Message = {
                      role: "assistant",
                      content: buildHotelFoundCopy(outputLanguage, hotelRecs.length),
                      hotelCards: hotelRecs,
                      category: "hotel" as const,
                      output_language: outputLanguage,
                    };
                    setMessages((prev) => [...prev, assistantMessage]);
                    setAllHotelCards(hotelRecs);
                  }
                } else if (category === "laptop") {
                  const laptopRecs: LaptopRecommendationCard[] = event.laptopRecommendations ?? [];
                  const missingUseCase: boolean = event.missing_laptop_use_case ?? false;

                  if (missingUseCase || laptopRecs.length === 0) {
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: `To find the best laptop for you, I need to know **how you'll use it**. Please tell me:\n\n1. **Primary use case** — e.g. coding, video editing, gaming, business travel, general productivity, data science\n2. **Budget** — rough price range in USD (optional)\n3. **OS preference** — Mac, Windows, Linux, or no preference\n4. **Portability** — how important is weight / battery life?`,
                        category: "laptop" as const,
                      },
                    ]);
                  } else {
                    const assistantMessage: Message = {
                      role: "assistant",
                      content: `Here are the top ${laptopRecs.length} laptop${laptopRecs.length > 1 ? "s" : ""} ranked for your use case.`,
                      laptopCards: laptopRecs,
                      category: "laptop" as const,
                    };
                    setMessages((prev) => [...prev, assistantMessage]);
                    setAllLaptopCards(laptopRecs);
                    setLaptopDbGapWarning(event.laptop_db_gap_warning ?? null);
                  }
                } else if (category === "smartphone") {
                  const smartphoneRecs: SmartphoneRecommendationCard[] = event.smartphoneRecommendations ?? [];
                  const missingUseCase: boolean = event.missing_smartphone_use_case ?? false;

                  if (missingUseCase || smartphoneRecs.length === 0) {
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: `To find the best smartphone for you, I need to know **how you'll use it**. Please tell me:\n\n1. **Primary use case** — e.g. photography, gaming, business, everyday, or best value\n2. **Budget** — rough price range in USD (optional)\n3. **OS preference** — iOS, Android, or no preference\n4. **Brands to avoid** (optional)`,
                        category: "smartphone" as const,
                      },
                    ]);
                  } else {
                    const assistantMessage: Message = {
                      role: "assistant",
                      content: `Here are the top ${smartphoneRecs.length} smartphone${smartphoneRecs.length > 1 ? "s" : ""} ranked for your use case.`,
                      smartphoneCards: smartphoneRecs,
                      category: "smartphone" as const,
                    };
                    setMessages((prev) => [...prev, assistantMessage]);
                    setAllSmartphoneCards(smartphoneRecs);
                    setDeviceDbGapWarning(event.device_db_gap_warning ?? null);
                  }
                } else if (category === "headphone") {
                  const headphoneRecs: HeadphoneRecommendationCard[] = event.headphoneRecommendations ?? [];
                  const missingUseCase: boolean = event.missing_headphone_use_case ?? false;

                  if (missingUseCase || headphoneRecs.length === 0) {
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: `To find the best headphones for you, I need to know **how you'll use them**. Please tell me:\n\n1. **Primary use case** — e.g. commuting, work from home, audiophile listening, sport/workout, or casual\n2. **Budget** — rough price range in USD (optional)\n3. **Form factor preference** — over-ear, in-ear, on-ear, or no preference\n4. **Wireless required?** (yes/no)`,
                        category: "headphone" as const,
                      },
                    ]);
                  } else {
                    const assistantMessage: Message = {
                      role: "assistant",
                      content: `Here are the top ${headphoneRecs.length} headphone${headphoneRecs.length > 1 ? "s" : ""} ranked for your use case.`,
                      headphoneCards: headphoneRecs,
                      category: "headphone" as const,
                    };
                    setMessages((prev) => [...prev, assistantMessage]);
                    setAllHeadphoneCards(headphoneRecs);
                    setDeviceDbGapWarning(event.device_db_gap_warning ?? null);
                  }
                } else if (category === "subscription") {
                  const intent = event.subscriptionIntent as SubscriptionIntent | null;
                  if (!intent) return;

                  // Delegate to parent — parent owns the subscription state
                  onSubscriptionIntent?.(intent);

                  // Build a confirmation message for the chat
                  let content = "";
                  if (intent.action === "list") {
                    content = "__LIST_SUBSCRIPTIONS__"; // sentinel; page.tsx renders the real list
                  } else if (intent.action === "unsubscribe") {
                    const meta = intent.watch_category ? WATCH_CATEGORY_META[intent.watch_category] : null;
                    content = intent.watch_category
                      ? `Got it — I'll stop watching ${intent.brands.length > 0 ? intent.brands.join(" & ") + " " : ""}${meta?.label ?? intent.watch_category} releases for you.`
                      : "Subscription removed.";
                  } else {
                    // subscribe
                    if (!intent.watch_category) {
                      content = "I couldn't figure out which product category to watch. Could you tell me more? e.g. \"tell me when Apple releases a new MacBook\" or \"notify me about new NVIDIA GPUs\".";
                    } else {
                      const meta = WATCH_CATEGORY_META[intent.watch_category];
                      const brandText = intent.brands.length > 0 ? ` from ${intent.brands.join(" & ")}` : "";
                      const keywordText = intent.keywords.length > 0 ? ` (${intent.keywords.join(", ")})` : "";
                      content = `${meta.emoji} Got it! I'll watch for new **${meta.label}** releases${brandText}${keywordText} and let you know when something is announced.`;
                    }
                  }
                  setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content, category: "subscription" as const },
                  ]);
                } else {
                  const recommendations: CardType[] = event.recommendations ?? [];
                  finalRecommendations = recommendations;

                  if (recommendations.length === 0) {
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content:
                          "No restaurants matched your search. Try broadening your criteria — different cuisine, price range, or neighborhood.",
                      },
                    ]);
                  } else {
                    const assistantMessage: Message = {
                      role: "assistant",
                      content: `Found ${recommendations.length} restaurants for you.`,
                      cards: recommendations,
                    };
                    setMessages((prev) => [...prev, assistantMessage]);
                    setAllCards(recommendations);

                    // Animate cards in
                    setVisibleCards([]);
                    for (let i = 0; i < recommendations.length; i++) {
                      await new Promise((r) => setTimeout(r, 150));
                      setVisibleCards((prev) => [...prev, recommendations[i]]);
                    }
                  }
                }
              } else if (event.type === "error") {
                throw new Error(event.error ?? "Stream error");
              }
            } catch (parseErr) {
              // Skip malformed events
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }

        // Phase 3.3a: update session preferences after each message
        if (messagesRef.current.length > 0 && finalRecommendations.length > 0) {
          // Client-side lightweight refinement detection
          const lowerText = text.toLowerCase();
          const updates: Partial<SessionPreferences> = {};
          if (lowerText.includes("quiet") || lowerText.includes("quieter")) {
            updates.noise_preference = "quiet";
          } else if (lowerText.includes("lively") || lowerText.includes("energetic")) {
            updates.noise_preference = "lively";
          }
          if (lowerText.includes("no chain") || lowerText.includes("not a chain")) {
            updates.exclude_chains = true;
          }
          if (lowerText.includes("cheaper") || lowerText.includes("more affordable")) {
            updates.budget_ceiling = currentSessionPrefs.budget_ceiling
              ? Math.round(currentSessionPrefs.budget_ceiling * 0.7)
              : undefined;
          }
          if (Object.keys(updates).length > 0) {
            const updated: SessionPreferences = {
              ...currentSessionPrefs,
              ...updates,
              refined_from_query_count:
                currentSessionPrefs.refined_from_query_count + 1,
            };
            setSessionPreferences(updated);
          }
        }
      } catch (err) {
        const isStall =
          err instanceof Error &&
          (err.name === "AbortError" || err.message.includes("abort"));
        const message = isStall
          ? "The search took too long and was cancelled. Please try again."
          : err instanceof Error
          ? err.message
          : buildGenericErrorCopy("en");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: message },
        ]);
      } finally {
        if (stallTimer) clearTimeout(stallTimer);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        setLoading(false);
        setIsStreaming(false);
        setLoadingStep(-1);
      }
    },
    [loading, isNearMe, cityId, gpsCoords, nearLocation, profileContext, sessionPreferences, learnedWeights, onSubscriptionIntent, trackScenarioEvent, userId, getTelemetrySessionId]
  );

  const autoSearchFired = useRef(false);
  const sendMessageRef = useRef(sendMessage);
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });
  useEffect(() => {
    if (autoSearchFired.current) return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      autoSearchFired.current = true;
      sendMessageRef.current(q);
    }
  }, []);

  function swapDecisionPlanOption(optionId: string) {
    setDecisionPlan((currentPlan) => {
      if (!currentPlan) return currentPlan;

      const backupIndex = currentPlan.backup_plans.findIndex(
        (plan) => plan.id === optionId
      );
      if (backupIndex < 0) return currentPlan;

      const nextPrimary = currentPlan.backup_plans[backupIndex];
      const language = currentPlan.output_language;
      const nextBackups = currentPlan.backup_plans.filter(
        (_, index) => index !== backupIndex
      );

      return {
        ...currentPlan,
        // Clear stale brief/risks/evidence — they were built from the original primary option
        // and would describe the old option after promotion. Reset to the promoted option's data.
        scenario_brief: [nextPrimary.summary],
        risks: [],
        evidence_items: [],
        primary_plan: {
          ...nextPrimary,
          label: pickLanguageCopy(language, "Main pick", "主方案"),
          fallback_reason: undefined,
        },
        backup_plans: [
          {
            ...currentPlan.primary_plan,
            label: pickLanguageCopy(language, "Backup 1", "备选 1"),
            fallback_reason:
              nextPrimary.fallback_reason ??
              pickLanguageCopy(
                language,
                "Use this if you want to revert to the original default.",
                "如果你想切回最初默认方案，就选这个。"
              ),
          },
          ...nextBackups.map((plan, index) => ({
            ...plan,
            label: pickLanguageCopy(
              language,
              `Backup ${index + 2}`,
              `备选 ${index + 2}`
            ),
          })),
        ],
      };
    });
  }

  function trackDecisionPlanEvent(params: {
    type: ScenarioTelemetryEvent["type"];
    option_id?: string;
    action_id?: string;
    metadata?: Record<string, unknown>;
    query?: string;
    scenario?: ScenarioType;
    plan_id?: string;
  }) {
    const activePlan = decisionPlan;
    if (!activePlan && !params.plan_id) return;

    trackScenarioEvent({
      type: params.type,
      scenario: params.scenario ?? activePlan?.scenario ?? "date_night",
      plan_id: params.plan_id ?? activePlan!.id,
      option_id: params.option_id,
      action_id: params.action_id,
      request_id: latestRequestIdRef.current ?? undefined,
      query: params.query,
      metadata: params.metadata,
    });
  }

  return {
    messages,
    input,
    setInput,
    loading,
    loadingStep,
    visibleCards,
    allCards,
    allHotelCards,
    allFlightCards,
    allCreditCardCards,
    allLaptopCards,
    laptopDbGapWarning,
    allSmartphoneCards,
    allHeadphoneCards,
    deviceDbGapWarning,
    resultCategory,
    resultMode,
    decisionPlan,
    activePrice,
    setActivePrice,
    activeCuisine,
    setActiveCuisine,
    viewMode,
    setViewMode,
    shareToast,
    displayCards,
    priceOptions,
    cuisineOptions,
    sendMessage,
    shareResults,
    sessionPreferences,
    isStreaming,
    suggestedRefinements,
    swapDecisionPlanOption,
    trackDecisionPlanEvent,
    getSessionId: getTelemetrySessionId,
    latestRequestId: latestRequestIdRef.current,
  };
}
