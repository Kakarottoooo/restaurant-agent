import { FlightIntent, FlightRecommendationCard, Flight } from "../../types";
import { searchFlights, resolveMultiAirport } from "../../tools";

// ─── Phase 8: Flight Pipeline ─────────────────────────────────────────────────

export async function runFlightPipeline(
  intent: FlightIntent,
): Promise<{ flightRecommendations: FlightRecommendationCard[]; missing_fields: string[]; no_direct_available: boolean }> {
  // Check required fields
  const missing: string[] = [];
  if (!intent.departure_city) missing.push("departure city");
  if (!intent.arrival_city) missing.push("destination city");
  if (!intent.date) missing.push("travel date");

  console.log("[flight-pipeline] intent:", JSON.stringify({ dep: intent.departure_city, arr: intent.arrival_city, date: intent.date, prefer_direct: intent.prefer_direct }));

  if (missing.length > 0) {
    console.log("[flight-pipeline] missing fields:", missing);
    return { flightRecommendations: [], missing_fields: missing, no_direct_available: false };
  }

  const searchParams = {
    arrival_city: intent.arrival_city!,
    date: intent.date!,
    return_date: intent.return_date,
    is_round_trip: intent.is_round_trip,
    passengers: intent.passengers,
    cabin_class: intent.cabin_class,
    prefer_direct: intent.prefer_direct,
    max_stops: intent.max_stops,
  };

  // Multi-airport city handling: search primary airport + cheapest from alternates
  const depMulti = resolveMultiAirport(intent.departure_city!);
  const arrMulti = resolveMultiAirport(intent.arrival_city!);

  let flights: Flight[];

  if (depMulti && depMulti.all.length > 1) {
    // Parallel search: primary airport + each alternate airport
    const alternates = depMulti.all.filter((code) => code !== depMulti.primary);
    const [primaryFlights, ...altFlightGroups] = await Promise.all([
      searchFlights({ ...searchParams, departure_city: depMulti.primary, maxResults: 8 }),
      ...alternates.map((alt) =>
        searchFlights({ ...searchParams, departure_city: alt, maxResults: 4 })
      ),
    ]);

    // Take best 3 from primary airport
    const primaryBest = primaryFlights.slice(0, 3);

    // Find cheapest flight from any alternate airport (only if cheaper than primary cheapest)
    const primaryCheapest = primaryFlights.reduce((min, f) => (f.price > 0 && f.price < min ? f.price : min), Infinity);
    const allAltFlights = altFlightGroups.flat().filter((f) => f.price > 0);
    const cheapestAlt = allAltFlights.sort((a, b) => a.price - b.price)[0];

    if (cheapestAlt && cheapestAlt.price < primaryCheapest) {
      flights = [...primaryBest, cheapestAlt];
    } else {
      // Also add a 1-stop / 2-stop from alternates if available
      const altOneStop = allAltFlights.find((f) => f.stops === 1);
      flights = altOneStop ? [...primaryBest, altOneStop] : primaryBest;
    }
  } else if (arrMulti && arrMulti.all.length > 1) {
    // Multi-airport arrival (less common but handled symmetrically)
    const [primaryFlights, ...altFlightGroups] = await Promise.all([
      searchFlights({ ...searchParams, departure_city: intent.departure_city!, arrival_city: arrMulti.primary, maxResults: 8 }),
      ...arrMulti.all
        .filter((c) => c !== arrMulti.primary)
        .map((alt) =>
          searchFlights({ ...searchParams, departure_city: intent.departure_city!, arrival_city: alt, maxResults: 4 })
        ),
    ]);
    const primaryBest = primaryFlights.slice(0, 3);
    const allAltFlights = altFlightGroups.flat().filter((f) => f.price > 0);
    const cheapestAlt = allAltFlights.sort((a, b) => a.price - b.price)[0];
    const primaryCheapest = primaryFlights.reduce((min, f) => (f.price > 0 && f.price < min ? f.price : min), Infinity);
    flights = cheapestAlt && cheapestAlt.price < primaryCheapest
      ? [...primaryBest, cheapestAlt]
      : primaryBest;
  } else {
    flights = await searchFlights({
      ...searchParams,
      departure_city: intent.departure_city!,
      maxResults: 8,
    });
  }

  if (flights.length === 0) {
    return { flightRecommendations: [], missing_fields: [], no_direct_available: false };
  }

  const wantedNonstop = intent.prefer_direct === true || intent.max_stops === 0;
  const no_direct_available = wantedNonstop && flights.every((f) => f.stops > 0);

  // Identify cheapest flight (only when not filtering by stop preference)
  const isFiltered = wantedNonstop || intent.max_stops === 1;
  const cheapestId = !isFiltered && flights.length > 0
    ? flights.filter(f => f.price > 0).sort((a, b) => a.price - b.price)[0]?.id
    : null;

  const cards: FlightRecommendationCard[] = flights.map((flight, i) => {
    const isCheapest = !isFiltered && flight.id === cheapestId;
    const group: FlightRecommendationCard["group"] = isCheapest
      ? "cheapest"
      : flight.stops === 0 ? "direct" : flight.stops === 1 ? "one_stop" : "two_stop";

    const why = isCheapest
      ? `Lowest price found — $${flight.price}${flight.stops > 0 ? ` with ${flight.stops} stop${flight.stops > 1 ? "s" : ""}` : ", nonstop"}`
      : flight.stops === 0
      ? `Nonstop flight — fastest option at ${flight.duration}`
      : flight.stops === 1
      ? `1 stop via ${flight.layover_city ?? "connecting city"} (${flight.layover_duration ?? ""} layover)`
      : `${flight.stops} stops — most affordable option`;

    return {
      flight,
      rank: i + 1,
      group,
      why_recommended: why,
    };
  });

  return { flightRecommendations: cards, missing_fields: [], no_direct_available };
}
