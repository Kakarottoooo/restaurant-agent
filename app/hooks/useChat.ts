import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { RecommendationCard as CardType, Message, SessionPreferences, HotelRecommendationCard, FlightRecommendationCard, CreditCardRecommendationCard, LaptopRecommendationCard, CategoryType } from "@/lib/types";
import { LearnedWeights } from "@/lib/types";

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
}

export function useChat({
  cityId,
  gpsCoords,
  isNearMe,
  nearLocation,
  profileContext,
  learnedWeights,
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
  const [resultCategory, setResultCategory] = useState<CategoryType>("restaurant");

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
      setActivePrice(null);
      setActiveCuisine(null);
      setSessionPreferences(DEFAULT_SESSION_PREFS);
      setSuggestedRefinements([]);
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
      setResultCategory("restaurant");

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

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
                setResultCategory(category);
                const refinements: string[] = event.suggested_refinements ?? [];
                setSuggestedRefinements(refinements);

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
                        content: `To search for flights, I need a bit more info: **${missingFields.join(", ")}**. Could you provide those?`,
                        category: "flight" as const,
                      },
                    ]);
                  } else if (flightRecs.length === 0) {
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: "No flights found for that route. Try adjusting your dates or airports.",
                        category: "flight" as const,
                      },
                    ]);
                  } else {
                    const noDirectAvailable: boolean = event.no_direct_available ?? false;
                    const contentMsg = noDirectAvailable
                      ? `No nonstop flights found for that route. Here are the best connecting options:`
                      : `Found ${flightRecs.length} flight${flightRecs.length > 1 ? "s" : ""} for you.`;
                    const assistantMessage: Message = {
                      role: "assistant",
                      content: contentMsg,
                      flightCards: flightRecs,
                      category: "flight" as const,
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
                        content: "No hotels matched your search. Try adjusting your dates, budget, or location.",
                        category: "hotel" as const,
                      },
                    ]);
                  } else {
                    const assistantMessage: Message = {
                      role: "assistant",
                      content: `Found ${hotelRecs.length} hotels for you.`,
                      hotelCards: hotelRecs,
                      category: "hotel" as const,
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
                  }
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
        const message =
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: message },
        ]);
      } finally {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        setLoading(false);
        setIsStreaming(false);
        setLoadingStep(-1);
      }
    },
    [loading, isNearMe, cityId, gpsCoords, nearLocation, profileContext, sessionPreferences, learnedWeights]
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
    resultCategory,
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
  };
}
