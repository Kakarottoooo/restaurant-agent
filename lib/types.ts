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
  category?: CategoryType;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  cards?: RecommendationCard[];
  hotelCards?: HotelRecommendationCard[];
  category?: "restaurant" | "hotel";
}

// ─── Phase 7: Multi-category types ───────────────────────────────────────────

export type CategoryType = "restaurant" | "hotel" | "unknown";

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

export type ParsedIntent = RestaurantIntent | HotelIntent;

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
