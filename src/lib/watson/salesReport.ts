/**
 * Watson Sales Report - actual revenue collected from Shopify and Stripe.
 *
 * Read-only. Reports money that was actually collected during a range of
 * America/Los_Angeles calendar days: Shopify order revenue (from the synced
 * `watson_shopify_orders` table) and live Stripe Charges (succeeded, paid,
 * live-mode USD). Stripe totals are collected revenue, not membership-only:
 * Checkout, payment links, subscriptions, and paid invoices (including
 * manually created invoices with no Knit It Now product) all count when they
 * produce a succeeded Charge. Shopify-gateway Charges are excluded so the
 * same payment is not counted in both sources. It does NOT use projected
 * subscription value / MRR.
 *
 * The compute layer (`computeSalesReport`) is pure and fully unit-testable; the
 * `loadSalesReport` loader performs the Postgres + Stripe I/O.
 */

import { queryWatson } from "./db";
import type { WatsonQueryFn } from "./memberSearch";
import {
  civilDayKey,
  eachCivilDay,
  formatLaTimestamp,
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
  /** All countable Stripe collected revenue for the LA day. */
  stripe: RevenueTotals;
  /** Membership-classified subset of Stripe (breakdown only). */
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
  /** All countable Stripe collected revenue (not membership-filtered). */
  stripe: RevenueTotals;
  /** Membership-classified subset of Stripe collected revenue. */
  membership: RevenueTotals;
  combined: RevenueTotals;
  /** True when a source is unavailable, so combined is a partial figure. */
  combinedPartial: boolean;
}

export interface StripeChargeDiagnosticRow {
  id: string;
  createdIso: string;
  createdLa: string;
  amount: number;
  amountRequested: number;
  amountRefunded: number;
  description: string;
  invoiceId: string | null;
  paymentIntentId: string | null;
  paymentMethodType: string | null;
  lineSummary: string;
  status: string;
  paid: boolean;
  livemode: boolean;
  currency: string;
  counted: boolean;
  exclusionReason: string | null;
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
  /** Localhost-only Charge-by-Charge decision log. Null in production. */
  stripeDiagnostics: StripeChargeDiagnosticRow[] | null;
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
  includeStripeDiagnostics?: boolean;
}

/**
 * Decide whether a Stripe charge is countable collected revenue.
 * Requires a succeeded, paid, live-mode USD Charge. Excludes failed/unpaid/
 * test/non-USD charges and Shopify-gateway charges (those belong to Shopify
 * revenue so the same payment is not counted twice).
 */
export function isCountableStripeCharge(charge: NormalizedStripeCharge): boolean {
  return explainStripeChargeDecision(charge).counted;
}

/**
 * Explain whether a Charge is counted as Stripe collected revenue, and why
 * not. Used by localhost diagnostics and by `isCountableStripeCharge`.
 */
export function explainStripeChargeDecision(
  charge: NormalizedStripeCharge,
  options: { inRangeDays?: Set<string>; seenChargeIds?: Set<string> } = {},
): { counted: boolean; exclusionReason: string | null } {
  if (charge.status !== "succeeded") {
    return { counted: false, exclusionReason: `status is "${charge.status}"` };
  }
  if (!charge.paid) {
    return { counted: false, exclusionReason: "paid is false" };
  }
  if (!charge.livemode) {
    return { counted: false, exclusionReason: "test-mode (livemode is false)" };
  }
  if (charge.currency !== "usd") {
    return { counted: false, exclusionReason: `currency is "${charge.currency}"` };
  }
  if (charge.hasShopifyMarker) {
    return {
      counted: false,
      exclusionReason: charge.shopifyMarkerReason
        ? `Shopify-origin: ${charge.shopifyMarkerReason}`
        : "Shopify-origin marker",
    };
  }
  if (options.seenChargeIds?.has(charge.id)) {
    return { counted: false, exclusionReason: "duplicate charge id" };
  }
  if (options.inRangeDays) {
    const key = civilDayKey(new Date(charge.createdIso));
    if (!options.inRangeDays.has(key)) {
      return {
        counted: false,
        exclusionReason: `created ${key} is outside the requested LA range`,
      };
    }
  }
  return { counted: true, exclusionReason: null };
}

export function buildStripeChargeDiagnostics(
  charges: NormalizedStripeCharge[],
  range: DayRange,
): StripeChargeDiagnosticRow[] {
  const inRangeDays = new Set(eachCivilDay(range.fromCivil, range.toCivil));
  const seenChargeIds = new Set<string>();
  return charges.map((charge) => {
    const decision = explainStripeChargeDecision(charge, { inRangeDays, seenChargeIds });
    if (decision.counted) seenChargeIds.add(charge.id);
    return {
      id: charge.id,
      createdIso: charge.createdIso,
      createdLa: formatLaTimestamp(charge.createdIso),
      amount: charge.amount,
      amountRequested: charge.amountRequested ?? charge.amount,
      amountRefunded: charge.amountRefunded,
      description: charge.description ?? "",
      invoiceId: charge.invoiceId ?? null,
      paymentIntentId: charge.paymentIntentId ?? null,
      paymentMethodType: charge.paymentMethodType ?? null,
      lineSummary:
        charge.lines.length > 0
          ? charge.lines
              .map((line) => line.priceId || line.productId || "no-id")
              .join(", ")
          : "no invoice lines",
      status: charge.status,
      paid: charge.paid,
      livemode: charge.livemode,
      currency: charge.currency,
      counted: decision.counted,
      exclusionReason: decision.exclusionReason,
    };
  });
}

/** Pure aggregation of normalized Shopify + Stripe data into the report shape. */
export function computeSalesReport(input: ComputeSalesReportInput): SalesReport {
  const { range, now, shopifyOrders, stripeCharges, classifyConfig } = input;

  const dayKeys = eachCivilDay(range.fromCivil, range.toCivil);
  const inRangeDays = new Set(dayKeys);
  const dayShopify = new Map<string, RevenueTotals>();
  const dayStripe = new Map<string, RevenueTotals>();
  const dayMembership = new Map<string, RevenueTotals>();
  for (const key of dayKeys) {
    dayShopify.set(key, emptyTotals());
    dayStripe.set(key, emptyTotals());
    dayMembership.set(key, emptyTotals());
  }

  const shopifyTotal = emptyTotals();
  const stripeTotal = emptyTotals();
  const membershipTotal = emptyTotals();
  const breakdown: Record<MembershipCategory, RevenueTotals> = {
    monthly: emptyTotals(),
    annual: emptyTotals(),
    other: emptyTotals(),
  };

  if (input.shopifySource.available) {
    for (const order of shopifyOrders) {
      const key = civilDayKey(new Date(order.processedAtIso));
      if (!inRangeDays.has(key)) continue;
      const bucket = dayShopify.get(key);
      const gross = Number.isFinite(order.grossCollected) ? order.grossCollected : 0;
      const refunds = Number.isFinite(order.refunds) ? order.refunds : 0;
      if (bucket) addToTotals(bucket, gross, refunds);
      addToTotals(shopifyTotal, gross, refunds);
    }
  }

  if (input.stripeSource.available) {
    const seenChargeIds = new Set<string>();
    for (const charge of stripeCharges) {
      if (!isCountableStripeCharge(charge)) continue;
      if (seenChargeIds.has(charge.id)) continue;
      seenChargeIds.add(charge.id);

      const key = civilDayKey(new Date(charge.createdIso));
      if (!inRangeDays.has(key)) continue;

      const gross = charge.amount;
      const refunds = charge.amountRefunded;
      const stripeBucket = dayStripe.get(key);
      if (stripeBucket) addToTotals(stripeBucket, gross, refunds);
      addToTotals(stripeTotal, gross, refunds);

      const category = classifyStripeCharge(charge.lines, classifyConfig);
      if (!isMembershipCategory(category)) continue;
      const membershipBucket = dayMembership.get(key);
      if (membershipBucket) addToTotals(membershipBucket, gross, refunds);
      addToTotals(membershipTotal, gross, refunds);
      addToTotals(breakdown[category], gross, refunds);
    }
  }

  const daily: DailyRow[] = dayKeys.map((date) => {
    const shopify = finalizeTotals(dayShopify.get(date) ?? emptyTotals());
    const stripe = finalizeTotals(dayStripe.get(date) ?? emptyTotals());
    const membership = finalizeTotals(dayMembership.get(date) ?? emptyTotals());
    return {
      date,
      shopify,
      stripe,
      membership,
      refunds: roundCents(shopify.refunds + stripe.refunds),
      netCollected: roundCents(shopify.netCollected + stripe.netCollected),
      inProgress: date === range.todayCivil,
    };
  });

  const shopifyFinal = finalizeTotals(shopifyTotal);
  const stripeFinal = finalizeTotals(stripeTotal);
  const membershipFinal = finalizeTotals(membershipTotal);

  const combinedPartial =
    !input.shopifySource.available || !input.stripeSource.available;
  const combined: RevenueTotals = {
    grossCollected: roundCents(
      (input.shopifySource.available ? shopifyFinal.grossCollected : 0) +
        (input.stripeSource.available ? stripeFinal.grossCollected : 0),
    ),
    refunds: roundCents(
      (input.shopifySource.available ? shopifyFinal.refunds : 0) +
        (input.stripeSource.available ? stripeFinal.refunds : 0),
    ),
    netCollected: roundCents(
      (input.shopifySource.available ? shopifyFinal.netCollected : 0) +
        (input.stripeSource.available ? stripeFinal.netCollected : 0),
    ),
    transactionCount:
      (input.shopifySource.available ? shopifyFinal.transactionCount : 0) +
      (input.stripeSource.available ? stripeFinal.transactionCount : 0),
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
  if (input.stripeSource.available && stripeMembershipConfigIsEmpty(classifyConfig)) {
    warnings.push(
      "Membership price/product ids are not configured, so the membership breakdown cannot be classified. Stripe collected totals still include all succeeded live USD charges.",
    );
  }

  return {
    range,
    generatedAtIso: now.toISOString(),
    summary: {
      shopify: shopifyFinal,
      stripe: stripeFinal,
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
    stripeDiagnostics: input.includeStripeDiagnostics
      ? buildStripeChargeDiagnostics(stripeCharges, range)
      : null,
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

function buildStripeDetail(configEmpty: boolean): string {
  return configEmpty
    ? "Retrieved live from Stripe. Membership breakdown cannot be classified until STRIPE_MEMBERSHIP_* env vars are set; collected Stripe totals are still included."
    : "Retrieved live from Stripe.";
}

export interface LoadSalesReportOptions {
  range: DayRange;
  now?: Date;
  queryFn?: WatsonQueryFn;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  includeStripeDiagnostics?: boolean;
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

  // ---- Stripe (live collected Charges) ----
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
        stale: false,
        lastAt: now.toISOString(),
        detail: buildStripeDetail(classifyConfigEmpty),
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
            : "Unable to query Stripe for collected payments.",
      };
    }
  }

  const report = computeSalesReport({
    range: options.range,
    now,
    shopifyOrders,
    stripeCharges,
    classifyConfig,
    shopifySource,
    stripeSource,
    includeStripeDiagnostics: options.includeStripeDiagnostics === true,
  });
  if (options.includeStripeDiagnostics) {
    console.info(
      `[watson-sales] Stripe diagnostics: returned ${stripeCharges.length}, counted ${report.summary.stripe.transactionCount}, net ${report.summary.stripe.netCollected}, membership ${report.summary.membership.transactionCount}/${report.summary.membership.netCollected}`,
    );
  }
  return report;
}

export function formatReportUsd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
