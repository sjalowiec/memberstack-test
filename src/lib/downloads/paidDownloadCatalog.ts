/**
 * Catalog of Stripe-paid downloadable products for My Downloads.
 *
 * Phase 1 includes Charting Rulers only. Match purchases by Stripe IDs
 * (product, price, payment link) or optional Checkout Session metadata
 * `download_slug` — never by title or amount.
 */

export const PAID_DOWNLOAD_ITEM_ID_PREFIX = "printable:";

export const CHARTING_RULERS_SLUG = "charting-rulers";

export type PaidDownloadCatalogEntry = {
  slug: string;
  title: string;
  downloadUrl: string;
  stripeProductId: string;
  stripePriceId: string;
  stripePaymentLinkId: string;
  paymentLinkUrl: string;
};

export const CHARTING_RULERS_PAID_DOWNLOAD: PaidDownloadCatalogEntry = {
  slug: CHARTING_RULERS_SLUG,
  title: "Printable Gauge Rulers",
  downloadUrl: "/downloads/shop/gauge-rulers.pdf",
  stripeProductId: "prod_UAQrHwZdhtys66",
  stripePriceId: "price_1TC5zUCW7QxJHpQOFGijR9sD",
  stripePaymentLinkId: "plink_1TC5zXCW7QxJHpQOsDbz1Wrp",
  paymentLinkUrl: "https://buy.stripe.com/4gMdR87pYeKTfhQ3q20oM0Q",
};

/** Approved paid-download products (Charting Rulers only in this pass). */
export const PAID_DOWNLOAD_CATALOG: readonly PaidDownloadCatalogEntry[] = [
  CHARTING_RULERS_PAID_DOWNLOAD,
];

const BY_SLUG = new Map(PAID_DOWNLOAD_CATALOG.map((entry) => [entry.slug, entry]));
const BY_PAYMENT_LINK_ID = new Map(
  PAID_DOWNLOAD_CATALOG.map((entry) => [entry.stripePaymentLinkId, entry]),
);
const BY_PRICE_ID = new Map(
  PAID_DOWNLOAD_CATALOG.map((entry) => [entry.stripePriceId, entry]),
);
const BY_PRODUCT_ID = new Map(
  PAID_DOWNLOAD_CATALOG.map((entry) => [entry.stripeProductId, entry]),
);

export function paidDownloadItemId(slug: string): string {
  return `${PAID_DOWNLOAD_ITEM_ID_PREFIX}${slug}`;
}

export function getPaidDownloadBySlug(
  slug: string | null | undefined,
): PaidDownloadCatalogEntry | null {
  const key = typeof slug === "string" ? slug.trim() : "";
  if (!key) return null;
  return BY_SLUG.get(key) ?? null;
}

export function getPaidDownloadByStripePaymentLinkId(
  paymentLinkId: string | null | undefined,
): PaidDownloadCatalogEntry | null {
  const key = typeof paymentLinkId === "string" ? paymentLinkId.trim() : "";
  if (!key) return null;
  return BY_PAYMENT_LINK_ID.get(key) ?? null;
}

export function getPaidDownloadByStripePriceId(
  priceId: string | null | undefined,
): PaidDownloadCatalogEntry | null {
  const key = typeof priceId === "string" ? priceId.trim() : "";
  if (!key) return null;
  return BY_PRICE_ID.get(key) ?? null;
}

export function getPaidDownloadByStripeProductId(
  productId: string | null | undefined,
): PaidDownloadCatalogEntry | null {
  const key = typeof productId === "string" ? productId.trim() : "";
  if (!key) return null;
  return BY_PRODUCT_ID.get(key) ?? null;
}

/** Customer-facing My Downloads row from a catalog entry. */
export function toPaidDownloadCustomerEntitlement(entry: PaidDownloadCatalogEntry): {
  itemId: string;
  title: string;
  downloadUrl: string;
} {
  return {
    itemId: paidDownloadItemId(entry.slug),
    title: entry.title,
    downloadUrl: entry.downloadUrl,
  };
}
