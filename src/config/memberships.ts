/**
 * Knit It Now Membership Configuration
 *
 * Single source of truth for Memberstack plan IDs (access control) and price
 * IDs (checkout). Do not hard-code these values elsewhere in the application.
 *
 * Model:
 *   - One paid membership (Knit it Now Membership), plus Beta.
 *   - The paid membership has two prices: monthly and annual.
 *   - Access control keys off the PLAN id; checkout keys off the PRICE id.
 *
 * Plan/price IDs below are the former Premium product IDs — kept as the live
 * paid membership. Do not change them here without matching Memberstack/Stripe.
 */

/* ============================================================================
 * CURRENT PLANS — active Memberstack products
 * ==========================================================================*/
export const MEMBERSHIPS = {
  beta: {
    name: "KIN Beta Access",
    memberstackPlanId: "pln_kin-beta-access-vyek0a38",
  },

  membership: {
    name: "Knit it Now Membership",
    memberstackPlanId: "pln_kin-membership-annual-premium-tn5b0cxj",
    prices: {
      monthly: {
        price: 19.99,
        memberstackPriceId: "prc_monthly-subscription-to-knititnow-webw0nzy",
      },
      annual: {
        price: 228,
        memberstackPriceId: "prc_knit-it-now-premium-annual-membership-1g1bg070r",
      },
    },
  },
} as const;

/* ============================================================================
 * LEGACY PLANS — access allow list ONLY (never used for checkout)
 * --------------------------------------------------------------------------
 * These plans are no longer sold. They remain here solely so existing members
 * whose Memberstack records still carry these plan connections keep member
 * access. Remove once no live members hold them.
 *
 * Includes retired plan shells that still appear on some Memberstack records.
 * The removed Basic plan (`pln_kin-membership-annual-basic-je3s0vpe`) is
 * intentionally omitted — it must not grant access.
 * ==========================================================================*/
export const LEGACY_MEMBERSHIPS = {
  monthlyBasic: {
    name: "KIN Membership Monthly Basic (retired)",
    memberstackPlanId: "pln_kin-membership-monthly-a59701wy",
  },
  grandfatheredAnnual: {
    name: "KIN Membership Annual (grandfathered)",
    memberstackPlanId: "pln_kin-membership-annual-qf9g01et",
  },
  monthlyPremium: {
    name: "KIN Membership Monthly Premium (retired)",
    memberstackPlanId: "pln_kin-membership-monthly-premium-915u0c2f",
  },
  /**
   * Old Memberstack plan shell still used by some Stripe-synced monthly members.
   * Same price as current membership monthly
   * (`prc_monthly-subscription-to-knititnow-webw0nzy`); plan product is now
   * `MEMBERSHIPS.membership`.
   */
  monthlySubscription: {
    name: "Monthly Subscription to Knititnow (retired plan shell)",
    memberstackPlanId: "pln_monthly-subscription-to-knititnow-webx0nz5",
  },
} as const;

/** Legacy paid plan shells that grant the same access as the current membership. */
export const LEGACY_PAID_MEMBER_PLAN_IDS = [
  LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId,
  LEGACY_MEMBERSHIPS.grandfatheredAnnual.memberstackPlanId,
  LEGACY_MEMBERSHIPS.monthlyPremium.memberstackPlanId,
  LEGACY_MEMBERSHIPS.monthlySubscription.memberstackPlanId,
] as const;

/** Removed Basic plan — must never appear in access allow lists. */
export const REMOVED_BASIC_MEMBERSHIP_PLAN_ID =
  "pln_kin-membership-annual-basic-je3s0vpe" as const;

/** @deprecated Use {@link LEGACY_PAID_MEMBER_PLAN_IDS}. */
export const LEGACY_PREMIUM_MEMBER_PLAN_IDS = [
  LEGACY_MEMBERSHIPS.monthlyPremium.memberstackPlanId,
  LEGACY_MEMBERSHIPS.monthlySubscription.memberstackPlanId,
] as const;

/** Legacy plan ids retained for access only. */
export const LEGACY_MEMBER_PLAN_IDS = LEGACY_PAID_MEMBER_PLAN_IDS;

/** Current plan ids that grant member access (Beta + paid membership). */
export const CURRENT_MEMBER_PLAN_IDS = [
  MEMBERSHIPS.beta.memberstackPlanId,
  MEMBERSHIPS.membership.memberstackPlanId,
] as const;

/**
 * Global allow list of Memberstack plan ids that grant member access:
 * current plans + legacy plans (kept for migration). Gating consumes this as a
 * set, so order does not matter.
 */
export const MEMBER_PLAN_IDS = [
  ...CURRENT_MEMBER_PLAN_IDS,
  ...LEGACY_MEMBER_PLAN_IDS,
] as const;

/**
 * Plan ids that unlock member courses: same as global member access (Beta,
 * paid membership, and legacy paid shells).
 */
export const COURSE_ACCESS_PLAN_IDS = MEMBER_PLAN_IDS;

/** @deprecated Use {@link COURSE_ACCESS_PLAN_IDS}. */
export const PREMIUM_PLAN_IDS = COURSE_ACCESS_PLAN_IDS;

/** Plans that grant catalog video access (same as global member access). */
export const VIDEO_MEMBERSHIP_PLAN_IDS = MEMBER_PLAN_IDS;

/** Checkout price ids for the two purchasable billing intervals. */
export const MEMBERSHIP_PRICE_IDS = {
  monthly: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
  annual: MEMBERSHIPS.membership.prices.annual.memberstackPriceId,
} as const;
