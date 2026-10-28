/**
 * Pure display reconciliation for the Account "Current Membership" panel.
 *
 * account-membership.ts can only see Memberstack plus a remembered paid-through
 * date. This helper overlays the server detail so Plan, Status, and actions
 * match hasMemberAccess: active/manage, ended/purchase, or could-not-confirm.
 */

import type { AccountMembershipDetail } from "./accountMembershipDetail";
import {
  ACCOUNT_MEMBERSHIP_UNCONFIRMED_PLAN_LABEL,
  ACCOUNT_MEMBERSHIP_UNCONFIRMED_STATUS_LABEL,
  MANAGE_BILLING_DESCRIPTION_ACTIVE,
  type AccountMembershipPanelAction,
} from "./accountMembershipPanel";
import { FREE_MEMBERSHIP_DISPLAY_LABEL } from "./membershipCheckoutDecision";

export interface AccountMembershipDetailView {
  /** Plan label to apply when non-null; null keeps the live plan. */
  planOverride: string | null;
  /** Status label to apply when non-null; null keeps the live status. */
  statusOverride: string | null;
  /** Legacy access row value, e.g. "Available through {date}" / "Ended {date}". */
  legacyAccessValue: string | null;
  /**
   * Label for the panel's single primary date row. Legacy members (any state
   * with a current-status legacy access date) read "Legacy Access Through";
   * everyone else reads "Member Since". Null when there is no date to show.
   */
  membershipDateLabel: string | null;
  /**
   * Value for the primary date row: the authoritative legacy access-through date
   * for current-status legacy members, otherwise the member-since date.
   */
  membershipDateValue: string | null;
  /** Action keys to show; empty hides purchase while status is unconfirmed. */
  visibleActions: AccountMembershipPanelAction[] | null;
  history: {
    visible: boolean;
    count: number;
    headerLabel: string | null;
  };
}

type AccountMembershipDetailViewInput = Pick<
  AccountMembershipDetail,
  | "identified"
  | "membershipName"
  | "statusLabel"
  | "billingLabel"
  | "legacyPaidThroughDate"
  | "legacyAccessActive"
  | "memberSince"
  | "history"
>;

export type AccountMembershipDetailPaint = {
  /** Null keeps the label already on screen. */
  planLabel: string | null;
  statusLabel: string | null;
  visibleActions: AccountMembershipPanelAction[] | null;
  /** Set the panel kind to member after replacing unconfirmed labels. */
  markMember: boolean;
  manageBillingDescription: string | null;
};

export const LEGACY_ACCESS_THROUGH_LABEL = "Legacy Access Through";
export const MEMBER_SINCE_LABEL = "Member Since";

function historyView(
  identified: boolean,
  history: AccountMembershipDetailViewInput["history"],
): AccountMembershipDetailView["history"] {
  const count = Array.isArray(history) ? history.length : 0;
  const visible = identified === true && count > 0;
  return {
    visible,
    count,
    headerLabel: visible ? `Membership History (${count})` : null,
  };
}

export function resolveAccountMembershipDetailView(
  detail: AccountMembershipDetailViewInput,
): AccountMembershipDetailView {
  const unconfirmed =
    detail.identified !== true ||
    detail.statusLabel === ACCOUNT_MEMBERSHIP_UNCONFIRMED_STATUS_LABEL;

  if (unconfirmed) {
    const memberSince = detail.identified === true ? (detail.memberSince ?? null) : null;
    return {
      planOverride: ACCOUNT_MEMBERSHIP_UNCONFIRMED_PLAN_LABEL,
      statusOverride: ACCOUNT_MEMBERSHIP_UNCONFIRMED_STATUS_LABEL,
      legacyAccessValue: null,
      membershipDateLabel: memberSince ? MEMBER_SINCE_LABEL : null,
      membershipDateValue: memberSince,
      visibleActions: [],
      history: historyView(detail.identified === true, detail.history),
    };
  }

  const legacyEnded = detail.legacyAccessActive === false;
  const hasLegacyAccessDate = detail.legacyPaidThroughDate != null;
  const isLegacyPresentation =
    hasLegacyAccessDate &&
    (detail.membershipName == null ||
      detail.membershipName === FREE_MEMBERSHIP_DISPLAY_LABEL);

  const memberSince = detail.memberSince ?? null;
  const membershipDateValue = hasLegacyAccessDate
    ? detail.legacyPaidThroughDate
    : memberSince;
  const membershipDateLabel = membershipDateValue
    ? hasLegacyAccessDate
      ? LEGACY_ACCESS_THROUGH_LABEL
      : MEMBER_SINCE_LABEL
    : null;

  if (isLegacyPresentation) {
    return {
      planOverride: FREE_MEMBERSHIP_DISPLAY_LABEL,
      statusOverride: legacyEnded ? "Expired" : "Legacy Access",
      legacyAccessValue: detail.legacyPaidThroughDate
        ? legacyEnded
          ? `Ended ${detail.legacyPaidThroughDate}`
          : `Available through ${detail.legacyPaidThroughDate}`
        : null,
      membershipDateLabel,
      membershipDateValue,
      visibleActions: legacyEnded ? ["join"] : ["renewAnnual", "becomeMonthly"],
      history: historyView(true, detail.history),
    };
  }

  if (detail.statusLabel === "Expired" || detail.membershipName == null) {
    return {
      planOverride: detail.membershipName ?? "No active membership",
      statusOverride: detail.statusLabel ?? "No Active Membership",
      legacyAccessValue: null,
      membershipDateLabel,
      membershipDateValue,
      visibleActions: ["join"],
      history: historyView(true, detail.history),
    };
  }

  return {
    planOverride: null,
    statusOverride: null,
    legacyAccessValue: null,
    membershipDateLabel,
    membershipDateValue,
    visibleActions: null,
    history: historyView(true, detail.history),
  };
}

function blankOrUnconfirmed(value: string): boolean {
  const text = value.trim();
  return (
    text === "" ||
    text === ACCOUNT_MEMBERSHIP_UNCONFIRMED_PLAN_LABEL ||
    text === ACCOUNT_MEMBERSHIP_UNCONFIRMED_STATUS_LABEL
  );
}

function isIdentifiedActivePaid(detail: AccountMembershipDetailViewInput): boolean {
  return (
    detail.identified === true &&
    (detail.statusLabel === "Active" || detail.statusLabel === "Canceling") &&
    detail.membershipName != null &&
    detail.membershipName !== FREE_MEMBERSHIP_DISPLAY_LABEL &&
    detail.membershipName !== ACCOUNT_MEMBERSHIP_UNCONFIRMED_PLAN_LABEL
  );
}

function paidPlanDisplayFromBilling(
  billingLabel: string | null | undefined,
  membershipName: string | null,
): string {
  if (billingLabel === "Annual") return "Annual Membership";
  if (billingLabel === "Monthly") return "Monthly Membership";
  return membershipName ?? "Knit it Now Membership";
}

/**
 * Labels to write onto the account panel. An identified active paid detail
 * replaces unconfirmed or still-blank plan and status text. A panel that
 * already shows the live membership is left alone so canceling actions stay.
 */
export function resolveAccountMembershipDetailPaint(
  detail: AccountMembershipDetailViewInput,
  current: { planLabel: string; statusLabel: string },
): AccountMembershipDetailPaint {
  const view = resolveAccountMembershipDetailView(detail);
  if (view.planOverride || view.statusOverride) {
    return {
      planLabel: view.planOverride,
      statusLabel: view.statusOverride,
      visibleActions: view.visibleActions,
      markMember: false,
      manageBillingDescription: null,
    };
  }

  const currentUnconfirmed =
    blankOrUnconfirmed(current.planLabel) || blankOrUnconfirmed(current.statusLabel);
  if (currentUnconfirmed && isIdentifiedActivePaid(detail)) {
    return {
      planLabel: paidPlanDisplayFromBilling(detail.billingLabel, detail.membershipName),
      statusLabel: detail.statusLabel,
      visibleActions: ["manageBilling"],
      markMember: true,
      manageBillingDescription: MANAGE_BILLING_DESCRIPTION_ACTIVE,
    };
  }

  return {
    planLabel: null,
    statusLabel: null,
    visibleActions: view.visibleActions,
    markMember: false,
    manageBillingDescription: null,
  };
}
