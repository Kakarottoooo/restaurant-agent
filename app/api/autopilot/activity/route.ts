/**
 * POST /api/autopilot/activity
 *
 * Finds a local activity/experience using Google Places.
 * Returns the same AutopilotResult shape used by other autopilot routes
 * so the agent-runtime find_activity skill and the start route can consume it identically.
 *
 * Categories map to Google Places types:
 *   cocktail_bar     → bar
 *   dessert_cafe     → bakery | cafe
 *   scenic_walk      → park
 *   museum           → museum
 *   food_tour        → restaurant (walking tour query)
 *   sightseeing      → tourist_attraction
 *   outdoor          → park | amusement_park
 *   show             → movie_theater | night_club
 */

import { NextRequest, NextResponse } from "next/server";
import { googlePlacesSearch } from "@/lib/tools";

const CATEGORY_QUERY: Record<string, string> = {
  cocktail_bar:  "cocktail bar speakeasy",
  dessert_cafe:  "dessert cafe pastry",
  scenic_walk:   "scenic park waterfront walk",
  museum:        "museum art gallery",
  food_tour:     "food tour experience",
  sightseeing:   "tourist attraction landmark",
  outdoor:       "outdoor park garden experience",
  show:          "theater show performance",
  bar:           "bar lounge",
  default:       "local experience activity",
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    destination?: string;
    date?: string;
    category?: string;
    partySize?: number;
    maxBudgetPerPerson?: number;
    notes?: string;
    avoidTypes?: string[];
    targetName?: string;
  };

  const {
    destination = "New York",
    category = "default",
    partySize = 2,
    targetName,
  } = body;

  const baseQuery = targetName ?? CATEGORY_QUERY[category] ?? CATEGORY_QUERY.default;
  const query = `${baseQuery} in ${destination}`;

  try {
    const results = await googlePlacesSearch({
      query,
      location: destination,
      maxResults: 5,
    });

    const candidates = results
      .filter((r) => r.rating >= 4.0)
      .sort((a, b) => b.rating - a.rating);

    const top = candidates[0];

    if (!top) {
      return NextResponse.json({
        status: "no_availability",
        error: `No ${category} found in ${destination}`,
        actionItem: `Browse GetYourGuide or Google for ${category} in ${destination}`,
      });
    }

    // Build handoff URL — deep link to Google Maps / website
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${top.name} ${destination}`)}`;
    const handoffUrl = top.url ?? searchUrl;

    return NextResponse.json({
      status: "ready",
      activityName: top.name,
      provider: "Google Places",
      handoffUrl,
      address: top.address,
      rating: top.rating,
      reviewCount: top.review_count,
      // Suggest a start time based on category (rough heuristic)
      startTime: category === "cocktail_bar" || category === "bar" ? "21:00" :
                 category === "dessert_cafe"                       ? "21:30" :
                 category === "scenic_walk"                        ? "20:00" : "10:00",
      partySize,
    });
  } catch (err) {
    console.error("activity autopilot error", err);
    return NextResponse.json({
      status: "error",
      error: err instanceof Error ? err.message : "Activity search failed",
    });
  }
}
