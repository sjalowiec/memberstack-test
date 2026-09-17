import { describe, expect, it, vi } from "vitest";

import {
  collectEmailLookupKeys,
  formatShopifyMemberOrderStatus,
  mergeMemberOrders,
  buildShopifyOrderDisplay,
  getShopifyOrdersForEmails,
  shopifyOrderCountsTowardPaidSales,
  SHOPIFY_ORDERS_BY_EMAILS_SQL,
} from "./shopifyPurchaseHistory";

describe("shopifyPurchaseHistory", () => {
  it("builds gmail lookup keys without rewriting the original address", () => {
    expect(collectEmailLookupKeys(["  Pat@Gmail.com "])).toEqual([
      "pat@gmail.com",
      "pat@googlemail.com",
    ]);
  });

  it("formats cancelled and refunded Shopify statuses", () => {
    expect(
      formatShopifyMemberOrderStatus({
        financial_status: "paid",
        fulfillment_status: "fulfilled",
        cancelled_at: "2024-01-03T00:00:00.000Z",
        cancel_reason: "customer",
      }),
    ).toBe("Cancelled (Customer)");
    expect(
      formatShopifyMemberOrderStatus({
        financial_status: "refunded",
        fulfillment_status: "fulfilled",
        cancelled_at: null,
        cancel_reason: null,
      }),
    ).toBe("Refunded");
  });

  it("loads refunded and cancelled Shopify orders for a customer instead of dropping them", async () => {
    expect(SHOPIFY_ORDERS_BY_EMAILS_SQL).not.toMatch(/WHERE[\s\S]*financial_status\s*=/i);
    expect(SHOPIFY_ORDERS_BY_EMAILS_SQL).not.toMatch(/cancelled_at IS NULL/);

    const queryFn = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === SHOPIFY_ORDERS_BY_EMAILS_SQL) {
        expect(params?.[0]).toEqual(["pat@gmail.com", "pat@googlemail.com"]);
        return [
          {
            shopify_order_id: "1",
            order_number: "100",
            order_name: "#100",
            processed_at: "2024-02-01T00:00:00.000Z",
            customer_email: "Pat@Gmail.com",
            currency: "USD",
            total_price: "10.00",
            total_refunded: "10.00",
            financial_status: "refunded",
            fulfillment_status: "fulfilled",
            cancelled_at: null,
            cancel_reason: null,
            source: "shopify",
          },
          {
            shopify_order_id: "2",
            order_number: "101",
            order_name: "#101",
            processed_at: "2024-03-01T00:00:00.000Z",
            customer_email: "Pat@Gmail.com",
            currency: "USD",
            total_price: "20.00",
            total_refunded: "0",
            financial_status: "paid",
            fulfillment_status: "fulfilled",
            cancelled_at: "2024-03-02T00:00:00.000Z",
            cancel_reason: "customer",
            source: "shopify",
          },
        ];
      }
      return [];
    });

    const orders = await getShopifyOrdersForEmails(["  Pat@Gmail.com "], queryFn);
    expect(orders).toHaveLength(2);
    expect(orders.map((order) => order.orderStatus)).toEqual([
      "Refunded",
      "Cancelled (Customer)",
    ]);
    expect(shopifyOrderCountsTowardPaidSales(orders[0]!)).toBe(false);
    expect(shopifyOrderCountsTowardPaidSales(orders[1]!)).toBe(false);
  });

  it("merges Shopify and legacy orders newest first and labels Shopify", () => {
    const shopify = buildShopifyOrderDisplay(
      {
        shopify_order_id: "555",
        order_number: "1042",
        order_name: "#1042",
        processed_at: "2024-06-01T00:00:00.000Z",
        customer_email: "sue@example.com",
        currency: "USD",
        total_price: "12.00",
        total_refunded: 0,
        financial_status: "paid",
        fulfillment_status: "fulfilled",
        cancelled_at: null,
        cancel_reason: null,
        source: "shopify",
      },
      [
        {
          shopify_order_id: "555",
          shopify_line_item_id: "9",
          title: "Cable",
          quantity: 2,
          sku: "CABLE",
          variant_title: "Black",
          unit_price: "6.00",
        },
      ],
    );

    expect(shopify.source).toBe("shopify");
    expect(shopify.sourceLabel).toBe("Shopify");
    expect(shopify.shopifyOrderNumber).toBe("1042");
    expect(shopify.shopifyOrderHref).toBe("/watson/sales/555");
    expect(shopify.items[0]?.description).toContain("SKU CABLE");
    expect(shopify.items[0]?.lineTotal).toBe("$12.00");

    const merged = mergeMemberOrders(
      [
        {
          storeTransactionId: "1",
          transactionId: "legacy-1",
          orderDate: "Jan 1, 2020",
          orderDateSort: "2020-01-01T00:00:00.000Z",
          orderStatus: "Paid",
          orderTotal: "$4.00",
          orderTotalSort: "4",
          paymentMethod: null,
          items: [],
          source: "legacy",
        },
      ],
      [shopify],
    );
    expect(merged[0]?.source).toBe("shopify");
    expect(merged[1]?.source).toBe("legacy");
  });

  it("does not duplicate the same Shopify order id in customer history", () => {
    const shopify = buildShopifyOrderDisplay(
      {
        shopify_order_id: "7104163872962",
        order_number: "1035",
        order_name: "#1035",
        processed_at: "2026-09-07T16:26:05.000Z",
        customer_email: "Pat@Gmail.com",
        currency: "USD",
        total_price: "2099.00",
        total_refunded: 0,
        financial_status: "paid",
        fulfillment_status: "fulfilled",
        cancelled_at: null,
        cancel_reason: null,
        source: "shopify",
      },
      [],
    );
    const merged = mergeMemberOrders([], [shopify, { ...shopify }]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.shopifyOrderId).toBe("7104163872962");
    expect(merged[0]?.shopifyOrderHref).toBe("/watson/sales/7104163872962");
  });
});
