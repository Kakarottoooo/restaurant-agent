export interface UserRequirements {
  cuisine?: string;
  purpose?: string; // date, business, family, friends, solo
  budget_per_person?: number;
  budget_total?: number;
  atmosphere?: string[];
  noise_level?: "quiet" | "moderate" | "lively" | "any";
  location?: string;
  neighborhood?: string;
  party_size?: number;
  constraints?: string[]; // no chains, no tourist traps, etc.
  priorities?: string[]; // what matters most
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
  is_closed: boolean;
  distance?: number;
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
}

export interface AgentResponse {
  requirements: UserRequirements;
  recommendations: RecommendationCard[];
  summary: string;
}
