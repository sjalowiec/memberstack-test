import shopifyUrlMap from "../../data/legacy/legacy-ebook-shopify-urls.json";
import type { LegacyEbookStorefrontProduct } from "./legacyEbooksActive";

export type LegacyEbookShopifyUrlMap = Record<string, string>;

/** Shopify product page URLs keyed by legacy itemId (slug keys also accepted). */
export function loadLegacyEbookShopifyUrlMap(): LegacyEbookShopifyUrlMap {
  return shopifyUrlMap as LegacyEbookShopifyUrlMap;
}

function normalizeShopifyUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Resolve a storefront Shopify URL from itemId, with optional slug fallback. */
export function resolveLegacyEbookShopifyUrl(
  itemId: string,
  map: LegacyEbookShopifyUrlMap,
  slug?: string
): string | undefined {
  const byItemId = normalizeShopifyUrl(map[itemId]);
  if (byItemId) return byItemId;
  if (slug) return normalizeShopifyUrl(map[slug]);
  return undefined;
}

export function withLegacyEbookShopifyUrls<
  T extends LegacyEbookStorefrontProduct & { slug?: string },
>(products: T[]): (T & { shopifyUrl?: string })[] {
  const map = loadLegacyEbookShopifyUrlMap();
  return products.map((product) => {
    const shopifyUrl = resolveLegacyEbookShopifyUrl(
      product.itemId,
      map,
      product.slug
    );
    return shopifyUrl ? { ...product, shopifyUrl } : product;
  });
}
