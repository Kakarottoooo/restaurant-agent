import {
  CreditCardRecommendationCard,
  FlightRecommendationCard,
  HotelRecommendationCard,
  OutputLanguage,
  RecommendationCard,
  ScenarioType,
} from "../../types";

// ─── Module Results ───────────────────────────────────────────────────────────

/** All possible module outputs. Fields are empty arrays when module is not needed. */
export interface ModuleResults {
  hotels: HotelRecommendationCard[];
  flights: FlightRecommendationCard[];
  restaurants: RecommendationCard[];
  bars: RecommendationCard[];
  creditCards: CreditCardRecommendationCard[];
}

// ─── Tiered Package ───────────────────────────────────────────────────────────

/** One assembled package — one item from each module, selected for a tier. */
export interface TieredPackage {
  slot: "A" | "B" | "C";
  hotel?: HotelRecommendationCard;
  flight?: FlightRecommendationCard;
  restaurant?: RecommendationCard;
  bar?: RecommendationCard;
  creditCard?: CreditCardRecommendationCard;
}

// ─── Engine Config ────────────────────────────────────────────────────────────

/** Precomputed strings + IDs passed to the generic engine. Build with a scenario-specific factory. */
export interface EngineConfig {
  planId: string;
  scenario: ScenarioType;
  tierLabels: { A: string; B: string; C: string };
  tierFallbackReasons: { A: string; B: string; C: string };
  planTitle: string;
  planSummary: string;
  approvalPrompt: string;
  briefLines: string[];
  nights: number;
  startDate?: string;
}
