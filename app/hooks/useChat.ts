import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { RecommendationCard as CardType, Message, SessionPreferences, HotelRecommendationCard, FlightRecommendationCard, CategoryType } from "@/lib/types";
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

                if (category === "flight") {
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
