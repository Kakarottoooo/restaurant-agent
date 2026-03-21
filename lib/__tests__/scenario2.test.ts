import { describe, it, expect } from "vitest";
import {
  detectScenarioFromMessage,
  detectScenario,
  parseScenarioIntent,
  runScenarioPlanner,
  runWeekendTripPlanner,
} from "../scenario2";
import type {
  CreditCardRecommendationCard,
  DateNightIntent,
  Flight,
  FlightRecommendationCard,
  Hotel,
  HotelRecommendationCard,
  RecommendationCard,
  Restaurant,
  RestaurantIntent,
  WeekendTripIntent,
} from "../types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const baseRestaurantIntent = (): RestaurantIntent => ({
  category: "restaurant",
  cuisine: "Italian",
  party_size: 2,
});

function makeRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: "r1",
    name: "Trattoria Roma",
    cuisine: "Italian",
    price: "$$$",
    rating: 4.5,
    review_count: 300,
    address: "123 Main St",
    is_closed: false,
    ...overrides,
  };
}

function makeCard(overrides: Partial<RecommendationCard> = {}): RecommendationCard {
  return {
    restaurant: makeRestaurant(),
    rank: 1,
    score: 8.5,
    why_recommended: "Great ambiance for dates",
    best_for: "Romantic dinners",
    watch_out: "Can get loud on weekends",
    not_great_if: "Looking for a quick meal",
    estimated_total: "$80–100 for two",
    ...overrides,
  };
}

// ─── detectScenarioFromMessage ────────────────────────────────────────────────

describe("detectScenarioFromMessage", () => {
  it("detects date_night from 'date night'", () => {
    expect(detectScenarioFromMessage("Looking for a date night restaurant")).toBe("date_night");
  });

  it("detects date_night from 'romantic'", () => {
    expect(detectScenarioFromMessage("Something romantic for dinner")).toBe("date_night");
  });

  it("detects date_night from 'anniversary'", () => {
    expect(detectScenarioFromMessage("Anniversary dinner reservation")).toBe("date_night");
  });

  it("detects date_night from 'first date'", () => {
    expect(detectScenarioFromMessage("best spot for a first date")).toBe("date_night");
  });

  it("detects date_night from Chinese 约会", () => {
    expect(detectScenarioFromMessage("帮我找个约会餐厅")).toBe("date_night");
  });

  it("detects date_night from Chinese 浪漫", () => {
    expect(detectScenarioFromMessage("浪漫的法餐厅在哪里")).toBe("date_night");
  });

  it("detects weekend_trip over date_night when both signals present", () => {
    // weekend trip takes priority in detectScenarioFromMessage
    expect(detectScenarioFromMessage("weekend trip to NYC with girlfriend")).toBe("weekend_trip");
  });

  it("detects weekend_trip from explicit phrase", () => {
    expect(detectScenarioFromMessage("planning a weekend getaway to Chicago")).toBe("weekend_trip");
  });

  it("detects weekend_trip from combined signals", () => {
    expect(detectScenarioFromMessage("booking a flight and hotel for the weekend")).toBe("weekend_trip");
  });

  it("returns null for a plain restaurant query", () => {
    expect(detectScenarioFromMessage("best sushi in San Francisco")).toBeNull();
  });

  it("returns null for a hotel-only query", () => {
    expect(detectScenarioFromMessage("find me a hotel in Boston")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(detectScenarioFromMessage("")).toBeNull();
  });
});

// ─── detectScenario ───────────────────────────────────────────────────────────

describe("detectScenario", () => {
  it("returns date_night when intent.purpose is 'date'", () => {
    const intent = { ...baseRestaurantIntent(), purpose: "date" };
    expect(detectScenario("dinner tonight", intent)).toBe("date_night");
  });

  it("returns date_night when message matches date regex", () => {
    const intent = baseRestaurantIntent();
    expect(detectScenario("romantic restaurant for two", intent)).toBe("date_night");
  });

  it("returns date_night when party_size=2 + quiet atmosphere", () => {
    const intent: RestaurantIntent = {
      ...baseRestaurantIntent(),
      party_size: 2,
      atmosphere: ["romantic", "intimate"],
    };
    expect(detectScenario("dinner for two", intent)).toBe("date_night");
  });

  it("returns null for non-restaurant category even with date words", () => {
    const intent = { category: "hotel" as const, party_size: 2 };
    // detectScenario only returns date_night for restaurant category
    expect(detectScenario("romantic hotel for my partner", intent as RestaurantIntent)).toBeNull();
  });

  it("returns null for a plain restaurant query", () => {
    const intent = baseRestaurantIntent();
    expect(detectScenario("best tacos in LA", intent)).toBeNull();
  });

  it("returns null when party_size=2 but atmosphere is not romantic", () => {
    const intent: RestaurantIntent = {
      ...baseRestaurantIntent(),
      party_size: 2,
      atmosphere: ["lively", "energetic"],
    };
    expect(detectScenario("dinner for two friends", intent)).toBeNull();
  });
});

// ─── parseScenarioIntent ──────────────────────────────────────────────────────

describe("parseScenarioIntent", () => {
  it("returns null for a non-date-night query", () => {
    const intent = baseRestaurantIntent();
    expect(parseScenarioIntent("best ramen in NYC", intent)).toBeNull();
  });

  it("returns a DateNightIntent with scenario='date_night'", () => {
    const intent: RestaurantIntent = { ...baseRestaurantIntent(), purpose: "date" };
    const result = parseScenarioIntent("romantic dinner tonight", intent);
    expect(result).not.toBeNull();
    expect(result?.scenario).toBe("date_night");
  });

  it("infers stage=first_date from 'first date' in message", () => {
    const intent: RestaurantIntent = { ...baseRestaurantIntent(), purpose: "date" };
    const result = parseScenarioIntent("best restaurant for a first date", intent);
    expect(result?.stage).toBe("first_date");
  });

  it("infers stage=anniversary from 'anniversary' in message", () => {
    const intent: RestaurantIntent = { ...baseRestaurantIntent(), purpose: "date" };
    const result = parseScenarioIntent("anniversary dinner reservation", intent);
    expect(result?.stage).toBe("anniversary");
  });

  it("infers stage=steady_relationship from 'girlfriend' in message", () => {
    const intent: RestaurantIntent = { ...baseRestaurantIntent(), purpose: "date" };
    const result = parseScenarioIntent("dinner with my girlfriend", intent);
    expect(result?.stage).toBe("steady_relationship");
  });

  it("sets wants_quiet_buffer=true when noise_level is quiet", () => {
    const intent: RestaurantIntent = { ...baseRestaurantIntent(), purpose: "date", noise_level: "quiet" };
    const result = parseScenarioIntent("romantic restaurant", intent);
    expect(result?.wants_quiet_buffer).toBe(true);
  });

  it("sets wants_quiet_buffer=true when message mentions 'quiet'", () => {
    const intent: RestaurantIntent = { ...baseRestaurantIntent(), purpose: "date" };
    const result = parseScenarioIntent("quiet romantic dinner for two", intent);
    expect(result?.wants_quiet_buffer).toBe(true);
  });

  it("preserves base intent fields (cuisine, party_size)", () => {
    const intent: RestaurantIntent = { ...baseRestaurantIntent(), purpose: "date", cuisine: "French" };
    const result = parseScenarioIntent("romantic French restaurant", intent);
    expect(result?.cuisine).toBe("French");
    expect(result?.party_size).toBe(2);
  });
});

// ─── runScenarioPlanner ───────────────────────────────────────────────────────

describe("runScenarioPlanner", () => {
  const baseIntent = (): DateNightIntent => ({
    category: "restaurant",
    scenario: "date_night",
    scenario_goal: "A great evening for two",
    stage: "steady_relationship",
    follow_up_preference: "dessert",
    decision_style: "romantic",
    wants_quiet_buffer: false,
    party_size: 2,
    purpose: "date",
  });

  it("returns null when recommendations array is empty", () => {
    const result = runScenarioPlanner({
      scenarioIntent: baseIntent(),
      recommendations: [],
      userMessage: "romantic dinner",
      cityLabel: "San Francisco, CA",
      outputLanguage: "en",
    });
    expect(result).toBeNull();
  });

  it("returns a DecisionPlan with scenario='date_night'", () => {
    const result = runScenarioPlanner({
      scenarioIntent: baseIntent(),
      recommendations: [makeCard()],
      userMessage: "romantic dinner for two",
      cityLabel: "San Francisco, CA",
      outputLanguage: "en",
    });
    expect(result).not.toBeNull();
    expect(result?.scenario).toBe("date_night");
  });

  it("plan id is based on the primary restaurant id", () => {
    const result = runScenarioPlanner({
      scenarioIntent: baseIntent(),
      recommendations: [makeCard({ restaurant: makeRestaurant({ id: "abc123" }) })],
      userMessage: "date night",
      cityLabel: "San Francisco, CA",
      outputLanguage: "en",
    });
    expect(result?.id).toBe("date-night-abc123");
  });

  it("includes backup plans when multiple recommendations provided", () => {
    const cards = [
      makeCard({ restaurant: makeRestaurant({ id: "r1", name: "Roma" }), rank: 1 }),
      makeCard({ restaurant: makeRestaurant({ id: "r2", name: "Bistro" }), rank: 2 }),
      makeCard({ restaurant: makeRestaurant({ id: "r3", name: "Sakura" }), rank: 3 }),
    ];
    const result = runScenarioPlanner({
      scenarioIntent: baseIntent(),
      recommendations: cards,
      userMessage: "romantic dinner",
      cityLabel: "SF",
      outputLanguage: "en",
    });
    expect(result?.backup_plans).toHaveLength(2);
  });

  it("caps backup plans at 2 even with many recommendations", () => {
    const cards = Array.from({ length: 6 }, (_, i) =>
      makeCard({ restaurant: makeRestaurant({ id: `r${i}`, name: `Restaurant ${i}` }), rank: i + 1 })
    );
    const result = runScenarioPlanner({
      scenarioIntent: baseIntent(),
      recommendations: cards,
      userMessage: "date night",
      cityLabel: "NYC",
      outputLanguage: "en",
    });
    expect(result?.backup_plans.length).toBeLessThanOrEqual(2);
  });

  it("returns Chinese output when output_language is zh", () => {
    const result = runScenarioPlanner({
      scenarioIntent: baseIntent(),
      recommendations: [makeCard()],
      userMessage: "约会晚餐",
      cityLabel: "旧金山",
      outputLanguage: "zh",
    });
    expect(result?.output_language).toBe("zh");
    // summary should contain Chinese characters
    expect(/[\u3040-\u30ff\u3400-\u9fff]/.test(result?.summary ?? "")).toBe(true);
  });

  it("evidence_items contains primary restaurant", () => {
    const restaurant = makeRestaurant({ id: "r1", name: "Trattoria Roma" });
    const result = runScenarioPlanner({
      scenarioIntent: baseIntent(),
      recommendations: [makeCard({ restaurant })],
      userMessage: "romantic dinner",
      cityLabel: "SF",
      outputLanguage: "en",
    });
    expect(result?.evidence_items[0].id).toBe("r1");
    expect(result?.evidence_items[0].title).toBe("Trattoria Roma");
  });

  it("plan has required DecisionPlan fields", () => {
    const result = runScenarioPlanner({
      scenarioIntent: baseIntent(),
      recommendations: [makeCard()],
      userMessage: "romantic dinner",
      cityLabel: "SF",
      outputLanguage: "en",
    });
    expect(result).toMatchObject({
      id: expect.any(String),
      scenario: "date_night",
      output_language: "en",
      title: expect.any(String),
      summary: expect.any(String),
      approval_prompt: expect.any(String),
      confidence: expect.stringMatching(/^(high|medium|low)$/),
      primary_plan: expect.objectContaining({ id: expect.any(String) }),
      next_actions: expect.any(Array),
      evidence_items: expect.any(Array),
    });
  });
});

// ─── detectScenario (intent-aware) ───────────────────────────────────────────

describe("detectScenario", () => {
  it("returns date_night when intent.purpose is date (restaurant category)", () => {
    const intent: RestaurantIntent = { category: "restaurant", cuisine: "Italian", purpose: "date" };
    expect(detectScenario("dinner for two", intent)).toBe("date_night");
  });

  it("returns date_night from romantic keyword even without purpose=date", () => {
    const intent: RestaurantIntent = { category: "restaurant", cuisine: "French" };
    expect(detectScenario("romantic dinner in Manhattan", intent)).toBe("date_night");
  });

  it("returns date_night from party_size=2 + quiet atmosphere", () => {
    const intent: RestaurantIntent = {
      category: "restaurant",
      cuisine: "French",
      party_size: 2,
      noise_level: "quiet",
    };
    expect(detectScenario("dinner for two", intent)).toBe("date_night");
  });

  it("returns null for non-restaurant category even with romantic keywords", () => {
    const intent = { category: "hotel" as const, purpose: "date" };
    // Non-restaurant: only weekend_trip is detectable
    expect(detectScenario("romantic hotel stay", intent)).toBeNull();
  });

  it("returns weekend_trip for non-restaurant + weekend trip signal", () => {
    const intent = { category: "hotel" as const };
    expect(detectScenario("weekend trip to Chicago with hotel and flight", intent)).toBe("weekend_trip");
  });

  it("returns null for plain restaurant search with no scenario signals", () => {
    const intent: RestaurantIntent = { category: "restaurant", cuisine: "Pizza" };
    expect(detectScenario("find me a good pizza place", intent)).toBeNull();
  });
});

// ─── parseScenarioIntent ─────────────────────────────────────────────────────

describe("parseScenarioIntent", () => {
  it("returns null when scenario is not date_night", () => {
    const intent: RestaurantIntent = { category: "restaurant", cuisine: "Pizza" };
    expect(parseScenarioIntent("find me a pizza place", intent)).toBeNull();
  });

  it("returns DateNightIntent with scenario=date_night when detected", () => {
    const intent: RestaurantIntent = { category: "restaurant", cuisine: "French", purpose: "date" };
    const result = parseScenarioIntent("romantic dinner for two", intent);
    expect(result).not.toBeNull();
    expect(result?.scenario).toBe("date_night");
    expect(result?.category).toBe("restaurant");
  });

  it("sets wants_quiet_buffer when noise_level is quiet", () => {
    const intent: RestaurantIntent = { category: "restaurant", purpose: "date", noise_level: "quiet" };
    const result = parseScenarioIntent("quiet romantic dinner", intent);
    expect(result?.wants_quiet_buffer).toBe(true);
  });

  it("sets wants_quiet_buffer from message keywords", () => {
    const intent: RestaurantIntent = { category: "restaurant", purpose: "date" };
    const result = parseScenarioIntent("romantic dinner, not too loud, easy conversation", intent);
    expect(result?.wants_quiet_buffer).toBe(true);
  });

  it("propagates RestaurantIntent fields to ScenarioIntent", () => {
    const intent: RestaurantIntent = {
      category: "restaurant",
      cuisine: "Italian",
      purpose: "date",
      party_size: 2,
      budget_per_person: 80,
    };
    const result = parseScenarioIntent("romantic Italian dinner", intent);
    expect(result?.cuisine).toBe("Italian");
    expect(result?.party_size).toBe(2);
    expect(result?.budget_per_person).toBe(80);
  });
});

// ─── runWeekendTripPlanner ────────────────────────────────────────────────────

function makeHotel(overrides: Partial<Hotel> = {}): Hotel {
  return {
    id: "h1",
    name: "Chicago Grand Hotel",
    star_rating: 4,
    price_per_night: 180,
    total_price: 360,
    rating: 4.3,
    review_count: 1200,
    address: "100 N Michigan Ave, Chicago, IL",
    amenities: ["wifi", "pool", "gym"],
    booking_link: "https://booking.example.com/hotel-1",
    ...overrides,
  };
}

function makeHotelCard(overrides: Partial<HotelRecommendationCard> = {}): HotelRecommendationCard {
  return {
    hotel: makeHotel(),
    rank: 1,
    score: 8.5,
    why_recommended: "Great location",
    best_for: "Business travelers",
    watch_out: "Can be noisy",
    not_great_if: "On a tight budget",
    price_summary: "$180/night",
    location_summary: "Downtown",
    ...overrides,
  };
}

function makeFlight(overrides: Partial<Flight> = {}): Flight {
  return {
    id: "f1",
    airline: "Delta",
    flight_number: "DL123",
    departure_airport: "JFK",
    arrival_airport: "ORD",
    departure_city: "New York",
    arrival_city: "Chicago",
    departure_time: "08:00",
    arrival_time: "10:00",
    duration: "2h",
    stops: 0,
    price: 250,
    booking_link: "https://booking.example.com/flight-1",
    ...overrides,
  };
}

function makeFlightCard(overrides: Partial<FlightRecommendationCard> = {}): FlightRecommendationCard {
  return {
    flight: makeFlight(),
    rank: 1,
    group: "direct",
    why_recommended: "Best nonstop option",
    ...overrides,
  };
}

function makeBaseWeekendTripIntent(): WeekendTripIntent {
  return {
    category: "trip",
    scenario: "weekend_trip",
    scenario_goal: "Weekend trip to Chicago",
    departure_city: "New York",
    destination_city: "Chicago",
    trip_pace: "relaxed",
    hotel_style: "comfort",
    planning_assumptions: [],
    needs_clarification: false,
    missing_fields: [],
  };
}

describe("runWeekendTripPlanner", () => {
  it("returns null when no flights provided", () => {
    const result = runWeekendTripPlanner({
      scenarioIntent: makeBaseWeekendTripIntent(),
      flightRecommendations: [],
      hotelRecommendations: [makeHotelCard()],
      creditCardRecommendations: [],
      userMessage: "weekend trip to Chicago",
      outputLanguage: "en",
    });
    expect(result).toBeNull();
  });

  it("returns null when no hotels provided", () => {
    const result = runWeekendTripPlanner({
      scenarioIntent: makeBaseWeekendTripIntent(),
      flightRecommendations: [makeFlightCard()],
      hotelRecommendations: [],
      creditCardRecommendations: [],
      userMessage: "weekend trip to Chicago",
      outputLanguage: "en",
    });
    expect(result).toBeNull();
  });

  it("produces a valid DecisionPlan with flight + hotel data", () => {
    const result = runWeekendTripPlanner({
      scenarioIntent: makeBaseWeekendTripIntent(),
      flightRecommendations: [
        makeFlightCard({ flight: makeFlight({ id: "f1", price: 200, stops: 0 }), rank: 1, group: "direct" }),
        makeFlightCard({ flight: makeFlight({ id: "f2", price: 150, stops: 1 }), rank: 2, group: "cheapest" }),
        makeFlightCard({ flight: makeFlight({ id: "f3", price: 350, stops: 0 }), rank: 3, group: "direct" }),
      ],
      hotelRecommendations: [
        makeHotelCard({ hotel: makeHotel({ id: "h1", star_rating: 4, price_per_night: 180 }), rank: 1, score: 8.5 }),
        makeHotelCard({ hotel: makeHotel({ id: "h2", star_rating: 3, price_per_night: 110 }), rank: 2, score: 7.0 }),
        makeHotelCard({ hotel: makeHotel({ id: "h3", star_rating: 5, price_per_night: 320 }), rank: 3, score: 9.2 }),
      ],
      creditCardRecommendations: [],
      userMessage: "weekend trip to Chicago next weekend",
      outputLanguage: "en",
    });

    expect(result).not.toBeNull();
    expect(result?.scenario).toBe("weekend_trip");
    expect(result?.primary_plan).toBeDefined();
    expect(result?.backup_plans.length).toBeGreaterThanOrEqual(1);
    expect(result?.evidence_items.length).toBeGreaterThan(0);
  });

  it("plan has required DecisionPlan fields", () => {
    const result = runWeekendTripPlanner({
      scenarioIntent: makeBaseWeekendTripIntent(),
      flightRecommendations: [makeFlightCard()],
      hotelRecommendations: [makeHotelCard()],
      creditCardRecommendations: [],
      userMessage: "weekend trip",
      outputLanguage: "en",
    });
    expect(result).toMatchObject({
      id: expect.any(String),
      scenario: "weekend_trip",
      output_language: "en",
      title: expect.any(String),
      summary: expect.any(String),
      primary_plan: expect.objectContaining({ id: expect.any(String) }),
      backup_plans: expect.any(Array),
      evidence_items: expect.any(Array),
    });
  });

  it("returns Chinese output when output_language is zh", () => {
    const result = runWeekendTripPlanner({
      scenarioIntent: makeBaseWeekendTripIntent(),
      flightRecommendations: [makeFlightCard()],
      hotelRecommendations: [makeHotelCard()],
      creditCardRecommendations: [],
      userMessage: "周末去芝加哥旅行",
      outputLanguage: "zh",
    });
    expect(result?.output_language).toBe("zh");
  });
});
