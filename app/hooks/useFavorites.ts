import { useState, useEffect } from "react";
import { RecommendationCard } from "@/lib/types";

type LearnFromFavorite = (card: RecommendationCard) => void;

export function useFavorites(learnFromFavorite?: LearnFromFavorite) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem("restaurant-favorites");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setFavorites(new Set(JSON.parse(saved)));
    } catch {}
  }, []);

  function toggleFavorite(restaurantId: string, card?: RecommendationCard) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(restaurantId)) {
        next.delete(restaurantId);
      } else {
        next.add(restaurantId);
        // Learn from new favorites
        if (card && learnFromFavorite) {
          learnFromFavorite(card);
        }
      }
      try {
        localStorage.setItem(
          "restaurant-favorites",
          JSON.stringify([...next])
        );
      } catch {}
      return next;
    });
  }

  return { favorites, toggleFavorite };
}
