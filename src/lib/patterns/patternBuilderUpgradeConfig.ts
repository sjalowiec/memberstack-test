/**
 * Per-builder upgrade screen copy and checkout return descriptors for lifetime Pattern Builder purchases.
 */
import {
  PATTERN_BUILDER_LIFETIME_PURCHASES,
  type PatternBuilderKey,
} from "../../config/patternBuilderLifetime";
import type { PatternSystemId } from "./patternSystemId";

export const PATTERN_BUILDER_MEMBERSHIP_OPTION_TITLE = "Become a Member";

export const PATTERN_BUILDER_MEMBERSHIP_OPTION_COPY =
  "Get access to every Pattern Builder, plus member videos, tools, Help Hub lessons, stitch downloads, and other member resources.";

export const PATTERN_BUILDER_MEMBERSHIP_OPTION_CTA = "View Membership Options";

export const PATTERN_BUILDER_MEMBERSHIP_OPTION_HREF = "/membership";

export const PATTERN_BUILDER_SAVED_PATTERNS_HEADING = "Already have patterns you've created?";

export const PATTERN_BUILDER_SAVED_PATTERNS_CTA = "Open your saved patterns";

export const PATTERN_BUILDER_SAVED_PATTERNS_HREF = "/account#my-patterns";

/** Shared purchase return query keys (preferred for new builders). */
export const PATTERN_BUILDER_PURCHASE_RETURN_PARAM = "builderPurchase";

export const PATTERN_BUILDER_PURCHASE_BUILDER_PARAM = "builder";

/** Legacy Sleeveless return param — preserved for existing success/cancel URLs. */
export const SLEEVELESS_LEGACY_PURCHASE_RETURN_PARAM = "sleevelessLifetime";

export interface PatternBuilderUpgradeConfig {
  patternSystemId: Extract<PatternSystemId, "sleeveless" | "drop-shoulder">;
  builderKey: PatternBuilderKey;
  productDisplayName: string;
  heading: string;
  intro: string;
  lifetimeCardTitle: string;
  lifetimeCardCopy: string;
  lifetimePurchaseCta: string;
  unlockedTitle: string;
  unlockedBody: string;
  legacyReturnParam?: string;
  checkoutLoginMessage: string;
  checkoutAccessPendingMessage: string;
  checkoutCanceledAccessMessage: string;
}

const SLEEVELESS_UPGRADE: PatternBuilderUpgradeConfig = {
  patternSystemId: "sleeveless",
  builderKey: "sleeveless",
  productDisplayName: "Sleeveless Sweater",
  heading: "Create another Sleeveless Sweater",
  intro:
    "You've already created your free Sleeveless Sweater pattern. Choose how you'd like to continue.",
  lifetimeCardTitle: "Own the Sleeveless Pattern Builder",
  lifetimeCardCopy:
    "Get lifetime access to create, save, edit, copy, print, and download unlimited custom Sleeveless Sweater patterns.",
  lifetimePurchaseCta: "Buy the Sleeveless Builder",
  unlockedTitle: "Sleeveless Pattern Builder unlocked",
  unlockedBody:
    "You now have lifetime access to create, edit, and save unlimited Sleeveless Sweater patterns.",
  legacyReturnParam: SLEEVELESS_LEGACY_PURCHASE_RETURN_PARAM,
  checkoutLoginMessage: "Log in to purchase the Sleeveless Pattern Builder.",
  checkoutAccessPendingMessage:
    "Payment received, but Sleeveless access is not active yet. Wait a moment and refresh, or contact support if this continues.",
  checkoutCanceledAccessMessage: "Checkout did not complete. Your Sleeveless access has not changed.",
};

const DROP_SHOULDER_UPGRADE: PatternBuilderUpgradeConfig = {
  patternSystemId: "drop-shoulder",
  builderKey: "dropShoulder",
  productDisplayName: "Drop Shoulder Sweater",
  heading: "Create another Drop Shoulder Sweater",
  intro:
    "You've already created your free Drop Shoulder Sweater pattern. Choose how you'd like to continue.",
  lifetimeCardTitle: "Own the Drop Shoulder Pattern Builder",
  lifetimeCardCopy:
    "Get lifetime access to create, save, edit, copy, print, and download unlimited custom Drop Shoulder Sweater patterns.",
  lifetimePurchaseCta: "Buy the Drop Shoulder Builder",
  unlockedTitle: "Drop Shoulder Pattern Builder unlocked",
  unlockedBody:
    "You now have lifetime access to create, edit, and save unlimited Drop Shoulder Sweater patterns.",
  checkoutLoginMessage: "Log in to purchase the Drop Shoulder Pattern Builder.",
  checkoutAccessPendingMessage:
    "Payment received, but Drop Shoulder access is not active yet. Wait a moment and refresh, or contact support if this continues.",
  checkoutCanceledAccessMessage:
    "Checkout did not complete. Your Drop Shoulder access has not changed.",
};

export const PATTERN_BUILDER_UPGRADE_CONFIGS: Record<
  PatternBuilderUpgradeConfig["patternSystemId"],
  PatternBuilderUpgradeConfig
> = {
  sleeveless: SLEEVELESS_UPGRADE,
  "drop-shoulder": DROP_SHOULDER_UPGRADE,
};

export function resolvePatternBuilderUpgradeConfig(
  systemId: PatternSystemId,
): PatternBuilderUpgradeConfig | null {
  if (systemId === "sleeveless" || systemId === "drop-shoulder") {
    return PATTERN_BUILDER_UPGRADE_CONFIGS[systemId];
  }
  return null;
}

export function resolvePatternBuilderUpgradeConfigByKey(
  builderKey: string,
): PatternBuilderUpgradeConfig | null {
  for (const config of Object.values(PATTERN_BUILDER_UPGRADE_CONFIGS)) {
    if (config.builderKey === builderKey) return config;
  }
  return null;
}

export function formatPatternBuilderLifetimePrice(builderKey: PatternBuilderKey): string {
  const entry = PATTERN_BUILDER_LIFETIME_PURCHASES[builderKey];
  const price = "price" in entry && typeof entry.price === "number" ? entry.price : null;
  if (price === null) return "";
  return `$${price.toFixed(2)} one time`;
}

export function patternBuilderLifetimeCheckoutPriceId(builderKey: PatternBuilderKey): string {
  return PATTERN_BUILDER_LIFETIME_PURCHASES[builderKey].memberstackPriceId;
}
