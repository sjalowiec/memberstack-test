/**
 * Watson Sales Report - actual revenue collected from Shopify and Stripe.
 *
 * Read-only. Reports money that was actually collected during a range of
 * America/Los_Angeles calendar days. Shopify is retrieved live from the Admin
 * API for the selected range, with the synced `watson_shopify_orders` table as
 * fallback. Stripe is live Charges (succeeded, paid, live-mode USD), plus a
 * best-effort paid-invoice backfill so invoice Charges are not missed.
 * Checkout, payment links, subscriptions, and paid invoices count when they
 * produce a succeeded Charge. Shopify-gateway Charges are excluded so the
 * same payment is not counted in both sources. It does NOT use projected
 * subscription value / MRR.
 *
 * The compute layer (`computeSalesReport`) is pure and fully unit-testable; the
 * `loadSalesReport` loader performs the Shopify + Postgres + Stripe I/O.
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
import { fetchShopifyOrdersProcessedInRange } from "./shopifyAdminClient";
import { getShopifyAdminConfig } from "./shopifyEnv";
import { mapShopifyRestOrder, type MappedShopifyOrder } from "./shopifyOrderMap";
import { getShopifySyncStatus } from "./shopifyOrdersSync";
import {
  fetchStripeChargesInRange,
  readStripeReportingConfig,
  type NormalizedStripeCharge,
  type StripePaymentChannel,
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

export type TransactionSource = "shopify" | "stripe";
export type TransactionChannel = "shopify" | StripePaymentChannel;

export interface SalesTransactionRow {
  id: string;
  source: TransactionSource;
  channel: TransactionChannel;
  createdIso: string;
  createdLa: string;
  description: string;
  grossCollected: number;
  refunds: number;
  netCollected: number;
  counted: boolean;
  exclusionReason: string | null;
  invoiceId: string | null;
  paymentIntentId: string | null;
}

/** @deprecated Use SalesTransactionRow. Kept so existing diagnostics call sites type-check during the swap. */
export type StripeChargeDiagnosticRow = SalesTransactionRow;

export interface SalesReconciliation {
  grossCollected: number;
  refunds: number;
  netCollected: number;
  transactionCount: number;
  matchesSummary: boolean;
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
  /** Counted and excluded transactions that make up (or were omitted from) the totals. */
  transactions: SalesTransactionRow[];
  reconciliation: SalesReconciliation;
  /** Alias of transactions for the previous localhost diagnostics table. */
  stripeDiagnostics: SalesTransactionRow[] | null;
}

/** A Shopify order normalized for the report (money already in USD). */
export interface NormalizedShopifyOrder {
  id?: string;
  orderName?: string;
  processedAtIso: string;
  grossCollected: number;
  refunds: number;
  financialStatus?: string | null;
  cancelledAt?: string | null;
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

export function explainShopifyOrderDecision(
  order: NormalizedShopifyOrder,
  options: { inRangeDays?: Set<string> } = {},
): { counted: boolean; exclusionReason: string | null } {
  if (order.cancelledAt) {
    return { counted: false, exclusionReason: "order is cancelled" };
  }
  const status = (order.financialStatus ?? "").trim().toLowerCase();
  if (status && !SHOPIFY_FINANCIAL_STATUSES_COLLECTED.includes(status)) {
    return {
      counted: false,
      exclusionReason: `financial_status is "${order.financialStatus}"`,
    };
  }
  if (options.inRangeDays) {
    const key = civilDayKey(new Date(order.processedAtIso));
    if (!options.inRangeDays.has(key)) {
      return {
        counted: false,
        exclusionReason: `processed ${key} is outside the requested LA range`,
      };
    }
  }
  return { counted: true, exclusionReason: null };
}

function stripeTransactionRow(
  charge: NormalizedStripeCharge,
  decision: { counted: boolean; exclusionReason: string | null },
): SalesTransactionRow {
  const gross = charge.amount;
  const refunds = charge.amountRefunded;
  return {
    id: charge.id,
    source: "stripe",
    channel: charge.channel ?? "other",
    createdIso: charge.createdIso,
    createdLa: formatLaTimestamp(charge.createdIso),
    description: charge.description || charge.invoiceId || charge.id,
    grossCollected: gross,
    refunds,
    netCollected: roundCents(gross - refunds),
    counted: decision.counted,
    exclusionReason: decision.exclusionReason,
    invoiceId: charge.invoiceId ?? null,
    paymentIntentId: charge.paymentIntentId ?? null,
  };
}

function shopifyTransactionRow(
  order: NormalizedShopifyOrder,
  decision: { counted: boolean; exclusionReason: string | null },
): SalesTransactionRow {
  const gross = Number.isFinite(order.grossCollected) ? order.grossCollected : 0;
  const refunds = Number.isFinite(order.refunds) ? order.refunds : 0;
  const id = order.id || order.orderName || order.processedAtIso;
  return {
    id,
    source: "shopify",
    channel: "shopify",
    createdIso: order.processedAtIso,
    createdLa: formatLaTimestamp(order.processedAtIso),
    description: order.orderName || id,
    grossCollected: gross,
    refunds,
    netCollected: roundCents(gross - refunds),
    counted: decision.counted,
    exclusionReason: decision.exclusionReason,
    invoiceId: null,
    paymentIntentId: null,
  };
}

export function buildStripeChargeDiagnostics(
  charges: NormalizedStripeCharge[],
  range: DayRange,
): SalesTransactionRow[] {
  const inRangeDays = new Set(eachCivilDay(range.fromCivil, range.toCivil));
  const seenChargeIds = new Set<string>();
  return charges.map((charge) => {
    const decision = explainStripeChargeDecision(charge, { inRangeDays, seenChargeIds });
    if (decision.counted) seenChargeIds.add(charge.id);
    return stripeTransactionRow(charge, decision);
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
  const transactions: SalesTransactionRow[] = [];

  if (input.shopifySource.available) {
    for (const order of shopifyOrders) {
      const key = civilDayKey(new Date(order.processedAtIso));
      const decision = explainShopifyOrderDecision(order, { inRangeDays });
      transactions.push(shopifyTransactionRow(order, decision));
      if (!decision.counted) continue;
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
      const decision = explainStripeChargeDecision(charge, { inRangeDays, seenChargeIds });
      transactions.push(stripeTransactionRow(charge, decision));
      if (!decision.counted) continue;
      seenChargeIds.add(charge.id);

      const key = civilDayKey(new Date(charge.createdIso));
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

  transactions.sort((a, b) => a.createdIso.localeCompare(b.createdIso) || a.id.localeCompare(b.id));

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

  const countedTx = transactions.filter((row) => row.counted);
  const reconciliationTotals = emptyTotals();
  for (const row of countedTx) {
    addToTotals(reconciliationTotals, row.grossCollected, row.refunds);
  }
  const reconciliationFinal = finalizeTotals(reconciliationTotals);
  const reconciliation: SalesReconciliation = {
    ...reconciliationFinal,
    matchesSummary:
      reconciliationFinal.grossCollected === combined.grossCollected &&
      reconciliationFinal.refunds === combined.refunds &&
      reconciliationFinal.netCollected === combined.netCollected &&
      reconciliationFinal.transactionCount === combined.transactionCount,
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
    transactions,
    reconciliation,
    stripeDiagnostics: input.includeStripeDiagnostics
      ? transactions.filter((row) => row.source === "stripe")
      : transactions,
  };
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function mappedShopifyOrderToNormalized(
  order: MappedShopifyOrder,
): NormalizedShopifyOrder | null {
  const processedAt = order.processedAt ?? order.createdAtShopify;
  if (!processedAt) return null;
  return {
    id: order.shopifyOrderId,
    orderName: order.orderName ?? `#${order.orderNumber}`,
    processedAtIso: new Date(processedAt).toISOString(),
    grossCollected: order.totalPrice,
    refunds: order.totalRefunded,
    financialStatus: order.financialStatus,
    cancelledAt: order.cancelledAt,
  };
}

/** Load in-range Shopify orders from Watson Postgres (fallback when live Admin API fails). */
export async function loadShopifyOrdersForRange(
  range: DayRange,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<NormalizedShopifyOrder[]> {
  const rows = await queryFn<{
    shopify_order_id: string;
    order_name: string | null;
    order_number: string | null;
    processed_at: Date | string | null;
    total_price: string | number;
    total_refunded: string | number;
    financial_status: string | null;
    cancelled_at: Date | string | null;
  }>(
    `
    SELECT shopify_order_id, order_name, order_number, processed_at,
           total_price, total_refunded, financial_status, cancelled_at
    FROM watson_shopify_orders
    WHERE source = 'shopify'
      AND processed_at >= $1::timestamptz
      AND processed_at < $2::timestamptz
    `,
    [range.startUtc.toISOString(), range.endUtc.toISOString()],
  );

  return rows
    .filter((row) => row.processed_at != null)
    .map((row) => ({
      id: row.shopify_order_id,
      orderName: row.order_name ?? (row.order_number ? `#${row.order_number}` : row.shopify_order_id),
      processedAtIso: new Date(row.processed_at as Date | string).toISOString(),
      grossCollected: toNumber(row.total_price),
      refunds: toNumber(row.total_refunded),
      financialStatus: row.financial_status,
      cancelledAt: row.cancelled_at
        ? new Date(row.cancelled_at as Date | string).toISOString()
        : null,
    }));
}

async function loadLiveShopifyOrdersForRange(
  range: DayRange,
  options: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv },
): Promise<NormalizedShopifyOrder[]> {
  const config = getShopifyAdminConfig(options.env);
  if ("error" in config) {
    throw new Error(config.error);
  }
  const raw = await fetchShopifyOrdersProcessedInRange({
    processedAtMin: range.startUtc.toISOString(),
    processedAtMax: range.endUtc.toISOString(),
    config,
    fetchImpl: options.fetchImpl,
  });
  const orders: NormalizedShopifyOrder[] = [];
  for (const rawOrder of raw) {
    const mapped = mapShopifyRestOrder(rawOrder);
    if (!mapped) continue;
    const normalized = mappedShopifyOrderToNormalized(mapped);
    if (normalized) orders.push(normalized);
  }
  return orders;
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

  // ---- Shopify (live Admin API, Postgres sync as fallback) ----
  let shopifyOrders: NormalizedShopifyOrder[] = [];
  let shopifySource: SourceStatus | undefined;
  let liveShopifyError: string | null = null;
  try {
    shopifyOrders = await loadLiveShopifyOrdersForRange(options.range, {
      fetchImpl: options.fetchImpl,
      env,
    });
    shopifySource = {
      source: "shopify",
      available: true,
      stale: false,
      lastAt: now.toISOString(),
      detail: `Retrieved live from Shopify (${shopifyOrders.length} orders in range).`,
      error: null,
    };
  } catch (error) {
    liveShopifyError =
      error instanceof Error ? error.message : "Live Shopify Admin API request failed.";
  }

  if (!shopifySource) {
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
      const syncDetail = lastAt
        ? `Last successful Shopify sync ${new Date(lastAt).toISOString()} (${ageHours.toFixed(1)}h ago).`
        : "Shopify has never completed a successful sync.";
      shopifySource = {
        source: "shopify",
        available: true,
        stale,
        lastAt,
        detail: liveShopifyError
          ? `Live Shopify unavailable (${liveShopifyError}). Using synced orders. ${syncDetail}`
          : syncDetail,
        error: null,
      };
    } catch (error) {
      shopifySource = {
        source: "shopify",
        available: false,
        stale: true,
        lastAt: null,
        detail: liveShopifyError
          ? `Live Shopify unavailable (${liveShopifyError}). Synced order data could not be read from Watson Postgres.`
          : "Shopify order data could not be read from Watson Postgres.",
        error:
          error instanceof Error
            ? error.message
            : "Unable to read Shopify orders. Check WATSON_DATABASE_URL.",
      };
    }
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
    includeStripeDiagnostics: true,
  });
  if (options.includeStripeDiagnostics) {
    console.info(
      `[watson-sales] diagnostics: shopify ${report.summary.shopify.transactionCount}/${report.summary.shopify.netCollected}, stripe returned ${stripeCharges.length} counted ${report.summary.stripe.transactionCount} net ${report.summary.stripe.netCollected}, combined ${report.summary.combined.netCollected}, recon ${report.reconciliation.matchesSummary}`,
    );
  }
  return report;
}

export function formatReportUsd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
