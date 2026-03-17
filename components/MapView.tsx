"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { RecommendationCard } from "@/lib/types";

export default function MapView({ cards }: { cards: RecommendationCard[] }) {
  useEffect(() => {
    // Fix Leaflet default marker icon paths in Next.js
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  const validCards = cards.filter(
    (c) => c.restaurant.lat != null && c.restaurant.lng != null
  );

  if (validCards.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center bg-gray-100 rounded-2xl text-gray-500 text-sm">
        No location data available for map view
      </div>
    );
  }

  const center: [number, number] = [37.7749, -122.4194];

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "450px", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validCards.map((card, i) => (
          <Marker
            key={card.restaurant.id}
            position={[card.restaurant.lat!, card.restaurant.lng!]}
          >
            <Popup>
              <div style={{ fontSize: "13px", lineHeight: "1.5" }}>
                <strong>
                  {i + 1}. {card.restaurant.name}
                </strong>
                <br />
                {card.restaurant.cuisine} &middot; {card.restaurant.price}
                <br />
                ⭐ {card.restaurant.rating}
                <br />
                <span style={{ color: "#6b7280", fontSize: "11px" }}>
                  {card.restaurant.address}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
