/**
 * Read-only DEV sample for trusted member-ID ebook recovery.
 *
 * SELECT only. Does not grant entitlements, write legacy tables, or call
 * Memberstack. Does not impersonate a customer JWT.
 *
 *   npx vite-node scripts/verify-legacy-ebook-memberid-recovery.ts
 */
import {
  getLegacyEbookEntitlement,
  isLegacyEbookItemApproved,
  isLegacyEbookItemExcluded,
  listApprovedLegacyEbookItemIds,
  toCustomerLegacyEbookEntitlement,
} from "../src/lib/legacy/legacyEbookEntitlements";
import { resolveCustomerLegacyEbookEntitlementsForEmail } from "../src/lib/legacy/legacyEbookOwnership";
import { resolveTrustedLegacyMemberIdForEbookRecovery } from "../src/lib/legacy/legacyEbookTrustedMemberLink";
import {
  loadLegacyEbookPurchasesFromWatson,
  loadLegacyEbookPurchasesFromWatsonByMemberid,
} from "../src/lib/legacy/legacyEbookWatsonPurchases";
import { closeWatsonPool, queryWatson } from "../src/lib/watson/db";
import { formatDatabaseTarget, loadEnvFile } from "../src/lib/watson/env";

loadEnvFile();

const LINDA_MEMBERID = "6ECD81B4-B172-04D6-2FDF-9D46FFB6B909";
const LINDA_EMAIL = "texas44@gmail.com";
const SAMPLE_SIZE = 10;

const BLANK_BONUS_CANDIDATES_SQL = `
  SELECT
    m.memberid,
    m.email,
    COUNT(DISTINCT i.itemid)::int AS blank_title_count
  FROM legacy_store_transactions t
  JOIN legacy_store_transaction_items i
    ON i.storetransactionid = t.storetransactionid
  JOIN legacy_members m ON m.memberid = t.memberid_fk
  WHERE t.paid = 1
    AND i.itemid = ANY($1::int[])
    AND (t.billing_email IS NULL OR TRIM(t.billing_email) = '')
    AND m.email IS NOT NULL AND TRIM(m.email) <> ''
    AND m.memberid <> $2
  GROUP BY m.memberid, m.email
  ORDER BY COUNT(DISTINCT i.itemid) DESC, m.memberid ASC
  LIMIT 40
`;

const MEMBER_PAID_ITEMS_SQL = `
  SELECT
    i.itemid,
    i.itemname,
    t.billing_email,
    t.paid,
    t.storetransactionid
  FROM legacy_store_transactions t
  JOIN legacy_store_transaction_items i
    ON i.storetransactionid = t.storetransactionid
  WHERE t.memberid_fk = $1
    AND t.paid = 1
`;

const ENTITLEMENTS_TABLE_SQL = `
  SELECT to_regclass('public.watson_ebook_entitlements') AS table_name
`;

const ENTITLEMENTS_COUNT_SQL = `
  SELECT COUNT(*)::int AS grant_count
  FROM watson_ebook_entitlements
  WHERE revoked_at IS NULL
    AND (
      legacy_memberid = ANY($1::text[])
      OR LOWER(TRIM(entitlement_email)) = ANY($2::text[])
    )
`;

type CandidateRow = {
  memberid: string;
  email: string | null;
  blank_title_count: number | string;
};

type PaidItemRow = {
  itemid: number | string | null;
  itemname: string | null;
  billing_email: string | null;
  paid: number | string | null;
  storetransactionid: number | string | null;
};

function msSince(started: number): number {
  return Math.round((performance.now() - started) * 10) / 10;
}

function stats(values: number[]): { typicalMs: number; slowestMs: number; samples: number } {
  if (values.length === 0) return { typicalMs: 0, slowestMs: 0, samples: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const typical =
    sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  return {
    typicalMs: Math.round(typical * 10) / 10,
    slowestMs: sorted[sorted.length - 1]!,
    samples: sorted.length,
  };
}

function mappedApprovedItemIds(itemIds: string[]): string[] {
  const mapped: string[] = [];
  for (const itemId of itemIds) {
    if (!isLegacyEbookItemApproved(itemId)) continue;
    const entitlement = getLegacyEbookEntitlement(itemId);
    if (!entitlement || !toCustomerLegacyEbookEntitlement(entitlement)) continue;
    mapped.push(itemId);
  }
  return [...new Set(mapped)].sort();
}

async function inspectCustomer(input: {
  label: string;
  memberid: string;
  email: string;
}): Promise<{
  label: string;
  email: string;
  memberid: string;
  linkStatus: string;
  blankBillingApproved: string[];
  watsonApprovedMapped: string[];
  watsonExcluded: string[];
  watsonNonEbook: string[];
  downloads: string[];
  missingFromDownloads: string[];
  unexpectedDownloads: string[];
  emailOrCsvExtras: string[];
  timings: {
    emailLookupMs: number;
    uniqueLinkMs: number;
    memberidLookupMs: number;
    resolverMs: number;
    totalMs: number;
  };
}> {
  const storeRows = await queryWatson<PaidItemRow>(MEMBER_PAID_ITEMS_SQL, [input.memberid]);
  const approvedMapped: string[] = [];
  const excluded: string[] = [];
  const nonEbook: string[] = [];
  const blankApproved: string[] = [];

  for (const row of storeRows) {
    const itemId = String(row.itemid ?? "").trim();
    if (!itemId) continue;
    if (isLegacyEbookItemExcluded(itemId)) {
      excluded.push(itemId);
      continue;
    }
    if (!isLegacyEbookItemApproved(itemId)) {
      nonEbook.push(itemId);
      continue;
    }
    const entitlement = getLegacyEbookEntitlement(itemId);
    if (!entitlement || !toCustomerLegacyEbookEntitlement(entitlement)) {
      nonEbook.push(itemId);
      continue;
    }
    approvedMapped.push(itemId);
    if (!String(row.billing_email ?? "").trim()) blankApproved.push(itemId);
  }

  const startedEmail = performance.now();
  await loadLegacyEbookPurchasesFromWatson(input.email);
  const emailLookupMs = msSince(startedEmail);

  const startedLink = performance.now();
  const link = await resolveTrustedLegacyMemberIdForEbookRecovery({ email: input.email });
  const uniqueLinkMs = msSince(startedLink);

  const startedMemberid = performance.now();
  if (link.status === "unique") {
    await loadLegacyEbookPurchasesFromWatsonByMemberid(link.memberid, input.email);
  }
  const memberidLookupMs = msSince(startedMemberid);

  const startedResolver = performance.now();
  const downloads = await resolveCustomerLegacyEbookEntitlementsForEmail(input.email, {
    allowLiveWatson: true,
    allowLiveNativeGrants: true,
  });
  const resolverMs = msSince(startedResolver);

  const downloadIds = downloads.map((row) => row.itemId).sort();
  const watsonApprovedMapped = mappedApprovedItemIds(approvedMapped);
  const missingFromDownloads = watsonApprovedMapped.filter((id) => !downloadIds.includes(id));
  const unexpectedDownloads = downloadIds.filter(
    (id) => !isLegacyEbookItemApproved(id) || isLegacyEbookItemExcluded(id),
  );
  const emailOrCsvExtras = downloadIds.filter((id) => !watsonApprovedMapped.includes(id));

  return {
    label: input.label,
    email: input.email,
    memberid: input.memberid,
    linkStatus: link.status,
    blankBillingApproved: [...new Set(blankApproved)].sort(),
    watsonApprovedMapped,
    watsonExcluded: [...new Set(excluded)].sort(),
    watsonNonEbook: [...new Set(nonEbook)].sort(),
    downloads: downloadIds,
    missingFromDownloads,
    unexpectedDownloads,
    emailOrCsvExtras,
    timings: {
      emailLookupMs,
      uniqueLinkMs,
      memberidLookupMs,
      resolverMs,
      totalMs:
        Math.round((emailLookupMs + uniqueLinkMs + memberidLookupMs + resolverMs) * 10) / 10,
    },
  };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.WATSON_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("WATSON_DATABASE_URL is not set.");
  }

  const errorSpy = console.error;
  const grantLookupErrors: string[] = [];
  console.error = (...args: unknown[]) => {
    const text = args.map((arg) => String(arg)).join(" ");
    if (text.includes("native grant lookup failed")) {
      grantLookupErrors.push(text);
      return;
    }
    errorSpy(...args);
  };

  try {
    const linda = await inspectCustomer({
      label: "Linda",
      memberid: LINDA_MEMBERID,
      email: LINDA_EMAIL,
    });

    const candidates = await queryWatson<CandidateRow>(BLANK_BONUS_CANDIDATES_SQL, [
      listApprovedLegacyEbookItemIds(),
      LINDA_MEMBERID,
    ]);

    const sample: Awaited<ReturnType<typeof inspectCustomer>>[] = [];
    for (const candidate of candidates) {
      if (sample.length >= SAMPLE_SIZE) break;
      const email = String(candidate.email ?? "").trim();
      if (!email) continue;
      const link = await resolveTrustedLegacyMemberIdForEbookRecovery({ email });
      if (link.status !== "unique") continue;
      if (link.memberid !== candidate.memberid) continue;
      sample.push(
        await inspectCustomer({
          label: `sample-${sample.length + 1}`,
          memberid: candidate.memberid,
          email,
        }),
      );
    }

    const all = [linda, ...sample];
    const tableRows = await queryWatson<{ table_name: string | null }>(ENTITLEMENTS_TABLE_SQL);
    const entitlementsTable = tableRows[0]?.table_name ?? null;
    let grantCount = 0;
    if (entitlementsTable) {
      const emails = all.map((row) => row.email.toLowerCase());
      const memberids = all.map((row) => row.memberid);
      const counts = await queryWatson<{ grant_count: number }>(ENTITLEMENTS_COUNT_SQL, [
        memberids,
        emails,
      ]);
      grantCount = counts[0]?.grant_count ?? 0;
    }

    const timings = {
      emailPurchaseLookup: stats(all.map((row) => row.timings.emailLookupMs)),
      uniqueLegacyLinkLookup: stats(all.map((row) => row.timings.uniqueLinkMs)),
      memberidPurchaseLookup: stats(all.map((row) => row.timings.memberidLookupMs)),
      fullResolver: stats(all.map((row) => row.timings.resolverMs)),
      totalResolverQueries: stats(all.map((row) => row.timings.totalMs)),
    };

    console.log(
      JSON.stringify(
        {
          watsonTarget: formatDatabaseTarget(databaseUrl),
          previewLimitation:
            "No signed/admin preview exists for GET /.netlify/functions/my-ebook-downloads as a specific customer. Verification used the same server resolver the endpoint runs after a verified JWT email.",
          linda: {
            expectedTitles: 9,
            downloads: linda.downloads,
            downloadCount: linda.downloads.length,
            includes621: linda.downloads.includes("621"),
            missingFromDownloads: linda.missingFromDownloads,
            unexpectedDownloads: linda.unexpectedDownloads,
            watsonExcluded: linda.watsonExcluded,
            watsonNonEbook: linda.watsonNonEbook,
            match:
              linda.downloads.length === 9 &&
              !linda.downloads.includes("621") &&
              linda.missingFromDownloads.length === 0 &&
              linda.unexpectedDownloads.length === 0,
          },
          sampleCount: sample.length,
          sample: sample.map((row) => ({
            email: row.email,
            memberid: row.memberid,
            blankBillingApproved: row.blankBillingApproved.length,
            watsonApprovedMapped: row.watsonApprovedMapped,
            downloads: row.downloads,
            missingFromDownloads: row.missingFromDownloads,
            unexpectedDownloads: row.unexpectedDownloads,
            emailOrCsvExtras: row.emailOrCsvExtras,
            watsonExcluded: row.watsonExcluded,
            watsonNonEbookCount: row.watsonNonEbook.length,
            timings: row.timings,
          })),
          mismatches: all
            .filter(
              (row) =>
                row.missingFromDownloads.length > 0 || row.unexpectedDownloads.length > 0,
            )
            .map((row) => ({
              email: row.email,
              missingFromDownloads: row.missingFromDownloads,
              unexpectedDownloads: row.unexpectedDownloads,
            })),
          entitlementsTable,
          activeGrantRowsForSample: grantCount,
          grantLookupErrors: grantLookupErrors.length,
          timings,
        },
        null,
        2,
      ),
    );
  } finally {
    console.error = errorSpy;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeWatsonPool();
  });
