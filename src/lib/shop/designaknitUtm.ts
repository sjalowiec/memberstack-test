/**
 * Centralized UTM tracking for DesignaKnit Shopify "Buy Now" links.
 *
 * Mirrors the Learn DAK attribution approach so software sales originating
 * from Knit It Now are tracked consistently across both sites. Campaign
 * naming lives here so it can be changed in one place.
 */

export const UTM_PARAMS = {
  utm_source: "knititnow",
  utm_medium: "referral",
  utm_campaign: "designaknit-shop",
} as const;

/**
 * Append DesignaKnit UTM parameters to a Shopify product URL.
 *
 * - Preserves the existing URL and any existing query parameters.
 * - Does not duplicate UTM parameters that are already present.
 * - Adds a product-specific `utm_content` value (the product id).
 *
 * @param href Base Shopify "Buy Now" URL.
 * @param productId Product identifier used for `utm_content`.
 * @returns The URL with UTM parameters applied.
 */
export function withDesignaknitUtm(href: string, productId: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    // If the href isn't a parseable absolute URL, return it untouched.
    return href;
  }

  const params: Record<string, string> = {
    ...UTM_PARAMS,
    utm_content: productId,
  };

  for (const [key, value] of Object.entries(params)) {
    if (!url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}
