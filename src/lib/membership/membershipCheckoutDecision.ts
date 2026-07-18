/**
 * Decide how a logged-in member may start a membership plan action.
 *
 * Business rule: one active recurring Knit It Now membership only.
 * - No active paid plan ? purchase (Stripe Checkout via purchasePlansWithCheckout)
 * - Active member choosing their current tier ? current (disabled UI; no checkout)
 * - Active member switching tiers ? update (Memberstack data-ms-price:update)
 * - Beta-only does not count as paid membership
 */

import {
  LEGACY_MEMBERSHIPS,
  LEGACY_PREMIUM_MEMBER_PLAN_IDS,
  MEMBERSHIPS,
} from "../../config/memberships";
import { getActivePlanIds } from "../memberAccess";
import type { JoinCheckoutPlanKey } from "./pendingMembershipCheckout";

export const BASIC_MEMBERSHIP_PLAN_IDS = [
  MEMBERSHIPS.basic.memberstackPlanId,
  LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId,
  LEGACY_MEMBERSHIPS.annualBasic.memberstackPlanId,
] as const;

export const PREMIUM_MEMBERSHIP_PLAN_IDS = [
  MEMBERSHIPS.premium.memberstackPlanId,
  ...LEGACY_PREMIUM_MEMBER_PLAN_IDS,
] as const;

const basicPlanIdSet = new Set<string>(BASIC_MEMBERSHIP_PLAN_IDS);
const premiumPlanIdSet = new Set<string>(PREMIUM_MEMBERSHIP_PLAN_IDS);

export type MembershipCheckoutTier = "basic" | "premium";

export type MembershipCheckoutDecision =
  | { action: "purchase" }
  | { action: "update" }
  | {
      action: "current";
      tier: MembershipCheckoutTier;
    };

export function membershipTierFromPlanKey(planKey: JoinCheckoutPlanKey): MembershipCheckoutTier {
  return planKey.startsWith("basic") ? "basic" : "premium";
}

export function memberHasActiveBasicPlan(memberOrPayload: unknown): boolean {
  return getActivePlanIds(memberOrPayload).some((id) => basicPlanIdSet.has(id));
}

export function memberHasActivePremiumPlan(memberOrPayload: unknown): boolean {
  return getActivePlanIds(memberOrPayload).some((id) => premiumPlanIdSet.has(id));
}

/** Active paid tier for CTA labels. Premium wins if both somehow appear. */
export function memberActivePaidMembershipTier(
  memberOrPayload: unknown,
): MembershipCheckoutTier | null {
  if (memberHasActivePremiumPlan(memberOrPayload)) return "premium";
  if (memberHasActiveBasicPlan(memberOrPayload)) return "basic";
  return null;
}

export function resolveMembershipCheckoutDecision(
  memberOrPayload: unknown,
  planKey: JoinCheckoutPlanKey,
): MembershipCheckoutDecision {
  const targetTier = membershipTierFromPlanKey(planKey);
  const activeTier = memberActivePaidMembershipTier(memberOrPayload);

  if (!activeTier) {
    return { action: "purchase" };
  }

  if (activeTier === targetTier) {
    return { action: "current", tier: activeTier };
  }

  // Cross-tier switch: Memberstack data-ms-price:update (replace), never add/purchase.
  return { action: "update" };
}
