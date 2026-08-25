/**
 * Catalog of Stripe-paid downloadable products for My Downloads.
 *
 * Match purchases by Stripe IDs (product, price, payment link) or optional
 * Checkout Session metadata `download_slug` — never by title or amount.
 * Slug, title, and file path come from `src/data/printables.ts`.
 */

import { printables } from "../../data/printables";

export const PAID_DOWNLOAD_ITEM_ID_PREFIX = "printable:";

export const CHARTING_RULERS_SLUG = "charting-rulers";
export const TECHNIQUE_CARDS_SLUG = "machine-technique-reference-cards";
export const CUT_N_SEW_SLUG = "cut-n-sew-neckline-templates";
export const NEEDLE_SELECTION_SLUG = "needle-selection-worksheet";

export type PaidDownloadCatalogEntry = {
  slug: string;
  title: string;
  downloadUrl: string;
  stripeProductId: string;
  stripePriceId: string;
  stripePaymentLinkId: string;
  paymentLinkUrl: string;
};

type PrintableProduct = (typeof printables)[number];

function requirePrintable(slug: string): PrintableProduct {
  const item = printables.find((row) => row.slug === slug);
  if (!item?.slug || !item.title || !item.file) {
    throw new Error(`Missing printable product data for ${slug}`);
  }
  return item;
}

function entryFromPrintable(
  slug: string,
  ids: Pick<
    PaidDownloadCatalogEntry,
    "stripeProductId" | "stripePriceId" | "stripePaymentLinkId" | "paymentLinkUrl"
  >,
): PaidDownloadCatalogEntry {
  const product = requirePrintable(slug);
  return {
    slug: product.slug,
    title: product.title,
    downloadUrl: product.file,
    ...ids,
  };
}

export const CHARTING_RULERS_PAID_DOWNLOAD: PaidDownloadCatalogEntry = entryFromPrintable(
  CHARTING_RULERS_SLUG,
  {
    stripeProductId: "prod_UAQrHwZdhtys66",
    stripePriceId: "price_1TC5zUCW7QxJHpQOFGijR9sD",
    stripePaymentLinkId: "plink_1TC5zXCW7QxJHpQOsDbz1Wrp",
    paymentLinkUrl: "https://buy.stripe.com/4gMdR87pYeKTfhQ3q20oM0Q",
  },
);

export const TECHNIQUE_CARDS_PAID_DOWNLOAD: PaidDownloadCatalogEntry = entryFromPrintable(
  TECHNIQUE_CARDS_SLUG,
  {
    stripeProductId: "prod_UAQnqHWiVtwBrS",
    stripePriceId: "price_1TC5vzCW7QxJHpQOrJc2FPBq",
    stripePaymentLinkId: "plink_1TC5wtCW7QxJHpQOVzwUoLmJ",
    paymentLinkUrl: "https://buy.stripe.com/00wfZg39I8mv0mW2lY0oM0O",
  },
);

export const CUT_N_SEW_PAID_DOWNLOAD: PaidDownloadCatalogEntry = entryFromPrintable(
  CUT_N_SEW_SLUG,
  {
    stripeProductId: "prod_UAQsmPjVdexe1A",
    stripePriceId: "price_1TC60QCW7QxJHpQOAmXYScwW",
    stripePaymentLinkId: "plink_1TC60UCW7QxJHpQOmWjoTrXR",
    paymentLinkUrl: "https://buy.stripe.com/00w4gybGeeKTglU6Ce0oM0R",
  },
);

export const NEEDLE_SELECTION_PAID_DOWNLOAD: PaidDownloadCatalogEntry = entryFromPrintable(
  NEEDLE_SELECTION_SLUG,
  {
    stripeProductId: "prod_UAQpSb0FUXJVIs",
    stripePriceId: "price_1TC5yECW7QxJHpQOzzdFqz6s",
    stripePaymentLinkId: "plink_1TC5yLCW7QxJHpQO0wRoHhqY",
    paymentLinkUrl: "https://buy.stripe.com/bJe6oG5hQ0U37Po4u60oM0P",
  },
);

/** Approved paid-download products recognized by the Stripe webhook. */
export const PAID_DOWNLOAD_CATALOG: readonly PaidDownloadCatalogEntry[] = [
  CHARTING_RULERS_PAID_DOWNLOAD,
  TECHNIQUE_CARDS_PAID_DOWNLOAD,
  CUT_N_SEW_PAID_DOWNLOAD,
  NEEDLE_SELECTION_PAID_DOWNLOAD,
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
