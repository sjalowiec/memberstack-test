import { buildLegacyCustomerProfileUrl } from "./customerIdentifier";
import { formatLegacyMoney, parseLegacyMoneyAmount } from "./memberOrders";
import {
  formatLegacyTimestampDisplay,
  formatLegacyTimestampSort,
} from "./memberMembership";
import { formatMemberDisplayName, type WatsonQueryFn } from "./memberSearch";
import { queryWatson } from "./db";

/**
 * Matthew / Sub_details_list.cfm current-member universe filter.
 * Alias the members table as `m` when embedding this fragment.
 */
export const CURRENT_LEGACY_MEMBER_WHERE_SQL = `
  COALESCE(m.betaactive, 0) = 0
  AND m.subscriptionexpiring IS NOT NULL
  AND m.subscriptionexpiring::date >= CURRENT_DATE
`;

/** Matthew / Sub_details_list.cfm current-member universe. */
export const CURRENT_LEGACY_MEMBERS_SQL = `
  WITH current_members AS (
    SELECT
      m.memberid,
      m.fristname,
      m.lastname,
      m.email,
      m.subscriptiontype,
      m.subscriptiondate,
      m.subscriptionexpiring,
      m.monthlysubscriber,
      m.subscriptionrenewal,
      m.currentsubscriber,
      m.stripcustomerid
    FROM legacy_members m
    WHERE ${CURRENT_LEGACY_MEMBER_WHERE_SQL.trim()}
  ),
  latest_sub AS (
    SELECT DISTINCT ON (s.memberid_fk)
      s.memberid_fk,
      s.subscriptionid,
      s.dollaramount,
      s.processor,
      s.subscriptionrate_id,
      s.monthlybilling,
      s.expirationdate,
      s.datebought,
      s.premium,
      s.arb_id
    FROM legacy_subscriptions s
    INNER JOIN current_members cm ON cm.memberid = s.memberid_fk
    ORDER BY s.memberid_fk, s.datebought DESC NULLS LAST, s.subscriptionid DESC
  ),
  sub_counts AS (
    SELECT
      s.memberid_fk,
      COUNT(*)::int AS subscription_row_count,
      COUNT(*) FILTER (
        WHERE COALESCE(s.monthlybilling, 0) = 0
      )::int AS non_monthly_subscription_row_count
    FROM legacy_subscriptions s
    INNER JOIN current_members cm ON cm.memberid = s.memberid_fk
    GROUP BY s.memberid_fk
  )
  SELECT
    cm.memberid,
    cm.fristname,
    cm.lastname,
    cm.email,
    cm.subscriptiontype,
    cm.subscriptiondate,
    cm.subscriptionexpiring,
    (cm.subscriptionexpiring::date - CURRENT_DATE)::int AS days_remaining,
    cm.monthlysubscriber,
    cm.subscriptionrenewal,
    cm.currentsubscriber,
    cm.stripcustomerid,
    ls.subscriptionid AS latest_subscriptionid,
    ls.dollaramount AS latest_amount,
    ls.processor AS latest_processor,
    ls.subscriptionrate_id AS latest_rate_id,
    ls.monthlybilling AS latest_monthlybilling,
    ls.expirationdate AS latest_expirationdate,
    ls.datebought AS latest_datebought,
    ls.premium AS latest_premium,
    ls.arb_id AS latest_arb_id,
    COALESCE(sc.subscription_row_count, 0) AS subscription_row_count,
    COALESCE(sc.non_monthly_subscription_row_count, 0) AS non_monthly_subscription_row_count
  FROM current_members cm
  LEFT JOIN latest_sub ls ON ls.memberid_fk = cm.memberid
  LEFT JOIN sub_counts sc ON sc.memberid_fk = cm.memberid
  ORDER BY cm.subscriptionexpiring ASC NULLS LAST, cm.lastname ASC NULLS LAST, cm.fristname ASC NULLS LAST, cm.memberid ASC
`;

export const BLANK_SUBSCRIPTION_TYPE_LABEL = "Membership, legacy type blank";

export const KNOWN_ANNUAL_RATE_IDS = new Set([
  "A1C5572D-E311-D637-AE12-EDE03F978083",
  "A3B982C4-C38B-ADBE-976E-74BF7E206134",
  "7BE384D6-AA24-CCDD-CC5E-D0A919B4CF9F",
  "0ED57103-BCD1-7507-6767-390B9C08623E",
  "BDDAAA7D-E693-879A-A58A-41A3767B112C",
  "8EC1301D-5056-A02D-DF5E-999D3DEF52CA",
  "1B4A9622-036C-3F12-F565-1B9ED5BC4F06",
]);

export const KNOWN_INSTALLMENT_RATE_IDS = new Set([
  "A384521E-9BD0-4085-DD12-775999B33BCE",
  "A3D7A352-B4E9-1F52-111B-8ED722C66FBE",
  "0EE3EA0F-C3F2-FA48-1101-577D4BCAD7EB",
]);

export const CORE_ANNUAL_AMOUNTS = new Set([129, 144, 199, 228]);
export const PROBABLE_ANNUAL_AMOUNTS = new Set([105, 129, 135, 144, 150, 199, 228, 240]);
export const INSTALLMENT_AMOUNTS = new Set([45, 50, 80]);
export const MONTHLY_AMOUNTS = new Set([9.99, 13.99, 15.99, 19.99]);

export interface CurrentLegacyMemberQueryRow {
  memberid: string;
  fristname: string | null;
  lastname: string | null;
  email: string | null;
  subscriptiontype: string | null;
  subscriptiondate: Date | string | null;
  subscriptionexpiring: Date | string | null;
  days_remaining: number | string | null;
  monthlysubscriber: number | null;
  subscriptionrenewal: number | null;
  currentsubscriber: number | null;
  stripcustomerid: string | null;
  latest_subscriptionid: string | number | null;
  latest_amount: string | number | null;
  latest_processor: string | null;
  latest_rate_id: string | null;
  latest_monthlybilling: number | null;
  latest_expirationdate: Date | string | null;
  latest_datebought: Date | string | null;
  latest_premium: number | null;
  latest_arb_id: string | null;
  subscription_row_count: number | string | null;
  non_monthly_subscription_row_count: number | string | null;
}

export function isBlankSubscriptionType(value: string | null | undefined): boolean {
  return value == null || String(value).trim() === "";
}

export function displaySubscriptionType(value: string | null | undefined): string {
  if (isBlankSubscriptionType(value)) {
    return BLANK_SUBSCRIPTION_TYPE_LABEL;
  }
  return String(value).trim();
}

export function parseDaysRemaining(value: number | string | null | undefined): number | null {
  if (value == null || value === "") {
    return null;
  }
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
}

export function parseCount(value: number | string | null | undefined): number {
  if (value == null || value === "") {
    return 0;
  }
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isNaN(n) ? 0 : n;
}

export function toDateOnlyIso(value: Date | string | null | undefined): string | null {
  if (value == null || value === "") {
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

export function datesDifferOnCalendarDay(
  left: Date | string | null | undefined,
  right: Date | string | null | undefined,
): boolean {
  const a = toDateOnlyIso(left);
  const b = toDateOnlyIso(right);
  return Boolean(a && b && a !== b);
}

export function isStaffOrTestEmail(email: string | null | undefined): boolean {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized.endsWith("@knititnow.com") ||
    normalized === "matt@hozgroup.com" ||
    normalized === "hostek@hozgroup.com" ||
    normalized.includes("membership.io")
  );
}

export function isMonthlyAmount(amount: number | null): boolean {
  if (amount == null) {
    return false;
  }
  return MONTHLY_AMOUNTS.has(Number(amount.toFixed(2))) || MONTHLY_AMOUNTS.has(amount);
}

export function normalizeAmount(value: string | number | null | undefined): number | null {
  return parseLegacyMoneyAmount(value);
}

export function inferProcessorDisplay(
  processor: string | null | undefined,
  arbId: string | null | undefined,
): { label: string; inferred: boolean } {
  const raw = processor?.trim() ?? "";
  if (raw) {
    const lower = raw.toLowerCase();
    if (lower === "stripe") {
      return { label: "Stripe", inferred: false };
    }
    if (lower === "paypal") {
      return { label: "PayPal", inferred: false };
    }
    if (lower === "payment request") {
      return { label: "Payment Request", inferred: false };
    }
    return { label: raw, inferred: false };
  }
  const arb = arbId?.trim() ?? "";
  if (arb.startsWith("sub_")) {
    return { label: "Stripe", inferred: true };
  }
  if (arb && /^\d+$/.test(arb)) {
    return { label: "Authorize.net", inferred: true };
  }
  return { label: "Unknown", inferred: false };
}

export function memberDurationDays(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): number | null {
  if (start == null || end == null || start === "" || end === "") {
    return null;
  }
  const a = start instanceof Date ? start : new Date(String(start));
  const b = end instanceof Date ? end : new Date(String(end));
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    return null;
  }
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function expirationAfter2030(value: Date | string | null | undefined): boolean {
  const iso = toDateOnlyIso(value);
  return Boolean(iso && iso >= "2030-01-01");
}

export function formatFlag(value: number | null | undefined): string {
  if (value == null) {
    return "";
  }
  return String(value);
}

export function buildBaseMemberFields(row: CurrentLegacyMemberQueryRow) {
  const name = formatMemberDisplayName(row) || row.memberid;
  const amount = normalizeAmount(row.latest_amount);
  const processorInfo = inferProcessorDisplay(row.latest_processor, row.latest_arb_id);
  const daysRemaining = parseDaysRemaining(row.days_remaining);

  return {
    memberid: row.memberid,
    name,
    email: row.email?.trim() || null,
    profileHref: buildLegacyCustomerProfileUrl(row.memberid),
    subscriptionTypeRaw: isBlankSubscriptionType(row.subscriptiontype)
      ? null
      : String(row.subscriptiontype).trim(),
    subscriptionTypeDisplay: displaySubscriptionType(row.subscriptiontype),
    subscriptionDateDisplay: formatLegacyTimestampDisplay(row.subscriptiondate),
    subscriptionDateSort: formatLegacyTimestampSort(row.subscriptiondate),
    memberExpirationDisplay: formatLegacyTimestampDisplay(row.subscriptionexpiring),
    memberExpirationSort: formatLegacyTimestampSort(row.subscriptionexpiring),
    memberExpirationIso: toDateOnlyIso(row.subscriptionexpiring),
    daysRemaining,
    monthlysubscriber: row.monthlysubscriber,
    subscriptionrenewal: row.subscriptionrenewal,
    currentsubscriber: row.currentsubscriber,
    monthlysubscriberDisplay: formatFlag(row.monthlysubscriber),
    subscriptionrenewalDisplay: formatFlag(row.subscriptionrenewal),
    currentsubscriberDisplay: formatFlag(row.currentsubscriber),
    stripeCustomerId:
      row.stripcustomerid && String(row.stripcustomerid).trim()
        ? String(row.stripcustomerid).trim()
        : null,
    latestAmount: amount,
    latestAmountDisplay: formatLegacyMoney(row.latest_amount),
    latestProcessorRaw: row.latest_processor?.trim() || null,
    latestProcessorDisplay: processorInfo.label,
    latestProcessorInferred: processorInfo.inferred,
    latestRateId: row.latest_rate_id?.trim() || null,
    latestMonthlyBilling: row.latest_monthlybilling,
    latestExpirationDisplay: formatLegacyTimestampDisplay(row.latest_expirationdate),
    latestExpirationSort: formatLegacyTimestampSort(row.latest_expirationdate),
    latestExpirationIso: toDateOnlyIso(row.latest_expirationdate),
    latestDateBoughtIso: toDateOnlyIso(row.latest_datebought),
    latestPremium: row.latest_premium,
    latestArbId: row.latest_arb_id?.trim() || null,
    subscriptionRowCount: parseCount(row.subscription_row_count),
    nonMonthlySubscriptionRowCount: parseCount(row.non_monthly_subscription_row_count),
    memberDurationDays: memberDurationDays(row.subscriptiondate, row.subscriptionexpiring),
    isStaffOrTest: isStaffOrTestEmail(row.email),
    datesConflict: datesDifferOnCalendarDay(row.subscriptionexpiring, row.latest_expirationdate),
    expirationAfter2030: expirationAfter2030(row.subscriptionexpiring),
  };
}

export async function loadCurrentLegacyMemberRows(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<CurrentLegacyMemberQueryRow[]> {
  return queryFn<CurrentLegacyMemberQueryRow>(CURRENT_LEGACY_MEMBERS_SQL);
}

export function escapeCsvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function rowsToCsv(headers: string[], rows: string[][]): string {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];
  return `${lines.join("\r\n")}\r\n`;
}
