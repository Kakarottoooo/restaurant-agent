"use client";

import { useAuthState } from "@/app/contexts/AuthContext";
import { UserPreferenceProfile, RecommendationCard, FeedbackRecord } from "@/lib/types";

/**
 * Migrates localStorage data to cloud after sign-in.
 * Called once after the user authenticates.
 */
async function migrateLocalDataToCloud() {
  try {
    const localProfile = localStorage.getItem("restaurant-preference-profile");
    const localFavoritesRaw = localStorage.getItem("restaurant-favorites");
    const localFeedbackRaw = localStorage.getItem("restaurant-feedback");

    const migrations: Promise<Response>[] = [];

    if (localProfile) {
      const profile: UserPreferenceProfile = JSON.parse(localProfile);
      migrations.push(
        fetch("/api/user/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile }),
        })
      );
    }

    if (localFavoritesRaw) {
      // Try to find the full card data stored separately
      const localCardsRaw = localStorage.getItem("restaurant-favorite-cards");
      if (localCardsRaw) {
        const cards: RecommendationCard[] = JSON.parse(localCardsRaw);
        if (cards.length > 0) {
          migrations.push(
            fetch("/api/user/favorites", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ bulk: cards }),
            })
          );
        }
      }
    }

    if (localFeedbackRaw) {
      const feedback: FeedbackRecord[] = JSON.parse(localFeedbackRaw);
      if (feedback.length > 0) {
        migrations.push(
          fetch("/api/user/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bulk: feedback }),
          })
        );
      }
    }

    await Promise.all(migrations);

    // Clear local storage after successful cloud migration
    if (migrations.length > 0) {
      localStorage.removeItem("restaurant-preference-profile");
      localStorage.removeItem("restaurant-favorites");
      localStorage.removeItem("restaurant-favorite-cards");
      localStorage.removeItem("restaurant-feedback");
    }
  } catch {
    // Migration failure is non-fatal — user data stays in localStorage
  }
}

/**
 * Auth hook — safe to call anywhere, never throws.
 * When Clerk is not configured, returns isSignedIn: false with no-op handlers.
 */
export function useAuth() {
  const auth = useAuthState();
  return {
    ...auth,
    migrateLocalDataToCloud,
  };
}
