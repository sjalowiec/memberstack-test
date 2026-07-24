import { describe, expect, it } from "vitest";

import { mapShopifyRestOrder } from "./shopifyOrderMap";

describe("shopify order dedupe keys", () => {
  it("uses stable shopify_order_id and line item ids for upserts", () => {
    const first = mapShopifyRestOrder({
      id: 1001,
      order_number: 1001,
      name: "#1001",
      total_price: "10.00",
      line_items: [{ id: 44, title: "Cable", quantity: 1, price: "10.00" }],
    });
    const second = mapShopifyRestOrder({
      id: 1001,
      order_number: 1001,
      name: "#1001",
      total_price: "10.00",
      financial_status: "refunded",
      total_refunded: "10.00",
      line_items: [{ id: 44, title: "Cable", quantity: 1, price: "10.00" }],
    });

    expect(first?.shopifyOrderId).toBe(second?.shopifyOrderId);
    expect(first?.lineItems[0]?.shopifyLineItemId).toBe(
      second?.lineItems[0]?.shopifyLineItemId,
    );
    expect(second?.financialStatus).toBe("refunded");
  });
});
