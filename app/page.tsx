"use client";

import { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import RecommendationCard from "@/components/RecommendationCard";
import HotelCard from "@/components/HotelCard";
import FlightCard from "@/components/FlightCard";
import CreditCardCard from "@/components/CreditCardCard";
import LaptopCard from "@/components/LaptopCard";
import SmartphoneCard from "@/components/SmartphoneCard";
import HeadphoneCard from "@/components/HeadphoneCard";
import ScenarioPlanView from "@/components/ScenarioPlanView";
import FeedbackPromptCard from "@/components/FeedbackPromptCard";
import DateRangePicker from "@/components/DateRangePicker";
import { CITIES_SORTED } from "@/lib/cities";
import { useChat, LOADING_STEPS } from "@/app/hooks/useChat";
import { useSubscriptions } from "@/app/hooks/useSubscriptions";
import { subscribeToPushNotifications } from "@/app/hooks/usePushSubscribe";
import { WATCH_CATEGORY_META } from "@/lib/watchTypes";
import { buildPlanFeedbackCopy } from "@/lib/outputCopy";
import type { MapPin } from "@/components/MapView";
import { useLocation } from "@/app/hooks/useLocation";
import { useFavorites } from "@/app/hooks/useFavorites";
import { usePreferences, formatProfileForPrompt } from "@/app/hooks/usePreferences";
import { useVoiceInput } from "@/app/hooks/useVoiceInput";
import { useAuth } from "@/app/hooks/useAuth";
import { PlanAction, PlanLinkAction, RecommendationCard as CardType, PostExperienceFeedback } from "@/lib/types";
import type { FeedbackPromptItem } from "@/app/api/feedback-prompts/route";

// Leaflet is not SSR-compatible
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const DEFAULT_EXAMPLES = [
  "Romantic dinner for two, ~$80/person, quiet, no chains, Manhattan",
  "4-star hotel in Chicago downtown, $200/night, check in Friday, 2 nights, business trip",
];

const HERO_TAGLINES = [
  {
    headline: ["Your AI guide", "to the city."],
    sub: "Restaurants, hotels, and more — curated for you.",
  },
  {
    headline: ["Tell me where", "you want to be."],
    sub: "I'll find exactly the right place.",
  },
  {
    headline: ["Discover places", "worth remembering."],
    sub: "Powered by AI. Guided by taste.",
  },
  {
    headline: ["Every city has", "hidden gems."],
    sub: "Folio. helps you find them.",
  },
];

const DIETARY_OPTIONS = ["素食", "纯素", "无麸质", "无贝类", "清真", "犹太洁食"];
const NOISE_OPTIONS: Array<{ value: "quiet" | "moderate" | "lively"; label: string }> = [
  { value: "quiet", label: "安静" },
  { value: "moderate", label: "适中" },
  { value: "lively", label: "热闹" },
];

const WEIGHT_LABELS: Record<string, string> = {
  budget_match: "预算匹配",
  scene_match: "场景契合",
  review_quality: "口碑质量",
  location_convenience: "位置便利",
  preference_match: "偏好吻合",
};

export default function Home() {
  const { profile, updateProfile, learnFromFavorite, learnFromSearch, resetProfile, learnedWeights, learnWeightsFromFeedback } =
    usePreferences();
  const profileContext = formatProfileForPrompt(profile);
  const { userId } = useAuth();

  const location = useLocation();
  const subs = useSubscriptions();
  const chat = useChat({
    cityId: location.cityId,
    gpsCoords: location.gpsCoords,
    isNearMe: location.isNearMe,
    nearLocation: location.nearLocation,
    profileContext,
    learnedWeights,
    userId,
    onSubscriptionIntent: (intent) => {
      if (intent.action === "subscribe") subs.addSubscription(intent);
      else if (intent.action === "unsubscribe") subs.removeSubscription(intent);
      // "list" is handled by the chat message sentinel
    },
  });
  const { favorites, toggleFavorite } = useFavorites(learnFromFavorite);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef("");
  const isComposingRef = useRef(false);
  // Tracks the plan ID that triggered a refine action, for parent_plan_id lineage
  const refinedFromPlanIdRef = useRef<string | null>(null);
  const [prefModalOpen, setPrefModalOpen] = useState(false);

  // Phase 5.3: Auth
  const auth = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [upgradePromptShown, setUpgradePromptShown] = useState(false);
  const [planFeedbackMessage, setPlanFeedbackMessage] = useState<string | null>(null);
  const [pendingFeedbackPrompts, setPendingFeedbackPrompts] = useState<FeedbackPromptItem[]>([]);

  // Phase 5.2: Voice input
  const { isListening, isSupported: voiceSupported, startListening, stopListening } = useVoiceInput(
    (transcript) => {
      chat.setInput(transcript);
      // Auto-send after a short delay so the input value is set
      setTimeout(() => {
        learnFromSearch(transcript);
        chat.sendMessage(transcript);
      }, 100);
    }
  );

  // Phase 4.3: Compare state
  const [compareSelection, setCompareSelection] = useState<(CardType | null)[]>([null, null]);
  const [compareOpen, setCompareOpen] = useState(false);

  // Phase 7: Hotel date picker state
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [hotelDates, setHotelDates] = useState<{ checkIn: string; checkOut: string } | null>(null);

  // Hero tagline rotation (start at 0 for SSR, randomize on mount to avoid hydration mismatch)
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroVisible, setHeroVisible] = useState(true);

  // Phase 4.6: Call learnWeightsFromFeedback on mount
  useEffect(() => {
    learnWeightsFromFeedback();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 5.3: Migrate localStorage data to cloud after sign-in
  useEffect(() => {
    if (auth.isSignedIn) {
      auth.migrateLocalDataToCloud();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isSignedIn]);

  // 3c-3: Check for pending post-experience feedback prompts on mount
  useEffect(() => {
    const sessionId = chat.getSessionId();
    fetch(`/api/feedback-prompts?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.prompts?.length) {
          setPendingFeedbackPrompts(data.prompts);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages, chat.visibleCards]);

  useEffect(() => {
    setPlanFeedbackMessage(null);
  }, [chat.decisionPlan?.id]);

  useEffect(() => {
    chatInputRef.current = chat.input;
  }, [chat.input]);

  const hasMessages = chat.messages.length > 0;
  const lastUserQuery =
    [...chat.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const hasCategoryResults =
    chat.allCards.length > 0 ||
    chat.allHotelCards.length > 0 ||
    chat.allFlightCards.length > 0 ||
    chat.allCreditCardCards.length > 0 ||
    chat.allLaptopCards.length > 0 ||
    chat.allSmartphoneCards.length > 0 ||
    chat.allHeadphoneCards.length > 0;
  const isMapMode =
    chat.resultMode === "category_cards" &&
    chat.viewMode === "map" &&
    hasCategoryResults;
  // Unified map pins for restaurants and hotels (flights use arc lines, not pins)
  const mapPins: MapPin[] = chat.resultCategory === "hotel"
    ? chat.allHotelCards
        .filter((c) => c.hotel.lat != null && c.hotel.lng != null)
        .map((c, i) => ({
          id: c.hotel.id,
          name: c.hotel.name,
          lat: c.hotel.lat!,
          lng: c.hotel.lng!,
          rank: i + 1,
          subtitle: c.hotel.price_per_night > 0 ? `$${c.hotel.price_per_night}/night` : "",
          rating: c.hotel.rating,
        }))
    : chat.allCards
        .filter((c) => c.restaurant.lat != null && c.restaurant.lng != null)
        .map((c, i) => ({
          id: c.restaurant.id,
          name: c.restaurant.name,
          lat: c.restaurant.lat!,
          lng: c.restaurant.lng!,
          rank: i + 1,
          subtitle: c.restaurant.cuisine ?? "",
          rating: c.restaurant.rating,
        }));

  // Hero tagline rotation — cycle every 4.5s with fade transition
  useEffect(() => {
    if (hasMessages) return;
    // Randomize starting index on client only (avoids SSR hydration mismatch)
    setHeroIdx(Math.floor(Math.random() * HERO_TAGLINES.length));
    const id = setInterval(() => {
      setHeroVisible(false);
      setTimeout(() => {
        setHeroIdx((i) => (i + 1) % HERO_TAGLINES.length);
        setHeroVisible(true);
      }, 500);
    }, 4500);
    return () => clearInterval(id);
  }, [hasMessages]);

  // Phase 4.3: Compare helpers
  function toggleCompare(card: CardType) {
    setCompareSelection((prev) => {
      const existingIdx = prev.findIndex((c) => c?.restaurant.id === card.restaurant.id);
      if (existingIdx >= 0) {
        // Remove from compare
        const next = [...prev];
        next[existingIdx] = null;
        return next;
      }
      // Add to first empty slot
      const emptyIdx = prev.findIndex((c) => c === null);
      if (emptyIdx >= 0) {
        const next = [...prev];
        next[emptyIdx] = card;
        return next;
      }
      // Replace slot 1 (keep slot 0)
      return [prev[0], card];
    });
  }

  function updateChatInput(value: string) {
    chatInputRef.current = value;
    chat.setInput(value);
  }

  function sendCurrentInput() {
    const text = chatInputRef.current.trim();
    if (!text || chat.loading || isListening) return;
    learnFromSearch(text);
    chat.sendMessage(text);
    chatInputRef.current = "";
  }

  function isComparing(card: CardType) {
    return compareSelection.some((c) => c?.restaurant.id === card.restaurant.id);
  }

  // Phase 4.5: Updated share button — also generate base64 share URL
  function handleShare() {
    // Existing: copy URL with query param
    chat.shareResults(lastUserQuery);

    // Also generate base64 share URL for top 3
    if (chat.allCards.length > 0) {
      const top3 = chat.allCards.slice(0, 3).map((c) => ({
        name: c.restaurant.name,
        rank: c.rank,
        why_recommended: c.why_recommended,
        score: c.score,
      }));
      const token = btoa(JSON.stringify(top3));
      // Update URL to shareable share page
      const shareUrl = `${window.location.origin}/share/${token}`;
      navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
  }

  async function handlePlanAction(action: PlanAction) {
    if (action.type === "share_plan") {
      chat.trackDecisionPlanEvent({
        type: "action_clicked",
        action_id: action.id,
        option_id: chat.decisionPlan?.primary_plan.id,
        query: lastUserQuery,
      });

      if (!chat.decisionPlan) throw new Error("No plan to share");

      const res = await fetch("/api/plan/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: chat.decisionPlan,
          session_id: chat.getSessionId(),
          query_text: lastUserQuery,
          parent_plan_id: refinedFromPlanIdRef.current ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      refinedFromPlanIdRef.current = null;

      const shareUrl = `${window.location.origin}/plan/${chat.decisionPlan.id}`;
      await navigator.clipboard.writeText(shareUrl);

      setPlanFeedbackMessage(
        buildPlanFeedbackCopy(chat.decisionPlan?.output_language, "shared")
      );
      return;
    }

    if (action.type === "send_for_vote") {
      chat.trackDecisionPlanEvent({
        type: "action_clicked",
        action_id: action.id,
        option_id: chat.decisionPlan?.primary_plan.id,
        query: lastUserQuery,
      });

      if (!chat.decisionPlan) throw new Error("No plan to share for vote");

      // Mark vote_mode on the plan before saving
      const voteModePlan = { ...chat.decisionPlan, vote_mode: true };
      const res = await fetch("/api/plan/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: voteModePlan,
          session_id: chat.getSessionId(),
          query_text: lastUserQuery,
          parent_plan_id: refinedFromPlanIdRef.current ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);

      const voteUrl = `${window.location.origin}/plan/${voteModePlan.id}?vote=true`;
      await navigator.clipboard.writeText(voteUrl);

      setPlanFeedbackMessage(
        chat.decisionPlan.output_language === "zh"
          ? "投票链接已复制 — 发给朋友吧！"
          : "Vote link copied — send it to your friends!"
      );
      return;
    }

    if (action.type === "watch_price") {
      if (!chat.decisionPlan) throw new Error("No plan to watch");

      // Request push notification permission to deliver price drop alerts
      subscribeToPushNotifications(chat.getSessionId(), userId).catch(() => {});

      // Save the plan first so it persists
      const saveRes = await fetch("/api/plan/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: chat.decisionPlan,
          session_id: chat.getSessionId(),
          query_text: lastUserQuery,
          parent_plan_id: refinedFromPlanIdRef.current ?? undefined,
        }),
      });
      if (!saveRes.ok) throw new Error(`Save failed: ${saveRes.status}`);

      // Build a price watch item from the primary plan's estimated total
      const primary = chat.decisionPlan.primary_plan;
      const rawTotal = primary.estimated_total ?? "";
      const priceNum = parseFloat(rawTotal.replace(/[^0-9.]/g, "")) || 0;

      if (priceNum > 0) {
        const watchItem = {
          item_type: chat.decisionPlan.scenario === "big_purchase" ? "hotel" : "hotel" as const,
          item_key: primary.id,
          item_label: primary.title,
          last_known_price: priceNum,
        };
        // Fire-and-forget — don't block UI on this
        fetch(`/api/plan/${chat.decisionPlan.id}/price-watch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: chat.getSessionId(),
            items: [watchItem],
          }),
        }).catch(() => {});
      }

      const lang = chat.decisionPlan.output_language;
      setPlanFeedbackMessage(
        lang === "zh"
          ? "价格提醒已开启 — 价格下降超过 10% 时会推送通知"
          : "Watching prices — you'll get a push notification if prices drop more than 10%"
      );
      return;
    }

    if (action.type === "export_brief") {
      if (!chat.decisionPlan) throw new Error("No plan to export");

      // Save the plan so the brief route can read it from DB
      const res = await fetch("/api/plan/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: chat.decisionPlan,
          session_id: chat.getSessionId(),
          query_text: lastUserQuery,
          parent_plan_id: refinedFromPlanIdRef.current ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);

      window.open(`/api/plan/${chat.decisionPlan.id}/brief`, "_blank");
      return;
    }

    if (action.type === "swap_backup" && action.option_id) {
      chat.trackDecisionPlanEvent({
        type: "backup_promoted",
        option_id: action.option_id,
        action_id: action.id,
        query: lastUserQuery,
      });
      chat.swapDecisionPlanOption(action.option_id);
      setPlanFeedbackMessage(
        buildPlanFeedbackCopy(chat.decisionPlan?.output_language, "promoted")
      );
      return;
    }

    if (action.type === "approve_plan") {
      chat.trackDecisionPlanEvent({
        type: "plan_approved",
        action_id: action.id,
        option_id: chat.decisionPlan?.primary_plan.id,
        query: lastUserQuery,
      });
      setPlanFeedbackMessage(
        buildPlanFeedbackCopy(chat.decisionPlan?.output_language, "approved")
      );
      return;
    }

    if (action.type === "request_changes") {
      chat.trackDecisionPlanEvent({
        type: "feedback_negative",
        action_id: action.id,
        option_id: chat.decisionPlan?.primary_plan.id,
        query: lastUserQuery,
      });
      setPlanFeedbackMessage(
        buildPlanFeedbackCopy(chat.decisionPlan?.output_language, "needs_changes")
      );
      return;
    }

    if (action.type === "refine" && action.prompt) {
      chat.trackDecisionPlanEvent({
        type: "action_clicked",
        action_id: action.id,
        option_id: chat.decisionPlan?.primary_plan.id,
        query: lastUserQuery,
        metadata: { prompt: action.prompt },
      });
      // Store current plan ID so it can be passed as parent_plan_id when the refined plan is saved
      refinedFromPlanIdRef.current = chat.decisionPlan?.id ?? null;
      setPlanFeedbackMessage(
        buildPlanFeedbackCopy(
          chat.decisionPlan?.output_language,
          "refining",
          action.label
        )
      );
      learnFromSearch(action.prompt);
      chat.sendMessage(action.prompt);
    }
  }

  async function handleFeedbackResponse(
    promptId: number,
    planId: string,
    feedback: PostExperienceFeedback
  ) {
    setPendingFeedbackPrompts((prev) => prev.filter((p) => p.id !== promptId));
    fetch("/api/feedback-prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt_id: promptId,
        plan_id: planId,
        session_id: chat.getSessionId(),
        feedback,
      }),
    }).catch(() => {});
  }

  function handlePlanLinkClick(action: PlanLinkAction, optionId: string) {
    chat.trackDecisionPlanEvent({
      type: "action_clicked",
      action_id: action.id,
      option_id: optionId,
      query: lastUserQuery,
      metadata: { label: action.label, url: action.url },
    });
  }

  // Phase 4.3: request_id is available in complete event; track it
  // (We track it via suggestedRefinements being set when complete arrives)
  // We pass requestId=undefined for now (it's in the SSE data but not surfaced here)

  // Shared filter/view bar rendered in both list and map contexts
  const filterViewBar = chat.resultMode === "category_cards" && hasCategoryResults && (
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
          onClick={handleShare}
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

      {/* Phase 4.3: Suggested refinement chips — hidden in map mode */}
      {!isMapMode && chat.suggestedRefinements.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {chat.suggestedRefinements.map((refinement) => (
            <button
              key={refinement}
              onClick={() => {
                learnFromSearch(refinement);
                chat.sendMessage(refinement);
              }}
              style={{
                backgroundColor: "var(--card-2)",
                color: "var(--text-secondary)",
                border: "0.5px solid var(--border)",
                fontFamily: "var(--font-dm-sans)",
                borderRadius: "20px",
                padding: "5px 12px",
                fontSize: "12px",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--gold)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              }}
            >
              {refinement}
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

      {/* ─── Preferences Modal (Phase 3.3b + 4.6) ──────────────────── */}
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

            {/* Phase 4.6: Learned weights section */}
            {learnedWeights && (
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
                  个性化权重
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    marginBottom: "10px",
                  }}
                >
                  基于 {learnedWeights.sample_size} 条反馈自动学习
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(["scene_match", "budget_match", "review_quality", "location_convenience", "preference_match"] as const).map((key) => {
                    const val = learnedWeights[key];
                    const pct = Math.round(val * 100);
                    return (
                      <div key={key}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                          <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "11px", color: "var(--text-secondary)" }}>
                            {WEIGHT_LABELS[key]}
                          </span>
                          <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "11px", color: "var(--gold)" }}>
                            {pct}%
                          </span>
                        </div>
                        <div style={{ height: "4px", backgroundColor: "var(--card-2)", borderRadius: "2px", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "var(--gold)", borderRadius: "2px" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

      {/* ─── Compare Bottom Sheet (Phase 4.3) ──────────────────── */}
      {compareOpen && compareSelection.some((c) => c !== null) && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCompareOpen(false);
          }}
        >
          <div
            className="w-full max-w-2xl rounded-t-2xl overflow-y-auto"
            style={{
              backgroundColor: "var(--card)",
              maxHeight: "70dvh",
              padding: "20px 16px",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                style={{
                  fontFamily: "var(--font-playfair)",
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                对比
              </h3>
              <button
                onClick={() => setCompareOpen(false)}
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {compareSelection.map((card, idx) =>
                card ? (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: "var(--card-2)",
                      borderRadius: "12px",
                      border: "0.5px solid var(--border)",
                      padding: "14px",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "var(--font-playfair)",
                        fontSize: "15px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        marginBottom: "4px",
                      }}
                    >
                      {card.restaurant.name}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans)",
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        marginBottom: "12px",
                      }}
                    >
                      {card.restaurant.cuisine} · {card.restaurant.price}
                    </p>
                    {card.scoring && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {(["scene_match", "budget_match", "review_quality", "location_convenience", "preference_match"] as const).map((key) => {
                          const val = card.scoring![key];
                          const pct = Math.round((val / 10) * 100);
                          return (
                            <div key={key}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                                <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "10px", color: "var(--text-secondary)" }}>
                                  {WEIGHT_LABELS[key]}
                                </span>
                                <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "10px", color: "var(--gold)" }}>
                                  {val.toFixed(1)}
                                </span>
                              </div>
                              <div style={{ height: "3px", backgroundColor: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "var(--gold)", borderRadius: "2px" }} />
                              </div>
                            </div>
                          );
                        })}
                        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "12px", fontWeight: 600, color: "var(--gold)", marginTop: "4px" }}>
                          综合 {card.scoring.weighted_total.toFixed(1)}
                        </p>
                      </div>
                    )}
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans)",
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                        marginTop: "8px",
                      }}
                    >
                      {card.why_recommended}
                    </p>
                  </div>
                ) : (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: "var(--card-2)",
                      borderRadius: "12px",
                      border: "0.5px dashed var(--border)",
                      padding: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-dm-sans)",
                      fontSize: "12px",
                    }}
                  >
                    点击卡片上的「对比」
                  </div>
                )
              )}
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

          {/* Phase 5.3: Auth area */}
          <div className="ml-auto flex-shrink-0 relative">
            {auth.isSignedIn ? (
              /* Signed-in: Avatar button */
              <>
                <button
                  onClick={() => setAccountMenuOpen((o) => !o)}
                  aria-label="Account menu"
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "1.5px solid var(--gold)",
                    cursor: "pointer",
                    background: "none",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "var(--gold)",
                    color: "#fff",
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  {auth.userAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={auth.userAvatar} alt="avatar" width={30} height={30} style={{ objectFit: "cover" }} />
                  ) : (
                    (auth.userDisplayName?.[0] ?? "U").toUpperCase()
                  )}
                </button>
                {accountMenuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 8px)",
                      backgroundColor: "var(--card)",
                      border: "0.5px solid var(--border)",
                      borderRadius: "12px",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.16)",
                      minWidth: "160px",
                      zIndex: 50,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        fontFamily: "var(--font-dm-sans)",
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        borderBottom: "0.5px solid var(--border)",
                      }}
                    >
                      {auth.userDisplayName ?? "Signed in"}
                    </div>
                    <button
                      onClick={() => { setPrefModalOpen(true); setAccountMenuOpen(false); }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 14px",
                        fontFamily: "var(--font-dm-sans)",
                        fontSize: "13px",
                        color: "var(--text-primary)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      偏好设置
                    </button>
                    <button
                      onClick={() => { auth.signOut(); setAccountMenuOpen(false); }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 14px",
                        fontFamily: "var(--font-dm-sans)",
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        borderTop: "0.5px solid var(--border)",
                      }}
                    >
                      退出登录
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Not signed in: Login button */
              <button
                onClick={() => auth.signIn()}
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  background: "none",
                  border: "0.5px solid var(--border)",
                  borderRadius: "16px",
                  padding: "4px 10px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                登录
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Phase 5.3: Upgrade prompt toast (shown after 3rd favorite when not signed in) */}
      {upgradePromptShown && !auth.isSignedIn && (
        <div
          style={{
            position: "fixed",
            bottom: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "var(--card)",
            border: "0.5px solid var(--gold)",
            borderRadius: "12px",
            padding: "10px 16px",
            zIndex: 100,
            boxShadow: "0 4px 16px rgba(0,0,0,0.16)",
            maxWidth: "320px",
            width: "calc(100% - 32px)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              color: "var(--text-primary)",
              flex: 1,
            }}
          >
            保存到云端，换设备也能看到你的收藏
          </span>
          <button
            onClick={() => { auth.signIn(); setUpgradePromptShown(false); }}
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "12px",
              color: "#fff",
              backgroundColor: "var(--gold)",
              border: "none",
              borderRadius: "8px",
              padding: "4px 10px",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            登录
          </button>
          <button
            onClick={() => setUpgradePromptShown(false)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: "16px", padding: 0 }}
          >
            ×
          </button>
        </div>
      )}

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
            <MapView
              pins={mapPins}
              center={location.mapCenter}
              label={chat.resultCategory === "hotel" ? "Hotel" : "Restaurant"}
              flightCards={chat.resultCategory === "flight" ? chat.allFlightCards : undefined}
            />
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
                    opacity: heroVisible ? 1 : 0,
                    transform: heroVisible ? "translateY(0)" : "translateY(-10px)",
                    transition: "opacity 0.5s ease, transform 0.5s ease",
                  }}
                >
                  {HERO_TAGLINES[heroIdx].headline[0]}<br />
                  {HERO_TAGLINES[heroIdx].headline[1]}
                </h2>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "15px",
                    lineHeight: 1.7,
                    maxWidth: "340px",
                    marginBottom: "40px",
                    fontFamily: "var(--font-dm-sans)",
                    opacity: heroVisible ? 1 : 0,
                    transform: heroVisible ? "translateY(0)" : "translateY(-10px)",
                    transition: "opacity 0.5s ease 0.06s, transform 0.5s ease 0.06s",
                  }}
                >
                  {HERO_TAGLINES[heroIdx].sub}
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
                {/* New-product notification banners (from subscriptions) */}
                {subs.newMatches.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {subs.newMatches.map((match) => {
                      const meta = WATCH_CATEGORY_META[match.subscription.watch_category];
                      return (
                        <div
                          key={match.subscription.id}
                          style={{
                            background: "var(--card)",
                            border: "1px solid var(--gold)",
                            borderLeft: "3px solid var(--gold)",
                            borderRadius: "10px",
                            padding: "12px 14px",
                            fontFamily: "var(--font-dm-sans)",
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--gold)", marginBottom: "6px" }}>
                            {meta.emoji} New {meta.label} announcement — {match.subscription.label}
                          </div>
                          {match.products.map((p) => (
                            <div key={p.id} style={{ fontSize: "13px", color: "var(--text-primary)", marginBottom: "4px" }}>
                              <span style={{ fontWeight: 500 }}>{p.name}</span>
                              {p.extracted_specs.cpu && <span style={{ color: "var(--text-secondary)", marginLeft: "6px" }}>{p.extracted_specs.cpu}</span>}
                              {p.extracted_specs.price_usd && <span style={{ color: "var(--text-secondary)", marginLeft: "6px" }}>${p.extracted_specs.price_usd}</span>}
                              <a href={p.source_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "8px", color: "var(--gold)", fontSize: "12px" }}>Source →</a>
                            </div>
                          ))}
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "6px" }}>
                            We&apos;re gathering full review data — check back soon for complete recommendations.
                          </div>
                          <button
                            onClick={subs.clearNewMatches}
                            style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                          >
                            Dismiss
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

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
                    ) : msg.content === "__LIST_SUBSCRIPTIONS__" ? (
                      /* Subscription list view */
                      <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "13px" }}>
                        {subs.subscriptions.length === 0 ? (
                          <p style={{ color: "var(--text-secondary)" }}>You&apos;re not watching anything yet. Try: &quot;Tell me when Apple releases a new MacBook&quot;.</p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <p style={{ color: "var(--text-secondary)", marginBottom: "4px" }}>You&apos;re watching {subs.subscriptions.length} release{subs.subscriptions.length > 1 ? "s" : ""}:</p>
                            {subs.subscriptions.map((sub) => {
                              const meta = WATCH_CATEGORY_META[sub.watch_category];
                              return (
                                <div key={sub.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--card)", borderRadius: "8px", padding: "8px 12px" }}>
                                  <span style={{ color: "var(--text-primary)" }}>{meta.emoji} {sub.label}</span>
                                  <button
                                    onClick={() => subs.removeSubscription({ action: "unsubscribe", watch_category: sub.watch_category, brands: sub.brands, keywords: sub.keywords, label: sub.label, category: "subscription" })}
                                    style={{ fontSize: "11px", color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}
                                  >
                                    Remove
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
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

                {/* Hotel date picker trigger */}
                {chat.resultCategory === "hotel" && (
                  <button
                    onClick={() => setDatePickerOpen(true)}
                    style={{
                      alignSelf: "flex-start",
                      padding: "6px 14px",
                      borderRadius: "20px",
                      border: "0.5px solid var(--gold)",
                      backgroundColor: "transparent",
                      color: "var(--gold)",
                      fontFamily: "var(--font-dm-sans)",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    📅 {hotelDates ? `${hotelDates.checkIn} → ${hotelDates.checkOut}` : "Select dates"}
                  </button>
                )}

                {/* Filter / View Bar */}
                {filterViewBar}

                {/* 3c-3: Post-experience feedback prompts */}
                {pendingFeedbackPrompts.map((prompt) => (
                  <FeedbackPromptCard
                    key={prompt.id}
                    promptId={prompt.id}
                    planId={prompt.plan_id}
                    sessionId={chat.getSessionId()}
                    venueName={prompt.venue_name}
                    scenario={prompt.scenario}
                    onDismiss={() =>
                      setPendingFeedbackPrompts((prev) =>
                        prev.filter((p) => p.id !== prompt.id)
                      )
                    }
                    onRespond={handleFeedbackResponse}
                  />
                ))}

                {/* Scenario Plan Results */}
                {chat.resultMode === "scenario_plan" && chat.decisionPlan && (
                  <ScenarioPlanView
                    plan={chat.decisionPlan}
                    planFeedbackMessage={planFeedbackMessage}
                    onAction={handlePlanAction}
                    onLinkClick={handlePlanLinkClick}
                    trackDecisionPlanEvent={chat.trackDecisionPlanEvent}
                    swapDecisionPlanOption={chat.swapDecisionPlanOption}
                    setPlanFeedbackMessage={setPlanFeedbackMessage}
                    lastUserQuery={lastUserQuery}
                  />
                )}

                {/* List View */}
                {chat.resultMode === "category_cards" && chat.displayCards.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {chat.displayCards.map((card, i) => (
                      <RecommendationCard
                        key={card.restaurant?.id ?? i}
                        card={card}
                        index={i}
                        isFavorite={favorites.has(card.restaurant?.id ?? "")}
                        onToggleFavorite={() => {
                          const isAdding = !favorites.has(card.restaurant?.id ?? "");
                          toggleFavorite(card.restaurant?.id ?? "", card);
                          // Phase 5.3: Show upgrade prompt after 3rd favorite
                          if (isAdding && !auth.isSignedIn && !upgradePromptShown) {
                            const newCount = favorites.size + 1;
                            if (newCount >= 3) setUpgradePromptShown(true);
                          }
                        }}
                        nearLocationLabel={location.nearLocation || undefined}
                        currentQuery={lastUserQuery}
                        onCompare={() => {
                          toggleCompare(card);
                          setCompareOpen(true);
                        }}
                        isComparing={isComparing(card)}
                      />
                    ))}
                  </div>
                )}

                {/* Hotel Results */}
                {chat.resultCategory === "hotel" && chat.allHotelCards.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {chat.allHotelCards.map((card, i) => (
                      <HotelCard key={card.hotel.id} card={card} index={i} />
                    ))}
                  </div>
                )}

                {/* Flight Results */}
                {chat.resultCategory === "flight" && chat.allFlightCards.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {chat.allFlightCards.map((card, i) => (
                      <FlightCard key={card.flight.id} card={card} index={i} />
                    ))}
                  </div>
                )}

                {/* Credit Card Results */}
                {chat.resultCategory === "credit_card" && chat.allCreditCardCards.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-dm-sans)",
                        padding: "0 2px 4px",
                      }}
                    >
                      Ranked by annual net gain vs your current card portfolio · Rates as of last verification date
                    </div>
                    {chat.allCreditCardCards.map((card, i) => (
                      <CreditCardCard key={card.card.id} card={card} index={i} />
                    ))}
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-dm-sans)",
                        padding: "4px 2px 0",
                        fontStyle: "italic",
                      }}
                    >
                      This tool provides information for reference only and does not constitute financial advice. Confirm current terms at the issuer&apos;s website before applying.
                    </div>
                  </div>
                )}

                {/* Laptop Results */}
                {chat.resultCategory === "laptop" && chat.allLaptopCards.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-dm-sans)",
                        padding: "0 2px 4px",
                      }}
                    >
                      Ranked by weighted signal score for your use case · Specs from Wirecutter, NotebookCheck, The Verge · Prices are MSRP
                    </div>
                    {chat.laptopDbGapWarning && (
                      <div
                        style={{
                          background: "var(--card)",
                          border: "1px solid #E8A020",
                          borderLeft: "3px solid #E8A020",
                          borderRadius: "8px",
                          padding: "10px 14px",
                          fontFamily: "var(--font-dm-sans)",
                          fontSize: "13px",
                          color: "var(--text-primary)",
                          lineHeight: "1.5",
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "#E8A020", marginRight: "6px" }}>⚠ Data gap:</span>
                        {chat.laptopDbGapWarning}
                      </div>
                    )}
                    {chat.allLaptopCards.map((card, i) => (
                      <LaptopCard key={card.device.id} card={card} index={i} />
                    ))}
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-dm-sans)",
                        padding: "4px 2px 0",
                        fontStyle: "italic",
                      }}
                    >
                      Recommendations are based on static review data and may not reflect the latest models or price changes. Always verify specs and pricing before purchase.
                    </div>
                  </div>
                )}

                {/* Smartphone Results */}
                {chat.resultCategory === "smartphone" && chat.allSmartphoneCards.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-dm-sans)",
                        padding: "0 2px 4px",
                      }}
                    >
                      Ranked by weighted signal score for your use case · Data from GSMA, GSMArena, The Verge · Prices are MSRP
                    </div>
                    {chat.deviceDbGapWarning && (
                      <div
                        style={{
                          background: "var(--card)",
                          border: "1px solid #E8A020",
                          borderLeft: "3px solid #E8A020",
                          borderRadius: "8px",
                          padding: "10px 14px",
                          fontFamily: "var(--font-dm-sans)",
                          fontSize: "13px",
                          color: "var(--text-primary)",
                          lineHeight: "1.5",
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "#E8A020", marginRight: "6px" }}>⚠ Data gap:</span>
                        {chat.deviceDbGapWarning}
                      </div>
                    )}
                    {chat.allSmartphoneCards.map((card, i) => (
                      <SmartphoneCard key={card.device.id} card={card} index={i} />
                    ))}
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-dm-sans)",
                        padding: "4px 2px 0",
                        fontStyle: "italic",
                      }}
                    >
                      Recommendations are based on static review data and may not reflect the latest models or price changes. Always verify specs and pricing before purchase.
                    </div>
                  </div>
                )}

                {/* Headphone Results */}
                {chat.resultCategory === "headphone" && chat.allHeadphoneCards.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-dm-sans)",
                        padding: "0 2px 4px",
                      }}
                    >
                      Ranked by weighted signal score for your use case · Data from Rtings, The Verge, SoundGuys · Prices are MSRP
                    </div>
                    {chat.deviceDbGapWarning && (
                      <div
                        style={{
                          background: "var(--card)",
                          border: "1px solid #E8A020",
                          borderLeft: "3px solid #E8A020",
                          borderRadius: "8px",
                          padding: "10px 14px",
                          fontFamily: "var(--font-dm-sans)",
                          fontSize: "13px",
                          color: "var(--text-primary)",
                          lineHeight: "1.5",
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "#E8A020", marginRight: "6px" }}>⚠ Data gap:</span>
                        {chat.deviceDbGapWarning}
                      </div>
                    )}
                    {chat.allHeadphoneCards.map((card, i) => (
                      <HeadphoneCard key={card.device.id} card={card} index={i} />
                    ))}
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-dm-sans)",
                        padding: "4px 2px 0",
                        fontStyle: "italic",
                      }}
                    >
                      Recommendations are based on static review data and may not reflect the latest models or price changes. Always verify specs and pricing before purchase.
                    </div>
                  </div>
                )}

                {/* Degraded empty-filter state */}
                {chat.resultMode === "category_cards" &&
                  chat.visibleCards.length > 0 &&
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
            value={isListening ? "" : chat.input}
            onChange={(e) => updateChatInput(e.target.value)}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={(e) => {
              isComposingRef.current = false;
              updateChatInput(e.currentTarget.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (isComposingRef.current || e.nativeEvent.isComposing) {
                  return;
                }
                chatInputRef.current = e.currentTarget.value;
                e.preventDefault();
                sendCurrentInput();
              }
            }}
            placeholder={
              isListening
                ? "正在聆听..."
                : hasMessages
                ? "Refine: 'more quiet', 'cheaper options'..."
                : "Describe what you're looking for..."
            }
            aria-label="Search for restaurants"
            className="flex-1 outline-none px-4 py-2.5"
            style={{
              backgroundColor: "var(--bg)",
              border: `0.5px solid ${isListening ? "var(--gold)" : "var(--border)"}`,
              borderRadius: "24px",
              color: "var(--text-primary)",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              transition: "border-color 0.2s",
            }}
            disabled={chat.loading || isListening}
          />
          {/* Phase 5.2: Mic button — hidden when voice not supported */}
          {voiceSupported && (
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={chat.loading}
              aria-label={isListening ? "Stop listening" : "Start voice input"}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                backgroundColor: isListening ? "var(--gold)" : "var(--text-primary)",
                color: isListening ? "#fff" : "var(--gold)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: "none",
                cursor: chat.loading ? "not-allowed" : "pointer",
                opacity: chat.loading ? 0.4 : 1,
                transition: "background-color 0.2s, transform 0.2s",
                transform: isListening ? "scale(1.08)" : "scale(1)",
                boxShadow: isListening ? "0 0 0 4px rgba(201,168,76,0.25)" : "none",
              }}
            >
              {isListening ? (
                // Animated pulse when listening
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="9" y="2" width="6" height="14" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="9" y="2" width="6" height="14" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          )}
          <button
            onClick={sendCurrentInput}
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

      {/* Date Range Picker for hotel searches */}
      {datePickerOpen && (
        <DateRangePicker
          checkIn={hotelDates?.checkIn}
          checkOut={hotelDates?.checkOut}
          onSelect={(checkIn, checkOut) => {
            setHotelDates({ checkIn, checkOut });
            const dateText = `Check in ${checkIn}, check out ${checkOut}`;
            chat.sendMessage(dateText);
          }}
          onClose={() => setDatePickerOpen(false)}
        />
      )}
    </main>
  );
}
