/**
 * Product view and Shopify purchase-click events for the site GA4 tag.
 *
 * Uses the gtag function BaseLayout loads when PUBLIC_GA4_ID is set.
 * Production custom domains only, matching Help Hub analytics. Local review,
 * the dev server, and *.netlify.app do not send these events.
 * Parameters identify the product. They do not include a customer email,
 * name, or other personal information.
 */

import { detectSiteEnvironment } from "../env/siteEnvironment";

export const SHOP_PRODUCT_VIEW_EVENT = "shop_product_view";
export const SHOP_SHOPIFY_CLICK_EVENT = "shop_shopify_click";
export const SHOP_PRODUCT_SLUG_PARAM = "shop_product_slug";
export const SHOPIFY_PRODUCT_ID_PARAM = "shopify_product_id";

export const SHOP_PRODUCT_GA_EVENTS = [
  SHOP_PRODUCT_VIEW_EVENT,
  SHOP_SHOPIFY_CLICK_EVENT,
] as const;

export type ShopProductGaEventName = (typeof SHOP_PRODUCT_GA_EVENTS)[number];

const DEDUPE_MS = 400;

type GtagEvent = (
  command: "event",
  name: string,
  params: Record<string, string>,
) => void;

export type ShopProductGaContext = {
  now?: number;
  gtag?: GtagEvent;
  hostname?: string | null;
  isViteDev?: boolean;
  publicSiteEnv?: string | null;
  measurementIdConfigured?: boolean;
};

export type ShopProductAnalyticsIdentity = {
  slug: string;
  shopifyProductId: string;
  published: boolean;
  checkoutEnabled: boolean;
};

const recentSends = new Map<string, number>();

export function resetShopProductGaForTests(): void {
  recentSends.clear();
}

export function shouldReportShopProductToProductionGa(input: {
  hostname?: string | null;
  isViteDev?: boolean;
  publicSiteEnv?: string | null;
}): boolean {
  return (
    detectSiteEnvironment(input.hostname, {
      isViteDev: input.isViteDev,
      publicSiteEnv: input.publicSiteEnv,
    }) === "production"
  );
}

function cleanSlug(value: string): string | null {
  const slug = value.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return null;
  return slug;
}

function cleanProductId(value: string): string | null {
  const id = value.trim();
  if (!/^[0-9]+$/.test(id) || id.length > 32) return null;
  return id;
}

/**
 * Sends one product event. Returns false when the event is skipped.
 * Views wait until the page is published. Purchase clicks also wait until
 * checkout is enabled, so a draft review cannot record a Shopify click.
 */
export function reportShopProductEvent(
  name: ShopProductGaEventName,
  product: ShopProductAnalyticsIdentity,
  context: ShopProductGaContext = {},
): boolean {
  if (
    !shouldReportShopProductToProductionGa({
      hostname: context.hostname,
      isViteDev: context.isViteDev,
      publicSiteEnv: context.publicSiteEnv,
    })
  ) {
    return false;
  }
  if (!context.measurementIdConfigured || typeof context.gtag !== "function") return false;
  if (!product.published) return false;
  if (name === SHOP_SHOPIFY_CLICK_EVENT && !product.checkoutEnabled) return false;

  const slug = cleanSlug(product.slug);
  const shopifyProductId = cleanProductId(product.shopifyProductId);
  if (!slug || !shopifyProductId) return false;

  const now = context.now ?? Date.now();
  const key = `${name}\0${slug}`;
  const previous = recentSends.get(key);
  if (previous != null && now >= previous && now - previous < DEDUPE_MS) return false;

  try {
    context.gtag("event", name, {
      [SHOP_PRODUCT_SLUG_PARAM]: slug,
      [SHOPIFY_PRODUCT_ID_PARAM]: shopifyProductId,
      transport_type: "beacon",
    });
  } catch {
    return false;
  }

  recentSends.set(key, now);
  return true;
}
