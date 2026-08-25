/**
 * Identify a paid-download catalog product from a Stripe Checkout Session.
 *
 * Matching uses Stripe IDs (payment link, price, product) and optional
 * metadata `download_slug`. Title and amount are never used.
 */

import {
  getPaidDownloadBySlug,
  getPaidDownloadByStripePaymentLinkId,
  getPaidDownloadByStripePriceId,
  getPaidDownloadByStripeProductId,
  type PaidDownloadCatalogEntry,
} from "./paidDownloadCatalog";

export const PAID_DOWNLOAD_METADATA_SLUG_KEY = "download_slug";

export type StripeCheckoutSessionLike = {
  id?: unknown;
  object?: unknown;
  payment_status?: unknown;
  customer_email?: unknown;
  customer_details?: unknown;
  payment_link?: unknown;
  payment_intent?: unknown;
  metadata?: unknown;
  line_items?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  const record = asRecord(value);
  if (typeof record?.id === "string" && record.id.trim()) return record.id.trim();
  return null;
}

export function stripeCheckoutSessionId(
  session: StripeCheckoutSessionLike | null | undefined,
): string | null {
  return stringId(session?.id);
}

export function stripePaymentIntentId(
  session: StripeCheckoutSessionLike | null | undefined,
): string | null {
  return stringId(session?.payment_intent);
}

export function stripePaymentLinkIdFromSession(
  session: StripeCheckoutSessionLike | null | undefined,
): string | null {
  return stringId(session?.payment_link);
}

export function checkoutSessionCustomerEmail(
  session: StripeCheckoutSessionLike | null | undefined,
): string | null {
  const details = asRecord(session?.customer_details);
  if (typeof details?.email === "string" && details.email.trim()) {
    return details.email;
  }
  if (typeof session?.customer_email === "string" && session.customer_email.trim()) {
    return session.customer_email;
  }
  return null;
}

/** True when Stripe reports the Checkout Session as paid. */
export function isCheckoutSessionPaid(
  session: StripeCheckoutSessionLike | null | undefined,
): boolean {
  return session?.payment_status === "paid";
}

function lineItemRefs(session: StripeCheckoutSessionLike): {
  priceIds: string[];
  productIds: string[];
} {
  const lineItems = asRecord(session.line_items);
  const data = Array.isArray(lineItems?.data) ? lineItems.data : [];
  const priceIds: string[] = [];
  const productIds: string[] = [];

  for (const row of data) {
    const item = asRecord(row);
    if (!item) continue;
    const price = item.price;
    const priceId = stringId(price);
    if (priceId) priceIds.push(priceId);
    const priceRecord = asRecord(price);
    const productId = stringId(priceRecord?.product) ?? stringId(item.product);
    if (productId) productIds.push(productId);
  }

  return { priceIds, productIds };
}

function metadataSlug(session: StripeCheckoutSessionLike): string | null {
  const metadata = asRecord(session.metadata);
  const slug = metadata?.[PAID_DOWNLOAD_METADATA_SLUG_KEY];
  return typeof slug === "string" && slug.trim() ? slug.trim() : null;
}

/**
 * Resolve the catalog product for a Checkout Session, or null when it is not
 * a known paid download (including unrelated Stripe products).
 */
export function matchPaidDownloadCatalogEntry(
  session: StripeCheckoutSessionLike | null | undefined,
): PaidDownloadCatalogEntry | null {
  if (!session) return null;

  const byLink = getPaidDownloadByStripePaymentLinkId(
    stripePaymentLinkIdFromSession(session),
  );
  if (byLink) return byLink;

  const { priceIds, productIds } = lineItemRefs(session);
  for (const priceId of priceIds) {
    const byPrice = getPaidDownloadByStripePriceId(priceId);
    if (byPrice) return byPrice;
  }
  for (const productId of productIds) {
    const byProduct = getPaidDownloadByStripeProductId(productId);
    if (byProduct) return byProduct;
  }

  return getPaidDownloadBySlug(metadataSlug(session));
}
