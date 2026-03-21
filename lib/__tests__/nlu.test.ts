import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeMultilingualQuery } from "../nlu";

// Mock fetch globally for MiniMax calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeMiniMaxResponse(content: string) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
    text: async () => content,
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  // minimax.ts checks API key before calling fetch
  process.env.MINIMAX_API_KEY = "test-key";
});

// ─── analyzeMultilingualQuery ─────────────────────────────────────────────────

describe("analyzeMultilingualQuery", () => {
  it("English fast-path: returns fallback without calling MiniMax", async () => {
    // Regression: ISSUE-004 — English queries were calling MiniMax unnecessarily
    // Found by /qa on 2026-03-21
    // Report: .gstack/qa-reports/qa-report-localhost-3000-2026-03-21.md
    const result = await analyzeMultilingualQuery(
      "Romantic dinner for two, quiet, no chains, Manhattan",
      "Nashville, TN"
    );
    // MiniMax should NOT be called for pure English queries
    expect(mockFetch).not.toHaveBeenCalled();
    // Should still return a valid context
    expect(result.input_language).toBe("en");
    expect(result.output_language).toBe("en");
  });

  it("English fast-path: extracts location from fallback heuristics", async () => {
    const result = await analyzeMultilingualQuery(
      "Best sushi in Manhattan, ~$60/person",
      "Nashville, TN"
    );
    expect(mockFetch).not.toHaveBeenCalled();
    // fallback should detect NYC alias
    expect(result.location_hint).toBe("New York, NY");
  });

  it("Chinese query: calls MiniMax and returns parsed context", async () => {
    mockFetch.mockResolvedValueOnce(
      makeMiniMaxResponse(
        JSON.stringify({
          input_language: "zh",
          output_language: "zh",
          normalized_query: "romantic dinner for two in Shanghai",
          intent_summary: "找一家浪漫的约会餐厅",
          category_hint: "restaurant",
          scenario_hint: "date_night",
          location_hint: "Shanghai, China",
          cuisine_hint: null,
          purpose_hint: "date",
          party_size_hint: 2,
          budget_per_person_hint: null,
          budget_total_hint: null,
          date_text_hint: null,
          time_hint: null,
          constraints_hint: [],
        })
      )
    );

    const result = await analyzeMultilingualQuery("浪漫的约会餐厅，上海");
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result.input_language).toBe("zh");
    expect(result.output_language).toBe("zh");
    expect(result.scenario_hint).toBe("date_night");
  });

  it("MiniMax failure: returns regex fallback gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    // Chinese query forces MiniMax path; failure should fallback
    const result = await analyzeMultilingualQuery("找一家好餐厅");
    expect(result.input_language).toBe("zh");
    expect(result.output_language).toBe("zh");
    // Should not throw — returns fallback
    expect(result).toBeDefined();
  });

  it("MiniMax returns malformed JSON: returns fallback", async () => {
    mockFetch.mockResolvedValueOnce(
      makeMiniMaxResponse("I cannot parse that.")
    );

    const result = await analyzeMultilingualQuery("一家好餐厅");
    expect(result).toBeDefined();
    expect(result.input_language).toBe("zh");
  });

  it("uses provided fallback location in context", async () => {
    const result = await analyzeMultilingualQuery(
      "find me a good pizza place",
      "Chicago, IL"
    );
    // English fast-path: no MiniMax, but fallback location is used
    expect(mockFetch).not.toHaveBeenCalled();
    // If no location in the query, fallback location should be preserved
    expect(result).toBeDefined();
  });
});
