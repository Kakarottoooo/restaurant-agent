"use client";

import { RecommendationCard as CardType } from "@/lib/types";

interface Props {
  card: CardType;
  index: number;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export default function RecommendationCard({
  card,
  index,
  isFavorite,
  onToggleFavorite,
}: Props) {
  const { restaurant: r } = card;

  const priceColor: Record<string, string> = {
    $: "text-green-600",
    $$: "text-yellow-600",
    $$$: "text-orange-600",
    $$$$: "text-red-600",
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn">
      {r.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={r.image_url}
          alt={r.name}
          className="w-full h-40 object-cover"
        />
      )}
      <div className="flex gap-4 p-4">
        {/* Rank badge */}
        <div className="flex-shrink-0 w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-bold">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                {r.name}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">{r.cuisine}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={`font-medium text-sm ${priceColor[r.price] ?? "text-gray-600"}`}
              >
                {r.price}
              </span>
              <span className="text-sm font-medium text-gray-700">
                ⭐ {r.rating}
              </span>
              {onToggleFavorite && (
                <button
                  onClick={onToggleFavorite}
                  aria-label={isFavorite ? "Remove from favorites" : "Save to favorites"}
                  className="text-lg leading-none transition-transform hover:scale-110 active:scale-95"
                >
                  {isFavorite ? "❤️" : "🤍"}
                </button>
              )}
            </div>
          </div>

          {/* Address */}
          <p className="text-xs text-gray-400 mt-1 truncate">{r.address}</p>

          {/* Description */}
          {r.description && (
            <p className="text-xs text-gray-500 mt-1 italic">{r.description}</p>
          )}

          {/* Why recommended */}
          <div className="mt-3 p-3 bg-green-50 rounded-xl">
            <p className="text-xs font-semibold text-green-700 mb-1">
              ✅ Why it fits
            </p>
            <p className="text-sm text-green-900">{card.why_recommended}</p>
          </div>

          {/* Best for */}
          <p className="text-xs text-gray-500 mt-2">
            <span className="font-medium">Best for:</span> {card.best_for}
          </p>

          {/* Watch out */}
          {card.watch_out && (
            <div className="mt-2 p-2.5 bg-amber-50 rounded-xl">
              <p className="text-xs font-semibold text-amber-700 mb-0.5">
                ⚠️ Watch out
              </p>
              <p className="text-xs text-amber-900">{card.watch_out}</p>
            </div>
          )}

          {/* Not great if */}
          {card.not_great_if && (
            <p className="text-xs text-gray-400 mt-2">
              <span className="font-medium">Skip if:</span> {card.not_great_if}
            </p>
          )}

          {/* Price estimate */}
          <p className="text-xs text-gray-500 mt-2">
            <span className="font-medium">Est. total:</span>{" "}
            {card.estimated_total}
          </p>

          {/* Actions */}
          <div className="flex gap-2 mt-3">
            {r.url && (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center text-xs bg-gray-900 text-white py-2 px-3 rounded-xl hover:bg-gray-700 transition-colors"
              >
                Visit Website
              </a>
            )}
            {card.opentable_url && (
              <a
                href={card.opentable_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center text-xs bg-orange-500 text-white py-2 px-3 rounded-xl hover:bg-orange-400 transition-colors"
              >
                Reserve →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
