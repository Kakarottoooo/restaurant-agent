import { describe, it, expect } from "vitest";
import { getScoreAdjustments } from "../scenario2";

describe("getScoreAdjustments", () => {
  it("returns empty object when ENABLE_SCORE_ADJUSTMENTS is not set", async () => {
    delete process.env.ENABLE_SCORE_ADJUSTMENTS;
    const result = await getScoreAdjustments("date_night", "Nashville");
    expect(result).toEqual({});
  });

  it("returns empty object when ENABLE_SCORE_ADJUSTMENTS is unset, regardless of scenario", async () => {
    delete process.env.ENABLE_SCORE_ADJUSTMENTS;
    const scenarios = ["date_night", "big_purchase", "weekend_trip", "city_trip"] as const;
    for (const s of scenarios) {
      const result = await getScoreAdjustments(s, "Austin");
      expect(result).toEqual({});
    }
  });

  it("returns empty object when ENABLE_SCORE_ADJUSTMENTS is unset for any city", async () => {
    delete process.env.ENABLE_SCORE_ADJUSTMENTS;
    const result = await getScoreAdjustments("date_night", "");
    expect(result).toEqual({});
  });

  it("does not throw even with null-ish city string", async () => {
    delete process.env.ENABLE_SCORE_ADJUSTMENTS;
    await expect(getScoreAdjustments("big_purchase", "   ")).resolves.toEqual({});
  });

  it("stub returns a plain object (not null, not undefined)", async () => {
    delete process.env.ENABLE_SCORE_ADJUSTMENTS;
    const result = await getScoreAdjustments("date_night", "Chicago");
    expect(result).not.toBeNull();
    expect(typeof result).toBe("object");
  });
});
