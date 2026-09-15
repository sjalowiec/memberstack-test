/**
 * Access-aware CTAs for Pattern Builder landing pages.
 *
 * Starts pending so the wrong primary action never flashes while Memberstack loads.
 * Visitors and logged-in non-members see membership CTAs.
 * Active members see the pattern-specific builder CTA.
 */
import { hasMemberAccess } from "../memberAccess";
import { ensureLegacyPaidThroughContext } from "../memberAccessClient";
import { waitForMemberstackDom, waitForMemberstackReady } from "./sleevelessPatternLoginGate";

export type PatternBuilderLandingCtaMode = "pending" | "member" | "prospect";

export const PATTERN_BUILDER_LANDING_CTA_ROOT = "[data-pattern-builder-landing]";

export function resolvePatternBuilderLandingCtaMode(
  memberOrPayload: unknown,
): Exclude<PatternBuilderLandingCtaMode, "pending"> {
  return hasMemberAccess(memberOrPayload) ? "member" : "prospect";
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
}

/** Wires `[data-pattern-builder-landing]`. Defaults to pending (no CTA flash). */
export async function initPatternBuilderLandingCta(root: HTMLElement): Promise<void> {
  applyPatternBuilderLandingCtaMode(root, "pending");

  await waitForMemberstackDom();
  const ms = window.$memberstackDom;
  if (!ms?.getCurrentMember) {
    applyPatternBuilderLandingCtaMode(root, "prospect");
    return;
  }

  const refresh = async (): Promise<void> => {
    try {
      await waitForMemberstackReady(ms);
      const res = await ms.getCurrentMember();
      await ensureLegacyPaidThroughContext(res);
      applyPatternBuilderLandingCtaMode(root, resolvePatternBuilderLandingCtaMode(res));
    } catch {
      applyPatternBuilderLandingCtaMode(root, "prospect");
    }
  };

  await refresh();

  if (typeof ms.on === "function") {
    ms.on("member.login", () => {
      void refresh();
    });
    ms.on("member.logout", () => {
      applyPatternBuilderLandingCtaMode(root, "prospect");
    });
  }
}
