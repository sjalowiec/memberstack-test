import { describe, expect, it } from "vitest";

import {
  assessMailingAddress,
  classifyMemberThankYou,
  explainAnnualThankYouEligibility,
  matchesThankYouFilter,
  MEMBER_THANK_YOU_START_YMD,
  resolveThankYouRange,
  thankYouPaymentYmd,
  type ThankYouChargeInput,
} from "./memberThankYouRules";

const ANNUAL = new Set(["price_annual"]);
const MONTHLY = new Set(["price_monthly"]);

function charge(overrides: Partial<ThankYouChargeInput> = {}): ThankYouChargeInput {
  return {
    status: "succeeded",
    paid: true,
    livemode: true,
    currency: "usd",
    amount: 228,
    amountRefunded: 0,
    refunded: false,
    hasShopifyMarker: false,
    customerEmail: "member@example.com",
    lines: [
      {
        priceId: "price_annual",
        productId: "prod_annual",
        recurringInterval: "year",
        recurringIntervalCount: 1,
      },
    ],
    ...overrides,
  };
}

function decision(overrides: Partial<ThankYouChargeInput> = {}, paymentYmd = "2026-10-30") {
  return explainAnnualThankYouEligibility({
    charge: charge(overrides),
    annualPriceIds: ANNUAL,
    monthlyPriceIds: MONTHLY,
    paymentYmd,
  });
}

describe("annual thank-you eligibility", () => {
  it("keeps a succeeded live yearly annual charge", () => {
    expect(decision().eligible).toBe(true);
  });

  it("does not use the dollar amount to identify an annual membership", () => {
    expect(
      decision({
        amount: 19.99,
        lines: [
          {
            priceId: "price_annual",
            productId: "prod_annual",
            recurringInterval: "year",
            recurringIntervalCount: 1,
          },
        ],
      }).eligible,
    ).toBe(true);
    expect(
      decision({
        amount: 228,
        lines: [
          {
            priceId: "price_monthly",
            productId: "prod_monthly",
            recurringInterval: "month",
            recurringIntervalCount: 1,
          },
        ],
      }).reason,
    ).toBe("monthly_price");
  });

  it("excludes monthly, installment, refunded, failed, free, test, and unrelated charges", () => {
    expect(decision({ amountRefunded: 0.5 }).reason).toBe("refunded");
    expect(decision({ refunded: true, amountRefunded: 0 }).reason).toBe("refunded");
    expect(decision({ status: "failed" }).reason).toBe("not_succeeded");
    expect(decision({ paid: false }).reason).toBe("unpaid");
    expect(decision({ amount: 0 }).reason).toBe("zero_amount");
    expect(decision({ livemode: false }).reason).toBe("test_mode");
    expect(decision({ hasShopifyMarker: true }).reason).toBe("shopify");
    expect(decision({ customerEmail: "test@knititnow.com" }).reason).toBe("staff_or_test");
    expect(
      decision({
        lines: [
          {
            priceId: "price_course",
            productId: "prod_course",
            recurringInterval: "year",
            recurringIntervalCount: 1,
          },
        ],
      }).reason,
    ).toBe("not_annual_price");
    expect(
      decision({
        lines: [
          {
            priceId: "price_annual",
            productId: "prod_annual",
            recurringInterval: "month",
            recurringIntervalCount: 3,
          },
        ],
      }).reason,
    ).toBe("interval_not_yearly");
    expect(
      decision({
        lines: [{ priceId: "price_annual", productId: "prod_annual", recurringInterval: null }],
      }).reason,
    ).toBe("interval_unverified");
  });

  it("does not list anyone when the annual price configuration is missing", () => {
    const result = explainAnnualThankYouEligibility({
      charge: charge(),
      annualPriceIds: new Set(),
      monthlyPriceIds: MONTHLY,
      paymentYmd: "2026-10-30",
    });
    expect(result.reason).toBe("price_config_missing");
  });

  it("starts at October 30, 2026 in the Los Angeles calendar", () => {
    expect(MEMBER_THANK_YOU_START_YMD).toBe("2026-10-30");
    const before = Math.floor(Date.parse("2026-10-30T06:30:00Z") / 1000);
    const onDay = Math.floor(Date.parse("2026-10-30T15:00:00Z") / 1000);
    expect(thankYouPaymentYmd(before)).toBe("2026-10-29");
    expect(thankYouPaymentYmd(onDay)).toBe("2026-10-30");
    expect(decision({}, "2026-10-29").reason).toBe("before_start");
  });
});

describe("thank-you date range", () => {
  const now = new Date("2026-10-30T18:00:00Z");

  it("defaults to October 30, 2026 through today", () => {
    const range = resolveThankYouRange(now, null, null);
    expect(range.ok).toBe(true);
    if (!range.ok) return;
    expect(range.range.fromCivil).toBe("2026-10-30");
    expect(range.range.toCivil).toBe("2026-10-30");
  });

  it("clamps an earlier from date to the start date", () => {
    const range = resolveThankYouRange(now, "2026-01-01", "2026-10-30");
    expect(range.ok).toBe(true);
    if (!range.ok) return;
    expect(range.range.fromCivil).toBe("2026-10-30");
    expect(range.range.clamped).toBe(true);
  });
});

describe("mailing address", () => {
  it("says when no member-record address exists", () => {
    expect(assessMailingAddress(null).state).toBe("missing");
    expect(
      assessMailingAddress({
        address: null,
        address2: null,
        city: null,
        state: null,
        postalcode: null,
        country: null,
      }).state,
    ).toBe("missing");
  });

  it("requires a state and postal code for the United States", () => {
    const result = assessMailingAddress({
      address: "1 Main St",
      address2: null,
      city: "Portland",
      state: null,
      postalcode: null,
      country: "United States",
    });
    expect(result.state).toBe("incomplete");
    expect(result.note).toMatch(/state or province/);
    expect(result.note).toMatch(/postal code/);
  });

  it("accepts a Hong Kong address without a postal code or state", () => {
    const result = assessMailingAddress({
      address: "88 Queens Road",
      address2: null,
      city: "Hong Kong",
      state: null,
      postalcode: null,
      country: "Hong Kong",
    });
    expect(result.state).toBe("usable");
    expect(result.lines).toContain("Hong Kong");
  });
});

describe("new, renewing, returning, and unknown", () => {
  const base = {
    paymentYmd: "2026-10-30",
    identity: "unique" as const,
    history: "ready" as const,
    stillCovered: false,
    priorPaid: [],
  };

  it("treats a later charge on the same subscription as renewing", () => {
    expect(
      classifyMemberThankYou({
        ...base,
        billingReason: "subscription_cycle",
        identity: "ambiguous",
        history: "unavailable",
      }),
    ).toBe("renewing");
  });

  it("treats continued coverage and a monthly-to-annual change as renewing", () => {
    expect(
      classifyMemberThankYou({
        ...base,
        billingReason: "subscription_create",
        stillCovered: true,
      }),
    ).toBe("renewing");
    expect(
      classifyMemberThankYou({
        ...base,
        billingReason: "subscription_create",
        priorPaid: [
          {
            startedYmd: "2026-01-01",
            coveredThroughYmd: "2026-09-01",
            monthly: true,
            incomplete: false,
          },
        ],
      }),
    ).toBe("renewing");
  });

  it("treats a prior paid membership that had ended as returning", () => {
    expect(
      classifyMemberThankYou({
        ...base,
        billingReason: "subscription_create",
        priorPaid: [
          {
            startedYmd: "2024-01-01",
            coveredThroughYmd: "2025-01-01",
            monthly: false,
            incomplete: false,
          },
        ],
      }),
    ).toBe("returning");
  });

  it("calls the first paid membership new only when history is complete", () => {
    expect(
      classifyMemberThankYou({
        ...base,
        billingReason: "subscription_create",
        identity: "none",
      }),
    ).toBe("new");
    expect(
      classifyMemberThankYou({
        ...base,
        billingReason: "subscription_create",
        history: "unavailable",
      }),
    ).toBe("unknown");
    expect(
      classifyMemberThankYou({
        ...base,
        billingReason: "subscription_create",
        identity: "ambiguous",
      }),
    ).toBe("unknown");
  });
});

describe("thank-you filters", () => {
  const usable = { videoSent: false, cardSent: false, addressState: "usable" as const };
  const missing = { videoSent: false, cardSent: false, addressState: "missing" as const };
  const incomplete = { videoSent: false, cardSent: false, addressState: "incomplete" as const };

  it("keeps video thank-yous available without an address", () => {
    expect(matchesThankYouFilter(missing, "video")).toBe(true);
    expect(matchesThankYouFilter(incomplete, "video")).toBe(true);
  });

  it("limits card needed to an unchecked card with a usable address", () => {
    expect(matchesThankYouFilter(usable, "card")).toBe(true);
    expect(matchesThankYouFilter(missing, "card")).toBe(false);
    expect(matchesThankYouFilter(incomplete, "card")).toBe(false);
    expect(matchesThankYouFilter({ ...usable, cardSent: true }, "card")).toBe(false);
  });

  it("lists missing and incomplete addresses only while the card is unchecked", () => {
    expect(matchesThankYouFilter(missing, "address")).toBe(true);
    expect(matchesThankYouFilter(incomplete, "address")).toBe(true);
    expect(matchesThankYouFilter(usable, "address")).toBe(false);
    expect(matchesThankYouFilter({ ...missing, cardSent: true }, "address")).toBe(false);
  });

  it("completes only when both boxes are checked", () => {
    expect(
      matchesThankYouFilter({ videoSent: true, cardSent: true, addressState: "missing" }, "completed"),
    ).toBe(true);
    expect(matchesThankYouFilter({ ...usable, videoSent: true }, "completed")).toBe(false);
  });
});
