// Member Free badge hidden until Memberstack entitlement flow is implemented.
export const SHOW_LEGACY_EBOOK_MEMBER_FREE_BADGE = false;

// Temporarily disable sales for specific eBooks (keyed by legacy itemId, matching
// legacy-ebook-shopify-urls.json). Products listed here render as
// "Temporarily unavailable" with no purchase link/button, but their data is left
// intact. To re-enable a product, remove its itemId from this set.
export const TEMPORARILY_UNAVAILABLE_EBOOK_ITEM_IDS = new Set<string>([
  // "A Guide to Knitting with Yarn on Cones" — Shopify product receiving
  // high-risk orders; disabled temporarily on request.
  "589",
]);

/** True when an eBook's sales are temporarily disabled. */
export function isLegacyEbookTemporarilyUnavailable(itemId: string): boolean {
  return TEMPORARILY_UNAVAILABLE_EBOOK_ITEM_IDS.has(itemId.trim());
}

/** Label shown in place of a purchase button for disabled eBooks. */
export const LEGACY_EBOOK_UNAVAILABLE_LABEL = "Temporarily unavailable";

/** Legacy store cover image path. */
export function legacyStoreThumbnailPath(filename: string): string {
  if (
    filename.startsWith("/") ||
    filename.startsWith("http://") ||
    filename.startsWith("https://")
  ) {
    return filename;
  }
  return `/store/thumbnails/${filename}`;
}

export function formatLegacyEbookPrice(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
