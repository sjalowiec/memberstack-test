import {
  formatLegacyAverageOrderValue,
  formatLegacyMoneyDisplay,
  parseLegacyMoneyAmount,
} from "./memberOrders";
import { type WatsonQueryFn } from "./memberSearch";
import { queryWatson } from "./db";

export const STORE_SALES_BY_YEAR_SQL = `
  SELECT
    EXTRACT(YEAR FROM purchasedate)::int AS year,
    COUNT(*)::text AS order_count,
    COALESCE(SUM(COALESCE(totalcost, 0)), 0)::text AS revenue
  FROM legacy_store_transactions
  WHERE purchasedate IS NOT NULL
  GROUP BY EXTRACT(YEAR FROM purchasedate)
  ORDER BY year DESC
`;

export interface StoreSalesByYearRow {
  year: number;
  orderCount: number;
  revenueAmount: number;
  revenueDisplay: string;
  averageOrderValueAmount: number;
  averageOrderValueDisplay: string;
}

export interface StoreSalesByYearTotals {
  orderCount: number;
  revenueAmount: number;
  revenueDisplay: string;
  averageOrderValueAmount: number;
  averageOrderValueDisplay: string;
}

export interface StoreSalesByYearReport {
  rows: StoreSalesByYearRow[];
  totals: StoreSalesByYearTotals;
}

export function parseStoreSalesYear(value: string | number | null | undefined): number {
  const year = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(year) ? 0 : year;
}

export function parseStoreSalesOrderCount(value: string | null | undefined): number {
  const count = Number.parseInt(value ?? "0", 10);
  return Number.isNaN(count) ? 0 : count;
}

export function parseStoreSalesRevenueAmount(value: string | number | null | undefined): number {
  return parseLegacyMoneyAmount(value) ?? 0;
}

export function buildStoreSalesByYearRow(input: {
  year: string | number;
  order_count: string;
  revenue: string;
}): StoreSalesByYearRow {
  const year = parseStoreSalesYear(input.year);
  const orderCount = parseStoreSalesOrderCount(input.order_count);
  const revenueAmount = parseStoreSalesRevenueAmount(input.revenue);
  const averageOrderValueAmount = orderCount > 0 ? revenueAmount / orderCount : 0;

  return {
    year,
    orderCount,
    revenueAmount,
    revenueDisplay: formatLegacyMoneyDisplay(revenueAmount),
    averageOrderValueAmount,
    averageOrderValueDisplay: formatLegacyAverageOrderValue(revenueAmount, orderCount),
  };
}

export function buildStoreSalesByYearTotals(rows: StoreSalesByYearRow[]): StoreSalesByYearTotals {
  const orderCount = rows.reduce((sum, row) => sum + row.orderCount, 0);
  const revenueAmount = rows.reduce((sum, row) => sum + row.revenueAmount, 0);
  const averageOrderValueAmount = orderCount > 0 ? revenueAmount / orderCount : 0;

  return {
    orderCount,
    revenueAmount,
    revenueDisplay: formatLegacyMoneyDisplay(revenueAmount),
    averageOrderValueAmount,
    averageOrderValueDisplay: formatLegacyAverageOrderValue(revenueAmount, orderCount),
  };
}

export function buildStoreSalesByYearReport(
  queryRows: Array<{
    year: string | number;
    order_count: string;
    revenue: string;
  }>,
): StoreSalesByYearReport {
  const rows = queryRows.map(buildStoreSalesByYearRow);
  return {
    rows,
    totals: buildStoreSalesByYearTotals(rows),
  };
}

export async function loadStoreSalesByYearReport(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<StoreSalesByYearReport> {
  const queryRows = await queryFn<{
    year: string | number;
    order_count: string;
    revenue: string;
  }>(STORE_SALES_BY_YEAR_SQL);

  return buildStoreSalesByYearReport(queryRows);
}
