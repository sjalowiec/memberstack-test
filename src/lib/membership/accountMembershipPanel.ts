/**
 * Resolve Account page membership panel display from a Memberstack payload.
 *
 * Uses paid-membership detection ? does not invent access rules.
 * Billing interval is shown only when an active paid connection maps to a
 * known Memberstack price id in `MEMBERSHIPS`.
 *
 * Canceling-but-still-active: Memberstack keeps status ACTIVE / active true and
 * sets payment.cancelAtDate to the paid-through date (Unix seconds).
 */

import { isActiveMemberstackPlanConnection } from "../memberAccess";
import { memberRecordFromMemberstackPayload } from "../patterns/memberstackMember";
import {
  FREE_MEMBERSHIP_DISPLAY_LABEL,
  PAID_MEMBERSHIP_PLAN_IDS,
  memberHasActiveFreeMembership,
  memberHasActivePaidMembership,
} from "./membershipCheckoutDecision";
import {
  buildPriceIndex,
  paidConnectionPriceId,
  type PlanConnection,
} from "./membershipSummary";

export type AccountMembershipBillingInterval = "monthly" | "annual";

export type AccountMembershipPanelKind = "free" | "member";

/**
 * Action keys rendered as buttons/links on the Account membership panel.
 * - join: link to /membership (no active membership)
 * - manageBilling: open the existing Stripe Customer Portal (active paid members)
 * - renewAnnual / becomeMonthly: reuse the existing Memberstack checkout for
 *   legacy members who are not active Stripe subscribers
 */
export type AccountMembershipPanelAction =
  | "join"
  | "manageBilling"
  | "renewAnnual"
  | "becomeMonthly";

export type AccountMembershipPanelView = {
  kind: AccountMembershipPanelKind;
  /**
   * Canonical membership name, shared with the /membership status panel/modal
   * (e.g. "Knit it Now Membership"). Kept stable so membership status display
   * does not change.
   */
  planLabel: string;
  /**
   * Account page "Current Plan" label, which folds the billing interval into
   * the name (e.g. "Monthly Membership" / "Annual Membership"). Account panel
   * only ? the status panel keeps using {@link planLabel}.
   */
  planDisplayLabel: string;
  statusLabel: string;
  billingInterval: AccountMembershipBillingInterval | null;
  /** "Monthly" / "Annual" for the /membership status panel; null when unknown. */
  billingLabel: string | null;
  /** Formatted local date for Renews, or null when the field should be hidden. */
  renewsLabel: string | null;
  /** True when an active paid plan has a valid payment.cancelAtDate. */
  isCanceling: boolean;
  /**
   * Full calm notice for canceling members, e.g.
   * "Your membership remains active until August 18, 2026."
   */
  activeUntilMessage: string | null;
  /**
   * Auto-renew reassurance line for active paid members, e.g.
   * "Membership renews automatically each month." Null while canceling or for
   * legacy/free/no-membership states.
   */
  autoRenewNote: string | null;
  /** Copy shown beneath the Manage Billing button; null when it is not shown. */
  manageBillingDescription: string | null;
  visibleActions: AccountMembershipPanelAction[];
};

/** Which action controls should be visible for a resolved membership kind. */
export function accountMembershipPanelActions(
  kind: AccountMembershipPanelKind,
  _options?: { canceling?: boolean },
): AccountMembershipPanelAction[] {
  if (kind === "free") return ["join"];
  // Active or canceling paid member: a single Manage Billing action opens the
  // Stripe Customer Portal, where payment method, plan change, cancellation and
  // reversing a cancellation already live.
  return ["manageBilling"];
}

const BILLING_LABEL: Record<AccountMembershipBillingInterval, string> = {
  monthly: "Monthly",
  annual: "Annual",
};

const PAID_PLAN_LABEL: Record<AccountMembershipBillingInterval, string> = {
  monthly: "Monthly Membership",
  annual: "Annual Membership",
};

const AUTO_RENEW_NOTE: Record<AccountMembershipBillingInterval, string> = {
  monthly: "Membership renews automatically each month.",
  annual: "Membership renews automatically each year.",
};

const MANAGE_BILLING_DESCRIPTION_ACTIVE =
  "Update your payment method, change your subscription, or cancel your membership.";

const MANAGE_BILLING_DESCRIPTION_CANCELING =
  "You can update your payment information or reverse your cancellation from the billing portal if available.";

/** Plan label when an active paid connection has no recognized billing interval. */
const PAID_PLAN_FALLBACK_LABEL = "Knit it Now Membership";

const MEMBERSHIP_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "long",
  day: "numeric",
  year: "numeric",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function planIdFromConnection(conn: Record<string, unknown>): string {
  for (const key of ["planId", "plan", "id"] as const) {
    const value = conn[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function planConnectionsFromPayload(memberOrPayload: unknown): unknown[] {
  const member = memberRecordFromMemberstackPayload(memberOrPayload);
  if (!member) return [];
  const root = asRecord(memberOrPayload);
  const data = asRecord(root.data ?? root);
  const connections = member.planConnections ?? data.planConnections;
  return Array.isArray(connections) ? connections : [];
}

/** Active paid membership connection, if any. */
export function activePaidPlanConnection(
  memberOrPayload: unknown,
): PlanConnection | null {
  if (!memberHasActivePaidMembership(memberOrPayload)) return null;

  const planIdSet = new Set<string>(PAID_MEMBERSHIP_PLAN_IDS);

  for (const conn of planConnectionsFromPayload(memberOrPayload)) {
    const record = asRecord(conn);
    if (!isActiveMemberstackPlanConnection(record)) continue;
    const planId = planIdFromConnection(record);
    if (!planId || !planIdSet.has(planId)) continue;
    return record as PlanConnection;
  }

  return null;
}

/**
 * Format a Memberstack Unix timestamp (seconds) as a local calendar date.
 * Returns null for missing/invalid values. Does not include time of day.
 */
export function formatMemberstackUnixDate(seconds: unknown): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", MEMBERSHIP_DATE_FORMAT).format(date);
}

/**
 * Formatted cancel-at date from the active paid connection, or null when not canceling.
 * Valid positive Unix `payment.cancelAtDate` is the source of truth (status stays ACTIVE).
 */
export function cancelAtLabelFromActivePaidConnection(
  memberOrPayload: unknown,
): string | null {
  const connection = activePaidPlanConnection(memberOrPayload);
  if (!connection?.payment) return null;
  return formatMemberstackUnixDate(connection.payment.cancelAtDate);
}

export function isCancelingActivePaidConnection(memberOrPayload: unknown): boolean {
  return Boolean(cancelAtLabelFromActivePaidConnection(memberOrPayload));
}

export function activeUntilMessageFromCancelAtLabel(cancelAtLabel: string): string {
  return `Your membership remains active until ${cancelAtLabel}.`;
}

/**
 * Billing interval from the active paid connection's known price id.
 * Returns null when the price id is missing or not in the current price index.
 */
export function billingIntervalFromActivePaidConnection(
  memberOrPayload: unknown,
): AccountMembershipBillingInterval | null {
  const connection = activePaidPlanConnection(memberOrPayload);
  if (!connection) return null;

  const priceId = paidConnectionPriceId(connection);
  if (!priceId) return null;

  const priceInfo = buildPriceIndex().get(priceId);
  return priceInfo?.interval ?? null;
}

/**
 * Renews label from payment.nextBillingDate on the active paid connection.
 * Hidden when a valid cancelAtDate is present (canceling-but-still-active).
 */
export function renewsLabelFromActivePaidConnection(
  memberOrPayload: unknown,
): string | null {
  const connection = activePaidPlanConnection(memberOrPayload);
  if (!connection) return null;

  const payment = connection.payment;
  if (!payment) return null;

  if (formatMemberstackUnixDate(payment.cancelAtDate)) return null;

  return formatMemberstackUnixDate(payment.nextBillingDate);
}

export function resolveAccountMembershipPanelView(
  memberOrPayload: unknown,
): AccountMembershipPanelView {
  const billingInterval = billingIntervalFromActivePaidConnection(memberOrPayload);
  const billingLabel = billingInterval ? BILLING_LABEL[billingInterval] : null;
  const cancelAtLabel = cancelAtLabelFromActivePaidConnection(memberOrPayload);
  const isCanceling = Boolean(cancelAtLabel);
  const renewsLabel = renewsLabelFromActivePaidConnection(memberOrPayload);
  const activeUntilMessage = cancelAtLabel
    ? activeUntilMessageFromCancelAtLabel(cancelAtLabel)
    : null;

  if (memberHasActivePaidMembership(memberOrPayload)) {
    return {
      kind: "member",
      planLabel: PAID_PLAN_FALLBACK_LABEL,
      planDisplayLabel: billingInterval
        ? PAID_PLAN_LABEL[billingInterval]
        : PAID_PLAN_FALLBACK_LABEL,
      statusLabel: isCanceling ? "Canceling" : "Active",
      billingInterval,
      billingLabel,
      renewsLabel,
      isCanceling,
      activeUntilMessage,
      autoRenewNote:
        !isCanceling && billingInterval ? AUTO_RENEW_NOTE[billingInterval] : null,
      manageBillingDescription: isCanceling
        ? MANAGE_BILLING_DESCRIPTION_CANCELING
        : MANAGE_BILLING_DESCRIPTION_ACTIVE,
      visibleActions: accountMembershipPanelActions("member", { canceling: isCanceling }),
    };
  }

  // Active free membership (e.g. "legacy membership"): full access, no Stripe
  // subscription. These legacy members are not active Stripe subscribers, so
  // offer the existing Memberstack checkout to renew annually or move to
  // monthly. No Stripe portal / manage billing action (there is no subscription
  // to manage).
  if (memberHasActiveFreeMembership(memberOrPayload)) {
    return {
      kind: "member",
      planLabel: FREE_MEMBERSHIP_DISPLAY_LABEL,
      planDisplayLabel: FREE_MEMBERSHIP_DISPLAY_LABEL,
      statusLabel: "Active",
      billingInterval: null,
      billingLabel: null,
      renewsLabel: null,
      isCanceling: false,
      activeUntilMessage: null,
      autoRenewNote: null,
      manageBillingDescription: null,
      visibleActions: ["renewAnnual", "becomeMonthly"],
    };
  }

  return {
    kind: "free",
    planLabel: "No active membership",
    planDisplayLabel: "No active membership",
    statusLabel: "No Active Membership",
    billingInterval: null,
    billingLabel: null,
    renewsLabel: null,
    isCanceling: false,
    activeUntilMessage: null,
    autoRenewNote: null,
    manageBillingDescription: null,
    visibleActions: accountMembershipPanelActions("free"),
  };
}
