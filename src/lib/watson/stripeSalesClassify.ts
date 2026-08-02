/**
 * Classify a Stripe charge as a Knit It Now membership payment (monthly /
 * annual / other) or a non-membership payment. Classification uses ONLY the
 * Stripe price/product ids on the charge's invoice lines - never the dollar
 * amount - so unrelated Stripe products (DesignaKnit, pattern builders, machine
 * payment links, Shopify-gateway charges) are excluded from membership revenue.
 */

import type { StripeMembershipClassificationConfig } from "../../config/stripeMembership";

export type MembershipCategory = "monthly" | "annual" | "other";
export type StripeChargeCategory = MembershipCategory | "not_membership";

/** A price/product reference derived from a Stripe invoice line. */
export interface StripeChargeLineRef {
  priceId: string | null;
  productId: string | null;
}

/**
 * Determine the membership category of a charge from its invoice line refs.
 *
 * Rules (in order):
 * 1. Any line price id in the monthly set ? "monthly".
 * 2. Any line price id in the annual set ? "annual".
 * 3. Otherwise, if any line price id is a known membership price OR any line
 *    product id is a known membership product ? "other" (membership payment we
 *    cannot safely split into monthly/annual, e.g. a legacy price shell).
 * 4. Otherwise ? "not_membership".
 */
export function classifyStripeCharge(
  lines: StripeChargeLineRef[],
  config: StripeMembershipClassificationConfig,
): StripeChargeCategory {
  const priceIds = lines
    .map((line) => line.priceId)
    .filter((id): id is string => Boolean(id));
  const productIds = lines
    .map((line) => line.productId)
    .filter((id): id is string => Boolean(id));

  if (priceIds.some((id) => config.monthlyPriceIds.has(id))) {
    return "monthly";
  }
  if (priceIds.some((id) => config.annualPriceIds.has(id))) {
    return "annual";
  }

  const isMembership =
    priceIds.some((id) => config.membershipPriceIds.has(id)) ||
    productIds.some((id) => config.membershipProductIds.has(id));

  return isMembership ? "other" : "not_membership";
}

export function isMembershipCategory(
  category: StripeChargeCategory,
): category is MembershipCategory {
  return category !== "not_membership";
}
