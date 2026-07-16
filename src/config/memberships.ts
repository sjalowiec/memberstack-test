/**
 * Knit It Now Membership Configuration
 *
 * Single source of truth for Memberstack plan IDs (access control) and price
 * IDs (checkout). Do not hard-code these values elsewhere in the application.
 *
 * Model after the plan consolidation:
 *   - There are TWO paid plans, Basic and Premium, plus Beta.
 *   - Each paid plan has TWO prices: monthly and annual.
 *   - Access control keys off the PLAN id; checkout keys off the PRICE id.
 */

/* ============================================================================
 * CURRENT PLANS — active Memberstack products
 * ==========================================================================*/
export const MEMBERSHIPS = {
    beta: {
      name: "KIN Beta Access",
      memberstackPlanId: "pln_kin-beta-access-vyek0a38",
    },

    basic: {
      name: "KIN Membership - Basic",
      memberstackPlanId: "pln_kin-membership-annual-basic-je3s0vpe",
      prices: {
        monthly: { price: 13.99, memberstackPriceId: "prc_basic-monthly-membership-s71690r6w" },
        annual: { price: 129, memberstackPriceId: "prc_basic-annual-membership-bp1bh07cp" },
      },
    },

    premium: {
      name: "KIN Membership - Premium",
      memberstackPlanId: "pln_kin-membership-annual-premium-tn5b0cxj",
      prices: {
        monthly: { price: 19.99, memberstackPriceId: "prc_monthly-subscription-to-knititnow-webw0nzy" },
        annual: { price: 228, memberstackPriceId: "prc_knit-it-now-premium-annual-membership-1g1bg070r" },
      },
    },
  } as const;

/* ============================================================================
 * LEGACY PLANS — access allow list ONLY (never used for checkout)
 * --------------------------------------------------------------------------
 * These plans are no longer sold. They remain here solely so existing members
 * whose Memberstack records still carry these plan connections keep member
 * access after the consolidation. Remove once no live members hold them.
 * ==========================================================================*/
export const LEGACY_MEMBERSHIPS = {
    monthlyBasic: {
      name: "KIN Membership Monthly Basic (retired)",
      memberstackPlanId: "pln_kin-membership-monthly-a59701wy",
    },
    monthlyPremium: {
      name: "KIN Membership Monthly Premium (retired)",
      memberstackPlanId: "pln_kin-membership-monthly-premium-915u0c2f",
    },
    annualBasic: {
      name: "KIN Membership Annual (grandfathered)",
      memberstackPlanId: "pln_kin-membership-annual-qf9g01et",
    },
  } as const;

/** Legacy plan ids retained for access only. */
export const LEGACY_MEMBER_PLAN_IDS = [
    LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId,
    LEGACY_MEMBERSHIPS.monthlyPremium.memberstackPlanId,
    LEGACY_MEMBERSHIPS.annualBasic.memberstackPlanId,
  ] as const;

/** Current plan ids that grant member access. */
export const CURRENT_MEMBER_PLAN_IDS = [
    MEMBERSHIPS.beta.memberstackPlanId,
    MEMBERSHIPS.basic.memberstackPlanId,
    MEMBERSHIPS.premium.memberstackPlanId,
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

/** Premium-tier plan ids (beta + premium). Currently unused; kept for parity. */
export const PREMIUM_PLAN_IDS = [
    MEMBERSHIPS.beta.memberstackPlanId,
    MEMBERSHIPS.premium.memberstackPlanId,
  ] as const;

/** Beta, basic, premium, and legacy plans that grant catalog video access. */
export const VIDEO_MEMBERSHIP_PLAN_IDS = MEMBER_PLAN_IDS;

/** Checkout price ids for the four purchasable options (two plans × two prices). */
export const MEMBERSHIP_PRICE_IDS = {
    basicMonthly: MEMBERSHIPS.basic.prices.monthly.memberstackPriceId,
    basicAnnual: MEMBERSHIPS.basic.prices.annual.memberstackPriceId,
    premiumMonthly: MEMBERSHIPS.premium.prices.monthly.memberstackPriceId,
    premiumAnnual: MEMBERSHIPS.premium.prices.annual.memberstackPriceId,
  } as const;
