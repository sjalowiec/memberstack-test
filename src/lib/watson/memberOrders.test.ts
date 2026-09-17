import { describe, expect, it, vi } from "vitest";

import {
  buildOrderDisplay,
  buildOrderItemDescription,
  formatLegacyOrderStatus,
  getMemberOrderCount,
  getMemberOrders,
  groupOrderItemsByStoreTransactionId,
  MEMBER_ORDER_COUNT_SQL,
  MEMBER_ORDER_ITEMS_SQL,
  MEMBER_ORDERS_SQL,
} from "./memberOrders";
import { MEMBER_DETAIL_SQL } from "./memberDetail";
import {
  SHOPIFY_ORDER_COUNT_BY_EMAILS_SQL,
  SHOPIFY_ORDERS_BY_EMAILS_SQL,
} from "./shopifyPurchaseHistory";

describe("memberOrders", () => {
  const orderRow = {
    storetransactionid: 29812,
    transactionid: "122B11FA-E673-F812-7CE5-D1D0AD6D61F0",
    purchasedate: "2026-07-10T20:40:15.670Z",
    totalcost: "2173.10",
    transactionmethod: "Credit Card",
    fulfillment_status_current: null,
    fulfillment_status: null,
    paid: 1,
  };

  const itemRow = {
    transaction_itemid: 62,
    storetransactionid: 29812,
    itemname: "Angora (3/10)",
    quantity: 2,
    priceperitem: "67.50",
    totalprice: "135.00",
    product: "Yarn",
    saledescripton: "10% off",
    color: "Black",
  };

  it("counts orders for a member without loading line items", async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (sql === MEMBER_DETAIL_SQL) {
        return [];
      }
      if (sql === MEMBER_ORDER_COUNT_SQL) {
        return [{ order_count: "27" }];
      }
      return [];
    });

    const count = await getMemberOrderCount("DD0CC51B-F6A7-3304-EBC0-C3F510A7BAC3", queryFn);

    expect(queryFn).toHaveBeenCalledWith(MEMBER_ORDER_COUNT_SQL, [
      "DD0CC51B-F6A7-3304-EBC0-C3F510A7BAC3",
    ]);
    expect(count).toBe(27);
  });

  it("loads orders and items for a member", async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (sql === MEMBER_DETAIL_SQL) {
        return [];
      }
      if (sql === MEMBER_ORDERS_SQL) {
        return [orderRow];
      }
      if (sql === MEMBER_ORDER_ITEMS_SQL) {
        return [itemRow];
      }
      return [];
    });

    const orders = await getMemberOrders("DD0CC51B-F6A7-3304-EBC0-C3F510A7BAC3", queryFn);

    expect(queryFn).toHaveBeenCalledWith(MEMBER_ORDERS_SQL, [
      "DD0CC51B-F6A7-3304-EBC0-C3F510A7BAC3",
    ]);
    expect(queryFn).toHaveBeenCalledWith(MEMBER_ORDER_ITEMS_SQL, [[29812]]);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.transactionId).toBe(orderRow.transactionid);
    expect(orders[0]?.source).toBe("legacy");
    expect(orders[0]?.items).toHaveLength(1);
    expect(orders[0]?.items[0]?.lineTotal).toBe("$135.00");
  });

  it("merges Shopify orders matched by member email", async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (sql === MEMBER_DETAIL_SQL) {
        return [{ memberid: "M1", email: "Sue@Example.com" }];
      }
      if (sql === MEMBER_ORDERS_SQL || sql === MEMBER_ORDER_COUNT_SQL) {
        return sql === MEMBER_ORDER_COUNT_SQL ? [{ order_count: "1" }] : [orderRow];
      }
      if (sql === MEMBER_ORDER_ITEMS_SQL) {
        return [itemRow];
      }
      if (sql === SHOPIFY_ORDERS_BY_EMAILS_SQL) {
        return [
          {
            shopify_order_id: "555001",
            order_number: "1001",
            order_name: "#1001",
            processed_at: "2024-03-15T14:00:00.000Z",
            customer_email: "Sue@Example.com",
            currency: "USD",
            total_price: "999.00",
            total_refunded: "0",
            financial_status: "paid",
            fulfillment_status: "fulfilled",
            cancelled_at: null,
            cancel_reason: null,
            source: "shopify",
          },
        ];
      }
      if (sql === SHOPIFY_ORDER_COUNT_BY_EMAILS_SQL) {
        return [{ order_count: "1" }];
      }
      if (sql.includes("watson_shopify_order_items")) {
        return [
          {
            shopify_order_id: "555001",
            shopify_line_item_id: "9",
            title: "Taitexma TH160 Mid-Gauge Machine",
            quantity: 1,
            sku: "TH160",
            variant_title: null,
            unit_price: "999.00",
          },
        ];
      }
      return [];
    });

    const orders = await getMemberOrders("M1", queryFn);
    expect(orders).toHaveLength(2);
    expect(orders[0]?.source).toBe("legacy");
    expect(orders[1]?.source).toBe("shopify");
    expect(orders[1]?.shopifyOrderNumber).toBe("1001");
    expect(orders[1]?.transactionId).toBe("#1001");

    const count = await getMemberOrderCount("M1", queryFn);
    expect(count).toBe(2);
  });

  it("formats order status from fulfillment or paid flag", () => {
    expect(formatLegacyOrderStatus({ ...orderRow, paid: 1 })).toBe("Paid");
    expect(
      formatLegacyOrderStatus({
        ...orderRow,
        fulfillment_status_current: "Shipped",
        paid: 1,
      }),
    ).toBe("Shipped");
  });

  it("builds item descriptions from imported columns", () => {
    expect(buildOrderItemDescription(itemRow)).toContain("Angora (3/10)");
    expect(buildOrderItemDescription(itemRow)).toContain("Black");
  });

  it("groups items by storetransactionid", () => {
    const grouped = groupOrderItemsByStoreTransactionId([
      itemRow,
      { ...itemRow, transaction_itemid: 63, storetransactionid: 27 },
    ]);
    expect(grouped.get("29812")).toHaveLength(1);
    expect(grouped.get("27")).toHaveLength(1);
  });

  it("hides empty payment method in order display", () => {
    const display = buildOrderDisplay(
      { ...orderRow, transactionmethod: "", totalcost: "18.99" },
      [],
    );
    expect(display.paymentMethod).toBeNull();
    expect(display.orderTotal).toBe("$18.99");
    expect(display.source).toBe("legacy");
  });

  it("detects visible optional columns", async () => {
    const { getVisibleOrderColumns, getVisibleItemColumns } = await import("./memberOrders");
    expect(
      getVisibleOrderColumns([
        buildOrderDisplay(orderRow, []),
        buildOrderDisplay({ ...orderRow, transactionmethod: null }, []),
      ]).showPayment,
    ).toBe(true);
    expect(
      getVisibleItemColumns([
        { transactionItemId: "1", description: "Yarn", quantity: null, itemPrice: null, lineTotal: null },
      ]).showQuantity,
    ).toBe(false);
  });
});
