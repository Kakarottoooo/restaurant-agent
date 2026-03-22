import { CityTripIntent, HotelIntent, UserRequirements } from "../../types";

export function buildCityTripHotelIntent(intent: CityTripIntent): HotelIntent {
  const location = intent.hotel_neighborhood
    ? `${intent.hotel_neighborhood}, ${intent.destination_city}`
    : intent.destination_city;

  return {
    category: "hotel",
    location,
    check_in: intent.start_date,
    check_out: intent.end_date,
    nights: intent.nights,
    guests: intent.travelers ?? 1,
    star_rating: intent.hotel_star_rating,
    neighborhood: intent.hotel_neighborhood,
    budget_total: intent.budget_total,
    purpose: "city_trip",
    priorities: [intent.vibe],
  };
}

export function buildCityTripRestaurantRequirements(intent: CityTripIntent): UserRequirements {
  const cuisine =
    intent.cuisine_preferences.length > 0
      ? intent.cuisine_preferences.join(", ")
      : intent.vibe === "upscale"
      ? "fine dining"
      : intent.vibe === "local"
      ? "local cuisine"
      : "popular local dining";

  return {
    cuisine,
    location: intent.destination_city,
    purpose: "dining",
    atmosphere:
      intent.vibe === "upscale"
        ? ["upscale", "refined"]
        : intent.vibe === "trendy"
        ? ["trendy", "lively"]
        : intent.vibe === "local"
        ? ["casual", "neighborhood"]
        : ["popular", "well-reviewed"],
    party_size: intent.travelers ?? 1,
  };
}

export function buildCityTripBarRequirements(intent: CityTripIntent): UserRequirements {
  const wantsMusic = intent.activities.some((a) =>
    /music|live|jazz|blues|country|rock|band/i.test(a)
  );
  const wantsNightlife = intent.activities.some((a) =>
    /nightlife|club|dance/i.test(a)
  );
  const wantsBar = intent.activities.some((a) => /bar|drink|cocktail|pub/i.test(a));

  const cuisine = wantsMusic
    ? "live music bar"
    : wantsNightlife
    ? "nightclub bar"
    : wantsBar || true // default to bars
    ? intent.vibe === "upscale"
      ? "cocktail bar"
      : "bar"
    : "bar";

  return {
    cuisine,
    location: intent.destination_city,
    purpose: "nightlife",
    atmosphere:
      intent.vibe === "upscale"
        ? ["upscale", "stylish"]
        : intent.vibe === "trendy"
        ? ["trendy", "vibrant"]
        : ["lively", "fun"],
    party_size: intent.travelers ?? 1,
  };
}
