/**
 * Netlify Blobs store for Stripe-paid download entitlements.
 *
 * Store: `download-entitlements`
 * Key:   `by-email/{sha256(normalizedEmail)}.json`
 *
 * Ownership is keyed by normalized email + product slug so additional
 * printables and ebooks can be added without changing the layout.
 * Customer-facing rows are resolved from the paid-download catalog.
 */

import { createHash } from "node:crypto";
import { getStore, type Store } from "@netlify/blobs";
import { normalizeLegacyPurchaseEmail } from "../legacy/legacyEbookEntitlements";
import {
  getPaidDownloadBySlug,
  toPaidDownloadCustomerEntitlement,
  type PaidDownloadCatalogEntry,
} from "./paidDownloadCatalog";

export const DOWNLOAD_ENTITLEMENTS_BLOB_STORE = "download-entitlements";
export const DOWNLOAD_ENTITLEMENTS_KEY_PREFIX = "by-email/";
export const DOWNLOAD_ENTITLEMENTS_DOCUMENT_VERSION = 1;

export type PaidDownloadCustomerEntitlement = {
  itemId: string;
  title: string;
  downloadUrl: string;
};

export type PaidDownloadEntitlementRecord = {
  slug: string;
  itemId: string;
  title: string;
  downloadUrl: string;
  grantedAt: string;
  stripeSessionId: string;
  stripeSessionIds: string[];
  stripePaymentIntentId: string | null;
  stripePaymentLinkId: string | null;
  stripePriceId: string | null;
  stripeProductId: string | null;
};

export type PaidDownloadEntitlementsDocument = {
  version: number;
  email: string;
  items: Record<string, PaidDownloadEntitlementRecord>;
};

export type GrantPaidDownloadInput = {
  email: string;
  entry: PaidDownloadCatalogEntry;
  stripeSessionId: string;
  stripePaymentIntentId?: string | null;
  stripePaymentLinkId?: string | null;
  grantedAt?: string;
};

export type GrantPaidDownloadResult =
  | { ok: false; reason: "invalid_email" | "invalid_session" }
  | {
      ok: true;
      created: boolean;
      email: string;
      record: PaidDownloadEntitlementRecord;
    };

type BlobStoreLike = Pick<Store, "get" | "setJSON">;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function paidDownloadEntitlementBlobKey(normalizedEmail: string): string {
  const digest = createHash("sha256").update(normalizedEmail, "utf8").digest("hex");
  return `${DOWNLOAD_ENTITLEMENTS_KEY_PREFIX}${digest}.json`;
}

export function getDownloadEntitlementsStore(): Store {
  return getStore({
    name: DOWNLOAD_ENTITLEMENTS_BLOB_STORE,
    consistency: "strong",
  });
}

function coerceEntitlementRecord(
  raw: unknown,
): PaidDownloadEntitlementRecord | null {
  const row = asRecord(raw);
  if (!row) return null;
  const slug = stringOrNull(row.slug);
  const itemId = stringOrNull(row.itemId);
  const title = stringOrNull(row.title);
  const downloadUrl = stringOrNull(row.downloadUrl);
  const grantedAt = stringOrNull(row.grantedAt);
  const stripeSessionId = stringOrNull(row.stripeSessionId);
  if (!slug || !itemId || !title || !downloadUrl || !grantedAt || !stripeSessionId) {
    return null;
  }

  const sessionIdsRaw = Array.isArray(row.stripeSessionIds)
    ? row.stripeSessionIds
    : [stripeSessionId];
  const stripeSessionIds: string[] = [];
  const seen = new Set<string>();
  for (const value of sessionIdsRaw) {
    const id = stringOrNull(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    stripeSessionIds.push(id);
  }
  if (!seen.has(stripeSessionId)) stripeSessionIds.unshift(stripeSessionId);

  return {
    slug,
    itemId,
    title,
    downloadUrl,
    grantedAt,
    stripeSessionId,
    stripeSessionIds,
    stripePaymentIntentId: stringOrNull(row.stripePaymentIntentId),
    stripePaymentLinkId: stringOrNull(row.stripePaymentLinkId),
    stripePriceId: stringOrNull(row.stripePriceId),
    stripeProductId: stringOrNull(row.stripeProductId),
  };
}

export function normalizePaidDownloadEntitlementsDocument(
  raw: unknown,
  expectedEmail?: string | null,
): PaidDownloadEntitlementsDocument | null {
  const record = asRecord(raw);
  if (!record) return null;
  const email = normalizeLegacyPurchaseEmail(
    typeof record.email === "string" ? record.email : null,
  );
  if (!email) return null;
  if (expectedEmail && email !== expectedEmail) return null;

  const itemsRaw = asRecord(record.items) ?? {};
    const items: Record<string, PaidDownloadEntitlementRecord> = {};
  for (const value of Object.values(itemsRaw)) {
    const item = coerceEntitlementRecord(value);
    if (!item) continue;
    items[item.slug] = item;
  }

  return {
    version: DOWNLOAD_ENTITLEMENTS_DOCUMENT_VERSION,
    email,
    items,
  };
}

export async function readPaidDownloadEntitlementsDocument(
  email: string | null | undefined,
  store: BlobStoreLike = getDownloadEntitlementsStore(),
): Promise<PaidDownloadEntitlementsDocument | null> {
  const normalized = normalizeLegacyPurchaseEmail(email);
  if (!normalized) return null;

  const key = paidDownloadEntitlementBlobKey(normalized);
  let raw: unknown = null;
  try {
    raw = await store.get(key, { type: "json" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not found|404|does not exist/i.test(message)) return null;
    throw err;
  }
  if (!raw) return null;
  return normalizePaidDownloadEntitlementsDocument(raw, normalized);
}

export async function grantPaidDownloadEntitlement(
  input: GrantPaidDownloadInput,
  store: BlobStoreLike = getDownloadEntitlementsStore(),
): Promise<GrantPaidDownloadResult> {
  const email = normalizeLegacyPurchaseEmail(input.email);
  const stripeSessionId = input.stripeSessionId.trim();
  if (!email) return { ok: false, reason: "invalid_email" };
  if (!stripeSessionId) return { ok: false, reason: "invalid_session" };

  const existing = await readPaidDownloadEntitlementsDocument(email, store);
  const items = { ...(existing?.items ?? {}) };
  const previous = items[input.entry.slug];
  const grantedAt = previous?.grantedAt ?? input.grantedAt ?? new Date().toISOString();

  const stripeSessionIds = [...(previous?.stripeSessionIds ?? [])];
  if (previous?.stripeSessionId && !stripeSessionIds.includes(previous.stripeSessionId)) {
    stripeSessionIds.push(previous.stripeSessionId);
  }
  if (!stripeSessionIds.includes(stripeSessionId)) {
    stripeSessionIds.push(stripeSessionId);
  }

  const record: PaidDownloadEntitlementRecord = {
    slug: input.entry.slug,
    itemId: toPaidDownloadCustomerEntitlement(input.entry).itemId,
    title: input.entry.title,
    downloadUrl: input.entry.downloadUrl,
    grantedAt,
    stripeSessionId: previous?.stripeSessionId ?? stripeSessionId,
    stripeSessionIds,
    stripePaymentIntentId:
      input.stripePaymentIntentId?.trim() || previous?.stripePaymentIntentId || null,
    stripePaymentLinkId:
      input.stripePaymentLinkId?.trim() ||
      previous?.stripePaymentLinkId ||
      input.entry.stripePaymentLinkId,
    stripePriceId: previous?.stripePriceId || input.entry.stripePriceId,
    stripeProductId: previous?.stripeProductId || input.entry.stripeProductId,
  };

  items[input.entry.slug] = record;
  const document: PaidDownloadEntitlementsDocument = {
    version: DOWNLOAD_ENTITLEMENTS_DOCUMENT_VERSION,
    email,
    items,
  };

  await store.setJSON(paidDownloadEntitlementBlobKey(email), document);

  return {
    ok: true,
    created: !previous,
    email,
    record,
  };
}

/**
 * Customer-safe paid-download rows for a verified account email.
 * Unknown/retired slugs are omitted (fail closed).
 */
export async function listPaidDownloadCustomerEntitlementsForEmail(
  email: string | null | undefined,
  store: BlobStoreLike = getDownloadEntitlementsStore(),
): Promise<PaidDownloadCustomerEntitlement[]> {
  const document = await readPaidDownloadEntitlementsDocument(email, store);
  if (!document) return [];

  const rows: PaidDownloadCustomerEntitlement[] = [];
  for (const record of Object.values(document.items)) {
    const entry = getPaidDownloadBySlug(record.slug);
    if (!entry) continue;
    rows.push(toPaidDownloadCustomerEntitlement(entry));
  }

  rows.sort((a, b) => {
    const byTitle = a.title.localeCompare(b.title, "en", { sensitivity: "base" });
    if (byTitle !== 0) return byTitle;
    return a.itemId.localeCompare(b.itemId, "en");
  });
  return rows;
}
