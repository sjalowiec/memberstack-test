/**
 * Resolve Account page membership panel display from a Memberstack payload.
 *
 * Uses existing Basic/Premium detection — does not invent access rules.
 * Billing interval is shown only when an active paid connection maps to a
 * known Memberstack price id in `MEMBERSHIPS`.
 *
 * Canceling-but-still-active: Memberstack keeps status ACTIVE / active true and
 * sets payment.cancelAtDate to the paid-through date (Unix seconds).
 */

import { isActiveMemberstackPlanConnection } from "../memberAccess";
import { memberRecordFromMemberstackPayload } from "../patterns/memberstackMember";
import {
  BASIC_MEMBERSHIP_PLAN_IDS,
  PREMIUM_MEMBERSHIP_PLAN_IDS,
  memberActivePaidMembershipTier,
  memberHasActiveBasicPlan,
  memberHasActivePremiumPlan,
} from "./membershipCheckoutDecision";
import {
  buildPriceIndex,
  paidConnectionPriceId,
  type PlanConnection,
} from "./membershipSummary";

export type AccountMembershipBillingInterval = "monthly" | "annual";

export type AccountMembershipPanelKind = "free" | "basic" | "premium";

/** Action keys rendered as buttons/links on the Account membership panel. */
export type AccountMembershipPanelAction =
  | "join-basic"
  | "join-premium"
  | "upgrade"
  | "manage";

export type AccountMembershipPanelView = {
  kind: AccountMembershipPanelKind;
  planLabel: string;
  statusLabel: string;
  billingInterval: AccountMembershipBillingInterval | null;
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
  visibleActions: AccountMembershipPanelAction[];
};

/** Which action controls should be visible for a resolved membership kind. */
export function accountMembershipPanelActions(
  kind: AccountMembershipPanelKind,
  options?: { canceling?: boolean },
): AccountMembershipPanelAction[] {
  if (kind === "free") return ["join-basic", "join-premium"];
  // Canceling Basic or Premium: manage only (no upgrade / join while still entitled).
  if (options?.canceling) return ["manage"];
  if (kind === "basic") return ["upgrade", "manage"];
  return ["manage"];
}

const BILLING_LABEL: Record<AccountMembershipBillingInterval, string> = {
  monthly: "Monthly",
  annual: "Annual",
};

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

/** Active Basic/Premium connection for the member's current paid tier, if any. */
export function activePaidPlanConnection(
  memberOrPayload: unknown,
): PlanConnection | null {
  const tier = memberActivePaidMembershipTier(memberOrPayload);
  if (!tier) return null;

  const planIdSet = new Set<string>(
    tier === "premium" ? PREMIUM_MEMBERSHIP_PLAN_IDS : BASIC_MEMBERSHIP_PLAN_IDS,
  );

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
 * Billing interval from the active Basic/Premium connection's known price id.
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

  if (memberHasActivePremiumPlan(memberOrPayload)) {
    return {
      kind: "premium",
      planLabel: "Premium",
      statusLabel: isCanceling ? "Canceling" : "Active",
      billingInterval,
      billingLabel,
      renewsLabel,
      isCanceling,
      activeUntilMessage,
      visibleActions: accountMembershipPanelActions("premium", { canceling: isCanceling }),
    };
  }

  if (memberHasActiveBasicPlan(memberOrPayload)) {
    return {
      kind: "basic",
      planLabel: "Basic",
      statusLabel: isCanceling ? "Canceling" : "Active",
      billingInterval,
      billingLabel,
      renewsLabel,
      isCanceling,
      activeUntilMessage,
      visibleActions: accountMembershipPanelActions("basic", { canceling: isCanceling }),
    };
  }

  return {
    kind: "free",
    planLabel: "No active membership",
    statusLabel: "Free account",
    billingInterval: null,
    billingLabel: null,
    renewsLabel: null,
    isCanceling: false,
    activeUntilMessage: null,
    visibleActions: accountMembershipPanelActions("free"),
  };
}
