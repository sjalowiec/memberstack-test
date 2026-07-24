export interface ShopifySalesBucketInput {
  processedAt: Date | string | null;
  totalPrice: number;
  totalRefunded: number;
  cancelledAt?: Date | string | null;
}

export interface ShopifySalesBucketTotals {
  orderCount: number;
  grossSales: number;
  refunds: number;
  netSales: number;
}

export interface ShopifySalesPeriodTotals {
  today: ShopifySalesBucketTotals;
  week: ShopifySalesBucketTotals;
  month: ShopifySalesBucketTotals;
  last30Days: ShopifySalesBucketTotals;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date: Date): Date {
  const day = startOfUtcDay(date);
  // Monday-start week in UTC
  const weekday = day.getUTCDay(); // 0 Sun .. 6 Sat
  const offset = weekday === 0 ? 6 : weekday - 1;
  day.setUTCDate(day.getUTCDate() - offset);
  return day;
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function emptyBucket(): ShopifySalesBucketTotals {
  return { orderCount: 0, grossSales: 0, refunds: 0, netSales: 0 };
}

function addToBucket(bucket: ShopifySalesBucketTotals, order: ShopifySalesBucketInput): void {
  const gross = Number.isFinite(order.totalPrice) ? order.totalPrice : 0;
  const refunds = Number.isFinite(order.totalRefunded) ? order.totalRefunded : 0;
  bucket.orderCount += 1;
  bucket.grossSales += gross;
  bucket.refunds += refunds;
  bucket.netSales += gross - refunds;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Aggregate live Shopify order money fields into period buckets (UTC). */
export function computeShopifySalesPeriodTotals(
  orders: ShopifySalesBucketInput[],
  now = new Date(),
): ShopifySalesPeriodTotals {
  const todayStart = startOfUtcDay(now);
  const weekStart = startOfUtcWeek(now);
  const monthStart = startOfUtcMonth(now);
  const last30Start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const totals: ShopifySalesPeriodTotals = {
    today: emptyBucket(),
    week: emptyBucket(),
    month: emptyBucket(),
    last30Days: emptyBucket(),
  };

  for (const order of orders) {
    const processedAt = toDate(order.processedAt);
    if (!processedAt) continue;

    if (processedAt >= todayStart) addToBucket(totals.today, order);
    if (processedAt >= weekStart) addToBucket(totals.week, order);
    if (processedAt >= monthStart) addToBucket(totals.month, order);
    if (processedAt >= last30Start) addToBucket(totals.last30Days, order);
  }

  return totals;
}

export function formatShopifyMoney(amount: number, currency = "USD"): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: currency || "USD",
  });
}
