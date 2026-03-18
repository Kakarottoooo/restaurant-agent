"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import RecommendationCard from "@/components/RecommendationCard";
import { RecommendationCard as CardType } from "@/lib/types";
import { CITIES, CITIES_SORTED, DEFAULT_CITY } from "@/lib/cities";

// Leaflet is not SSR-compatible
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const LOADING_STEPS = [
  "Parsing your request...",
  "Searching nearby restaurants...",
  "Gathering real signals...",
  "AI scoring & ranking...",
];

const DEFAULT_EXAMPLES = [
  "Romantic dinner for a first date, ~$60/person, quiet atmosphere",
  "Best local spot under $20, casual, not a chain",
  "Business dinner, $100/person, impressive but not stuffy",
];

interface Message {
  role: "user" | "assistant";
  content: string;
  cards?: CardType[];
}

export default function Home() {
  const [cityId, setCityId] = useState(DEFAULT_CITY);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isNearMe, setIsNearMe] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(-1);
  const [visibleCards, setVisibleCards] = useState<CardType[]>([]);
  const [allCards, setAllCards] = useState<CardType[]>([]);
  const [activePrice, setActivePrice] = useState<string | null>(null);
  const [activeCuisine, setActiveCuisine] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [shareToast, setShareToast] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [supportsGps, setSupportsGps] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const city = CITIES[cityId];

  // Register service worker + check GPS support
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    setSupportsGps("geolocation" in navigator);
  }, []);

  // Load favorites
  useEffect(() => {
    try {
      const saved = localStorage.getItem("restaurant-favorites");
      if (saved) setFavorites(new Set(JSON.parse(saved)));
    } catch {}
  }, []);

  // Auto-search from shared URL param
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) sendMessage(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, visibleCards]);

  function handleCityChange(value: string) {
    if (value === "USE_MY_LOCATION") {
      requestGps();
      return;
    }
    setCityId(value);
    setGpsCoords(null);
    setIsNearMe(false);
    setMessages([]);
    setVisibleCards([]);
    setAllCards([]);
  }

  function requestGps() {
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsNearMe(true);
        setMessages([]);
        setVisibleCards([]);
        setAllCards([]);
      },
      () => {
        setGpsError("Unable to get your location. Please select a city manually.");
        setTimeout(() => setGpsError(null), 4000);
      },
      { timeout: 5000 }
    );
  }

  function toggleFavorite(restaurantId: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(restaurantId)) next.delete(restaurantId);
      else next.add(restaurantId);
      try {
        localStorage.setItem("restaurant-favorites", JSON.stringify([...next]));
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

  const displayCards = visibleCards.filter((card) => {
    if (activePrice && card.restaurant.price !== activePrice) return false;
    if (activeCuisine && card.restaurant.cuisine !== activeCuisine) return false;
    return true;
  });

  const priceOptions = [...new Set(allCards.map((c) => c.restaurant.price))].sort();
  const cuisineOptions = [...new Set(allCards.map((c) => c.restaurant.cuisine))].slice(0, 6);

  async function sendMessage(text: string) {
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

    // Advance loading steps with timers
    const t1 = setTimeout(() => setLoadingStep(1), 900);
    const t2 = setTimeout(() => setLoadingStep(2), 2200);
    const t3 = setTimeout(() => setLoadingStep(3), 3800);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          city: isNearMe ? null : cityId,
          gpsCoords: isNearMe ? gpsCoords : null,
        }),
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
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setLoading(false);
      setLoadingStep(-1);
    }
  }

  const hasMessages = messages.length > 0;
  const lastUserQuery = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const cityLabel = isNearMe ? "Nearby" : city?.label ?? "";
  const mapCenter = isNearMe && gpsCoords ? gpsCoords : city?.center;

  const isMapMode = viewMode === "map" && allCards.length > 0;

  // Shared filter/view bar rendered in both list and map contexts
  const filterViewBar = allCards.length > 0 && (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        {/* View toggle */}
        <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
          {(["list", "map"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-all capitalize"
              style={{
                backgroundColor: viewMode === mode ? "var(--gold)" : "transparent",
                color: viewMode === mode ? "#fff" : "var(--text-secondary)",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Share button */}
        <button
          onClick={() => shareResults(lastUserQuery)}
          className="flex items-center gap-1.5 text-xs rounded-xl px-3 py-1.5 transition-colors"
          style={{
            color: "var(--text-secondary)",
            border: "0.5px solid var(--border)",
            fontFamily: "var(--font-dm-sans)",
            backgroundColor: "var(--card)",
          }}
        >
          ↗ Share
        </button>
      </div>

      {/* Filter chips — hidden in map mode to save vertical space */}
      {!isMapMode && (
        <div className="flex gap-2 flex-wrap">
          {priceOptions.map((price) => (
            <button
              key={price}
              onClick={() => setActivePrice(activePrice === price ? null : price)}
              style={{
                backgroundColor: activePrice === price ? "var(--gold)" : "var(--card)",
                color: activePrice === price ? "#fff" : "var(--text-secondary)",
                border: `0.5px solid ${activePrice === price ? "var(--gold)" : "var(--border)"}`,
                fontFamily: "var(--font-dm-sans)",
                borderRadius: "20px",
                padding: "5px 12px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              {price}
            </button>
          ))}
          {cuisineOptions.map((cuisine) => (
            <button
              key={cuisine}
              onClick={() => setActiveCuisine(activeCuisine === cuisine ? null : cuisine)}
              style={{
                backgroundColor: activeCuisine === cuisine ? "var(--gold)" : "var(--card)",
                color: activeCuisine === cuisine ? "#fff" : "var(--text-secondary)",
                border: `0.5px solid ${activeCuisine === cuisine ? "var(--gold)" : "var(--border)"}`,
                fontFamily: "var(--font-dm-sans)",
                borderRadius: "20px",
                padding: "5px 12px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              {cuisine}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <main
      className="flex flex-col"
      style={{ height: "100dvh", backgroundColor: "var(--bg)", overflow: "hidden" }}
    >
      {/* GPS Error Toast */}
      {gpsError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm shadow-lg"
          style={{ backgroundColor: "#FDF6EC", border: "1px solid #E8A020", color: "#8B5E14", fontFamily: "var(--font-dm-sans)" }}>
          {gpsError}
        </div>
      )}

      {/* Share Toast */}
      {shareToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm shadow-lg"
          style={{ backgroundColor: "var(--text-primary)", color: "var(--bg)", fontFamily: "var(--font-dm-sans)" }}>
          Link copied to clipboard
        </div>
      )}

      {/* ─── Header ───────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b z-20" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", height: "52px" }}>
        <div className="max-w-2xl mx-auto h-full flex items-center gap-3 px-4">
          {/* Brand */}
          <span style={{ fontFamily: "var(--font-playfair)", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em", flexShrink: 0 }}>
            Folio<span style={{ color: "var(--gold)" }}>.</span>
          </span>

          {/* City Selector */}
          <div className="relative">
            <select
              value={isNearMe ? "USE_MY_LOCATION" : cityId}
              onChange={(e) => handleCityChange(e.target.value)}
              className="appearance-none outline-none cursor-pointer pr-5 pl-3 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: "var(--bg)",
                border: "0.5px solid var(--gold)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              {supportsGps && (
                <option value="USE_MY_LOCATION">⊕ Use My Location</option>
              )}
              {CITIES_SORTED.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-xs" style={{ color: "var(--gold)" }}>▾</span>
          </div>

          {/* Near Me badge */}
          {isNearMe && (
            <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: "var(--gold)", color: "#fff", fontFamily: "var(--font-dm-sans)" }}>
              ◎ Near Me
            </span>
          )}

          {/* Powered by */}
          <span className="ml-auto text-xs flex-shrink-0"
            style={{ color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>
            Powered by Claude
          </span>
        </div>
      </header>

      {/* ─── Map Mode: full-width, fills remaining height ─────── */}
      {isMapMode && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Filter/view bar above map */}
          <div className="flex-shrink-0 px-4 py-2 border-b" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
            {filterViewBar}
          </div>
          {/* Map fills rest */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <MapView cards={allCards} center={mapCenter} />
          </div>
        </div>
      )}

      {/* ─── List Mode: scrollable content ────────────────────── */}
      {!isMapMode && (
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          <div className="max-w-2xl mx-auto w-full px-4 py-6">
            {!hasMessages ? (
              /* Welcome / Hero State */
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <h2 style={{
                  fontFamily: "var(--font-playfair)",
                  fontSize: "clamp(28px, 5vw, 42px)",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  lineHeight: 1.15,
                  marginBottom: "16px",
                }}>
                  Find your perfect<br />{cityLabel} restaurant.
                </h2>
                <p style={{
                  color: "var(--text-secondary)",
                  fontSize: "15px",
                  lineHeight: 1.7,
                  maxWidth: "340px",
                  marginBottom: "40px",
                  fontFamily: "var(--font-dm-sans)",
                }}>
                  Tell me what you&apos;re looking for. I&apos;ll find the best options and explain exactly why each one fits.
                </p>
                <div className="flex flex-col gap-2 w-full max-w-sm">
                  {DEFAULT_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => sendMessage(ex)}
                      className="text-left rounded-2xl px-4 py-3 transition-all"
                      style={{
                        backgroundColor: "var(--card)",
                        border: "0.5px solid var(--border)",
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-dm-sans)",
                        fontSize: "13px",
                        lineHeight: 1.5,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--gold)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                      }}
                    >
                      &quot;{ex}&quot;
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Message Thread */}
                {messages.map((msg, i) => (
                  <div key={i}>
                    {msg.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="px-4 py-3 max-w-xs" style={{
                          backgroundColor: "var(--text-primary)",
                          color: "var(--bg)",
                          borderRadius: "18px 18px 4px 18px",
                          fontFamily: "var(--font-dm-sans)",
                          fontSize: "14px",
                          lineHeight: 1.5,
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      <p style={{
                        color: "var(--text-secondary)",
                        fontSize: "13px",
                        fontFamily: "var(--font-dm-sans)",
                        paddingTop: "4px",
                        paddingBottom: "4px",
                      }}>
                        {msg.content}
                      </p>
                    )}
                  </div>
                ))}

                {/* 4-Step Loading Progress */}
                {loading && (
                  <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
                    {LOADING_STEPS.map((step, i) => {
                      const done = i < loadingStep;
                      const active = i === loadingStep;
                      const pct = done ? 100 : active ? 55 : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span style={{
                            width: "52px",
                            fontSize: "11px",
                            fontFamily: "var(--font-dm-sans)",
                            color: "var(--text-muted)",
                            flexShrink: 0,
                          }}>
                            {i + 1}&thinsp;/&thinsp;4
                          </span>
                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg)" }}>
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: "var(--gold)",
                              }}
                            />
                          </div>
                          <span
                            className={active ? "animate-pulse-gold" : ""}
                            style={{
                              fontSize: "12px",
                              fontFamily: "var(--font-dm-sans)",
                              color: done ? "var(--gold)" : active ? "var(--text-primary)" : "var(--text-muted)",
                              minWidth: "170px",
                            }}
                          >
                            {done ? "✓ " : ""}{step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Filter / View Bar */}
                {filterViewBar}

                {/* List View */}
                {displayCards.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {displayCards.map((card, i) => (
                      <RecommendationCard
                        key={card.restaurant?.id ?? i}
                        card={card}
                        index={i}
                        isFavorite={favorites.has(card.restaurant?.id ?? "")}
                        onToggleFavorite={() => toggleFavorite(card.restaurant?.id ?? "")}
                      />
                    ))}
                  </div>
                )}

                {/* Degraded empty-filter state */}
                {visibleCards.length > 0 && displayCards.length === 0 && (
                  <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: "var(--card)", border: "0.5px solid var(--border)" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: "14px", fontFamily: "var(--font-dm-sans)", marginBottom: "12px" }}>
                      No exact matches — showing closest results instead.
                    </p>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {activePrice && (
                        <button
                          onClick={() => setActivePrice(null)}
                          style={{ border: "0.5px solid var(--gold)", color: "var(--gold)", fontFamily: "var(--font-dm-sans)", borderRadius: "20px", padding: "5px 14px", fontSize: "12px", cursor: "pointer" }}
                        >
                          Clear price filter
                        </button>
                      )}
                      {activeCuisine && (
                        <button
                          onClick={() => setActiveCuisine(null)}
                          style={{ border: "0.5px solid var(--gold)", color: "var(--gold)", fontFamily: "var(--font-dm-sans)", borderRadius: "20px", padding: "5px 14px", fontSize: "12px", cursor: "pointer" }}
                        >
                          Clear cuisine filter
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {/* ─── Bottom Input Bar ─────────────────────────────────── */}
      <div className="flex-shrink-0 border-t px-4 py-3 z-10" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="max-w-2xl mx-auto flex gap-2 items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder={
              hasMessages
                ? "Refine: 'more quiet', 'cheaper options'..."
                : "Describe what you're looking for..."
            }
            className="flex-1 outline-none px-4 py-2.5"
            style={{
              backgroundColor: "var(--bg)",
              border: "0.5px solid var(--border)",
              borderRadius: "24px",
              color: "var(--text-primary)",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
            }}
            disabled={loading}
          />
          {/* Send button */}
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            aria-label="Send"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              backgroundColor: "var(--gold)",
              color: "#fff",
              fontSize: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              opacity: loading || !input.trim() ? 0.4 : 1,
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              transition: "opacity 0.2s",
              border: "none",
            }}
          >
            ↑
          </button>
        </div>
      </div>
    </main>
  );
}
