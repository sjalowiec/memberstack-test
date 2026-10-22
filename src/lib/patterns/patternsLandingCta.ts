/**
 * Public Patterns landing (`/patterns/about`) primary CTA.
 *
 * Active members ? Create a Pattern (catalog).
 * Visitors and logged-in non-members ? membership CTAs (never into the builder/catalog).
 */
import { getViewerAccessState, hasMemberAccess, type MemberAccessOptions } from "../memberAccess";
import { ensureLegacyPaidThroughContext } from "../memberAccessClient";
import { PATTERN_CATALOG_HREF } from "./customPatternProjectNavigation";
import { waitForMemberstackDom, waitForMemberstackReady } from "./sleevelessPatternLoginGate";

export const PATTERNS_LANDING_MEMBER_CTA_LABEL = "Create a Pattern";
export const PATTERNS_LANDING_MEMBER_CTA_HREF = PATTERN_CATALOG_HREF;

export const PATTERNS_LANDING_MEMBERSHIP_HEADING = "Create a Pattern";
export const PATTERNS_LANDING_MEMBERSHIP_BODY =
  "Dynamic Patterns are included with an active Knit it Now membership. Each pattern is customized for your machine, gauge, yarn, and measurements.";
/** Catalog (`/patterns`) membership pitch. Hat stays free; other builders require membership. */
export const PATTERN_CATALOG_MEMBERSHIP_BODY =
  "The Hat builder is free to try. The other Pattern Builders are included with an active Knit It Now membership.";
/** Logged-in visitor who does not currently have member access. */
export const PATTERN_CATALOG_SIGNED_IN_MEMBERSHIP_BODY =
  "The Hat builder is free to try. Join or renew your Knit It Now membership to create patterns with the other builders. Patterns you already saved stay in My Patterns.";
export const PATTERN_CATALOG_MORE_HEADING = "Choose a Project";
/** Active-member catalog headline. Welcoming, and not a membership pitch. */
export const PATTERN_CATALOG_MEMBER_HEADLINE = "Ready for your next project.";
export const PATTERN_CATALOG_MEMBER_LEAD =
  "Choose a project and build knitting instructions from your gauge, your measurements, and your machine.";
export const PATTERNS_LANDING_BECOME_MEMBER_LABEL = "Become a Member";
export const PATTERNS_LANDING_BECOME_MEMBER_HREF = "/membership";
export const PATTERNS_LANDING_JOIN_OR_RENEW_LABEL = "Join or renew";
export const PATTERNS_LANDING_LOGIN_LABEL = "Already a Member? Log In";

/** Future ActivePresenter walkthrough mount point ? do not invent a video URL. */
export const PATTERNS_LANDING_DEMO_PLACEHOLDER_ATTR = "data-patterns-landing-demo-placeholder";

export type PatternsLandingCtaMode = "member" | "prospect";

/**
 * Catalog page audiences. Membership is `hasMemberAccess` (paid, trialing,
 * complimentary, or a current Watson paid-through date). Login alone is not membership.
 */
export type PatternsCatalogAudience = "loggedOut" | "loggedInNoAccess" | "member";

export function resolvePatternsLandingCtaMode(
  memberOrPayload: unknown,
  options?: MemberAccessOptions,
): PatternsLandingCtaMode {
  return hasMemberAccess(memberOrPayload, options) ? "member" : "prospect";
}

export function resolvePatternsCatalogAudience(
  memberOrPayload: unknown,
  options?: MemberAccessOptions,
): PatternsCatalogAudience {
  const state = getViewerAccessState(memberOrPayload, options);
  if (state === "memberAccess") return "member";
  if (state === "loggedInNoAccess") return "loggedInNoAccess";
  return "loggedOut";
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

/**
 * Swaps logged-out vs signed-in-without-membership copy.
 * Active members hide these blocks with the guest catalog.
 * Fail closed: only the matching audience is shown.
 */
export function applyPatternsAudienceMessaging(
  audience: PatternsCatalogAudience,
  root: ParentNode = document,
): void {
  root.querySelectorAll<HTMLElement>("[data-patterns-audience]").forEach((el) => {
    el.toggleAttribute("hidden", el.dataset.patternsAudience !== audience);
  });
}

function pageRoot(root: HTMLElement): ParentNode {
  return root.closest("[data-patterns-page]") ?? root.ownerDocument ?? document;
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
  applyPatternsCatalogPresentation(mode, pageRoot(root));
}

/**
 * Sales content, including the sleeve demonstration, is for visitors without
 * member access. It stays hidden while access is unresolved so members never
 * see it flash. Active members get the short project introduction instead.
 */
export function applyPatternsSalesPresentation(
  audience: PatternsCatalogAudience | "pending",
  root: ParentNode = document,
): void {
  const showSales = audience !== "member" && audience !== "pending";
  const candidate = root as HTMLElement;
  const page =
    typeof candidate.matches === "function" && candidate.matches("[data-patterns-page]")
      ? candidate
      : null;
  if (page) {
    page.dataset.patternsAccess =
      audience === "pending" ? "pending" : audience === "member" ? "member" : "visitor";
  }
  root.querySelectorAll<HTMLElement>("[data-patterns-sales]").forEach((el) => {
    el.hidden = !showSales;
  });
  root.querySelectorAll<HTMLElement>("[data-patterns-member-intro]").forEach((el) => {
    el.hidden = audience !== "member";
  });
  root.querySelectorAll<HTMLElement>("[data-gauge-demo]").forEach((el) => {
    el.hidden = !showSales;
  });
}

function applyCatalogAudience(
  root: HTMLElement,
  audience: PatternsCatalogAudience,
  options?: { revealSales?: boolean },
): void {
  const page = pageRoot(root);
  applyMode(root, audience === "member" ? "member" : "prospect");
  applyPatternsAudienceMessaging(audience, page);
  if (options?.revealSales === false) return;
  const candidate = page as HTMLElement;
  applyPatternsSalesPresentation(
    audience,
    typeof candidate.matches === "function" ? candidate : root,
  );
}

/** Wires `[data-patterns-landing-cta]`. Library fails closed to logged-out. Sales stays hidden until access is confirmed. */
export async function initPatternsLandingCta(root: HTMLElement): Promise<void> {
  const page = pageRoot(root);
  if (page instanceof HTMLElement) page.dataset.patternsAccess = "pending";
  applyCatalogAudience(root, "loggedOut", { revealSales: false });

  await waitForMemberstackDom();
  const ms = window.$memberstackDom;
  if (!ms?.getCurrentMember) {
    applyCatalogAudience(root, "loggedOut");
    return;
  }

  const refresh = async (): Promise<void> => {
    try {
      await waitForMemberstackReady(ms);
      const res = await ms.getCurrentMember();
      await ensureLegacyPaidThroughContext(res);
      applyCatalogAudience(root, resolvePatternsCatalogAudience(res));
    } catch {
      applyCatalogAudience(root, "loggedOut");
    }
  };

  await refresh();

  if (typeof ms.on === "function") {
    ms.on("member.login", () => {
      void refresh();
    });
    ms.on("member.logout", () => {
      applyCatalogAudience(root, "loggedOut");
    });
  }
}
