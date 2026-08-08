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
  annualSwitchOverlapWarning,
  canPurchaseAnnualWhileCancelingMonthly,
} from "./cancelingMonthlyAnnualCheckout";
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

const paidPlanIdSet = new Set<string>(PAID_MEMBERSHIP_PLAN_IDS);

export type AccountMembershipBillingInterval = "monthly" | "annual";

export type AccountMembershipPanelKind = "free" | "member";

/**
 * Action keys rendered as buttons/links on the Account membership panel.
 * - join: link to /membership (no recoverable paid subscription)
 * - manageBilling: Memberstack customer portal (active or past_due paid plans)
 * - switchToAnnual: annual checkout for canceling monthly members (period still active)
 * - renewAnnual / becomeMonthly: reuse the existing Memberstack checkout for
 *   legacy members who are not active Stripe subscribers
 */
export type AccountMembershipPanelAction =
  | "join"
  | "manageBilling"
  | "switchToAnnual"
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
  /**
   * Overlap notice when Switch to Annual is shown, including the formatted
   * monthly active-through date. Null when that action is hidden.
   */
  annualSwitchWarning: string | null;
  visibleActions: AccountMembershipPanelAction[];
};

/** Which action controls should be visible for a resolved membership kind. */
export function accountMembershipPanelActions(
  kind: AccountMembershipPanelKind,
  options?: { canceling?: boolean; switchToAnnual?: boolean },
): AccountMembershipPanelAction[] {
  if (kind === "free") return ["join"];
  // Manage Billing always for paid members. Switch to Annual only when a
  // canceling monthly member is eligible for the annual checkout exception.
  if (options?.switchToAnnual) {
    return ["manageBilling", "switchToAnnual"];
  }
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
  "Update your payment method, view invoices, or manage your subscription.";

const MANAGE_BILLING_DESCRIPTION_CANCELING =
  "You can update your payment information or reverse your cancellation from the billing portal if available.";

const MANAGE_BILLING_DESCRIPTION_PAST_DUE =
  "Update your payment method, view invoices, or manage your subscription.";

/** Plan label when an active paid connection has no recognized billing interval. */
const PAID_PLAN_FALLBACK_LABEL = "Knit it Now Membership";

/**
 * Memberstack statuses that still have a recoverable Stripe subscription and
 * should open the Customer Portal. PAST_DUE is intentionally included here and
 * not in access/status entitlement checks.
 */
const PORTAL_ELIGIBLE_PAID_STATUSES = new Set(["ACTIVE", "TRIALING", "PAST_DUE"]);

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

/**
 * True when a paid plan connection can open Stripe Customer Portal.
 * Includes PAST_DUE. Does not grant member access or change checkout decisions.
 */
export function isPortalEligiblePaidPlanConnection(conn: unknown): boolean {
  const record = asRecord(conn);
  const planId = planIdFromConnection(record);
  if (!planId || !paidPlanIdSet.has(planId)) {
    return false;
  }

  // Explicit inactive (except PAST_DUE) has no recoverable Stripe subscription.
  const status = String(record.status ?? "").trim().toUpperCase();
  if (record.active === false && status !== "PAST_DUE") return false;

  if (!status) {
    // Empty status: treat like entitlement connections (active unless false).
    return isActiveMemberstackPlanConnection(record);
  }

  return PORTAL_ELIGIBLE_PAID_STATUSES.has(status);
}

/**
 * First Memberstack paid plan connection eligible for Customer Portal
 * (ACTIVE / TRIALING / PAST_DUE). Uses plan connection status from Memberstack —
 * not Watson display labels.
 */
export function portalEligiblePaidPlanConnection(
  memberOrPayload: unknown,
): PlanConnection | null {
  for (const conn of planConnectionsFromPayload(memberOrPayload)) {
    if (!isPortalEligiblePaidPlanConnection(conn)) continue;
    return asRecord(conn) as PlanConnection;
  }
  return null;
}

/** True when Manage Billing should appear (active or past_due paid plan). */
export function memberHasStripeCustomerPortalAccess(
  memberOrPayload: unknown,
): boolean {
  return portalEligiblePaidPlanConnection(memberOrPayload) != null;
}

/** Active paid membership connection, if any. */
export function activePaidPlanConnection(
  memberOrPayload: unknown,
): PlanConnection | null {
  if (!memberHasActivePaidMembership(memberOrPayload)) return null;

  for (const conn of planConnectionsFromPayload(memberOrPayload)) {
    const record = asRecord(conn);
    if (!isActiveMemberstackPlanConnection(record)) continue;
    const planId = planIdFromConnection(record);
    if (!planId || !paidPlanIdSet.has(planId)) continue;
    return record as PlanConnection;
  }

  return null;
}

/**
 * Billing interval from a portal-eligible paid connection's known price id.
 * Used for past_due display without treating the connection as access-active.
 */
function billingIntervalFromPaidConnection(
  connection: PlanConnection | null,
): AccountMembershipBillingInterval | null {
  if (!connection) return null;
  const priceId = paidConnectionPriceId(connection);
  if (!priceId) return null;
  return buildPriceIndex().get(priceId)?.interval ?? null;
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
  return billingIntervalFromPaidConnection(activePaidPlanConnection(memberOrPayload));
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
    const switchToAnnual = canPurchaseAnnualWhileCancelingMonthly(memberOrPayload);
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
      annualSwitchWarning:
        switchToAnnual && cancelAtLabel
          ? annualSwitchOverlapWarning(cancelAtLabel)
          : null,
      visibleActions: accountMembershipPanelActions("member", {
        canceling: isCanceling,
        switchToAnnual,
      }),
    };
  }

  // Past-due paid Stripe subscription: Memberstack still has a recoverable
  // paid plan connection. Show Manage Billing so the member can update payment /
  // pay invoices. Does not change access entitlement or checkout decisions.
  const portalConnection = portalEligiblePaidPlanConnection(memberOrPayload);
  if (portalConnection) {
    const pastDueInterval = billingIntervalFromPaidConnection(portalConnection);
    return {
      kind: "member",
      planLabel: PAID_PLAN_FALLBACK_LABEL,
      planDisplayLabel: pastDueInterval
        ? PAID_PLAN_LABEL[pastDueInterval]
        : PAID_PLAN_FALLBACK_LABEL,
      statusLabel: "Past Due",
      billingInterval: pastDueInterval,
      billingLabel: pastDueInterval ? BILLING_LABEL[pastDueInterval] : null,
      renewsLabel: null,
      isCanceling: false,
      activeUntilMessage: null,
      autoRenewNote: null,
      manageBillingDescription: MANAGE_BILLING_DESCRIPTION_PAST_DUE,
      annualSwitchWarning: null,
      visibleActions: ["manageBilling"],
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
      annualSwitchWarning: null,
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
    annualSwitchWarning: null,
    visibleActions: accountMembershipPanelActions("free"),
  };
}
