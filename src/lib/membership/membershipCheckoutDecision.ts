/**
 * Decide how a logged-in member may start a membership checkout action.
 *
 * Business rule: one active recurring Knit It Now membership only.
 * - No active paid plan → purchase (Stripe Checkout via purchasePlansWithCheckout)
 * - Active paid member → current (disabled UI; manage billing via portal)
 * - Beta-only does not count as paid membership
 */

import {
  LEGACY_PAID_MEMBER_PLAN_IDS,
  MEMBERSHIPS,
} from "../../config/memberships";
import { getActivePlanIds } from "../memberAccess";
import type { JoinCheckoutPlanKey } from "./pendingMembershipCheckout";

/** Current + legacy plan ids that count as paid Knit it Now membership. */
export const PAID_MEMBERSHIP_PLAN_IDS = [
  MEMBERSHIPS.membership.memberstackPlanId,
  ...LEGACY_PAID_MEMBER_PLAN_IDS,
] as const;

const paidPlanIdSet = new Set<string>(PAID_MEMBERSHIP_PLAN_IDS);

export type MembershipCheckoutDecision =
  | { action: "purchase" }
  | { action: "current" };

export function memberHasActivePaidMembership(memberOrPayload: unknown): boolean {
  return getActivePlanIds(memberOrPayload).some((id) => paidPlanIdSet.has(id));
}

export function resolveMembershipCheckoutDecision(
  memberOrPayload: unknown,
  _planKey: JoinCheckoutPlanKey,
): MembershipCheckoutDecision {
  if (memberHasActivePaidMembership(memberOrPayload)) {
    return { action: "current" };
  }
  return { action: "purchase" };
}
