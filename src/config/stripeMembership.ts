/**
 * Stripe ? Knit It Now membership classification config (Watson Sales Report).
 *
 * WHY THIS EXISTS
 * ---------------
 * Membership billing runs through Memberstack, which fronts Stripe. The rest of
 * the app identifies memberships by *Memberstack* price/plan ids (see
 * `src/config/memberships.ts`). Those Memberstack `prc_*` ids do NOT appear on
 * raw Stripe charges/invoices - Stripe uses its own native `price_*` / `prod_*`
 * ids. The Sales Report reads ACTUAL money collected from the Stripe API, so it
 * must classify Stripe payments using the *Stripe-native* price/product ids that
 * back the Memberstack membership prices.
 *
 * Those Stripe-native ids are not stored in the codebase, so they are supplied
 * via environment variables (comma/space separated). Amounts are intentionally
 * NOT used for classification (per reporting spec: never classify on price
 * alone). Anything that cannot be positively identified as a Knit It Now
 * membership product (e.g. DesignaKnit, pattern-builder lifetime, machine
 * payment links, Shopify-gateway charges) is excluded from membership revenue.
 *
 * Mapping guidance for whoever populates the env vars: in the Stripe dashboard,
 * open the membership Product(s) that correspond to these Memberstack prices and
 * copy their `price_*` ids into the matching interval variable.
 */

import {
  MEMBERSHIPS,
  MEMBERSHIP_PRICE_IDS,
  RETIRED_MONTHLY_SUBSCRIPTION_PRICE_ID,
} from "./memberships";

export interface StripeMembershipClassificationConfig {
  /** Stripe `price_*` ids billed as the MONTHLY membership. */
  monthlyPriceIds: Set<string>;
  /** Stripe `price_*` ids billed as the ANNUAL membership. */
  annualPriceIds: Set<string>;
  /**
   * Stripe `product_*` ids that are Knit It Now membership products. Used to
   * classify a membership payment as "other" when the exact price id is not in
   * the monthly/annual sets (e.g. a legacy price shell) but the product is still
   * a membership product.
   */
  membershipProductIds: Set<string>;
  /**
   * Union of every known membership `price_*` id (monthly + annual + any extra
   * legacy price ids). Used to positively identify a membership payment.
   */
  membershipPriceIds: Set<string>;
}

/**
 * Reference only: the Memberstack price ids these Stripe ids correspond to. This
 * is what an operator should match against when copying the Stripe-native ids
 * into the environment variables. It is NOT used for classification.
 */
export const MEMBERSTACK_MEMBERSHIP_PRICE_REFERENCE = {
  monthly: {
    memberstackPriceId: MEMBERSHIP_PRICE_IDS.monthly,
    price: MEMBERSHIPS.membership.prices.monthly.price,
  },
  annual: {
    memberstackPriceId: MEMBERSHIP_PRICE_IDS.annual,
    price: MEMBERSHIPS.membership.prices.annual.price,
  },
  retiredMonthly: {
    memberstackPriceId: RETIRED_MONTHLY_SUBSCRIPTION_PRICE_ID,
    price: MEMBERSHIPS.membership.prices.monthly.price,
  },
} as const;

function splitIds(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Build the classification config from environment variables. Never throws;
 * missing vars yield empty sets (callers must treat an empty config as
 * "membership classification not configured" and surface a warning rather than
 * silently reporting $0).
 */
export function readStripeMembershipConfig(
  env: Record<string, string | undefined> = process.env,
): StripeMembershipClassificationConfig {
  const monthly = splitIds(env.STRIPE_MEMBERSHIP_MONTHLY_PRICE_IDS);
  const annual = splitIds(env.STRIPE_MEMBERSHIP_ANNUAL_PRICE_IDS);
  const otherPrices = splitIds(env.STRIPE_MEMBERSHIP_OTHER_PRICE_IDS);
  const products = splitIds(env.STRIPE_MEMBERSHIP_PRODUCT_IDS);

  return {
    monthlyPriceIds: new Set(monthly),
    annualPriceIds: new Set(annual),
    membershipProductIds: new Set(products),
    membershipPriceIds: new Set([...monthly, ...annual, ...otherPrices]),
  };
}

/** True when no membership price/product ids are configured at all. */
export function stripeMembershipConfigIsEmpty(
  config: StripeMembershipClassificationConfig,
): boolean {
  return (
    config.monthlyPriceIds.size === 0 &&
    config.annualPriceIds.size === 0 &&
    config.membershipProductIds.size === 0 &&
    config.membershipPriceIds.size === 0
  );
}
