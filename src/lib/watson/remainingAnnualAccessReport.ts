import {
  buildBaseMemberFields,
  CORE_ANNUAL_AMOUNTS,
  INSTALLMENT_AMOUNTS,
  isBlankSubscriptionType,
  isMonthlyAmount,
  KNOWN_ANNUAL_RATE_IDS,
  KNOWN_INSTALLMENT_RATE_IDS,
  loadCurrentLegacyMemberRows,
  PROBABLE_ANNUAL_AMOUNTS,
  type CurrentLegacyMemberQueryRow,
} from "./legacyMembershipReportsShared";
import { type WatsonQueryFn } from "./memberSearch";
import { queryWatson } from "./db";

export type AnnualAccessClassification =
  | "confirmed_annual_single"
  | "probable_annual_single"
  | "annual_installment"
  | "manual_complimentary"
  | "unresolved_non_monthly";

export type AnnualAccessConfidence = "Confirmed" | "Probable" | "Unresolved";

export type AnnualAccessException =
  | "date_conflict"
  | "missing_type"
  | "missing_rate"
  | "missing_processor"
  | "duplicate_subscription_rows"
  | "suspicious_amount"
  | "expiration_after_2030"
  | "staff_or_test"
  | "requires_manual_migration";

export interface RemainingAnnualAccessRow {
  memberid: string;
  name: string;
  email: string | null;
  profileHref: string;
  subscriptionTypeDisplay: string;
  classification: AnnualAccessClassification;
  classificationLabel: string;
  confidence: AnnualAccessConfidence;
  memberExpirationDisplay: string | null;
  memberExpirationSort: string;
  daysRemaining: number | null;
  latestExpirationDisplay: string | null;
  latestExpirationSort: string;
  latestAmountDisplay: string | null;
  latestAmount: number | null;
  latestRateId: string | null;
  processorDisplay: string;
  stripeCustomerId: string | null;
  relevantSubscriptionRowCount: number;
  exceptions: AnnualAccessException[];
  exceptionLabels: string[];
  exceptionsDisplay: string;
  requiresManualMigration: boolean;
  paidThroughDisplay: string | null;
}

export interface RemainingAnnualAccessSummary {
  confirmedAnnualSingle: number;
  probableAnnualSingle: number;
  annualInstallment: number;
  manualComplimentary: number;
  unresolvedNonMonthly: number;
  expiring30: number;
  expiring60: number;
  expiring90: number;
  totalRows: number;
}

export interface RemainingAnnualAccessReport {
  asOfDateDisplay: string;
  rows: RemainingAnnualAccessRow[];
  summary: RemainingAnnualAccessSummary;
  note: string;
}

const CLASSIFICATION_LABELS: Record<AnnualAccessClassification, string> = {
  confirmed_annual_single: "Confirmed annual, single payment",
  probable_annual_single: "Probable annual, single payment",
  annual_installment: "Annual access, installment plan",
  manual_complimentary: "Manual or complimentary access",
  unresolved_non_monthly: "Unresolved non-monthly",
};

const EXCEPTION_LABELS: Record<AnnualAccessException, string> = {
  date_conflict: "Member vs latest sub expiration differ",
  missing_type: "Missing type",
  missing_rate: "Missing rate",
  missing_processor: "Missing processor",
  duplicate_subscription_rows: "Multiple relevant subscription rows",
  suspicious_amount: "Suspicious amount",
  expiration_after_2030: "Expiration after 2030",
  staff_or_test: "Likely staff/test",
  requires_manual_migration: "Migration may require manual handling",
};

const INSTALLMENT_TYPES = new Set([
  "Basic Membership  - Three Payments",
  "Three Payment Premium",
]);

const MANUAL_TYPES = new Set(["Free", "Trial Upgrade To Basic Member"]);

function confidenceFor(
  classification: AnnualAccessClassification,
): AnnualAccessConfidence {
  if (classification === "confirmed_annual_single") {
    return "Confirmed";
  }
  if (
    classification === "probable_annual_single" ||
    classification === "annual_installment"
  ) {
    return "Probable";
  }
  return "Unresolved";
}

export function isObviousMonthlyMember(
  base: ReturnType<typeof buildBaseMemberFields>,
): boolean {
  if (base.monthlysubscriber === 1) {
    return true;
  }
  if (base.latestMonthlyBilling === 1) {
    return true;
  }
  if (isMonthlyAmount(base.latestAmount)) {
    return true;
  }
  return false;
}

export function isManualOrComplimentary(
  base: ReturnType<typeof buildBaseMemberFields>,
): boolean {
  const type = base.subscriptionTypeRaw ?? "";
  if (MANUAL_TYPES.has(type) || type.toLowerCase().includes("trial")) {
    return true;
  }
  if (base.latestProcessorRaw?.toLowerCase() === "payment request") {
    return true;
  }
  if (base.latestAmount != null && base.latestAmount <= 1) {
    return true;
  }
  if (base.isStaffOrTest) {
    return true;
  }
  if (base.expirationAfter2030) {
    return true;
  }
  return false;
}

export function isConfirmedAnnualSingle(
  base: ReturnType<typeof buildBaseMemberFields>,
): boolean {
  if (base.latestMonthlyBilling === 1) {
    return false;
  }
  if (!base.latestRateId || !KNOWN_ANNUAL_RATE_IDS.has(base.latestRateId)) {
    return false;
  }
  if (base.latestAmount == null || !CORE_ANNUAL_AMOUNTS.has(base.latestAmount)) {
    return false;
  }
  return true;
}

export function isInstallmentAnnual(
  base: ReturnType<typeof buildBaseMemberFields>,
): boolean {
  const type = base.subscriptionTypeRaw ?? "";
  if (INSTALLMENT_TYPES.has(type)) {
    return true;
  }
  if (base.latestRateId && KNOWN_INSTALLMENT_RATE_IDS.has(base.latestRateId)) {
    return true;
  }
  if (base.latestAmount != null && INSTALLMENT_AMOUNTS.has(base.latestAmount)) {
    return true;
  }
  return false;
}

export function isProbableAnnualSingle(
  base: ReturnType<typeof buildBaseMemberFields>,
): boolean {
  if (base.monthlysubscriber === 1 || base.latestMonthlyBilling === 1) {
    return false;
  }
  const amountLooksAnnual =
    base.latestAmount != null && PROBABLE_ANNUAL_AMOUNTS.has(base.latestAmount);
  const duration = base.memberDurationDays;
  const durationLooksAnnual = duration != null && duration >= 300 && duration <= 450;
  if (!amountLooksAnnual && !durationLooksAnnual) {
    return false;
  }
  const incomplete =
    isBlankSubscriptionType(base.subscriptionTypeRaw) ||
    !base.latestRateId ||
    (base.latestRateId != null && !KNOWN_ANNUAL_RATE_IDS.has(base.latestRateId)) ||
    (base.subscriptionTypeRaw != null &&
      !["Basic Membership", "Premium Membership", "PREMIUM Membership", "Single Payment", "Basic Membership Full Activation"].includes(
        base.subscriptionTypeRaw,
      ));
  return incomplete || amountLooksAnnual;
}

export function classifyRemainingAnnualMember(
  base: ReturnType<typeof buildBaseMemberFields>,
): AnnualAccessClassification {
  if (isManualOrComplimentary(base)) {
    return "manual_complimentary";
  }
  if (isConfirmedAnnualSingle(base)) {
    return "confirmed_annual_single";
  }
  if (isInstallmentAnnual(base)) {
    return "annual_installment";
  }
  if (isProbableAnnualSingle(base)) {
    return "probable_annual_single";
  }
  return "unresolved_non_monthly";
}

export function collectAnnualAccessExceptions(
  base: ReturnType<typeof buildBaseMemberFields>,
  classification: AnnualAccessClassification,
): AnnualAccessException[] {
  const exceptions: AnnualAccessException[] = [];
  if (base.datesConflict) {
    exceptions.push("date_conflict");
  }
  if (isBlankSubscriptionType(base.subscriptionTypeRaw)) {
    exceptions.push("missing_type");
  }
  if (!base.latestRateId) {
    exceptions.push("missing_rate");
  }
  if (!base.latestProcessorRaw && base.latestProcessorDisplay === "Unknown") {
    exceptions.push("missing_processor");
  }
  if (base.nonMonthlySubscriptionRowCount > 1 || base.subscriptionRowCount > 1) {
    exceptions.push("duplicate_subscription_rows");
  }
  if (base.latestAmount != null && base.latestAmount <= 1) {
    exceptions.push("suspicious_amount");
  }
  if (base.expirationAfter2030) {
    exceptions.push("expiration_after_2030");
  }
  if (base.isStaffOrTest) {
    exceptions.push("staff_or_test");
  }
  if (
    classification === "manual_complimentary" ||
    classification === "unresolved_non_monthly" ||
    classification === "probable_annual_single" ||
    classification === "annual_installment" ||
    base.datesConflict ||
    base.isStaffOrTest
  ) {
    exceptions.push("requires_manual_migration");
  }
  return [...new Set(exceptions)];
}

export function buildRemainingAnnualAccessRow(
  queryRow: CurrentLegacyMemberQueryRow,
): RemainingAnnualAccessRow | null {
  const base = buildBaseMemberFields(queryRow);
  if (isObviousMonthlyMember(base)) {
    return null;
  }

  const classification = classifyRemainingAnnualMember(base);
  const confidence = confidenceFor(classification);
  const exceptions = collectAnnualAccessExceptions(base, classification);
  const exceptionLabels = exceptions.map((key) => EXCEPTION_LABELS[key]);
  const requiresManualMigration = exceptions.includes("requires_manual_migration");

  return {
    memberid: base.memberid,
    name: base.name,
    email: base.email,
    profileHref: base.profileHref,
    subscriptionTypeDisplay: base.subscriptionTypeDisplay,
    classification,
    classificationLabel: CLASSIFICATION_LABELS[classification],
    confidence,
    memberExpirationDisplay: base.memberExpirationDisplay,
    memberExpirationSort: base.memberExpirationSort,
    daysRemaining: base.daysRemaining,
    latestExpirationDisplay: base.latestExpirationDisplay,
    latestExpirationSort: base.latestExpirationSort,
    latestAmountDisplay: base.latestAmountDisplay,
    latestAmount: base.latestAmount,
    latestRateId: base.latestRateId,
    processorDisplay: base.latestProcessorInferred
      ? `${base.latestProcessorDisplay} (inferred)`
      : base.latestProcessorDisplay,
    stripeCustomerId: base.stripeCustomerId,
    relevantSubscriptionRowCount: base.nonMonthlySubscriptionRowCount || base.subscriptionRowCount,
    exceptions,
    exceptionLabels,
    exceptionsDisplay: exceptionLabels.join("; "),
    requiresManualMigration,
    paidThroughDisplay: base.memberExpirationDisplay,
  };
}

export function buildRemainingAnnualAccessSummary(
  rows: RemainingAnnualAccessRow[],
): RemainingAnnualAccessSummary {
  return {
    confirmedAnnualSingle: rows.filter((r) => r.classification === "confirmed_annual_single")
      .length,
    probableAnnualSingle: rows.filter((r) => r.classification === "probable_annual_single")
      .length,
    annualInstallment: rows.filter((r) => r.classification === "annual_installment").length,
    manualComplimentary: rows.filter((r) => r.classification === "manual_complimentary").length,
    unresolvedNonMonthly: rows.filter((r) => r.classification === "unresolved_non_monthly")
      .length,
    expiring30: rows.filter((r) => r.daysRemaining != null && r.daysRemaining <= 30).length,
    expiring60: rows.filter((r) => r.daysRemaining != null && r.daysRemaining <= 60).length,
    expiring90: rows.filter((r) => r.daysRemaining != null && r.daysRemaining <= 90).length,
    totalRows: rows.length,
  };
}

export function buildRemainingAnnualAccessReport(
  queryRows: CurrentLegacyMemberQueryRow[],
  asOf: Date = new Date(),
): RemainingAnnualAccessReport {
  const rows = queryRows
    .map(buildRemainingAnnualAccessRow)
    .filter((row): row is RemainingAnnualAccessRow => row != null)
    .sort((a, b) => {
      const aSort = a.memberExpirationSort || "9999";
      const bSort = b.memberExpirationSort || "9999";
      return aSort.localeCompare(bSort) || a.name.localeCompare(b.name);
    });

  return {
    asOfDateDisplay: asOf.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    rows,
    summary: buildRemainingAnnualAccessSummary(rows),
    note:
      "Annual memberships did not automatically renew. This report lists current non-monthly members who may have annual or installment paid-through access and may need manual migration handling. Classification uses legacy member current-state fields plus the latest legacy_subscriptions row for product evidence. Totals are shown by classification only — not as one combined annual count.",
  };
}

export async function loadRemainingAnnualAccessReport(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<RemainingAnnualAccessReport> {
  const queryRows = await loadCurrentLegacyMemberRows(queryFn);
  return buildRemainingAnnualAccessReport(queryRows);
}

export const REMAINING_ANNUAL_ACCESS_CSV_HEADERS = [
  "Name",
  "Email",
  "Legacy member ID",
  "Current subscription type",
  "Classification",
  "Confidence",
  "Paid through date",
  "Latest subscription expiration",
  "Latest amount",
  "Latest rate ID",
  "Processor",
  "Stripe customer ID",
  "Relevant subscription rows",
  "Requires manual migration",
  "Exception reasons",
] as const;

export function remainingAnnualAccessRowToCsvCells(row: RemainingAnnualAccessRow): string[] {
  return [
    row.name,
    row.email ?? "",
    row.memberid,
    row.subscriptionTypeDisplay,
    row.classificationLabel,
    row.confidence,
    row.paidThroughDisplay ?? "",
    row.latestExpirationDisplay ?? "",
    row.latestAmountDisplay ?? "",
    row.latestRateId ?? "",
    row.processorDisplay,
    row.stripeCustomerId ?? "",
    String(row.relevantSubscriptionRowCount),
    row.requiresManualMigration ? "yes" : "no",
    row.exceptionsDisplay,
  ];
}
