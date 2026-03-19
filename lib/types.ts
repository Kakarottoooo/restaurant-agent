export interface UserRequirements {
  cuisine?: string;
  purpose?: string; // date, business, family, friends, solo
  budget_per_person?: number;
  budget_total?: number;
  atmosphere?: string[];
  noise_level?: "quiet" | "moderate" | "lively" | "any";
  location?: string;
  neighborhood?: string;
  near_location?: string; // specific landmark/street/area to search near
  party_size?: number;
  constraints?: string[]; // no chains, no tourist traps, etc.
  priorities?: string[]; // what matters most
}

export interface ReviewSignals {
  noise_level: "quiet" | "moderate" | "loud" | "unknown";
  wait_time: string; // e.g. "30-45min on weekends", "no wait on weekdays"
  date_suitability: number; // 1-10
  service_pace: string; // e.g. "attentive but not rushed"
  notable_dishes: string[];
  red_flags: string[];
  best_for: string[];
  review_confidence: "high" | "medium" | "low";
}

export interface GoogleReview {
  author_name: string;
  rating: number;
  relative_time_description: string;
  text: string;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  price: string; // $, $$, $$$, $$$$
  rating: number;
  review_count: number;
  address: string;
  phone?: string;
  url?: string;
  image_url?: string;
  description?: string;
  is_closed: boolean;
  distance?: number;
  lat?: number;
  lng?: number;
  review_signals?: ReviewSignals;
  google_reviews?: GoogleReview[];
}

export interface ScoringDimensions {
  budget_match: number; // 0-10
  scene_match: number; // 0-10
  review_quality: number; // 0-10
  location_convenience: number; // 0-10
  preference_match: number; // 0-10 (default 5 if unknown)
  red_flag_penalty: number; // 0-5
  weighted_total: number; // system-computed
}

export interface RecommendationCard {
  restaurant: Restaurant;
  rank: number;
  score: number;
  why_recommended: string;
  best_for: string;
  watch_out: string;
  not_great_if: string;
  estimated_total: string;
  opentable_url?: string;
  scoring?: ScoringDimensions;
  suggested_refinements?: string[];
}

export interface SessionPreferences {
  noise_preference?: "quiet" | "moderate" | "lively";
  budget_ceiling?: number; // per person
  exclude_chains: boolean;
  excluded_cuisines: string[];
  required_features: string[]; // e.g. ["outdoor seating", "private room"]
  occasion?: string;
  refined_from_query_count: number;
}

export interface UserPreferenceProfile {
  version: 1;
  updated_at: string; // ISO timestamp
  noise_preference?: "quiet" | "moderate" | "lively";
  typical_budget_per_person?: number;
  dietary_restrictions: string[];
  cuisine_dislikes: string[];
  always_exclude_chains: boolean;
  preferred_occasions: string[];
  dislike_tourist_traps: boolean;
  recent_search_keywords: string[];
  favorite_signals: Array<{
    cuisine: string;
    price: string;
    purpose?: string;
    saved_at: string;
  }>;
}

export interface FeedbackRecord {
  restaurant_id: string;
  restaurant_name: string;
  query: string;
  satisfied: boolean;
  issues?: string[];
  created_at: string;
}

export interface LearnedWeights {
  budget_match: number;
  scene_match: number;
  review_quality: number;
  location_convenience: number;
  preference_match: number;
  updated_at: string;
  sample_size: number;
}

export interface AgentResponse {
  requirements: UserRequirements;
  recommendations: RecommendationCard[];
  hotelRecommendations?: HotelRecommendationCard[];
  flightRecommendations?: FlightRecommendationCard[];
  creditCardRecommendations?: CreditCardRecommendationCard[];
  laptopRecommendations?: LaptopRecommendationCard[];
  category?: CategoryType;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  cards?: RecommendationCard[];
  hotelCards?: HotelRecommendationCard[];
  flightCards?: FlightRecommendationCard[];
  creditCardCards?: CreditCardRecommendationCard[];
  laptopCards?: LaptopRecommendationCard[];
  category?: CategoryType;
}

// ─── Phase 7: Multi-category types ───────────────────────────────────────────

export type CategoryType = "restaurant" | "hotel" | "flight" | "credit_card" | "laptop" | "unknown";

export interface BaseIntent {
  category: CategoryType;
  budget_per_person?: number;
  budget_total?: number;
  location?: string;
  purpose?: string;
  constraints?: string[];
  priorities?: string[];
}

export interface RestaurantIntent extends BaseIntent {
  category: "restaurant";
  cuisine?: string;
  noise_level?: "quiet" | "moderate" | "lively" | "any";
  atmosphere?: string[];
  party_size?: number;
  neighborhood?: string;
  near_location?: string;
}

export interface HotelIntent extends BaseIntent {
  category: "hotel";
  check_in?: string;
  check_out?: string;
  nights?: number;
  guests?: number;
  star_rating?: number;
  room_type?: string;
  amenities?: string[];
  neighborhood?: string;
}

export interface FlightIntent extends BaseIntent {
  category: "flight";
  departure_city?: string;
  departure_airport?: string; // IATA code e.g. "JFK"
  arrival_city?: string;
  arrival_airport?: string; // IATA code e.g. "LAX"
  date?: string; // YYYY-MM-DD
  return_date?: string; // YYYY-MM-DD (round trip)
  is_round_trip?: boolean;
  passengers?: number;
  cabin_class?: "economy" | "business" | "first";
  prefer_direct?: boolean;
  max_stops?: number | null; // null = no preference, 0 = nonstop only, 1 = max 1 stop
}

export type ParsedIntent = RestaurantIntent | HotelIntent | FlightIntent | CreditCardIntent | LaptopIntent;

export interface Hotel {
  id: string;
  name: string;
  star_rating: number;
  price_per_night: number;
  total_price: number;
  rating: number;
  review_count: number;
  address: string;
  neighborhood?: string;
  distance_to_center?: string;
  amenities: string[];
  thumbnail?: string;
  booking_link: string;
  description?: string;
  lat?: number;
  lng?: number;
}

export interface FlightLeg {
  from_airport: string;   // IATA
  to_airport: string;     // IATA
  departure_time: string; // e.g. "08:30"
  arrival_time: string;   // e.g. "11:45"
  duration?: string;      // e.g. "2h 15m"
  from_lat?: number;
  from_lng?: number;
  to_lat?: number;
  to_lng?: number;
  layover_duration?: string; // wait at to_airport before next leg
}

export interface Flight {
  id: string;
  airline: string;
  airline_logo?: string;
  flight_number?: string;
  departure_airport: string; // IATA or city name
  arrival_airport: string;
  departure_city: string;
  arrival_city: string;
  departure_time: string; // e.g. "08:30"
  arrival_time: string; // e.g. "11:45"
  duration: string; // e.g. "3h 15m"
  stops: number; // 0 = direct
  layover_city?: string;
  layover_duration?: string; // e.g. "1h 20m"
  price: number; // USD
  booking_link: string;
  is_round_trip?: boolean;
  return_departure_time?: string;
  return_arrival_time?: string;
  return_duration?: string;
  // Per-leg detail for map rendering
  legs?: FlightLeg[];
  // For map arc (overall)
  departure_lat?: number;
  departure_lng?: number;
  arrival_lat?: number;
  arrival_lng?: number;
}

export interface FlightRecommendationCard {
  flight: Flight;
  rank: number;
  group: "direct" | "one_stop" | "two_stop" | "cheapest";
  why_recommended: string;
}

export interface HotelRecommendationCard {
  hotel: Hotel;
  rank: number;
  score: number;
  why_recommended: string;
  best_for: string;
  watch_out: string;
  not_great_if: string;
  price_summary: string;
  location_summary: string;
  scoring?: ScoringDimensions;
  suggested_refinements?: string[];
}

// ─── Phase 9: Credit Card types ───────────────────────────────────────────────

export interface SpendingProfile {
  dining: number;        // monthly USD
  groceries: number;
  travel: number;
  gas: number;
  online_shopping: number;
  streaming: number;
  entertainment: number; // movies, concerts, sports, kids activities — SavorOne earns 3x here
  pharmacy: number;
  rent: number;          // monthly rent — only Bilt earns points on this
  other: number;
}

export interface CreditCardIntent extends BaseIntent {
  category: "credit_card";
  spending_profile?: SpendingProfile;
  existing_cards?: string[];           // card ids
  has_existing_cards?: boolean;        // true if user mentioned having cards but didn't name them
  reward_preference?: "cash" | "travel";
  credit_score?: number;               // 0 = no credit history
  prefer_no_annual_fee?: "hard" | "soft" | false; // hard=exclude, soft=show with note, false=no pref
  prefer_flat_rate?: boolean;          // "don't track categories, give me one card"
  needs_spending_info?: boolean;       // true = user didn't provide spending details, ask first
}

export interface CreditCard {
  id: string;
  name: string;
  issuer: string;
  annual_fee: number;
  rewards_currency: string;
  category_rates: {
    dining: number;
    groceries: number;
    travel: number;
    gas: number;
    online_shopping: number;
    streaming: number;
    entertainment: number;
    pharmacy: number;
    rent: number;
    other: number;
  };
  point_value_cash: number;
  point_value_travel: number;
  signup_bonus_points: number;
  signup_bonus_spend_requirement: number;
  signup_bonus_timeframe_months: number;
  foreign_transaction_fee: boolean;
  min_credit_score?: number;
  notes?: string[];
  eligibility_notes?: string[];         // hard prerequisites (Costco membership, Prime, etc.)
  mutually_exclusive_with?: string[];   // card ids that cannot be held simultaneously
  last_verified: string;
}

export interface CreditCardRecommendationCard {
  card: CreditCard;
  rank: number;
  annual_net_benefit: number;       // marginal value after adding this card (net of annual fee)
  marginal_value: number;           // vs current card portfolio
  category_breakdown: {
    category: string;
    old_rate: number;
    new_rate: number;
    monthly_spend: number;
    annual_gain: number;
  }[];
  signup_bonus_value: number;       // estimated dollar value of signup bonus
  reward_preference: "cash" | "travel";
  why_recommended: string;
  watch_out: string[];
}

// ─── Phase 10: Laptop Recommendation types ───────────────────────────────────

export type LaptopUseCase =
  | "light_productivity"
  | "software_dev"
  | "video_editing"
  | "3d_creative"
  | "gaming"
  | "data_science"
  | "business_travel";

export interface LaptopIntent extends BaseIntent {
  category: "laptop";
  use_cases: LaptopUseCase[];
  budget_usd_max: number | null;
  budget_usd_min: number | null;
  os_preference: "mac" | "windows" | "linux" | "any";
  portability_priority: "critical" | "preferred" | "flexible";
  gaming_required: boolean;
  display_size_preference: "<14" | "14-15" | "15+" | "any";
  avoid_brands: string[];
  needs_use_case_info: boolean;
}

export interface LaptopSKU {
  id: string;
  ram_gb: number;
  storage_gb: number;
  price_usd: number;
  notes?: string;
}

export interface LaptopSignalValue {
  value_raw: string | number;
  value_label: string;
  value_normalized: number; // 0-10
  raw_quote?: string;
  source: string;
  months_old: number;
}

export interface LaptopPortSelection {
  usb_c: number;
  usb_a: number;
  hdmi: boolean;
  sd_card: boolean;
  thunderbolt: boolean;
  value_normalized: number;
}

export interface LaptopDevice {
  id: string;
  name: string;
  brand: string;
  os: "mac" | "windows" | "linux";
  price_usd: number;         // base MSRP
  display_size: number;      // inches
  weight_kg: number;
  ram_gb: number;            // base config
  storage_gb: number;        // base config
  cpu: string;
  gpu: string;
  skus: LaptopSKU[];
  signals: {
    battery_life: LaptopSignalValue;
    display_quality: LaptopSignalValue;
    display_brightness: LaptopSignalValue;
    keyboard_feel: LaptopSignalValue;
    trackpad_feel: LaptopSignalValue;
    thermal_performance: LaptopSignalValue;
    fan_noise: LaptopSignalValue;
    build_quality: LaptopSignalValue;
    port_selection: LaptopPortSelection;
    weight_portability: LaptopSignalValue;
    value_for_money: LaptopSignalValue;
    cpu_benchmark: number;   // 0-10 log-scale
    gpu_benchmark: number;   // 0-10 log-scale
  };
  last_verified: string;
}

export interface LaptopSignalBreakdownItem {
  signal_type: string;
  label: string;
  score: number;       // 0-10
  weight: number;      // for primary use case
  raw_quote?: string;
  source?: string;
}

export interface LaptopRecommendationCard {
  device: LaptopDevice;
  rank: number;
  final_score: number;
  use_case_scores: Partial<Record<LaptopUseCase, number>>;
  signal_breakdown: LaptopSignalBreakdownItem[];
  recommended_sku: LaptopSKU | null;
  why_recommended: string;
  watch_out: string[];
  data_staleness_warning: boolean;
}
