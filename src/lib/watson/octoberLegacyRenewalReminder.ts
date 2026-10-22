/**
 * October 2026 legacy renewal reminder selection for the Remaining Annual Access page.
 *
 * Read-only. Watson supplies the legacy paid-through day. Memberstack plan
 * connections are the current paid-membership check. This module never writes
 * memberships, billing, or accounts, and it never sends email.
 *
 * Paid-through days are America/Los_Angeles calendar dates. Stored legacy
 * expirations are Pacific midnight, so converting the timestamp into
 * America/Los_Angeles keeps October 1 on October 1. "Today" for expired versus
 * upcoming uses the same timezone. The paid-through day itself is still upcoming.
 */
import {
  FREE_ACCESS_MEMBERSHIPS,
  isGrandfatheredMonthlySubscriptionPlanId,
} from "../../config/memberships";
import { isActiveMemberstackPlanConnection } from "../memberAccess";
import { PAID_MEMBERSHIP_PLAN_IDS } from "../membership/membershipCheckoutDecision";
import {
  calendarYmdForNow,
  formatMembershipCalendarDateFromYmd,
  MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
} from "../membership/membershipStatusSummary";
import {
  buildPriceIndex,
  fetchAllMembers,
  paidConnectionPriceId,
  type MemberstackMember,
  type PlanConnection,
} from "../membership/membershipSummary";
import {
  classifyMemberstackSecretMode,
  getMemberstackAdminClient,
} from "../../../netlify/functions/lib/memberstack-admin.js";
import { customerEmailLookupKeys, normalizeCustomerEmail } from "./customerIdentifier";
import { queryWatson } from "./db";
import {
  type LoadMemberstackMembers,
  type MemberstackEmailResolution,
} from "./legacyAnnualExpiry";
import {
  buildBaseMemberFields,
  INSTALLMENT_AMOUNTS,
  isStaffOrTestEmail,
  KNOWN_INSTALLMENT_RATE_IDS,
  rowsToCsv,
  type CurrentLegacyMemberQueryRow,
} from "./legacyMembershipReportsShared";
import type { WatsonQueryFn } from "./memberSearch";
import {
  isConfirmedAnnualSingle,
  isInstallmentAnnual,
  isManualOrComplimentary,
  isObviousMonthlyMember,
  isProbableAnnualSingle,
} from "./remainingAnnualAccessReport";

export const OCTOBER_LEGACY_RENEWAL_TIMEZONE = MEMBERSHIP_STATUS_CALENDAR_TIMEZONE;
export const OCTOBER_LEGACY_RENEWAL_START_YMD = "2026-10-01";
export const OCTOBER_LEGACY_RENEWAL_END_YMD = "2026-10-31";

export const OCTOBER_LEGACY_RENEWAL_MEMBERS_SQL = `
  WITH october_members AS (
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
      m.stripcustomerid,
      m.betaactive,
      to_char(
        (timezone('${OCTOBER_LEGACY_RENEWAL_TIMEZONE}', m.subscriptionexpiring))::date,
        'YYYY-MM-DD'
      ) AS paid_through_ymd
    FROM legacy_members m
    WHERE m.subscriptionexpiring IS NOT NULL
      AND (timezone('${OCTOBER_LEGACY_RENEWAL_TIMEZONE}', m.subscriptionexpiring))::date
        BETWEEN $1::date AND $2::date
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
    INNER JOIN october_members om ON om.memberid = s.memberid_fk
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
    INNER JOIN october_members om ON om.memberid = s.memberid_fk
    GROUP BY s.memberid_fk
  )
  SELECT
    om.memberid,
    om.fristname,
    om.lastname,
    om.email,
    om.subscriptiontype,
    om.subscriptiondate,
    om.subscriptionexpiring,
    NULL::int AS days_remaining,
    om.monthlysubscriber,
    om.subscriptionrenewal,
    om.currentsubscriber,
    om.stripcustomerid,
    om.betaactive,
    om.paid_through_ymd,
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
  FROM october_members om
  LEFT JOIN latest_sub ls ON ls.memberid_fk = om.memberid
  LEFT JOIN sub_counts sc ON sc.memberid_fk = om.memberid
  ORDER BY om.paid_through_ymd ASC, om.lastname ASC NULLS LAST, om.fristname ASC NULLS LAST, om.memberid ASC
`;

export const OCTOBER_LEGACY_IDENTITY_SQL = `
  SELECT memberid, email
  FROM legacy_members
  WHERE lower(btrim(email)) = ANY($1::text[])
`;

export type OctoberRenewalStatus = "expired" | "upcoming";

export type OctoberReviewReason =
  | "conflicting_records"
  | "paid_status_unverified"
  | "missing_email"
  | "installment"
  | "probable"
  | "manual_complimentary"
  | "unresolved"
  | "outside_window";

export const OCTOBER_REVIEW_REASON_LABELS: Record<OctoberReviewReason, string> = {
  conflicting_records: "Conflicting records",
  paid_status_unverified: "Paid status unverified",
  missing_email: "Missing email",
  installment: "Installment, not verified annual",
  probable: "Probable annual",
  manual_complimentary: "Manual or complimentary",
  unresolved: "Unresolved membership",
  outside_window: "Paid-through date unclear",
};

export interface OctoberLegacyRenewalQueryRow extends CurrentLegacyMemberQueryRow {
  betaactive: number | string | null;
  paid_through_ymd: string | null;
}

export interface OctoberLegacyIdentityRow {
  memberid: string;
  email: string | null;
}

export interface OctoberReminderReadyRow {
  memberid: string;
  name: string;
  email: string;
  profileHref: string;
  paidThroughYmd: string;
  paidThroughDisplay: string;
  status: OctoberRenewalStatus;
  statusLabel: "Expired" | "Upcoming";
  evidence: string;
}

export interface OctoberReminderReviewRow {
  memberid: string;
  name: string;
  email: string | null;
  profileHref: string;
  paidThroughYmd: string;
  paidThroughDisplay: string;
  status: OctoberRenewalStatus;
  statusLabel: "Expired" | "Upcoming";
  reviewReason: OctoberReviewReason;
  reviewReasonLabel: string;
  evidence: string;
}

export interface OctoberReviewReasonCount {
  reason: OctoberReviewReason;
  label: string;
  count: number;
}

export interface OctoberLegacyRenewalReminderReport {
  timezone: typeof OCTOBER_LEGACY_RENEWAL_TIMEZONE;
  windowStartYmd: typeof OCTOBER_LEGACY_RENEWAL_START_YMD;
  windowEndYmd: typeof OCTOBER_LEGACY_RENEWAL_END_YMD;
  todayLosAngeles: string;
  todayDisplay: string;
  memberstackCheck: "complete" | "unavailable";
  memberstackCheckDetail: string | null;
  note: string;
  reminderRows: OctoberReminderReadyRow[];
  reviewRows: OctoberReminderReviewRow[];
  summary: {
    reminderReady: number;
    reminderExpired: number;
    reminderUpcoming: number;
    review: number;
    excludedPaidCoverage: number;
    excludedPaidRenewing: number;
    excludedPaidEndAfterLegacy: number;
    excludedMonthly: number;
    excludedTest: number;
    reviewByReason: OctoberReviewReasonCount[];
  };
}

export type OctoberMemberstackCheck =
  | { status: "complete"; index: Map<string, MemberstackMember[]> }
  | { status: "unavailable"; detail: string };

export type PaidCoverageDecision =
  | { kind: "no_paid_membership"; evidence: string }
  | { kind: "covers_beyond"; evidence: string; reason: "renewing" | "end_after" }
  | { kind: "does_not_cover_beyond"; evidence: string }
  | { kind: "unverified"; evidence: string };

const paidPlanIds = new Set<string>(PAID_MEMBERSHIP_PLAN_IDS);

const REPORT_NOTE =
  "Read-only October reminder list. Legacy paid-through dates are America/Los_Angeles calendar days from October 1 through October 31, 2026, including days that have already passed. Reminder-ready rows are verified annual single payments for one person, with no live Memberstack paid plan that lasts past that legacy date. A Memberstack account by itself is not paid coverage. Installment, probable, unresolved, manual, and complimentary records stay in Review. If current paid status cannot be verified, the person stays in Review. The CSV contains only the reminder-ready rows that are currently showing. No emails are sent and no membership data is changed.";

export const OCTOBER_REMINDER_CSV_HEADERS = [
  "Name",
  "Email",
  "Legacy paid-through date",
  "Status",
  "Evidence",
] as const;

function statusForPaidThrough(ymd: string, todayLosAngeles: string): OctoberRenewalStatus {
  return ymd < todayLosAngeles ? "expired" : "upcoming";
}

function statusLabel(status: OctoberRenewalStatus): "Expired" | "Upcoming" {
  return status === "expired" ? "Expired" : "Upcoming";
}

function displayPaidThrough(ymd: string): string {
  return formatMembershipCalendarDateFromYmd(ymd) ?? ymd;
}

function isOctoberYmd(ymd: string): boolean {
  return ymd >= OCTOBER_LEGACY_RENEWAL_START_YMD && ymd <= OCTOBER_LEGACY_RENEWAL_END_YMD;
}

function planIdOf(connection: PlanConnection): string {
  const record = connection as unknown as Record<string, unknown>;
  for (const key of ["planId", "plan", "id"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function paidIntervalLabel(connection: PlanConnection): "monthly" | "annual" | null {
  const priceId = paidConnectionPriceId(connection);
  const fromPrice = priceId ? (buildPriceIndex().get(priceId)?.interval ?? null) : null;
  if (fromPrice === "monthly" || fromPrice === "annual") return fromPrice;
  return isGrandfatheredMonthlySubscriptionPlanId(planIdOf(connection)) ? "monthly" : null;
}

function activePaidConnections(member: MemberstackMember): PlanConnection[] {
  const connections = member.planConnections ?? [];
  return connections.filter((connection) => {
    if (!isActiveMemberstackPlanConnection(connection)) return false;
    return paidPlanIds.has(planIdOf(connection));
  });
}

function unixSecondsToLosAngelesYmd(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return calendarYmdForNow(new Date(seconds * 1000), OCTOBER_LEGACY_RENEWAL_TIMEZONE);
}

function membershipNoun(connection: PlanConnection): string {
  const interval = paidIntervalLabel(connection);
  if (interval === "monthly") return "An active monthly membership";
  if (interval === "annual") return "An active annual membership";
  return "An active paid membership";
}

/**
 * Decide whether a Memberstack record's current paid membership lasts past the
 * legacy paid-through day. A missing account, or an account with no active paid
 * plan, is a verified "no paid coverage" result. The free legacy plan is not paid.
 * A missing payment block on an otherwise active paid plan cannot prove an end
 * date, so that person is unverified.
 */
export function evaluatePaidCoverageBeyondLegacyDate(
  member: MemberstackMember | null,
  legacyPaidThroughYmd: string,
): PaidCoverageDecision {
  if (!member) {
    return {
      kind: "no_paid_membership",
      evidence:
        "No Memberstack account exists for this email, so there is no current paid membership.",
    };
  }

  if (!Array.isArray(member.planConnections)) {
    return {
      kind: "unverified",
      evidence:
        "The Memberstack account did not include plan data, so current paid membership could not be verified.",
    };
  }

  const paid = activePaidConnections(member);
  if (paid.length === 0) {
    const freeOnly = member.planConnections.some(
      (connection) =>
        isActiveMemberstackPlanConnection(connection) &&
        planIdOf(connection) === FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId,
    );
    return {
      kind: "no_paid_membership",
      evidence: freeOnly
        ? "The Memberstack account has the free legacy plan only. That plan is not a current paid membership."
        : "The Memberstack account has no active paid membership.",
    };
  }

  let coveredBeyond: { evidence: string; reason: "renewing" | "end_after" } | null = null;
  let endedOnOrBefore: string | null = null;
  let unverified: string | null = null;

  for (const connection of paid) {
    const payment = connection.payment;
    if (!payment || typeof payment !== "object") {
      unverified =
        `${membershipNoun(connection)} is active, but its billing end date was not included, so coverage past the legacy date could not be verified.`;
      continue;
    }

    const cancelAt = payment.cancelAtDate;
    if (cancelAt == null || cancelAt === 0) {
      coveredBeyond = {
        reason: "renewing",
        evidence: `${membershipNoun(connection)} has no cancellation date, so it keeps access past the legacy paid-through date.`,
      };
      continue;
    }
    if (typeof cancelAt !== "number") {
      unverified =
        `${membershipNoun(connection)} has an unreadable cancellation date, so coverage past the legacy date could not be verified.`;
      continue;
    }

    const endYmd = unixSecondsToLosAngelesYmd(cancelAt);
    const endDisplay = endYmd ? displayPaidThrough(endYmd) : null;
    if (!endYmd || !endDisplay) {
      unverified =
        `${membershipNoun(connection)} has an unreadable cancellation date, so coverage past the legacy date could not be verified.`;
      continue;
    }
    if (endYmd > legacyPaidThroughYmd) {
      coveredBeyond = {
        reason: "end_after",
        evidence: `${membershipNoun(connection)} remains active through ${endDisplay}, which is after the legacy paid-through date.`,
      };
    } else {
      endedOnOrBefore =
        `${membershipNoun(connection)} ends on ${endDisplay}, which does not extend past the legacy paid-through date.`;
    }
  }

  if (coveredBeyond) {
    return { kind: "covers_beyond", evidence: coveredBeyond.evidence, reason: coveredBeyond.reason };
  }
  if (unverified) return { kind: "unverified", evidence: unverified };
  if (endedOnOrBefore) return { kind: "does_not_cover_beyond", evidence: endedOnOrBefore };
  return {
    kind: "unverified",
    evidence: "Current paid membership could not be verified from the Memberstack plan.",
  };
}

export function buildOctoberMemberstackEmailIndex(
  members: MemberstackMember[],
): Map<string, MemberstackMember[]> {
  const index = new Map<string, MemberstackMember[]>();
  for (const member of members) {
    for (const key of customerEmailLookupKeys(member.auth?.email)) {
      const group = index.get(key) ?? [];
      if (!group.some((item) => item.id === member.id)) group.push(member);
      index.set(key, group);
    }
  }
  return index;
}

export function resolveOctoberMemberstackMember(
  index: Map<string, MemberstackMember[]>,
  email: string,
): MemberstackEmailResolution {
  const keys = customerEmailLookupKeys(email);
  const byId = new Map<string, MemberstackMember>();
  for (const key of keys) {
    for (const member of index.get(key) ?? []) byId.set(member.id, member);
  }
  if (byId.size === 0) return { status: "not_found" };
  if (byId.size > 1) return { status: "ambiguous" };
  const member = [...byId.values()][0];
  if (!member) return { status: "not_found" };
  return { status: "unique", member };
}

function memberstackIdForEmail(
  email: string | null,
  memberstack: OctoberMemberstackCheck,
): string | null {
  if (!email || memberstack.status !== "complete") return null;
  const resolution = resolveOctoberMemberstackMember(memberstack.index, email);
  return resolution.status === "unique" ? resolution.member.id : null;
}

function legacyMemberIdsSharingEmail(
  email: string,
  memberid: string,
  identityRows: OctoberLegacyIdentityRow[],
): string[] {
  const keys = new Set(customerEmailLookupKeys(email));
  const ids = new Set<string>([memberid]);
  for (const row of identityRows) {
    if (customerEmailLookupKeys(row.email).some((key) => keys.has(key))) {
      ids.add(row.memberid);
    }
  }
  return [...ids];
}

function productBucket(
  base: ReturnType<typeof buildBaseMemberFields>,
): "monthly" | "verified_annual" | "installment" | "probable" | "manual" | "unresolved" {
  if (isObviousMonthlyMember(base)) return "monthly";
  if (isManualOrComplimentary(base)) return "manual";
  if (isConfirmedAnnualSingle(base)) return "verified_annual";
  if (isInstallmentAnnual(base)) return "installment";
  if (isProbableAnnualSingle(base)) return "probable";
  return "unresolved";
}

function amountPhrase(base: ReturnType<typeof buildBaseMemberFields>): string {
  return base.latestAmountDisplay ? ` of ${base.latestAmountDisplay}` : "";
}

function verifiedAnnualEvidence(base: ReturnType<typeof buildBaseMemberFields>): string {
  return `Verified annual single payment${amountPhrase(base)} on a known annual rate.`;
}

function installmentEvidence(base: ReturnType<typeof buildBaseMemberFields>): string {
  const type = base.subscriptionTypeRaw ?? "";
  const matchedByRate = Boolean(
    base.latestRateId && KNOWN_INSTALLMENT_RATE_IDS.has(base.latestRateId),
  );
  const matchedByType =
    type === "Basic Membership  - Three Payments" || type === "Three Payment Premium";
  const amountOnly =
    base.latestAmount != null &&
    INSTALLMENT_AMOUNTS.has(base.latestAmount) &&
    !matchedByRate &&
    !matchedByType;
  if (amountOnly) {
    return `Latest charge is ${base.latestAmountDisplay ?? "an installment-sized amount"}. An installment amount alone does not prove an annual membership, so this record stays in review.`;
  }
  return "This record matches an installment plan. Installment memberships are not treated as verified annual single payments, so this record stays in review.";
}

function timingSentence(
  status: OctoberRenewalStatus,
  paidThroughDisplay: string,
  todayDisplay: string,
): string {
  if (status === "expired") {
    return `Legacy paid-through ${paidThroughDisplay} is already past today (${todayDisplay}, America/Los_Angeles).`;
  }
  return `Legacy paid-through ${paidThroughDisplay} is still upcoming as of today (${todayDisplay}, America/Los_Angeles).`;
}

interface WorkingRow {
  memberid: string;
  name: string;
  email: string | null;
  profileHref: string;
  paidThroughYmd: string;
  paidThroughDisplay: string;
  status: OctoberRenewalStatus;
  memberstackId: string | null;
  bucket: "excluded_test" | "excluded_monthly" | "excluded_paid" | "review" | "ready";
  paidExclusion: "renewing" | "end_after" | null;
  reviewReason: OctoberReviewReason | null;
  evidence: string;
}

function toReady(row: WorkingRow): OctoberReminderReadyRow | null {
  if (row.bucket !== "ready" || !row.email) return null;
  return {
    memberid: row.memberid,
    name: row.name,
    email: row.email,
    profileHref: row.profileHref,
    paidThroughYmd: row.paidThroughYmd,
    paidThroughDisplay: row.paidThroughDisplay,
    status: row.status,
    statusLabel: statusLabel(row.status),
    evidence: row.evidence,
  };
}

function toReview(row: WorkingRow): OctoberReminderReviewRow | null {
  if (row.bucket !== "review" || !row.reviewReason) return null;
  return {
    memberid: row.memberid,
    name: row.name,
    email: row.email,
    profileHref: row.profileHref,
    paidThroughYmd: row.paidThroughYmd,
    paidThroughDisplay: row.paidThroughDisplay,
    status: row.status,
    statusLabel: statusLabel(row.status),
    reviewReason: row.reviewReason,
    reviewReasonLabel: OCTOBER_REVIEW_REASON_LABELS[row.reviewReason],
    evidence: row.evidence,
  };
}

function compareRows(
  left: { paidThroughYmd: string; name: string; memberid: string },
  right: { paidThroughYmd: string; name: string; memberid: string },
): number {
  return (
    left.paidThroughYmd.localeCompare(right.paidThroughYmd) ||
    left.name.localeCompare(right.name) ||
    left.memberid.localeCompare(right.memberid)
  );
}

export function buildOctoberLegacyRenewalReminder(input: {
  queryRows: OctoberLegacyRenewalQueryRow[];
  identityRows: OctoberLegacyIdentityRow[];
  memberstack: OctoberMemberstackCheck;
  todayLosAngeles: string;
}): OctoberLegacyRenewalReminderReport {
  const todayDisplay = displayPaidThrough(input.todayLosAngeles);
  const working: WorkingRow[] = [];

  for (const queryRow of input.queryRows) {
    const base = buildBaseMemberFields(queryRow);
    const ymd = (queryRow.paid_through_ymd ?? "").trim();
    const paidThroughYmd = isOctoberYmd(ymd) ? ymd : "";
    const paidThroughDisplay = paidThroughYmd ? displayPaidThrough(paidThroughYmd) : ymd || "Unknown";
    const status: OctoberRenewalStatus = paidThroughYmd
      ? statusForPaidThrough(paidThroughYmd, input.todayLosAngeles)
      : "expired";
    const shared = {
      memberid: base.memberid,
      name: base.name,
      email: base.email,
      profileHref: base.profileHref,
      paidThroughYmd: paidThroughYmd || ymd || "",
      paidThroughDisplay,
      status,
      memberstackId: null as string | null,
      paidExclusion: null as "renewing" | "end_after" | null,
    };

    if (!paidThroughYmd) {
      working.push({
        ...shared,
        bucket: "review",
        reviewReason: "outside_window",
        evidence:
          "The legacy paid-through date could not be read as an October 2026 America/Los_Angeles day, so this record stays in review.",
      });
      continue;
    }

    if (Number(queryRow.betaactive) === 1 || isStaffOrTestEmail(base.email)) {
      working.push({
        ...shared,
        bucket: "excluded_test",
        reviewReason: null,
        evidence: "Known test or internal account.",
      });
      continue;
    }

    const product = productBucket(base);
    const linkedMemberstackId = memberstackIdForEmail(base.email, input.memberstack);
    if (product === "monthly") {
      working.push({
        ...shared,
        memberstackId: linkedMemberstackId,
        bucket: "excluded_monthly",
        reviewReason: null,
        evidence: "Legacy record is monthly, so it is not an annual renewal reminder.",
      });
      continue;
    }

    if (product !== "verified_annual") {
      const reason: OctoberReviewReason =
        product === "installment"
          ? "installment"
          : product === "probable"
            ? "probable"
            : product === "manual"
              ? "manual_complimentary"
              : "unresolved";
      const evidence =
        product === "installment"
          ? installmentEvidence(base)
          : product === "probable"
            ? "The annual payment is only probable, not a confirmed single payment, so this record stays in review."
            : product === "manual"
              ? "Legacy access is manual or complimentary, so this record stays in review."
              : "The legacy membership could not be verified as an annual single payment, so this record stays in review.";
      working.push({
        ...shared,
        memberstackId: linkedMemberstackId,
        bucket: "review",
        reviewReason: reason,
        evidence,
      });
      continue;
    }

    if (!base.email || !normalizeCustomerEmail(base.email)) {
      working.push({
        ...shared,
        bucket: "review",
        reviewReason: "missing_email",
        evidence:
          "No email is on the legacy record, so the person and their current paid membership could not be verified.",
      });
      continue;
    }

    const sharedIds = legacyMemberIdsSharingEmail(
      base.email,
      base.memberid,
      input.identityRows,
    );
    if (sharedIds.length > 1) {
      working.push({
        ...shared,
        bucket: "review",
        reviewReason: "conflicting_records",
        evidence: `This email is on more than one legacy member record (${sharedIds.sort().join(", ")}). Conflicting records stay in review.`,
      });
      continue;
    }

    if (input.memberstack.status === "unavailable") {
      working.push({
        ...shared,
        bucket: "review",
        reviewReason: "paid_status_unverified",
        evidence: input.memberstack.detail,
      });
      continue;
    }

    const resolution = resolveOctoberMemberstackMember(
      input.memberstack.index,
      base.email,
    );
    if (resolution.status === "ambiguous") {
      working.push({
        ...shared,
        bucket: "review",
        reviewReason: "conflicting_records",
        evidence:
          "This email matches more than one Memberstack account, so the person and their paid membership could not be verified.",
      });
      continue;
    }
    if (resolution.status === "error") {
      working.push({
        ...shared,
        bucket: "review",
        reviewReason: "paid_status_unverified",
        evidence: `Current paid membership could not be verified. ${resolution.error}`,
      });
      continue;
    }

    const member = resolution.status === "unique" ? resolution.member : null;
    const coverage = evaluatePaidCoverageBeyondLegacyDate(member, paidThroughYmd);
    const memberstackId = member?.id ?? null;
    if (coverage.kind === "covers_beyond") {
      working.push({
        ...shared,
        memberstackId,
        bucket: "excluded_paid",
        paidExclusion: coverage.reason,
        reviewReason: null,
        evidence: coverage.evidence,
      });
      continue;
    }
    if (coverage.kind === "unverified") {
      working.push({
        ...shared,
        memberstackId,
        bucket: "review",
        reviewReason: "paid_status_unverified",
        evidence: coverage.evidence,
      });
      continue;
    }

    working.push({
      ...shared,
      memberstackId,
      bucket: "ready",
      reviewReason: null,
      evidence: `${verifiedAnnualEvidence(base)} ${coverage.evidence} ${timingSentence(status, paidThroughDisplay, todayDisplay)}`,
    });
  }

  const memberstackGroups = new Map<string, WorkingRow[]>();
  for (const row of working) {
    if (!row.memberstackId) continue;
    const group = memberstackGroups.get(row.memberstackId) ?? [];
    group.push(row);
    memberstackGroups.set(row.memberstackId, group);
  }
  for (const [memberstackId, group] of memberstackGroups) {
    const distinctMembers = new Set(group.map((row) => row.memberid));
    if (distinctMembers.size < 2) continue;
    for (const row of group) {
      if (row.bucket !== "ready") continue;
      row.bucket = "review";
      row.reviewReason = "conflicting_records";
      row.evidence = `Memberstack person ${memberstackId} matches more than one legacy record in this October list. Conflicting records stay in review.`;
    }
  }

  const reminderRows = working.flatMap((row) => {
    const ready = toReady(row);
    return ready ? [ready] : [];
  }).sort(compareRows);
  const reviewRows = working.flatMap((row) => {
    const review = toReview(row);
    return review ? [review] : [];
  }).sort(compareRows);

  const reviewByReason = (Object.keys(OCTOBER_REVIEW_REASON_LABELS) as OctoberReviewReason[])
    .map((reason) => ({
      reason,
      label: OCTOBER_REVIEW_REASON_LABELS[reason],
      count: reviewRows.filter((row) => row.reviewReason === reason).length,
    }))
    .filter((entry) => entry.count > 0);

  return {
    timezone: OCTOBER_LEGACY_RENEWAL_TIMEZONE,
    windowStartYmd: OCTOBER_LEGACY_RENEWAL_START_YMD,
    windowEndYmd: OCTOBER_LEGACY_RENEWAL_END_YMD,
    todayLosAngeles: input.todayLosAngeles,
    todayDisplay,
    memberstackCheck: input.memberstack.status === "complete" ? "complete" : "unavailable",
    memberstackCheckDetail:
      input.memberstack.status === "unavailable" ? input.memberstack.detail : null,
    note: REPORT_NOTE,
    reminderRows,
    reviewRows,
    summary: {
      reminderReady: reminderRows.length,
      reminderExpired: reminderRows.filter((row) => row.status === "expired").length,
      reminderUpcoming: reminderRows.filter((row) => row.status === "upcoming").length,
      review: reviewRows.length,
      excludedPaidCoverage: working.filter((row) => row.bucket === "excluded_paid").length,
      excludedPaidRenewing: working.filter((row) => row.paidExclusion === "renewing").length,
      excludedPaidEndAfterLegacy: working.filter((row) => row.paidExclusion === "end_after").length,
      excludedMonthly: working.filter((row) => row.bucket === "excluded_monthly").length,
      excludedTest: working.filter((row) => row.bucket === "excluded_test").length,
      reviewByReason,
    },
  };
}

export function filterOctoberReminderReadyRows(
  rows: OctoberReminderReadyRow[],
  filter: { status?: "" | OctoberRenewalStatus; search?: string } = {},
): OctoberReminderReadyRow[] {
  const status = filter.status ?? "";
  const search = filter.search?.trim().toLowerCase() ?? "";
  return rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (!search) return true;
    const haystack = `${row.name} ${row.email} ${row.memberid}`.toLowerCase();
    return haystack.includes(search);
  });
}

export function octoberReminderRowToCsvCells(row: OctoberReminderReadyRow): string[] {
  return [
    row.name,
    row.email,
    row.paidThroughDisplay,
    row.statusLabel,
    row.evidence,
  ];
}

export function octoberReminderReadyRowsToCsv(rows: OctoberReminderReadyRow[]): string {
  return rowsToCsv(
    [...OCTOBER_REMINDER_CSV_HEADERS],
    rows.map(octoberReminderRowToCsvCells),
  );
}

/**
 * Live Memberstack admin secret only. A sandbox key must not be treated as the
 * billing source for this reminder list.
 */
export function liveMemberstackAdminSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.MEMBERSTACK_SECRET_KEY?.trim() ?? "";
  return classifyMemberstackSecretMode(value) === "live" ? value : null;
}

export async function loadLiveMemberstackMembers(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ members: MemberstackMember[]; truncated: boolean }> {
  const secretKey = liveMemberstackAdminSecret(env);
  if (!secretKey) {
    throw new Error(
      "The live Memberstack admin key is not configured, so current paid membership could not be verified.",
    );
  }
  const client = getMemberstackAdminClient({ secretKey });
  if (!client || typeof client.listMembers !== "function") {
    throw new Error(
      "Memberstack admin API is not configured, so current paid membership could not be verified.",
    );
  }
  return fetchAllMembers(client);
}

function octoberLookupKeys(rows: OctoberLegacyRenewalQueryRow[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of customerEmailLookupKeys(row.email)) keys.add(key);
  }
  return [...keys];
}

export interface LoadOctoberLegacyRenewalReminderOptions {
  now?: Date;
  queryFn?: WatsonQueryFn;
  loadMemberstackMembers?: LoadMemberstackMembers;
}

export async function loadOctoberLegacyRenewalReminder(
  options: LoadOctoberLegacyRenewalReminderOptions = {},
): Promise<OctoberLegacyRenewalReminderReport> {
  const now = options.now ?? new Date();
  const todayLosAngeles = calendarYmdForNow(now, OCTOBER_LEGACY_RENEWAL_TIMEZONE);
  const queryFn = options.queryFn ?? queryWatson;
  const queryRows = await queryFn<OctoberLegacyRenewalQueryRow>(
    OCTOBER_LEGACY_RENEWAL_MEMBERS_SQL,
    [OCTOBER_LEGACY_RENEWAL_START_YMD, OCTOBER_LEGACY_RENEWAL_END_YMD],
  );

  const lookupKeys = octoberLookupKeys(queryRows);
  const identityRows =
    lookupKeys.length === 0
      ? []
      : await queryFn<OctoberLegacyIdentityRow>(OCTOBER_LEGACY_IDENTITY_SQL, [lookupKeys]);

  let memberstack: OctoberMemberstackCheck;
  if (queryRows.length === 0) {
    memberstack = { status: "complete", index: new Map() };
  } else {
    const loadMembers = options.loadMemberstackMembers ?? loadLiveMemberstackMembers;
    try {
      const { members, truncated } = await loadMembers();
      if (truncated) {
        memberstack = {
          status: "unavailable",
          detail:
            "The Memberstack member scan was incomplete, so current paid status could not be verified.",
        };
      } else {
        memberstack = {
          status: "complete",
          index: buildOctoberMemberstackEmailIndex(members),
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Memberstack scan failed";
      memberstack = {
        status: "unavailable",
        detail: `Current paid membership could not be verified because the Memberstack scan failed. ${message}`,
      };
    }
  }

  return buildOctoberLegacyRenewalReminder({
    queryRows,
    identityRows,
    memberstack,
    todayLosAngeles,
  });
}
