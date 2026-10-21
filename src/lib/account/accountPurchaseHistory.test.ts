import { describe, expect, it, vi } from "vitest";

import { loadAccountPurchaseHistory, toAccountPurchaseOrder } from "./accountPurchaseHistory";
import { MEMBER_DETAIL_SQL } from "../watson/memberDetail";
import {
  MEMBER_ORDER_ITEMS_SQL,
  MEMBER_ORDERS_SQL,
  type MemberOrderDisplay,
} from "../watson/memberOrders";
import {
  SHOPIFY_ORDER_ITEMS_BY_ORDER_IDS_SQL,
  SHOPIFY_ORDERS_BY_EMAILS_SQL,
} from "../watson/shopifyPurchaseHistory";

const VERIFIED = "Pat@Gmail.com";
const OTHER = "other-customer@example.com";

function queryForVerified() {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const queryFn = vi.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql === MEMBER_DETAIL_SQL) {
      return [{ memberid: "M-UNIQUE", email: "pat@gmail.com" }];
    }
    if (sql === MEMBER_ORDERS_SQL) {
      expect(params?.[0]).toBe("M-UNIQUE");
      return [
        {
          storetransactionid: 50,
          transactionid: "legacy-50",
          purchasedate: "2020-04-02T00:00:00.000Z",
          totalcost: "1899.00",
          transactionmethod: "Credit Card",
          fulfillment_status_current: "Shipped",
          fulfillment_status: "Shipped",
          fulfillment_ordernumber: "4401",
          paid: 1,
        },
      ];
    }
    if (sql === MEMBER_ORDER_ITEMS_SQL) {
      return [
        {
          transaction_itemid: 9,
          storetransactionid: 50,
          itemname: "Standard Gauge Knitting Machine",
          quantity: 1,
          priceperitem: "1899.00",
          totalprice: "1899.00",
          product: "Machine",
          saledescripton: "staff note",
          color: null,
          trackingnumber: "1Z999AA10123456784",
          carrier: "UPS",
        },
      ];
    }
    if (sql === SHOPIFY_ORDERS_BY_EMAILS_SQL) {
      const keys = params?.[0] as string[];
      expect(keys).toEqual(["pat@gmail.com", "pat@googlemail.com"]);
      expect(keys).not.toContain(OTHER);
      return [
        {
          shopify_order_id: "900",
          order_number: "1502",
          order_name: "#1502",
          processed_at: "2026-10-02T15:00:00.000Z",
          customer_email: null,
          checkout_email: "pat@gmail.com",
          tracking_links: [
            {
              label: "Track with UPS",
              url: "https://www.ups.com/track?tracknum=1Z999AA10123456790",
              trackingNumber: "1Z999AA10123456790",
            },
          ],
          currency: "USD",
          total_price: "48.00",
          total_refunded: "0",
          financial_status: "paid",
          fulfillment_status: "fulfilled",
          cancelled_at: null,
          cancel_reason: null,
          source: "shopify",
        },
      ];
    }
    if (sql === SHOPIFY_ORDER_ITEMS_BY_ORDER_IDS_SQL) {
      return [
        {
          shopify_order_id: "900",
          shopify_line_item_id: "3",
          title: "LK150 Second Tension Mast Kit",
          quantity: 1,
          sku: "MAST-2",
          variant_title: null,
          unit_price: "48.00",
        },
      ];
    }
    return [];
  });
  return { queryFn, calls };
}

describe("account purchase history", () => {
  it("shows a customer's machine and accessory orders and hides another customer's orders", async () => {
    const { queryFn, calls } = queryForVerified();
    const history = await loadAccountPurchaseHistory(VERIFIED, {
      queryFn,
      resolveLegacyLink: async () => ({
        status: "unique",
        member: { memberid: "M-UNIQUE", email: "pat@gmail.com" } as never,
      }),
    });

    const titles = history.orders.flatMap((order) => order.items.map((item) => item.title));
    expect(titles).toContain("Standard Gauge Knitting Machine");
    expect(titles).toContain("LK150 Second Tension Mast Kit");
    expect(titles.join(" ")).not.toContain("staff note");
    expect(titles.join(" ")).not.toContain("MAST-2");

    const shopify = history.orders.find((order) => order.orderNumber === "#1502");
    expect(shopify?.paymentStatus).toBe("Paid");
    expect(shopify?.fulfillmentStatus).toBe("Fulfilled");
    expect(shopify?.trackingLinks[0]?.url).toContain("ups.com");

    const legacy = history.orders.find((order) => order.orderNumber === "4401");
    expect(legacy?.paymentStatus).toBe("Paid");
    expect(legacy?.fulfillmentStatus).toBe("Shipped");
    expect(legacy?.trackingLinks[0]?.trackingNumber).toBe("1Z999AA10123456784");

    expect(JSON.stringify(history)).not.toContain(OTHER);
    expect(JSON.stringify(history)).not.toContain("/watson/sales");
    expect(JSON.stringify(history)).not.toContain("shopify_order_id");
    expect(history.legacyLink).toBe("unique");
    expect(calls.some((call) => JSON.stringify(call.params ?? []).includes(OTHER))).toBe(false);
    expect(history.syncNote).toContain("6 hours");
    expect(history.syncNote).toContain("90 days");
  });

  it("does not load legacy orders when the email matches more than one earlier account", async () => {
    const queryFn = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === MEMBER_ORDERS_SQL || sql === MEMBER_DETAIL_SQL) {
        throw new Error(`legacy lookup should not run: ${sql}`);
      }
      if (sql === SHOPIFY_ORDERS_BY_EMAILS_SQL) {
        expect(params?.[0]).toEqual(["pat@gmail.com", "pat@googlemail.com"]);
        return [];
      }
      return [];
    });

    const history = await loadAccountPurchaseHistory(VERIFIED, {
      queryFn,
      resolveLegacyLink: async () => ({
        status: "ambiguous",
        members: [
          { memberid: "M-A", email: "pat@gmail.com" },
          { memberid: "M-B", email: "pat@googlemail.com" },
        ] as never,
      }),
    });

    expect(history.orders).toEqual([]);
    expect(history.legacyLink).toBe("ambiguous");
    expect(history.legacyNote).toContain("more than one earlier account");
    expect(JSON.stringify(history)).not.toContain("M-A");
    expect(JSON.stringify(history)).not.toContain("M-B");
  });

  it("matches guest checkout shop orders when there is no legacy member", async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (sql === MEMBER_ORDERS_SQL) {
        throw new Error("legacy orders are not available without a unique member");
      }
      if (sql === SHOPIFY_ORDERS_BY_EMAILS_SQL) {
        return [
          {
            shopify_order_id: "77",
            order_number: "1600",
            order_name: "#1600",
            processed_at: "2026-10-18T12:00:00.000Z",
            customer_email: null,
            checkout_email: "pat@gmail.com",
            tracking_links: [],
            currency: "USD",
            total_price: "1899.00",
            total_refunded: "0",
            financial_status: "paid",
            fulfillment_status: "unfulfilled",
            cancelled_at: null,
            cancel_reason: null,
            source: "shopify",
          },
        ];
      }
      if (sql === SHOPIFY_ORDER_ITEMS_BY_ORDER_IDS_SQL) {
        return [
          {
            shopify_order_id: "77",
            shopify_line_item_id: "1",
            title: "Standard Gauge Knitting Machine",
            quantity: 1,
            sku: "MACHINE",
            variant_title: null,
            unit_price: "1899.00",
          },
        ];
      }
      return [];
    });

    const history = await loadAccountPurchaseHistory(VERIFIED, {
      queryFn,
      resolveLegacyLink: async () => ({ status: "none" }),
    });

    expect(history.legacyLink).toBe("none");
    expect(history.legacyNote).toBeNull();
    expect(history.orders[0]?.items[0]?.title).toBe("Standard Gauge Knitting Machine");
    expect(history.orders[0]?.fulfillmentStatus).toBe("Unfulfilled");
    expect(history.emailNote).toContain("Guest checkout");
  });

  it("does not query when the verified email is missing", async () => {
    const queryFn = vi.fn(async () => {
      throw new Error("no query without an email");
    });
    const history = await loadAccountPurchaseHistory("  ", {
      queryFn,
      resolveLegacyLink: async () => {
        throw new Error("no legacy lookup without an email");
      },
    });
    expect(history.legacyLink).toBe("no_email");
    expect(history.orders).toEqual([]);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("drops staff-only fields from a purchase row", () => {
    const source = {
      storeTransactionId: "shopify:900",
      transactionId: "#1502",
      orderDate: "Oct 2, 2026",
      orderDateSort: "2026-10-02",
      orderStatus: "Paid",
      orderTotal: "$48.00",
      orderTotalSort: "48",
      paymentMethod: "shopify_payments",
      items: [
        {
          transactionItemId: "3",
          description: "LK150 Second Tension Mast Kit · SKU MAST-2",
          customerLabel: "LK150 Second Tension Mast Kit",
          quantity: "1",
          itemPrice: "$48.00",
          lineTotal: "$48.00",
        },
      ],
      source: "shopify",
      shopifyOrderId: "900",
      shopifyOrderHref: "/watson/sales/900",
      accountOrderNumber: "#1502",
      paymentStatusLabel: "Paid",
      fulfillmentStatusLabel: "Fulfilled",
      trackingLinks: [
        { label: "Track package", url: "javascript:alert(1)", trackingNumber: "1Z999AA10123456790" },
      ],
    } as MemberOrderDisplay;

    const order = toAccountPurchaseOrder(source);
    expect(order.orderNumber).toBe("#1502");
    expect(JSON.stringify(order)).not.toContain("/watson/sales");
    expect(JSON.stringify(order)).not.toContain("javascript:");
    expect(JSON.stringify(order)).not.toContain("shopify_payments");
    expect(order.trackingLinks[0]?.url).toBeNull();
    expect(order.trackingLinks[0]?.trackingNumber).toBe("1Z999AA10123456790");
  });
});
