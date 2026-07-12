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
    const queryFn = vi.fn().mockResolvedValueOnce([{ order_count: "27" }]);

    const count = await getMemberOrderCount("DD0CC51B-F6A7-3304-EBC0-C3F510A7BAC3", queryFn);

    expect(queryFn).toHaveBeenCalledWith(MEMBER_ORDER_COUNT_SQL, [
      "DD0CC51B-F6A7-3304-EBC0-C3F510A7BAC3",
    ]);
    expect(count).toBe(27);
  });

  it("loads orders and items for a member", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce([orderRow])
      .mockResolvedValueOnce([itemRow]);

    const orders = await getMemberOrders("DD0CC51B-F6A7-3304-EBC0-C3F510A7BAC3", queryFn);

    expect(queryFn).toHaveBeenNthCalledWith(1, MEMBER_ORDERS_SQL, [
      "DD0CC51B-F6A7-3304-EBC0-C3F510A7BAC3",
    ]);
    expect(queryFn).toHaveBeenNthCalledWith(2, MEMBER_ORDER_ITEMS_SQL, [[29812]]);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.transactionId).toBe(orderRow.transactionid);
    expect(orders[0]?.items).toHaveLength(1);
    expect(orders[0]?.items[0]?.lineTotal).toBe("$135.00");
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
