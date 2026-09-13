/**
 * Memberstack one-price checkout for individual courses.
 *
 * Uses `purchasePlansWithCheckout({ priceId })`. Logged-out visitors complete
 * Memberstack signup first, then checkout on the new account. Logged-in
 * non-members check out on their existing account.
 */
import { memberIdFromMemberstackPayload } from "../patterns/memberstackMember";
import { courseCheckoutPriceId } from "./coursePurchase";

export type MemberstackPurchaseCheckout = (opts: {
  priceId: string;
  successUrl?: string;
  cancelUrl?: string;
  autoRedirect?: boolean;
}) => Promise<{ data?: { url?: string } }>;

export type CourseCheckoutResult =
  | { ok: true; checkoutUrl: string; priceId: string }
  | {
      ok: false;
      reason:
        | "unknown-course"
        | "memberstack-unavailable"
        | "checkout-unavailable"
        | "signup-canceled"
        | "not-logged-in"
        | "no-url"
        | "error";
      message: string;
    };

export type CourseCheckoutDeps = {
  waitForMemberstack?: () => Promise<NonNullable<Window["$memberstackDom"]> | undefined>;
  getLocation?: () => Location;
  assignLocation?: (url: string) => void;
};

function defaultLocation(): Location {
  if (typeof window === "undefined") {
    return { href: "/courses" } as Location;
  }
  return window.location;
}

function memberstackErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  if (typeof error === "string" && error.trim()) return error.trim();
  return "Could not start checkout. Please try again.";
}

export function buildCourseCheckoutReturnUrls(
  loc: Location = defaultLocation(),
): { successUrl: string; cancelUrl: string } {
  const successUrl = new URL(loc.href);
  successUrl.searchParams.delete("checkoutError");
  successUrl.searchParams.set("coursePurchase", "success");

  const cancelUrl = new URL(loc.href);
  cancelUrl.searchParams.delete("coursePurchase");
  cancelUrl.searchParams.delete("checkoutError");

  return { successUrl: successUrl.toString(), cancelUrl: cancelUrl.toString() };
}

export async function startCourseCheckout(
  courseSlug: string | null | undefined,
  deps: CourseCheckoutDeps = {},
): Promise<CourseCheckoutResult> {
  const priceId = courseCheckoutPriceId(courseSlug);
  if (!priceId) {
    return {
      ok: false,
      reason: "unknown-course",
      message: "This course is not available for individual purchase.",
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
      const signupResult = await ms.openModal?.("SIGNUP");
      const signupType = (signupResult as { type?: string } | undefined)?.type;
      if (signupType !== "SIGNUP") {
        return {
          ok: false,
          reason: "signup-canceled",
          message: "Create your account or log in to continue to checkout.",
        };
      }
      memberPayload = await ms.getCurrentMember();
      if (!memberIdFromMemberstackPayload(memberPayload)) {
        return {
          ok: false,
          reason: "not-logged-in",
          message: "Account created, but login did not complete. Try again or log in first.",
        };
      }
    }

    const { successUrl, cancelUrl } = buildCourseCheckoutReturnUrls(getLocation());
    const checkoutResult = await purchasePlansWithCheckout.call(ms, {
      priceId,
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

    assignLocation(checkoutUrl);
    return { ok: true, checkoutUrl, priceId };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: memberstackErrorMessage(error),
    };
  }
}
