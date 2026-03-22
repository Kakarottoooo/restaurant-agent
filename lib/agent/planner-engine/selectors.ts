import {
  CreditCardRecommendationCard,
  FlightRecommendationCard,
  HotelRecommendationCard,
  RecommendationCard,
} from "../../types";
import { TieredPackage, ModuleResults } from "./types";

// ─── Per-module tier pickers ──────────────────────────────────────────────────

function pickHotels(
  hotels: HotelRecommendationCard[]
): { A: HotelRecommendationCard; B: HotelRecommendationCard; C: HotelRecommendationCard } | null {
  if (hotels.length === 0) return null;
  const sorted = [...hotels].sort(
    (a, b) =>
      (b.hotel.star_rating ?? 0) * 0.4 + b.hotel.rating * 0.6 -
      ((a.hotel.star_rating ?? 0) * 0.4 + a.hotel.rating * 0.6)
  );
  return { A: sorted[0], B: sorted[1] ?? sorted[0], C: sorted[2] ?? sorted[1] ?? sorted[0] };
}

function pickFlights(
  flights: FlightRecommendationCard[]
): { A: FlightRecommendationCard; B: FlightRecommendationCard; C: FlightRecommendationCard } | null {
  if (flights.length === 0) return null;
  const direct = flights.filter((f) => f.flight.stops === 0);
  const oneStop = flights.filter((f) => f.flight.stops === 1);
  const cheapest = [...flights].sort((a, b) => a.flight.price - b.flight.price);

  const tierA = direct[0] ?? oneStop[0] ?? flights[0];
  const tierB =
    direct.find((f) => f.flight.id !== tierA.flight.id) ??
    oneStop[0] ??
    cheapest[0];
  const tierC =
    cheapest.find((f) => f.flight.id !== tierA.flight.id && f.flight.id !== tierB.flight.id) ??
    cheapest[0];

  return { A: tierA, B: tierB, C: tierC };
}

function pickRestaurants(
  restaurants: RecommendationCard[]
): { A: RecommendationCard; B: RecommendationCard; C: RecommendationCard } | null {
  if (restaurants.length === 0) return null;
  const sorted = [...restaurants].sort((a, b) => b.score - a.score);
  return { A: sorted[0], B: sorted[1] ?? sorted[0], C: sorted[2] ?? sorted[1] ?? sorted[0] };
}

function pickBars(
  bars: RecommendationCard[]
): { A: RecommendationCard; B: RecommendationCard; C: RecommendationCard } | null {
  if (bars.length === 0) return null;
  const sorted = [...bars].sort((a, b) => b.score - a.score);
  return { A: sorted[0], B: sorted[1] ?? sorted[0], C: sorted[2] ?? sorted[1] ?? sorted[0] };
}

function pickCreditCards(
  cards: CreditCardRecommendationCard[]
): { A: CreditCardRecommendationCard; B: CreditCardRecommendationCard; C: CreditCardRecommendationCard } | null {
  if (cards.length === 0) return null;
  return { A: cards[0], B: cards[1] ?? cards[0], C: cards[2] ?? cards[1] ?? cards[0] };
}

// ─── Package assembly ─────────────────────────────────────────────────────────

/**
 * Builds 3 TieredPackages (A/B/C) from module results.
 * Each slot picks one item per module (using per-module tier selection).
 */
export function buildTieredPackages(results: ModuleResults): [TieredPackage, TieredPackage, TieredPackage] {
  const hotelTiers = pickHotels(results.hotels);
  const flightTiers = pickFlights(results.flights);
  const restaurantTiers = pickRestaurants(results.restaurants);
  const barTiers = pickBars(results.bars);
  const cardTiers = pickCreditCards(results.creditCards);

  const make = (slot: "A" | "B" | "C"): TieredPackage => ({
    slot,
    hotel: hotelTiers?.[slot],
    flight: flightTiers?.[slot],
    restaurant: restaurantTiers?.[slot],
    bar: barTiers?.[slot],
    creditCard: cardTiers?.[slot],
  });

  return [make("A"), make("B"), make("C")];
}
