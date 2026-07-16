/**
 * @deprecated Import from `./patternBuilderLifetimeCheckout`.
 */
export type {
  PatternBuilderLifetimeCheckoutDeps as SleevelessLifetimeCheckoutDeps,
  PatternBuilderLifetimeCheckoutResult as SleevelessLifetimeCheckoutResult,
  MemberstackPurchaseCheckout,
} from "./patternBuilderLifetimeCheckout";

import { PATTERN_BUILDER_UPGRADE_CONFIGS } from "./patternBuilderUpgradeConfig";
import {
  buildPatternBuilderLifetimeCheckoutReturnUrls,
  startPatternBuilderLifetimeCheckout,
  type PatternBuilderLifetimeCheckoutDeps,
} from "./patternBuilderLifetimeCheckout";

export function buildSleevelessLifetimeCheckoutReturnUrls(
  loc?: Location,
): { successUrl: string; cancelUrl: string } {
  return buildPatternBuilderLifetimeCheckoutReturnUrls(
    PATTERN_BUILDER_UPGRADE_CONFIGS.sleeveless,
    loc,
  );
}

export function startSleevelessLifetimeCheckout(
  deps: PatternBuilderLifetimeCheckoutDeps = {},
) {
  return startPatternBuilderLifetimeCheckout("sleeveless", deps);
}
