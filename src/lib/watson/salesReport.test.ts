import { describe, it, expect } from "vitest";

import { readStripeMembershipConfig } from "../../config/stripeMembership";
import { resolveDayRange } from "./salesReportDates";
import {
  computeSalesReport,
  isCountableStripeCharge,
  type NormalizedShopifyOrder,
  type SourceStatus,
} from "./salesReport";
import type { NormalizedStripeCharge } from "./stripeReportingClient";

const NOW = new Date("2026-08-01T20:00:00Z"); // Aug 1 13:00 LA (PDT)

const RANGE = (() => {
  const r = resolveDayRange({ preset: "last3" }, NOW);
  if (!r.ok) throw new Error("range setup failed");
  return r.range; // 2026-07-30 .. 2026-08-01
})();

const CLASSIFY = readStripeMembershipConfig({
  STRIPE_MEMBERSHIP_MONTHLY_PRICE_IDS: "price_m",
  STRIPE_MEMBERSHIP_ANNUAL_PRICE_IDS: "price_a",
  STRIPE_MEMBERSHIP_PRODUCT_IDS: "prod_mem",
});

function okSource(source: "shopify" | "stripe"): SourceStatus {
  return {
    source,
    available: true,
    stale: false,
    lastAt: NOW.toISOString(),
    detail: "ok",
    error: null,
  };
}

function unavailableSource(source: "shopify" | "stripe"): SourceStatus {
  return {
    source,
    available: false,
    stale: true,
    lastAt: null,
    detail: "down",
    error: "source down",
  };
}

function charge(overrides: Partial<NormalizedStripeCharge>): NormalizedStripeCharge {
  return {
    id: overrides.id ?? "ch_1",
    created: 0,
    createdIso: overrides.createdIso ?? "2026-08-01T15:00:00Z", // Aug 1 in LA
    currency: "usd",
    livemode: true,
    status: "succeeded",
    paid: true,
    amount: 0,
    amountRefunded: 0,
    lines: [],
    hasShopifyMarker: false,
    ...overrides,
  };
}

describe("isCountableStripeCharge", () => {
  it("excludes failed, unpaid, test-mode, non-USD, and Shopify-origin charges", () => {
    expect(isCountableStripeCharge(charge({ status: "failed" }))).toBe(false);
    expect(isCountableStripeCharge(charge({ paid: false }))).toBe(false);
    expect(isCountableStripeCharge(charge({ livemode: false }))).toBe(false);
    expect(isCountableStripeCharge(charge({ currency: "cad" }))).toBe(false);
    expect(isCountableStripeCharge(charge({ hasShopifyMarker: true }))).toBe(false);
    expect(isCountableStripeCharge(charge({}))).toBe(true);
  });
});

describe("computeSalesReport", () => {
  const shopifyOrders: NormalizedShopifyOrder[] = [
    { processedAtIso: "2026-07-30T18:00:00Z", grossCollected: 50, refunds: 0 },
    { processedAtIso: "2026-08-01T16:00:00Z", grossCollected: 30, refunds: 10 }, // partial refund
  ];

  const stripeCharges: NormalizedStripeCharge[] = [
    charge({ id: "ch_month", createdIso: "2026-07-31T16:00:00Z", amount: 19.99, lines: [{ priceId: "price_m", productId: "prod_mem" }] }),
    charge({ id: "ch_annual", createdIso: "2026-08-01T16:00:00Z", amount: 228, lines: [{ priceId: "price_a", productId: "prod_mem" }] }),
    charge({ id: "ch_annual_refunded", createdIso: "2026-08-01T17:00:00Z", amount: 228, amountRefunded: 228, lines: [{ priceId: "price_a", productId: "prod_mem" }] }),
    charge({ id: "ch_other", createdIso: "2026-08-01T18:00:00Z", amount: 5, lines: [{ priceId: "price_x", productId: "prod_mem" }] }),
    // Non-membership (DAK) - must be excluded from membership revenue (dedup vs Shopify).
    charge({ id: "ch_dak", createdIso: "2026-08-01T18:30:00Z", amount: 99, lines: [{ priceId: "price_dak", productId: "prod_dak" }] }),
    // Shopify-gateway charge - must be excluded to avoid double-counting Shopify.
    charge({ id: "ch_shopify", createdIso: "2026-08-01T18:45:00Z", amount: 40, hasShopifyMarker: true, lines: [{ priceId: "price_m", productId: "prod_mem" }] }),
  ];

  const report = computeSalesReport({
    range: RANGE,
    now: NOW,
    shopifyOrders,
    stripeCharges,
    classifyConfig: CLASSIFY,
    shopifySource: okSource("shopify"),
    stripeSource: okSource("stripe"),
  });

  it("separates Shopify and membership gross/refund/net", () => {
    expect(report.summary.shopify.grossCollected).toBe(80);
    expect(report.summary.shopify.refunds).toBe(10);
    expect(report.summary.shopify.netCollected).toBe(70);
    expect(report.summary.shopify.transactionCount).toBe(2);

    // membership gross = 19.99 + 228 + 228 + 5 = 480.99 (DAK + Shopify-origin excluded)
    expect(report.summary.membership.grossCollected).toBeCloseTo(480.99, 2);
    expect(report.summary.membership.refunds).toBe(228);
    expect(report.summary.membership.netCollected).toBeCloseTo(252.99, 2);
    expect(report.summary.membership.transactionCount).toBe(4);
  });

  it("classifies monthly, annual, and other membership categories", () => {
    expect(report.membershipBreakdown.monthly.transactionCount).toBe(1);
    expect(report.membershipBreakdown.monthly.grossCollected).toBeCloseTo(19.99, 2);
    expect(report.membershipBreakdown.annual.transactionCount).toBe(2);
    expect(report.membershipBreakdown.annual.grossCollected).toBe(456);
    expect(report.membershipBreakdown.annual.refunds).toBe(228);
    expect(report.membershipBreakdown.other.transactionCount).toBe(1);
    expect(report.membershipBreakdown.other.grossCollected).toBe(5);
  });

  it("computes a combined net and combined refunds", () => {
    // combined net = shopify 70 + membership 252.99
    expect(report.summary.combined.netCollected).toBeCloseTo(322.99, 2);
    expect(report.summary.combined.refunds).toBe(238);
    expect(report.summary.combined.transactionCount).toBe(6);
    expect(report.summary.combinedPartial).toBe(false);
  });

  it("produces daily rows and marks today as in progress", () => {
    expect(report.daily.map((d) => d.date)).toEqual(["2026-07-30", "2026-07-31", "2026-08-01"]);
    const [d0, d1, d2] = report.daily;
    expect(d0.inProgress).toBe(false);
    expect(d1.inProgress).toBe(false);
    expect(d2.inProgress).toBe(true);

    // Jul 30: shopify 50 net, no membership.
    expect(d0.shopify.netCollected).toBe(50);
    expect(d0.membership.netCollected).toBe(0);
    // Jul 31: monthly 19.99 membership.
    expect(d1.membership.netCollected).toBeCloseTo(19.99, 2);
    // Aug 1: shopify net 20 + membership (228 - 228 + 228 + 5) = 233 ? total 253.
    expect(d2.netCollected).toBeCloseTo(253, 2);
  });

  it("does not silently zero an unavailable source; warns and marks partial", () => {
    const partial = computeSalesReport({
      range: RANGE,
      now: NOW,
      shopifyOrders,
      stripeCharges,
      classifyConfig: CLASSIFY,
      shopifySource: unavailableSource("shopify"),
      stripeSource: okSource("stripe"),
    });
    expect(partial.summary.combinedPartial).toBe(true);
    // Combined excludes the unavailable Shopify figures.
    expect(partial.summary.combined.netCollected).toBeCloseTo(252.99, 2);
    expect(partial.warnings.some((w) => w.includes("Shopify data unavailable"))).toBe(true);
  });

  it("warns when a source is stale", () => {
    const stale = computeSalesReport({
      range: RANGE,
      now: NOW,
      shopifyOrders,
      stripeCharges: [],
      classifyConfig: CLASSIFY,
      shopifySource: { ...okSource("shopify"), stale: true, detail: "18h ago" },
      stripeSource: okSource("stripe"),
    });
    expect(stale.warnings.some((w) => w.includes("Shopify data may be stale"))).toBe(true);
  });
});
