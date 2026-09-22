/**
 * Resolve approved legacy ebook ownership for a Memberstack account.
 *
 * Reads paid rows from legacy-ebook-purchases.csv and, when Watson lookup is
 * enabled, unions paid Watson store transactions for the same verified email
 * plus paid Watson rows owned by a trusted unique legacy member ID.
 * Dedupes by item ID and returns customer-safe entitlements only.
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
import {
  loadLegacyEbookPurchasesFromWatson,
  loadLegacyEbookPurchasesFromWatsonByMemberid,
  shouldReadLegacyEbooksFromWatson,
} from "./legacyEbookWatsonPurchases";
import {
  resolveTrustedLegacyMemberIdForEbookRecovery,
  type TrustedLegacyMemberLinkResult,
} from "./legacyEbookTrustedMemberLink";

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

export type ResolveCustomerLegacyEbookOptions = {
  /** When set, used as the sole purchase source (CSV tests; skips Watson). */
  purchases?: LegacyEbookPurchaseRow[];
  csvPurchases?: LegacyEbookPurchaseRow[];
  watsonPurchases?: LegacyEbookPurchaseRow[];
  loadWatson?: (
    email: string | null | undefined,
  ) => Promise<LegacyEbookPurchaseRow[]>;
  /**
   * Paid Watson rows recovered by trusted member ID, already attributed to the
   * authenticated email. When set, skips live member-ID lookup.
   */
  watsonMemberidPurchases?: LegacyEbookPurchaseRow[];
  loadWatsonByMemberid?: (
    memberid: string,
    ownerEmail: string,
  ) => Promise<LegacyEbookPurchaseRow[]>;
  resolveTrustedLegacyMemberid?: (
    email: string | null | undefined,
  ) => Promise<TrustedLegacyMemberLinkResult>;
  /**
   * Server-verified KIN / legacy member ID. Never from the browser.
   * Live My Downloads leaves this unset; unique email matching is used.
   */
  storedLegacyMemberid?: string | null;
  /**
   * Permit the default live Watson SELECT. Netlify My Downloads sets this.
   * Tests must leave it unset and inject `watsonPurchases` / `loadWatson`.
   */
  allowLiveWatson?: boolean;
  useCache?: boolean;
};

function mergeEntitlementsByItemId(
  ...lists: LegacyEbookCustomerEntitlement[][]
): LegacyEbookCustomerEntitlement[] {
  const seen = new Set<string>();
  const merged: LegacyEbookCustomerEntitlement[] = [];
  for (const list of lists) {
    for (const row of list) {
      const itemId = row.itemId.trim();
      if (!itemId || seen.has(itemId)) continue;
      seen.add(itemId);
      merged.push(row);
    }
  }
  merged.sort((a, b) => {
    const byTitle = a.title.localeCompare(b.title, "en", { sensitivity: "base" });
    if (byTitle !== 0) return byTitle;
    return a.itemId.localeCompare(b.itemId, "en");
  });
  return merged;
}

function shouldSkipLiveWatsonMemberidLookup(
  options?: ResolveCustomerLegacyEbookOptions,
): boolean {
  if (options?.watsonMemberidPurchases) return true;
  if (options?.loadWatsonByMemberid) return false;
  if (options?.resolveTrustedLegacyMemberid) return false;
  // Isolated email/CSV tests inject watsonPurchases and must not hit live Watson.
  return options?.watsonPurchases !== undefined;
}

async function loadWatsonMemberidPurchasesForCustomer(
  email: string | null | undefined,
  options?: ResolveCustomerLegacyEbookOptions,
): Promise<LegacyEbookPurchaseRow[]> {
  if (options?.watsonMemberidPurchases) {
    return options.watsonMemberidPurchases;
  }
  if (shouldSkipLiveWatsonMemberidLookup(options)) {
    return [];
  }

  const canLive =
    Boolean(options?.allowLiveWatson) && shouldReadLegacyEbooksFromWatson();
  if (!options?.loadWatsonByMemberid && !options?.resolveTrustedLegacyMemberid && !canLive) {
    return [];
  }

  let link: TrustedLegacyMemberLinkResult;
  try {
    const resolver =
      options?.resolveTrustedLegacyMemberid ??
      ((authEmail: string | null | undefined) =>
        resolveTrustedLegacyMemberIdForEbookRecovery({
          email: authEmail,
          storedLegacyMemberid: options?.storedLegacyMemberid,
        }));
    link = await resolver(email);
  } catch (err) {
    console.error("legacy-ebook-ownership: trusted legacy member link failed:", err);
    return [];
  }

  if (link.status !== "unique") return [];
  const ownerEmail = normalizeLegacyPurchaseEmail(email);
  if (!ownerEmail) return [];

  const loader =
    options?.loadWatsonByMemberid ??
    (canLive ? loadLegacyEbookPurchasesFromWatsonByMemberid : null);
  if (!loader) return [];

  try {
    return await loader(link.memberid, ownerEmail);
  } catch (err) {
    console.error("legacy-ebook-ownership: Watson member-ID lookup failed:", err);
    return [];
  }
}

/**
 * Customer My Downloads resolver: CSV entitlements plus optional Watson rows
 * for the same verified email, unioned with trusted member-ID Watson rows.
 * Watson lookup failures must not hide CSV results.
 */
export async function resolveCustomerLegacyEbookEntitlementsForEmail(
  email: string | null | undefined,
  options?: ResolveCustomerLegacyEbookOptions,
): Promise<LegacyEbookCustomerEntitlement[]> {
  if (options?.purchases) {
    return resolveLegacyEbookEntitlementsForEmail(email, {
      purchases: options.purchases,
      useCache: options.useCache,
    });
  }

  const csv = options?.csvPurchases ?? loadLegacyEbookPurchases();
  let watson: LegacyEbookPurchaseRow[] = options?.watsonPurchases ?? [];

  if (options?.watsonPurchases === undefined) {
    const loader =
      options?.loadWatson ??
      (options?.allowLiveWatson && shouldReadLegacyEbooksFromWatson()
        ? loadLegacyEbookPurchasesFromWatson
        : null);
    if (loader) {
      try {
        watson = await loader(email);
      } catch (err) {
        console.error("legacy-ebook-ownership: Watson lookup failed:", err);
        watson = [];
      }
    }
  }

  const watsonMemberid = await loadWatsonMemberidPurchasesForCustomer(email, options);

  return mergeEntitlementsByItemId(
    resolveLegacyEbookEntitlementsForEmail(email, {
      purchases: [...csv, ...watson, ...watsonMemberid],
      useCache: false,
    }),
  );
}

/** Exact unique approved ownership pairs from repository purchase data. */
export function countApprovedLegacyEbookOwnershipRecords(
  purchases?: LegacyEbookPurchaseRow[],
): number {
  return buildApprovedLegacyEbookOwnershipRecords(purchases).length;
}
