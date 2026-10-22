/**
 * Record a published shop product view, and a Shopify click when checkout is on.
 * Uses the same gtag context as Help Hub: production custom domains only, and
 * only when PUBLIC_GA4_ID is set. The marker must wrap the Buy Now control so
 * the click reaches this listener.
 */
import {
  reportShopProductEvent,
  SHOP_PRODUCT_VIEW_EVENT,
  SHOP_SHOPIFY_CLICK_EVENT,
  type ShopProductGaContext,
} from "../lib/analytics/shopProductGa";

function identityFrom(root: HTMLElement) {
  return {
    slug: root.dataset.shopProductSlug ?? "",
    shopifyProductId: root.dataset.shopifyProductId ?? "",
    published: root.dataset.shopPublished === "true",
    checkoutEnabled: root.dataset.shopCheckout === "true",
  };
}

function browserContext(): ShopProductGaContext {
  const win =
    typeof window === "undefined"
      ? undefined
      : (window as Window & { gtag?: ShopProductGaContext["gtag"] });
  return {
    gtag: typeof win?.gtag === "function" ? win.gtag : undefined,
    hostname: win ? win.location.hostname : "",
    isViteDev: import.meta.env.DEV === true,
    publicSiteEnv: import.meta.env.PUBLIC_SITE_ENV,
    measurementIdConfigured: Boolean(import.meta.env.PUBLIC_GA4_ID),
  };
}

export function bootShopProductAnalytics(root: ParentNode = document): void {
  const node = root.querySelector<HTMLElement>("[data-shop-product-analytics]");
  if (!node || node.dataset.shopAnalyticsReady === "true") return;
  node.dataset.shopAnalyticsReady = "true";

  const product = identityFrom(node);
  reportShopProductEvent(SHOP_PRODUCT_VIEW_EVENT, product, browserContext());

  node.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest("[data-shop-shopify-click]")) return;
    reportShopProductEvent(SHOP_SHOPIFY_CLICK_EVENT, identityFrom(node), browserContext());
  });
}
