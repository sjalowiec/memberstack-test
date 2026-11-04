import { resolveShopifyAccessToken } from "./shopifyAccessToken";
import {
  getShopifyAdminConfig,
  shopifyAdminBaseUrl,
  type ShopifyAdminConfig,
} from "./shopifyEnv";
import type { ShopifyRestOrder } from "./shopifyOrderMap";

const MAX_RETRIES = 5;
const PAGE_LIMIT = 250;

/**
 * Sales-report requests share the HTML document. A 16s Shopify backoff, or a
 * socket with no deadline, is what leaves that document silent long enough
 * for the gateway inactivity timeout. Background sync keeps the longer default.
 */
export const SALES_REPORT_SHOPIFY_FETCH_POLICY: ShopifyFetchPolicy = {
  maxExtraAttempts: 1,
  maxWaitMs: 1_000,
  attemptTimeoutMs: 10_000,
};

export interface ShopifyFetchPolicy {
  /** Extra tries after the first attempt. Default 5 for background sync. */
  maxExtraAttempts?: number;
  /** Cap on the exponential backoff between tries. */
  maxWaitMs?: number;
  /** Per-attempt deadline. Unset means no deadline (background sync). */
  attemptTimeoutMs?: number;
}

const ORDER_FIELDS = [
  "id",
  "admin_graphql_api_id",
  "name",
  "order_number",
  "email",
  "contact_email",
  "created_at",
  "processed_at",
  "cancelled_at",
  "cancel_reason",
  "currency",
  "financial_status",
  "fulfillment_status",
  "tags",
  "subtotal_price",
  "total_discounts",
  "total_tax",
  "total_shipping_price_set",
  "total_price",
  "total_refunded",
  "customer",
  "billing_address",
  "line_items",
  "fulfillments",
].join(",");

export interface FetchShopifyOrdersOptions {
  createdAtMin: string;
  config?: ShopifyAdminConfig;
  fetchImpl?: typeof fetch;
  onPage?: (info: { page: number; orderCount: number }) => void;
  fetchPolicy?: ShopifyFetchPolicy;
}

export interface FetchShopifyOrdersProcessedRangeOptions {
  /** Inclusive ISO timestamp (processed_at_min). */
  processedAtMin: string;
  /** Exclusive ISO timestamp (processed_at_max). */
  processedAtMax: string;
  config?: ShopifyAdminConfig;
  fetchImpl?: typeof fetch;
  onPage?: (info: { page: number; orderCount: number }) => void;
  fetchPolicy?: ShopifyFetchPolicy;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(",");
  for (const part of parts) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="next"/i);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

function isShopifyAttemptTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || err.name === "ShopifyAttemptTimeoutError" || /timed out/i.test(err.message));
}

async function fetchShopifyWithDeadline(
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
      const error = new Error(`timed out after ${timeoutMs}ms`);
      error.name = "ShopifyAttemptTimeoutError";
      reject(error);
    }, timeoutMs);
  });
  const request = fetchImpl(url, { ...init, signal: controller.signal });
  void request.catch(() => {});
  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchWithRetry(
  url: string,
  accessToken: string,
  fetchImpl: typeof fetch,
  policy?: ShopifyFetchPolicy,
): Promise<Response> {
  const maxExtraAttempts = policy?.maxExtraAttempts ?? MAX_RETRIES;
  const maxWaitMs = policy?.maxWaitMs ?? 16_000;
  const attemptTimeoutMs = policy?.attemptTimeoutMs ?? 0;
  const headers = {
    "X-Shopify-Access-Token": accessToken,
    Accept: "application/json",
  };
  let extra = 0;
  while (true) {
    let response: Response;
    try {
      response = attemptTimeoutMs > 0
        ? await fetchShopifyWithDeadline(
            fetchImpl,
            url,
            { method: "GET", headers },
            attemptTimeoutMs,
          )
        : await fetchImpl(url, { method: "GET", headers });
    } catch (error) {
      if (attemptTimeoutMs <= 0 || !isShopifyAttemptTimeout(error) || extra >= maxExtraAttempts) {
        throw error;
      }
      extra += 1;
      await sleep(Math.min(500 * extra, maxWaitMs));
      continue;
    }

    if (response.status !== 429 && response.status < 500) {
      return response;
    }

    if (extra >= maxExtraAttempts) {
      return response;
    }
    extra += 1;
    const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, maxWaitMs)
      : Math.min(1000 * 2 ** extra, maxWaitMs);
    await sleep(waitMs);
  }
}

async function paginateShopifyOrders(options: {
  config: ShopifyAdminConfig;
  fetchImpl: typeof fetch;
  params: URLSearchParams;
  onPage?: (info: { page: number; orderCount: number }) => void;
  fetchPolicy?: ShopifyFetchPolicy;
}): Promise<ShopifyRestOrder[]> {
  const tokenTimeoutMs = options.fetchPolicy?.attemptTimeoutMs ?? 0;
  const tokenFetch: typeof fetch = tokenTimeoutMs > 0
    ? (input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        return fetchShopifyWithDeadline(options.fetchImpl, url, init ?? {}, tokenTimeoutMs);
      }
    : options.fetchImpl;
  const accessToken = await resolveShopifyAccessToken(options.config, tokenFetch);
  let nextUrl: string | null =
    `${shopifyAdminBaseUrl(options.config)}/orders.json?${options.params.toString()}`;
  const orders: ShopifyRestOrder[] = [];
  let page = 0;

  while (nextUrl) {
    page += 1;
    const response = await fetchWithRetry(nextUrl, accessToken, options.fetchImpl, options.fetchPolicy);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const snippet = body.slice(0, 300);
      throw new Error(
        `Shopify Admin API error ${response.status} on orders page ${page}` +
          (snippet ? `: ${snippet}` : "."),
      );
    }

    const payload = (await response.json()) as { orders?: ShopifyRestOrder[] };
    const pageOrders = Array.isArray(payload.orders) ? payload.orders : [];
    orders.push(...pageOrders);
    options.onPage?.({ page, orderCount: pageOrders.length });
    nextUrl = parseNextPageUrl(response.headers.get("Link"));
  }

  return orders;
}

function shopifyListParams(extra: Record<string, string>): URLSearchParams {
  return new URLSearchParams({
    status: "any",
    limit: String(PAGE_LIMIT),
    fields: ORDER_FIELDS,
    order: "processed_at asc",
    ...extra,
  });
}

/**
 * Fetch orders created on/after createdAtMin (ISO), including cancelled/refunded.
 * Paginates via Shopify Link headers. Does not request shipping address fields.
 * Fulfillments are requested so tracking links can be stored; destination
 * addresses on those objects are discarded by the mapper.
 */
export async function fetchShopifyOrdersSince(
  options: FetchShopifyOrdersOptions,
): Promise<ShopifyRestOrder[]> {
  const configResult = options.config ?? getShopifyAdminConfig();
  if ("error" in configResult) {
    throw new Error(configResult.error);
  }
  return paginateShopifyOrders({
    config: configResult,
    fetchImpl: options.fetchImpl ?? fetch,
    params: shopifyListParams({
      created_at_min: options.createdAtMin,
      order: "created_at asc",
    }),
    onPage: options.onPage,
    fetchPolicy: options.fetchPolicy,
  });
}

/**
 * Fetch orders whose processed_at falls in [processedAtMin, processedAtMax).
 * Includes cancelled/refunded/unpaid so the sales report can explain exclusions.
 */
export async function fetchShopifyOrdersProcessedInRange(
  options: FetchShopifyOrdersProcessedRangeOptions,
): Promise<ShopifyRestOrder[]> {
  const configResult = options.config ?? getShopifyAdminConfig();
  if ("error" in configResult) {
    throw new Error(configResult.error);
  }
  return paginateShopifyOrders({
    config: configResult,
    fetchImpl: options.fetchImpl ?? fetch,
    params: shopifyListParams({
      processed_at_min: options.processedAtMin,
      processed_at_max: options.processedAtMax,
    }),
    onPage: options.onPage,
    fetchPolicy: options.fetchPolicy,
  });
}
