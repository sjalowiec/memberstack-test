/**
 * Decide how a logged-in member may start a membership checkout action.
 *
 * Business rule: one active recurring Knit It Now membership only.
 * - No active paid plan → purchase (Stripe Checkout via purchasePlansWithCheckout)
 * - Active paid member → current (disabled UI; manage billing via portal)
 * - Exception: canceling monthly (no active annual) may purchase annual only
 * - Beta-only does not count as paid membership
 */

import {
  FREE_ACCESS_MEMBER_PLAN_IDS,
  LEGACY_PAID_MEMBER_PLAN_IDS,
  MEMBERSHIPS,
} from "../../config/memberships";
import { getActivePlanIds } from "../memberAccess";
import { canPurchaseAnnualWhileCancelingMonthly } from "./cancelingMonthlyAnnualCheckout";
import type { JoinCheckoutPlanKey } from "./pendingMembershipCheckout";

/** Current + legacy plan ids that count as paid Knit it Now membership. */
export const PAID_MEMBERSHIP_PLAN_IDS = [
  MEMBERSHIPS.membership.memberstackPlanId,
  ...LEGACY_PAID_MEMBER_PLAN_IDS,
] as const;

const paidPlanIdSet = new Set<string>(PAID_MEMBERSHIP_PLAN_IDS);

/**
 * Active free plan ids that grant full member access without any Stripe billing,
 * checkout, or renewal (e.g. the "legacy membership" free plan). These are NOT
 * paid membership: they never affect `memberHasActivePaidMembership`, checkout
 * decisions, billing intervals, or pricing.
 */
export const FREE_MEMBERSHIP_PLAN_IDS = [...FREE_ACCESS_MEMBER_PLAN_IDS] as const;

/** Customer-facing display label for the active free legacy membership plan. */
export const FREE_MEMBERSHIP_DISPLAY_LABEL = "Legacy Membership";

const freePlanIdSet = new Set<string>(FREE_MEMBERSHIP_PLAN_IDS);

export type MembershipCheckoutDecision =
  | { action: "purchase" }
  | { action: "current" };

export function memberHasActivePaidMembership(memberOrPayload: unknown): boolean {
  return getActivePlanIds(memberOrPayload).some((id) => paidPlanIdSet.has(id));
}

/**
 * True when the member has an active connection to a free membership plan (no
 * paid subscription). Used only for status/account display so these members are
 * not shown as having no membership. Does not grant billing or checkout state.
 */
export function memberHasActiveFreeMembership(memberOrPayload: unknown): boolean {
  return getActivePlanIds(memberOrPayload).some((id) => freePlanIdSet.has(id));
}

export function resolveMembershipCheckoutDecision(
  memberOrPayload: unknown,
  planKey: JoinCheckoutPlanKey,
): MembershipCheckoutDecision {
  if (memberHasActivePaidMembership(memberOrPayload)) {
    if (
      planKey === "annual" &&
      canPurchaseAnnualWhileCancelingMonthly(memberOrPayload)
    ) {
      return { action: "purchase" };
    }
    return { action: "current" };
  }
  return { action: "purchase" };
}
