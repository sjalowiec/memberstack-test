import { setMembershipWhatsIncludedTriggerMode } from "./membershipWhatsIncluded";

/**
 * Active/canceling member thank-you section on /membership (replaces sales content).
 */

export const MEMBERSHIP_THANK_YOU_HEADING =
  "Thank you for being a Knit it Now member.";

export const MEMBERSHIP_THANK_YOU_MESSAGE =
  "Your support helps keep the lessons, tools, Pattern Builders, and courses growing.";

/** Existing account dashboard destinations  do not invent routes. */
export const MEMBERSHIP_THANK_YOU_FAVORITES_HREF = "/account#my-favorites";
export const MEMBERSHIP_THANK_YOU_PATTERNS_HREF = "/account#my-patterns";

export const MEMBERSHIP_THANK_YOU_FAVORITES_LABEL = "My Favorites";
export const MEMBERSHIP_THANK_YOU_PATTERNS_LABEL = "My Patterns";

export type MembershipPageContentMode = "thank_you" | "sales";

export function membershipThankYouShouldAnimate(
  matchMediaFn: ((query: string) => MediaQueryList) | null | undefined =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia.bind(window)
      : null,
): boolean {
  if (!matchMediaFn) return true;
  try {
    return !matchMediaFn("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

/**
 * Show thank-you (and hide sales) for active/canceling paid members only.
 * Links remain interactive immediately; entrance animation is CSS-only and once.
 */
export function applyMembershipPageContentMode(
  mode: MembershipPageContentMode,
  root: ParentNode = document,
  options?: { matchMedia?: (query: string) => MediaQueryList },
): void {
  const thankYou = root.querySelector<HTMLElement>("[data-membership-thank-you]");
  const salesBlocks = root.querySelectorAll<HTMLElement>("[data-membership-sales-content]");

  if (mode === "thank_you") {
    salesBlocks.forEach((el) => {
      el.hidden = true;
    });
    setMembershipWhatsIncludedTriggerMode("modal", root);
    if (!thankYou) return;

    const wasHidden = thankYou.hidden;
    thankYou.hidden = false;

    if (wasHidden && membershipThankYouShouldAnimate(options?.matchMedia)) {
      // Retrigger a one-shot entrance when the section becomes visible.
      thankYou.removeAttribute("data-membership-thank-you-enter");
      void thankYou.offsetWidth;
      thankYou.setAttribute("data-membership-thank-you-enter", "1");
    } else if (wasHidden) {
      thankYou.removeAttribute("data-membership-thank-you-enter");
    }
    return;
  }

  if (thankYou) {
    thankYou.hidden = true;
    thankYou.removeAttribute("data-membership-thank-you-enter");
  }
  salesBlocks.forEach((el) => {
    el.hidden = false;
  });
  setMembershipWhatsIncludedTriggerMode("anchor", root);
}
