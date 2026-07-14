/**
 * @deprecated Import from `./patternBuilderNewPatternUpgrade` and `./patternBuilderUpgradeConfig`.
 */
export {
  resolvePatternBuilderNewPatternUpgradeUiMode as resolveSleevelessNewPatternUpgradeUiMode,
  shouldBypassPatternBuilderNewPatternUpgradeScreen as shouldBypassSleevelessNewPatternUpgradeScreen,
  memberPlanGrantsPatternBuilderBypass as memberPlanGrantsSleevelessBypass,
  type PatternBuilderNewPatternUpgradeUiMode as SleevelessNewPatternUpgradeUiMode,
} from "./patternBuilderNewPatternUpgrade";

export {
  PATTERN_BUILDER_UPGRADE_CONFIGS,
  formatPatternBuilderLifetimePrice as formatSleevelessLifetimePrice,
  SLEEVELESS_LEGACY_PURCHASE_RETURN_PARAM as SLEEVELESS_LIFETIME_RETURN_PARAM,
} from "./patternBuilderUpgradeConfig";

import { PATTERN_BUILDER_UPGRADE_CONFIGS, patternBuilderLifetimeCheckoutPriceId } from "./patternBuilderUpgradeConfig";

export function sleevelessLifetimeCheckoutPriceId(): string {
  return patternBuilderLifetimeCheckoutPriceId("sleeveless");
}

export const SLEEVELESS_NEW_PATTERN_UPGRADE_HEADING =
  PATTERN_BUILDER_UPGRADE_CONFIGS.sleeveless.heading;
export const SLEEVELESS_NEW_PATTERN_UPGRADE_INTRO = PATTERN_BUILDER_UPGRADE_CONFIGS.sleeveless.intro;
export const SLEEVELESS_MEMBERSHIP_OPTION_TITLE = "Become a Member";
export const SLEEVELESS_MEMBERSHIP_OPTION_COPY =
  "Get access to every Pattern Builder, plus member videos, tools, Help Hub lessons, stitch downloads, and other member resources.";
export const SLEEVELESS_MEMBERSHIP_OPTION_CTA = "View Membership Options";
export const SLEEVELESS_MEMBERSHIP_OPTION_HREF = "/membership";
export const SLEEVELESS_LIFETIME_OPTION_TITLE =
  PATTERN_BUILDER_UPGRADE_CONFIGS.sleeveless.lifetimeCardTitle;
export const SLEEVELESS_LIFETIME_OPTION_COPY =
  PATTERN_BUILDER_UPGRADE_CONFIGS.sleeveless.lifetimeCardCopy;
export const SLEEVELESS_LIFETIME_OPTION_CTA =
  PATTERN_BUILDER_UPGRADE_CONFIGS.sleeveless.lifetimePurchaseCta;
export const SLEEVELESS_SAVED_PATTERNS_HEADING = "Already have patterns you've created?";
export const SLEEVELESS_SAVED_PATTERNS_CTA = "Open your saved patterns";
export const SLEEVELESS_SAVED_PATTERNS_HREF = "/account#my-patterns";
export const SLEEVELESS_LIFETIME_UNLOCKED_TITLE =
  PATTERN_BUILDER_UPGRADE_CONFIGS.sleeveless.unlockedTitle;
export const SLEEVELESS_LIFETIME_UNLOCKED_BODY =
  PATTERN_BUILDER_UPGRADE_CONFIGS.sleeveless.unlockedBody;
