"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { FlightRecommendationCard } from "@/lib/types";

// Animated plane that travels along combined arc points
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AnimatedPlane({ points, L }: { points: [number, number][]; L: any }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
    if (points.length < 2) return;
    const t = setInterval(() => setIdx(p => (p + 1) % points.length), 40);
    return () => clearInterval(t);
  }, [points]);
  if (!points[idx]) return null;
  const pos = points[idx];
  const nxt = points[Math.min(idx + 1, points.length - 1)];
  // Angle for right-pointing icon: atan2(-dlat, dlng) because screen y is inverted
  const angle = Math.atan2(-(nxt[0] - pos[0]), nxt[1] - pos[1]) * (180 / Math.PI);
  return (
    <Marker
      position={pos}
      icon={L.divIcon({
        html: `<div style="font-size:22px;transform:rotate(${angle}deg);transform-origin:center;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.5));">✈</div>`,
        className: "",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })}
    />
  );
}

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
    const selectedCard = flightCards[selectedFlightIndex] ?? flightCards[0];
    const flight = selectedCard.flight;

    // Use per-leg data if available, otherwise fall back to single arc
    const legs = flight.legs && flight.legs.length > 0 ? flight.legs : null;

    // Build arc segments: one per leg
    type ArcSegment = { points: [number, number][]; fromId: string; toId: string; depTime: string; arrTime: string; layover?: string; duration?: string };
    const arcSegments: ArcSegment[] = [];

    if (legs) {
      for (const leg of legs) {
        if (leg.from_lat != null && leg.from_lng != null && leg.to_lat != null && leg.to_lng != null) {
          arcSegments.push({
            points: greatCircleArc(leg.from_lat, leg.from_lng, leg.to_lat, leg.to_lng),
            fromId: leg.from_airport,
            toId: leg.to_airport,
            depTime: leg.departure_time,
            arrTime: leg.arrival_time,
            layover: leg.layover_duration,
            duration: leg.duration,
          });
        }
      }
    } else if (
      flight.departure_lat != null && flight.departure_lng != null &&
      flight.arrival_lat != null && flight.arrival_lng != null
    ) {
      arcSegments.push({
        points: greatCircleArc(flight.departure_lat, flight.departure_lng, flight.arrival_lat, flight.arrival_lng),
        fromId: flight.departure_airport,
        toId: flight.arrival_airport,
        depTime: flight.departure_time,
        arrTime: flight.arrival_time,
        duration: flight.duration,
      });
    }

    const hasCoords = arcSegments.length > 0;

    // Combined arc points for animated plane (all legs sequentially)
    const allArcPoints: [number, number][] = arcSegments.flatMap(s => s.points);

    // Collect all unique airport markers
    type AirportMarker = { id: string; lat: number; lng: number; time: string; isOrigin: boolean; isDest: boolean; layover?: string };
    const markerMap = new Map<string, AirportMarker>();
    arcSegments.forEach((seg, i) => {
      const leg = legs?.[i];
      const fromLat = leg?.from_lat ?? flight.departure_lat;
      const fromLng = leg?.from_lng ?? flight.departure_lng;
      const toLat = leg?.to_lat ?? flight.arrival_lat;
      const toLng = leg?.to_lng ?? flight.arrival_lng;
      if (fromLat != null && fromLng != null) {
        if (!markerMap.has(seg.fromId))
          markerMap.set(seg.fromId, { id: seg.fromId, lat: fromLat, lng: fromLng, time: seg.depTime, isOrigin: i === 0, isDest: false });
      }
      if (toLat != null && toLng != null) {
        const isLast = i === arcSegments.length - 1;
        markerMap.set(seg.toId, { id: seg.toId, lat: toLat, lng: toLng, time: seg.arrTime, isOrigin: false, isDest: isLast, layover: isLast ? undefined : seg.layover });
      }
    });
    const markers = Array.from(markerMap.values());

    // Map center: midpoint of all marker coords
    const mapCenter: [number, number] = hasCoords
      ? [markers.reduce((s, m) => s + m.lat, 0) / markers.length, markers.reduce((s, m) => s + m.lng, 0) / markers.length]
      : [39.5, -98.35];

    return (
      <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          {L && hasCoords ? (
            <MapContainer
              key={`flight-map-${selectedFlightIndex}`}
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
              {/* Draw one arc + arrowhead + duration label per leg */}
              {arcSegments.map((seg, i) => {
                const mid = seg.points[Math.floor(seg.points.length / 2)];
                const last = seg.points[seg.points.length - 1];
                const prev = seg.points[seg.points.length - 4];
                const arrowAngle = Math.atan2(-(last[0] - prev[0]), last[1] - prev[1]) * (180 / Math.PI);
                return (
                  <>
                    <Polyline
                      key={`arc-${i}`}
                      positions={seg.points}
                      pathOptions={{ color: "#C9A84C", weight: 2.5, dashArray: "6 4", opacity: 0.9 }}
                    />
                    {/* Arrowhead at end of arc */}
                    <Marker
                      key={`arrow-${i}`}
                      position={last}
                      icon={L.divIcon({
                        html: `<div style="font-size:14px;color:#C9A84C;transform:rotate(${arrowAngle}deg);transform-origin:center;line-height:1;text-shadow:0 1px 3px rgba(0,0,0,0.6);">▶</div>`,
                        className: "",
                        iconSize: [14, 14],
                        iconAnchor: [7, 7],
                      })}
                    />
                    {/* Duration label at arc midpoint */}
                    {seg.duration && (
                      <Marker
                        key={`dur-${i}`}
                        position={mid}
                        icon={L.divIcon({
                          html: `<div style="display:inline-block;background:rgba(44,36,22,0.82);color:#F0EAD6;border-radius:8px;padding:3px 8px;font-size:11px;font-weight:600;white-space:nowrap;font-family:'DM Sans',sans-serif;box-shadow:0 1px 4px rgba(0,0,0,0.4);border:1px solid #C9A84C55;">${seg.duration}</div>`,
                          className: "",
                          iconSize: undefined,
                          iconAnchor: [22, 11],
                        })}
                      />
                    )}
                  </>
                );
              })}
              {/* Airport markers */}
              {markers.map((m) => {
                const isStop = !m.isOrigin && !m.isDest;
                const bg = m.isOrigin ? "#2C2416" : m.isDest ? "#C9A84C" : "#555";
                const fg = m.isOrigin ? "#F0EAD6" : "#fff";
                const layoverHtml = isStop && m.layover
                  ? `<div style="margin-top:4px;background:#2C2416;color:#F0EAD6;border-radius:5px;padding:2px 6px;font-size:10px;font-weight:600;white-space:nowrap;font-family:'DM Sans',sans-serif;box-shadow:0 1px 3px rgba(0,0,0,0.4);text-align:center;">${m.layover} wait</div>`
                  : "";
                const timeHtml = m.time
                  ? `<div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.72);color:#fff;border-radius:5px;padding:2px 7px;font-size:11px;font-weight:600;white-space:nowrap;font-family:'DM Sans',sans-serif;box-shadow:0 1px 4px rgba(0,0,0,0.4);">${m.time}</div>`
                  : "";
                const size = isStop ? 46 : 40;
                return (
                  <Marker
                    key={m.id}
                    position={[m.lat, m.lng]}
                    icon={L.divIcon({
                      html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;">
                        ${timeHtml}
                        <div style="background:${bg};color:${fg};border-radius:${isStop ? "8px" : "50%"};width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;font-family:'DM Sans',sans-serif;border:2.5px solid #C9A84C;box-shadow:0 2px 10px rgba(0,0,0,0.45);text-align:center;line-height:1.2;">
                          ${m.id}
                        </div>
                        ${layoverHtml}
                      </div>`,
                      className: "",
                      iconSize: [size, size + (isStop && m.layover ? 26 : 0)],
                      iconAnchor: [size / 2, size / 2],
                    })}
                  />
                );
              })}
              {/* Animated plane */}
              {allArcPoints.length > 1 && <AnimatedPlane points={allArcPoints} L={L} />}
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
            const { flight: f } = card;
            const groupColor: Record<typeof card.group, string> = {
              direct: "#2D6A4F",
              one_stop: "#8B5E14",
              two_stop: "#7B3F00",
              cheapest: "#1a5fa8",
            };
            const groupLabel: Record<typeof card.group, string> = {
              direct: "Nonstop",
              one_stop: `1 Stop${f.layover_city ? ` · ${f.layover_city}` : ""}`,
              two_stop: `${f.stops} Stops`,
              cheapest: `Best Price · ${f.stops === 0 ? "Nonstop" : f.stops === 1 ? `1 stop${f.layover_city ? ` · ${f.layover_city}` : ""}` : `${f.stops} stops`}`,
            };
            const accentColor = groupColor[card.group];
            return (
              <button
                key={f.id}
                ref={(el) => { flightCardRefs.current[i] = el; }}
                role="option"
                aria-selected={isSelected}
                onClick={() => setSelectedFlightIndex(i)}
                style={{
                  flexShrink: 0,
                  width: "220px",
                  borderRadius: "12px",
                  border: isSelected ? `1.5px solid ${accentColor}` : `0.5px solid ${accentColor}44`,
                  backgroundColor: isSelected ? `${accentColor}18` : "var(--card)",
                  padding: "10px 12px",
                  cursor: "pointer",
                  scrollSnapAlign: "center",
                  transition: "border-color 0.2s, background-color 0.2s",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontFamily: "var(--font-playfair)", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {f.departure_airport} → {f.arrival_airport}
                  </div>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: accentColor, background: `${accentColor}22`, borderRadius: "4px", padding: "1px 6px", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap", marginLeft: 6 }}>
                    {groupLabel[card.group]}
                  </span>
                </div>
                <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "11px", color: "var(--text-secondary)", marginBottom: 2 }}>
                  {f.departure_time} → {f.arrival_time} · {f.duration}
                </div>
                <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "11px", color: "var(--text-muted)", marginBottom: 4 }}>
                  {f.airline}
                </div>
                <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "14px", fontWeight: 700, color: accentColor }}>
                  {f.price > 0 ? `$${f.price}` : "—"}
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
