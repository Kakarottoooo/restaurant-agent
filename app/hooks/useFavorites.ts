"use client";

import { useState, useEffect } from "react";
import { RecommendationCard } from "@/lib/types";
import { useAuthState } from "@/app/contexts/AuthContext";

type LearnFromFavorite = (card: RecommendationCard) => void;

export function useFavorites(learnFromFavorite?: LearnFromFavorite) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const { isSignedIn } = useAuthState();

  useEffect(() => {
    if (isSignedIn) {
      // Load favorites from cloud
      fetch("/api/user/favorites")
        .then((r) => r.json())
        .then((data) => {
          if (data.favorites) {
            const ids = new Set<string>(data.favorites.map((f: { restaurant_id: string }) => f.restaurant_id));
            setFavorites(ids);
            // Keep local cache in sync
            localStorage.setItem("restaurant-favorites", JSON.stringify([...ids]));
          }
        })
        .catch(() => {
          // Fall back to local
          try {
            const saved = localStorage.getItem("restaurant-favorites");
            if (saved) setFavorites(new Set(JSON.parse(saved)));
          } catch {}
        });
    } else {
      try {
        const saved = localStorage.getItem("restaurant-favorites");
        if (saved) setFavorites(new Set(JSON.parse(saved)));
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  function toggleFavorite(restaurantId: string, card?: RecommendationCard) {
    setFavorites((prev) => {
      const next = new Set(prev);
      const isAdding = !next.has(restaurantId);

      if (isAdding) {
        next.add(restaurantId);
        if (card && learnFromFavorite) learnFromFavorite(card);
        // Cloud sync when signed in
        if (isSignedIn && card) {
          fetch("/api/user/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ card }),
          }).catch(() => {});
        }
      } else {
        next.delete(restaurantId);
        // Cloud sync when signed in
        if (isSignedIn) {
          fetch("/api/user/favorites", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restaurant_id: restaurantId }),
          }).catch(() => {});
        }
      }

      try {
        localStorage.setItem("restaurant-favorites", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  return { favorites, toggleFavorite };
}
