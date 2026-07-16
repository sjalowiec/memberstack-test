/**
 * Memberstack checkout for Pattern Builder lifetime purchases.
 *
 * Follows the established one-time purchase pattern in `quickHelpCheckout.ts`:
 * `purchasePlansWithCheckout` with centralized `memberstackPriceId`, explicit success/cancel URLs,
 * and manual redirect to the Stripe checkout URL.
 */
import type { PatternBuilderKey } from "../../config/patternBuilderLifetime";
import { memberIdFromMemberstackPayload } from "./memberstackMember";
import {
  patternBuilderLifetimeCheckoutPriceId,
  PATTERN_BUILDER_PURCHASE_BUILDER_PARAM,
  PATTERN_BUILDER_PURCHASE_RETURN_PARAM,
  resolvePatternBuilderUpgradeConfig,
  resolvePatternBuilderUpgradeConfigByKey,
  SLEEVELESS_LEGACY_PURCHASE_RETURN_PARAM,
  type PatternBuilderUpgradeConfig,
} from "./patternBuilderUpgradeConfig";

export type MemberstackPurchaseCheckout = (opts: {
  priceId: string;
  successUrl?: string;
  cancelUrl?: string;
  autoRedirect?: boolean;
}) => Promise<{ data?: { url?: string } }>;

export type PatternBuilderLifetimeCheckoutResult =
  | { ok: true; checkoutUrl: string }
  | {
      ok: false;
      reason:
        | "memberstack-unavailable"
        | "checkout-unavailable"
        | "not-logged-in"
        | "no-url"
        | "error"
        | "unknown-builder";
      message: string;
    };

export type PatternBuilderLifetimeCheckoutDeps = {
  waitForMemberstack?: () => Promise<NonNullable<Window["$memberstackDom"]> | undefined>;
  getLocation?: () => Location;
  assignLocation?: (url: string) => void;
};

function defaultLocation(): Location {
  if (typeof window === "undefined") {
    return { href: "/patterns/sleeveless-express?new=1" } as Location;
  }
  return window.location;
}

function appendPurchaseReturnParams(
  url: URL,
  config: PatternBuilderUpgradeConfig,
  outcome: "success" | "canceled",
): void {
  url.searchParams.delete(PATTERN_BUILDER_PURCHASE_RETURN_PARAM);
  url.searchParams.delete(PATTERN_BUILDER_PURCHASE_BUILDER_PARAM);
  url.searchParams.delete(SLEEVELESS_LEGACY_PURCHASE_RETURN_PARAM);
  url.searchParams.delete("checkoutError");

  if (config.legacyReturnParam) {
    url.searchParams.set(config.legacyReturnParam, outcome);
    return;
  }

  url.searchParams.set(PATTERN_BUILDER_PURCHASE_RETURN_PARAM, outcome);
  url.searchParams.set(PATTERN_BUILDER_PURCHASE_BUILDER_PARAM, config.builderKey);
}

/** Builds return URLs that preserve the new-pattern intent (`?new=1`). */
export function buildPatternBuilderLifetimeCheckoutReturnUrls(
  config: PatternBuilderUpgradeConfig,
  loc: Location = defaultLocation(),
): { successUrl: string; cancelUrl: string } {
  const url = new URL(loc.href);
  url.searchParams.set("new", "1");
  url.searchParams.delete(PATTERN_BUILDER_PURCHASE_RETURN_PARAM);
  url.searchParams.delete(PATTERN_BUILDER_PURCHASE_BUILDER_PARAM);
  url.searchParams.delete(SLEEVELESS_LEGACY_PURCHASE_RETURN_PARAM);
  url.searchParams.delete("checkoutError");

  const cancelUrl = new URL(url.href);
  appendPurchaseReturnParams(cancelUrl, config, "canceled");

  const successUrl = new URL(url.href);
  appendPurchaseReturnParams(successUrl, config, "success");

  return { successUrl: successUrl.toString(), cancelUrl: cancelUrl.toString() };
}

export async function startPatternBuilderLifetimeCheckout(
  builderKey: PatternBuilderKey | string,
  deps: PatternBuilderLifetimeCheckoutDeps = {},
): Promise<PatternBuilderLifetimeCheckoutResult> {
  const config = resolvePatternBuilderUpgradeConfigByKey(String(builderKey));
  if (!config) {
    return {
      ok: false,
      reason: "unknown-builder",
      message: "Checkout is unavailable for this Pattern Builder.",
    };
  }

  const getLocation = deps.getLocation ?? defaultLocation;
  const assignLocation =
    deps.assignLocation ??
    ((url: string) => {
      if (typeof window !== "undefined") window.location.href = url;
    });
  const waitForMemberstack =
    deps.waitForMemberstack ??
    (async () => {
      if (typeof window === "undefined") return undefined;
      for (let i = 0; i < 35; i++) {
        const ms = window.$memberstackDom;
        if (ms?.getCurrentMember) {
          if (ms.onReady) await ms.onReady;
          return ms;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return window.$memberstackDom;
    });

  try {
    const ms = await waitForMemberstack();
    if (!ms?.getCurrentMember) {
      return {
        ok: false,
        reason: "memberstack-unavailable",
        message: "Checkout is not ready yet. Please refresh and try again.",
      };
    }

    const purchasePlansWithCheckout = (ms as Record<string, unknown>)
      .purchasePlansWithCheckout as MemberstackPurchaseCheckout | undefined;
    if (typeof purchasePlansWithCheckout !== "function") {
      return {
        ok: false,
        reason: "checkout-unavailable",
        message: "Checkout is unavailable. Please refresh and try again.",
      };
    }

    let memberPayload: unknown = null;
    try {
      memberPayload = await ms.getCurrentMember();
    } catch {
      memberPayload = null;
    }
    if (!memberIdFromMemberstackPayload(memberPayload)) {
      return {
        ok: false,
        reason: "not-logged-in",
        message: config.checkoutLoginMessage,
      };
    }

    const { successUrl, cancelUrl } = buildPatternBuilderLifetimeCheckoutReturnUrls(
      config,
      getLocation(),
    );
    const checkoutResult = await purchasePlansWithCheckout.call(ms, {
      priceId: patternBuilderLifetimeCheckoutPriceId(config.builderKey),
      successUrl,
      cancelUrl,
      autoRedirect: false,
    });

    const checkoutUrl = checkoutResult?.data?.url;
    if (typeof checkoutUrl !== "string" || !checkoutUrl.trim()) {
      return {
        ok: false,
        reason: "no-url",
        message: "Checkout did not return a redirect URL. Please try again.",
      };
    }

    assignLocation(checkoutUrl.trim());
    return { ok: true, checkoutUrl: checkoutUrl.trim() };
  } catch (error) {
    const message =
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message.trim()
        : "Could not start checkout. Please try again.";
    return {
      ok: false,
      reason: "error",
      message: message || "Could not start checkout. Please try again.",
    };
  }
}

/** Resolve checkout config from the current page's pattern system when possible. */
export function patternBuilderUpgradeConfigForCheckout(
  builderKey: PatternBuilderKey,
): PatternBuilderUpgradeConfig | null {
  return resolvePatternBuilderUpgradeConfigByKey(builderKey);
}
