import { loadEnvFile } from "./env";

export const DEFAULT_SHOPIFY_API_VERSION = "2025-01";
export const DEFAULT_SHOPIFY_LOOKBACK_DAYS = 90;

/** Legacy custom-app static token, or Dev Dashboard client credentials. */
export type ShopifyAdminAuth =
  | { mode: "static"; accessToken: string }
  | { mode: "client_credentials"; clientId: string; clientSecret: string };

export interface ShopifyAdminConfig {
  storeDomain: string;
  apiVersion: string;
  auth: ShopifyAdminAuth;
}

function normalizeStoreDomain(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  return withoutProtocol.replace(/\/+$/, "").split("/")[0] ?? "";
}

export function getShopifyAdminConfig(
  env: NodeJS.ProcessEnv = process.env,
): ShopifyAdminConfig | { error: string } {
  loadEnvFile();
  const storeDomain = normalizeStoreDomain(env.SHOPIFY_STORE_DOMAIN ?? "");
  const accessToken = (env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? "").trim();
  const clientId = (env.SHOPIFY_CLIENT_ID ?? "").trim();
  const clientSecret = (env.SHOPIFY_CLIENT_SECRET ?? "").trim();
  const apiVersion = (env.SHOPIFY_API_VERSION ?? DEFAULT_SHOPIFY_API_VERSION).trim() ||
    DEFAULT_SHOPIFY_API_VERSION;

  if (!storeDomain) {
    return {
      error:
        "SHOPIFY_STORE_DOMAIN is not set. Example: vjzu11-86.myshopify.com",
    };
  }
  if (!storeDomain.includes(".")) {
    return {
      error: "SHOPIFY_STORE_DOMAIN must be a full hostname (e.g. your-store.myshopify.com).",
    };
  }

  let auth: ShopifyAdminAuth;
  if (accessToken) {
    // Prefer legacy static Admin API token when present.
    auth = { mode: "static", accessToken };
  } else if (clientId && clientSecret) {
    auth = { mode: "client_credentials", clientId, clientSecret };
  } else if (clientId || clientSecret) {
    return {
      error:
        "Both SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET are required for Dev Dashboard client credentials auth.",
    };
  } else {
    return {
      error:
        "Shopify auth is not configured. Set SHOPIFY_ADMIN_ACCESS_TOKEN (legacy custom app), or both SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET (Dev Dashboard app with read_orders).",
    };
  }

  return { storeDomain, apiVersion, auth };
}

export function shopifyAdminBaseUrl(config: ShopifyAdminConfig): string {
  return `https://${config.storeDomain}/admin/api/${config.apiVersion}`;
}

export function shopifyClientCredentialsTokenUrl(storeDomain: string): string {
  return `https://${storeDomain}/admin/oauth/access_token`;
}
