"use client";

import { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import RecommendationCard from "@/components/RecommendationCard";
import { CITIES_SORTED } from "@/lib/cities";
import { useChat, LOADING_STEPS } from "@/app/hooks/useChat";
import { useLocation } from "@/app/hooks/useLocation";
import { useFavorites } from "@/app/hooks/useFavorites";
import { usePreferences, formatProfileForPrompt } from "@/app/hooks/usePreferences";

// Leaflet is not SSR-compatible
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const DEFAULT_EXAMPLES = [
  "Romantic dinner for a first date, ~$60/person, quiet atmosphere",
  "Best local spot under $20, casual, not a chain",
  "Business dinner, $100/person, impressive but not stuffy",
];

const DIETARY_OPTIONS = ["素食", "纯素", "无麸质", "无贝类", "清真", "犹太洁食"];
const NOISE_OPTIONS: Array<{ value: "quiet" | "moderate" | "lively"; label: string }> = [
  { value: "quiet", label: "安静" },
  { value: "moderate", label: "适中" },
  { value: "lively", label: "热闹" },
];

export default function Home() {
  const { profile, updateProfile, learnFromFavorite, learnFromSearch, resetProfile } =
    usePreferences();
  const profileContext = formatProfileForPrompt(profile);

  const location = useLocation();
  const chat = useChat({
    cityId: location.cityId,
    gpsCoords: location.gpsCoords,
    isNearMe: location.isNearMe,
    nearLocation: location.nearLocation,
    profileContext,
  });
  const { favorites, toggleFavorite } = useFavorites(learnFromFavorite);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [prefModalOpen, setPrefModalOpen] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages, chat.visibleCards]);

  const hasMessages = chat.messages.length > 0;
  const lastUserQuery =
    [...chat.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const isMapMode = chat.viewMode === "map" && chat.allCards.length > 0;

  // Shared filter/view bar rendered in both list and map contexts
  const filterViewBar = chat.allCards.length > 0 && (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        {/* View toggle */}
        <div
          className="flex gap-1 rounded-xl p-1"
          style={{
            backgroundColor: "var(--card)",
            border: "0.5px solid var(--border)",
          }}
        >
          {(["list", "map"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => chat.setViewMode(mode)}
              aria-pressed={chat.viewMode === mode}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-all capitalize"
              style={{
                backgroundColor:
                  chat.viewMode === mode ? "var(--gold)" : "transparent",
                color:
                  chat.viewMode === mode ? "#fff" : "var(--text-secondary)",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Share button */}
        <button
          onClick={() => chat.shareResults(lastUserQuery)}
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

      {/* Filter chips — hidden in map mode */}
      {!isMapMode && (
        <div className="flex gap-2 flex-wrap">
          {chat.priceOptions.map((price) => (
            <button
              key={price}
              onClick={() =>
                chat.setActivePrice(
                  chat.activePrice === price ? null : price
                )
              }
              aria-pressed={chat.activePrice === price}
              style={{
                backgroundColor:
                  chat.activePrice === price ? "var(--gold)" : "var(--card)",
                color:
                  chat.activePrice === price ? "#fff" : "var(--text-secondary)",
                border: `0.5px solid ${chat.activePrice === price ? "var(--gold)" : "var(--border)"}`,
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
          {chat.cuisineOptions.map((cuisine) => (
            <button
              key={cuisine}
              onClick={() =>
                chat.setActiveCuisine(
                  chat.activeCuisine === cuisine ? null : cuisine
                )
              }
              aria-pressed={chat.activeCuisine === cuisine}
              style={{
                backgroundColor:
                  chat.activeCuisine === cuisine
                    ? "var(--gold)"
                    : "var(--card)",
                color:
                  chat.activeCuisine === cuisine
                    ? "#fff"
                    : "var(--text-secondary)",
                border: `0.5px solid ${chat.activeCuisine === cuisine ? "var(--gold)" : "var(--border)"}`,
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
      {location.gpsError && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm shadow-lg"
          style={{
            backgroundColor: "#FDF6EC",
            border: "1px solid #E8A020",
            color: "#8B5E14",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          {location.gpsError}
        </div>
      )}

      {/* Share Toast */}
      {chat.shareToast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm shadow-lg"
          style={{
            backgroundColor: "var(--text-primary)",
            color: "var(--bg)",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          Link copied to clipboard
        </div>
      )}

      {/* ─── Preferences Modal (Phase 3.3b) ──────────────────── */}
      {prefModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrefModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 overflow-y-auto"
            style={{
              backgroundColor: "var(--card)",
              maxHeight: "80dvh",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2
                style={{
                  fontFamily: "var(--font-playfair)",
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                我的偏好
              </h2>
              <button
                onClick={() => setPrefModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  fontSize: "20px",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Dietary restrictions */}
            <div style={{ marginBottom: "20px" }}>
              <p
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  marginBottom: "8px",
                }}
              >
                饮食限制
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {DIETARY_OPTIONS.map((d) => {
                  const active = profile.dietary_restrictions.includes(d);
                  return (
                    <button
                      key={d}
                      onClick={() => {
                        const next = active
                          ? profile.dietary_restrictions.filter((x) => x !== d)
                          : [...profile.dietary_restrictions, d];
                        updateProfile({ dietary_restrictions: next });
                      }}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "20px",
                        border: `0.5px solid ${active ? "var(--gold)" : "var(--border)"}`,
                        backgroundColor: active ? "var(--gold)" : "var(--card-2)",
                        color: active ? "#fff" : "var(--text-secondary)",
                        cursor: "pointer",
                        fontFamily: "var(--font-dm-sans)",
                        fontSize: "12px",
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Noise preference */}
            <div style={{ marginBottom: "20px" }}>
              <p
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  marginBottom: "8px",
                }}
              >
                噪音偏好
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                {NOISE_OPTIONS.map(({ value, label }) => {
                  const active = profile.noise_preference === value;
                  return (
                    <button
                      key={value}
                      onClick={() =>
                        updateProfile({
                          noise_preference: active ? undefined : value,
                        })
                      }
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        borderRadius: "8px",
                        border: `0.5px solid ${active ? "var(--gold)" : "var(--border)"}`,
                        backgroundColor: active ? "var(--gold)" : "var(--card-2)",
                        color: active ? "#fff" : "var(--text-secondary)",
                        cursor: "pointer",
                        fontFamily: "var(--font-dm-sans)",
                        fontSize: "12px",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Exclude chains */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}
              >
                排除连锁餐厅
              </span>
              <button
                onClick={() =>
                  updateProfile({ always_exclude_chains: !profile.always_exclude_chains })
                }
                style={{
                  width: "44px",
                  height: "24px",
                  borderRadius: "12px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: profile.always_exclude_chains
                    ? "var(--gold)"
                    : "var(--card-2)",
                  position: "relative",
                  transition: "background-color 0.2s",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "3px",
                    left: profile.always_exclude_chains ? "23px" : "3px",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    backgroundColor: "#fff",
                    transition: "left 0.2s",
                  }}
                />
              </button>
            </div>

            {/* Budget */}
            <div style={{ marginBottom: "20px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                  }}
                >
                  每人预算上限
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "13px",
                    color: "var(--gold)",
                  }}
                >
                  {profile.typical_budget_per_person
                    ? `$${profile.typical_budget_per_person}`
                    : "不限"}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                step={10}
                value={profile.typical_budget_per_person ?? 0}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  updateProfile({ typical_budget_per_person: v || undefined });
                }}
                style={{ width: "100%", accentColor: "var(--gold)" }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button
                onClick={() => setPrefModalOpen(false)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: "var(--gold)",
                  color: "#fff",
                  cursor: "pointer",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                }}
              >
                保存
              </button>
              <button
                onClick={() => {
                  resetProfile();
                  setPrefModalOpen(false);
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "0.5px solid var(--border)",
                  backgroundColor: "transparent",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "13px",
                }}
              >
                重置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Header ─────────────────────────────────────────── */}
      <header
        className="flex-shrink-0 border-b z-20"
        style={{
          backgroundColor: "var(--card)",
          borderColor: "var(--border)",
          height: "52px",
        }}
      >
        <div className="max-w-2xl mx-auto h-full flex items-center gap-3 px-4">
          {/* Brand */}
          <span
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
              flexShrink: 0,
            }}
          >
            Folio<span style={{ color: "var(--gold)" }}>.</span>
          </span>

          {/* Location Input with Dropdown */}
          <div className="relative flex-shrink-0">
            <div className="relative">
              <input
                type="text"
                value={
                  location.locationOpen
                    ? location.locationInput
                    : location.locationDisplayValue
                }
                onChange={(e) => location.updateLocationInput(e.target.value)}
                onFocus={() => {
                  location.setLocationOpen(true);
                  location.updateLocationInput("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = location.locationInputRef.current.trim();
                    if (val) location.submitNearLocation(val);
                    location.setLocationOpen(false);
                    location.updateLocationInput("");
                    (e.target as HTMLInputElement).blur();
                  }
                  if (e.key === "Escape") {
                    location.setLocationOpen(false);
                    location.updateLocationInput("");
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                onBlur={location.handleLocationBlur}
                placeholder="Near where? (e.g. Union Square)"
                role="combobox"
                aria-label="Search by location or select a city"
                aria-expanded={location.locationOpen}
                aria-controls="location-dropdown"
                aria-haspopup="listbox"
                className="location-input outline-none"
                style={{
                  backgroundColor: "var(--bg)",
                  border: "0.5px solid rgba(201,168,76,0.4)",
                  borderRadius: "20px",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "13px",
                  color: "var(--text-primary)",
                  padding: "4px 24px 4px 12px",
                  width: "160px",
                }}
              />
              <span
                className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ fontSize: "10px", color: "var(--gold)" }}
              >
                ▾
              </span>
            </div>

            {/* Dropdown */}
            {location.locationOpen && (
              <div
                id="location-dropdown"
                role="listbox"
                aria-label="City selection"
                className="absolute top-full left-0 mt-1 z-50 overflow-y-auto"
                style={{
                  backgroundColor: "var(--card)",
                  border: "0.5px solid var(--border)",
                  borderRadius: "12px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                  maxHeight: "240px",
                  minWidth: "180px",
                }}
              >
                {location.supportsGps && (
                  <button
                    role="option"
                    aria-selected={location.isNearMe}
                    aria-label="Use my current GPS location"
                    onMouseDown={() => {
                      location.suppressNextBlur();
                      location.requestGps();
                      location.setLocationOpen(false);
                      location.updateLocationInput("");
                    }}
                    className="w-full text-left px-3 py-2.5"
                    style={{
                      fontFamily: "var(--font-dm-sans)",
                      fontSize: "13px",
                      color: "var(--gold)",
                      display: "block",
                      background: "none",
                      borderTop: "none",
                      borderLeft: "none",
                      borderRight: "none",
                      borderBottom: "0.5px solid var(--border)",
                      cursor: "pointer",
                    }}
                  >
                    ⊕ Use My Location
                  </button>
                )}
                {CITIES_SORTED.filter(
                  (c) =>
                    !location.locationInput.trim() ||
                    c.label
                      .toLowerCase()
                      .includes(location.locationInput.toLowerCase())
                ).map((c) => (
                  <button
                    key={c.id}
                    role="option"
                    aria-selected={c.id === location.cityId}
                    aria-label={`Select ${c.label}`}
                    onMouseDown={() => {
                      location.suppressNextBlur();
                      location.handleCitySelect(c.id);
                      location.setLocationOpen(false);
                      location.updateLocationInput("");
                    }}
                    className="w-full text-left px-3 py-2"
                    style={{
                      fontFamily: "var(--font-dm-sans)",
                      fontSize: "13px",
                      color:
                        c.id === location.cityId
                          ? "var(--gold)"
                          : "var(--text-primary)",
                      display: "block",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preferences button */}
          <button
            onClick={() => setPrefModalOpen(true)}
            aria-label="Open preferences"
            title="我的偏好"
            style={{
              background: "none",
              border: "0.5px solid var(--border)",
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "14px",
              flexShrink: 0,
            }}
          >
            ⚙
          </button>

          {/* Powered by */}
          <span
            className="ml-auto text-xs flex-shrink-0"
            style={{
              color: "var(--text-muted)",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            Powered by Claude
          </span>
        </div>
      </header>

      {/* ─── Map Mode ───────────────────────────────────────── */}
      {isMapMode && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div
            className="flex-shrink-0 px-4 py-2 border-b"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--card)",
            }}
          >
            {filterViewBar}
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <MapView cards={chat.allCards} center={location.mapCenter} />
          </div>
        </div>
      )}

      {/* ─── List Mode ──────────────────────────────────────── */}
      {!isMapMode && (
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          <div className="max-w-2xl mx-auto w-full px-4 py-6">
            {!hasMessages ? (
              /* Welcome / Hero State */
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <h2
                  style={{
                    fontFamily: "var(--font-playfair)",
                    fontSize: "clamp(28px, 5vw, 42px)",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    lineHeight: 1.15,
                    marginBottom: "16px",
                  }}
                >
                  Find your perfect<br />
                  {location.cityLabel} restaurant.
                </h2>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "15px",
                    lineHeight: 1.7,
                    maxWidth: "340px",
                    marginBottom: "40px",
                    fontFamily: "var(--font-dm-sans)",
                  }}
                >
                  Tell me what you&apos;re looking for. I&apos;ll find the best
                  options and explain exactly why each one fits.
                </p>
                <div className="flex flex-col gap-2 w-full max-w-sm">
                  {DEFAULT_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => {
                        learnFromSearch(ex);
                        chat.sendMessage(ex);
                      }}
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
                        (e.currentTarget as HTMLElement).style.borderColor =
                          "var(--gold)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor =
                          "var(--border)";
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
                {chat.messages.map((msg, i) => (
                  <div key={i}>
                    {msg.role === "user" ? (
                      <div className="flex justify-end">
                        <div
                          className="px-4 py-3 max-w-xs"
                          style={{
                            backgroundColor: "var(--text-primary)",
                            color: "var(--bg)",
                            borderRadius: "18px 18px 4px 18px",
                            fontFamily: "var(--font-dm-sans)",
                            fontSize: "14px",
                            lineHeight: 1.5,
                          }}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      <p
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "13px",
                          fontFamily: "var(--font-dm-sans)",
                          paddingTop: "4px",
                          paddingBottom: "4px",
                        }}
                      >
                        {msg.content}
                      </p>
                    )}
                  </div>
                ))}

                {/* 4-Step Loading Progress */}
                {chat.loading && (
                  <div
                    className="rounded-2xl p-5 space-y-4"
                    style={{
                      backgroundColor: "var(--card)",
                      border: "0.5px solid var(--border)",
                    }}
                  >
                    {LOADING_STEPS.map((step, i) => {
                      const done = i < chat.loadingStep;
                      const active = i === chat.loadingStep;
                      const pct = done ? 100 : active ? 55 : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span
                            style={{
                              width: "52px",
                              fontSize: "11px",
                              fontFamily: "var(--font-dm-sans)",
                              color: "var(--text-muted)",
                              flexShrink: 0,
                            }}
                          >
                            {i + 1}&thinsp;/&thinsp;4
                          </span>
                          <div
                            className="flex-1 h-1 rounded-full overflow-hidden"
                            style={{ backgroundColor: "var(--bg)" }}
                          >
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
                              color: done
                                ? "var(--gold)"
                                : active
                                ? "var(--text-primary)"
                                : "var(--text-muted)",
                              minWidth: "170px",
                            }}
                          >
                            {done ? "✓ " : ""}
                            {step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Filter / View Bar */}
                {filterViewBar}

                {/* List View */}
                {chat.displayCards.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {chat.displayCards.map((card, i) => (
                      <RecommendationCard
                        key={card.restaurant?.id ?? i}
                        card={card}
                        index={i}
                        isFavorite={favorites.has(card.restaurant?.id ?? "")}
                        onToggleFavorite={() =>
                          toggleFavorite(card.restaurant?.id ?? "", card)
                        }
                        nearLocationLabel={location.nearLocation || undefined}
                        currentQuery={lastUserQuery}
                      />
                    ))}
                  </div>
                )}

                {/* Degraded empty-filter state */}
                {chat.visibleCards.length > 0 &&
                  chat.displayCards.length === 0 && (
                    <div
                      className="rounded-2xl p-6 text-center"
                      style={{
                        backgroundColor: "var(--card)",
                        border: "0.5px solid var(--border)",
                      }}
                    >
                      <p
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "14px",
                          fontFamily: "var(--font-dm-sans)",
                          marginBottom: "12px",
                        }}
                      >
                        No exact matches — showing closest results instead.
                      </p>
                      <div className="flex gap-2 justify-center flex-wrap">
                        {chat.activePrice && (
                          <button
                            onClick={() => chat.setActivePrice(null)}
                            style={{
                              border: "0.5px solid var(--gold)",
                              color: "var(--gold)",
                              fontFamily: "var(--font-dm-sans)",
                              borderRadius: "20px",
                              padding: "5px 14px",
                              fontSize: "12px",
                              cursor: "pointer",
                              background: "none",
                            }}
                          >
                            Clear price filter
                          </button>
                        )}
                        {chat.activeCuisine && (
                          <button
                            onClick={() => chat.setActiveCuisine(null)}
                            style={{
                              border: "0.5px solid var(--gold)",
                              color: "var(--gold)",
                              fontFamily: "var(--font-dm-sans)",
                              borderRadius: "20px",
                              padding: "5px 14px",
                              fontSize: "12px",
                              cursor: "pointer",
                              background: "none",
                            }}
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
      <div
        className="flex-shrink-0 border-t px-4 py-3 z-10"
        style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="max-w-2xl mx-auto flex gap-2 items-center">
          <input
            type="text"
            value={chat.input}
            onChange={(e) => chat.setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                learnFromSearch(chat.input);
                chat.sendMessage(chat.input);
              }
            }}
            placeholder={
              hasMessages
                ? "Refine: 'more quiet', 'cheaper options'..."
                : "Describe what you're looking for..."
            }
            aria-label="Search for restaurants"
            className="flex-1 outline-none px-4 py-2.5"
            style={{
              backgroundColor: "var(--bg)",
              border: "0.5px solid var(--border)",
              borderRadius: "24px",
              color: "var(--text-primary)",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
            }}
            disabled={chat.loading}
          />
          <button
            onClick={() => {
              learnFromSearch(chat.input);
              chat.sendMessage(chat.input);
            }}
            disabled={chat.loading || !chat.input.trim()}
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
              opacity: chat.loading || !chat.input.trim() ? 0.4 : 1,
              cursor:
                chat.loading || !chat.input.trim() ? "not-allowed" : "pointer",
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
