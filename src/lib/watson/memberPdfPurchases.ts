import { hasDisplayValue } from "./memberDetail";
import {
  formatLegacyIntegerFlag,
  formatLegacyTimestampDisplay,
  formatLegacyTimestampSort,
} from "./memberMembership";
import { formatLegacyMoney } from "./memberOrders";
import { type WatsonQueryFn } from "./memberSearch";
import { queryWatson } from "./db";

export interface LegacyPatternLibraryPurchaseRow {
  pattern_library_purchases: string | number;
  transactionguid: string;
  dateadded: Date | string | null;
  memberid_fk: string;
  patternlibarry_id: string | number;
  vendorpaid: number | null;
  title: string | null;
  filename: string | null;
  patterntype: string | null;
  cost: string | number | null;
  netcost: string | number | null;
  active: number | null;
  freewithsubscription: number | null;
  transaction_total: string | number | null;
}

export interface MemberPdfPurchaseDisplay {
  purchaseRecordId: string;
  pdfTitle: string | null;
  patternLibraryId: string;
  purchaseDate: string | null;
  purchaseDateSort: string;
  transactionGuid: string;
  amountPaid: string | null;
  amountPaidSort: string;
  catalogCost: string | null;
  catalogCostSort: string;
  netCost: string | null;
  netCostSort: string;
  filename: string | null;
  patternType: string | null;
  vendorPaidFlag: string | null;
  patternActiveFlag: string | null;
  freeWithSubscriptionFlag: string | null;
}

export const MEMBER_PDF_PURCHASES_TABLE = "legacy_pattern_library_purchases";
export const MEMBER_PDF_PURCHASE_PATTERN_LIBRARY_TABLE = "legacy_pattern_library";
export const MEMBER_PDF_PURCHASE_STORE_TRANSACTIONS_TABLE = "legacy_store_transactions";

export const MEMBER_PDF_PURCHASES_SQL = `
  SELECT
    p.pattern_library_purchases,
    p.transactionguid,
    p.dateadded,
    p.memberid_fk,
    p.patternlibarry_id,
    p.vendorpaid,
    pl.title,
    pl.filename,
    pl.patterntype,
    pl.cost,
    pl.netcost,
    pl.active,
    pl.freewithsubscription,
    st.totalcost AS transaction_total
  FROM ${MEMBER_PDF_PURCHASES_TABLE} p
  LEFT JOIN ${MEMBER_PDF_PURCHASE_PATTERN_LIBRARY_TABLE} pl
    ON pl.patternlibarry_id = p.patternlibarry_id
  LEFT JOIN ${MEMBER_PDF_PURCHASE_STORE_TRANSACTIONS_TABLE} st
    ON st.transactionid = p.transactionguid
    AND st.memberid_fk = p.memberid_fk
  WHERE p.memberid_fk = $1
  ORDER BY p.dateadded DESC NULLS LAST, p.pattern_library_purchases DESC
`;

export const MEMBER_PDF_PURCHASE_COUNT_SQL = `
  SELECT COUNT(*)::text AS purchase_count
  FROM ${MEMBER_PDF_PURCHASES_TABLE}
  WHERE memberid_fk = $1
`;

export const MEMBER_PDF_PURCHASE_SORTABLE_COLUMNS = [
  "purchaseRecordId",
  "pdfTitle",
  "patternLibraryId",
  "purchaseDate",
  "transactionGuid",
  "amountPaid",
  "catalogCost",
  "netCost",
  "filename",
  "patternType",
  "vendorPaidFlag",
  "patternActiveFlag",
  "freeWithSubscriptionFlag",
] as const;

function trimLegacyText(value: string | null | undefined): string | null {
  if (!hasDisplayValue(value)) {
    return null;
  }
  return String(value).trim();
}

export function buildPdfPurchaseDisplay(row: LegacyPatternLibraryPurchaseRow): MemberPdfPurchaseDisplay {
  const amountPaid = formatLegacyMoney(row.transaction_total);
  const catalogCost = formatLegacyMoney(row.cost);
  const netCost = formatLegacyMoney(row.netcost);

  return {
    purchaseRecordId: String(row.pattern_library_purchases),
    pdfTitle: trimLegacyText(row.title),
    patternLibraryId: String(row.patternlibarry_id),
    purchaseDate: formatLegacyTimestampDisplay(row.dateadded),
    purchaseDateSort: formatLegacyTimestampSort(row.dateadded),
    transactionGuid: row.transactionguid.trim(),
    amountPaid,
    amountPaidSort: row.transaction_total != null ? String(row.transaction_total) : "",
    catalogCost,
    catalogCostSort: row.cost != null ? String(row.cost) : "",
    netCost,
    netCostSort: row.netcost != null ? String(row.netcost) : "",
    filename: trimLegacyText(row.filename),
    patternType: trimLegacyText(row.patterntype),
    vendorPaidFlag: formatLegacyIntegerFlag(row.vendorpaid),
    patternActiveFlag: formatLegacyIntegerFlag(row.active),
    freeWithSubscriptionFlag: formatLegacyIntegerFlag(row.freewithsubscription),
  };
}

export function getVisiblePdfPurchaseColumns(records: MemberPdfPurchaseDisplay[]): {
  showPdfTitle: boolean;
  showPurchaseDate: boolean;
  showAmountPaid: boolean;
  showCatalogCost: boolean;
  showNetCost: boolean;
  showFilename: boolean;
  showPatternType: boolean;
  showVendorPaidFlag: boolean;
  showPatternActiveFlag: boolean;
  showFreeWithSubscriptionFlag: boolean;
} {
  const hasValue = (getter: (record: MemberPdfPurchaseDisplay) => string | null) =>
    records.some((record) => getter(record) != null);

  return {
    showPdfTitle: hasValue((record) => record.pdfTitle),
    showPurchaseDate: hasValue((record) => record.purchaseDate),
    showAmountPaid: hasValue((record) => record.amountPaid),
    showCatalogCost: hasValue((record) => record.catalogCost),
    showNetCost: hasValue((record) => record.netCost),
    showFilename: hasValue((record) => record.filename),
    showPatternType: hasValue((record) => record.patternType),
    showVendorPaidFlag: hasValue((record) => record.vendorPaidFlag),
    showPatternActiveFlag: hasValue((record) => record.patternActiveFlag),
    showFreeWithSubscriptionFlag: hasValue((record) => record.freeWithSubscriptionFlag),
  };
}

export async function getMemberPdfPurchaseCount(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<number> {
  const normalized = memberid.trim();
  if (!normalized) {
    return 0;
  }

  const rows = await queryFn<{ purchase_count: string }>(MEMBER_PDF_PURCHASE_COUNT_SQL, [
    normalized,
  ]);
  const count = Number.parseInt(rows[0]?.purchase_count ?? "0", 10);
  return Number.isNaN(count) ? 0 : count;
}

export async function getMemberPdfPurchases(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<MemberPdfPurchaseDisplay[]> {
  const normalized = memberid.trim();
  if (!normalized) {
    return [];
  }

  const rows = await queryFn<LegacyPatternLibraryPurchaseRow>(MEMBER_PDF_PURCHASES_SQL, [
    normalized,
  ]);
  return rows.map(buildPdfPurchaseDisplay);
}
