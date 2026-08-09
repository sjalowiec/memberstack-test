/**
 * Resolve approved legacy ebook ownership for a Memberstack account email.
 *
 * Reads paid rows from legacy-ebook-purchases.csv, normalizes email, dedupes by
 * email + item ID, and returns customer-safe entitlements only.
 */
import {
  getLegacyEbookEntitlement,
  isLegacyEbookItemApproved,
  normalizeLegacyPurchaseEmail,
  toCustomerLegacyEbookEntitlement,
  type LegacyEbookCustomerEntitlement,
  type LegacyEbookEntitlementEntry,
} from "./legacyEbookEntitlements";
// toCustomerLegacyEbookEntitlement returns null when downloadUrl mapping is missing (fail closed).
import {
  loadLegacyEbookPurchases,
  type LegacyEbookPurchaseRow,
} from "./legacyEbookPurchases";

export type LegacyEbookOwnershipRecord = {
  email: string;
  itemId: string;
  entitlement: LegacyEbookEntitlementEntry;
};

/** True when the CSV Paid column indicates a paid transaction. */
export function isLegacyEbookPurchasePaid(
  paid: string | null | undefined,
): boolean {
  return String(paid ?? "").trim() === "1";
}

/**
 * Collapse paid purchase rows to unique approved (email, itemId) ownership records.
 * Excluded / unknown item IDs are dropped.
 */
export function buildApprovedLegacyEbookOwnershipRecords(
  purchases: LegacyEbookPurchaseRow[] = loadLegacyEbookPurchases(),
): LegacyEbookOwnershipRecord[] {
  const seen = new Set<string>();
  const records: LegacyEbookOwnershipRecord[] = [];

  for (const row of purchases) {
    if (!isLegacyEbookPurchasePaid(row.paid)) continue;

    const email = normalizeLegacyPurchaseEmail(row.billingEmail);
    if (!email) continue;

    const itemId = row.legacyItemId.trim();
    if (!itemId || !isLegacyEbookItemApproved(itemId)) continue;

    const entitlement = getLegacyEbookEntitlement(itemId);
    if (!entitlement) continue;
    // Fail closed: approved catalog entries without a public download mapping are omitted.
    if (!toCustomerLegacyEbookEntitlement(entitlement)) continue;

    const key = `${email}\0${itemId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    records.push({ email, itemId, entitlement });
  }

  return records;
}

let ownershipIndexCache: Map<string, LegacyEbookCustomerEntitlement[]> | null =
  null;

function compareEntitlementTitle(
  a: LegacyEbookCustomerEntitlement,
  b: LegacyEbookCustomerEntitlement,
): number {
  const byTitle = a.title.localeCompare(b.title, "en", { sensitivity: "base" });
  if (byTitle !== 0) return byTitle;
  return a.itemId.localeCompare(b.itemId, "en");
}

function buildOwnershipIndex(
  purchases?: LegacyEbookPurchaseRow[],
): Map<string, LegacyEbookCustomerEntitlement[]> {
  const index = new Map<string, LegacyEbookCustomerEntitlement[]>();

  for (const record of buildApprovedLegacyEbookOwnershipRecords(purchases)) {
    const customer = toCustomerLegacyEbookEntitlement(record.entitlement);
    if (!customer) continue;
    const list = index.get(record.email) ?? [];
    list.push(customer);
    index.set(record.email, list);
  }

  for (const [email, list] of index) {
    list.sort(compareEntitlementTitle);
    index.set(email, list);
  }

  return index;
}

/** Reset cached ownership index (tests). */
export function clearLegacyEbookOwnershipIndexCache(): void {
  ownershipIndexCache = null;
}

function getOwnershipIndex(): Map<string, LegacyEbookCustomerEntitlement[]> {
  if (!ownershipIndexCache) {
    ownershipIndexCache = buildOwnershipIndex();
  }
  return ownershipIndexCache;
}

/**
 * Customer-safe entitlements for a verified Memberstack email.
 * Never returns billing names, transaction IDs, prices, paths, or storage keys.
 */
export function resolveLegacyEbookEntitlementsForEmail(
  email: string | null | undefined,
  options?: { purchases?: LegacyEbookPurchaseRow[]; useCache?: boolean },
): LegacyEbookCustomerEntitlement[] {
  const normalized = normalizeLegacyPurchaseEmail(email);
  if (!normalized) return [];

  if (options?.purchases) {
    const index = buildOwnershipIndex(options.purchases);
    return [...(index.get(normalized) ?? [])];
  }

  if (options?.useCache === false) {
    const index = buildOwnershipIndex();
    return [...(index.get(normalized) ?? [])];
  }

  return [...(getOwnershipIndex().get(normalized) ?? [])];
}

/** Exact unique approved ownership pairs from repository purchase data. */
export function countApprovedLegacyEbookOwnershipRecords(
  purchases?: LegacyEbookPurchaseRow[],
): number {
  return buildApprovedLegacyEbookOwnershipRecords(purchases).length;
}
