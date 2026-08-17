/**
 * Public Patterns landing (`/patterns/about`) primary CTA.
 *
 * Active members ? Create a Pattern (catalog).
 * Visitors and logged-in non-members ? membership CTAs (never into the builder/catalog).
 */
import { hasMemberAccess } from "../memberAccess";
import { PATTERN_CATALOG_HREF } from "./customPatternProjectNavigation";
import { waitForMemberstackDom, waitForMemberstackReady } from "./sleevelessPatternLoginGate";

export const PATTERNS_LANDING_MEMBER_CTA_LABEL = "Create a Pattern";
export const PATTERNS_LANDING_MEMBER_CTA_HREF = PATTERN_CATALOG_HREF;

export const PATTERNS_LANDING_MEMBERSHIP_HEADING = "Create a Pattern";
export const PATTERNS_LANDING_MEMBERSHIP_BODY =
  "Dynamic Patterns are included with an active Knit it Now membership. Each pattern is customized for your machine, gauge, yarn, and measurements.";
/** Catalog (`/patterns`) membership pitch under More Pattern Builders. */
export const PATTERN_CATALOG_MEMBERSHIP_BODY =
  "Sweater pattern builders are included with an active Knit It Now membership.";
export const PATTERN_CATALOG_MORE_HEADING = "More Pattern Builders";
export const PATTERNS_LANDING_BECOME_MEMBER_LABEL = "Become a Member";
export const PATTERNS_LANDING_BECOME_MEMBER_HREF = "/membership";
export const PATTERNS_LANDING_LOGIN_LABEL = "Already a Member? Log In";

/** Future ActivePresenter walkthrough mount point ? do not invent a video URL. */
export const PATTERNS_LANDING_DEMO_PLACEHOLDER_ATTR = "data-patterns-landing-demo-placeholder";

export type PatternsLandingCtaMode = "member" | "prospect";

export function resolvePatternsLandingCtaMode(memberOrPayload: unknown): PatternsLandingCtaMode {
  return hasMemberAccess(memberOrPayload) ? "member" : "prospect";
}

/**
 * Guest catalog (featured free Hat) vs member catalog (standard cards).
 * Fail closed to the guest/prospect presentation until paid membership is confirmed.
 */
export function applyPatternsCatalogPresentation(
  mode: PatternsLandingCtaMode,
  root: ParentNode = document,
): void {
  root.querySelectorAll<HTMLElement>("[data-patterns-catalog]").forEach((el) => {
    const isMemberCatalog = el.dataset.patternsCatalog === "member";
    const show = isMemberCatalog ? mode === "member" : mode !== "member";
    el.toggleAttribute("hidden", !show);
  });
}

function applyMode(root: HTMLElement, mode: PatternsLandingCtaMode): void {
  root.dataset.ctaMode = mode;
  const memberBlock = root.querySelector("[data-patterns-landing-cta-member]");
  const prospectBlock = root.querySelector("[data-patterns-landing-cta-prospect]");
  if (memberBlock instanceof HTMLElement) {
    memberBlock.hidden = mode !== "member";
  }
  if (prospectBlock instanceof HTMLElement) {
    prospectBlock.hidden = mode !== "prospect";
  }
  const page = root.closest("[data-patterns-page]") ?? root.ownerDocument ?? document;
  applyPatternsCatalogPresentation(mode, page);
}

/** Wires `[data-patterns-landing-cta]`. Defaults to prospect (fail closed ? no catalog link). */
export async function initPatternsLandingCta(root: HTMLElement): Promise<void> {
  applyMode(root, "prospect");

  await waitForMemberstackDom();
  const ms = window.$memberstackDom;
  if (!ms?.getCurrentMember) {
    applyMode(root, "prospect");
    return;
  }

  const refresh = async (): Promise<void> => {
    try {
      await waitForMemberstackReady(ms);
      const res = await ms.getCurrentMember();
      // Logged-in without plans stays on prospect CTAs (Become a Member), not a free-account path.
      applyMode(root, resolvePatternsLandingCtaMode(res));
    } catch {
      applyMode(root, "prospect");
    }
  };

  await refresh();

  if (typeof ms.on === "function") {
    ms.on("member.login", () => {
      void refresh();
    });
    ms.on("member.logout", () => {
      applyMode(root, "prospect");
    });
  }
}
