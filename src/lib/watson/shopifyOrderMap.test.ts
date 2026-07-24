import { describe, expect, it } from "vitest";

import { mapShopifyRestOrder, normalizeShopifyOrderNumber } from "./shopifyOrderMap";

describe("shopifyOrderMap", () => {
  it("normalizes order numbers from name or number", () => {
    expect(normalizeShopifyOrderNumber(1042, "#1042")).toBe("1042");
    expect(normalizeShopifyOrderNumber(null, "#99")).toBe("99");
  });

  it("maps REST order fields and classifies DesignaKnit", () => {
    const mapped = mapShopifyRestOrder({
      id: 555,
      admin_graphql_api_id: "gid://shopify/Order/555",
      name: "#555",
      order_number: 555,
      email: "buyer@example.com",
      created_at: "2026-07-20T12:00:00Z",
      processed_at: "2026-07-20T12:01:00Z",
      currency: "USD",
      financial_status: "paid",
      fulfillment_status: null,
      tags: "",
      subtotal_price: "450.00",
      total_discounts: "10.00",
      total_tax: "20.00",
      total_shipping_price_set: { shop_money: { amount: "0.00", currency_code: "USD" } },
      total_price: "460.00",
      total_refunded: "0.00",
      customer: { first_name: "Pat", last_name: "Knitter", email: "buyer@example.com" },
      line_items: [
        {
          id: 9,
          title: "DesignaKnit Machine Pro",
          quantity: 1,
          sku: "DAK-PRO",
          product_id: 1,
          product_handle: "designaknit-machine-pro",
          price: "450.00",
        },
      ],
    });

    expect(mapped).not.toBeNull();
    expect(mapped?.shopifyOrderId).toBe("555");
    expect(mapped?.source).toBe("shopify");
    expect(mapped?.isDesignaknit).toBe(true);
    expect(mapped?.siteBrand).toBe("designaknit");
    expect(mapped?.customerEmail).toBe("buyer@example.com");
    expect(mapped?.totalShipping).toBe(0);
    expect(mapped?.totalDiscounts).toBe(10);
    expect(mapped?.fulfillmentStatus).toBe("unfulfilled");
    expect(mapped?.lineItems).toHaveLength(1);
  });

  it("handles guest checkout with billing name fallback", () => {
    const mapped = mapShopifyRestOrder({
      id: 7,
      order_number: 7,
      name: "#7",
      email: "guest@example.com",
      customer: null,
      billing_address: { first_name: "Guest", last_name: "Buyer" },
      line_items: [{ id: 1, title: "USB Cable", quantity: 2, price: "25.00" }],
      total_price: "50.00",
      currency: "USD",
    });

    expect(mapped?.customerFirstName).toBe("Guest");
    expect(mapped?.customerLastName).toBe("Buyer");
    expect(mapped?.isDesignaknit).toBe(false);
    expect(mapped?.siteBrand).toBe("knit_it_now");
  });

  it("returns null without order id", () => {
    expect(mapShopifyRestOrder({ name: "#1" })).toBeNull();
  });
});
