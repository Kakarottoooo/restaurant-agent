"use client";

import { FlightRecommendationCard } from "@/lib/types";

interface FlightCardProps {
  card: FlightRecommendationCard;
  index: number;
}

function PlaneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.45 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function formatTime(timeStr: string): string {
  if (!timeStr) return "—";
  // SerpApi returns "2024-11-15 08:30" format — extract time portion
  const match = timeStr.match(/(\d{1,2}:\d{2})\s*(AM|PM)?/i);
  if (match) return match[0];
  // If it contains a date+time, take the last part
  const parts = timeStr.split(" ");
  if (parts.length >= 2) return parts[parts.length - 1];
  return timeStr;
}

const GROUP_LABEL: Record<FlightRecommendationCard["group"], string> = {
  direct: "Nonstop",
  one_stop: "1 Stop",
  two_stop: "2 Stops",
};

const GROUP_COLOR: Record<FlightRecommendationCard["group"], string> = {
  direct: "#2D6A4F",   // green
  one_stop: "#8B5E14", // amber
  two_stop: "#7B3F00", // brown
};

export default function FlightCard({ card, index }: FlightCardProps) {
  const { flight, group, why_recommended } = card;

  const departureTime = formatTime(flight.departure_time);
  const arrivalTime = formatTime(flight.arrival_time);

  return (
    <div
      style={{
        background: "var(--card)",
        borderRadius: 16,
        border: "0.5px solid var(--border)",
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 16px 10px",
          borderBottom: "0.5px solid var(--border)",
        }}
      >
        {/* Rank badge */}
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "var(--text-primary)",
            color: "var(--bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {index + 1}
        </div>

        {/* Airline logo or icon */}
        {flight.airline_logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={flight.airline_logo}
            alt={flight.airline}
            style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 4 }}
          />
        ) : (
          <div style={{ color: "var(--gold)", flexShrink: 0 }}>
            <PlaneIcon />
          </div>
        )}

        {/* Airline name + flight number */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {flight.airline}
            {flight.flight_number && (
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  fontWeight: 400,
                  color: "var(--text-secondary)",
                  marginLeft: 6,
                }}
              >
                {flight.flight_number}
              </span>
            )}
          </div>
        </div>

        {/* Stop badge */}
        <div
          style={{
            padding: "3px 9px",
            borderRadius: 20,
            border: `1px solid ${GROUP_COLOR[group]}`,
            color: GROUP_COLOR[group],
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {GROUP_LABEL[group]}
        </div>
      </div>

      {/* Route row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "14px 16px",
        }}
      >
        {/* Departure */}
        <div style={{ textAlign: "center", minWidth: 64 }}>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 22,
              fontWeight: 700,
              color: "var(--text-primary)",
              lineHeight: 1.1,
            }}
          >
            {departureTime}
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--gold)",
              marginTop: 2,
            }}
          >
            {flight.departure_airport}
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              color: "var(--text-secondary)",
              marginTop: 1,
              maxWidth: 72,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {flight.departure_city.split("(")[0].trim()}
          </div>
        </div>

        {/* Duration line */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              color: "var(--text-secondary)",
            }}
          >
            {flight.duration}
          </div>
          <div
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--gold)">
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
            </svg>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>
          {flight.stops > 0 && flight.layover_city && (
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 10,
                color: "var(--text-secondary)",
                textAlign: "center",
              }}
            >
              via {flight.layover_city}
              {flight.layover_duration && ` · ${flight.layover_duration}`}
            </div>
          )}
        </div>

        {/* Arrival */}
        <div style={{ textAlign: "center", minWidth: 64 }}>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 22,
              fontWeight: 700,
              color: "var(--text-primary)",
              lineHeight: 1.1,
            }}
          >
            {arrivalTime}
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--gold)",
              marginTop: 2,
            }}
          >
            {flight.arrival_airport}
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              color: "var(--text-secondary)",
              marginTop: 1,
              maxWidth: 72,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {flight.arrival_city.split("(")[0].trim()}
          </div>
        </div>
      </div>

      {/* Why recommended */}
      {why_recommended && (
        <div
          style={{
            margin: "0 16px",
            padding: "8px 12px",
            background: "var(--card-2)",
            borderLeft: "3px solid var(--gold)",
            borderRadius: "0 6px 6px 0",
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {why_recommended}
        </div>
      )}

      {/* Footer: price + book button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderTop: "0.5px solid var(--border)",
          marginTop: 12,
        }}
      >
        <div>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 20,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {flight.price > 0 ? `$${flight.price}` : "—"}
          </span>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              color: "var(--text-secondary)",
              marginLeft: 4,
            }}
          >
            /person
          </span>
        </div>

        <a
          href={flight.booking_link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "8px 16px",
            background: "var(--gold)",
            color: "#fff",
            borderRadius: 8,
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Book on Google Flights →
        </a>
      </div>
    </div>
  );
}
