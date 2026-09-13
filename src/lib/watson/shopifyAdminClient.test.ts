import { describe, expect, it } from "vitest";

import { fetchShopifyOrdersProcessedInRange } from "./shopifyAdminClient";

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
  });
});
