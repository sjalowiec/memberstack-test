import { describe, expect, it } from "vitest";

import { computeShopifySalesPeriodTotals } from "./shopifySalesTotals";

describe("shopifySalesTotals", () => {
  it("buckets gross, refunds, net, and counts", () => {
    const now = new Date("2026-07-23T15:00:00.000Z");
    const totals = computeShopifySalesPeriodTotals(
      [
        {
          processedAt: "2026-07-23T10:00:00.000Z",
          totalPrice: 100,
          totalRefunded: 0,
        },
        {
          processedAt: "2026-07-22T10:00:00.000Z",
          totalPrice: 50,
          totalRefunded: 10,
        },
        {
          processedAt: "2026-06-01T10:00:00.000Z",
          totalPrice: 999,
          totalRefunded: 0,
        },
      ],
      now,
    );

    expect(totals.today.orderCount).toBe(1);
    expect(totals.today.grossSales).toBe(100);
    expect(totals.today.netSales).toBe(100);

    expect(totals.last30Days.orderCount).toBe(2);
    expect(totals.last30Days.grossSales).toBe(150);
    expect(totals.last30Days.refunds).toBe(10);
    expect(totals.last30Days.netSales).toBe(140);

    expect(totals.month.orderCount).toBe(2);
    expect(totals.week.orderCount).toBeGreaterThanOrEqual(2);
  });
});
