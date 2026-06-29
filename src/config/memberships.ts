/**
 * Knit It Now Membership Configuration
 *
 * Single source of truth for Memberstack plan IDs and Stripe/Memberstack price IDs.
 * Do not hard-code these values elsewhere in the application.
 */

export const MEMBERSHIPS = {
    beta: {
      name: "KIN Beta Access",
      memberstackPlanId: "pln_kin-beta-access-vyek0a38",
    },
  
    basicMonthly: {
      name: "KIN Membership Monthly Basic",
      price: 13.99,
      stripeProductId: "prod_UmDnDybpgF9laX",
      memberstackPlanId: "pln_kin-membership-monthly-a59701wy",
      memberstackPriceId: "prc_basic-membership-monthly-z05k0css",
    },
  
    basicAnnual: {
      name: "KIN Membership Annual Basic",
      price: 129,
      stripeProductId: "prod_UmDcvzzkCzCGst",
      memberstackPlanId: "pln_kin-membership-annual-basic-je3s0vpe",
      memberstackPriceId: "prc_basic-annual-membership-u35f0cz4",
    },
  
    premiumMonthly: {
      name: "KIN Membership Monthly Premium",
      price: 19.99,
      stripeProductId: "prod_UmDotNT6aE1KH5",
      memberstackPlanId: "pln_kin-membership-monthly-premium-915u0c2f",
      memberstackPriceId: "prc_membership-monthly-premium-r5490vkw",
    },
  
    premiumAnnual: {
      name: "KIN Membership Annual Premium",
      price: 228,
      stripeProductId: "prod_UmDWvG1nD2IMiH",
      memberstackPlanId: "pln_kin-membership-annual-premium-tn5b0cxj",
      memberstackPriceId: "prc_pemium-annual-membership-vh4g0cr7",
    },

    /** Grandfathered annual basic plan still attached to some live Memberstack members. */
    legacyBasicAnnual: {
      name: "KIN Membership Annual (legacy)",
      memberstackPlanId: "pln_kin-membership-annual-qf9g01et",
    },
  } as const;
  
  export const MEMBER_PLAN_IDS = [
    MEMBERSHIPS.beta.memberstackPlanId,
    MEMBERSHIPS.basicMonthly.memberstackPlanId,
    MEMBERSHIPS.basicAnnual.memberstackPlanId,
    MEMBERSHIPS.premiumMonthly.memberstackPlanId,
    MEMBERSHIPS.premiumAnnual.memberstackPlanId,
    MEMBERSHIPS.legacyBasicAnnual.memberstackPlanId,
  ] as const;
  
  export const PREMIUM_PLAN_IDS = [
    MEMBERSHIPS.beta.memberstackPlanId,
    MEMBERSHIPS.premiumMonthly.memberstackPlanId,
    MEMBERSHIPS.premiumAnnual.memberstackPlanId,
  ] as const;

  /** Beta, basic, premium, and legacy plans that grant catalog video access. */
  export const VIDEO_MEMBERSHIP_PLAN_IDS = MEMBER_PLAN_IDS;
  
  export const MEMBERSHIP_PRICE_IDS = {
    basicMonthly: MEMBERSHIPS.basicMonthly.memberstackPriceId,
    basicAnnual: MEMBERSHIPS.basicAnnual.memberstackPriceId,
    premiumMonthly: MEMBERSHIPS.premiumMonthly.memberstackPriceId,
    premiumAnnual: MEMBERSHIPS.premiumAnnual.memberstackPriceId,
  } as const;