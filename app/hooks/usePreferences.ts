"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPreferenceProfile, RecommendationCard, FeedbackRecord, LearnedWeights } from "@/lib/types";
import { useAuthState } from "@/app/contexts/AuthContext";

const STORAGE_KEY = "restaurant-preference-profile";
const FEEDBACK_KEY = "restaurant-feedback";
const LEARNED_WEIGHTS_KEY = "restaurant-learned-weights";

const DEFAULT_LEARNED_WEIGHTS: Omit<LearnedWeights, "updated_at" | "sample_size"> = {
  budget_match: 0.25,
  scene_match: 0.30,
  review_quality: 0.20,
  location_convenience: 0.15,
  preference_match: 0.10,
};

const DEFAULT_PROFILE: UserPreferenceProfile = {
  version: 1,
  updated_at: new Date().toISOString(),
  dietary_restrictions: [],
  cuisine_dislikes: [],
  always_exclude_chains: false,
  preferred_occasions: [],
  dislike_tourist_traps: false,
  recent_search_keywords: [],
  favorite_signals: [],
};

function loadProfile(): UserPreferenceProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    // Merge with defaults to handle schema evolution
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

function saveProfile(profile: UserPreferenceProfile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {}
}

export function formatProfileForPrompt(profile: UserPreferenceProfile): string {
  const parts: string[] = [];
  if (profile.noise_preference) parts.push(`prefers ${profile.noise_preference} restaurants`);
  if (profile.typical_budget_per_person)
    parts.push(`typical budget $${profile.typical_budget_per_person}/person`);
  if (profile.dietary_restrictions.length > 0)
    parts.push(profile.dietary_restrictions.join(", "));
  if (profile.always_exclude_chains) parts.push("excludes chains");
  if (profile.dislike_tourist_traps) parts.push("dislikes tourist traps");
  if (profile.preferred_occasions.length > 0)
    parts.push(`frequently searches for ${profile.preferred_occasions.join(", ")} options`);
  if (profile.favorite_signals.length > 0) {
    const recent = profile.favorite_signals.slice(0, 3);
    parts.push(
      `Recent favorites: ${recent.map((s) => `${s.cuisine} (${s.price})`).join(", ")}`
    );
  }
  return parts.length > 0
    ? `User preference profile: ${parts.join(", ")}.`
    : "";
}

// Sync profile to cloud (fire-and-forget)
function syncProfileToCloud(profile: UserPreferenceProfile) {
  fetch("/api/user/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  }).catch(() => {});
}

export function usePreferences() {
  const [profile, setProfile] = useState<UserPreferenceProfile>(DEFAULT_PROFILE);
  const [learnedWeights, setLearnedWeights] = useState<LearnedWeights | null>(null);
  const { isSignedIn } = useAuthState();

  useEffect(() => {
    // If signed in, try to load profile from cloud; fall back to localStorage
    if (isSignedIn) {
      fetch("/api/user/profile")
        .then((r) => r.json())
        .then((data) => {
          if (data.profile) {
            const merged = { ...DEFAULT_PROFILE, ...data.profile };
            setProfile(merged);
            saveProfile(merged); // keep local cache in sync
          } else {
            setProfile(loadProfile());
          }
        })
        .catch(() => setProfile(loadProfile()));
    } else {
      setProfile(loadProfile());
    }
    try {
      const raw = localStorage.getItem(LEARNED_WEIGHTS_KEY);
      if (raw) {
        const parsed: LearnedWeights = JSON.parse(raw);
        setLearnedWeights(parsed);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  const updateProfile = useCallback((patch: Partial<UserPreferenceProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch, updated_at: new Date().toISOString() };
      saveProfile(next);
      if (isSignedIn) syncProfileToCloud(next);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  const learnFromFavorite = useCallback((card: RecommendationCard) => {
    setProfile((prev) => {
      const signal = {
        cuisine: card.restaurant.cuisine,
        price: card.restaurant.price,
        purpose: card.best_for,
        saved_at: new Date().toISOString(),
      };
      const next: UserPreferenceProfile = {
        ...prev,
        updated_at: new Date().toISOString(),
        favorite_signals: [signal, ...prev.favorite_signals].slice(0, 20),
      };
      saveProfile(next);
      if (isSignedIn) syncProfileToCloud(next);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  const learnFromSearch = useCallback((query: string) => {
    setProfile((prev) => {
      const keywords = query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      const next: UserPreferenceProfile = {
        ...prev,
        updated_at: new Date().toISOString(),
        recent_search_keywords: [...keywords, ...prev.recent_search_keywords].slice(0, 20),
      };
      saveProfile(next);
      return next;
    });
  }, []);

  // Process feedback records and update preference signals
  const learnFromFeedback = useCallback((feedback: FeedbackRecord) => {
    if (feedback.satisfied) return;
    setProfile((prev) => {
      const patch: Partial<UserPreferenceProfile> = {};
      const issues = feedback.issues ?? [];

      if (issues.includes("比描述的吵")) {
        patch.noise_preference = "quiet";
      }
      if (issues.includes("价格偏高") && prev.typical_budget_per_person) {
        patch.typical_budget_per_person = Math.round(
          prev.typical_budget_per_person * 0.7
        );
      }

      const next = {
        ...prev,
        ...patch,
        updated_at: new Date().toISOString(),
      };
      saveProfile(next);
      return next;
    });
  }, []);

  const resetProfile = useCallback(() => {
    const fresh = { ...DEFAULT_PROFILE, updated_at: new Date().toISOString() };
    saveProfile(fresh);
    setProfile(fresh);
  }, []);

  const learnWeightsFromFeedback = useCallback(() => {
    try {
      const raw = localStorage.getItem(FEEDBACK_KEY);
      if (!raw) return;
      const records: FeedbackRecord[] = JSON.parse(raw);
      if (records.length < 10) return;

      // Count unsatisfied issue patterns
      const unsatisfied = records.filter((r) => !r.satisfied && r.issues?.length);
      const issueCounts: Record<string, number> = {};
      for (const rec of unsatisfied) {
        for (const issue of rec.issues ?? []) {
          issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
        }
      }

      // Start from default weights
      const weights = { ...DEFAULT_LEARNED_WEIGHTS };

      // Adjust weights based on feedback issues
      if (issueCounts["氛围不符"]) weights.scene_match += 0.05;
      if (issueCounts["价格偏高"]) weights.budget_match += 0.05;
      if (issueCounts["等位太久"]) weights.review_quality += 0.05;

      // Normalize to sum to 1.0
      const total = Object.values(weights).reduce((sum, v) => sum + v, 0);
      const normalized = {
        budget_match: weights.budget_match / total,
        scene_match: weights.scene_match / total,
        review_quality: weights.review_quality / total,
        location_convenience: weights.location_convenience / total,
        preference_match: weights.preference_match / total,
      };

      const newLearnedWeights: LearnedWeights = {
        ...normalized,
        updated_at: new Date().toISOString(),
        sample_size: records.length,
      };

      localStorage.setItem(LEARNED_WEIGHTS_KEY, JSON.stringify(newLearnedWeights));
      setLearnedWeights(newLearnedWeights);
    } catch {}
  }, []);

  // Load and process any unprocessed feedback on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FEEDBACK_KEY);
      if (!raw) return;
      const records: FeedbackRecord[] = JSON.parse(raw);
      const unsatisfied = records.filter((r) => !r.satisfied && r.issues?.length);
      if (unsatisfied.length >= 3) {
        // Auto-learn from repeated dissatisfaction
        for (const rec of unsatisfied.slice(0, 5)) {
          learnFromFeedback(rec);
        }
      }
    } catch {}
  }, [learnFromFeedback]);

  return {
    profile,
    updateProfile,
    learnFromFavorite,
    learnFromSearch,
    learnFromFeedback,
    resetProfile,
    learnedWeights,
    learnWeightsFromFeedback,
  };
}
