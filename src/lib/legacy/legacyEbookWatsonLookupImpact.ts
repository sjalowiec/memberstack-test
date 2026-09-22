/**
 * Read-only impact estimate for enabling LEGACY_EBOOK_WATSON_LOOKUP in production.
 *
 * SELECT only. Does not grant entitlements or write Watson / Memberstack rows.
 * Counts unique trusted member-ID recoveries that CSV email lookup would miss.
 */
import {
  emailsMatchForLegacyLink,
  normalizeCustomerEmail,
} from "../watson/customerIdentifier";
import { queryWatson } from "../watson/db";
import { type WatsonQueryFn } from "../watson/memberSearch";
import {
  LEGACY_EBOOK_EXCLUDED_ITEM_IDS,
  isLegacyEbookItemApproved,
  listApprovedLegacyEbookItemIds,
  normalizeLegacyPurchaseEmail,
} from "./legacyEbookEntitlements";
import {
  buildApprovedLegacyEbookOwnershipRecords,
} from "./legacyEbookOwnership";
import { legacyEbookEmailLookupKeys } from "./legacyEbookWatsonPurchases";
import {
  loadLegacyEbookPurchases,
  type LegacyEbookPurchaseRow,
} from "./legacyEbookPurchases";

export const LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_QUALIFYING_SQL = `
  SELECT
    t.memberid_fk AS memberid,
    m.email AS member_email,
    t.billing_email,
    i.itemid
  FROM legacy_store_transactions t
  JOIN legacy_store_transaction_items i
    ON i.storetransactionid = t.storetransactionid
  LEFT JOIN legacy_members m ON m.memberid = t.memberid_fk
  WHERE t.paid = 1
    AND i.itemid = ANY($1::int[])
`;

export const LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_EMAIL_UNIQUENESS_SQL = `
  SELECT
    LOWER(TRIM(email)) AS email,
    COUNT(*)::int AS member_count,
    MIN(memberid) AS sample_memberid
  FROM legacy_members
  WHERE email IS NOT NULL AND TRIM(email) <> ''
  GROUP BY LOWER(TRIM(email))
`;

export const LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_PAID_CLASS_SQL = `
  SELECT
    COUNT(*) FILTER (WHERE i.itemid = ANY($1::int[]))::int AS approved_paid,
    COUNT(*) FILTER (WHERE i.itemid = ANY($2::int[]))::int AS excluded_paid,
    COUNT(*) FILTER (
      WHERE NOT (i.itemid = ANY($1::int[]) OR i.itemid = ANY($2::int[]))
    )::int AS non_catalog_paid
  FROM legacy_store_transactions t
  JOIN legacy_store_transaction_items i
    ON i.storetransactionid = t.storetransactionid
  WHERE t.paid = 1
`;

export const LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_EXCLUDED_SQL = `
  SELECT
    t.memberid_fk AS memberid,
    i.itemid
  FROM legacy_store_transactions t
  JOIN legacy_store_transaction_items i
    ON i.storetransactionid = t.storetransactionid
  WHERE t.paid = 1
    AND i.itemid = ANY($1::int[])
`;

export type WatsonLookupImpactQualifyingRow = {
  memberid: string | null;
  member_email: string | null;
  billing_email: string | null;
  itemid: number | string | null;
};

export type WatsonLookupImpactEmailUniquenessRow = {
  email: string | null;
  member_count: number | string | null;
  sample_memberid: string | null;
};

export type WatsonLookupImpactPaidClassRow = {
  approved_paid: number | string | null;
  excluded_paid: number | string | null;
  non_catalog_paid: number | string | null;
};

export type WatsonLookupImpactExcludedRow = {
  memberid: string | null;
  itemid: number | string | null;
};

export type LegacyEbookWatsonLookupImpactSummary = {
  customersWhoWouldGainDownloads: number;
  additionalApprovedTitleEntitlements: number;
  additionalByBilling: {
    blankBillingEmail: number;
    changedBillingEmail: number;
    matchingBillingEmail: number;
  };
  ambiguousLinksSkipped: {
    emails: number;
    members: number;
    qualifyingTitles: number;
  };
  excludedItemsSkipped: {
    lineItems: number;
    uniqueItemIds: number;
  };
  nonCatalogPaidItemsSkipped: number;
  identityCollisions: {
    billingEmailBelongsToDifferentUniqueMember: number;
    orphanMemberid: number;
    membersWithoutEmail: number;
  };
  trustedMembersWithQualifyingTitles: number;
  qualifyingPaidApprovedLineItems: number;
  queryVolume: {
    perMyDownloadsRequestWhenUniqueLink: number;
    perMyDownloadsRequestWhenLinkSkipped: number;
    memberidIndex: string;
    notes: string[];
  };
};

function asCount(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(n) ? n : 0;
}

function numericExcludedItemIds(): number[] {
  const ids: number[] = [];
  for (const itemId of LEGACY_EBOOK_EXCLUDED_ITEM_IDS) {
    const n = Number.parseInt(itemId, 10);
    if (Number.isInteger(n) && n > 0) ids.push(n);
  }
  return ids;
}

export type BillingClass = "blank" | "changed" | "matching";

export function classifyImpactBillingEmail(
  billingEmail: string | null | undefined,
  memberEmail: string | null | undefined,
): BillingClass {
  if (!normalizeLegacyPurchaseEmail(billingEmail)) return "blank";
  if (emailsMatchForLegacyLink(billingEmail, memberEmail)) return "matching";
  return "changed";
}

export function summarizeLegacyEbookWatsonLookupImpact(input: {
  qualifyingItems: WatsonLookupImpactQualifyingRow[];
  emailUniqueness: WatsonLookupImpactEmailUniquenessRow[];
  paidClass?: WatsonLookupImpactPaidClassRow | null;
  excludedItems?: WatsonLookupImpactExcludedRow[];
  csvOwnership?: Array<{ email: string; itemId: string }>;
}): LegacyEbookWatsonLookupImpactSummary {
  const uniqueness = new Map<
    string,
    { count: number; sampleMemberid: string | null }
  >();
  for (const row of input.emailUniqueness) {
    const email = normalizeCustomerEmail(row.email);
    if (!email) continue;
    uniqueness.set(email, {
      count: asCount(row.member_count),
      sampleMemberid: row.sample_memberid?.trim() || null,
    });
  }

  const csvKeys = new Set<string>();
  for (const row of input.csvOwnership ?? []) {
    const email = normalizeLegacyPurchaseEmail(row.email);
    const itemId = row.itemId.trim();
    if (!email || !itemId) continue;
    csvKeys.add(`${email}\0${itemId}`);
  }

  const csvHas = (email: string, itemId: string): boolean =>
    legacyEbookEmailLookupKeys(email).some((key) => csvKeys.has(`${key}\0${itemId}`));

  const additionalKeys = new Set<string>();
  const additionalByBilling = {
    blankBillingEmail: 0,
    changedBillingEmail: 0,
    matchingBillingEmail: 0,
  };
  const gainingCustomers = new Set<string>();
  const trustedMembers = new Set<string>();
  const ambiguousMemberids = new Set<string>();
  const ambiguousTitleKeys = new Set<string>();
  let orphanMemberid = 0;
  const membersWithoutEmail = new Set<string>();
  let billingCollision = 0;

  for (const row of input.qualifyingItems) {
    const itemId = String(row.itemid ?? "").trim();
    if (!itemId || !isLegacyEbookItemApproved(itemId)) continue;
    const memberid = row.memberid?.trim() || "";
    if (!memberid) {
      orphanMemberid += 1;
      continue;
    }

    const memberEmail = normalizeCustomerEmail(row.member_email);
    const billingClass = classifyImpactBillingEmail(row.billing_email, row.member_email);

    if (!memberEmail) {
      membersWithoutEmail.add(memberid);
      continue;
    }

    const uniquenessRow = uniqueness.get(memberEmail);
    const memberCount = uniquenessRow?.count ?? 0;
    if (memberCount !== 1) {
      ambiguousMemberids.add(memberid);
      ambiguousTitleKeys.add(`${memberid}\0${itemId}`);
      continue;
    }

    trustedMembers.add(memberid);

    const billingEmail = normalizeLegacyPurchaseEmail(row.billing_email);
    if (billingEmail) {
      const billingUniqueness = uniqueness.get(billingEmail);
      if (
        billingUniqueness?.count === 1 &&
        billingUniqueness.sampleMemberid &&
        billingUniqueness.sampleMemberid !== memberid
      ) {
        billingCollision += 1;
      }
    }

    if (csvHas(memberEmail, itemId)) continue;
    const entitlementKey = `${memberEmail}\0${itemId}`;
    if (additionalKeys.has(entitlementKey)) continue;
    additionalKeys.add(entitlementKey);
    gainingCustomers.add(memberEmail);
    if (billingClass === "blank") additionalByBilling.blankBillingEmail += 1;
    else if (billingClass === "changed") additionalByBilling.changedBillingEmail += 1;
    else additionalByBilling.matchingBillingEmail += 1;
  }

  const excludedItems = input.excludedItems ?? [];
  const excludedItemIds = new Set(
    excludedItems.map((row) => String(row.itemid ?? "").trim()).filter(Boolean),
  );

  const ambiguousEmails = [...uniqueness.values()].filter((row) => row.count > 1).length;

  return {
    customersWhoWouldGainDownloads: gainingCustomers.size,
    additionalApprovedTitleEntitlements: additionalKeys.size,
    additionalByBilling,
    ambiguousLinksSkipped: {
      emails: ambiguousEmails,
      members: ambiguousMemberids.size,
      qualifyingTitles: ambiguousTitleKeys.size,
    },
    excludedItemsSkipped: {
      lineItems: asCount(input.paidClass?.excluded_paid) || excludedItems.length,
      uniqueItemIds: input.excludedItems
        ? excludedItemIds.size
        : numericExcludedItemIds().length,
    },
    nonCatalogPaidItemsSkipped: asCount(input.paidClass?.non_catalog_paid),
    identityCollisions: {
      billingEmailBelongsToDifferentUniqueMember: billingCollision,
      orphanMemberid,
      membersWithoutEmail: membersWithoutEmail.size,
    },
    trustedMembersWithQualifyingTitles: trustedMembers.size,
    qualifyingPaidApprovedLineItems: input.qualifyingItems.length,
    queryVolume: {
      perMyDownloadsRequestWhenUniqueLink: 3,
      perMyDownloadsRequestWhenLinkSkipped: 2,
      memberidIndex: "idx_legacy_store_transactions_memberid",
      notes: [
        "Each My Downloads request already runs one Watson email purchase SELECT when the flag is on.",
        "Trusted member-ID recovery adds one unique-email link SELECT plus one memberid_fk purchase SELECT when the link is unique.",
        "Ambiguous or missing links skip the memberid_fk SELECT.",
        "memberid_fk lookups can use idx_legacy_store_transactions_memberid.",
        "The billing-email SELECT uses LOWER(TRIM(billing_email)) and cannot use that memberid index.",
      ],
    },
  };
}

export async function loadLegacyEbookWatsonLookupImpact(
  queryFn: WatsonQueryFn = queryWatson,
  csvPurchases: LegacyEbookPurchaseRow[] = loadLegacyEbookPurchases(),
): Promise<LegacyEbookWatsonLookupImpactSummary> {
  const approvedIds = listApprovedLegacyEbookItemIds();
  const excludedIds = numericExcludedItemIds();

  const [qualifyingItems, emailUniqueness, paidClassRows, excludedItems] =
    await Promise.all([
      queryFn<WatsonLookupImpactQualifyingRow>(
        LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_QUALIFYING_SQL,
        [approvedIds],
      ),
      queryFn<WatsonLookupImpactEmailUniquenessRow>(
        LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_EMAIL_UNIQUENESS_SQL,
      ),
      queryFn<WatsonLookupImpactPaidClassRow>(
        LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_PAID_CLASS_SQL,
        [approvedIds, excludedIds],
      ),
      queryFn<WatsonLookupImpactExcludedRow>(
        LEGACY_EBOOK_WATSON_LOOKUP_IMPACT_EXCLUDED_SQL,
        [excludedIds],
      ),
    ]);

  const csvOwnership = buildApprovedLegacyEbookOwnershipRecords(csvPurchases).map(
    (row) => ({ email: row.email, itemId: row.itemId }),
  );

  return summarizeLegacyEbookWatsonLookupImpact({
    qualifyingItems,
    emailUniqueness,
    paidClass: paidClassRows[0] ?? null,
    excludedItems,
    csvOwnership,
  });
}
