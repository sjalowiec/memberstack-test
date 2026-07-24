import {
  shopifyClientCredentialsTokenUrl,
  type ShopifyAdminConfig,
} from "./shopifyEnv";

/** Refresh slightly before Shopify's expires_in window (tokens last ~24h). */
export const SHOPIFY_TOKEN_EXPIRY_SKEW_MS = 60_000;

interface CachedToken {
  cacheKey: string;
  accessToken: string;
  expiresAtMs: number;
}

let cachedToken: CachedToken | null = null;
let inflightRefresh: { cacheKey: string; promise: Promise<string> } | null = null;

export function resetShopifyAccessTokenCache(): void {
  cachedToken = null;
  inflightRefresh = null;
}

function cacheKeyFor(config: ShopifyAdminConfig): string {
  if (config.auth.mode === "static") {
    return `static:${config.storeDomain}`;
  }
  return `cc:${config.storeDomain}:${config.auth.clientId}`;
}

function isUsable(cached: CachedToken, nowMs: number): boolean {
  return nowMs < cached.expiresAtMs - SHOPIFY_TOKEN_EXPIRY_SKEW_MS;
}

async function requestClientCredentialsToken(
  config: ShopifyAdminConfig,
  fetchImpl: typeof fetch,
): Promise<string> {
  if (config.auth.mode !== "client_credentials") {
    throw new Error("requestClientCredentialsToken called without client credentials auth.");
  }

  const response = await fetchImpl(shopifyClientCredentialsTokenUrl(config.storeDomain), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.auth.clientId,
      client_secret: config.auth.clientSecret,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const snippet = body.slice(0, 300);
    throw new Error(
      `Shopify client credentials token request failed (${response.status})` +
        (snippet ? `: ${snippet}` : "."),
    );
  }

  const payload = (await response.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
  };
  const accessToken =
    typeof payload.access_token === "string" ? payload.access_token.trim() : "";
  const expiresInSec =
    typeof payload.expires_in === "number" && Number.isFinite(payload.expires_in)
      ? payload.expires_in
      : Number.parseInt(String(payload.expires_in ?? ""), 10);

  if (!accessToken) {
    throw new Error("Shopify client credentials response did not include access_token.");
  }
  if (!Number.isFinite(expiresInSec) || expiresInSec <= 0) {
    throw new Error("Shopify client credentials response did not include a valid expires_in.");
  }

  cachedToken = {
    cacheKey: cacheKeyFor(config),
    accessToken,
    expiresAtMs: Date.now() + expiresInSec * 1000,
  };
  return accessToken;
}

/**
 * Resolve an Admin API access token for X-Shopify-Access-Token.
 * Static tokens are returned as-is. Client credentials tokens are cached
 * and refreshed shortly before expiry.
 */
export async function resolveShopifyAccessToken(
  config: ShopifyAdminConfig,
  fetchImpl: typeof fetch = fetch,
  nowMs: number = Date.now(),
): Promise<string> {
  if (config.auth.mode === "static") {
    return config.auth.accessToken;
  }

  const key = cacheKeyFor(config);
  if (cachedToken && cachedToken.cacheKey === key && isUsable(cachedToken, nowMs)) {
    return cachedToken.accessToken;
  }

  if (inflightRefresh?.cacheKey === key) {
    return inflightRefresh.promise;
  }

  const promise = requestClientCredentialsToken(config, fetchImpl).finally(() => {
    if (inflightRefresh?.promise === promise) {
      inflightRefresh = null;
    }
  });
  inflightRefresh = { cacheKey: key, promise };
  return promise;
}
