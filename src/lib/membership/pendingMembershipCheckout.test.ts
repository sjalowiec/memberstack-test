import { afterEach, describe, expect, it } from "vitest";
import { MEMBERSHIP_PRICE_IDS } from "../../config/memberships";
import { stubSessionStorage } from "../patterns/test/stubLocalStorage";
import {
  PENDING_MEMBERSHIP_CHECKOUT_KEY,
  PENDING_MEMBERSHIP_CHECKOUT_TTL_MS,
  buildPendingMembershipCheckout,
  clearPendingMembershipCheckout,
  consumePendingMembershipCheckout,
  peekPendingMembershipCheckout,
  savePendingMembershipCheckout,
} from "./pendingMembershipCheckout";

describe("pendingMembershipCheckout", () => {
  afterEach(() => {
    clearPendingMembershipCheckout();
  });

  it("stores monthly intent with price id and return URL", () => {
    stubSessionStorage();
    const intent = buildPendingMembershipCheckout(
      "monthly",
      "https://example.com/membership",
      1_000,
    );
    savePendingMembershipCheckout(intent);

    const peeked = peekPendingMembershipCheckout(1_000);
    expect(peeked).toEqual({
      version: 1,
      planKey: "monthly",
      priceId: MEMBERSHIP_PRICE_IDS.monthly,
      label: "Membership Monthly",
      returnUrl: "https://example.com/membership",
      createdAt: 1_000,
    });
    expect(sessionStorage.getItem(PENDING_MEMBERSHIP_CHECKOUT_KEY)).toBeTruthy();
  });

  it("stores annual intent", () => {
    stubSessionStorage();
    savePendingMembershipCheckout(
      buildPendingMembershipCheckout("annual", "https://example.com/join", 2_000),
    );
    expect(peekPendingMembershipCheckout(2_000)?.planKey).toBe("annual");
    expect(peekPendingMembershipCheckout(2_000)?.priceId).toBe(MEMBERSHIP_PRICE_IDS.annual);
  });

  it("survives across peek until consumed or cleared", () => {
    stubSessionStorage();
    savePendingMembershipCheckout(
      buildPendingMembershipCheckout("monthly", "https://example.com/m", 5_000),
    );
    expect(peekPendingMembershipCheckout(5_000)?.planKey).toBe("monthly");
    expect(peekPendingMembershipCheckout(5_000)?.planKey).toBe("monthly");

    const consumed = consumePendingMembershipCheckout(5_000);
    expect(consumed?.planKey).toBe("monthly");
    expect(peekPendingMembershipCheckout(5_000)).toBeNull();
  });

  it("expires stale pending checkout", () => {
    stubSessionStorage();
    savePendingMembershipCheckout(
      buildPendingMembershipCheckout("monthly", "https://example.com/m", 10_000),
    );
    expect(
      peekPendingMembershipCheckout(10_000 + PENDING_MEMBERSHIP_CHECKOUT_TTL_MS + 1),
    ).toBeNull();
  });
});
