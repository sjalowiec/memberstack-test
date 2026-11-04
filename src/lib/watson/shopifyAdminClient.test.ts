import { describe, expect, it } from "vitest";

import {
  fetchShopifyOrdersProcessedInRange,
  SALES_REPORT_SHOPIFY_FETCH_POLICY,
} from "./shopifyAdminClient";

describe("fetchShopifyOrdersProcessedInRange", () => {
  it("requests processed_at_min and processed_at_max for the selected window", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      return new Response(JSON.stringify({ orders: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    await fetchShopifyOrdersProcessedInRange({
      processedAtMin: "2026-08-25T07:00:00.000Z",
      processedAtMax: "2026-08-26T07:00:00.000Z",
      config: {
        storeDomain: "example.myshopify.com",
        apiVersion: "2025-01",
        auth: { mode: "static", accessToken: "shpat_test" },
      },
      fetchImpl,
    });

    expect(calls).toHaveLength(1);
    const params = new URL(calls[0]!).searchParams;
    expect(params.get("processed_at_min")).toBe("2026-08-25T07:00:00.000Z");
    expect(params.get("processed_at_max")).toBe("2026-08-26T07:00:00.000Z");
    expect(params.get("status")).toBe("any");
    const fields = params.get("fields") ?? "";
    expect(fields).toContain("contact_email");
    expect(fields).toContain("fulfillments");
    expect(fields).not.toContain("shipping_address");
  });

  it("retries a sales-report rate limit once instead of backing off for half a minute", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) return new Response("busy", { status: 429, headers: { "Retry-After": "30" } });
      return new Response(JSON.stringify({ orders: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    const started = Date.now();
    await fetchShopifyOrdersProcessedInRange({
      processedAtMin: "2026-10-01T07:00:00.000Z",
      processedAtMax: "2026-11-02T08:00:00.000Z",
      config: {
        storeDomain: "example.myshopify.com",
        apiVersion: "2025-01",
        auth: { mode: "static", accessToken: "shpat_test" },
      },
      fetchImpl,
      fetchPolicy: SALES_REPORT_SHOPIFY_FETCH_POLICY,
    });
    expect(calls).toBe(2);
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
