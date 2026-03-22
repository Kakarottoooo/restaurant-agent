import { describe, it, expect } from "vitest";
import {
  detectScenarioFromMessage,
  detectScenario,
  parseScenarioIntent,
  runScenarioPlanner,
  runWeekendTripPlanner,
  runCityTripPlanner,
} from "../scenario2";
import {
  parseBigPurchaseIntent,
  runBigPurchasePlanner,
} from "../agent/planners/big-purchase";
import type {
  CityTripIntent,
  CreditCardRecommendationCard,
  DateNightIntent,
  Flight,
  FlightRecommendationCard,
  Hotel,
  HotelRecommendationCard,
  LaptopRecommendationCard,
  MultilingualQueryContext,
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

  it("detects city_trip from travel + hotel + restaurant signals", () => {
    expect(
      detectScenarioFromMessage(
        "i am going to travel to la, i need a hotel for 3 days and want to go to music bars and try some good restaurants, formulate several plans for me"
      )
    ).toBe("city_trip");
  });

  it("detects city_trip from visiting + hotel + bars", () => {
    expect(
      detectScenarioFromMessage("visiting Nashville next friday, reserve a 4 star hotel and suggest some bars and restaurants")
    ).toBe("city_trip");
  });

  it("detects city_trip from itinerary keyword + hotel", () => {
    expect(
      detectScenarioFromMessage("help me build an itinerary for NYC with hotel and dining")
    ).toBe("city_trip");
  });

  it("does not detect city_trip from hotel-only without activities", () => {
    expect(detectScenarioFromMessage("find me a hotel in Boston")).toBeNull();
  });

  it("does not detect city_trip from restaurant-only without hotel", () => {
    expect(detectScenarioFromMessage("best bars and restaurants in LA")).toBeNull();
  });

  it("detects weekend_trip over city_trip when flight+hotel both present", () => {
    expect(
      detectScenarioFromMessage("book a flight and hotel to Chicago this weekend")
    ).toBe("weekend_trip");
  });

  it("returns null for a plain restaurant query", () => {
    expect(detectScenarioFromMessage("best sushi in San Francisco")).toBeNull();
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
    expect(detectScenario("romantic hotel for my partner", intent as unknown as RestaurantIntent)).toBeNull();
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
    const result = parseScenarioIntent("best restaurant for a first date", intent) as DateNightIntent | null;
    expect(result?.stage).toBe("first_date");
  });

  it("infers stage=anniversary from 'anniversary' in message", () => {
    const intent: RestaurantIntent = { ...baseRestaurantIntent(), purpose: "date" };
    const result = parseScenarioIntent("anniversary dinner reservation", intent) as DateNightIntent | null;
    expect(result?.stage).toBe("anniversary");
  });

  it("infers stage=steady_relationship from 'girlfriend' in message", () => {
    const intent: RestaurantIntent = { ...baseRestaurantIntent(), purpose: "date" };
    const result = parseScenarioIntent("dinner with my girlfriend", intent) as DateNightIntent | null;
    expect(result?.stage).toBe("steady_relationship");
  });

  it("sets wants_quiet_buffer=true when noise_level is quiet", () => {
    const intent: RestaurantIntent = { ...baseRestaurantIntent(), purpose: "date", noise_level: "quiet" };
    const result = parseScenarioIntent("romantic restaurant", intent) as DateNightIntent | null;
    expect(result?.wants_quiet_buffer).toBe(true);
  });

  it("sets wants_quiet_buffer=true when message mentions 'quiet'", () => {
    const intent: RestaurantIntent = { ...baseRestaurantIntent(), purpose: "date" };
    const result = parseScenarioIntent("quiet romantic dinner for two", intent) as DateNightIntent | null;
    expect(result?.wants_quiet_buffer).toBe(true);
  });

  it("preserves base intent fields (cuisine, party_size)", () => {
    const intent: RestaurantIntent = { ...baseRestaurantIntent(), purpose: "date", cuisine: "French" };
    const result = parseScenarioIntent("romantic French restaurant", intent) as DateNightIntent | null;
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
    const result = parseScenarioIntent("quiet romantic dinner", intent) as DateNightIntent | null;
    expect(result?.wants_quiet_buffer).toBe(true);
  });

  it("sets wants_quiet_buffer from message keywords", () => {
    const intent: RestaurantIntent = { category: "restaurant", purpose: "date" };
    const result = parseScenarioIntent("romantic dinner, not too loud, easy conversation", intent) as DateNightIntent | null;
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
    const result = parseScenarioIntent("romantic Italian dinner", intent) as DateNightIntent | null;
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
    trip_pace: "balanced",
    hotel_style: "comfortable",
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

// ─── runCityTripPlanner ────────────────────────────────────────────────────────

function makeBaseCityTripIntent(overrides: Partial<CityTripIntent> = {}): CityTripIntent {
  return {
    category: "trip",
    scenario: "city_trip",
    scenario_goal: "Explore Tokyo with great food and nightlife",
    destination_city: "Tokyo",
    nights: 3,
    travelers: 2,
    activities: ["dining", "nightlife"],
    cuisine_preferences: ["Japanese", "Ramen"],
    hotel_star_rating: 4,
    vibe: "mixed",
    planning_assumptions: [],
    needs_clarification: false,
    missing_fields: [],
    ...overrides,
  };
}

describe("runCityTripPlanner", () => {
  it("returns null when no hotels and no restaurants provided", () => {
    const result = runCityTripPlanner({
      scenarioIntent: makeBaseCityTripIntent(),
      hotelRecommendations: [],
      restaurantRecommendations: [],
      barRecommendations: [],
      outputLanguage: "en",
    });
    expect(result).toBeNull();
  });

  it("produces a valid DecisionPlan with hotel + restaurant data", () => {
    const result = runCityTripPlanner({
      scenarioIntent: makeBaseCityTripIntent(),
      hotelRecommendations: [
        makeHotelCard({ hotel: makeHotel({ id: "h1", star_rating: 5, rating: 4.8 }), rank: 1, score: 9.2 }),
        makeHotelCard({ hotel: makeHotel({ id: "h2", star_rating: 4, rating: 4.3 }), rank: 2, score: 8.1 }),
        makeHotelCard({ hotel: makeHotel({ id: "h3", star_rating: 3, rating: 4.0 }), rank: 3, score: 7.5 }),
      ],
      restaurantRecommendations: [
        makeCard({ restaurant: makeRestaurant({ id: "r1" }), rank: 1, score: 9.0 }),
        makeCard({ restaurant: makeRestaurant({ id: "r2" }), rank: 2, score: 8.0 }),
        makeCard({ restaurant: makeRestaurant({ id: "r3" }), rank: 3, score: 7.0 }),
      ],
      barRecommendations: [],
      outputLanguage: "en",
    });

    expect(result).not.toBeNull();
    expect(result?.scenario).toBe("city_trip");
    expect(result?.primary_plan).toBeDefined();
    expect(result?.backup_plans.length).toBeGreaterThanOrEqual(1);
  });

  it("plan has required DecisionPlan fields", () => {
    const result = runCityTripPlanner({
      scenarioIntent: makeBaseCityTripIntent(),
      hotelRecommendations: [makeHotelCard()],
      restaurantRecommendations: [makeCard()],
      barRecommendations: [],
      outputLanguage: "en",
    });
    expect(result).toMatchObject({
      id: expect.any(String),
      scenario: "city_trip",
      output_language: "en",
      title: expect.any(String),
      summary: expect.any(String),
      primary_plan: expect.objectContaining({ id: expect.any(String) }),
      backup_plans: expect.any(Array),
      evidence_items: expect.any(Array),
      next_actions: expect.any(Array),
    });
  });

  it("planId includes destination city", () => {
    const result = runCityTripPlanner({
      scenarioIntent: makeBaseCityTripIntent({ destination_city: "Paris" }),
      hotelRecommendations: [makeHotelCard()],
      restaurantRecommendations: [makeCard()],
      barRecommendations: [],
      outputLanguage: "en",
    });
    expect(result?.id).toContain("Paris");
  });

  it("returns Chinese output when outputLanguage is zh", () => {
    const result = runCityTripPlanner({
      scenarioIntent: makeBaseCityTripIntent({ destination_city: "东京" }),
      hotelRecommendations: [makeHotelCard()],
      restaurantRecommendations: [makeCard()],
      barRecommendations: [],
      outputLanguage: "zh",
    });
    expect(result?.output_language).toBe("zh");
    expect(result?.title).toContain("东京");
  });

  it("works with only hotels (no restaurants or bars)", () => {
    const result = runCityTripPlanner({
      scenarioIntent: makeBaseCityTripIntent(),
      hotelRecommendations: [makeHotelCard()],
      restaurantRecommendations: [],
      barRecommendations: [],
      outputLanguage: "en",
    });
    expect(result).not.toBeNull();
    expect(result?.scenario).toBe("city_trip");
  });

  it("works with only restaurants (no hotels)", () => {
    const result = runCityTripPlanner({
      scenarioIntent: makeBaseCityTripIntent(),
      hotelRecommendations: [],
      restaurantRecommendations: [makeCard()],
      barRecommendations: [],
      outputLanguage: "en",
    });
    expect(result).not.toBeNull();
    expect(result?.scenario).toBe("city_trip");
  });
});

// ─── detectScenarioFromMessage — big_purchase ────────────────────────────────

describe("detectScenarioFromMessage — big_purchase", () => {
  it("detects laptop with budget signal", () => {
    expect(detectScenarioFromMessage("help me pick a laptop ~$1800")).toBe("big_purchase");
  });

  it("detects headphones with explicit budget", () => {
    expect(detectScenarioFromMessage("best headphones under $300")).toBe("big_purchase");
  });

  it("detects smartphone with buy intent", () => {
    expect(detectScenarioFromMessage("I want to buy a new iPhone")).toBe("big_purchase");
  });

  it("city_trip takes priority when travel+hotel+dining signals present (even with laptop word)", () => {
    // city_trip requires: traveling + hotel + dining. This message triggers city_trip, not big_purchase.
    expect(detectScenarioFromMessage("traveling to Tokyo, need a hotel and restaurants for my trip")).toBe("city_trip");
  });

  it("returns null for bare product name with no budget or intent", () => {
    expect(detectScenarioFromMessage("laptop comparison")).toBeNull();
  });

  it("returns null for generic message with no product category", () => {
    expect(detectScenarioFromMessage("I want to buy something")).toBeNull();
  });
});

// ─── parseBigPurchaseIntent ───────────────────────────────────────────────────

const baseQueryContext = (): MultilingualQueryContext => ({
  input_language: "en",
  output_language: "en",
  normalized_query: "",
  intent_summary: "",
});

describe("parseBigPurchaseIntent", () => {
  it("detects laptop category", () => {
    const intent = parseBigPurchaseIntent("help me pick a laptop ~$1800", baseQueryContext());
    expect(intent.scenario).toBe("big_purchase");
    expect(intent.product_category).toBe("laptop");
  });

  it("extracts dollar budget", () => {
    const intent = parseBigPurchaseIntent("best laptop under $1500 for dev", baseQueryContext());
    expect(intent.budget_usd_max).toBe(1500);
  });

  it("extracts os_preference for mac", () => {
    const intent = parseBigPurchaseIntent("macbook for programming", baseQueryContext());
    expect(intent.os_preference).toBe("mac");
  });

  it("extracts use_case for development", () => {
    const intent = parseBigPurchaseIntent("laptop for coding and development", baseQueryContext());
    expect(intent.use_case).toBe("development");
  });

  it("defaults budget_usd_max to null when no price found", () => {
    const intent = parseBigPurchaseIntent("buy me a smartphone", baseQueryContext());
    expect(intent.budget_usd_max).toBeNull();
  });

  it("defaults product_category to other for unknown category", () => {
    const intent = parseBigPurchaseIntent("buy me a fridge", baseQueryContext());
    expect(intent.product_category).toBe("other");
  });

  it("sets category: unknown and scenario: big_purchase on the returned intent", () => {
    const intent = parseBigPurchaseIntent("laptop $999", baseQueryContext());
    expect(intent.category).toBe("unknown");
    expect(intent.scenario).toBe("big_purchase");
  });
});

// ─── runBigPurchasePlanner ────────────────────────────────────────────────────

const makeLaptopCard = (overrides: Partial<LaptopRecommendationCard["device"]> = {}): LaptopRecommendationCard => ({
  device: {
    id: "laptop-1",
    name: "TestBook Pro",
    brand: "TestBrand",
    os: "macOS",
    display_size: 14,
    cpu: "M3 Pro",
    ram_gb: 16,
    storage_gb: 512,
    weight_kg: 1.4,
    price_usd: 1999,
    skus: [{ ram_gb: 16, storage_gb: 512, price_usd: 1999 }],
    ...overrides,
  } as LaptopRecommendationCard["device"],
  rank: 1,
  why_recommended: "Great for development with excellent performance.",
  watch_out: ["Battery degrades over time"],
  final_score: 9.1,
  use_case_scores: {},
  signal_breakdown: [],
  recommended_sku: null,
  data_staleness_warning: false,
});

const baseBigPurchaseIntent = () =>
  parseBigPurchaseIntent("help me pick a laptop $1800", baseQueryContext());

describe("runBigPurchasePlanner", () => {
  it("returns null when recommendations is empty", () => {
    const result = runBigPurchasePlanner({
      intent: baseBigPurchaseIntent(),
      recommendations: [],
      outputLanguage: "en",
    });
    expect(result).toBeNull();
  });

  it("returns a DecisionPlan with scenario big_purchase", () => {
    const result = runBigPurchasePlanner({
      intent: baseBigPurchaseIntent(),
      recommendations: [makeLaptopCard()],
      outputLanguage: "en",
    });
    expect(result).not.toBeNull();
    expect(result?.scenario).toBe("big_purchase");
  });

  it("sets primary_plan from first recommendation", () => {
    const result = runBigPurchasePlanner({
      intent: baseBigPurchaseIntent(),
      recommendations: [makeLaptopCard()],
      outputLanguage: "en",
    });
    expect(result?.primary_plan.title).toBe("TestBook Pro");
  });

  it("includes Amazon open_link action in next_actions", () => {
    const result = runBigPurchasePlanner({
      intent: baseBigPurchaseIntent(),
      recommendations: [makeLaptopCard()],
      outputLanguage: "en",
    });
    const amazonAction = result?.next_actions.find((a) => a.type === "open_link");
    expect(amazonAction).toBeDefined();
    expect(amazonAction?.url).toContain("amazon.com");
  });

  it("creates up to 2 backup_plans from remaining recommendations", () => {
    const result = runBigPurchasePlanner({
      intent: baseBigPurchaseIntent(),
      recommendations: [
        makeLaptopCard({ id: "l1", name: "Primary", price_usd: 1999 }),
        makeLaptopCard({ id: "l2", name: "Backup1", price_usd: 1499 }),
        makeLaptopCard({ id: "l3", name: "Backup2", price_usd: 2299 }),
        makeLaptopCard({ id: "l4", name: "ShouldBeIgnored", price_usd: 999 }),
      ],
      outputLanguage: "en",
    });
    expect(result?.backup_plans).toHaveLength(2);
  });

  it("sets tradeoff_reason on backup options", () => {
    const result = runBigPurchasePlanner({
      intent: baseBigPurchaseIntent(),
      recommendations: [
        makeLaptopCard({ id: "l1", name: "Primary", price_usd: 1999 }),
        makeLaptopCard({ id: "l2", name: "Cheaper", price_usd: 999 }),
      ],
      outputLanguage: "en",
    });
    expect(result?.backup_plans[0].tradeoff_reason).toBeDefined();
  });

  it("outputs zh language copy when outputLanguage is zh", () => {
    const result = runBigPurchasePlanner({
      intent: parseBigPurchaseIntent("推荐一款笔记本电脑 $1500", baseQueryContext()),
      recommendations: [makeLaptopCard()],
      outputLanguage: "zh",
    });
    expect(result?.output_language).toBe("zh");
    expect(result?.primary_plan.label).toContain("主推");
  });

  it("sets tradeoff_summary on big purchase plan with backups", () => {
    const result = runBigPurchasePlanner({
      intent: baseBigPurchaseIntent(),
      recommendations: [
        makeLaptopCard({ id: "l1", name: "Top Pick", price_usd: 1999 }),
        makeLaptopCard({ id: "l2", name: "Budget Option", price_usd: 999 }),
      ],
      outputLanguage: "en",
    });
    expect(result?.tradeoff_summary).toBeDefined();
    expect(typeof result?.tradeoff_summary).toBe("string");
    expect(result?.tradeoff_summary?.length).toBeGreaterThan(0);
  });
});

// ─── tradeoff_summary ────────────────────────────────────────────────────────

describe("tradeoff_summary", () => {
  it("runScenarioPlanner sets tradeoff_summary with 2 backup cards", () => {
    const primary = makeCard({ score: 9.2, restaurant: makeRestaurant({ name: "Nobu", price: "$$$$" }) });
    const backup1 = makeCard({ score: 8.8, restaurant: makeRestaurant({ id: "r2", name: "Le Bernardin", price: "$$$$" }) });
    const backup2 = makeCard({ score: 8.0, restaurant: makeRestaurant({ id: "r3", name: "Café Boulud", price: "$$" }) });
    const result = runScenarioPlanner({
      scenarioIntent: { scenario: "date_night", category: "restaurant" },
      recommendations: [primary, backup1, backup2],
      userMessage: "romantic dinner",
      cityLabel: "NYC",
      outputLanguage: "en",
    });
    expect(result.tradeoff_summary).toBeDefined();
    expect(result.tradeoff_summary).toContain("Nobu");
  });

  it("runScenarioPlanner sets empty tradeoff_summary with no backups", () => {
    const result = runScenarioPlanner({
      scenarioIntent: { scenario: "date_night", category: "restaurant" },
      recommendations: [makeCard()],
      userMessage: "romantic dinner",
      cityLabel: "NYC",
      outputLanguage: "en",
    });
    expect(result.tradeoff_summary).toBe("");
  });

  it("runScenarioPlanner tradeoff_summary in zh contains restaurant name", () => {
    const primary = makeCard({ score: 9.0, restaurant: makeRestaurant({ name: "東京餐廳" }) });
    const backup = makeCard({ score: 8.5, restaurant: makeRestaurant({ id: "r2", name: "大阪屋" }) });
    const result = runScenarioPlanner({
      scenarioIntent: { scenario: "date_night", category: "restaurant" },
      recommendations: [primary, backup],
      userMessage: "找一个约会餐厅",
      cityLabel: "NYC",
      outputLanguage: "zh",
    });
    expect(result.tradeoff_summary).toContain("東京餐廳");
  });

  it("runWeekendTripPlanner sets tradeoff_summary with price comparison", () => {
    const result = runWeekendTripPlanner({
      scenarioIntent: makeBaseWeekendTripIntent(),
      flightRecommendations: [
        makeFlightCard({ flight: makeFlight({ id: "f1", price: 200 }), rank: 1 }),
        makeFlightCard({ flight: makeFlight({ id: "f2", price: 150 }), rank: 2 }),
        makeFlightCard({ flight: makeFlight({ id: "f3", price: 350 }), rank: 3 }),
      ],
      hotelRecommendations: [
        makeHotelCard({ hotel: makeHotel({ id: "h1", price_per_night: 180 }), rank: 1 }),
        makeHotelCard({ hotel: makeHotel({ id: "h2", price_per_night: 120 }), rank: 2 }),
        makeHotelCard({ hotel: makeHotel({ id: "h3", price_per_night: 320 }), rank: 3 }),
      ],
      creditCardRecommendations: [],
      outputLanguage: "en",
    });
    expect(result?.tradeoff_summary).toBeDefined();
    expect(typeof result?.tradeoff_summary).toBe("string");
    expect(result?.tradeoff_summary!.length).toBeGreaterThan(0);
  });
});
