"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HotelRecommendationCard } from "@/lib/types";
import ProfilePicker from "./ProfilePicker";

interface HotelCardProps {
  card: HotelRecommendationCard;
  index: number;
}

export default function HotelCard({ card, index }: HotelCardProps) {
  const { hotel } = card;
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [booking, setBooking] = useState(false);

  function handleBook() {
    if (booking) return;
    setShowPicker(true);
  }

  async function proceedWithProfile(profileId: number) {
    setShowPicker(false);
    setBooking(true);
    // Remember this as the active profile for future bookings
    localStorage.setItem("active_profile_id", String(profileId));
    try {
      const sessionId = localStorage.getItem("session_id") ?? crypto.randomUUID();
      const savedModel = JSON.parse(localStorage.getItem("agent_model_config") ?? "{}");
      const agentModel = savedModel.model && savedModel.apiKey ? savedModel : undefined;
      const step = {
        type: "universal",
        emoji: "🏨",
        label: hotel.name,
        apiEndpoint: "/api/booking-autopilot/universal",
        body: {
          startUrl: hotel.booking_link,
          task: `Book a room at ${hotel.name}. Select the best available option and stop at the payment page without completing payment.`,
          profileId,
          agentModel,
        },
        fallbackUrl: hotel.booking_link,
        status: "pending",
      };
      const createRes = await fetch("/api/booking-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, trip_label: hotel.name, steps: [step] }),
      });
      if (createRes.ok) {
        const { jobId } = await createRes.json();
        fetch(`/api/booking-jobs/${jobId}/start`, { method: "POST" }).catch(() => {});
        router.push("/tasks");
      }
    } finally {
      setBooking(false);
    }
  }

  return (
    <>
    {showPicker && (
      <ProfilePicker
        onSelect={proceedWithProfile}
        onCancel={() => setShowPicker(false)}
      />
    )}
    <div
      style={{
        backgroundColor: "var(--card)",
        borderRadius: "16px",
        border: "0.5px solid var(--border)",
        overflow: "hidden",
        opacity: 1,
        transform: "translateY(0)",
        transition: "opacity 0.3s ease, transform 0.3s ease",
      }}
    >
      {/* Image */}
      {hotel.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hotel.thumbnail}
          alt={hotel.name}
          style={{
            width: "100%",
            height: "180px",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "180px",
            backgroundColor: "var(--bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="8" y="16" width="32" height="24" rx="2" stroke="var(--border)" strokeWidth="1.5" />
            <rect x="14" y="22" width="6" height="6" rx="1" stroke="var(--border)" strokeWidth="1.5" />
            <rect x="28" y="22" width="6" height="6" rx="1" stroke="var(--border)" strokeWidth="1.5" />
            <rect x="20" y="30" width="8" height="10" rx="1" stroke="var(--border)" strokeWidth="1.5" />
            <path d="M4 16 L24 6 L44 16" stroke="var(--border)" strokeWidth="1.5" />
          </svg>
        </div>
      )}

      <div style={{ padding: "16px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "6px" }}>
          {/* Rank badge */}
          <div
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              backgroundColor: "var(--text-primary)",
              color: "var(--bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "11px",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {index + 1}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "18px",
                fontWeight: 600,
                color: "var(--text-primary)",
                lineHeight: 1.3,
                marginBottom: "2px",
              }}
            >
              {hotel.name}
            </h3>
            {/* Stars + Rating */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "13px", color: "var(--gold)" }}>
                {"★".repeat(Math.min(5, Math.max(1, Math.round(hotel.star_rating))))}
                {"☆".repeat(Math.max(0, 5 - Math.min(5, Math.max(1, Math.round(hotel.star_rating)))))}
              </span>
              {hotel.rating > 0 && (
                <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "13px", color: "var(--gold)" }}>
                  ⭐ {hotel.rating.toFixed(1)}
                  {hotel.review_count > 0 && (
                    <span style={{ color: "var(--text-secondary)" }}> ({hotel.review_count.toLocaleString()})</span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Location */}
        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: "12px",
            color: "var(--text-secondary)",
            marginBottom: "8px",
          }}
        >
          {card.location_summary || hotel.address}
        </p>

        {/* Price */}
        {hotel.price_per_night > 0 && (
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "12px",
            }}
          >
            ${hotel.price_per_night}/night
            {hotel.total_price > hotel.price_per_night && (
              <span style={{ fontSize: "13px", fontWeight: 400, color: "var(--text-secondary)" }}>
                {" "}· {card.price_summary}
              </span>
            )}
          </p>
        )}

        {/* Gold divider */}
        <div
          style={{
            width: "32px",
            height: "2px",
            backgroundColor: "var(--gold)",
            marginBottom: "12px",
          }}
        />

        {/* Why it fits */}
        {card.why_recommended && (
          <div
            style={{
              backgroundColor: "var(--card-2)",
              borderLeft: "3px solid var(--gold)",
              borderRadius: "0 8px 8px 0",
              padding: "10px 12px",
              marginBottom: "8px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "11px",
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Why it fits
            </p>
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "13px",
                color: "var(--text-primary)",
                lineHeight: 1.5,
              }}
            >
              {card.why_recommended}
            </p>
          </div>
        )}

        {/* Watch out */}
        {card.watch_out && (
          <div
            style={{
              backgroundColor: "#FDF6EC",
              borderLeft: "3px solid #E8A020",
              borderRadius: "0 8px 8px 0",
              padding: "10px 12px",
              marginBottom: "8px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "11px",
                fontWeight: 500,
                color: "#8B5E14",
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Watch out
            </p>
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "13px",
                color: "#6B4A1A",
                lineHeight: 1.5,
              }}
            >
              {card.watch_out}
            </p>
          </div>
        )}

        {/* Not great if */}
        {card.not_great_if && (
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "12px",
              color: "var(--text-secondary)",
              marginBottom: "12px",
              fontStyle: "italic",
            }}
          >
            Skip if: {card.not_great_if}
          </p>
        )}

        {/* Amenities */}
        {hotel.amenities.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
            {hotel.amenities.slice(0, 6).map((amenity) => (
              <span
                key={amenity}
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                  border: "0.5px solid var(--border)",
                  borderRadius: "12px",
                  padding: "2px 8px",
                }}
              >
                {amenity}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            borderTop: "0.5px solid var(--border)",
            paddingTop: "12px",
            display: "flex",
            gap: "8px",
          }}
        >
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel.name + " " + hotel.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              textAlign: "center",
              padding: "8px 0",
              borderRadius: "10px",
              border: "0.5px solid var(--border)",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              color: "var(--text-secondary)",
              textDecoration: "none",
            }}
          >
            Map
          </a>
          <button
            onClick={handleBook}
            disabled={booking}
            style={{
              flex: 2,
              textAlign: "center",
              padding: "8px 0",
              borderRadius: "10px",
              backgroundColor: booking ? "var(--border)" : "var(--gold)",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "13px",
              fontWeight: 500,
              color: "#fff",
              border: "none",
              cursor: booking ? "default" : "pointer",
              transition: "background-color 0.2s",
            }}
          >
            {booking ? "Starting agent…" : "Book with Agent →"}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
