import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseIntent } from "../agent";

// Mock fetch globally
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
  // minimax.ts checks MINIMAX_API_KEY before calling fetch
  process.env.MINIMAX_API_KEY = "test-key";
});

describe("parseIntent", () => {
  // Note: parseIntent → detectCategory (MiniMax call #1 for unrecognized messages) →
  //       parseRestaurantIntent (MiniMax call #2). "romantic Italian dinner" hits
  //       restaurant keywords, skipping the detectCategory MiniMax call (1 total).
  // Unrecognized messages like "gibberish" need 2 mocked responses.

  it("returns parsed object when MiniMax returns valid JSON", async () => {
    // "romantic Italian dinner" matches restaurant keywords → no detectCategory MiniMax call
    mockFetch.mockResolvedValueOnce(
      makeMiniMaxResponse(
        '{"cuisine":"Italian","purpose":"date","budget_per_person":60}'
      )
    );

    const result = await parseIntent("romantic Italian dinner, ~$60", "Nashville, TN");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).cuisine).toBe("Italian");
    expect(result.purpose).toBe("date");
    expect(result.budget_per_person).toBe(60);
  });

  it("returns default restaurant intent when MiniMax returns plain text with no JSON", async () => {
    // "gibberish" misses all keywords → detectCategory calls MiniMax (#1), then parseRestaurantIntent (#2)
    // parseRestaurantIntent falls back to a default intent when it can't parse JSON
    mockFetch
      .mockResolvedValueOnce(makeMiniMaxResponse('"restaurant"'))         // detectCategory
      .mockResolvedValueOnce(makeMiniMaxResponse("I cannot parse that.")); // parseRestaurantIntent

    const result = await parseIntent("gibberish", "Nashville, TN");
    expect(result).toMatchObject({ category: "restaurant" });
  });

  it("returns default restaurant intent when AI returns malformed JSON", async () => {
    // "Italian food" misses keywords → detectCategory calls MiniMax (#1), then parseRestaurantIntent (#2)
    // parseRestaurantIntent falls back to a default intent on JSON parse failure
    mockFetch
      .mockResolvedValueOnce(makeMiniMaxResponse('"restaurant"'))               // detectCategory
      .mockResolvedValueOnce(makeMiniMaxResponse("{cuisine: Italian, bad json}")); // parseRestaurantIntent

    const result = await parseIntent("Italian food", "Nashville, TN");
    expect(result).toMatchObject({ category: "restaurant" });
  });

  it("propagates fetch network errors from parseRestaurantIntent", async () => {
    // "romantic dinner" hits restaurant keywords → only parseRestaurantIntent calls MiniMax
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    await expect(parseIntent("romantic dinner in Paris", "Nashville, TN")).rejects.toThrow(
      "Network error"
    );
  });

  it("propagates MiniMax API errors (non-ok response) from parseRestaurantIntent", async () => {
    // "romantic dinner" hits restaurant keywords → only parseRestaurantIntent calls MiniMax
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "Unauthorized",
    });

    await expect(parseIntent("romantic dinner in Paris", "Nashville, TN")).rejects.toThrow(
      "MiniMax API error"
    );
  });
});
