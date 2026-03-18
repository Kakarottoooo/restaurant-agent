import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { RecommendationCard as CardType, Message, SessionPreferences } from "@/lib/types";

export const LOADING_STEPS = [
  "Parsing your request...",
  "Searching nearby restaurants...",
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
}

export function useChat({
  cityId,
  gpsCoords,
  isNearMe,
  nearLocation,
  profileContext,
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
          }),
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Phase 3.3a: update session preferences after each message
        if (messages.length > 0) {
          // Only refine if this is a follow-up (not the first query)
          try {
            const refineRes = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: `__extract_refinements__${text}`,
                history: [],
                city: cityId,
                sessionPreferences: currentSessionPrefs,
              }),
            });
            // We don't actually use this endpoint for refinement extraction
            // The refinement happens server-side via the sessionPreferences flow
            void refineRes;
          } catch {}

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

        if (data.recommendations.length === 0) {
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
            content: `Found ${data.recommendations.length} restaurants for you.`,
            cards: data.recommendations,
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setAllCards(data.recommendations);

          const cards: CardType[] = data.recommendations;
          for (let i = 0; i < cards.length; i++) {
            await new Promise((r) => setTimeout(r, 150));
            setVisibleCards((prev) => [...prev, cards[i]]);
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
        setLoadingStep(-1);
      }
    },
    [loading, isNearMe, cityId, gpsCoords, nearLocation, profileContext, sessionPreferences, messages.length]
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
  };
}
