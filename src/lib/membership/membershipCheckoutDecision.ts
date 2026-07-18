/**
 * Decide whether a logged-in member may start a membership checkout for a plan.
 *
 * Phase 1 rules:
 * - Active Premium ? manage billing (do not start checkout)
 * - Active Basic buying Basic again ? manage billing
 * - Active Basic buying Premium ? allow (upgrade path; labels come later)
 * - Canceled / expired / no active paid Basic|Premium ? allow
 * - Beta-only does not block paid subscribe
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
  | { action: "allow" }
  | {
      action: "manage";
      reason: "premium-active" | "basic-rebuy";
      message: string;
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

export function resolveMembershipCheckoutDecision(
  memberOrPayload: unknown,
  planKey: JoinCheckoutPlanKey,
): MembershipCheckoutDecision {
  if (memberHasActivePremiumPlan(memberOrPayload)) {
    return {
      action: "manage",
      reason: "premium-active",
      message:
        "You already have an active Premium membership. Manage billing from your workspace instead of starting a new checkout.",
    };
  }

  const tier = membershipTierFromPlanKey(planKey);
  if (tier === "basic" && memberHasActiveBasicPlan(memberOrPayload)) {
    return {
      action: "manage",
      reason: "basic-rebuy",
      message:
        "You already have an active Basic membership. Manage billing from your workspace instead of buying Basic again.",
    };
  }

  return { action: "allow" };
}
