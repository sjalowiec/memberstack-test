/**
 * Minimal, read-only Stripe reporting client for the Watson Sales Report.
 *
 * Uses the Stripe REST API over `fetch` (no `stripe` SDK dependency, matching
 * the existing Shopify Admin client pattern). Retrieves Charges created in a
 * UTC instant window (the canonical collected-revenue object), with invoice
 * lines expanded so the caller can classify membership vs other Stripe
 * payments and account for (partial) refunds. Paid invoices, Checkout,
 * payment links, and subscriptions are counted when they produce a Charge.
 * The secret key is read server-side only and is NEVER sent to the browser
 * or written to logs.
 *
 * Local TLS: some dev machines sit behind SSL inspection with an incomplete
 * certificate chain, which makes Node's fetch throw UNABLE_TO_VERIFY_LEAF_SIGNATURE.
 * When STRIPE_TLS_INSECURE=1 outside production, requests use a client-scoped
 * https.Agent with rejectUnauthorized=false (same opt-in convention as
 * MEMBERSTACK_TLS_INSECURE). Production ignores the flag.
 */

import https from "node:https";

import { loadEnvFile } from "./env";
import type { StripeChargeLineRef } from "./stripeSalesClassify";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const PAGE_LIMIT = 100;
const MAX_PAGES = 1000; // hard safety cap (~100k charges per window)
/** One extra attempt after a timeout or a 429/5xx. Keeps a hung socket from holding the HTML document. */
const STRIPE_MAX_EXTRA_ATTEMPTS = 1;
const STRIPE_ATTEMPT_TIMEOUT_MS = 10_000;
const STRIPE_RETRY_BASE_MS = 500;
const STRIPE_RETRY_MAX_MS = 1_000;
/**
 * One expanded Charges page is several seconds and about 1MB. A calendar
 * month is 5–6 of those pages, then a second pass over paid invoices. Done
 * one after another, that exceeds the synchronous gateway limit. Three-day
 * chunks stay near one page each and are a slice of the same created window,
 * not a sample of it.
 */
export const STRIPE_RANGE_CHUNK_SECONDS = 3 * 24 * 60 * 60;
const STRIPE_RANGE_CONCURRENCY = 6;

export interface StripeReportingConfig {
  secretKey: string;
  apiBase: string;
}

export type StripeReportingConfigResult =
  | StripeReportingConfig
  | { error: string };

export function readStripeReportingConfig(
  env: NodeJS.ProcessEnv = process.env,
): StripeReportingConfigResult {
  loadEnvFile();
  const secretKey = (env.STRIPE_SECRET_KEY ?? "").trim();
  if (!secretKey) {
    return {
      error:
        "STRIPE_SECRET_KEY is not set. Add a restricted (read-only) Stripe key to report collected Stripe revenue.",
    };
  }
  const apiBase = (env.STRIPE_API_BASE ?? "").trim() || STRIPE_API_BASE;
  return { secretKey, apiBase };
}

/* ============================================================================
 * TLS handling (local SSL-inspection workaround, opt-in, non-production only)
 * ==========================================================================*/

function isProductionRuntime(env: NodeJS.ProcessEnv): boolean {
  const context = String(env.CONTEXT ?? "").trim().toLowerCase();
  if (context) return context === "production";
  return String(env.NODE_ENV ?? "").trim().toLowerCase() === "production";
}

/** True when STRIPE_TLS_INSECURE is an explicit opt-in value (1/true/yes). */
export function isStripeTlsInsecureFlagEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = String(env.STRIPE_TLS_INSECURE ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/** Whether the Stripe client may relax TLS verification (opt-in + non-production). */
export function shouldUseStripeTlsInsecure(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isProductionRuntime(env)) return false;
  return isStripeTlsInsecureFlagEnabled(env);
}

let insecureTlsWarned = false;

/**
 * GET-only fetch that skips TLS certificate verification, scoped to this client
 * (does NOT set the process-wide NODE_TLS_REJECT_UNAUTHORIZED). The reporting
 * client only issues GET requests, so a minimal implementation suffices.
 */
export function createStripeInsecureTlsFetch(): typeof fetch {
  const agent = new https.Agent({ rejectUnauthorized: false });

  const insecureFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const urlString =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : String((input as { url?: string })?.url ?? input);
    const url = new URL(urlString);
    if (url.protocol !== "https:") {
      return fetch(input, init);
    }

    const headers: Record<string, string> = {};
    const initHeaders = init.headers;
    if (initHeaders) {
      if (typeof (initHeaders as Headers).forEach === "function") {
        (initHeaders as Headers).forEach((value, key) => {
          headers[key] = value;
        });
      } else {
        for (const [key, value] of Object.entries(initHeaders as Record<string, string>)) {
          if (value != null) headers[key] = String(value);
        }
      }
    }

    return new Promise<Response>((resolve, reject) => {
      const req = https.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || 443,
          path: `${url.pathname}${url.search}`,
          method: String(init.method ?? "GET").toUpperCase(),
          headers,
          agent,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          res.on("end", () => {
            const responseHeaders = new Headers();
            for (const [key, value] of Object.entries(res.headers)) {
              if (value == null) continue;
              if (Array.isArray(value)) {
                for (const item of value) responseHeaders.append(key, item);
              } else {
                responseHeaders.set(key, value);
              }
            }
            resolve(
              new Response(Buffer.concat(chunks), {
                status: res.statusCode || 0,
                statusText: res.statusMessage || "",
                headers: responseHeaders,
              }),
            );
          });
        },
      );
      req.on("error", reject);
      req.end();
    });
  };

  return insecureFetch as typeof fetch;
}

/** Resolve the fetch implementation, honoring the local TLS opt-in. */
export function resolveStripeReportingFetch(env: NodeJS.ProcessEnv = process.env): typeof fetch {
  if (shouldUseStripeTlsInsecure(env)) {
    if (!insecureTlsWarned) {
      insecureTlsWarned = true;
      console.warn(
        "[stripe-reporting][TLS] Certificate verification disabled for the Stripe reporting client only (STRIPE_TLS_INSECURE=1). Local use only; ignored in production.",
      );
    }
    return createStripeInsecureTlsFetch();
  }
  if (isStripeTlsInsecureFlagEnabled(env) && isProductionRuntime(env)) {
    console.warn("[stripe-reporting][TLS] STRIPE_TLS_INSECURE is set but ignored in production.");
  }
  return fetch;
}

/* ============================================================================
 * Error classification (turn opaque failures into safe, useful messages)
 * ==========================================================================*/

/** Flatten an undici/node fetch error cause chain into a short summary. */
export function summarizeStripeFetchCause(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  let depth = 0;
  while (cur && depth < 8) {
    const rec = cur as { name?: string; code?: string; message?: string; cause?: unknown };
    const bit = [rec.name, rec.code, rec.message].filter(Boolean).join(": ");
    if (bit) parts.push(bit);
    cur = rec.cause;
    depth += 1;
  }
  return parts.join(" | ") || "(no cause details)";
}

function firstFetchErrorCode(err: unknown): string | null {
  let cur: unknown = err;
  let depth = 0;
  while (cur && depth < 8) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === "string" && code.trim()) return code.trim();
    cur = (cur as { cause?: unknown }).cause;
    depth += 1;
  }
  return null;
}

const TLS_ERROR_CODES = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "CERT_HAS_EXPIRED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_GET_ISSUER_CERT",
]);

const DNS_ERROR_CODES = new Set(["ENOTFOUND", "EAI_AGAIN"]);

/**
 * Build a safe, actionable message from a thrown connection error (never
 * contains the key or headers).
 */
export function describeStripeConnectionError(err: unknown): string {
  const code = firstFetchErrorCode(err);
  const summary = summarizeStripeFetchCause(err);
  if (code && TLS_ERROR_CODES.has(code)) {
    return (
      `Unable to connect to Stripe: TLS certificate verification failed (${code}). ` +
      "This machine's network is likely intercepting HTTPS (SSL inspection). Point " +
      "NODE_EXTRA_CA_CERTS at your corporate root CA, or set STRIPE_TLS_INSECURE=1 for local dev only."
    );
  }
  if (code && DNS_ERROR_CODES.has(code)) {
    return `Unable to connect to Stripe: DNS lookup failed (${code}). Check network/DNS connectivity.`;
  }
  if (code) {
    return `Unable to connect to Stripe: network error (${code}). ${summary}`;
  }
  return `Unable to connect to Stripe: ${summary}`;
}

interface StripeErrorBody {
  error?: { type?: string; code?: string; message?: string };
}

/** Build a safe message from a non-2xx Stripe HTTP response. */
export function describeStripeHttpError(status: number, bodyText: string): string {
  let detail = "";
  try {
    const parsed = JSON.parse(bodyText) as StripeErrorBody;
    const err = parsed.error;
    if (err) {
      // Stripe error messages/types/codes do not contain secrets.
      detail = [err.type, err.code, err.message].filter(Boolean).join(" - ");
    }
  } catch {
    detail = bodyText.slice(0, 200).replace(/\s+/g, " ").trim();
  }
  const suffix = detail ? `: ${detail}` : ".";

  if (status === 401) {
    return `Stripe authentication failed (HTTP 401). Check STRIPE_SECRET_KEY${suffix}`;
  }
  if (status === 403) {
    return (
      `Stripe permission denied (HTTP 403). The restricted key is missing a required read ` +
      `permission (Charges read; Invoices read for expanded line items)${suffix}`
    );
  }
  if (status === 429) {
    return `Stripe rate limit reached (HTTP 429). Narrow the date range and retry${suffix}`;
  }
  if (status >= 500) {
    return `Stripe API returned HTTP ${status} (Stripe-side error). Retry later${suffix}`;
  }
  return `Stripe API returned HTTP ${status}${suffix}`;
}

/* ============================================================================
 * Charge normalization
 * ==========================================================================*/

/** A succeeded Stripe charge normalized to reporting-friendly fields. */
export interface NormalizedStripeCharge {
  id: string;
  createdIso: string;
  created: number;
  currency: string;
  livemode: boolean;
  status: string;
  paid: boolean;
  /** Gross amount collected, in major currency units (e.g. dollars). */
  amount: number;
  /** Charge.amount in major units (invoice/face value before capture). */
  amountRequested: number;
  /** Amount refunded so far, in major currency units. Handles partial refunds. */
  amountRefunded: number;
  lines: StripeChargeLineRef[];
  /** True when the charge looks Shopify-originated (dedup safety signal). */
  hasShopifyMarker: boolean;
  /** Why hasShopifyMarker was set; null when not flagged. */
  shopifyMarkerReason: string | null;
  description: string;
  invoiceId: string | null;
  paymentIntentId: string | null;
  paymentMethodType: string | null;
  /** Invoice.billing_reason when the Charge's invoice was expanded. */
  billingReason: string | null;
  /** Checkout / payment link / subscription / invoice / other. */
  channel: StripePaymentChannel;
  /** Stripe customer id (`cus_...`) when the charge included one. */
  customerId: string | null;
  /** Invoice or charge email. Not a mailing address. */
  customerEmail: string | null;
  /** Invoice or billing name. Not used as a mailing address. */
  customerName: string | null;
  /** Stripe subscription id when this charge paid a subscription invoice. */
  subscriptionId: string | null;
  /** True when Stripe marks the charge refunded. Partial refunds also set amountRefunded. */
  refunded: boolean;
}

export type StripePaymentChannel =
  | "subscription"
  | "invoice"
  | "checkout"
  | "payment_link"
  | "other";

interface RawStripePrice {
  id?: string | null;
  product?: string | { id?: string | null } | null;
  recurring?: { interval?: string | null; interval_count?: number | null } | null;
}

interface RawStripeInvoiceLine {
  price?: string | RawStripePrice | null;
  plan?: {
    id?: string | null;
    product?: string | null;
    interval?: string | null;
    interval_count?: number | null;
  } | null;
}

interface RawStripeCharge {
  id: string;
  amount?: number | null;
  amount_captured?: number | null;
  amount_refunded?: number | null;
  currency?: string | null;
  created?: number | null;
  livemode?: boolean | null;
  paid?: boolean | null;
  status?: string | null;
  description?: string | null;
  refunded?: boolean | null;
  receipt_email?: string | null;
  customer?: string | { id?: string | null } | null;
  billing_details?: { email?: string | null; name?: string | null } | null;
  metadata?: Record<string, string> | null;
  invoice?:
    | string
    | null
    | {
        id?: string;
        billing_reason?: string | null;
        customer_email?: string | null;
        customer_name?: string | null;
        customer?: string | { id?: string | null } | null;
        subscription?: string | { id?: string | null } | null;
        collection_method?: string | null;
        paid_out_of_band?: boolean | null;
        charge?: string | { id?: string | null } | null;
        lines?: { data?: RawStripeInvoiceLine[] | null } | null;
      };
  payment_intent?: string | { id?: string | null } | null;
  payment_method_details?: { type?: string | null } | null;
}

interface RawStripeListResponse {
  data?: RawStripeCharge[];
  has_more?: boolean;
}

/** Zero-decimal currencies are billed in whole units, not cents. */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
  "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

export function stripeMinorToMajor(amount: number, currency: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())) return amount;
  return amount / 100;
}

function productIdOf(price: RawStripePrice | null | undefined): string | null {
  if (!price) return null;
  const product = price.product;
  if (!product) return null;
  if (typeof product === "string") return product;
  return product.id ?? null;
}

const RECURRING_INTERVALS = new Set(["day", "week", "month", "year"]);

function normalizeRecurringInterval(
  value: string | null | undefined,
): StripeChargeLineRef["recurringInterval"] {
  const interval = (value ?? "").trim().toLowerCase();
  if (RECURRING_INTERVALS.has(interval)) {
    return interval as "day" | "week" | "month" | "year";
  }
  return null;
}

function normalizeIntervalCount(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function textOrNull(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function expandedInvoice(charge: RawStripeCharge) {
  const invoice = charge.invoice;
  if (!invoice || typeof invoice === "string") return null;
  return invoice;
}

function idFromRef(value: string | { id?: string | null } | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return textOrNull(value);
  return textOrNull(value.id);
}

function lineRefsOf(charge: RawStripeCharge): StripeChargeLineRef[] {
  const invoice = expandedInvoice(charge);
  if (!invoice) return [];
  const lines = invoice.lines?.data ?? [];
  return lines.map((line) => {
    const rawPrice = line.price ?? null;
    const price = rawPrice && typeof rawPrice === "object" ? rawPrice : null;
    const priceIdFromString = typeof rawPrice === "string" ? textOrNull(rawPrice) : null;
    const plan = line.plan ?? null;
    return {
      priceId: textOrNull(price?.id) ?? priceIdFromString ?? textOrNull(plan?.id),
      productId: productIdOf(price) ?? textOrNull(plan?.product),
      recurringInterval: normalizeRecurringInterval(
        price?.recurring?.interval ?? plan?.interval,
      ),
      recurringIntervalCount: normalizeIntervalCount(
        price?.recurring?.interval_count ?? plan?.interval_count,
      ),
    };
  });
}

export function detectShopifyMarker(charge: {
  description?: string | null;
  metadata?: Record<string, string> | null;
}): { hasShopifyMarker: boolean; shopifyMarkerReason: string | null } {
  const description = (charge.description ?? "").toLowerCase();
  if (description.includes("shopify")) {
    return { hasShopifyMarker: true, shopifyMarkerReason: 'description contains "shopify"' };
  }
  const metadata = charge.metadata ?? {};
  const lowerKeys = new Set(Object.keys(metadata).map((key) => key.toLowerCase()));
  for (const [key, value] of Object.entries(metadata)) {
    const haystack = `${key} ${value}`.toLowerCase();
    if (haystack.includes("shopify")) {
      return {
        hasShopifyMarker: true,
        shopifyMarkerReason: `metadata "${key}" contains "shopify"`,
      };
    }
  }
  if (lowerKeys.has("shopify_order_id") || lowerKeys.has("shopify_order_number")) {
    return {
      hasShopifyMarker: true,
      shopifyMarkerReason: 'metadata has Shopify order id',
    };
  }
  const hasOrderId = lowerKeys.has("order_id");
  const hasShopId = lowerKeys.has("shop_id") || lowerKeys.has("shopid");
  const hasShopName = lowerKeys.has("shop_name") || lowerKeys.has("shopname");
  if (hasOrderId && (hasShopId || hasShopName)) {
    return {
      hasShopifyMarker: true,
      shopifyMarkerReason: "Shopify Payments metadata (shop_id/shop_name + order_id)",
    };
  }
  return { hasShopifyMarker: false, shopifyMarkerReason: null };
}

/**
 * Classify how money arrived in Stripe from Charge fields already retrieved.
 * Does not call Stripe. Payment Links without metadata look like one-off
 * Checkout (empty description, no invoice) and are labeled payment_link.
 */
export function classifyStripePaymentChannel(charge: {
  invoiceId?: string | null;
  billingReason?: string | null;
  description?: string | null;
  metadata?: Record<string, string> | null;
}): StripePaymentChannel {
  const reason = (charge.billingReason ?? "").toLowerCase();
  if (reason.startsWith("subscription")) return "subscription";
  const description = (charge.description ?? "").toLowerCase();
  if (description.includes("subscription")) return "subscription";

  const metadata = charge.metadata ?? {};
  for (const [key, value] of Object.entries(metadata)) {
    const haystack = `${key} ${value}`.toLowerCase();
    if (haystack.includes("payment_link") || key.toLowerCase() === "payment_link") {
      return "payment_link";
    }
  }
  if (description.includes("payment link")) return "payment_link";

  if (charge.invoiceId || description.includes("invoice")) return "invoice";
  if (!charge.invoiceId && !description.trim()) return "payment_link";
  if (description.includes("checkout")) return "checkout";
  return charge.invoiceId ? "invoice" : "checkout";
}

function invoiceIdOf(charge: RawStripeCharge): string | null {
  const invoice = charge.invoice;
  if (!invoice) return null;
  if (typeof invoice === "string") return invoice;
  return invoice.id ?? null;
}

function customerIdOf(charge: RawStripeCharge): string | null {
  const invoice = expandedInvoice(charge);
  return idFromRef(charge.customer) ?? idFromRef(invoice?.customer);
}

function customerEmailOf(charge: RawStripeCharge): string | null {
  const invoice = expandedInvoice(charge);
  return (
    textOrNull(invoice?.customer_email) ??
    textOrNull(charge.billing_details?.email) ??
    textOrNull(charge.receipt_email)
  );
}

function customerNameOf(charge: RawStripeCharge): string | null {
  const invoice = expandedInvoice(charge);
  return textOrNull(invoice?.customer_name) ?? textOrNull(charge.billing_details?.name);
}

function subscriptionIdOf(charge: RawStripeCharge): string | null {
  const invoice = expandedInvoice(charge);
  return idFromRef(invoice?.subscription);
}

function billingReasonOf(charge: RawStripeCharge): string | null {
  const invoice = charge.invoice;
  if (!invoice || typeof invoice === "string") return null;
  return invoice.billing_reason ?? null;
}

export function normalizeStripeCharge(charge: RawStripeCharge): NormalizedStripeCharge {
  const currency = (charge.currency ?? "usd").toLowerCase();
  const created = charge.created ?? 0;
  // Prefer amount actually captured when Stripe reports it (partial capture);
  // otherwise fall back to the Charge amount. Never use invoice face value.
  const collectedMinor =
    typeof charge.amount_captured === "number" ? charge.amount_captured : (charge.amount ?? 0);
  const shopify = detectShopifyMarker(charge);
  const paymentIntent = charge.payment_intent;
  const invoiceId = invoiceIdOf(charge);
  const billingReason = billingReasonOf(charge);
  const description = charge.description ?? "";
  return {
    id: charge.id,
    created,
    createdIso: new Date(created * 1000).toISOString(),
    currency,
    livemode: charge.livemode ?? false,
    status: charge.status ?? "unknown",
    paid: charge.paid ?? false,
    amount: stripeMinorToMajor(collectedMinor, currency),
    amountRequested: stripeMinorToMajor(charge.amount ?? 0, currency),
    amountRefunded: stripeMinorToMajor(charge.amount_refunded ?? 0, currency),
    lines: lineRefsOf(charge),
    hasShopifyMarker: shopify.hasShopifyMarker,
    shopifyMarkerReason: shopify.shopifyMarkerReason,
    description,
    invoiceId,
    paymentIntentId:
      typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id ?? null,
    paymentMethodType: charge.payment_method_details?.type ?? null,
    billingReason,
    channel: classifyStripePaymentChannel({
      invoiceId,
      billingReason,
      description,
      metadata: charge.metadata,
    }),
    customerId: customerIdOf(charge),
    customerEmail: customerEmailOf(charge),
    customerName: customerNameOf(charge),
    subscriptionId: subscriptionIdOf(charge),
    refunded: charge.refunded === true,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class StripeAttemptTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`timed out after ${timeoutMs}ms`);
    this.name = "StripeAttemptTimeoutError";
  }
}

function isAttemptTimeout(err: unknown): boolean {
  if (err instanceof StripeAttemptTimeoutError) return true;
  return err instanceof Error && (err.name === "AbortError" || /timed out/i.test(err.message));
}

/**
 * Race the request against a deadline. Node fetch has no default timeout, so
 * one silent socket would hold the sales-report document until the gateway
 * gave up. AbortSignal is not enough: the local TLS fetch ignores it.
 */
async function fetchWithDeadline(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new StripeAttemptTimeoutError(timeoutMs));
    }, timeoutMs);
  });
  const request = fetchImpl(url, { ...init, signal: controller.signal });
  // The loser of the race can still reject after we have moved on.
  void request.catch(() => {});
  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function salesTimingEnabled(): boolean {
  return process.env.NODE_ENV !== "test";
}

export interface FetchStripeChargesOptions {
  /** Inclusive UTC window start. */
  startUtc: Date;
  /** Exclusive UTC window end. */
  endUtc: Date;
  config?: StripeReportingConfig;
  /** Explicit fetch (tests/mocks). When omitted, TLS opt-in is honored. */
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  /**
   * Stripe list expands. Defaults to the invoice only. That invoice includes
   * line price ids and recurring intervals. Do not expand past four levels.
   */
  expand?: string[];
  /** Per-attempt deadline. Tests use a short value. Default is 10s. */
  attemptTimeoutMs?: number;
  /** Base backoff after a timeout or 429/5xx. */
  retryBaseMs?: number;
}

/**
 * Split a Stripe `created` second range into contiguous [gte, lt) windows.
 * The windows share every boundary second with exactly one slice, so a charge
 * created on a boundary stays in the result exactly once.
 */
export function splitStripeCreatedRange(
  createdGte: number,
  createdLt: number,
  chunkSeconds = STRIPE_RANGE_CHUNK_SECONDS,
): Array<{ createdGte: number; createdLt: number }> {
  if (!(createdLt > createdGte) || chunkSeconds <= 0) {
    return [{ createdGte, createdLt }];
  }
  const chunks: Array<{ createdGte: number; createdLt: number }> = [];
  for (let cursor = createdGte; cursor < createdLt; ) {
    const next = Math.min(createdLt, cursor + chunkSeconds);
    chunks.push({ createdGte: cursor, createdLt: next });
    cursor = next;
  }
  return chunks;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Fetch charges created within [startUtc, endUtc), then backfill any paid
 * invoices created in the same window whose Charge was missing from the list.
 * Throws a classified, secret-free error if the Charges endpoint cannot be
 * queried. Invoice backfill is best-effort (missing Invoices permission must
 * not fail the report).
 *
 * Longer ranges are partitioned into 3-day created windows and those windows
 * are listed together. A week of expanded charges is more than one Stripe
 * page, and those pages are what push a month past the gateway limit. The
 * partition is exhaustive: every second in the caller's range is queried,
 * and charge ids are de-duplicated.
 */
export async function fetchStripeChargesInRange(
  options: FetchStripeChargesOptions,
): Promise<NormalizedStripeCharge[]> {
  const configResult = options.config ?? readStripeReportingConfig(options.env);
  if ("error" in configResult) {
    throw new Error(configResult.error);
  }
  const config = configResult;
  const fetchImpl = options.fetchImpl ?? resolveStripeReportingFetch(options.env);
  const attemptTimeoutMs = options.attemptTimeoutMs ?? STRIPE_ATTEMPT_TIMEOUT_MS;
  const retryBaseMs = options.retryBaseMs ?? STRIPE_RETRY_BASE_MS;
  const stats = { retries: 0 };

  const createdGte = Math.floor(options.startUtc.getTime() / 1000);
  // Stripe `created[lt]` is exclusive of the boundary second.
  const createdLt = Math.ceil(options.endUtc.getTime() / 1000);
  const chunks = splitStripeCreatedRange(createdGte, createdLt);
  const listExpands = options.expand?.length ? options.expand : ["data.invoice"];
  const chargeExpands = listExpands.map((item) =>
    item.startsWith("data.") ? item.slice("data.".length) : item,
  );

  const listStarted = performance.now();
  const [chargeGroups, invoiceGroups] = await Promise.all([
    mapWithConcurrency(chunks, STRIPE_RANGE_CONCURRENCY, (chunk) =>
      listChargesInWindow({
        createdGte: chunk.createdGte,
        createdLt: chunk.createdLt,
        config,
        fetchImpl,
        listExpands,
        attemptTimeoutMs,
        retryBaseMs,
        stats,
      }),
    ),
    mapWithConcurrency(chunks, STRIPE_RANGE_CONCURRENCY, (chunk) =>
      listPaidInvoicesInWindow({
        createdGte: chunk.createdGte,
        createdLt: chunk.createdLt,
        config,
        fetchImpl,
        attemptTimeoutMs,
        retryBaseMs,
        stats,
      }),
    ),
  ]);
  const listMs = Math.round(performance.now() - listStarted);

  const charges: NormalizedStripeCharge[] = [];
  const seen = new Set<string>();
  for (const group of chargeGroups) {
    for (const charge of group) {
      if (seen.has(charge.id)) continue;
      seen.add(charge.id);
      charges.push(charge);
    }
  }

  const backfillStarted = performance.now();
  let backfillAdded = 0;
  if (invoiceGroups.every((group) => group.ok)) {
    const before = charges.length;
    await appendMissingInvoiceCharges({
      charges,
      seen,
      createdGte,
      createdLt,
      invoices: invoiceGroups.flatMap((group) => (group.ok ? group.invoices : [])),
      config,
      fetchImpl,
      chargeExpands,
      attemptTimeoutMs,
      retryBaseMs,
      stats,
    });
    backfillAdded = charges.length - before;
  }
  const backfillMs = Math.round(performance.now() - backfillStarted);
  if (salesTimingEnabled()) {
    console.info(
      `[watson-sales] timing phase=stripe list_ms=${listMs} backfill_ms=${backfillMs} chunks=${chunks.length} charges=${charges.length} backfill_added=${backfillAdded} retries=${stats.retries} invoices_ok=${invoiceGroups.every((group) => group.ok) ? 1 : 0}`,
    );
  }

  return charges;
}

interface StripeRequestPolicy {
  attemptTimeoutMs: number;
  retryBaseMs: number;
  stats: { retries: number };
}

async function listChargesInWindow(options: {
  createdGte: number;
  createdLt: number;
  config: StripeReportingConfig;
  fetchImpl: typeof fetch;
  listExpands: string[];
} & StripeRequestPolicy): Promise<NormalizedStripeCharge[]> {
  const charges: NormalizedStripeCharge[] = [];
  const seen = new Set<string>();
  let startingAfter: string | null = null;
  let page = 0;

  while (page < MAX_PAGES) {
    page += 1;
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_LIMIT));
    params.set("created[gte]", String(options.createdGte));
    params.set("created[lt]", String(options.createdLt));
    for (const expand of options.listExpands) params.append("expand[]", expand);
    if (startingAfter) params.set("starting_after", startingAfter);

    const url = `${options.config.apiBase}/charges?${params.toString()}`;
    const response = await fetchStripeWithRetry(
      url,
      options.config.secretKey,
      options.fetchImpl,
      `charges page ${page}`,
      options,
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(describeStripeHttpError(response.status, body));
    }

    const payload = (await response.json()) as RawStripeListResponse;
    const rows = Array.isArray(payload.data) ? payload.data : [];
    for (const raw of rows) {
      if (seen.has(raw.id)) continue;
      seen.add(raw.id);
      charges.push(normalizeStripeCharge(raw));
    }

    if (!payload.has_more || rows.length === 0) break;
    startingAfter = rows[rows.length - 1]?.id ?? null;
    if (!startingAfter) break;
  }

  return charges;
}

interface RawStripeInvoiceListItem {
  id?: string;
  status?: string | null;
  paid?: boolean | null;
  paid_out_of_band?: boolean | null;
  charge?: string | { id?: string | null } | null;
}

/**
 * Paid invoices created in-window should already have a Charge in the same
 * window. If the Charges list missed one, fetch that Charge and append it.
 * Out-of-band payments have no Charge and are not Stripe-collected.
 */
async function listPaidInvoicesInWindow(options: {
  createdGte: number;
  createdLt: number;
  config: StripeReportingConfig;
  fetchImpl: typeof fetch;
} & StripeRequestPolicy): Promise<{ ok: true; invoices: RawStripeInvoiceListItem[] } | { ok: false }> {
  const invoices: RawStripeInvoiceListItem[] = [];
  let startingAfter: string | null = null;
  let page = 0;

  try {
    while (page < MAX_PAGES) {
      page += 1;
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_LIMIT));
      params.set("status", "paid");
      params.set("created[gte]", String(options.createdGte));
      params.set("created[lt]", String(options.createdLt));
      if (startingAfter) params.set("starting_after", startingAfter);

      const url = `${options.config.apiBase}/invoices?${params.toString()}`;
      const response = await fetchStripeWithRetry(
        url,
        options.config.secretKey,
        options.fetchImpl,
        `invoices page ${page}`,
        options,
      );
      if (!response.ok) {
        // Restricted keys without Invoices read should still report Charges.
        return { ok: false };
      }

      const payload = (await response.json()) as {
        data?: RawStripeInvoiceListItem[];
        has_more?: boolean;
      };
      const rows = Array.isArray(payload.data) ? payload.data : [];
      invoices.push(...rows);
      if (!payload.has_more || rows.length === 0) break;
      startingAfter = rows[rows.length - 1]?.id ?? null;
      if (!startingAfter) break;
    }
  } catch {
    // Best-effort: a failed invoice list must not hide Charge totals.
    return { ok: false };
  }

  return { ok: true, invoices };
}

async function appendMissingInvoiceCharges(options: {
  charges: NormalizedStripeCharge[];
  seen: Set<string>;
  createdGte: number;
  createdLt: number;
  invoices: RawStripeInvoiceListItem[];
  config: StripeReportingConfig;
  fetchImpl: typeof fetch;
  chargeExpands: string[];
} & StripeRequestPolicy): Promise<void> {
  const { charges, seen, createdGte, createdLt, invoices, config, fetchImpl, chargeExpands } =
    options;

  try {
    for (const invoice of invoices) {
      if (invoice.paid_out_of_band) continue;
      const chargeId =
        typeof invoice.charge === "string" ? invoice.charge : invoice.charge?.id ?? null;
      if (!chargeId || seen.has(chargeId)) continue;
      const extra = await fetchStripeChargeById(chargeId, config, fetchImpl, chargeExpands, options);
      if (!extra) continue;
      if (extra.created < createdGte || extra.created >= createdLt) continue;
      seen.add(extra.id);
      charges.push(extra);
    }
  } catch {
    // Best-effort: a failed invoice backfill must not hide Charge totals.
  }
}

export async function fetchStripeChargeById(
  chargeId: string,
  config: StripeReportingConfig,
  fetchImpl: typeof fetch,
  expand: string[] = ["invoice"],
  policy?: StripeRequestPolicy,
): Promise<NormalizedStripeCharge | null> {
  const params = new URLSearchParams();
  for (const item of expand) params.append("expand[]", item);
  const url = `${config.apiBase}/charges/${encodeURIComponent(chargeId)}?${params.toString()}`;
  const response = await fetchStripeWithRetry(
    url,
    config.secretKey,
    fetchImpl,
    `charge ${chargeId}`,
    policy,
  );
  if (!response.ok) return null;
  const raw = (await response.json()) as RawStripeCharge;
  if (!raw?.id) return null;
  return normalizeStripeCharge(raw);
}

async function fetchStripeWithRetry(
  url: string,
  secretKey: string,
  fetchImpl: typeof fetch,
  label: string,
  policy?: StripeRequestPolicy,
): Promise<Response> {
  const attemptTimeoutMs = policy?.attemptTimeoutMs ?? STRIPE_ATTEMPT_TIMEOUT_MS;
  const retryBaseMs = policy?.retryBaseMs ?? STRIPE_RETRY_BASE_MS;
  const headers = {
    Authorization: `Bearer ${secretKey}`,
    Accept: "application/json",
    "Stripe-Version": "2024-06-20",
  };
  let extra = 0;
  while (true) {
    let response: Response;
    try {
      response = await fetchWithDeadline(
        fetchImpl,
        url,
        { method: "GET", headers },
        attemptTimeoutMs,
      );
    } catch (err) {
      if (!isAttemptTimeout(err) || extra >= STRIPE_MAX_EXTRA_ATTEMPTS) {
        throw new Error(`${describeStripeConnectionError(err)} (${label})`);
      }
      extra += 1;
      if (policy) policy.stats.retries += 1;
      await sleep(Math.min(retryBaseMs * extra, STRIPE_RETRY_MAX_MS));
      continue;
    }

    if (response.status !== 429 && response.status < 500) {
      return response;
    }

    if (extra >= STRIPE_MAX_EXTRA_ATTEMPTS) {
      return response;
    }
    extra += 1;
    if (policy) policy.stats.retries += 1;
    await sleep(Math.min(retryBaseMs * extra, STRIPE_RETRY_MAX_MS));
  }
}
