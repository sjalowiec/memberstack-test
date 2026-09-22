/**
 * Combined customer ebook library for Watson Assign ebook:
 * paid legacy purchases plus Watson-native manual grants.
 */
import {
  resolveCustomerLegacyEbookEntitlementsForEmail,
  type ResolveCustomerLegacyEbookOptions,
} from "../legacy/legacyEbookOwnership";
import type { LegacyEbookCustomerEntitlement } from "../legacy/legacyEbookEntitlements";
import { normalizeLegacyPurchaseEmail } from "../legacy/legacyEbookEntitlements";
import { customerEmailLookupKeys } from "./customerIdentifier";
import {
  buildEbookEntitlementDisplay,
  grantEbookEntitlement,
  listActiveWatsonEbookEntitlementsForIdentity,
  resolveEbookGrantIdentity,
  type EbookGrantIdentity,
  type GrantEbookEntitlementResult,
  type WatsonEbookEntitlementDisplay,
  type WatsonEbookEntitlementRow,
} from "./ebookEntitlements";
import { queryWatson } from "./db";
import { type WatsonQueryFn } from "./memberSearch";

export type CustomerEbookAccessSource = "purchase" | "grant";

export type CustomerEbookLibraryItem = {
  itemId: string;
  title: string;
  downloadUrl: string;
  sources: CustomerEbookAccessSource[];
  purchase: boolean;
  grant: WatsonEbookEntitlementDisplay | null;
  canRevoke: boolean;
};

export type CustomerEbookLibraryView = {
  identity: EbookGrantIdentity;
  items: CustomerEbookLibraryItem[];
};

export function mergeCustomerEbookEntitlements(
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

export function uniqueCustomerEmails(
  ...emails: Array<string | null | undefined>
): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const email of emails) {
    for (const key of customerEmailLookupKeys(email)) {
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(key);
    }
  }
  return unique;
}

export function buildCustomerEbookLibraryItems(input: {
  purchases: LegacyEbookCustomerEntitlement[];
  grants: WatsonEbookEntitlementRow[];
}): CustomerEbookLibraryItem[] {
  const byItem = new Map<string, CustomerEbookLibraryItem>();

  for (const purchase of input.purchases) {
    byItem.set(purchase.itemId, {
      itemId: purchase.itemId,
      title: purchase.title,
      downloadUrl: purchase.downloadUrl,
      sources: ["purchase"],
      purchase: true,
      grant: null,
      canRevoke: false,
    });
  }

  for (const row of input.grants) {
    const display = buildEbookEntitlementDisplay(row);
    if (!display || !display.active) continue;
    const existing = byItem.get(display.itemId);
    if (existing) {
      if (!existing.sources.includes("grant")) {
        existing.sources.push("grant");
      }
      existing.grant = display;
      existing.canRevoke = true;
      continue;
    }
    byItem.set(display.itemId, {
      itemId: display.itemId,
      title: display.title,
      downloadUrl: display.downloadUrl,
      sources: ["grant"],
      purchase: false,
      grant: display,
      canRevoke: true,
    });
  }

  return [...byItem.values()].sort((a, b) => {
    const byTitle = a.title.localeCompare(b.title, "en", { sensitivity: "base" });
    if (byTitle !== 0) return byTitle;
    return a.itemId.localeCompare(b.itemId, "en");
  });
}

export async function loadPaidEbookEntitlementsForEmails(
  emails: string[],
  options?: ResolveCustomerLegacyEbookOptions,
): Promise<LegacyEbookCustomerEntitlement[]> {
  const lists: LegacyEbookCustomerEntitlement[][] = [];
  const seenEmails = new Set<string>();
  for (const email of emails) {
    const normalized = normalizeLegacyPurchaseEmail(email);
    if (!normalized || seenEmails.has(normalized)) continue;
    seenEmails.add(normalized);
    lists.push(
      await resolveCustomerLegacyEbookEntitlementsForEmail(normalized, {
        ...options,
        allowLiveWatson: options?.allowLiveWatson ?? true,
        allowLiveNativeGrants: false,
      }),
    );
  }
  return mergeCustomerEbookEntitlements(...lists);
}

export async function loadCustomerEbookLibrary(
  input: {
    memberstackId?: string | null;
    memberstackEmail?: string | null;
    legacyMemberid?: string | null;
    legacyEmail?: string | null;
    memberstackLinkStatus?: string | null;
    legacyLinkAmbiguous?: boolean;
  },
  queryFn: WatsonQueryFn = queryWatson,
  options?: ResolveCustomerLegacyEbookOptions,
): Promise<CustomerEbookLibraryView> {
  const identity = resolveEbookGrantIdentity(input);
  const emails = uniqueCustomerEmails(input.memberstackEmail, input.legacyEmail);
  const purchases = await loadPaidEbookEntitlementsForEmails(emails, options);
  const grants = await listActiveWatsonEbookEntitlementsForIdentity(
    {
      memberstackId: identity.memberstackId,
      email: identity.entitlementEmail ?? emails[0] ?? null,
      legacyMemberid: identity.legacyMemberid,
    },
    queryFn,
  );
  return {
    identity,
    items: buildCustomerEbookLibraryItems({ purchases, grants }),
  };
}

export async function grantCustomerEbook(
  input: {
    itemId: unknown;
    reason: unknown;
    note?: unknown;
    sourceStoreTransactionId?: unknown;
    grantedBy?: unknown;
    memberstackId?: string | null;
    memberstackEmail?: string | null;
    legacyMemberid?: string | null;
    legacyEmail?: string | null;
    memberstackLinkStatus?: string | null;
    legacyLinkAmbiguous?: boolean;
  },
  queryFn: WatsonQueryFn = queryWatson,
  options?: ResolveCustomerLegacyEbookOptions,
): Promise<GrantEbookEntitlementResult> {
  const library = await loadCustomerEbookLibrary(input, queryFn, options);
  const paidItemIds = library.items.filter((item) => item.purchase).map((item) => item.itemId);
  const existingGrants = library.items
    .map((item) => item.grant)
    .filter((grant): grant is WatsonEbookEntitlementDisplay => Boolean(grant));

  return grantEbookEntitlement(
    {
      itemId: input.itemId,
      reason: input.reason,
      note: input.note,
      sourceStoreTransactionId: input.sourceStoreTransactionId,
      grantedBy: input.grantedBy,
      identity: library.identity,
    },
    queryFn,
    {
      paidItemIds,
      existingGrants: existingGrants.map((grant) => ({
        id: grant.id,
        item_id: grant.itemId,
        memberstack_id: grant.memberstackId,
        entitlement_email: grant.entitlementEmail,
        legacy_memberid: grant.legacyMemberid,
        reason: grant.reason,
        note: grant.note,
        source_storetransactionid: grant.sourceStoreTransactionId,
        granted_by: grant.grantedBy,
        granted_at: grant.grantedAt,
        revoked_by: grant.revokedBy,
        revoked_at: grant.revokedAt,
      })),
    },
  );
}
