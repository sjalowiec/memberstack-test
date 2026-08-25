import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeData = new Map<string, string>();

vi.mock("@netlify/blobs", () => ({
  getStore: () => ({
    async get(key: string, opts?: { type?: string }) {
      if (!storeData.has(key)) return null;
      const value = storeData.get(key)!;
      return opts?.type === "json" ? JSON.parse(value) : value;
    },
    async setJSON(key: string, value: unknown) {
      storeData.set(key, JSON.stringify(value));
    },
  }),
}));

import handler from "../stripe-download-webhook";
import { CHARTING_RULERS_PAID_DOWNLOAD } from "../../../src/lib/downloads/paidDownloadCatalog";
import { listPaidDownloadCustomerEntitlementsForEmail } from "../../../src/lib/downloads/paidDownloadEntitlements";
import { signStripeWebhookPayload } from "../../../src/lib/downloads/stripeWebhookSignature";

const SECRET = "whsec_test_download_webhook";
const NOW = 1_700_000_000;

function checkoutEvent(overrides: Record<string, unknown> = {}) {
  const session = {
    id: "cs_test_charting_rulers",
    object: "checkout.session",
    payment_status: "paid",
    customer_details: { email: "Buyer@Example.COM" },
    payment_link: CHARTING_RULERS_PAID_DOWNLOAD.stripePaymentLinkId,
    payment_intent: "pi_test_charting_rulers",
    ...overrides,
  };
  return JSON.stringify({
    id: "evt_test_1",
    type: "checkout.session.completed",
    data: { object: session },
  });
}

function signedRequest(rawBody: string, secret = SECRET, timestamp = NOW) {
  return new Request("https://example.com/.netlify/functions/stripe-download-webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": signStripeWebhookPayload(rawBody, secret, timestamp),
    },
    body: rawBody,
  });
}

describe("stripe-download-webhook", () => {
  beforeEach(() => {
    storeData.clear();
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
    vi.spyOn(Date, "now").mockReturnValue(NOW * 1000);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("creates a Charting Rulers entitlement for a valid paid Checkout Session", async () => {
    const rawBody = checkoutEvent();
    const res = await handler(signedRequest(rawBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      granted: true,
      created: true,
      slug: "charting-rulers",
    });

    const rows = await listPaidDownloadCustomerEntitlementsForEmail("buyer@example.com");
    expect(rows).toEqual([
      {
        itemId: "printable:charting-rulers",
        title: "Printable Gauge Rulers",
        downloadUrl: "/downloads/shop/gauge-rulers.pdf",
      },
    ]);
  });

  it("rejects an invalid webhook signature", async () => {
    const rawBody = checkoutEvent();
    const res = await handler(
      new Request("https://example.com/.netlify/functions/stripe-download-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": signStripeWebhookPayload(rawBody, "whsec_wrong", NOW),
        },
        body: rawBody,
      }),
    );
    expect(res.status).toBe(400);
    expect(storeData.size).toBe(0);
  });

  it("does not create an entitlement for an unpaid Checkout Session", async () => {
    const rawBody = checkoutEvent({ payment_status: "unpaid" });
    const res = await handler(signedRequest(rawBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, granted: false, reason: "unpaid" });
    expect(
      await listPaidDownloadCustomerEntitlementsForEmail("buyer@example.com"),
    ).toEqual([]);
  });

  it("is idempotent when Stripe redelivers the same paid event", async () => {
    const rawBody = checkoutEvent();
    const first = await handler(signedRequest(rawBody));
    const second = await handler(signedRequest(rawBody));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({
      ok: true,
      granted: true,
      created: false,
    });
    expect(storeData.size).toBe(1);
  });

  it("does not grant Charting Rulers for an unrelated Stripe product", async () => {
    const rawBody = checkoutEvent({
      payment_link: "plink_unrelated_product",
      metadata: {},
      line_items: {
        data: [{ price: { id: "price_unrelated", product: "prod_unrelated" } }],
      },
    });
    const res = await handler(signedRequest(rawBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      granted: false,
      reason: "unrelated_product",
    });
    expect(
      await listPaidDownloadCustomerEntitlementsForEmail("buyer@example.com"),
    ).toEqual([]);
  });

  it("creates an entitlement for checkout.session.async_payment_succeeded", async () => {
    const rawBody = JSON.stringify({
      id: "evt_async_1",
      type: "checkout.session.async_payment_succeeded",
      data: {
        object: {
          id: "cs_async_charting",
          object: "checkout.session",
          payment_status: "paid",
          customer_email: "async@example.com",
          payment_link: CHARTING_RULERS_PAID_DOWNLOAD.stripePaymentLinkId,
        },
      },
    });
    const res = await handler(signedRequest(rawBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, granted: true, created: true });
    expect(await listPaidDownloadCustomerEntitlementsForEmail("async@example.com")).toEqual([
      {
        itemId: "printable:charting-rulers",
        title: "Printable Gauge Rulers",
        downloadUrl: "/downloads/shop/gauge-rulers.pdf",
      },
    ]);
  });
});
