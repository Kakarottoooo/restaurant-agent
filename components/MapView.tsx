"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { RecommendationCard } from "@/lib/types";

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
  cards,
  center: cityCenter,
}: {
  cards: RecommendationCard[];
  center?: { lat: number; lng: number };
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

  const validCards = cards.filter(
    (c) => c.restaurant.lat != null && c.restaurant.lng != null
  );

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
    : [validCards[0].restaurant.lat!, validCards[0].restaurant.lng!];

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
            aria-label="Restaurant location map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlyToController
              lat={selected?.restaurant.lat ?? null}
              lng={selected?.restaurant.lng ?? null}
              trigger={selectedIndex}
            />
            {validCards.map((card, i) => (
              <Marker
                key={card.restaurant.id}
                position={[card.restaurant.lat!, card.restaurant.lng!]}
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
        aria-label="Restaurant list"
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
        {validCards.map((card, i) => {
          const r = card.restaurant;
          const isSelected = i === selectedIndex;
          return (
            <button
              key={r.id}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              role="option"
              aria-selected={isSelected}
              aria-label={`Select ${r.name}, rank ${i + 1}`}
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
                  {r.name}
                </span>
              </div>
              {/* Cuisine + rating */}
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
                  {r.cuisine}
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
                  ★ {r.rating}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
