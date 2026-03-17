"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import RecommendationCard from "@/components/RecommendationCard";
import { RecommendationCard as CardType } from "@/lib/types";

// Leaflet is not SSR-compatible
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const EXAMPLES = [
  "Romantic Thai restaurant for a first date, ~$60/person, quiet, not too trendy",
  "Best ramen in SF, under $20, doesn't matter if it's busy",
  "Business dinner spot, $100/person, impressive but not stuffy, good wine list",
];

interface Message {
  role: "user" | "assistant";
  content: string;
  cards?: CardType[];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [visibleCards, setVisibleCards] = useState<CardType[]>([]);
  const [allCards, setAllCards] = useState<CardType[]>([]);
  const [activePrice, setActivePrice] = useState<string | null>(null);
  const [activeCuisine, setActiveCuisine] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [shareToast, setShareToast] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("restaurant-favorites");
      if (saved) setFavorites(new Set(JSON.parse(saved)));
    } catch {}
  }, []);

  // Auto-search from shared URL param (run once on mount)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) sendMessage(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, visibleCards]);

  function toggleFavorite(restaurantId: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(restaurantId)) next.delete(restaurantId);
      else next.add(restaurantId);
      try {
        localStorage.setItem(
          "restaurant-favorites",
          JSON.stringify([...next])
        );
      } catch {}
      return next;
    });
  }

  function shareResults(query: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("q", query);
    navigator.clipboard.writeText(url.toString()).catch(() => {});
    window.history.replaceState({}, "", url.toString());
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  }

  // Filtered cards for list view
  const displayCards = visibleCards.filter((card) => {
    if (activePrice && card.restaurant.price !== activePrice) return false;
    if (activeCuisine && card.restaurant.cuisine !== activeCuisine)
      return false;
    return true;
  });

  // Derive filter options from all cards in last search
  const priceOptions = [...new Set(allCards.map((c) => c.restaurant.price))].sort();
  const cuisineOptions = [
    ...new Set(allCards.map((c) => c.restaurant.cuisine)),
  ].slice(0, 6);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    // Reset filters on new search
    setActivePrice(null);
    setActiveCuisine(null);
    setViewMode("list");

    // Update URL with query for sharing
    const url = new URL(window.location.href);
    url.searchParams.set("q", text);
    window.history.replaceState({}, "", url.toString());

    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setVisibleCards([]);
    setAllCards([]);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      const data = await res.json();

      if (data.error) throw new Error(data.error);

      const assistantMessage: Message = {
        role: "assistant",
        content: `Found ${data.recommendations.length} restaurants for you.`,
        cards: data.recommendations,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setAllCards(data.recommendations);

      // Reveal cards one by one for streaming effect
      const cards: CardType[] = data.recommendations;
      for (let i = 0; i < cards.length; i++) {
        await new Promise((r) => setTimeout(r, 150));
        setVisibleCards((prev) => [...prev, cards[i]]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const hasMessages = messages.length > 0;
  const lastUserQuery =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <span className="text-xl">🍽️</span>
          <h1 className="font-semibold text-gray-900">SF Restaurant Agent</h1>
          <span className="text-xs text-gray-400 ml-auto">Powered by Claude</span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="text-5xl mb-4">🍜</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Find your perfect SF restaurant
            </h2>
            <p className="text-gray-500 mb-8 max-w-sm">
              Tell me what you&apos;re looking for in plain English. I&apos;ll
              find the best options and explain exactly why each one fits.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => sendMessage(ex)}
                  className="text-left text-sm bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                >
                  &quot;{ex}&quot;
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="bg-gray-900 text-white rounded-2xl rounded-br-sm px-4 py-3 max-w-xs text-sm">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 py-1">{msg.content}</div>
                )}
              </div>
            ))}

            {/* Filter/view bar — shown once cards start loading */}
            {allCards.length > 0 && (
              <div className="flex flex-col gap-2">
                {/* View toggle + Share button */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        viewMode === "list"
                          ? "bg-white shadow-sm text-gray-900"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      List
                    </button>
                    <button
                      onClick={() => setViewMode("map")}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        viewMode === "map"
                          ? "bg-white shadow-sm text-gray-900"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Map
                    </button>
                  </div>

                  {/* Share button */}
                  <div className="relative">
                    <button
                      onClick={() => shareResults(lastUserQuery)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded-xl px-3 py-1.5 transition-colors hover:border-gray-400"
                    >
                      🔗 Share
                    </button>
                    {shareToast && (
                      <div className="absolute right-0 top-full mt-1 text-xs bg-gray-900 text-white px-2 py-1 rounded-lg whitespace-nowrap z-10">
                        Link copied!
                      </div>
                    )}
                  </div>
                </div>

                {/* Filter chips */}
                <div className="flex gap-2 flex-wrap">
                  {priceOptions.map((price) => (
                    <button
                      key={price}
                      onClick={() =>
                        setActivePrice(activePrice === price ? null : price)
                      }
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        activePrice === price
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {price}
                    </button>
                  ))}
                  {cuisineOptions.map((cuisine) => (
                    <button
                      key={cuisine}
                      onClick={() =>
                        setActiveCuisine(
                          activeCuisine === cuisine ? null : cuisine
                        )
                      }
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        activeCuisine === cuisine
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {cuisine}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Map view */}
            {viewMode === "map" && allCards.length > 0 && (
              <MapView cards={allCards} />
            )}

            {/* List view */}
            {viewMode === "list" && displayCards.length > 0 && (
              <div className="flex flex-col gap-3">
                {displayCards.map((card, i) => (
                  <RecommendationCard
                    key={card.restaurant?.id ?? i}
                    card={card}
                    index={i}
                    isFavorite={favorites.has(card.restaurant?.id ?? "")}
                    onToggleFavorite={() =>
                      toggleFavorite(card.restaurant?.id ?? "")
                    }
                  />
                ))}
              </div>
            )}

            {/* Empty filter result */}
            {viewMode === "list" &&
              visibleCards.length > 0 &&
              displayCards.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No results match current filters. Clear a filter to see more.
                </p>
              )}

            {loading && (
              <div className="flex items-center gap-3 text-sm text-gray-500 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
                Searching SF restaurants...
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder={
              hasMessages
                ? "Refine: 'more quiet', 'remove chains', 'cheaper options'..."
                : "Describe what you're looking for..."
            }
            className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-300 placeholder:text-gray-400"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="bg-gray-900 text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
