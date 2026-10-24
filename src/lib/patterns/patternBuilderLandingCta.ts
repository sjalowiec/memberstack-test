/**
 * Access-aware CTAs for Pattern Builder landing pages.
 *
 * Starts pending so the wrong primary action never flashes while Memberstack loads.
 * Visitors and logged-in non-members see membership CTAs.
 * Active members see the pattern-specific builder CTA.
 * A failed verification shows Try again, never the membership sales CTA.
 * A member verified within the freshness window sees the member CTA at once.
 * Socks sends only former members who still own saved Socks to My Patterns.
 */
import { hasMemberAccess, type ViewerAccessState } from "../memberAccess";
import {
  invalidateVerifiedMemberAccess,
  readFreshVerifiedMemberAccess,
  resolveVerifiedMemberAccess,
  type VerifiedMemberAccess,
} from "../memberAccessClient";
import { resolveSavedPatternAccessStateFromSession } from "./savedPatternAccessStateClient";
import { waitForMemberstackDom } from "./sleevelessPatternLoginGate";
import {
  resolveSocksLandingAction,
  SOCKS_SAVED_PATTERN_LANDING_ATTR,
} from "./socksPatternLandingAccess";
import {
  CHRISTMAS_STOCKING_SAVED_PATTERN_LANDING_ATTR,
  resolveChristmasStockingLandingAction,
} from "./christmasStockingPatternLandingAccess";

export type PatternBuilderLandingCtaMode = "pending" | "member" | "prospect" | "error";

export const PATTERN_BUILDER_LANDING_CTA_ROOT = "[data-pattern-builder-landing]";

export function resolvePatternBuilderLandingCtaMode(
  memberOrPayload: unknown,
): Exclude<PatternBuilderLandingCtaMode, "pending" | "error"> {
  return hasMemberAccess(memberOrPayload) ? "member" : "prospect";
}

/** CTA mode from the shared verification result. Errors are not prospects. */
export function landingCtaModeForVerifiedAccess(
  result: VerifiedMemberAccess,
): Exclude<PatternBuilderLandingCtaMode, "pending"> {
  if (result.status === "error") return "error";
  return landingCtaModeForViewer(result.viewer);
}

export function landingCtaModeForViewer(
  viewer: ViewerAccessState,
): Exclude<PatternBuilderLandingCtaMode, "pending" | "error"> {
  return viewer === "memberAccess" ? "member" : "prospect";
}

export function applyPatternBuilderLandingCtaMode(
  root: HTMLElement,
  mode: PatternBuilderLandingCtaMode,
): void {
  root.dataset.ctaMode = mode;

  root.querySelectorAll<HTMLElement>("[data-pattern-builder-landing-cta-loading]").forEach((el) => {
    el.hidden = mode !== "pending";
  });
  root.querySelectorAll<HTMLElement>("[data-pattern-builder-landing-cta-member]").forEach((el) => {
    el.hidden = mode !== "member";
  });
  root.querySelectorAll<HTMLElement>("[data-pattern-builder-landing-cta-prospect]").forEach((el) => {
    el.hidden = mode !== "prospect";
  });
  root.querySelectorAll<HTMLElement>("[data-pattern-builder-landing-membership]").forEach((el) => {
    el.hidden = mode !== "prospect";
  });
  root.querySelectorAll<HTMLElement>("[data-pattern-builder-landing-cta-error]").forEach((el) => {
    el.hidden = mode !== "error";
  });
}

function isSocksSavedPatternLanding(root: HTMLElement): boolean {
  return root.hasAttribute(SOCKS_SAVED_PATTERN_LANDING_ATTR);
}

function isChristmasStockingSavedPatternLanding(root: HTMLElement): boolean {
  return root.hasAttribute(CHRISTMAS_STOCKING_SAVED_PATTERN_LANDING_ATTR);
}

async function applySocksLandingPresentation(root: HTMLElement): Promise<void> {
  applyPatternBuilderLandingCtaMode(root, "pending");
  const state = await resolveSavedPatternAccessStateFromSession();
  const action = resolveSocksLandingAction(state);
  if (action.type === "pending") return;
  if (action.type === "redirect") {
    window.location.replace(action.href);
    return;
  }
  applyPatternBuilderLandingCtaMode(root, action.type === "show-member" ? "member" : "prospect");
}

async function applyChristmasStockingLandingPresentation(root: HTMLElement): Promise<void> {
  applyPatternBuilderLandingCtaMode(root, "pending");
  const state = await resolveSavedPatternAccessStateFromSession();
  const action = resolveChristmasStockingLandingAction(state);
  if (action.type === "pending") return;
  if (action.type === "redirect") {
    window.location.replace(action.href);
    return;
  }
  applyPatternBuilderLandingCtaMode(root, action.type === "show-member" ? "member" : "prospect");
}

/** Wires `[data-pattern-builder-landing]`. Defaults to pending (no CTA flash). */
export async function initPatternBuilderLandingCta(root: HTMLElement): Promise<void> {
  applyPatternBuilderLandingCtaMode(root, "pending");

  if (isSocksSavedPatternLanding(root)) {
    await applySocksLandingPresentation(root);
    const ms = window.$memberstackDom;
    if (ms && typeof ms.on === "function") {
      ms.on("member.login", () => {
        void applySocksLandingPresentation(root);
      });
      ms.on("member.logout", () => {
        applyPatternBuilderLandingCtaMode(root, "prospect");
      });
    }
    return;
  }

  if (isChristmasStockingSavedPatternLanding(root)) {
    await applyChristmasStockingLandingPresentation(root);
    const ms = window.$memberstackDom;
    if (ms && typeof ms.on === "function") {
      ms.on("member.login", () => {
        void applyChristmasStockingLandingPresentation(root);
      });
      ms.on("member.logout", () => {
        applyPatternBuilderLandingCtaMode(root, "prospect");
      });
    }
    return;
  }

  if (readFreshVerifiedMemberAccess()?.viewer === "memberAccess") {
    applyPatternBuilderLandingCtaMode(root, "member");
  }

  let generation = 0;
  const refresh = async (force: boolean): Promise<void> => {
    const mine = ++generation;
    const result = await resolveVerifiedMemberAccess({ force });
    if (mine !== generation) return;
    const mode = landingCtaModeForVerifiedAccess(result);
    // Keep a fresh verified member CTA through a transient failure; the
    // builder itself re-verifies and the server authorizes saves.
    if (
      mode === "error" &&
      root.dataset.ctaMode === "member" &&
      readFreshVerifiedMemberAccess()?.viewer === "memberAccess"
    ) {
      return;
    }
    applyPatternBuilderLandingCtaMode(root, mode);
  };

  root.querySelectorAll<HTMLElement>("[data-pattern-builder-landing-cta-retry]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      applyPatternBuilderLandingCtaMode(root, "pending");
      void refresh(true);
    });
  });

  await refresh(false);

  await waitForMemberstackDom();
  const ms = window.$memberstackDom;
  if (ms && typeof ms.on === "function") {
    const onAuthChange = (): void => {
      invalidateVerifiedMemberAccess();
      applyPatternBuilderLandingCtaMode(root, "pending");
      void refresh(true);
    };
    ms.on("member.login", onAuthChange);
    ms.on("member.logout", onAuthChange);
  }
}
