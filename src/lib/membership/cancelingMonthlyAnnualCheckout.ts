/**
 * Narrow exception: canceling monthly members may start annual checkout while
 * monthly access remains through period end. Does not cancel or modify monthly.
 */

import {
  LEGACY_PAID_MEMBER_PLAN_IDS,
  MEMBERSHIPS,
} from "../../config/memberships";
import { isActiveMemberstackPlanConnection } from "../memberAccess";
import { memberRecordFromMemberstackPayload } from "../patterns/memberstackMember";
import {
  buildPriceIndex,
  paidConnectionPriceId,
  type PlanConnection,
} from "./membershipSummary";

const paidPlanIdSet = new Set<string>([
  MEMBERSHIPS.membership.memberstackPlanId,
  ...LEGACY_PAID_MEMBER_PLAN_IDS,
]);

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

function hasValidCancelAtDate(connection: PlanConnection): boolean {
  const cancelAt = connection.payment?.cancelAtDate;
  return typeof cancelAt === "number" && Number.isFinite(cancelAt) && cancelAt > 0;
}

/**
 * True when the member has a paid monthly subscription canceling at period end
 * and does not already have an active annual subscription.
 */
export function canPurchaseAnnualWhileCancelingMonthly(
  memberOrPayload: unknown,
): boolean {
  const priceIndex = buildPriceIndex();
  let hasCancelingMonthly = false;
  let hasActiveAnnual = false;

  for (const conn of planConnectionsFromPayload(memberOrPayload)) {
    const record = asRecord(conn);
    if (!isActiveMemberstackPlanConnection(record)) continue;
    const planId = planIdFromConnection(record);
    if (!planId || !paidPlanIdSet.has(planId)) continue;

    const connection = record as PlanConnection;
    const priceId = paidConnectionPriceId(connection);
    const interval = priceId ? priceIndex.get(priceId)?.interval : undefined;
    if (interval === "annual") {
      hasActiveAnnual = true;
    } else if (interval === "monthly" && hasValidCancelAtDate(connection)) {
      hasCancelingMonthly = true;
    }
  }

  return hasCancelingMonthly && !hasActiveAnnual;
}

/** Overlap notice for the Account panel; uses a pre-formatted active-through date. */
export function annualSwitchOverlapWarning(activeThroughDateLabel: string): string {
  return (
    `Purchasing annual now will start the annual membership immediately. ` +
    `Your monthly membership will remain active until ${activeThroughDateLabel}.`
  );
}
