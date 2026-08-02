/**
 * Minimal, read-only Stripe reporting client for the Watson Sales Report.
 *
 * Uses the Stripe REST API over `fetch` (no `stripe` SDK dependency, matching
 * the existing Shopify Admin client pattern). Retrieves succeeded charges for a
 * UTC instant window, with invoice lines expanded so the caller can classify
 * membership payments and account for (partial) refunds. The secret key is read
 * server-side only and is NEVER sent to the browser or written to logs.
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
const MAX_PAGES = 1000; // hard safety cap (~100k charges)
const MAX_RETRIES = 4;

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
        "STRIPE_SECRET_KEY is not set. Add a restricted (read-only) Stripe key to report membership revenue.",
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
  /** Amount refunded so far, in major currency units. Handles partial refunds. */
  amountRefunded: number;
  lines: StripeChargeLineRef[];
  /** True when the charge looks Shopify-originated (dedup safety signal). */
  hasShopifyMarker: boolean;
}

interface RawStripePrice {
  id?: string | null;
  product?: string | { id?: string | null } | null;
}

interface RawStripeInvoiceLine {
  price?: RawStripePrice | null;
  plan?: { id?: string | null; product?: string | null } | null;
}

interface RawStripeCharge {
  id: string;
  amount?: number | null;
  amount_refunded?: number | null;
  currency?: string | null;
  created?: number | null;
  livemode?: boolean | null;
  paid?: boolean | null;
  status?: string | null;
  description?: string | null;
  metadata?: Record<string, string> | null;
  invoice?:
    | string
    | null
    | {
        id?: string;
        lines?: { data?: RawStripeInvoiceLine[] | null } | null;
      };
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

function lineRefsOf(charge: RawStripeCharge): StripeChargeLineRef[] {
  const invoice = charge.invoice;
  if (!invoice || typeof invoice === "string") return [];
  const lines = invoice.lines?.data ?? [];
  return lines.map((line) => {
    const price = line.price ?? null;
    const planProduct = line.plan?.product ?? null;
    return {
      priceId: price?.id ?? line.plan?.id ?? null,
      productId: productIdOf(price) ?? planProduct,
    };
  });
}

function detectShopifyMarker(charge: RawStripeCharge): boolean {
  const description = (charge.description ?? "").toLowerCase();
  if (description.includes("shopify")) return true;
  const metadata = charge.metadata ?? {};
  for (const [key, value] of Object.entries(metadata)) {
    const haystack = `${key} ${value}`.toLowerCase();
    if (haystack.includes("shopify") || haystack.includes("order_id")) return true;
  }
  return false;
}

export function normalizeStripeCharge(charge: RawStripeCharge): NormalizedStripeCharge {
  const currency = (charge.currency ?? "usd").toLowerCase();
  const created = charge.created ?? 0;
  return {
    id: charge.id,
    created,
    createdIso: new Date(created * 1000).toISOString(),
    currency,
    livemode: charge.livemode ?? false,
    status: charge.status ?? "unknown",
    paid: charge.paid ?? false,
    amount: stripeMinorToMajor(charge.amount ?? 0, currency),
    amountRefunded: stripeMinorToMajor(charge.amount_refunded ?? 0, currency),
    lines: lineRefsOf(charge),
    hasShopifyMarker: detectShopifyMarker(charge),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
}

/**
 * Fetch all succeeded charges created within [startUtc, endUtc), following
 * Stripe cursor pagination. Throws a classified, secret-free error if Stripe
 * cannot be queried.
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

  const createdGte = Math.floor(options.startUtc.getTime() / 1000);
  // Stripe `created[lt]` is exclusive of the boundary second.
  const createdLt = Math.ceil(options.endUtc.getTime() / 1000);

  const charges: NormalizedStripeCharge[] = [];
  const seen = new Set<string>();
  let startingAfter: string | null = null;
  let page = 0;

  while (page < MAX_PAGES) {
    page += 1;
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_LIMIT));
    params.set("created[gte]", String(createdGte));
    params.set("created[lt]", String(createdLt));
    params.append("expand[]", "data.invoice");
    if (startingAfter) params.set("starting_after", startingAfter);

    const url = `${config.apiBase}/charges?${params.toString()}`;
    const response = await fetchStripeWithRetry(url, config.secretKey, fetchImpl, page);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(describeStripeHttpError(response.status, body));
    }

    const payload = (await response.json()) as RawStripeListResponse;
    const rows = Array.isArray(payload.data) ? payload.data : [];
    for (const raw of rows) {
      // Guard against duplicate ids across pages.
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

async function fetchStripeWithRetry(
  url: string,
  secretKey: string,
  fetchImpl: typeof fetch,
  page: number,
): Promise<Response> {
  let attempt = 0;
  while (true) {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          Accept: "application/json",
          "Stripe-Version": "2024-06-20",
        },
      });
    } catch (err) {
      // Connection/TLS/DNS errors surface as a TypeError("fetch failed") with a
      // nested cause. Classify into a safe, useful message.
      throw new Error(`${describeStripeConnectionError(err)} (charges page ${page})`);
    }

    if (response.status !== 429 && response.status < 500) {
      return response;
    }

    attempt += 1;
    if (attempt > MAX_RETRIES) {
      return response;
    }
    await sleep(Math.min(500 * 2 ** attempt, 8000));
  }
}
