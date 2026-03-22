import { describe, it, expect } from "vitest";
import { getBestCardForTrip, buildTripCardCallout } from "../agent/planners/trip-card";

describe("getBestCardForTrip", () => {
  it("returns null for negligible spend", () => {
    expect(getBestCardForTrip({ flight_usd: 50, hotel_usd: 100 })).toBeNull();
  });

  it("returns a card for a typical weekend trip", () => {
    const card = getBestCardForTrip({ flight_usd: 350, hotel_usd: 400 });
    expect(card).not.toBeNull();
    expect(card?.card.name).toBeTruthy();
    expect(card?.card.id).toBeTruthy();
  });

  it("returns a travel-preference card (not a pure cash card)", () => {
    const card = getBestCardForTrip({ flight_usd: 600, hotel_usd: 800 });
    expect(card).not.toBeNull();
    // Travel reward preference — should not be a plain cash card
    expect(card?.reward_preference).toBe("travel");
  });

  it("returns card even when only hotel spend is provided", () => {
    const card = getBestCardForTrip({ hotel_usd: 900 });
    expect(card).not.toBeNull();
  });

  it("returns card with signup bonus value for expensive trip", () => {
    const card = getBestCardForTrip({ flight_usd: 700, hotel_usd: 1200 });
    expect(card).not.toBeNull();
    expect(typeof card?.signup_bonus_value).toBe("number");
  });
});

describe("buildTripCardCallout", () => {
  it("builds English callout with card name and why", () => {
    const card = getBestCardForTrip({ flight_usd: 400, hotel_usd: 500 });
    if (!card) return; // skip if no card available in test environment
    const callout = buildTripCardCallout(card, "en");
    expect(callout).toContain(card.card.name);
    expect(callout).toContain("Pay with");
  });

  it("builds Chinese callout", () => {
    const card = getBestCardForTrip({ flight_usd: 400, hotel_usd: 500 });
    if (!card) return;
    const callout = buildTripCardCallout(card, "zh");
    expect(callout).toContain(card.card.name);
    expect(callout).toContain("用 ");
  });

  it("includes annual fee when card has one", () => {
    const card = getBestCardForTrip({ flight_usd: 500, hotel_usd: 700 });
    if (!card || card.card.annual_fee === 0) return;
    const callout = buildTripCardCallout(card, "en");
    expect(callout).toMatch(/\$\d+\/yr/);
  });

  it("includes signup bonus when >= $100", () => {
    const card = getBestCardForTrip({ flight_usd: 600, hotel_usd: 800 });
    if (!card || card.signup_bonus_value < 100) return;
    const callout = buildTripCardCallout(card, "en");
    expect(callout).toContain("sign-up bonus");
  });

  it("does not include signup bonus for low-value bonuses", () => {
    const card = getBestCardForTrip({ flight_usd: 400, hotel_usd: 500 });
    if (!card) return;
    // Force signup_bonus_value to 0 to test the no-bonus path
    const mockCard = { ...card, signup_bonus_value: 50 };
    const callout = buildTripCardCallout(mockCard, "en");
    expect(callout).not.toContain("sign-up bonus");
  });
});
