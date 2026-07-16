import {
  buildBaseMemberFields,
  isBlankSubscriptionType,
  isMonthlyAmount,
  loadCurrentLegacyMemberRows,
  type CurrentLegacyMemberQueryRow,
} from "./legacyMembershipReportsShared";
import { type WatsonQueryFn } from "./memberSearch";
import { queryWatson } from "./db";

export type CurrentLegacyMemberException =
  | "missing_type"
  | "missing_rate"
  | "missing_processor"
  | "date_conflict"
  | "expiration_after_2030"
  | "staff_or_test"
  | "suspicious_amount"
  | "duplicate_subscription_rows";

export interface CurrentLegacyMemberRow {
  memberid: string;
  name: string;
  email: string | null;
  profileHref: string;
  subscriptionTypeDisplay: string;
  subscriptionTypeRaw: string | null;
  memberExpirationDisplay: string | null;
  memberExpirationSort: string;
  daysRemaining: number | null;
  monthlysubscriberDisplay: string;
  subscriptionrenewalDisplay: string;
  currentsubscriberDisplay: string;
  monthlysubscriber: number | null;
  stripeCustomerId: string | null;
  latestAmountDisplay: string | null;
  latestAmount: number | null;
  latestProcessorDisplay: string;
  latestRateId: string | null;
  latestExpirationDisplay: string | null;
  latestExpirationSort: string;
  exceptions: CurrentLegacyMemberException[];
  exceptionLabels: string[];
  exceptionsDisplay: string;
}

export interface CurrentLegacyMembersSummary {
  totalMembers: number;
  bySubscriptionType: Array<{ type: string; count: number }>;
  expiring30: number;
  expiring60: number;
  expiring90: number;
  monthlyCount: number;
  nonMonthlyCount: number;
  withStripeCustomerId: number;
  withoutStripeCustomerId: number;
}

export interface CurrentLegacyMembersReport {
  asOfDateDisplay: string;
  rows: CurrentLegacyMemberRow[];
  summary: CurrentLegacyMembersSummary;
  note: string;
}

const EXCEPTION_LABELS: Record<CurrentLegacyMemberException, string> = {
  missing_type: "Missing type",
  missing_rate: "Missing rate",
  missing_processor: "Missing processor",
  date_conflict: "Member vs latest sub expiration differ",
  expiration_after_2030: "Expiration after 2030",
  staff_or_test: "Likely staff/test",
  suspicious_amount: "Suspicious amount",
  duplicate_subscription_rows: "Multiple subscription rows",
};

export function collectCurrentMemberExceptions(
  base: ReturnType<typeof buildBaseMemberFields>,
): CurrentLegacyMemberException[] {
  const exceptions: CurrentLegacyMemberException[] = [];
  if (isBlankSubscriptionType(base.subscriptionTypeRaw)) {
    exceptions.push("missing_type");
  }
  if (!base.latestRateId) {
    exceptions.push("missing_rate");
  }
  if (!base.latestProcessorRaw && base.latestProcessorDisplay === "Unknown") {
    exceptions.push("missing_processor");
  }
  if (base.datesConflict) {
    exceptions.push("date_conflict");
  }
  if (base.expirationAfter2030) {
    exceptions.push("expiration_after_2030");
  }
  if (base.isStaffOrTest) {
    exceptions.push("staff_or_test");
  }
  if (
    base.latestAmount != null &&
    (base.latestAmount <= 1 ||
      (base.latestAmount > 1 &&
        base.latestAmount < 9 &&
        !isMonthlyAmount(base.latestAmount)))
  ) {
    exceptions.push("suspicious_amount");
  }
  if (base.subscriptionRowCount > 1) {
    exceptions.push("duplicate_subscription_rows");
  }
  return exceptions;
}

export function buildCurrentLegacyMemberRow(
  queryRow: CurrentLegacyMemberQueryRow,
): CurrentLegacyMemberRow {
  const base = buildBaseMemberFields(queryRow);
  const exceptions = collectCurrentMemberExceptions(base);
  const exceptionLabels = exceptions.map((key) => EXCEPTION_LABELS[key]);

  return {
    memberid: base.memberid,
    name: base.name,
    email: base.email,
    profileHref: base.profileHref,
    subscriptionTypeDisplay: base.subscriptionTypeDisplay,
    subscriptionTypeRaw: base.subscriptionTypeRaw,
    memberExpirationDisplay: base.memberExpirationDisplay,
    memberExpirationSort: base.memberExpirationSort,
    daysRemaining: base.daysRemaining,
    monthlysubscriberDisplay: base.monthlysubscriberDisplay,
    subscriptionrenewalDisplay: base.subscriptionrenewalDisplay,
    currentsubscriberDisplay: base.currentsubscriberDisplay,
    monthlysubscriber: base.monthlysubscriber,
    stripeCustomerId: base.stripeCustomerId,
    latestAmountDisplay: base.latestAmountDisplay,
    latestAmount: base.latestAmount,
    latestProcessorDisplay: base.latestProcessorDisplay,
    latestRateId: base.latestRateId,
    latestExpirationDisplay: base.latestExpirationDisplay,
    latestExpirationSort: base.latestExpirationSort,
    exceptions,
    exceptionLabels,
    exceptionsDisplay: exceptionLabels.join("; "),
  };
}

export function buildCurrentLegacyMembersSummary(
  rows: CurrentLegacyMemberRow[],
): CurrentLegacyMembersSummary {
  const typeCounts = new Map<string, number>();
  for (const row of rows) {
    const key = row.subscriptionTypeDisplay;
    typeCounts.set(key, (typeCounts.get(key) ?? 0) + 1);
  }

  const bySubscriptionType = [...typeCounts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  return {
    totalMembers: rows.length,
    bySubscriptionType,
    expiring30: rows.filter((row) => row.daysRemaining != null && row.daysRemaining <= 30).length,
    expiring60: rows.filter((row) => row.daysRemaining != null && row.daysRemaining <= 60).length,
    expiring90: rows.filter((row) => row.daysRemaining != null && row.daysRemaining <= 90).length,
    monthlyCount: rows.filter((row) => row.monthlysubscriber === 1).length,
    nonMonthlyCount: rows.filter((row) => row.monthlysubscriber !== 1).length,
    withStripeCustomerId: rows.filter((row) => row.stripeCustomerId).length,
    withoutStripeCustomerId: rows.filter((row) => !row.stripeCustomerId).length,
  };
}

export function buildCurrentLegacyMembersReport(
  queryRows: CurrentLegacyMemberQueryRow[],
  asOf: Date = new Date(),
): CurrentLegacyMembersReport {
  const rows = queryRows.map(buildCurrentLegacyMemberRow);
  return {
    asOfDateDisplay: asOf.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    rows,
    summary: buildCurrentLegacyMembersSummary(rows),
    note:
      "This report reflects current-state fields used by the legacy application (betaactive = 0 and subscriptionexpiring >= today). It is historical import data and is not claimed to be perfectly accurate. Latest subscription columns are enrichment from legacy_subscriptions and are not what the legacy active-member screen used for status.",
  };
}

export async function loadCurrentLegacyMembersReport(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<CurrentLegacyMembersReport> {
  const queryRows = await loadCurrentLegacyMemberRows(queryFn);
  return buildCurrentLegacyMembersReport(queryRows);
}

export const CURRENT_LEGACY_MEMBERS_CSV_HEADERS = [
  "Name",
  "Email",
  "Legacy member ID",
  "Subscription type",
  "Membership expiration date",
  "Days remaining",
  "monthlysubscriber",
  "subscriptionrenewal",
  "currentsubscriber",
  "Legacy Stripe customer ID",
  "Latest subscription amount",
  "Latest subscription processor",
  "Latest subscription rate ID",
  "Latest subscription expiration",
  "Exceptions",
] as const;

export function currentLegacyMemberRowToCsvCells(row: CurrentLegacyMemberRow): string[] {
  return [
    row.name,
    row.email ?? "",
    row.memberid,
    row.subscriptionTypeDisplay,
    row.memberExpirationDisplay ?? "",
    row.daysRemaining == null ? "" : String(row.daysRemaining),
    row.monthlysubscriberDisplay,
    row.subscriptionrenewalDisplay,
    row.currentsubscriberDisplay,
    row.stripeCustomerId ?? "",
    row.latestAmountDisplay ?? "",
    row.latestProcessorDisplay,
    row.latestRateId ?? "",
    row.latestExpirationDisplay ?? "",
    row.exceptionsDisplay,
  ];
}
