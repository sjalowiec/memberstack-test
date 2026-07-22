/**
 * Customer-facing membership status summary for /membership.
 *
 * Live paid status comes from Memberstack plan connections (request-time).
 * Legacy Watson history is optional context only — never proof of current access.
 */

import {
  LEGACY_MEMBERSHIPS,
  MEMBERSHIPS,
  REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
} from "../../config/memberships";
import type { MemberMembershipDisplay } from "../watson/memberMembership";
import type { CustomerMemberstackSummary } from "../watson/customerMemberstack";
import type { PlanConnection } from "./membershipSummary";
import {
  memberHasActivePaidMembership,
  PAID_MEMBERSHIP_PLAN_IDS,
} from "./membershipCheckoutDecision";
import {
  cancelAtLabelFromActivePaidConnection,
  isCancelingActivePaidConnection,
} from "./accountMembershipPanel";

export type MembershipCurrentStatus =
  | "active"
  | "canceling"
  | "no_plan"
  | "inactive"
  | "unknown";

export type MembershipLegacyLinkState =
  | "linked"
  | "not_found"
  | "ambiguous"
  | "lookup_unavailable";

export type MembershipAccountType =
  | "paid_membership"
  | "non_paid_account"
  | "unknown";

export type MembershipRecommendedAction =
  | "manage"
  | "purchase"
  | "contact_support"
  | "wait";

/** Internal only — never sent in the public DTO. */
export type LegacyExpirationTiming = "legacy_expired" | "legacy_paid_through_future";

export type MembershipStatusSummary = {
  identified: boolean;
  currentStatus: MembershipCurrentStatus;
  currentPlanName: string | null;
  previousPlanName: string | null;
  activeThroughDate: string | null;
  legacyExpirationDate: string | null;
  legacyLinkState: MembershipLegacyLinkState;
  accountType: MembershipAccountType;
  recommendedAction: MembershipRecommendedAction;
  customerFacingMessage: string;
};

export type MembershipStatusLegacyContext = {
  linkState: MembershipLegacyLinkState;
  /**
   * Customer display date for the unique legacy expiration (date-only safe formatting).
   * Prefer formatting from {@link legacyExpirationYmd}.
   */
  legacyExpirationDate: string | null;
  /** Calendar date YYYY-MM-DD for comparison (never a zoned instant). */
  legacyExpirationYmd: string | null;
  /** Customer-safe plan label from unique legacy history, or null. */
  previousPlanName: string | null;
};

/**
 * Business calendar used when deriving "today" for legacy paid-through checks.
 * Legacy SQL dates are date-only; we compare calendar days, not timestamps.
 */
export const MEMBERSHIP_STATUS_CALENDAR_TIMEZONE = "America/Los_Angeles";

const PAID_PLAN_ID_SET = new Set<string>(PAID_MEMBERSHIP_PLAN_IDS);

const CUSTOMER_PLAN_NAME_BY_ID = new Map<string, string>([
  [MEMBERSHIPS.membership.memberstackPlanId, MEMBERSHIPS.membership.name],
  [MEMBERSHIPS.beta.memberstackPlanId, MEMBERSHIPS.beta.name],
  [REMOVED_BASIC_MEMBERSHIP_PLAN_ID, "Basic"],
  ...Object.values(LEGACY_MEMBERSHIPS).map(
    (plan) => [plan.memberstackPlanId, plan.name] as const,
  ),
]);

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Prefer a short customer-facing label over internal retired plan shell names. */
export function customerFacingPlanName(
  planId: string | null | undefined,
  fallbackName: string | null | undefined,
): string | null {
  if (planId && CUSTOMER_PLAN_NAME_BY_ID.has(planId)) {
    const configured = CUSTOMER_PLAN_NAME_BY_ID.get(planId)!;
    // Retired shells still mean the same paid membership to customers.
    if (PAID_PLAN_ID_SET.has(planId)) {
      return MEMBERSHIPS.membership.name;
    }
    return configured;
  }
  if (fallbackName?.trim()) {
    return fallbackName.trim();
  }
  return null;
}

/**
 * Extract YYYY-MM-DD from a date-only value without shifting the calendar day.
 * Accepts `YYYY-MM-DD`, ISO timestamps (uses the date prefix), or Date (UTC YMD).
 */
export function ymdFromDateOnlyValue(value: string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    const prefix = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (prefix) {
      return `${prefix[1]}-${prefix[2]}-${prefix[3]}`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  return null;
}

/** Today's calendar YYYY-MM-DD in the membership business timezone. */
export function calendarYmdForNow(
  now: Date,
  timeZone: string = MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    return now.toISOString().slice(0, 10);
  }
  return `${year}-${month}-${day}`;
}

/**
 * Format a YYYY-MM-DD calendar date for customers without UTC-midnight shift.
 * Uses long month names to match membership account date copy.
 */
export function formatMembershipCalendarDateFromYmd(ymd: string): string | null {
  const match = YMD_RE.exec(ymd.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(utc.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(utc);
}

/**
 * Compare legacy expiration YMD to today.
 * Today counts as still paid-through (not safely expired).
 */
export function resolveLegacyExpirationTiming(
  legacyExpirationYmd: string | null | undefined,
  todayYmd: string,
): LegacyExpirationTiming | null {
  const expirationYmd = ymdFromDateOnlyValue(legacyExpirationYmd ?? null);
  if (!expirationYmd || !YMD_RE.test(todayYmd)) return null;
  if (expirationYmd >= todayYmd) return "legacy_paid_through_future";
  return "legacy_expired";
}

function activeMembershipSentence(planLabel: string, throughDate: string | null): string {
  const labelAlreadySaysMembership = /membership/i.test(planLabel);
  if (throughDate) {
    return labelAlreadySaysMembership
      ? `Your ${planLabel} remains active through ${throughDate}. You do not need to subscribe again before then.`
      : `Your ${planLabel} membership remains active through ${throughDate}. You do not need to subscribe again before then.`;
  }
  return labelAlreadySaysMembership
    ? `Your ${planLabel} is active. You do not need to subscribe again.`
    : `Your ${planLabel} membership is active. You do not need to subscribe again.`;
}

function isPaidPlanId(planId: string | null): boolean {
  return Boolean(planId && PAID_PLAN_ID_SET.has(planId));
}

/**
 * Best-effort previous paid plan from inactive/canceled Memberstack connections.
 * Does not use active connections (those are current).
 */
export function previousPlanNameFromMemberstack(
  summary: CustomerMemberstackSummary,
): string | null {
  const inactivePaid = summary.connections
    .filter((connection) => connection.activeLabel !== "Active")
    .filter((connection) => isPaidPlanId(connection.planId))
    .sort((a, b) => {
      const aSort = a.canceledAtSort || a.startDateSort || "";
      const bSort = b.canceledAtSort || b.startDateSort || "";
      return bSort.localeCompare(aSort);
    });

  const top = inactivePaid[0];
  if (!top) return null;
  return customerFacingPlanName(top.planId, top.planName);
}

/**
 * Previous plan from unique legacy subscription history.
 * Returns null when premium/annual cues are too weak to label reliably.
 */
export function previousPlanNameFromLegacyMemberships(
  memberships: MemberMembershipDisplay[],
  legacyExpirationDate: string | null,
): string | null {
  if (!memberships.length) return null;

  const matching = legacyExpirationDate
    ? memberships.filter((row) => row.expirationDate === legacyExpirationDate)
    : memberships;

  const candidates = matching.length > 0 ? matching : memberships;
  const row =
    [...candidates].sort((a, b) =>
      (b.expirationDateSort || b.startDateSort || "").localeCompare(
        a.expirationDateSort || a.startDateSort || "",
      ),
    )[0] ?? null;

  if (!row) return null;

  // Only label Premium/Basic when the legacy premium flag is present.
  if (row.premiumFlag === "1") return "Premium";
  if (row.premiumFlag === "0") return "Basic";
  return "Knit it Now";
}

function resolveLegacyDisplayDate(legacy: MembershipStatusLegacyContext): string | null {
  if (legacy.legacyExpirationYmd) {
    return (
      formatMembershipCalendarDateFromYmd(legacy.legacyExpirationYmd) ??
      legacy.legacyExpirationDate
    );
  }
  return legacy.legacyExpirationDate;
}

export function buildMembershipStatusSummary(input: {
  memberstackMember: {
    id: string;
    planConnections?: PlanConnection[];
  } | null;
  memberstackSummary: CustomerMemberstackSummary | null;
  memberstackLookupOk: boolean;
  legacy: MembershipStatusLegacyContext;
  /** Deterministic "now" for legacy paid-through vs expired checks (tests inject this). */
  now?: Date;
  /** Optional override for today's YYYY-MM-DD (takes precedence over {@link now}). */
  todayYmd?: string;
}): MembershipStatusSummary {
  const {
    memberstackMember,
    memberstackSummary,
    memberstackLookupOk,
    legacy,
  } = input;

  const todayYmd =
    input.todayYmd ??
    calendarYmdForNow(input.now ?? new Date(), MEMBERSHIP_STATUS_CALENDAR_TIMEZONE);

  if (!memberstackLookupOk || !memberstackMember || !memberstackSummary) {
    return {
      identified: false,
      currentStatus: "unknown",
      currentPlanName: null,
      previousPlanName: null,
      activeThroughDate: null,
      legacyExpirationDate: null,
      legacyLinkState: "lookup_unavailable",
      accountType: "unknown",
      recommendedAction: "wait",
      customerFacingMessage:
        "We could not confirm your membership status right now. Please try again or contact us before purchasing another membership.",
    };
  }

  const identified = true;
  const payload = { data: memberstackMember };
  const hasPaid = memberHasActivePaidMembership(payload);
  const isCanceling = hasPaid && isCancelingActivePaidConnection(payload);
  const activeThroughDate = isCanceling
    ? cancelAtLabelFromActivePaidConnection(payload)
    : null;

  const activePaidConnection = memberstackSummary.connections.find(
    (connection) =>
      connection.activeLabel === "Active" && isPaidPlanId(connection.planId),
  );
  const currentPlanName = hasPaid
    ? customerFacingPlanName(
        activePaidConnection?.planId,
        activePaidConnection?.planName,
      ) ?? MEMBERSHIPS.membership.name
    : null;

  const previousFromMemberstack = previousPlanNameFromMemberstack(memberstackSummary);
  const planFromLegacy =
    legacy.linkState === "linked" ? legacy.previousPlanName : null;
  const previousPlanName = previousFromMemberstack ?? planFromLegacy;

  const legacyExpirationDisplay =
    legacy.linkState === "linked" ? resolveLegacyDisplayDate(legacy) : null;
  const legacyTiming =
    legacy.linkState === "linked"
      ? resolveLegacyExpirationTiming(legacy.legacyExpirationYmd, todayYmd)
      : null;

  if (legacy.linkState === "ambiguous" && !hasPaid) {
    const hasInactivePaidHistory = memberstackSummary.connections.some(
      (connection) =>
        isPaidPlanId(connection.planId) && connection.activeLabel !== "Active",
    );
    return {
      identified,
      currentStatus: hasInactivePaidHistory ? "inactive" : "no_plan",
      currentPlanName: null,
      previousPlanName: previousFromMemberstack,
      activeThroughDate: null,
      legacyExpirationDate: null,
      legacyLinkState: "ambiguous",
      accountType: "non_paid_account",
      recommendedAction: "contact_support",
      customerFacingMessage:
        "We found your account, but we could not safely match all of your previous membership information. Please contact us before purchasing another membership.",
    };
  }

  if (hasPaid && isCanceling) {
    const planLabel = currentPlanName ?? MEMBERSHIPS.membership.name;
    const through = activeThroughDate ?? "your paid-through date";
    return {
      identified,
      currentStatus: "canceling",
      currentPlanName: planLabel,
      previousPlanName,
      activeThroughDate,
      legacyExpirationDate: legacyExpirationDisplay,
      legacyLinkState: legacy.linkState,
      accountType: "paid_membership",
      recommendedAction: "manage",
      customerFacingMessage: activeMembershipSentence(planLabel, through),
    };
  }

  if (hasPaid) {
    const planLabel = currentPlanName ?? MEMBERSHIPS.membership.name;
    return {
      identified,
      currentStatus: "active",
      currentPlanName: planLabel,
      previousPlanName,
      activeThroughDate: null,
      legacyExpirationDate: legacyExpirationDisplay,
      legacyLinkState: legacy.linkState,
      accountType: "paid_membership",
      recommendedAction: "manage",
      customerFacingMessage: activeMembershipSentence(planLabel, null),
    };
  }

  const hasInactivePaidHistory = memberstackSummary.connections.some(
    (connection) =>
      isPaidPlanId(connection.planId) && connection.activeLabel !== "Active",
  );
  // Non-paid plans (beta, free course, DesignaKnit, etc.) are "no_plan", not inactive paid history.
  const currentStatus: MembershipCurrentStatus = hasInactivePaidHistory
    ? "inactive"
    : "no_plan";

  if (legacy.linkState === "linked" && legacyExpirationDisplay && legacyTiming) {
    const planLabel = previousPlanName ?? planFromLegacy ?? "Knit it Now";

    if (legacyTiming === "legacy_paid_through_future") {
      // Do not call the plan "previous" while paid-through is still today/future.
      // previousPlanName still carries the label for panel facts when useful.
      return {
        identified,
        currentStatus,
        currentPlanName: null,
        previousPlanName: planFromLegacy ?? previousFromMemberstack,
        activeThroughDate: null,
        legacyExpirationDate: legacyExpirationDisplay,
        legacyLinkState: "linked",
        accountType: "non_paid_account",
        recommendedAction: "contact_support",
        customerFacingMessage: `Our records show that your ${planLabel} annual membership was paid through ${legacyExpirationDisplay}, but we do not currently see an active membership on your new account. Please contact us before purchasing another membership so we can check your account.`,
      };
    }

    // legacy_expired
    return {
      identified,
      currentStatus,
      currentPlanName: null,
      previousPlanName: planLabel,
      activeThroughDate: null,
      legacyExpirationDate: legacyExpirationDisplay,
      legacyLinkState: "linked",
      accountType: "non_paid_account",
      recommendedAction: "purchase",
      customerFacingMessage: `You have a Knit it Now account, but we do not currently see an active membership. Your previous ${planLabel} annual membership ended on ${legacyExpirationDisplay}.`,
    };
  }

  if (legacy.linkState === "linked" && legacyExpirationDisplay) {
    // Linked date present but timing unknown — do not encourage purchase.
    return {
      identified,
      currentStatus,
      currentPlanName: null,
      previousPlanName: previousPlanName,
      activeThroughDate: null,
      legacyExpirationDate: legacyExpirationDisplay,
      legacyLinkState: "linked",
      accountType: "non_paid_account",
      recommendedAction: "contact_support",
      customerFacingMessage:
        "We found membership history on your account, but we could not safely confirm whether it has ended. Please contact us before purchasing another membership.",
    };
  }

  return {
    identified,
    currentStatus,
    currentPlanName: null,
    previousPlanName,
    activeThroughDate: null,
    legacyExpirationDate: null,
    legacyLinkState: legacy.linkState,
    accountType: "non_paid_account",
    recommendedAction: "purchase",
    customerFacingMessage:
      "You have a Knit it Now account, but it does not currently include an active Knit it Now membership.",
  };
}

/** Panel heading derived from the customer-safe summary (no internal jargon). */
export function membershipStatusPanelHeading(
  summary: MembershipStatusSummary,
): string {
  if (summary.currentStatus === "active") {
    return "Your membership is active";
  }
  if (summary.currentStatus === "canceling") {
    return summary.activeThroughDate
      ? `Your membership is active through ${summary.activeThroughDate}`
      : "Your membership is active";
  }
  if (
    summary.recommendedAction === "contact_support" ||
    summary.legacyLinkState === "ambiguous"
  ) {
    return "We need to check your membership";
  }
  if (
    summary.currentStatus === "unknown" ||
    summary.recommendedAction === "wait"
  ) {
    return "We could not confirm your membership";
  }
  return "Your Knit it Now membership status";
}

/**
 * Whether purchase CTAs may be shown for this status summary.
 * Checkout protection remains separate and must also block active paid members.
 */
export function membershipStatusAllowsPurchase(
  summary: Pick<MembershipStatusSummary, "recommendedAction"> | null | undefined,
): boolean {
  if (!summary) return false;
  return summary.recommendedAction === "purchase";
}
