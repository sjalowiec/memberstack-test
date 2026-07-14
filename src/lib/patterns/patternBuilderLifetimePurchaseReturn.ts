/**
 * Post-checkout return handling for Pattern Builder lifetime purchases.
 */
import type { PatternBuilderKey } from "../../config/patternBuilderLifetime";
import {
  PATTERN_BUILDER_PURCHASE_BUILDER_PARAM,
  PATTERN_BUILDER_PURCHASE_RETURN_PARAM,
  resolvePatternBuilderUpgradeConfigByKey,
  SLEEVELESS_LEGACY_PURCHASE_RETURN_PARAM,
} from "./patternBuilderUpgradeConfig";
import { hasPatternSystemAccess } from "./sleevelessPatternSystemAccess";
import {
  invalidateSleevelessUserAccessCache,
  resolveSleevelessUserAccess,
} from "./sleevelessPatternSystemAccessClient";

export type PatternBuilderPurchaseReturnKind = "none" | "success" | "canceled" | "failed";

export type PatternBuilderPurchaseReturnResult = {
  kind: PatternBuilderPurchaseReturnKind;
  builderKey: PatternBuilderKey | null;
  unlocked: boolean;
  title?: string;
  message?: string;
  errorMessage?: string;
};

function parsePurchaseReturnKind(value: string | null | undefined): PatternBuilderPurchaseReturnKind {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "success") return "success";
  if (normalized === "canceled" || normalized === "cancelled") return "canceled";
  return "none";
}

export function readPatternBuilderPurchaseReturn(
  url: URL,
): { builderKey: PatternBuilderKey | null; kind: PatternBuilderPurchaseReturnKind } {
  const sharedValue = url.searchParams.get(PATTERN_BUILDER_PURCHASE_RETURN_PARAM);
  const builderParam = url.searchParams.get(PATTERN_BUILDER_PURCHASE_BUILDER_PARAM)?.trim();
  if (sharedValue && builderParam) {
    const config = resolvePatternBuilderUpgradeConfigByKey(builderParam);
    if (!config) return { builderKey: null, kind: "failed" };
    const kind = parsePurchaseReturnKind(sharedValue);
    return { builderKey: config.builderKey, kind: kind === "none" ? "failed" : kind };
  }

  const legacyValue = url.searchParams.get(SLEEVELESS_LEGACY_PURCHASE_RETURN_PARAM);
  const legacyKind = parsePurchaseReturnKind(legacyValue);
  if (legacyKind !== "none") {
    return { builderKey: "sleeveless", kind: legacyKind };
  }

  if (url.searchParams.get("checkoutError") === "1") {
    if (builderParam) {
      const config = resolvePatternBuilderUpgradeConfigByKey(builderParam);
      if (config) return { builderKey: config.builderKey, kind: "failed" };
      return { builderKey: null, kind: "failed" };
    }
    return { builderKey: "sleeveless", kind: "failed" };
  }

  return { builderKey: null, kind: "none" };
}

/** @deprecated Use {@link readPatternBuilderPurchaseReturn}. */
export function readSleevelessLifetimePurchaseReturnKind(url: URL): PatternBuilderPurchaseReturnKind {
  return readPatternBuilderPurchaseReturn(url).kind;
}

export function stripPatternBuilderPurchaseReturnParams(url: URL): string {
  const cleaned = new URL(url.href);
  cleaned.searchParams.delete(PATTERN_BUILDER_PURCHASE_RETURN_PARAM);
  cleaned.searchParams.delete(PATTERN_BUILDER_PURCHASE_BUILDER_PARAM);
  cleaned.searchParams.delete(SLEEVELESS_LEGACY_PURCHASE_RETURN_PARAM);
  cleaned.searchParams.delete("checkoutError");
  const qs = cleaned.searchParams.toString();
  return `${cleaned.pathname}${qs ? `?${qs}` : ""}${cleaned.hash}`;
}

/** @deprecated Use {@link stripPatternBuilderPurchaseReturnParams}. */
export function stripSleevelessLifetimePurchaseReturnParams(url: URL): string {
  return stripPatternBuilderPurchaseReturnParams(url);
}

export type ProcessPatternBuilderPurchaseReturnDeps = {
  resolveAccess?: typeof resolveSleevelessUserAccess;
  invalidateCache?: typeof invalidateSleevelessUserAccessCache;
};

/** Re-fetch Memberstack access after checkout and confirm builder-specific lifetime unlock. */
export async function processPatternBuilderPurchaseReturn(
  url: URL,
  deps: ProcessPatternBuilderPurchaseReturnDeps = {},
): Promise<PatternBuilderPurchaseReturnResult> {
  const { builderKey, kind } = readPatternBuilderPurchaseReturn(url);
  if (kind === "none") {
    return { kind, builderKey: null, unlocked: false };
  }

  const config = builderKey ? resolvePatternBuilderUpgradeConfigByKey(builderKey) : null;
  if (!config) {
    return {
      kind: "failed",
      builderKey,
      unlocked: false,
      errorMessage: "Checkout return could not be processed. Please refresh and try again.",
    };
  }

  if (kind === "canceled") {
    return { kind, builderKey, unlocked: false };
  }

  if (kind === "failed") {
    return {
      kind,
      builderKey,
      unlocked: false,
      errorMessage: config.checkoutCanceledAccessMessage,
    };
  }

  const invalidateCache = deps.invalidateCache ?? invalidateSleevelessUserAccessCache;
  const resolveAccess = deps.resolveAccess ?? resolveSleevelessUserAccess;

  invalidateCache();
  const access = await resolveAccess();
  const unlocked = hasPatternSystemAccess(access, config.patternSystemId);

  if (!unlocked) {
    return {
      kind: "failed",
      builderKey,
      unlocked: false,
      errorMessage: config.checkoutAccessPendingMessage,
    };
  }

  return {
    kind: "success",
    builderKey,
    unlocked: true,
    title: config.unlockedTitle,
    message: config.unlockedBody,
  };
}

/** @deprecated Use {@link processPatternBuilderPurchaseReturn}. */
export async function processSleevelessLifetimePurchaseReturn(
  url: URL,
  deps: ProcessPatternBuilderPurchaseReturnDeps = {},
): Promise<PatternBuilderPurchaseReturnResult> {
  return processPatternBuilderPurchaseReturn(url, deps);
}
