/**
 * Watson Sales Report - actual revenue collected from Shopify and Stripe.
 *
 * Read-only. Reports money that was actually collected during a range of
 * America/Los_Angeles calendar days: Shopify order revenue (from the synced
 * `watson_shopify_orders` table) and Knit It Now membership payments (from the
 * live Stripe API). It does NOT use projected subscription value / MRR.
 *
 * The compute layer (`computeSalesReport`) is pure and fully unit-testable; the
 * `loadSalesReport` loader performs the Postgres + Stripe I/O.
 */

import { queryWatson } from "./db";
import type { WatsonQueryFn } from "./memberSearch";
import {
  civilDayKey,
  eachCivilDay,
  SHOPIFY_STALE_HOURS,
  type DayRange,
} from "./salesReportDates";
import { getShopifySyncStatus } from "./shopifyOrdersSync";
import {
  fetchStripeChargesInRange,
  readStripeReportingConfig,
  type NormalizedStripeCharge,
} from "./stripeReportingClient";
import {
  classifyStripeCharge,
  isMembershipCategory,
  type MembershipCategory,
} from "./stripeSalesClassify";
import {
  readStripeMembershipConfig,
  stripeMembershipConfigIsEmpty,
  type StripeMembershipClassificationConfig,
} from "../../config/stripeMembership";

const SHOPIFY_FINANCIAL_STATUSES_COLLECTED = [
  "paid",
  "partially_paid",
  "partially_refunded",
  "refunded",
];

export interface RevenueTotals {
  /** Gross amount collected (before refunds), USD. */
  grossCollected: number;
  /** Refunds attributed to the period, USD. */
  refunds: number;
  /** Net collected (gross ? refunds), USD. */
  netCollected: number;
  /** Number of successful transactions. */
  transactionCount: number;
}

export type SourceKind = "shopify" | "stripe";

export interface SourceStatus {
  source: SourceKind;
  /** Whether usable data was retrieved. When false, totals must not be read. */
  available: boolean;
  /** Whether the data is considered stale (warn but still show). */
  stale: boolean;
  /** ISO timestamp of last sync (Shopify) or retrieval (Stripe). */
  lastAt: string | null;
  /** Human-readable freshness detail. */
  detail: string;
  /** Populated when unavailable or degraded. */
  error: string | null;
}

export interface DailyRow {
  /** LA calendar day, "YYYY-MM-DD". */
  date: string;
  shopify: RevenueTotals;
  membership: RevenueTotals;
  refunds: number;
  netCollected: number;
  inProgress: boolean;
}

export interface MembershipBreakdown {
  monthly: RevenueTotals;
  annual: RevenueTotals;
  other: RevenueTotals;
}

export interface SalesReportSummary {
  shopify: RevenueTotals;
  membership: RevenueTotals;
  combined: RevenueTotals;
  /** True when a source is unavailable, so combined is a partial figure. */
  combinedPartial: boolean;
}

export interface SalesReport {
  range: DayRange;
  generatedAtIso: string;
  summary: SalesReportSummary;
  membershipBreakdown: MembershipBreakdown;
  daily: DailyRow[];
  sources: { shopify: SourceStatus; stripe: SourceStatus };
  /** Aggregated visible warnings (stale/unavailable sources, config gaps). */
  warnings: string[];
}

/** A Shopify order normalized for the report (money already in USD). */
export interface NormalizedShopifyOrder {
  processedAtIso: string;
  grossCollected: number;
  refunds: number;
}

function emptyTotals(): RevenueTotals {
  return { grossCollected: 0, refunds: 0, netCollected: 0, transactionCount: 0 };
}

function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function addToTotals(
  totals: RevenueTotals,
  gross: number,
  refunds: number,
): void {
  totals.grossCollected += gross;
  totals.refunds += refunds;
  totals.netCollected += gross - refunds;
  totals.transactionCount += 1;
}

function finalizeTotals(totals: RevenueTotals): RevenueTotals {
  return {
    grossCollected: roundCents(totals.grossCollected),
    refunds: roundCents(totals.refunds),
    netCollected: roundCents(totals.netCollected),
    transactionCount: totals.transactionCount,
  };
}

export interface ComputeSalesReportInput {
  range: DayRange;
  now: Date;
  shopifyOrders: NormalizedShopifyOrder[];
  stripeCharges: NormalizedStripeCharge[];
  classifyConfig: StripeMembershipClassificationConfig;
  shopifySource: SourceStatus;
  stripeSource: SourceStatus;
}

/**
 * Decide whether a Stripe charge is a countable, successful, non-test payment.
 * Excludes failed/pending/test/non-USD/Shopify-origin charges.
 */
export function isCountableStripeCharge(charge: NormalizedStripeCharge): boolean {
  if (charge.status !== "succeeded") return false;
  if (!charge.paid) return false;
  if (!charge.livemode) return false; // exclude test-mode payments
  if (charge.currency !== "usd") return false;
  // Dedup safety: never count a Shopify-gateway charge as membership revenue;
  // Shopify revenue is sourced separately from watson_shopify_orders.
  if (charge.hasShopifyMarker) return false;
  return true;
}

/** Pure aggregation of normalized Shopify + Stripe data into the report shape. */
export function computeSalesReport(input: ComputeSalesReportInput): SalesReport {
  const { range, now, shopifyOrders, stripeCharges, classifyConfig } = input;

  const dayKeys = eachCivilDay(range.fromCivil, range.toCivil);
  const dayShopify = new Map<string, RevenueTotals>();
  const dayMembership = new Map<string, RevenueTotals>();
  for (const key of dayKeys) {
    dayShopify.set(key, emptyTotals());
    dayMembership.set(key, emptyTotals());
  }

  const shopifyTotal = emptyTotals();
  const membershipTotal = emptyTotals();
  const breakdown: Record<MembershipCategory, RevenueTotals> = {
    monthly: emptyTotals(),
    annual: emptyTotals(),
    other: emptyTotals(),
  };

  if (input.shopifySource.available) {
    for (const order of shopifyOrders) {
      const key = civilDayKey(new Date(order.processedAtIso));
      const bucket = dayShopify.get(key);
      const gross = Number.isFinite(order.grossCollected) ? order.grossCollected : 0;
      const refunds = Number.isFinite(order.refunds) ? order.refunds : 0;
      if (bucket) addToTotals(bucket, gross, refunds);
      addToTotals(shopifyTotal, gross, refunds);
    }
  }

  if (input.stripeSource.available) {
    for (const charge of stripeCharges) {
      if (!isCountableStripeCharge(charge)) continue;
      const category = classifyStripeCharge(charge.lines, classifyConfig);
      if (!isMembershipCategory(category)) continue;

      const key = civilDayKey(new Date(charge.createdIso));
      const bucket = dayMembership.get(key);
      const gross = charge.amount;
      const refunds = charge.amountRefunded;
      if (bucket) addToTotals(bucket, gross, refunds);
      addToTotals(membershipTotal, gross, refunds);
      addToTotals(breakdown[category], gross, refunds);
    }
  }

  const daily: DailyRow[] = dayKeys.map((date) => {
    const shopify = finalizeTotals(dayShopify.get(date) ?? emptyTotals());
    const membership = finalizeTotals(dayMembership.get(date) ?? emptyTotals());
    return {
      date,
      shopify,
      membership,
      refunds: roundCents(shopify.refunds + membership.refunds),
      netCollected: roundCents(shopify.netCollected + membership.netCollected),
      inProgress: date === range.todayCivil,
    };
  });

  const shopifyFinal = finalizeTotals(shopifyTotal);
  const membershipFinal = finalizeTotals(membershipTotal);

  const combinedPartial =
    !input.shopifySource.available || !input.stripeSource.available;
  const combined: RevenueTotals = {
    grossCollected: roundCents(
      (input.shopifySource.available ? shopifyFinal.grossCollected : 0) +
        (input.stripeSource.available ? membershipFinal.grossCollected : 0),
    ),
    refunds: roundCents(
      (input.shopifySource.available ? shopifyFinal.refunds : 0) +
        (input.stripeSource.available ? membershipFinal.refunds : 0),
    ),
    netCollected: roundCents(
      (input.shopifySource.available ? shopifyFinal.netCollected : 0) +
        (input.stripeSource.available ? membershipFinal.netCollected : 0),
    ),
    transactionCount:
      (input.shopifySource.available ? shopifyFinal.transactionCount : 0) +
      (input.stripeSource.available ? membershipFinal.transactionCount : 0),
  };

  const warnings: string[] = [];
  if (!input.shopifySource.available) {
    warnings.push(`Shopify data unavailable: ${input.shopifySource.error ?? "unknown error"}`);
  } else if (input.shopifySource.stale) {
    warnings.push(`Shopify data may be stale: ${input.shopifySource.detail}`);
  }
  if (!input.stripeSource.available) {
    warnings.push(`Stripe data unavailable: ${input.stripeSource.error ?? "unknown error"}`);
  } else if (input.stripeSource.stale) {
    warnings.push(`Stripe data degraded: ${input.stripeSource.detail}`);
  }

  return {
    range,
    generatedAtIso: now.toISOString(),
    summary: {
      shopify: shopifyFinal,
      membership: membershipFinal,
      combined,
      combinedPartial,
    },
    membershipBreakdown: {
      monthly: finalizeTotals(breakdown.monthly),
      annual: finalizeTotals(breakdown.annual),
      other: finalizeTotals(breakdown.other),
    },
    daily,
    sources: { shopify: input.shopifySource, stripe: input.stripeSource },
    warnings,
  };
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Load in-range collected Shopify orders from Watson Postgres. */
export async function loadShopifyOrdersForRange(
  range: DayRange,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<NormalizedShopifyOrder[]> {
  const statuses = SHOPIFY_FINANCIAL_STATUSES_COLLECTED.map((s) => `'${s}'`).join(", ");
  const rows = await queryFn<{
    processed_at: Date | string | null;
    total_price: string | number;
    total_refunded: string | number;
  }>(
    `
    SELECT processed_at, total_price, total_refunded
    FROM watson_shopify_orders
    WHERE source = 'shopify'
      AND cancelled_at IS NULL
      AND lower(coalesce(financial_status, '')) IN (${statuses})
      AND processed_at >= $1::timestamptz
      AND processed_at < $2::timestamptz
    `,
    [range.startUtc.toISOString(), range.endUtc.toISOString()],
  );

  return rows
    .filter((row) => row.processed_at != null)
    .map((row) => ({
      processedAtIso: new Date(row.processed_at as Date | string).toISOString(),
      grossCollected: toNumber(row.total_price),
      refunds: toNumber(row.total_refunded),
    }));
}

function buildStripeStaleDetail(configEmpty: boolean): string {
  return configEmpty
    ? "No Stripe membership price/product ids configured - membership payments cannot be classified. Set STRIPE_MEMBERSHIP_* env vars."
    : "Retrieved live from Stripe.";
}

export interface LoadSalesReportOptions {
  range: DayRange;
  now?: Date;
  queryFn?: WatsonQueryFn;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}

/** Load and compute the full sales report (Shopify Postgres + live Stripe). */
export async function loadSalesReport(
  options: LoadSalesReportOptions,
): Promise<SalesReport> {
  const now = options.now ?? new Date();
  const queryFn = options.queryFn ?? queryWatson;
  const env = options.env ?? process.env;

  // ---- Shopify (from synced Postgres) ----
  let shopifyOrders: NormalizedShopifyOrder[] = [];
  let shopifySource: SourceStatus;
  try {
    const [orders, syncStatus] = await Promise.all([
      loadShopifyOrdersForRange(options.range, queryFn),
      getShopifySyncStatus().catch(() => null),
    ]);
    shopifyOrders = orders;
    const lastAt = syncStatus?.lastSuccessfulSyncAt ?? null;
    const ageHours = lastAt
      ? (now.getTime() - new Date(lastAt).getTime()) / (60 * 60 * 1000)
      : Number.POSITIVE_INFINITY;
    const stale = ageHours > SHOPIFY_STALE_HOURS;
    shopifySource = {
      source: "shopify",
      available: true,
      stale,
      lastAt,
      detail: lastAt
        ? `Last successful Shopify sync ${new Date(lastAt).toISOString()} (${ageHours.toFixed(1)}h ago).`
        : "Shopify has never completed a successful sync.",
      error: null,
    };
  } catch (error) {
    shopifySource = {
      source: "shopify",
      available: false,
      stale: true,
      lastAt: null,
      detail: "Shopify order data could not be read from Watson Postgres.",
      error:
        error instanceof Error
          ? error.message
          : "Unable to read Shopify orders. Check WATSON_DATABASE_URL.",
    };
  }

  // ---- Stripe (live membership payments) ----
  const classifyConfig = readStripeMembershipConfig(env);
  const classifyConfigEmpty = stripeMembershipConfigIsEmpty(classifyConfig);
  let stripeCharges: NormalizedStripeCharge[] = [];
  let stripeSource: SourceStatus;

  const stripeConfig = readStripeReportingConfig(env);
  if ("error" in stripeConfig) {
    stripeSource = {
      source: "stripe",
      available: false,
      stale: true,
      lastAt: null,
      detail: stripeConfig.error,
      error: stripeConfig.error,
    };
  } else {
    try {
      stripeCharges = await fetchStripeChargesInRange({
        startUtc: options.range.startUtc,
        endUtc: options.range.endUtc,
        config: stripeConfig,
        // When no explicit fetch is injected, the client resolves the local
        // TLS opt-in (STRIPE_TLS_INSECURE) itself.
        fetchImpl: options.fetchImpl,
        env,
      });
      stripeSource = {
        source: "stripe",
        available: true,
        stale: classifyConfigEmpty,
        lastAt: now.toISOString(),
        detail: buildStripeStaleDetail(classifyConfigEmpty),
        error: null,
      };
    } catch (error) {
      stripeSource = {
        source: "stripe",
        available: false,
        stale: true,
        lastAt: null,
        detail: "Stripe could not be queried.",
        error:
          error instanceof Error
            ? error.message
            : "Unable to query Stripe for membership payments.",
      };
    }
  }

  return computeSalesReport({
    range: options.range,
    now,
    shopifyOrders,
    stripeCharges,
    classifyConfig,
    shopifySource,
    stripeSource,
  });
}

export function formatReportUsd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
