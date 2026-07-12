import { hasDisplayValue } from "./memberDetail";
import { formatMemberJoinedDateDisplay, type WatsonQueryFn } from "./memberSearch";
import { formatLegacyMoney } from "./memberOrders";
import { queryWatson } from "./db";

export interface LegacySubscriptionRow {
  subscriptionid: string | number;
  memberid_fk: string;
  datebought: Date | string | null;
  expirationdate: Date | string | null;
  transactionguid_fk: string | null;
  dollaramount: string | number | null;
  renewal: number | null;
  monthlybilling: number | null;
  cancelled: number | null;
  canceldate: Date | string | null;
  premium: number | null;
  processor: string | null;
  subscriptionrate_id: string | null;
  arb_id: string | null;
  abr_inovicenumber: string | null;
}

export interface MemberMembershipDisplay {
  subscriptionId: string;
  subscriptionRateId: string | null;
  startDate: string | null;
  startDateSort: string;
  expirationDate: string | null;
  expirationDateSort: string;
  cancelDate: string | null;
  cancelDateSort: string;
  cancelledFlag: string | null;
  amount: string | null;
  amountSort: string;
  renewalFlag: string | null;
  monthlyBillingFlag: string | null;
  premiumFlag: string | null;
  processor: string | null;
  transactionGuid: string | null;
  arbId: string | null;
  invoiceNumber: string | null;
}

export const MEMBER_MEMBERSHIP_TABLE = "legacy_subscriptions";

export const MEMBER_MEMBERSHIPS_SQL = `
  SELECT
    subscriptionid,
    memberid_fk,
    datebought,
    expirationdate,
    transactionguid_fk,
    dollaramount,
    renewal,
    monthlybilling,
    cancelled,
    canceldate,
    premium,
    processor,
    subscriptionrate_id,
    arb_id,
    abr_inovicenumber
  FROM ${MEMBER_MEMBERSHIP_TABLE}
  WHERE memberid_fk = $1
  ORDER BY datebought DESC NULLS LAST, subscriptionid DESC
`;

export const MEMBER_MEMBERSHIP_COUNT_SQL = `
  SELECT COUNT(*)::text AS subscription_count
  FROM ${MEMBER_MEMBERSHIP_TABLE}
  WHERE memberid_fk = $1
`;

export const MEMBER_MEMBERSHIP_SORTABLE_COLUMNS = [
  "subscriptionId",
  "subscriptionRateId",
  "startDate",
  "expirationDate",
  "cancelDate",
  "cancelledFlag",
  "amount",
  "renewalFlag",
  "monthlyBillingFlag",
  "premiumFlag",
  "processor",
  "transactionGuid",
  "arbId",
  "invoiceNumber",
] as const;

export function formatLegacyTimestampSort(value: Date | string | null | undefined): string {
  if (value == null || value === "") {
    return "";
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
}

export function formatLegacyTimestampDisplay(
  value: Date | string | null | undefined,
): string | null {
  if (value == null || value === "") {
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return formatMemberJoinedDateDisplay(date);
}

export function formatLegacyIntegerFlag(value: number | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  return String(value);
}

export function buildMembershipDisplay(row: LegacySubscriptionRow): MemberMembershipDisplay {
  const amount = formatLegacyMoney(row.dollaramount);

  return {
    subscriptionId: String(row.subscriptionid),
    subscriptionRateId: hasDisplayValue(row.subscriptionrate_id)
      ? String(row.subscriptionrate_id).trim()
      : null,
    startDate: formatLegacyTimestampDisplay(row.datebought),
    startDateSort: formatLegacyTimestampSort(row.datebought),
    expirationDate: formatLegacyTimestampDisplay(row.expirationdate),
    expirationDateSort: formatLegacyTimestampSort(row.expirationdate),
    cancelDate: formatLegacyTimestampDisplay(row.canceldate),
    cancelDateSort: formatLegacyTimestampSort(row.canceldate),
    cancelledFlag: formatLegacyIntegerFlag(row.cancelled),
    amount,
    amountSort: row.dollaramount != null ? String(row.dollaramount) : "",
    renewalFlag: formatLegacyIntegerFlag(row.renewal),
    monthlyBillingFlag: formatLegacyIntegerFlag(row.monthlybilling),
    premiumFlag: formatLegacyIntegerFlag(row.premium),
    processor: hasDisplayValue(row.processor) ? String(row.processor).trim() : null,
    transactionGuid: hasDisplayValue(row.transactionguid_fk)
      ? String(row.transactionguid_fk).trim()
      : null,
    arbId: hasDisplayValue(row.arb_id) ? String(row.arb_id).trim() : null,
    invoiceNumber: hasDisplayValue(row.abr_inovicenumber)
      ? String(row.abr_inovicenumber).trim()
      : null,
  };
}

export function getVisibleMembershipColumns(records: MemberMembershipDisplay[]): {
  showSubscriptionRateId: boolean;
  showStartDate: boolean;
  showExpirationDate: boolean;
  showCancelDate: boolean;
  showCancelledFlag: boolean;
  showAmount: boolean;
  showRenewalFlag: boolean;
  showMonthlyBillingFlag: boolean;
  showPremiumFlag: boolean;
  showProcessor: boolean;
  showTransactionGuid: boolean;
  showArbId: boolean;
  showInvoiceNumber: boolean;
} {
  return {
    showSubscriptionRateId: records.some((record) => record.subscriptionRateId != null),
    showStartDate: records.some((record) => record.startDate != null),
    showExpirationDate: records.some((record) => record.expirationDate != null),
    showCancelDate: records.some((record) => record.cancelDate != null),
    showCancelledFlag: records.some((record) => record.cancelledFlag != null),
    showAmount: records.some((record) => record.amount != null),
    showRenewalFlag: records.some((record) => record.renewalFlag != null),
    showMonthlyBillingFlag: records.some((record) => record.monthlyBillingFlag != null),
    showPremiumFlag: records.some((record) => record.premiumFlag != null),
    showProcessor: records.some((record) => record.processor != null),
    showTransactionGuid: records.some((record) => record.transactionGuid != null),
    showArbId: records.some((record) => record.arbId != null),
    showInvoiceNumber: records.some((record) => record.invoiceNumber != null),
  };
}

export async function getMemberMembershipCount(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<number> {
  const normalized = memberid.trim();
  if (!normalized) {
    return 0;
  }

  const rows = await queryFn<{ subscription_count: string }>(MEMBER_MEMBERSHIP_COUNT_SQL, [
    normalized,
  ]);
  const count = Number.parseInt(rows[0]?.subscription_count ?? "0", 10);
  return Number.isNaN(count) ? 0 : count;
}

export async function getMemberMemberships(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<MemberMembershipDisplay[]> {
  const normalized = memberid.trim();
  if (!normalized) {
    return [];
  }

  const rows = await queryFn<LegacySubscriptionRow>(MEMBER_MEMBERSHIPS_SQL, [normalized]);
  return rows.map(buildMembershipDisplay);
}
