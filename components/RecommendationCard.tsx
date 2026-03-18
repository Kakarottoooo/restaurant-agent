"use client";

import { RecommendationCard as CardType } from "@/lib/types";

interface Props {
  card: CardType;
  index: number;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export default function RecommendationCard({ card, index, isFavorite, onToggleFavorite }: Props) {
  const { restaurant: r } = card;

  return (
    <div
      className="animate-fadeIn overflow-hidden"
      style={{
        backgroundColor: "var(--card)",
        borderRadius: "16px",
        border: "0.5px solid var(--border)",
      }}
    >
      {/* Image */}
      {r.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.image_url} alt={r.name} className="w-full object-cover" style={{ height: "180px" }} />
      ) : (
        <div className="w-full flex items-center justify-center" style={{ height: "180px", backgroundColor: "var(--card-2)" }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity={0.25}>
            <path d="M8 40V16l16-8 16 8v24H8z" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M18 40v-12h12v12" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="24" cy="22" r="3" stroke="var(--text-secondary)" strokeWidth="1.5" />
          </svg>
        </div>
      )}

      <div style={{ padding: "16px" }}>
        {/* Card Header: rank badge + name + rating + favorite */}
        <div className="flex items-start gap-3 mb-2">
          {/* Rank badge */}
          <div className="flex-shrink-0 flex items-center justify-center" style={{
            width: "26px",
            height: "26px",
            borderRadius: "50%",
            backgroundColor: "var(--text-primary)",
            color: "var(--bg)",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "12px",
            fontWeight: 600,
            marginTop: "2px",
          }}>
            {index + 1}
          </div>

          <div className="flex-1 min-w-0">
            <h3 style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1.2,
            }}>
              {r.name}
            </h3>
          </div>

          {/* Rating + Favorite */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--gold)",
            }}>
              ★ {r.rating}
            </span>
            {onToggleFavorite && (
              <button
                onClick={onToggleFavorite}
                aria-label={isFavorite ? "Remove from favorites" : "Save to favorites"}
                className="transition-transform hover:scale-110 active:scale-95"
                style={{ fontSize: "16px", lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
              >
                {isFavorite ? "❤️" : "🤍"}
              </button>
            )}
          </div>
        </div>

        {/* Cuisine + price */}
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "4px" }}>
          {r.cuisine} &middot; {r.price}
        </p>

        {/* Address */}
        <p className="truncate" style={{ fontFamily: "var(--font-dm-sans)", fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
          {r.address}
        </p>

        {/* Gold divider */}
        <div style={{ width: "32px", height: "2px", backgroundColor: "var(--gold)", marginBottom: "12px" }} />

        {/* Description */}
        {r.description && (
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "13px", color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.5, marginBottom: "12px" }}>
            {r.description}
          </p>
        )}

        {/* Why it fits */}
        <div style={{
          backgroundColor: "var(--card-2)",
          borderLeft: "3px solid var(--gold)",
          borderRadius: "0 8px 8px 0",
          padding: "10px 12px",
          marginBottom: "10px",
        }}>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "12px", fontWeight: 500, color: "#8B6914", marginBottom: "4px" }}>
            Why it fits
          </p>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "13px", color: "#4A3F2F", lineHeight: 1.5 }}>
            {card.why_recommended}
          </p>
        </div>

        {/* Watch out */}
        {card.watch_out && (
          <div style={{
            backgroundColor: "#FDF6EC",
            borderLeft: "3px solid var(--amber)",
            borderRadius: "0 8px 8px 0",
            padding: "10px 12px",
            marginBottom: "10px",
          }}>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "12px", fontWeight: 500, color: "#8B5E14", marginBottom: "4px" }}>
              Watch out
            </p>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "13px", color: "#6B4A1A", lineHeight: 1.5 }}>
              {card.watch_out}
            </p>
          </div>
        )}

        {/* Skip if */}
        {card.not_great_if && (
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "12px", color: "var(--text-muted)", marginBottom: "10px", lineHeight: 1.5 }}>
            <span style={{ fontWeight: 500 }}>Skip if:</span> {card.not_great_if}
          </p>
        )}

        {/* Card footer */}
        <div className="flex items-center justify-between" style={{ borderTop: "0.5px solid var(--border)", paddingTop: "12px", marginTop: "4px" }}>
          <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
            Est. {card.estimated_total}
          </span>
          <div className="flex gap-2">
            {r.url && (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  border: "0.5px solid var(--border)",
                  borderRadius: "8px",
                  padding: "7px 14px",
                  textDecoration: "none",
                  display: "inline-block",
                  backgroundColor: "transparent",
                }}
              >
                Map
              </a>
            )}
            {card.opentable_url && (
              <a
                href={card.opentable_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "13px",
                  color: "#fff",
                  backgroundColor: "var(--gold)",
                  borderRadius: "8px",
                  padding: "7px 14px",
                  textDecoration: "none",
                  display: "inline-block",
                }}
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
