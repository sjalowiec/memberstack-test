import {
  getShopifyAdminConfig,
  shopifyAdminBaseUrl,
  type ShopifyAdminConfig,
} from "./shopifyEnv";
import type { ShopifyRestOrder } from "./shopifyOrderMap";

const MAX_RETRIES = 5;
const PAGE_LIMIT = 250;

export interface FetchShopifyOrdersOptions {
  createdAtMin: string;
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
  const config = configResult;
  const fetchImpl = options.fetchImpl ?? fetch;

  const fields = [
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

  const params = new URLSearchParams({
    status: "any",
    limit: String(PAGE_LIMIT),
    created_at_min: options.createdAtMin,
    fields,
    order: "created_at asc",
  });

  let nextUrl: string | null =
    `${shopifyAdminBaseUrl(config)}/orders.json?${params.toString()}`;
  const orders: ShopifyRestOrder[] = [];
  let page = 0;

  while (nextUrl) {
    page += 1;
    const response = await fetchWithRetry(nextUrl, config.accessToken, fetchImpl);
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
