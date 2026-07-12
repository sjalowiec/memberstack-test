import { describe, expect, it, vi } from "vitest";

import {
  buildStoreSalesByYearReport,
  buildStoreSalesByYearRow,
  buildStoreSalesByYearTotals,
  loadStoreSalesByYearReport,
  parseStoreSalesRevenueAmount,
  STORE_SALES_BY_YEAR_SQL,
} from "./storeSalesByYearReport";

describe("storeSalesByYearReport", () => {
  it("groups store sales by calendar year in SQL", () => {
    expect(STORE_SALES_BY_YEAR_SQL).toContain("EXTRACT(YEAR FROM purchasedate)");
    expect(STORE_SALES_BY_YEAR_SQL).toContain("GROUP BY EXTRACT(YEAR FROM purchasedate)");
    expect(STORE_SALES_BY_YEAR_SQL).toContain("WHERE purchasedate IS NOT NULL");
    expect(STORE_SALES_BY_YEAR_SQL).toContain("ORDER BY year DESC");
    expect(STORE_SALES_BY_YEAR_SQL).toContain("SUM(COALESCE(totalcost, 0))");
  });

  it("aggregates revenue and calculates average order value per year", () => {
    const report = buildStoreSalesByYearReport([
      { year: 2026, order_count: "2", revenue: "30.00" },
      { year: 2025, order_count: "3", revenue: "45.00" },
    ]);

    expect(report.rows[0]).toMatchObject({
      year: 2026,
      orderCount: 2,
      revenueAmount: 30,
      revenueDisplay: "$30.00",
      averageOrderValueAmount: 15,
      averageOrderValueDisplay: "$15.00",
    });
    expect(report.rows[1]).toMatchObject({
      year: 2025,
      orderCount: 3,
      revenueAmount: 45,
      averageOrderValueDisplay: "$15.00",
    });
  });

  it("handles null revenue safely and shows $0.00 when orders exist", () => {
    const row = buildStoreSalesByYearRow({
      year: 2024,
      order_count: "4",
      revenue: "0",
    });

    expect(parseStoreSalesRevenueAmount(null)).toBe(0);
    expect(row.revenueDisplay).toBe("$0.00");
    expect(row.averageOrderValueDisplay).toBe("$0.00");
  });

  it("sorts newest year first from the SQL query", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([
      { year: 2026, order_count: "1", revenue: "10.00" },
      { year: 2025, order_count: "2", revenue: "20.00" },
    ]);

    const report = await loadStoreSalesByYearReport(queryFn);

    expect(queryFn).toHaveBeenCalledWith(STORE_SALES_BY_YEAR_SQL);
    expect(report.rows.map((row) => row.year)).toEqual([2026, 2025]);
  });

  it("calculates totals row values across all years", () => {
    const totals = buildStoreSalesByYearTotals([
      buildStoreSalesByYearRow({ year: 2026, order_count: "2", revenue: "30.00" }),
      buildStoreSalesByYearRow({ year: 2025, order_count: "3", revenue: "45.00" }),
    ]);

    expect(totals.orderCount).toBe(5);
    expect(totals.revenueAmount).toBe(75);
    expect(totals.revenueDisplay).toBe("$75.00");
    expect(totals.averageOrderValueAmount).toBe(15);
    expect(totals.averageOrderValueDisplay).toBe("$15.00");
  });

  it("handles an empty database with zero totals", () => {
    const report = buildStoreSalesByYearReport([]);

    expect(report.rows).toEqual([]);
    expect(report.totals).toMatchObject({
      orderCount: 0,
      revenueAmount: 0,
      revenueDisplay: "$0.00",
      averageOrderValueAmount: 0,
      averageOrderValueDisplay: "$0.00",
    });
  });
});
