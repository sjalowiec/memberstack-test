/**
 * Read-only store for cleaned Watson-native legacy history.
 * Tables: watson_legacy_customers, watson_legacy_history.
 * Admin-only. Never write. Never expose customer_notes outside /watson.
 */
import { formatMembershipCalendarDateFromYmd, ymdFromDateOnlyValue } from "../membership/membershipStatusSummary";
import { normalizeCustomerEmail } from "./customerIdentifier";
import { queryWatson } from "./db";
import {
  isWatsonLegacyHistoryCategory,
  type WatsonLegacyHistoryCategory,
} from "./legacyHistoryTypes";
import { hasDisplayValue } from "./memberDetail";
import { formatLegacyMoney } from "./memberOrders";
import type { WatsonQueryFn } from "./memberSearch";

export const LEGACY_CUSTOMER_NOTES_AUDIENCE = "watson_admin_only" as const;

export const CLEANED_LEGACY_HISTORY_HIDDEN_FIELDS = [
  "id",
  "identity_key",
  "source_record_id",
  "item_id",
  "transaction_id",
  "SourceRecordID",
  "ItemID",
  "TransactionID",
] as const;

export type WatsonCleanedLegacyCustomerNotes = {
  audience: typeof LEGACY_CUSTOMER_NOTES_AUDIENCE;
  text: string;
};

export type WatsonCleanedLegacyHistoryRecord = {
  category: WatsonLegacyHistoryCategory;
  description: string;
  transactionDate: string | null;
  transactionDateSort: string;
  amount: string | null;
  amountSort: string;
  expirationDate: string | null;
  expirationDateSort: string;
  processor: string | null;
};

export type WatsonCleanedLegacyHistoryView = {
  legacyMemberid: string;
  customerNotes: WatsonCleanedLegacyCustomerNotes | null;
  memberships: WatsonCleanedLegacyHistoryRecord[];
  coursePurchases: WatsonCleanedLegacyHistoryRecord[];
  patternPurchases: WatsonCleanedLegacyHistoryRecord[];
  lk150Bundles: WatsonCleanedLegacyHistoryRecord[];
};

export type CleanedLegacyEmailLinkResult =
  | { status: "unique"; legacyMemberid: string }
  | { status: "ambiguous"; legacyMemberids: string[] }
  | { status: "none" };

export type WatsonCleanedLegacyCustomerRow = {
  legacy_memberid: string;
  email: string | null;
  customer_notes: string | null;
};

export type WatsonCleanedLegacyHistoryRow = {
  category: string;
  transaction_date: Date | string | null;
  description: string | null;
  amount: string | number | null;
  expiration_date: Date | string | null;
  processor: string | null;
};

export const WATSON_LEGACY_CUSTOMER_BY_MEMBERID_SQL = `
  SELECT
    legacy_memberid,
    email,
    customer_notes
  FROM watson_legacy_customers
  WHERE legacy_memberid = $1
  LIMIT 1
`;

export const WATSON_LEGACY_CUSTOMERS_BY_EMAIL_SQL = `
  SELECT
    legacy_memberid,
    email,
    customer_notes
  FROM watson_legacy_customers
  WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
  ORDER BY legacy_memberid ASC
`;

export const WATSON_LEGACY_HISTORY_BY_MEMBERID_SQL = `
  SELECT
    category,
    transaction_date,
    description,
    amount,
    expiration_date,
    processor
  FROM watson_legacy_history
  WHERE legacy_memberid = $1
  ORDER BY transaction_date DESC NULLS LAST, description ASC
`;

export function formatCleanedLegacyDateDisplay(
  value: Date | string | null | undefined,
): string | null {
  const ymd = ymdFromDateOnlyValue(value ?? null);
  if (!ymd) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) {
    return formatMembershipCalendarDateFromYmd(ymd);
  }
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(utc.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(utc);
}

export function formatCleanedLegacyDateSort(
  value: Date | string | null | undefined,
): string {
  return ymdFromDateOnlyValue(value ?? null) ?? "";
}

export function buildCleanedLegacyCustomerNotes(
  customerNotes: string | null | undefined,
): WatsonCleanedLegacyCustomerNotes | null {
  if (!hasDisplayValue(customerNotes)) {
    return null;
  }
  return {
    audience: LEGACY_CUSTOMER_NOTES_AUDIENCE,
    text: String(customerNotes).trim(),
  };
}

export function buildCleanedLegacyHistoryRecord(
  row: WatsonCleanedLegacyHistoryRow,
): WatsonCleanedLegacyHistoryRecord | null {
  if (!isWatsonLegacyHistoryCategory(row.category)) {
    return null;
  }

  return {
    category: row.category,
    description: hasDisplayValue(row.description) ? String(row.description).trim() : "",
    transactionDate: formatCleanedLegacyDateDisplay(row.transaction_date),
    transactionDateSort: formatCleanedLegacyDateSort(row.transaction_date),
    amount: formatLegacyMoney(row.amount),
    amountSort: row.amount == null || row.amount === "" ? "" : String(row.amount),
    expirationDate: formatCleanedLegacyDateDisplay(row.expiration_date),
    expirationDateSort: formatCleanedLegacyDateSort(row.expiration_date),
    processor: hasDisplayValue(row.processor) ? String(row.processor).trim() : null,
  };
}

export function groupCleanedLegacyHistoryRecords(
  records: WatsonCleanedLegacyHistoryRecord[],
): Pick<
  WatsonCleanedLegacyHistoryView,
  "memberships" | "coursePurchases" | "patternPurchases" | "lk150Bundles"
> {
  return {
    memberships: records.filter((record) => record.category === "Membership"),
    coursePurchases: records.filter((record) => record.category === "Course Purchase"),
    patternPurchases: records.filter((record) => record.category === "Pattern Purchase"),
    lk150Bundles: records.filter((record) => record.category === "LK150 Bundle"),
  };
}

export function buildCleanedLegacyHistoryView(input: {
  legacyMemberid: string;
  customerNotes?: string | null;
  rows: WatsonCleanedLegacyHistoryRow[];
}): WatsonCleanedLegacyHistoryView {
  const records = input.rows
    .map(buildCleanedLegacyHistoryRecord)
    .filter((record): record is WatsonCleanedLegacyHistoryRecord => record != null);

  return {
    legacyMemberid: input.legacyMemberid,
    customerNotes: buildCleanedLegacyCustomerNotes(input.customerNotes),
    ...groupCleanedLegacyHistoryRecords(records),
  };
}

export function cleanedLegacyHistoryRecordCount(
  view: WatsonCleanedLegacyHistoryView,
): number {
  return (
    view.memberships.length +
    view.coursePurchases.length +
    view.patternPurchases.length +
    view.lk150Bundles.length
  );
}

export function hasVisibleCleanedLegacyHistory(
  view: WatsonCleanedLegacyHistoryView | null | undefined,
): boolean {
  if (!view) {
    return false;
  }
  return Boolean(view.customerNotes) || cleanedLegacyHistoryRecordCount(view) > 0;
}

export function cleanedLegacyHistoryAccordionCount(
  view: WatsonCleanedLegacyHistoryView,
): number {
  return cleanedLegacyHistoryRecordCount(view) + (view.customerNotes ? 1 : 0);
}

export function membershipHistoryShowsProcessor(
  records: WatsonCleanedLegacyHistoryRecord[],
): boolean {
  return records.some((record) => hasDisplayValue(record.processor));
}

/**
 * Conservative attachment: LegacyMemberID is authoritative on legacy profiles.
 * Memberstack may attach only a unique exact email match, and never when dump
 * or cleaned emails are ambiguous. Name is never used.
 */
export function resolveCleanedLegacyHistoryMemberid(input: {
  profileType: "legacy" | "memberstack";
  routeLegacyMemberid?: string | null;
  dumpLinkAmbiguous?: boolean;
  dumpLegacyMemberid?: string | null;
  cleanedEmailLink: CleanedLegacyEmailLinkResult;
}): string | null {
  if (input.profileType === "legacy") {
    const memberid = input.routeLegacyMemberid?.trim();
    return memberid || null;
  }

  if (input.dumpLinkAmbiguous) {
    return null;
  }

  if (input.cleanedEmailLink.status === "ambiguous") {
    return null;
  }

  if (input.cleanedEmailLink.status === "unique") {
    const dumpId = input.dumpLegacyMemberid?.trim() || null;
    if (dumpId && dumpId !== input.cleanedEmailLink.legacyMemberid) {
      return null;
    }
    return input.cleanedEmailLink.legacyMemberid;
  }

  const dumpId = input.dumpLegacyMemberid?.trim() || null;
  return dumpId;
}

export async function getCleanedLegacyCustomerByMemberid(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WatsonCleanedLegacyCustomerRow | null> {
  const normalized = memberid.trim();
  if (!normalized) {
    return null;
  }

  const rows = await queryFn<WatsonCleanedLegacyCustomerRow>(
    WATSON_LEGACY_CUSTOMER_BY_MEMBERID_SQL,
    [normalized],
  );
  return rows[0] ?? null;
}

export async function resolveCleanedLegacyLinkByEmail(
  email: string | null | undefined,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<CleanedLegacyEmailLinkResult> {
  const normalized = normalizeCustomerEmail(email);
  if (!normalized) {
    return { status: "none" };
  }

  const rows = await queryFn<WatsonCleanedLegacyCustomerRow>(
    WATSON_LEGACY_CUSTOMERS_BY_EMAIL_SQL,
    [normalized],
  );
  if (rows.length === 0) {
    return { status: "none" };
  }
  if (rows.length === 1) {
    return { status: "unique", legacyMemberid: rows[0].legacy_memberid };
  }
  return {
    status: "ambiguous",
    legacyMemberids: rows.map((row) => row.legacy_memberid),
  };
}

export async function getCleanedLegacyHistoryRows(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WatsonCleanedLegacyHistoryRow[]> {
  const normalized = memberid.trim();
  if (!normalized) {
    return [];
  }

  return queryFn<WatsonCleanedLegacyHistoryRow>(WATSON_LEGACY_HISTORY_BY_MEMBERID_SQL, [
    normalized,
  ]);
}

export async function loadCleanedLegacyHistoryByMemberid(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<WatsonCleanedLegacyHistoryView | null> {
  const normalized = memberid.trim();
  if (!normalized) {
    return null;
  }

  const [customer, rows] = await Promise.all([
    getCleanedLegacyCustomerByMemberid(normalized, queryFn),
    getCleanedLegacyHistoryRows(normalized, queryFn),
  ]);

  if (!customer && rows.length === 0) {
    return null;
  }

  const view = buildCleanedLegacyHistoryView({
    legacyMemberid: customer?.legacy_memberid ?? normalized,
    customerNotes: customer?.customer_notes ?? null,
    rows,
  });

  return hasVisibleCleanedLegacyHistory(view) ? view : null;
}

export async function loadCleanedLegacyHistoryForProfile(input: {
  profileType: "legacy" | "memberstack";
  routeLegacyMemberid?: string | null;
  memberstackEmail?: string | null;
  dumpLinkAmbiguous?: boolean;
  dumpLegacyMemberid?: string | null;
  queryFn?: WatsonQueryFn;
}): Promise<WatsonCleanedLegacyHistoryView | null> {
  const queryFn = input.queryFn ?? queryWatson;
  if (input.profileType === "memberstack" && input.dumpLinkAmbiguous) {
    return null;
  }

  const cleanedEmailLink =
    input.profileType === "memberstack"
      ? await resolveCleanedLegacyLinkByEmail(input.memberstackEmail, queryFn)
      : { status: "none" as const };

  const memberid = resolveCleanedLegacyHistoryMemberid({
    profileType: input.profileType,
    routeLegacyMemberid: input.routeLegacyMemberid,
    dumpLinkAmbiguous: input.dumpLinkAmbiguous,
    dumpLegacyMemberid: input.dumpLegacyMemberid,
    cleanedEmailLink,
  });

  if (!memberid) {
    return null;
  }

  return loadCleanedLegacyHistoryByMemberid(memberid, queryFn);
}
