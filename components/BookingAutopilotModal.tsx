"use client";

import { useState } from "react";
import type { AutopilotResult } from "../lib/booking-autopilot/types";

type AutopilotType = "restaurant" | "hotel" | "flight";

interface RestaurantParams {
  type: "restaurant";
  restaurant_name: string;
  city: string;
  date: string;
  time: string;
  covers: number;
}

interface HotelParams {
  type: "hotel";
  hotel_name: string;
  city: string;
  checkin: string;
  checkout: string;
  adults: number;
}

interface FlightParams {
  type: "flight";
  origin: string;
  dest: string;
  date: string;
  returnDate?: string;
  passengers?: number;
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  preferredAirline?: string;
}

type AutopilotParams = RestaurantParams | HotelParams | FlightParams;

interface Props {
  params: AutopilotParams;
  /** Label shown on the trigger button, e.g. "Book Nobu" */
  label: string;
  /** Fallback URL if autopilot fails or user dismisses */
  fallbackUrl: string;
}

type UIState = "idle" | "loading" | "ready" | "no_availability" | "error";

export function BookingAutopilotModal({ params, label, fallbackUrl }: Props) {
  const [state, setState] = useState<UIState>("idle");
  const [result, setResult] = useState<AutopilotResult | null>(null);
  const [open, setOpen] = useState(false);

  async function startAutopilot() {
    setOpen(true);
    setState("loading");
    setResult(null);

    const endpoint =
      params.type === "restaurant"
        ? "/api/booking-autopilot/restaurant"
        : params.type === "hotel"
        ? "/api/booking-autopilot/hotel"
        : "/api/booking-autopilot/flight";

    const body =
      params.type === "restaurant"
        ? {
            restaurant_name: params.restaurant_name,
            city: params.city,
            date: params.date,
            time: params.time,
            covers: params.covers,
          }
        : params.type === "hotel"
        ? {
            hotel_name: params.hotel_name,
            city: params.city,
            checkin: params.checkin,
            checkout: params.checkout,
            adults: params.adults,
          }
        : {
            origin: params.origin,
            dest: params.dest,
            date: params.date,
            returnDate: params.returnDate,
            passengers: params.passengers,
            cabinClass: params.cabinClass,
            preferredAirline: params.preferredAirline,
          };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: AutopilotResult = await res.json();
      setResult(data);
      setState(data.status === "ready" ? "ready" : data.status);
    } catch {
      setState("error");
      setResult({ status: "error", handoff_url: fallbackUrl, error: "Network error" });
    }
  }

  function close() {
    setOpen(false);
    setState("idle");
    setResult(null);
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={startAutopilot}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px",
          borderRadius: 8,
          border: "1.5px solid #d1d5db",
          background: "#fff",
          color: "#111",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        🤖 {label}
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 600,
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 15 }}>
                {state === "loading"
                  ? params.type === "flight"
                    ? "🤖 Finding cheapest non-stop…"
                    : "🤖 Navigating booking page…"
                  : "🤖 Booking Autopilot"}
              </span>
              <button
                onClick={close}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  color: "#888",
                  lineHeight: 1,
                  padding: "0 4px",
                }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {state === "loading" && <LoadingState type={params.type} />}

              {state === "ready" && result && (
                <ReadyState
                  result={result}
                  type={params.type}
                  onOpen={() => window.open(result.handoff_url, "_blank")}
                  onFallback={() => window.open(fallbackUrl, "_blank")}
                />
              )}

              {state === "no_availability" && result && (
                <NoAvailabilityState
                  result={result}
                  onFallback={() => window.open(fallbackUrl, "_blank")}
                />
              )}

              {state === "error" && result && (
                <ErrorState
                  result={result}
                  onFallback={() => window.open(fallbackUrl, "_blank")}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LoadingState({ type }: { type: AutopilotType }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🌐</div>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        {type === "flight" ? "Selecting cheapest non-stop flight…" : "Filling out the booking form…"}
      </div>
      <div style={{ color: "#888", fontSize: 13 }}>
        {type === "flight"
          ? "Searching Kayak, applying non-stop filter, picking the cheapest flight. Takes ~15 seconds."
          : "Navigating to the booking page, selecting date and time, pre-filling your info. Takes ~10 seconds."}
      </div>
      <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#6366f1",
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function ReadyState({
  result,
  type,
  onOpen,
  onFallback,
}: {
  result: AutopilotResult;
  type: AutopilotType;
  onOpen: () => void;
  onFallback: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 10,
          padding: "12px 16px",
          fontSize: 13,
          color: "#15803d",
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
        }}
      >
        <span>✅</span>
        <div>
          <strong>{type === "flight" ? "Flight selected!" : "Form pre-filled!"}</strong>
          {result.selected_time && (
            <span> {type === "flight" ? "Price: " : "Time: "}<strong>{result.selected_time}</strong></span>
          )}
          {" "}{type === "flight"
            ? "Open the page to confirm your flight — just enter passenger info and pay."
            : "Open the page to confirm your booking — no need to re-enter details."}
        </div>
      </div>

      {result.screenshot_base64 && (
        <div
          style={{
            borderRadius: 10,
            overflow: "hidden",
            border: "1px solid #e5e7eb",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.screenshot_base64}
            alt="Booking page screenshot"
            style={{ width: "100%", display: "block" }}
          />
        </div>
      )}

      <button
        onClick={onOpen}
        style={{
          width: "100%",
          padding: "14px 20px",
          borderRadius: 10,
          border: "none",
          background: "#6366f1",
          color: "#fff",
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Open to confirm booking →
      </button>

      <button
        onClick={onFallback}
        style={{
          width: "100%",
          padding: "10px 20px",
          borderRadius: 10,
          border: "1.5px solid #e5e7eb",
          background: "#fff",
          color: "#666",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Open search page instead
      </button>
    </div>
  );
}

function NoAvailabilityState({
  result,
  onFallback,
}: {
  result: AutopilotResult;
  onFallback: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: 10,
          padding: "12px 16px",
          fontSize: 13,
          color: "#92400e",
        }}
      >
        ⚠️ {result.error ?? "No availability found at the requested time."}
      </div>

      {result.screenshot_base64 && (
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #e5e7eb" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.screenshot_base64}
            alt="Booking page screenshot"
            style={{ width: "100%", display: "block" }}
          />
        </div>
      )}

      <button
        onClick={onFallback}
        style={{
          width: "100%",
          padding: "14px 20px",
          borderRadius: 10,
          border: "none",
          background: "#6366f1",
          color: "#fff",
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Search manually →
      </button>
    </div>
  );
}

function ErrorState({
  result,
  onFallback,
}: {
  result: AutopilotResult;
  onFallback: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 10,
          padding: "12px 16px",
          fontSize: 13,
          color: "#991b1b",
        }}
      >
        ❌ Autopilot couldn&apos;t complete: {result.error ?? "Unknown error"}
      </div>
      <p style={{ fontSize: 13, color: "#666", margin: 0 }}>
        No worries — the search page is pre-filled with your dates and covers.
      </p>
      <button
        onClick={onFallback}
        style={{
          width: "100%",
          padding: "14px 20px",
          borderRadius: 10,
          border: "none",
          background: "#6366f1",
          color: "#fff",
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Open booking page →
      </button>
    </div>
  );
}
