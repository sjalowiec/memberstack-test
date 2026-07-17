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

  it("stores Basic monthly intent with price id and return URL", () => {
    stubSessionStorage();
    const intent = buildPendingMembershipCheckout(
      "basicMonthly",
      "https://example.com/membership",
      1_000,
    );
    savePendingMembershipCheckout(intent);

    const peeked = peekPendingMembershipCheckout(1_000);
    expect(peeked).toEqual({
      version: 1,
      planKey: "basicMonthly",
      priceId: MEMBERSHIP_PRICE_IDS.basicMonthly,
      label: "Basic Monthly",
      returnUrl: "https://example.com/membership",
      createdAt: 1_000,
    });
    expect(sessionStorage.getItem(PENDING_MEMBERSHIP_CHECKOUT_KEY)).toBeTruthy();
  });

  it("stores Premium annual intent", () => {
    stubSessionStorage();
    savePendingMembershipCheckout(
      buildPendingMembershipCheckout("premiumAnnual", "https://example.com/join", 2_000),
    );
    expect(peekPendingMembershipCheckout(2_000)?.planKey).toBe("premiumAnnual");
    expect(peekPendingMembershipCheckout(2_000)?.priceId).toBe(
      MEMBERSHIP_PRICE_IDS.premiumAnnual,
    );
  });

  it("survives across peek until consumed or cleared", () => {
    stubSessionStorage();
    savePendingMembershipCheckout(
      buildPendingMembershipCheckout("basicMonthly", "https://example.com/m", 5_000),
    );
    expect(peekPendingMembershipCheckout(5_000)?.planKey).toBe("basicMonthly");
    expect(peekPendingMembershipCheckout(5_000)?.planKey).toBe("basicMonthly");

    const consumed = consumePendingMembershipCheckout(5_000);
    expect(consumed?.planKey).toBe("basicMonthly");
    expect(peekPendingMembershipCheckout(5_000)).toBeNull();
  });

  it("expires stale pending checkout", () => {
    stubSessionStorage();
    savePendingMembershipCheckout(
      buildPendingMembershipCheckout("premiumMonthly", "https://example.com/m", 10_000),
    );
    expect(
      peekPendingMembershipCheckout(10_000 + PENDING_MEMBERSHIP_CHECKOUT_TTL_MS + 1),
    ).toBeNull();
  });
});
