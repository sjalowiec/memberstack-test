import { describe, it, expect } from "vitest";

import { readStripeMembershipConfig } from "../../config/stripeMembership";
import { resolveDayRange } from "./salesReportDates";
import {
  buildStripeChargeDiagnostics,
  computeSalesReport,
  explainStripeChargeDecision,
  loadSalesReport,
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
    billingReason: null,
    channel: "other",
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
    expect(report.reconciliation.matchesSummary).toBe(true);
    expect(report.transactions.some((row) => row.id === "ch_shopify" && !row.counted)).toBe(true);
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
          shopifyMarkerReason: "Shopify Payments metadata (shop_id/shop_name + order_id)",
        }),
      ),
    ).toEqual({
      counted: false,
      exclusionReason: "Shopify-origin: Shopify Payments metadata (shop_id/shop_name + order_id)",
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

describe("authoritative combined-revenue cases", () => {
  const TODAY_RANGE = (() => {
    const r = resolveDayRange({ preset: "today" }, NOW);
    if (!r.ok) throw new Error("today range setup failed");
    return r.range;
  })();

  function reportFor(input: {
    shopifyOrders?: NormalizedShopifyOrder[];
    stripeCharges?: NormalizedStripeCharge[];
    shopifySource?: SourceStatus;
  }) {
    return computeSalesReport({
      range: TODAY_RANGE,
      now: NOW,
      shopifyOrders: input.shopifyOrders ?? [],
      stripeCharges: input.stripeCharges ?? [],
      classifyConfig: CLASSIFY,
      shopifySource: input.shopifySource ?? okSource("shopify"),
      stripeSource: okSource("stripe"),
    });
  }

  it("includes a collected Shopify order", () => {
    const report = reportFor({
      shopifyOrders: [
        {
          id: "gid-1",
          orderName: "#1033",
          processedAtIso: "2026-08-01T18:42:00Z",
          grossCollected: 330,
          refunds: 0,
          financialStatus: "paid",
        },
      ],
    });
    expect(report.summary.shopify.netCollected).toBe(330);
    expect(report.summary.shopify.transactionCount).toBe(1);
    expect(report.transactions.find((row) => row.id === "gid-1")?.counted).toBe(true);
  });

  it("counts a Shopify order processed after an earlier sync timestamp", () => {
    const report = reportFor({
      shopifyOrders: [
        {
          id: "late-order",
          orderName: "#1033",
          processedAtIso: "2026-08-01T18:42:49Z",
          grossCollected: 330,
          refunds: 0,
          financialStatus: "paid",
        },
      ],
      shopifySource: {
        ...okSource("shopify"),
        lastAt: "2026-08-01T18:02:00Z",
        detail: "Retrieved live from Shopify (1 orders in range).",
      },
    });
    expect(report.summary.shopify.netCollected).toBe(330);
    expect(report.sources.shopify.stale).toBe(false);
  });

  it("counts Stripe Checkout, payment link, subscription, and paid invoice channels", () => {
    const report = reportFor({
      stripeCharges: [
        charge({
          id: "ch_checkout",
          createdIso: "2026-08-01T15:00:00Z",
          amount: 25,
          description: "Checkout payment",
          channel: "checkout",
        }),
        charge({
          id: "ch_plink",
          createdIso: "2026-08-01T15:10:00Z",
          amount: 14.99,
          description: "",
          channel: "payment_link",
        }),
        charge({
          id: "ch_sub",
          createdIso: "2026-08-01T15:20:00Z",
          amount: 19.99,
          description: "Subscription update",
          invoiceId: "in_sub",
          billingReason: "subscription_cycle",
          channel: "subscription",
          lines: [{ priceId: "price_m", productId: "prod_mem" }],
        }),
        charge({
          id: "ch_invoice",
          createdIso: "2026-08-01T15:30:00Z",
          amount: 120,
          description: "Payment for Invoice",
          invoiceId: "in_manual",
          billingReason: "manual",
          channel: "invoice",
        }),
      ],
    });
    expect(report.summary.stripe.transactionCount).toBe(4);
    expect(report.summary.stripe.netCollected).toBeCloseTo(179.98, 2);
    expect(report.transactions.filter((row) => row.channel === "checkout" && row.counted)).toHaveLength(1);
    expect(report.transactions.filter((row) => row.channel === "payment_link" && row.counted)).toHaveLength(1);
    expect(report.transactions.filter((row) => row.channel === "subscription" && row.counted)).toHaveLength(1);
    expect(report.transactions.filter((row) => row.channel === "invoice" && row.counted)).toHaveLength(1);
  });

  it("excludes a Shopify-originated Stripe charge exactly once when the Shopify order is also present", () => {
    const report = reportFor({
      shopifyOrders: [
        {
          id: "shop-1",
          orderName: "#1001",
          processedAtIso: "2026-08-01T16:00:00Z",
          grossCollected: 40,
          refunds: 0,
          financialStatus: "paid",
        },
      ],
      stripeCharges: [
        charge({
          id: "ch_shopify_gateway",
          createdIso: "2026-08-01T16:00:00Z",
          amount: 40,
          hasShopifyMarker: true,
          shopifyMarkerReason: 'description contains "shopify"',
          description: "Shopify order #1001",
        }),
      ],
    });
    expect(report.summary.shopify.netCollected).toBe(40);
    expect(report.summary.stripe.netCollected).toBe(0);
    expect(report.summary.combined.netCollected).toBe(40);
    expect(report.summary.combined.transactionCount).toBe(1);
    expect(report.transactions.filter((row) => row.counted)).toHaveLength(1);
    expect(
      report.transactions.find((row) => row.id === "ch_shopify_gateway")?.exclusionReason,
    ).toMatch(/Shopify-origin/);
  });

  it("does not treat a legitimate Stripe invoice with only order_id metadata as Shopify", () => {
    const report = reportFor({
      stripeCharges: [
        charge({
          id: "ch_legit_invoice",
          createdIso: "2026-08-01T16:00:00Z",
          amount: 120,
          description: "Payment for Invoice",
          invoiceId: "in_manual",
          hasShopifyMarker: false,
          channel: "invoice",
        }),
      ],
    });
    expect(report.summary.stripe.netCollected).toBe(120);
    expect(report.transactions.find((row) => row.id === "ch_legit_invoice")?.counted).toBe(true);
  });

  it("attributes a partial refund and a full refund to the original charge date", () => {
    const report = reportFor({
      stripeCharges: [
        charge({
          id: "ch_partial",
          createdIso: "2026-08-01T15:00:00Z",
          amount: 100,
          amountRefunded: 40,
        }),
        charge({
          id: "ch_full",
          createdIso: "2026-08-01T15:10:00Z",
          amount: 14.99,
          amountRefunded: 14.99,
        }),
      ],
    });
    expect(report.summary.stripe.grossCollected).toBeCloseTo(114.99, 2);
    expect(report.summary.stripe.refunds).toBeCloseTo(54.99, 2);
    expect(report.summary.stripe.netCollected).toBe(60);
  });

  it("combines Shopify and Stripe totals and reconciles to the transaction table", () => {
    const report = reportFor({
      shopifyOrders: [
        {
          id: "shop-330",
          orderName: "#1033",
          processedAtIso: "2026-08-01T18:42:00Z",
          grossCollected: 330,
          refunds: 0,
          financialStatus: "paid",
        },
      ],
      stripeCharges: [
        charge({
          id: "ch_invoice",
          createdIso: "2026-08-01T22:16:00Z",
          amount: 120,
          description: "Payment for Invoice",
          channel: "invoice",
        }),
        charge({
          id: "ch_failed",
          createdIso: "2026-08-01T22:35:00Z",
          amount: 0,
          amountRequested: 1050,
          status: "failed",
          paid: false,
        }),
      ],
    });
    expect(report.summary.combined.grossCollected).toBe(450);
    expect(report.summary.combined.netCollected).toBe(450);
    expect(report.summary.combined.transactionCount).toBe(2);
    expect(report.reconciliation.matchesSummary).toBe(true);
    expect(report.reconciliation.netCollected).toBe(report.summary.combined.netCollected);
  });

  it("uses America/Los_Angeles date boundaries", () => {
    const justInside = reportFor({
      stripeCharges: [
        charge({ id: "ch_inside", createdIso: "2026-08-01T07:00:00.000Z", amount: 25 }),
      ],
    });
    const justBefore = reportFor({
      stripeCharges: [
        charge({ id: "ch_before", createdIso: "2026-08-01T06:59:59.000Z", amount: 25 }),
      ],
    });
    expect(justInside.summary.stripe.netCollected).toBe(25);
    expect(justBefore.summary.stripe.netCollected).toBe(0);
    expect(justBefore.transactions.find((row) => row.id === "ch_before")?.counted).toBe(false);
  });

  it("warns when the Shopify source is stale", () => {
    const report = reportFor({
      shopifyOrders: [
        {
          processedAtIso: "2026-08-01T12:00:00Z",
          grossCollected: 10,
          refunds: 0,
        },
      ],
      shopifySource: {
        ...okSource("shopify"),
        stale: true,
        detail: "Last successful Shopify sync 7.0h ago.",
      },
    });
    expect(report.warnings.some((warning) => warning.includes("Shopify data may be stale"))).toBe(
      true,
    );
  });

  it("includes a live Shopify order that is absent from synced Postgres", async () => {
    const fetchImpl = (async (url: string) => {
      const href = String(url);
      if (href.includes("/orders.json")) {
        return new Response(
          JSON.stringify({
            orders: [
              {
                id: 7079594229954,
                name: "#1033",
                order_number: 1033,
                processed_at: "2026-08-01T18:42:49Z",
                created_at: "2026-08-01T18:42:51Z",
                financial_status: "paid",
                cancelled_at: null,
                total_price: "330.00",
                total_refunded: "0.00",
                currency: "USD",
                line_items: [],
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (href.includes("/invoices")) {
        return new Response(JSON.stringify({ data: [], has_more: false }), { status: 200 });
      }
      if (href.includes("/charges")) {
        return new Response(JSON.stringify({ data: [], has_more: false }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;

    const report = await loadSalesReport({
      range: TODAY_RANGE,
      now: NOW,
      queryFn: async () => {
        throw new Error("postgres should not be used when live Shopify succeeds");
      },
      fetchImpl,
      env: {
        STRIPE_SECRET_KEY: "sk_test",
        SHOPIFY_STORE_DOMAIN: "example.myshopify.com",
        SHOPIFY_ADMIN_ACCESS_TOKEN: "shpat_test",
      },
    });
    expect(report.sources.shopify.detail).toMatch(/Retrieved live from Shopify/);
    expect(report.summary.shopify.netCollected).toBe(330);
    expect(report.summary.shopify.transactionCount).toBe(1);
    expect(report.reconciliation.matchesSummary).toBe(true);
  });

  it("falls back to synced Shopify orders when live Admin API is not configured", async () => {
    const fetchImpl = (async (url: string) => {
      const href = String(url);
      if (href.includes("/invoices") || href.includes("/charges")) {
        return new Response(JSON.stringify({ data: [], has_more: false }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;

    const report = await loadSalesReport({
      range: TODAY_RANGE,
      now: NOW,
      queryFn: async () => [
        {
          shopify_order_id: "sync-1",
          order_name: "#1000",
          order_number: "1000",
          processed_at: "2026-08-01T12:00:00Z",
          total_price: "50.00",
          total_refunded: "0",
          financial_status: "paid",
          cancelled_at: null,
        },
      ],
      fetchImpl,
      env: {
        STRIPE_SECRET_KEY: "sk_test",
      },
    });
    expect(report.sources.shopify.detail).toMatch(/Live Shopify unavailable/);
    expect(report.summary.shopify.netCollected).toBe(50);
    expect(report.reconciliation.matchesSummary).toBe(true);
  });
});
