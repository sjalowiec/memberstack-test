/**
 * Shared browser helper: open Stripe Customer Portal via Memberstack DOM.
 *
 * Used by the Account membership panel and the site-wide membership corner CTA.
 */

export const STRIPE_PORTAL_RETURN_PATH = "/account#membership";

export const STRIPE_PORTAL_UNAVAILABLE_MESSAGE =
  "We couldn't open billing management right now. Please try again in a moment.";

type MemberstackCustomerPortal = (opts?: {
  returnUrl?: string;
}) => Promise<{ data?: { url?: string } }>;

export type LaunchStripeCustomerPortalResult =
  | { ok: true; url: string }
  | { ok: false; reason: "unavailable" | "no-url" | "error"; error?: unknown };

export function stripeCustomerPortalReturnUrl(
  origin: string = typeof window !== "undefined" ? window.location.origin : "http://localhost",
): string {
  return new URL(STRIPE_PORTAL_RETURN_PATH, origin).href;
}

/**
 * Call Memberstack launchStripeCustomerPortal and return the portal URL (or failure).
 * Does not navigate — callers decide how to handle success/failure UI.
 */
export async function launchStripeCustomerPortalSession(options?: {
  ms?: Window["$memberstackDom"];
  returnUrl?: string;
}): Promise<LaunchStripeCustomerPortalResult> {
  const ms = options?.ms ?? (typeof window !== "undefined" ? window.$memberstackDom : undefined);
  const launchStripeCustomerPortal = (ms as Record<string, unknown> | undefined)
    ?.launchStripeCustomerPortal as MemberstackCustomerPortal | undefined;

  if (!ms || typeof launchStripeCustomerPortal !== "function") {
    return { ok: false, reason: "unavailable" };
  }

  try {
    const portal = await launchStripeCustomerPortal.call(ms, {
      returnUrl: options?.returnUrl ?? stripeCustomerPortalReturnUrl(),
    });
    const url = portal?.data?.url;
    if (typeof url === "string" && url.trim()) {
      return { ok: true, url: url.trim() };
    }
    return { ok: false, reason: "no-url" };
  } catch (error) {
    console.error("[stripe portal] launchStripeCustomerPortal failed:", error);
    return { ok: false, reason: "error", error };
  }
}

/**
 * Launch the portal and navigate to the returned URL.
 * Returns true when navigation was started.
 */
export async function openStripeCustomerPortal(options?: {
  ms?: Window["$memberstackDom"];
  returnUrl?: string;
  assign?: (url: string) => void;
}): Promise<boolean> {
  const result = await launchStripeCustomerPortalSession({
    ms: options?.ms,
    returnUrl: options?.returnUrl,
  });
  if (!result.ok) return false;

  const assign =
    options?.assign ??
    ((url: string) => {
      window.location.href = url;
    });
  assign(result.url);
  return true;
}
