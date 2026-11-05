import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SHOPIFY_LOOKBACK_DAYS } from "./shopifyEnv";
import type { ShopifyRestOrder } from "./shopifyOrderMap";

const LAST_SUCCESSFUL_SYNC = "2026-10-21T18:01:06.335Z";
const EXISTING_DESIGNAKNIT_ID = "555001";

const state = vi.hoisted(() => ({
  queries: [] as Array<{ sql: string; params: unknown[] }>,
  orderIds: new Set<string>(),
}));

vi.mock("./db", () => ({
  getWatsonPool: vi.fn(async () => ({
    connect: async () => ({ release() {} }),
  })),
  queryWatson: vi.fn(async (sql: string, params: unknown[] = []) => {
    state.queries.push({ sql, params });
    if (sql.includes("INSERT INTO watson_shopify_sync_runs")) {
      return [{ id: "run-1" }];
    }
    if (sql.includes("SELECT shopify_order_id FROM watson_shopify_orders")) {
      const id = String(params[0]);
      return state.orderIds.has(id) ? [{ shopify_order_id: id }] : [];
    }
    if (sql.includes("ON CONFLICT (shopify_order_id)")) {
      state.orderIds.add(String(params[0]));
    }
    return [];
  }),
}));

vi.mock("./schema", () => ({
  applyWatsonNativeSchema: vi.fn(async () => undefined),
}));

import { syncShopifyOrders } from "./shopifyOrdersSync";

function shopifyResponse(orders: ShopifyRestOrder[]): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ orders }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
}

/** Paid LK150 order missed after the October 21 sync. Classification matches stored LK150 rows. */
function paidLk150Order1046(): ShopifyRestOrder {
  return {
    id: 8801046,
    admin_graphql_api_id: "gid://shopify/Order/8801046",
    name: "#1046",
    order_number: 1046,
    email: "buyer@example.com",
    created_at: "2026-10-28T16:04:00-07:00",
    processed_at: "2026-10-28T16:05:00-07:00",
    currency: "USD",
    financial_status: "paid",
    fulfillment_status: null,
    tags: "",
    subtotal_price: "399.00",
    total_discounts: "0.00",
    total_tax: "0.00",
    total_shipping_price_set: { shop_money: { amount: "0.00", currency_code: "USD" } },
    total_price: "399.00",
    total_refunded: "0.00",
    customer: { first_name: "Pat", last_name: "Knitter", email: "buyer@example.com" },
    line_items: [
      {
        id: 7701046,
        title: "Silver Reed LK150",
        quantity: 1,
        sku: "LK150",
        product_id: 321,
        product_handle: "silver-reed-lk150",
        price: "399.00",
      },
    ],
    fulfillments: [
      {
        status: "success",
        tracking_company: "UPS",
        tracking_number: "1Z999AA10123456784",
        tracking_url: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
      },
    ],
  };
}

function existingDesignaKnitOrder(): ShopifyRestOrder {
  return {
    id: Number(EXISTING_DESIGNAKNIT_ID),
    admin_graphql_api_id: "gid://shopify/Order/555001",
    name: "#1008",
    order_number: 1008,
    email: "dak@example.com",
    created_at: "2026-09-02T12:00:00Z",
    processed_at: "2026-09-02T12:05:00Z",
    currency: "USD",
    financial_status: "paid",
    fulfillment_status: "fulfilled",
    tags: "designaknit",
    total_price: "450.00",
    line_items: [
      {
        id: 91,
        title: "DesignaKnit Machine Pro",
        quantity: 1,
        sku: "DAK-PRO",
        product_handle: "designaknit-machine-pro",
        price: "450.00",
      },
    ],
  };
}

function orderUpserts() {
  return state.queries.filter((query) => query.sql.includes("ON CONFLICT (shopify_order_id)"));
}

function upsertFor(orderId: string) {
  const matches = orderUpserts().filter((query) => query.params[0] === orderId);
  return matches.at(-1);
}

describe("shopify order sync write", () => {
  afterEach(() => {
    state.queries.length = 0;
    state.orderIds.clear();
    vi.unstubAllEnvs();
  });

  it("writes order 1046 as a boolean Knit it Now sale and keeps DesignaKnit boolean", async () => {
    vi.stubEnv("SHOPIFY_STORE_DOMAIN", "vjzu11-86.myshopify.com");
    vi.stubEnv("SHOPIFY_ADMIN_ACCESS_TOKEN", "shpat_test");
    state.orderIds.add(EXISTING_DESIGNAKNIT_ID);

    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      return shopifyResponse([paidLk150Order1046(), existingDesignaKnitOrder()])(url);
    }) as typeof fetch;

    const first = await syncShopifyOrders({ fetchImpl, triggerSource: "manual" });
    expect(first.ok).toBe(true);
    expect(first.ordersFetched).toBe(2);
    expect(first.ordersAdded).toBe(1);
    expect(first.ordersUpdated).toBe(1);

    const createdAtMin = new URL(calls[0]!).searchParams.get("created_at_min");
    expect(createdAtMin).toBeTruthy();
    const lookbackStart = Date.parse(createdAtMin!);
    const lastSuccess = Date.parse(LAST_SUCCESSFUL_SYNC);
    const orderCreated = Date.parse(paidLk150Order1046().created_at!);
    expect(lookbackStart).toBeLessThanOrEqual(lastSuccess);
    expect(orderCreated).toBeGreaterThan(lastSuccess);
    expect(orderCreated).toBeGreaterThanOrEqual(lookbackStart);
    expect((Date.now() - lastSuccess) / 86_400_000).toBeLessThan(DEFAULT_SHOPIFY_LOOKBACK_DAYS);

    const lk150 = upsertFor("8801046");
    const designaknit = upsertFor(EXISTING_DESIGNAKNIT_ID);
    expect(lk150?.sql).toContain("$11::jsonb");
    expect(lk150?.sql).toContain("$25::boolean");
    expect(lk150?.sql).not.toContain("::jsonb,'shopify'");
    expect(lk150?.params[2]).toBe("1046");
    expect(lk150?.params[10]).toContain("ups.com");
    expect(JSON.parse(String(lk150?.params[10]))).toEqual([
      expect.objectContaining({ url: expect.stringContaining("ups.com") }),
    ]);
    expect(lk150?.params[18]).toBe("paid");
    expect(lk150?.params[23]).toBe("knit_it_now");
    expect(lk150?.params[24]).toBe(false);
    expect(designaknit?.params[23]).toBe("designaknit");
    expect(designaknit?.params[24]).toBe(true);

    const lineItems = state.queries.filter((query) =>
      query.sql.includes("INSERT INTO watson_shopify_order_items"),
    );
    expect(lineItems.map((query) => [query.params[0], query.params[1], query.params[2]])).toEqual([
      ["8801046", "7701046", "Silver Reed LK150"],
      [EXISTING_DESIGNAKNIT_ID, "91", "DesignaKnit Machine Pro"],
    ]);

    state.queries.length = 0;
    const second = await syncShopifyOrders({ fetchImpl, triggerSource: "manual" });
    expect(second.ok).toBe(true);
    expect(second.ordersAdded).toBe(0);
    expect(second.ordersUpdated).toBe(2);
    expect(state.orderIds).toEqual(new Set(["8801046", EXISTING_DESIGNAKNIT_ID]));

    const headerWrites = orderUpserts().filter((query) => query.params[0] === "8801046");
    expect(headerWrites).toHaveLength(1);
    const itemWrites = state.queries.filter(
      (query) =>
        query.sql.includes("INSERT INTO watson_shopify_order_items") && query.params[0] === "8801046",
    );
    expect(itemWrites).toHaveLength(1);
    expect(
      state.queries.filter(
        (query) =>
          query.sql.includes("DELETE FROM watson_shopify_order_items") && query.params[0] === "8801046",
      ),
    ).toHaveLength(1);
  });
});
