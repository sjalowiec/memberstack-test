import { describe, it, expect } from "vitest";

import {
  classifyStripePaymentChannel,
  describeStripeConnectionError,
  describeStripeHttpError,
  detectShopifyMarker,
  fetchStripeChargesInRange,
  isStripeTlsInsecureFlagEnabled,
  normalizeStripeCharge,
  readStripeReportingConfig,
  shouldUseStripeTlsInsecure,
  stripeMinorToMajor,
  summarizeStripeFetchCause,
} from "./stripeReportingClient";

describe("readStripeReportingConfig", () => {
  it("returns an error when STRIPE_SECRET_KEY is missing", () => {
    const result = readStripeReportingConfig({});
    expect("error" in result).toBe(true);
  });

  it("returns config when the key is present", () => {
    const result = readStripeReportingConfig({ STRIPE_SECRET_KEY: "sk_test_123" });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.secretKey).toBe("sk_test_123");
    expect(result.apiBase).toContain("api.stripe.com");
  });
});

describe("stripeMinorToMajor", () => {
  it("converts cents to dollars for decimal currencies", () => {
    expect(stripeMinorToMajor(1999, "usd")).toBe(19.99);
    expect(stripeMinorToMajor(22800, "usd")).toBe(228);
  });

  it("keeps zero-decimal currencies as-is", () => {
    expect(stripeMinorToMajor(1000, "jpy")).toBe(1000);
  });
});

describe("normalizeStripeCharge", () => {
  it("extracts money, line price/product refs, and Shopify markers", () => {
    const normalized = normalizeStripeCharge({
      id: "ch_1",
      amount: 22800,
      amount_refunded: 5000,
      currency: "USD",
      created: 1_764_600_000,
      livemode: true,
      paid: true,
      status: "succeeded",
      invoice: {
        id: "in_1",
        lines: {
          data: [{ price: { id: "price_a", product: "prod_mem" } }],
        },
      },
    });
    expect(normalized.amount).toBe(228);
    expect(normalized.amountRefunded).toBe(50);
    expect(normalized.currency).toBe("usd");
    expect(normalized.lines).toEqual([{ priceId: "price_a", productId: "prod_mem" }]);
    expect(normalized.hasShopifyMarker).toBe(false);
    expect(normalized.invoiceId).toBe("in_1");
    expect(normalized.billingReason).toBeNull();
    expect(normalized.channel).toBe("invoice");
  });

  it("flags Shopify-origin charges via description and Shopify Payments metadata", () => {
    const fromDescription = normalizeStripeCharge({
      id: "ch_2",
      description: "Shopify order #1234",
    });
    expect(fromDescription.hasShopifyMarker).toBe(true);
    expect(fromDescription.shopifyMarkerReason).toContain("shopify");
    const fromMetadata = normalizeStripeCharge({
      id: "ch_3",
      metadata: { shopify_order_id: "555" },
    });
    expect(fromMetadata.hasShopifyMarker).toBe(true);
    expect(fromMetadata.shopifyMarkerReason?.toLowerCase()).toContain("shopify");
    const fromPayments = detectShopifyMarker({
      metadata: { order_id: "1001", shop_id: "shop_1" },
    });
    expect(fromPayments.hasShopifyMarker).toBe(true);
  });

  it("does not treat generic order_id metadata as Shopify-origin", () => {
    expect(detectShopifyMarker({ metadata: { order_id: "INV-9" } }).hasShopifyMarker).toBe(false);
    expect(
      detectShopifyMarker({
        description: "Payment for Invoice",
        metadata: { order_id: "custom-123" },
      }).hasShopifyMarker,
    ).toBe(false);
  });

  it("classifies subscription, invoice, checkout, and payment-link channels", () => {
    expect(
      classifyStripePaymentChannel({
        invoiceId: "in_sub",
        billingReason: "subscription_cycle",
        description: "Subscription update",
      }),
    ).toBe("subscription");
    expect(
      classifyStripePaymentChannel({
        invoiceId: "in_manual",
        billingReason: "manual",
        description: "Payment for Invoice",
      }),
    ).toBe("invoice");
    expect(classifyStripePaymentChannel({ description: "Checkout payment" })).toBe("checkout");
    expect(classifyStripePaymentChannel({ description: "", invoiceId: null })).toBe("payment_link");
    expect(
      classifyStripePaymentChannel({
        metadata: { payment_link: "plink_1" },
      }),
    ).toBe("payment_link");
  });

  it("returns no line refs for a charge without an expanded invoice", () => {
    expect(normalizeStripeCharge({ id: "ch_4", invoice: "in_unexpanded" }).lines).toEqual([]);
    expect(normalizeStripeCharge({ id: "ch_5", invoice: null }).lines).toEqual([]);
  });

  it("uses amount_captured when it differs from invoice/charge face value", () => {
    const normalized = normalizeStripeCharge({
      id: "ch_partial_capture",
      amount: 100000,
      amount_captured: 25000,
      amount_refunded: 0,
      currency: "usd",
      created: 1_764_600_000,
      livemode: true,
      paid: true,
      status: "succeeded",
      invoice: { id: "in_manual", lines: { data: [] } },
    });
    expect(normalized.amount).toBe(250);
    expect(normalized.lines).toEqual([]);
  });
});

describe("fetchStripeChargesInRange pagination", () => {
  it("follows cursor pagination and de-duplicates charge ids", async () => {
    const pages: Record<string, { data: Array<{ id: string }>; has_more: boolean }> = {
      first: { data: [{ id: "ch_a" }, { id: "ch_b" }], has_more: true },
      "ch_b": { data: [{ id: "ch_b" }, { id: "ch_c" }], has_more: false },
    };

    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      if (String(url).includes("/invoices")) {
        return new Response(JSON.stringify({ data: [], has_more: false }), { status: 200 });
      }
      const parsed = new URL(url);
      const after = parsed.searchParams.get("starting_after");
      const page = after ? pages[after] : pages.first;
      return new Response(JSON.stringify(page), { status: 200 });
    }) as unknown as typeof fetch;

    const charges = await fetchStripeChargesInRange({
      startUtc: new Date("2026-08-01T07:00:00Z"),
      endUtc: new Date("2026-08-02T07:00:00Z"),
      config: { secretKey: "sk_test", apiBase: "https://api.stripe.test/v1" },
      fetchImpl,
    });

    expect(charges.map((c) => c.id)).toEqual(["ch_a", "ch_b", "ch_c"]);
    expect(calls.filter((url) => url.includes("/charges")).length).toBe(2);
    expect(calls.some((url) => url.includes("/invoices"))).toBe(true);
    const firstParams = new URL(calls[0]!).searchParams;
    expect(firstParams.get("created[gte]")).toBe("1785567600");
    expect(firstParams.get("created[lt]")).toBe("1785654000");
    expect(firstParams.getAll("expand[]")).toContain("data.invoice");
  });

  it("backfills a paid-invoice Charge missing from the charges list, once", async () => {
    const fetchImpl = (async (url: string) => {
      const href = String(url);
      if (href.includes("/invoices")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "in_manual",
                status: "paid",
                paid: true,
                paid_out_of_band: false,
                charge: "ch_invoice",
              },
              {
                id: "in_oob",
                status: "paid",
                paid: true,
                paid_out_of_band: true,
                charge: null,
              },
            ],
            has_more: false,
          }),
          { status: 200 },
        );
      }
      if (href.includes("/charges/ch_invoice")) {
        return new Response(
          JSON.stringify({
            id: "ch_invoice",
            amount: 12000,
            amount_captured: 12000,
            amount_refunded: 0,
            status: "succeeded",
            paid: true,
            livemode: true,
            currency: "usd",
            created: 1_785_568_000,
            description: "Payment for Invoice",
            invoice: { id: "in_manual", billing_reason: "manual" },
          }),
          { status: 200 },
        );
      }
      if (href.includes("/charges?")) {
        return new Response(JSON.stringify({ data: [], has_more: false }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;

    const charges = await fetchStripeChargesInRange({
      startUtc: new Date("2026-08-01T07:00:00Z"),
      endUtc: new Date("2026-08-02T07:00:00Z"),
      config: { secretKey: "sk_test", apiBase: "https://api.stripe.test/v1" },
      fetchImpl,
    });
    expect(charges.map((charge) => charge.id)).toEqual(["ch_invoice"]);
    expect(charges[0]?.amount).toBe(120);
    expect(charges[0]?.channel).toBe("invoice");
    expect(charges[0]?.hasShopifyMarker).toBe(false);
  });

  it("throws a Stripe authentication error on HTTP 401", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({ error: { type: "invalid_request_error", message: "Invalid API Key" } }),
        { status: 401 },
      )) as unknown as typeof fetch;

    await expect(
      fetchStripeChargesInRange({
        startUtc: new Date("2026-08-01T07:00:00Z"),
        endUtc: new Date("2026-08-02T07:00:00Z"),
        config: { secretKey: "sk_bad", apiBase: "https://api.stripe.test/v1" },
        fetchImpl,
      }),
    ).rejects.toThrow(/Stripe authentication failed \(HTTP 401\)/);
  });

  it("classifies a TLS handshake failure as an unable-to-connect error", async () => {
    const fetchImpl = (async () => {
      const cause = Object.assign(new Error("unable to verify the first certificate"), {
        code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      });
      throw Object.assign(new TypeError("fetch failed"), { cause });
    }) as unknown as typeof fetch;

    await expect(
      fetchStripeChargesInRange({
        startUtc: new Date("2026-08-01T07:00:00Z"),
        endUtc: new Date("2026-08-02T07:00:00Z"),
        config: { secretKey: "sk_test", apiBase: "https://api.stripe.test/v1" },
        fetchImpl,
      }),
    ).rejects.toThrow(/Unable to connect to Stripe: TLS certificate verification failed/);
  });
});

describe("stripe error classification", () => {
  it("maps HTTP statuses to safe, useful messages", () => {
    expect(describeStripeHttpError(401, "{}")).toMatch(/authentication failed \(HTTP 401\)/);
    expect(describeStripeHttpError(403, "{}")).toMatch(/permission denied \(HTTP 403\)/);
    expect(describeStripeHttpError(429, "{}")).toMatch(/rate limit reached \(HTTP 429\)/);
    expect(describeStripeHttpError(500, "{}")).toMatch(/HTTP 500 \(Stripe-side error\)/);
    expect(describeStripeHttpError(402, "{}")).toMatch(/HTTP 402/);
  });

  it("includes Stripe's structured error detail without secrets", () => {
    const msg = describeStripeHttpError(
      403,
      JSON.stringify({ error: { code: "permission_error", message: "missing scope" } }),
    );
    expect(msg).toContain("permission_error");
    expect(msg).toContain("missing scope");
  });

  it("summarizes and classifies TLS/DNS/network causes", () => {
    const tls = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("bad cert"), { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" }),
    });
    expect(summarizeStripeFetchCause(tls)).toContain("UNABLE_TO_VERIFY_LEAF_SIGNATURE");
    expect(describeStripeConnectionError(tls)).toMatch(/TLS certificate verification failed/);

    const dns = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("nope"), { code: "ENOTFOUND" }),
    });
    expect(describeStripeConnectionError(dns)).toMatch(/DNS lookup failed/);

    const refused = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("nope"), { code: "ECONNREFUSED" }),
    });
    expect(describeStripeConnectionError(refused)).toMatch(/network error \(ECONNREFUSED\)/);
  });
});

describe("stripe TLS opt-in", () => {
  it("recognizes explicit opt-in values only", () => {
    expect(isStripeTlsInsecureFlagEnabled({ STRIPE_TLS_INSECURE: "1" })).toBe(true);
    expect(isStripeTlsInsecureFlagEnabled({ STRIPE_TLS_INSECURE: "true" })).toBe(true);
    expect(isStripeTlsInsecureFlagEnabled({ STRIPE_TLS_INSECURE: "0" })).toBe(false);
    expect(isStripeTlsInsecureFlagEnabled({})).toBe(false);
  });

  it("never relaxes TLS in production", () => {
    expect(shouldUseStripeTlsInsecure({ STRIPE_TLS_INSECURE: "1", NODE_ENV: "production" })).toBe(false);
    expect(shouldUseStripeTlsInsecure({ STRIPE_TLS_INSECURE: "1", CONTEXT: "production" })).toBe(false);
    expect(shouldUseStripeTlsInsecure({ STRIPE_TLS_INSECURE: "1" })).toBe(true);
  });
});
