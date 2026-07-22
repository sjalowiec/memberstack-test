/**
 * Overlay CTA mode from the Watson-backed membership status summary.
 * Does not replace checkout safety (memberHasActivePaidMembership); it only
 * suppresses purchase CTAs for manage / ambiguous / unavailable states.
 */

import { MEMBERSHIP_SALES_CTA } from "./membershipSalesCta";
import type { MembershipRecommendedAction } from "./membershipStatusSummary";

export type MembershipStatusCtaMode =
  | "purchase"
  | "manage"
  | "contact_support"
  | "wait"
  | "loading"
  | "hidden";

let currentMode: MembershipStatusCtaMode = "hidden";

export function getMembershipStatusCtaMode(): MembershipStatusCtaMode {
  return currentMode;
}

export function membershipStatusCtaModeFromAction(
  action: MembershipRecommendedAction | null | undefined,
): MembershipStatusCtaMode {
  if (!action) return "hidden";
  return action;
}

/** Purchase is allowed only after a verified "purchase" recommendation (or logged-out sales page). */
export function membershipStatusModeAllowsPurchase(
  mode: MembershipStatusCtaMode = currentMode,
): boolean {
  return mode === "purchase" || mode === "hidden";
}

/**
 * When true, the authenticated status overlay owns the hero CTA.
 * joinCheckout must not overwrite with DOM-derived Manage Membership.
 */
export function membershipStatusModeOwnsHeroCta(
  mode: MembershipStatusCtaMode = currentMode,
): boolean {
  return (
    mode === "loading" ||
    mode === "wait" ||
    mode === "contact_support" ||
    mode === "manage"
  );
}

/**
 * Apply purchase/manage/contact/wait overlay on the membership sales page.
 * Safe to call repeatedly as status loads.
 *
 * Ownership: for loading / wait / contact_support / manage this module owns the hero CTA.
 * joinCheckout may only apply DOM purchase/manage presentation in purchase or hidden modes.
 */
export function applyMembershipStatusCtaMode(
  mode: MembershipStatusCtaMode,
  root: ParentNode = document,
): void {
  currentMode = mode;

  const panel = root.querySelector<HTMLElement>("[data-membership-status-panel]");
  if (panel) {
    panel.setAttribute("data-membership-status-cta-mode", mode);
  }

  const allowPurchase = membershipStatusModeAllowsPurchase(mode);

  root.querySelectorAll<HTMLElement>("[data-membership-status-manage]").forEach((el) => {
    el.hidden = mode !== "manage";
  });
  root.querySelectorAll<HTMLElement>("[data-membership-status-contact]").forEach((el) => {
    el.hidden = mode !== "contact_support" && mode !== "wait";
  });
  root.querySelectorAll<HTMLElement>("[data-membership-status-retry]").forEach((el) => {
    el.hidden = mode !== "wait";
  });

  // Disable plan checkout buttons when this status must not encourage purchase.
  // Mode "hidden" (logged out) clears any temporary loading block so the sales page stays normal.
  root.querySelectorAll<HTMLButtonElement>("[data-join-checkout]").forEach((btn) => {
    if (mode === "hidden") {
      btn.removeAttribute("data-membership-status-blocked");
      if (btn.getAttribute("data-join-cta-state") !== "current") {
        btn.disabled = false;
        btn.setAttribute("aria-disabled", "false");
      }
      return;
    }

    if (!allowPurchase) {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
      btn.setAttribute("data-membership-status-blocked", "true");
      return;
    }

    btn.removeAttribute("data-membership-status-blocked");
    // Restore enablement unless joinCheckout already marked this as current plan.
    if (btn.getAttribute("data-join-cta-state") !== "current") {
      btn.disabled = false;
      btn.setAttribute("aria-disabled", "false");
    }
  });

  // Hero CTA: every settled mode must replace "Checking membership..." ù never leave loading text.
  if (mode === "loading") {
    root.querySelectorAll<HTMLAnchorElement>("[data-membership-sales-cta]").forEach((el) => {
      el.textContent = "Checking membership...";
      el.setAttribute("href", "#");
      el.setAttribute("data-membership-sales-cta-kind", "loading");
      el.setAttribute("aria-disabled", "true");
      el.classList.remove("contact-modal-trigger");
      el.removeAttribute("data-contact-source");
    });
  } else if (mode === "manage") {
    root.querySelectorAll<HTMLAnchorElement>("[data-membership-sales-cta]").forEach((el) => {
      el.textContent = "Manage Membership";
      el.setAttribute("href", "/account#membership");
      el.setAttribute("data-membership-sales-cta-kind", "manage");
      el.setAttribute("aria-disabled", "false");
      el.classList.remove("contact-modal-trigger");
      el.removeAttribute("data-contact-source");
    });
  } else if (mode === "contact_support" || mode === "wait") {
    root.querySelectorAll<HTMLAnchorElement>("[data-membership-sales-cta]").forEach((el) => {
      el.textContent = "Contact us";
      el.setAttribute("href", "#");
      el.setAttribute("data-membership-sales-cta-kind", "contact");
      el.setAttribute("aria-disabled", "false");
      el.classList.add("contact-modal-trigger");
      el.setAttribute("data-contact-source", "membership-status");
    });
  } else if (mode === "hidden" || mode === "purchase") {
    // Clear loading hero. joinCheckout may refine this for DOM-active members when mode is purchase/hidden.
    root.querySelectorAll<HTMLAnchorElement>("[data-membership-sales-cta]").forEach((el) => {
      el.textContent = MEMBERSHIP_SALES_CTA.choosePlan.label;
      el.setAttribute("href", MEMBERSHIP_SALES_CTA.choosePlan.href);
      el.setAttribute("data-membership-sales-cta-kind", MEMBERSHIP_SALES_CTA.choosePlan.kind);
      el.setAttribute("aria-disabled", "false");
      el.classList.remove("contact-modal-trigger");
      el.removeAttribute("data-contact-source");
    });
  }
}

export function shouldBlockPurchaseForStatusMode(
  mode: MembershipStatusCtaMode = currentMode,
): boolean {
  return !membershipStatusModeAllowsPurchase(mode);
}

/** Test-only reset. */
export function __resetMembershipStatusCtaForTests(): void {
  currentMode = "hidden";
}
