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
});

describe("parseIntent", () => {
  it("returns parsed object when MiniMax returns valid JSON", async () => {
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

  it("returns {} when MiniMax returns plain text with no JSON", async () => {
    mockFetch.mockResolvedValueOnce(
      makeMiniMaxResponse("I cannot parse that request.")
    );

    const result = await parseIntent("gibberish", "Nashville, TN");
    expect(result).toEqual({});
  });

  it("returns {} when AI returns malformed JSON", async () => {
    mockFetch.mockResolvedValueOnce(
      makeMiniMaxResponse("{cuisine: Italian, bad json}")
    );

    const result = await parseIntent("Italian food", "Nashville, TN");
    expect(result).toEqual({});
  });

  it("propagates fetch network errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    await expect(parseIntent("anything", "Nashville, TN")).rejects.toThrow(
      "Network error"
    );
  });

  it("propagates MiniMax API errors (non-ok response)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "Unauthorized",
    });

    await expect(parseIntent("anything", "Nashville, TN")).rejects.toThrow(
      "MiniMax API error"
    );
  });
});
