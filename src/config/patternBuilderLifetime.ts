/**
 * Lifetime Pattern Builder purchases ù Memberstack product configuration.
 *
 * Do not hard-code these IDs in page components or builder-specific client scripts.
 *
 * Memberstack model (same as global membership in `memberships.ts`):
 *   - Checkout uses the PRICE id (`prc_*`).
 *   - Active plan connections on the member record expose the PLAN id (`pln_*`).
 *
 * Entitlement checks use `memberstackPlanId` only. Price and Stripe product ids are kept here
 * for checkout wiring in a later step.
 */
export const PATTERN_BUILDER_LIFETIME_PURCHASES = {
  sleeveless: {
    name: "Sleeveless Pattern Builder (Lifetime)",
    memberstackPlanId: "pln_lifetime-sleeveless-pattern-builder-i2ac0rya",
    memberstackPriceId: "prc_lifetime-b11o500cl",
    stripeProductId: "prod_UsvYNvqNgEGdsI",
    price: 49.99,
  },
  dropShoulder: {
    name: "Drop Shoulder Pattern Builder (Lifetime)",
    memberstackPlanId: "pln_lifetime-drop-shoulder-pattern-builder-93ad0rz8",
    memberstackPriceId: "prc_lifetime-tr1o6000y",
    stripeProductId: "prod_UsvZa4icSA7bze",
    price: 49.99,
  },
} as const;

/** Builder keys supported by {@link hasPatternBuilderAccess}. */
export type PatternBuilderKey = keyof typeof PATTERN_BUILDER_LIFETIME_PURCHASES;

export const PATTERN_BUILDER_KEYS = Object.keys(
  PATTERN_BUILDER_LIFETIME_PURCHASES,
) as PatternBuilderKey[];

/** Memberstack plan id that grants lifetime access to one specific builder. */
export function patternBuilderLifetimePlanId(builder: PatternBuilderKey): string {
  return PATTERN_BUILDER_LIFETIME_PURCHASES[builder].memberstackPlanId;
}

export function isKnownPatternBuilderKey(builder: string): builder is PatternBuilderKey {
  return Object.prototype.hasOwnProperty.call(PATTERN_BUILDER_LIFETIME_PURCHASES, builder);
}
