/**
 * Watson customer-profile "current membership" display.
 *
 * Reuses the same Memberstack summary + membership-status helpers as Account /
 * /membership. Does not invent a second status engine. Paid Memberstack always
 * wins over Legacy for the primary fields; Watson `subscriptionexpiring` stays
 * available as a clearly labeled historical record.
 */

import {
  resolveAccountMembershipPanelView,
} from "../membership/accountMembershipPanel";
import { FREE_MEMBERSHIP_DISPLAY_LABEL } from "../membership/membershipCheckoutDecision";
import type { MemberstackMember } from "../membership/membershipSummary";
import {
  buildMembershipStatusSummary,
  calendarYmdForNow,
  MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
  resolveLegacyExpirationTiming,
  type LegacyExpirationTiming,
  type MembershipStatusLegacyContext,
  type MembershipStatusSummary,
} from "../membership/membershipStatusSummary";
import type { CustomerMemberstackSummary } from "./customerMemberstack";

export type WatsonMembershipSource = "Memberstack/Stripe" | "Legacy";

export type WatsonCurrentMembershipLinkStatus =
  | "linked"
  | "not_found"
  | "load_error"
  | "ambiguous"
  | "not_applicable";

export type WatsonCurrentMembershipTone = "active" | "inactive" | "unknown" | "not_linked";

export interface WatsonCustomerCurrentMembership {
  /** e.g. "Monthly Membership", "Annual Membership", "Legacy Membership" */
  currentPlan: string | null;
  /** e.g. "Active", "Canceling", "Legacy Access", "Expired" */
  currentStatus: string | null;
  membershipStatusTone: WatsonCurrentMembershipTone;
  /** "Next renewal" | "Active through" | "Paid through" */
  primaryDateLabel: string | null;
  primaryDateValue: string | null;
  membershipSource: WatsonMembershipSource | null;
  /** True when paid Memberstack is the current membership (legacy date is historical). */
  isPaidMemberstack: boolean;
}

function resolveStatusLabel(
  summary: MembershipStatusSummary,
  legacyTiming: LegacyExpirationTiming | null,
): string | null {
  switch (summary.currentStatus) {
    case "canceling":
      return "Canceling";
    case "active":
      return summary.accountType === "free_membership" ? "Legacy Access" : "Active";
  }

  if (legacyTiming === "legacy_paid_through_future") return "Legacy Access";
  if (legacyTiming === "legacy_expired") return "Expired";
  if (summary.currentStatus === "inactive") return "Expired";
  return null;
}

function toneForStatus(
  status: string | null,
  summary: MembershipStatusSummary | null,
): WatsonCurrentMembershipTone {
  if (!status) return "unknown";
  if (status === "Active" || status === "Legacy Access" || status === "Canceling") {
    return "active";
  }
  if (status === "Expired") return "inactive";
  if (summary?.currentStatus === "no_plan") return "unknown";
  if (summary?.currentStatus === "inactive") return "inactive";
  return "unknown";
}

/**
 * Build the primary current-membership fields for the Watson customer header.
 * Prefer calling this with the same Memberstack member already loaded for
 * {@link buildCustomerMemberstackSummary}.
 */
export function buildWatsonCustomerCurrentMembership(input: {
  memberstackMember: MemberstackMember | null;
  memberstackSummary: CustomerMemberstackSummary;
  memberstackLinkStatus: WatsonCurrentMembershipLinkStatus;
  legacy: MembershipStatusLegacyContext;
  /**
   * Display string for Watson `subscriptionexpiring` (or timeline fallback).
   * Used as the current paid-through date when Legacy is the active source.
   */
  legacyAccessThroughDisplay?: string | null;
  now?: Date;
}): WatsonCustomerCurrentMembership {
  const empty: WatsonCustomerCurrentMembership = {
    currentPlan: null,
    currentStatus: null,
    membershipStatusTone: "unknown",
    primaryDateLabel: null,
    primaryDateValue: null,
    membershipSource: null,
    isPaidMemberstack: false,
  };

  if (
    input.memberstackLinkStatus === "not_found" ||
    input.memberstackLinkStatus === "load_error" ||
    input.memberstackLinkStatus === "ambiguous"
  ) {
    // Legacy-only / lookup-failed profiles: surface Watson paid-through as current
    // when it is the only membership signal.
    const todayYmd = calendarYmdForNow(
      input.now ?? new Date(),
      MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
    );
    const legacyTiming =
      input.legacy.linkState === "linked"
        ? resolveLegacyExpirationTiming(input.legacy.legacyExpirationYmd, todayYmd)
        : null;
    const legacyDisplay =
      input.legacyAccessThroughDisplay ?? input.legacy.legacyExpirationDate ?? null;

    if (legacyTiming === "legacy_paid_through_future" && legacyDisplay) {
      return {
        currentPlan: input.legacy.previousPlanName,
        currentStatus: "Legacy Access",
        membershipStatusTone: "active",
        primaryDateLabel: "Paid through",
        primaryDateValue: legacyDisplay,
        membershipSource: "Legacy",
        isPaidMemberstack: false,
      };
    }
    if (legacyTiming === "legacy_expired" && legacyDisplay) {
      return {
        currentPlan: input.legacy.previousPlanName,
        currentStatus: "Expired",
        membershipStatusTone: "inactive",
        primaryDateLabel: "Paid through",
        primaryDateValue: legacyDisplay,
        membershipSource: "Legacy",
        isPaidMemberstack: false,
      };
    }
    return empty;
  }

  if (
    !input.memberstackMember ||
    !input.memberstackSummary.configured ||
    input.memberstackSummary.loadError ||
    !input.memberstackSummary.memberstackId
  ) {
    return empty;
  }

  const summary = buildMembershipStatusSummary({
    memberstackMember: input.memberstackMember,
    memberstackSummary: input.memberstackSummary,
    memberstackLookupOk: true,
    legacy: input.legacy,
    now: input.now,
  });

  const todayYmd = calendarYmdForNow(
    input.now ?? new Date(),
    MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
  );
  const legacyDisplayYmd = input.legacy.legacyExpirationYmd;
  const legacyTiming =
    input.legacy.linkState === "linked"
      ? resolveLegacyExpirationTiming(legacyDisplayYmd, todayYmd)
      : null;
  const legacyDisplay =
    input.legacyAccessThroughDisplay ?? input.legacy.legacyExpirationDate ?? null;

  const statusLabel = resolveStatusLabel(summary, legacyTiming);
  const panel = resolveAccountMembershipPanelView({ data: input.memberstackMember });
  const isPaidMemberstack = summary.accountType === "paid_membership";

  if (isPaidMemberstack) {
    const isCanceling = summary.currentStatus === "canceling";
    return {
      currentPlan: panel.planDisplayLabel,
      currentStatus: statusLabel,
      membershipStatusTone: toneForStatus(statusLabel, summary),
      primaryDateLabel: isCanceling ? "Active through" : "Next renewal",
      primaryDateValue: isCanceling
        ? summary.activeThroughDate
        : panel.renewsLabel,
      membershipSource: "Memberstack/Stripe",
      isPaidMemberstack: true,
    };
  }

  if (summary.accountType === "free_membership") {
    return {
      currentPlan: FREE_MEMBERSHIP_DISPLAY_LABEL,
      currentStatus: statusLabel,
      membershipStatusTone: toneForStatus(statusLabel, summary),
      primaryDateLabel: legacyDisplay ? "Paid through" : null,
      primaryDateValue: legacyDisplay,
      membershipSource: "Legacy",
      isPaidMemberstack: false,
    };
  }

  // No active paid/free Memberstack plan ù legacy paid-through may still be current.
  if (legacyTiming === "legacy_paid_through_future" && legacyDisplay) {
    return {
      currentPlan: summary.previousPlanName,
      currentStatus: statusLabel ?? "Legacy Access",
      membershipStatusTone: "active",
      primaryDateLabel: "Paid through",
      primaryDateValue: legacyDisplay,
      membershipSource: "Legacy",
      isPaidMemberstack: false,
    };
  }

  if (legacyTiming === "legacy_expired" && legacyDisplay) {
    return {
      currentPlan: summary.previousPlanName,
      currentStatus: statusLabel ?? "Expired",
      membershipStatusTone: "inactive",
      primaryDateLabel: "Paid through",
      primaryDateValue: legacyDisplay,
      membershipSource: "Legacy",
      isPaidMemberstack: false,
    };
  }

  if (statusLabel) {
    return {
      currentPlan: summary.currentPlanName,
      currentStatus: statusLabel,
      membershipStatusTone: toneForStatus(statusLabel, summary),
      primaryDateLabel: null,
      primaryDateValue: null,
      membershipSource: null,
      isPaidMemberstack: false,
    };
  }

  // Fall back to crude Memberstack connection label (No Plan / Inactive).
  const fallbackStatus = input.memberstackSummary.membershipStatusLabel;
  return {
    currentPlan: null,
    currentStatus: fallbackStatus,
    membershipStatusTone: toneForStatus(fallbackStatus, summary),
    primaryDateLabel: null,
    primaryDateValue: null,
    membershipSource: null,
    isPaidMemberstack: false,
  };
}

/** Build a minimal legacy context from Watson paid-through fields already on the profile. */
export function watsonLegacyContextFromPaidThrough(input: {
  hasLegacyHistory: boolean;
  legacyExpirationYmd: string | null;
  legacyExpirationDate: string | null;
  previousPlanName?: string | null;
  ambiguous?: boolean;
}): MembershipStatusLegacyContext {
  if (input.ambiguous) {
    return {
      linkState: "ambiguous",
      legacyExpirationDate: null,
      legacyExpirationYmd: null,
      previousPlanName: null,
    };
  }
  if (!input.hasLegacyHistory) {
    return {
      linkState: "not_found",
      legacyExpirationDate: null,
      legacyExpirationYmd: null,
      previousPlanName: null,
    };
  }
  return {
    linkState: "linked",
    legacyExpirationYmd: input.legacyExpirationYmd,
    legacyExpirationDate: input.legacyExpirationDate,
    previousPlanName: input.previousPlanName ?? null,
  };
}
