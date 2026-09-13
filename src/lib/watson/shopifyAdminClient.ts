import { resolveShopifyAccessToken } from "./shopifyAccessToken";
import {
  getShopifyAdminConfig,
  shopifyAdminBaseUrl,
  type ShopifyAdminConfig,
} from "./shopifyEnv";
import type { ShopifyRestOrder } from "./shopifyOrderMap";

const MAX_RETRIES = 5;
const PAGE_LIMIT = 250;

const ORDER_FIELDS = [
  "id",
  "admin_graphql_api_id",
  "name",
  "order_number",
  "email",
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
].join(",");

export interface FetchShopifyOrdersOptions {
  createdAtMin: string;
  config?: ShopifyAdminConfig;
  fetchImpl?: typeof fetch;
  onPage?: (info: { page: number; orderCount: number }) => void;
}

export interface FetchShopifyOrdersProcessedRangeOptions {
  /** Inclusive ISO timestamp (processed_at_min). */
  processedAtMin: string;
  /** Exclusive ISO timestamp (processed_at_max). */
  processedAtMax: string;
  config?: ShopifyAdminConfig;
  fetchImpl?: typeof fetch;
  onPage?: (info: { page: number; orderCount: number }) => void;
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

async function fetchWithRetry(
  url: string,
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        Accept: "application/json",
      },
    });

    if (response.status !== 429 && response.status < 500) {
      return response;
    }

    attempt += 1;
    if (attempt > MAX_RETRIES) {
      return response;
    }

    const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(1000 * 2 ** attempt, 16_000);
    await sleep(waitMs);
  }
}

async function paginateShopifyOrders(options: {
  config: ShopifyAdminConfig;
  fetchImpl: typeof fetch;
  params: URLSearchParams;
  onPage?: (info: { page: number; orderCount: number }) => void;
}): Promise<ShopifyRestOrder[]> {
  const accessToken = await resolveShopifyAccessToken(options.config, options.fetchImpl);
  let nextUrl: string | null =
    `${shopifyAdminBaseUrl(options.config)}/orders.json?${options.params.toString()}`;
  const orders: ShopifyRestOrder[] = [];
  let page = 0;

  while (nextUrl) {
    page += 1;
    const response = await fetchWithRetry(nextUrl, accessToken, options.fetchImpl);
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
  });
}
