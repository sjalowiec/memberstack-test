import { describe, it, expect } from "vitest";

import { readStripeMembershipConfig } from "../../config/stripeMembership";
import { resolveDayRange } from "./salesReportDates";
import {
  buildStripeChargeDiagnostics,
  computeSalesReport,
  explainStripeChargeDecision,
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
    amountRequested: overrides.amountRequested ?? overrides.amount ?? 0,
    amountRefunded: 0,
    lines: [],
    hasShopifyMarker: false,
    shopifyMarkerReason: null,
    description: "",
    invoiceId: null,
    paymentIntentId: null,
    paymentMethodType: null,
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

  it("separates Shopify, Stripe collected, and membership gross/refund/net", () => {
    expect(report.summary.shopify.grossCollected).toBe(80);
    expect(report.summary.shopify.refunds).toBe(10);
    expect(report.summary.shopify.netCollected).toBe(70);
    expect(report.summary.shopify.transactionCount).toBe(2);

    // Stripe collected = membership 480.99 + DAK 99; Shopify-origin charge excluded.
    expect(report.summary.stripe.grossCollected).toBeCloseTo(579.99, 2);
    expect(report.summary.stripe.refunds).toBe(228);
    expect(report.summary.stripe.netCollected).toBeCloseTo(351.99, 2);
    expect(report.summary.stripe.transactionCount).toBe(5);

    // Membership remains the classified subset (DAK + Shopify-origin excluded).
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
    // combined net = shopify 70 + stripe 351.99
    expect(report.summary.combined.netCollected).toBeCloseTo(421.99, 2);
    expect(report.summary.combined.refunds).toBe(238);
    expect(report.summary.combined.transactionCount).toBe(7);
    expect(report.summary.combinedPartial).toBe(false);
    expect(report.stripeDiagnostics).toBeNull();
  });

  it("produces daily rows and marks today as in progress", () => {
    expect(report.daily.map((d) => d.date)).toEqual(["2026-07-30", "2026-07-31", "2026-08-01"]);
    const [d0, d1, d2] = report.daily;
    expect(d0.inProgress).toBe(false);
    expect(d1.inProgress).toBe(false);
    expect(d2.inProgress).toBe(true);

    // Jul 30: shopify 50 net, no Stripe.
    expect(d0.shopify.netCollected).toBe(50);
    expect(d0.stripe.netCollected).toBe(0);
    expect(d0.membership.netCollected).toBe(0);
    // Jul 31: monthly 19.99 membership / Stripe.
    expect(d1.membership.netCollected).toBeCloseTo(19.99, 2);
    expect(d1.stripe.netCollected).toBeCloseTo(19.99, 2);
    // Aug 1: shopify net 20 + Stripe (228 - 228 + 228 + 5 + 99 DAK) = 332 → total 352.
    expect(d2.stripe.netCollected).toBeCloseTo(332, 2);
    expect(d2.netCollected).toBeCloseTo(352, 2);
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
    // Combined excludes the unavailable Shopify figures; includes all Stripe collected.
    expect(partial.summary.combined.netCollected).toBeCloseTo(351.99, 2);
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

describe("Stripe collected-revenue regressions", () => {
  const TODAY_RANGE = (() => {
    const r = resolveDayRange({ preset: "today" }, NOW);
    if (!r.ok) throw new Error("today range setup failed");
    return r.range; // 2026-08-01 LA day: 2026-08-01T07:00:00Z .. 2026-08-02T07:00:00Z
  })();

  function reportFor(charges: NormalizedStripeCharge[]) {
    return computeSalesReport({
      range: TODAY_RANGE,
      now: NOW,
      shopifyOrders: [],
      stripeCharges: charges,
      classifyConfig: CLASSIFY,
      shopifySource: okSource("shopify"),
      stripeSource: okSource("stripe"),
    });
  }

  it("counts a normal successful Stripe payment", () => {
    const report = reportFor([
      charge({
        id: "ch_checkout",
        createdIso: "2026-08-01T15:00:00Z",
        amount: 19.99,
        lines: [{ priceId: "price_m", productId: "prod_mem" }],
      }),
    ]);
    expect(report.summary.stripe.transactionCount).toBe(1);
    expect(report.summary.stripe.netCollected).toBeCloseTo(19.99, 2);
    expect(report.summary.combined.netCollected).toBeCloseTo(19.99, 2);
  });

  it("counts a paid Stripe invoice", () => {
    const report = reportFor([
      charge({
        id: "ch_invoice",
        createdIso: "2026-08-01T15:00:00Z",
        amount: 228,
        lines: [{ priceId: "price_a", productId: "prod_mem" }],
      }),
    ]);
    expect(report.summary.stripe.transactionCount).toBe(1);
    expect(report.summary.stripe.netCollected).toBe(228);
    expect(report.summary.membership.netCollected).toBe(228);
  });

  it("counts a manually created paid invoice with no Knit It Now product", () => {
    const report = reportFor([
      charge({
        id: "ch_manual_invoice",
        createdIso: "2026-08-01T16:00:00Z",
        amount: 400,
        lines: [{ priceId: null, productId: null }],
      }),
    ]);
    expect(report.summary.stripe.transactionCount).toBe(1);
    expect(report.summary.stripe.netCollected).toBe(400);
    expect(report.summary.membership.transactionCount).toBe(0);
    expect(report.summary.combined.netCollected).toBe(400);
  });

  it("does not count failed or unpaid transactions", () => {
    const report = reportFor([
      charge({
        id: "ch_failed",
        createdIso: "2026-08-01T15:00:00Z",
        amount: 50,
        status: "failed",
        paid: false,
      }),
      charge({
        id: "ch_unpaid",
        createdIso: "2026-08-01T15:30:00Z",
        amount: 75,
        status: "pending",
        paid: false,
      }),
    ]);
    expect(report.summary.stripe.transactionCount).toBe(0);
    expect(report.summary.stripe.netCollected).toBe(0);
    expect(report.summary.combined.netCollected).toBe(0);
  });

  it("does not count the same underlying payment twice", () => {
    const paidInvoice = charge({
      id: "ch_same_payment",
      createdIso: "2026-08-01T15:00:00Z",
      amount: 150,
      lines: [{ priceId: null, productId: null }],
    });
    const report = reportFor([paidInvoice, { ...paidInvoice }]);
    expect(report.summary.stripe.transactionCount).toBe(1);
    expect(report.summary.stripe.netCollected).toBe(150);
    expect(report.summary.combined.transactionCount).toBe(1);
  });

  it("counts a transaction just inside today's Los Angeles start boundary", () => {
    // LA midnight Aug 1 2026 = 2026-08-01T07:00:00.000Z
    const report = reportFor([
      charge({
        id: "ch_just_inside",
        createdIso: "2026-08-01T07:00:00.000Z",
        amount: 25,
      }),
    ]);
    expect(report.summary.stripe.transactionCount).toBe(1);
    expect(report.summary.stripe.netCollected).toBe(25);
    expect(report.daily[0]?.date).toBe("2026-08-01");
    expect(report.daily[0]?.stripe.netCollected).toBe(25);
  });

  it("does not count a transaction just before today's Los Angeles start boundary", () => {
    const report = reportFor([
      charge({
        id: "ch_just_before",
        createdIso: "2026-08-01T06:59:59.000Z",
        amount: 25,
      }),
    ]);
    expect(report.summary.stripe.transactionCount).toBe(0);
    expect(report.summary.stripe.netCollected).toBe(0);
    expect(report.daily[0]?.stripe.netCollected).toBe(0);
  });

  it("still counts collected Stripe revenue when membership price ids are not configured", () => {
    const emptyClassify = readStripeMembershipConfig({});
    const report = computeSalesReport({
      range: TODAY_RANGE,
      now: NOW,
      shopifyOrders: [],
      stripeCharges: [
        charge({
          id: "ch_no_catalog",
          createdIso: "2026-08-01T15:00:00Z",
          amount: 80,
          lines: [],
        }),
      ],
      classifyConfig: emptyClassify,
      shopifySource: okSource("shopify"),
      stripeSource: okSource("stripe"),
    });
    expect(report.summary.stripe.netCollected).toBe(80);
    expect(report.summary.membership.transactionCount).toBe(0);
    expect(report.warnings.some((w) => w.includes("membership breakdown cannot be classified"))).toBe(
      true,
    );
  });

  it("subtracts refunds from collected revenue on the original charge date", () => {
    const report = reportFor([
      charge({
        id: "ch_refunded",
        createdIso: "2026-08-01T15:00:00Z",
        amount: 100,
        amountRefunded: 40,
      }),
    ]);
    expect(report.summary.stripe.grossCollected).toBe(100);
    expect(report.summary.stripe.refunds).toBe(40);
    expect(report.summary.stripe.netCollected).toBe(60);
    expect(report.summary.combined.refunds).toBe(40);
    expect(report.summary.combined.netCollected).toBe(60);
  });

  it("explains Shopify-marker and failed exclusions for diagnostics", () => {
    expect(
      explainStripeChargeDecision(
        charge({
          hasShopifyMarker: true,
          shopifyMarkerReason: 'metadata "order_id" contains "order_id"',
        }),
      ),
    ).toEqual({
      counted: false,
      exclusionReason: 'Shopify-origin: metadata "order_id" contains "order_id"',
    });
    expect(explainStripeChargeDecision(charge({ status: "failed", paid: false }))).toEqual({
      counted: false,
      exclusionReason: 'status is "failed"',
    });
    const rows = buildStripeChargeDiagnostics(
      [
        charge({
          id: "ch_ok",
          createdIso: "2026-08-01T15:00:00Z",
          amount: 19.99,
          description: "Subscription update",
        }),
      ],
      TODAY_RANGE,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.counted).toBe(true);
    expect(rows[0]?.exclusionReason).toBeNull();
  });

  it("counts an invoice Charge with an unknown price id in Stripe totals, not membership", () => {
    const report = reportFor([
      charge({
        id: "ch_400_invoice",
        createdIso: "2026-08-01T19:31:00Z",
        amount: 400,
        description: "Payment for Invoice",
        invoiceId: "in_manual",
        lines: [{ priceId: "price_ad_hoc", productId: "prod_ad_hoc" }],
      }),
      charge({
        id: "ch_legacy_monthly",
        createdIso: "2026-08-01T16:00:00Z",
        amount: 19.99,
        description: "Subscription update",
        lines: [{ priceId: "KIN_Monthly_SUB_2023", productId: "prod_legacy" }],
      }),
    ]);
    expect(report.summary.stripe.transactionCount).toBe(2);
    expect(report.summary.stripe.netCollected).toBeCloseTo(419.99, 2);
    expect(report.summary.membership.transactionCount).toBe(0);
  });
});
