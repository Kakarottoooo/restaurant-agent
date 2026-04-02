import { WeekendTripIntent, FlightIntent, HotelIntent, CreditCardIntent, UserRequirements } from "../../types";

export function buildWeekendTripFlightIntent(
  scenarioIntent: WeekendTripIntent
): FlightIntent {
  const travelers = scenarioIntent.travelers ?? 1;
  const preferDirect =
    scenarioIntent.prefer_direct ??
    (scenarioIntent.trip_pace === "easy" ? true : null);

  return {
    category: "flight",
    departure_city: scenarioIntent.departure_city,
    arrival_city: scenarioIntent.destination_city,
    date: scenarioIntent.start_date,
    return_date: scenarioIntent.end_date,
    is_round_trip: true,
    passengers: travelers,
    cabin_class: scenarioIntent.cabin_class ?? "economy",
    prefer_direct: preferDirect ?? undefined,
    max_stops: preferDirect ? 0 : scenarioIntent.trip_pace === "easy" ? 1 : null,
    budget_total: scenarioIntent.budget_total,
    purpose: "weekend_trip",
  };
}

export function buildWeekendTripHotelIntent(
  scenarioIntent: WeekendTripIntent
): HotelIntent {
  const location = scenarioIntent.hotel_neighborhood
    ? `${scenarioIntent.hotel_neighborhood}, ${scenarioIntent.destination_city ?? ""}`.trim()
    : scenarioIntent.destination_city;

  return {
    category: "hotel",
    location,
    check_in: scenarioIntent.start_date,
    check_out: scenarioIntent.end_date,
    nights: scenarioIntent.nights,
    guests: scenarioIntent.travelers ?? 1,
    star_rating: scenarioIntent.hotel_star_rating,
    neighborhood: scenarioIntent.hotel_neighborhood,
    budget_total: scenarioIntent.budget_total,
    purpose: "weekend_trip",
    priorities: [scenarioIntent.trip_pace, scenarioIntent.hotel_style].filter(Boolean),
  };
}

export function buildWeekendTripCardIntent(
  scenarioIntent: WeekendTripIntent
): CreditCardIntent {
  const budget = scenarioIntent.budget_total ?? 900;
  const hotelShare = Math.round(budget * 0.45);
  const flightShare = Math.round(budget * 0.35);
  const diningShare = Math.round(budget * 0.12);
  const otherShare = Math.max(0, budget - hotelShare - flightShare - diningShare);

  return {
    category: "credit_card",
    spending_profile: {
      dining: diningShare,
      groceries: 0,
      travel: hotelShare + flightShare,
      gas: 0,
      online_shopping: 0,
      streaming: 0,
      entertainment: 0,
      pharmacy: 0,
      rent: 0,
      other: otherShare,
    },
    existing_cards: [],
    has_existing_cards: false,
    reward_preference: "travel",
    prefer_no_annual_fee: budget < 750 ? "soft" : false,
    prefer_flat_rate: false,
    needs_spending_info: false,
  };
}

/**
 * Build restaurant requirements from a weekend trip intent.
 * Honours explicit cuisine preferences from the user message (e.g. "Chinese food").
 */
export function buildWeekendTripRestaurantRequirements(
  intent: WeekendTripIntent
): UserRequirements {
  const cuisine =
    (intent.cuisine_preferences ?? []).length > 0
      ? (intent.cuisine_preferences ?? []).join(", ")
      : intent.hotel_style === "luxury" || intent.hotel_style === "boutique"
      ? "fine dining"
      : "popular local dining";

  return {
    cuisine,
    location: intent.destination_city,
    purpose: "dining",
    atmosphere:
      intent.hotel_style === "luxury"
        ? ["upscale", "refined"]
        : intent.trip_pace === "easy"
        ? ["relaxed", "neighborhood"]
        : ["popular", "well-reviewed"],
    party_size: intent.travelers ?? 1,
  };
}
