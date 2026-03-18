"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { FlightRecommendationCard } from "@/lib/types";

export interface MapPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  rank: number;
  subtitle: string;
  rating: number;
}

// Great-circle arc interpolation (N intermediate points)
function greatCircleArc(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  steps = 50
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const λ1 = toRad(lng1);
  const φ2 = toRad(lat2);
  const λ2 = toRad(lng2);
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((φ2 - φ1) / 2) ** 2 +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2
      )
    );
  if (d === 0) return [[lat1, lng1]];
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x =
      A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y =
      A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    const φ = Math.atan2(z, Math.sqrt(x * x + y * y));
    const λ = Math.atan2(y, x);
    points.push([toDeg(φ), toDeg(λ)]);
  }
  return points;
}

function FlyToController({
  lat,
  lng,
  trigger,
}: {
  lat: number | null;
  lng: number | null;
  trigger: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) {
      map.flyTo([lat, lng], 15, { duration: 0.8 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, lat, lng]);
  return null;
}

export default function MapView({
  pins,
  center: cityCenter,
  label = "Location",
  flightCards,
}: {
  pins: MapPin[];
  center?: { lat: number; lng: number };
  label?: string;
  flightCards?: FlightRecommendationCard[];
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [L, setL] = useState<any>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const leaflet = require("leaflet");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
    leaflet.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setL(leaflet);
  }, []);

  const validCards = pins;

  // ── Flight map mode ─────────────────────────────────────────────────────────
  const isFlightMode = !!flightCards && flightCards.length > 0;
  const [selectedFlightIndex, setSelectedFlightIndex] = useState(0);
  const flightCardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (isFlightMode && flightCards) {
    const firstFlight = flightCards[selectedFlightIndex]?.flight ?? flightCards[0].flight;
    const hasCoords =
      firstFlight.departure_lat != null &&
      firstFlight.departure_lng != null &&
      firstFlight.arrival_lat != null &&
      firstFlight.arrival_lng != null;

    // Compute arc for selected flight
    const arcPoints = hasCoords
      ? greatCircleArc(
          firstFlight.departure_lat!,
          firstFlight.departure_lng!,
          firstFlight.arrival_lat!,
          firstFlight.arrival_lng!
        )
      : [];

    const mapCenter: [number, number] = hasCoords
      ? [
          (firstFlight.departure_lat! + firstFlight.arrival_lat!) / 2,
          (firstFlight.departure_lng! + firstFlight.arrival_lng!) / 2,
        ]
      : [39.5, -98.35]; // continental US center

    return (
      <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          {L && hasCoords ? (
            <MapContainer
              center={mapCenter}
              zoom={4}
              style={{ height: "100%", width: "100%" }}
              zoomControl={false}
              aria-label="Flight route map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {/* Arc line */}
              {arcPoints.length > 0 && (
                <Polyline
                  positions={arcPoints}
                  pathOptions={{ color: "#C9A84C", weight: 2, dashArray: "6 4", opacity: 0.9 }}
                />
              )}
              {/* Departure marker */}
              <Marker
                position={[firstFlight.departure_lat!, firstFlight.departure_lng!]}
                icon={L.divIcon({
                  html: `<div style="background:#2C2416;color:#F0EAD6;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;font-family:DM Sans,sans-serif;border:2px solid #C9A84C;box-shadow:0 2px 8px rgba(0,0,0,0.4);text-align:center;line-height:1.1;">${firstFlight.departure_airport}</div>`,
                  className: "",
                  iconSize: [32, 32],
                  iconAnchor: [16, 16],
                })}
              />
              {/* Arrival marker */}
              <Marker
                position={[firstFlight.arrival_lat!, firstFlight.arrival_lng!]}
                icon={L.divIcon({
                  html: `<div style="background:#C9A84C;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;font-family:DM Sans,sans-serif;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);text-align:center;line-height:1.1;">${firstFlight.arrival_airport}</div>`,
                  className: "",
                  iconSize: [32, 32],
                  iconAnchor: [16, 16],
                })}
              />
            </MapContainer>
          ) : (
            <div style={{ height: "100%", backgroundColor: "var(--card-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", fontSize: "13px" }}>
                {L ? "No coordinate data for this route" : "Loading map…"}
              </span>
            </div>
          )}
        </div>

        {/* Bottom strip: flight cards */}
        <div
          role="listbox"
          aria-label="Flight list"
          style={{
            display: "flex",
            overflowX: "auto",
            gap: "10px",
            padding: "12px 16px",
            backgroundColor: "var(--card)",
            borderTop: "0.5px solid var(--border)",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
          }}
        >
          {flightCards.map((card, i) => {
            const isSelected = i === selectedFlightIndex;
            const { flight } = card;
            return (
              <button
                key={flight.id}
                ref={(el) => { flightCardRefs.current[i] = el; }}
                role="option"
                aria-selected={isSelected}
                onClick={() => setSelectedFlightIndex(i)}
                style={{
                  flexShrink: 0,
                  width: "220px",
                  borderRadius: "12px",
                  border: isSelected ? "1.5px solid #C9A84C" : "0.5px solid var(--border)",
                  backgroundColor: isSelected ? "var(--bg)" : "var(--card)",
                  padding: "10px 12px",
                  cursor: "pointer",
                  scrollSnapAlign: "center",
                  transition: "border-color 0.2s",
                  textAlign: "left",
                }}
              >
                <div style={{ fontFamily: "var(--font-playfair)", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                  {flight.departure_airport} → {flight.arrival_airport}
                </div>
                <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "11px", color: "var(--text-secondary)" }}>
                  {flight.airline} · {flight.duration}
                </div>
                <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "13px", fontWeight: 700, color: "#C9A84C", marginTop: 4 }}>
                  {flight.price > 0 ? `$${flight.price}` : "—"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  // ── End flight map mode ──────────────────────────────────────────────────────

  function selectCard(i: number) {
    setSelectedIndex(i);
    const el = cardRefs.current[i];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }

  if (validCards.length === 0) {
    return (
      <div
        className="h-full flex items-center justify-center text-sm"
        style={{
          backgroundColor: "var(--card-2)",
          color: "var(--text-muted)",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        No location data available for map view
      </div>
    );
  }

  const selected = validCards[selectedIndex];
  const center: [number, number] = cityCenter
    ? [cityCenter.lat, cityCenter.lng]
    : [validCards[0].lat, validCards[0].lng];

  function createMarkerIcon(isSelected: boolean, rank: number) {
    if (!L) return undefined;
    return L.divIcon({
      html: `<div style="
        width: ${isSelected ? "34px" : "28px"};
        height: ${isSelected ? "34px" : "28px"};
        border-radius: 50%;
        background: ${isSelected ? "#C9A84C" : "#2C2416"};
        border: 2.5px solid ${isSelected ? "#C9A84C" : "#fff"};
        color: ${isSelected ? "#fff" : "var(--bg, #F5F0E8)"};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isSelected ? "13px" : "11px"};
        font-weight: 700;
        font-family: DM Sans, sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        transition: all 0.2s;
        cursor: pointer;
      ">${rank}</div>`,
      className: "",
      iconSize: [isSelected ? 34 : 28, isSelected ? 34 : 28],
      iconAnchor: [isSelected ? 17 : 14, isSelected ? 17 : 14],
    });
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Map area */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {L && (
          <MapContainer
            center={center}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
            keyboard={true}
            aria-label={`${label} location map`}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlyToController
              lat={selected?.lat ?? null}
              lng={selected?.lng ?? null}
              trigger={selectedIndex}
            />
            {validCards.map((pin, i) => (
              <Marker
                key={pin.id}
                position={[pin.lat, pin.lng]}
                icon={createMarkerIcon(i === selectedIndex, i + 1)}
                eventHandlers={{ click: () => selectCard(i) }}
                zIndexOffset={i === selectedIndex ? 1000 : 0}
              />
            ))}
          </MapContainer>
        )}
        {!L && (
          <div
            style={{
              height: "100%",
              backgroundColor: "var(--card-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                color: "var(--text-muted)",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "13px",
              }}
            >
              Loading map…
            </span>
          </div>
        )}
      </div>

      {/* Bottom thumbnail strip — Task 10: <div onClick> → <button> for keyboard access */}
      <div
        ref={stripRef}
        role="listbox"
        aria-label={`${label} list`}
        style={{
          display: "flex",
          overflowX: "auto",
          gap: "10px",
          padding: "12px 16px",
          backgroundColor: "var(--card)",
          borderTop: "0.5px solid var(--border)",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {validCards.map((pin, i) => {
          const isSelected = i === selectedIndex;
          return (
            <button
              key={pin.id}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              role="option"
              aria-selected={isSelected}
              aria-label={`Select ${pin.name}, rank ${i + 1}`}
              onClick={() => selectCard(i)}
              style={{
                flexShrink: 0,
                width: "200px",
                borderRadius: "12px",
                border: isSelected
                  ? "1.5px solid #C9A84C"
                  : "0.5px solid var(--border)",
                backgroundColor: isSelected ? "var(--bg)" : "var(--card)",
                padding: "10px 12px",
                cursor: "pointer",
                scrollSnapAlign: "center",
                transition: "border-color 0.2s, background-color 0.2s",
                boxShadow: isSelected ? "0 0 0 1px #C9A84C22" : "none",
                textAlign: "left",
              }}
            >
              {/* Rank + name */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  marginBottom: "4px",
                }}
              >
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    backgroundColor: isSelected
                      ? "#C9A84C"
                      : "var(--text-primary)",
                    color: isSelected ? "#fff" : "var(--bg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    fontWeight: 700,
                    fontFamily: "var(--font-dm-sans)",
                    flexShrink: 0,
                    marginTop: "1px",
                  }}
                >
                  {i + 1}
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-playfair)",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    lineHeight: 1.3,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {pin.name}
                </span>
              </div>
              {/* Subtitle + rating */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "110px",
                  }}
                >
                  {pin.subtitle}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#C9A84C",
                    flexShrink: 0,
                  }}
                >
                  ★ {pin.rating}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
