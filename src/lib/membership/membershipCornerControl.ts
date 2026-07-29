/**
 * Behavior wiring for the floating membership corner CTA.
 *
 * Resolves label + destination from Memberstack state, then navigates to the
 * resolved href. "manage" points at /account#membership (the single membership
 * hub); the Stripe Customer Portal is launched only by the account panel's
 * Manage Billing button. Visual pill lives in MembershipCornerCta.astro.
 */

import {
  MEMBERSHIP_CORNER_CTA,
  resolveMembershipCornerCta,
  type MembershipCornerCta,
} from "./membershipCornerCta";

/** Default label before Memberstack resolves (SSR / first paint). */
export const MEMBERSHIP_CORNER_CTA_LABEL = MEMBERSHIP_CORNER_CTA.become.label;

async function waitForMemberstackPayload(
  attempts = 30,
  delayMs = 200,
): Promise<unknown | null> {
  for (let i = 0; i < attempts; i++) {
    const ms = window.$memberstackDom;
    const api = ms?.getAppAndMember ?? ms?.getCurrentMember;
    if (typeof api === "function") {
      try {
        return await api.call(ms);
      } catch (error) {
        console.warn("[membership corner] Memberstack member check failed", error);
        return null;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

function applyCornerCta(ctaEl: HTMLButtonElement, resolved: MembershipCornerCta): void {
  ctaEl.textContent = resolved.label;
  ctaEl.dataset.membershipCornerKind = resolved.kind;
  ctaEl.dataset.membershipCornerHref = resolved.href;
}

async function refreshCornerCta(ctaEl: HTMLButtonElement): Promise<void> {
  const payload = await waitForMemberstackPayload();
  applyCornerCta(ctaEl, resolveMembershipCornerCta(payload));
}

export type MembershipCornerClickDeps = {
  navigate?: (href: string) => void;
};

/**
 * Perform the corner CTA action. Every kind now navigates to its href; Manage
 * Membership navigates to /account#membership rather than opening the Stripe
 * portal directly. Exported for unit tests — production wiring calls this from
 * the click handler.
 */
export async function performMembershipCornerAction(
  _kind: string | undefined,
  href: string,
  deps: MembershipCornerClickDeps = {},
): Promise<"navigate"> {
  const navigate =
    deps.navigate ??
    ((target: string) => {
      window.location.assign(target);
    });

  navigate(href || MEMBERSHIP_CORNER_CTA.become.href);
  return "navigate";
}

/**
 * Bind the corner CTA: resolve smart label from Memberstack; navigate to href.
 */
export function initMembershipCornerControl(): void {
  const cta = document.querySelector<HTMLButtonElement>("[data-membership-corner-cta]");
  if (!cta) return;

  applyCornerCta(cta, MEMBERSHIP_CORNER_CTA.become);

  cta.addEventListener("click", () => {
    if (cta.disabled) return;

    const kind = cta.dataset.membershipCornerKind;
    const href = cta.dataset.membershipCornerHref || MEMBERSHIP_CORNER_CTA.become.href;
    void performMembershipCornerAction(kind, href);
  });

  void refreshCornerCta(cta);

  const ms = window.$memberstackDom;
  if (ms && typeof ms.on === "function") {
    ms.on("member.login", () => {
      void refreshCornerCta(cta);
    });
    ms.on("member.logout", () => {
      applyCornerCta(cta, MEMBERSHIP_CORNER_CTA.become);
    });
  }
}
