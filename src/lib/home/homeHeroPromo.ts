/**
 * Homepage promotional boxes (hero card + closing CTA).
 *
 * Guests keep the join invitation. Active members see a welcome/action message.
 * Auth comes only from the sitewide BaseLayout snapshot (`__KIN_MEMBER_ACCESS__`
 * / `kin:member-access`) — no extra Memberstack fetch.
 *
 * First paint stays `pending` and the whole card stays suppressed until
 * authentication resolves, so members never see an empty white box.
 */
import { PATTERN_CATALOG_HREF } from "../patterns/customPatternProjectNavigation";

export type HomeHeroPromoMode = "pending" | "guest" | "member";

export type HomeHeroPromoSnapshot = {
  hasMemberAccess?: boolean;
  viewerAccessState?: "loggedOut" | "loggedInNoAccess" | "memberAccess" | string;
} | null | undefined;

export const HOME_HERO_PROMO_ROOT_ATTR = "data-home-promo";
export const HOME_HERO_PROMO_PANEL_ATTR = "data-home-promo-panel";
export const HOME_HERO_PROMO_BOUND_ATTR = "data-home-promo-bound";

export const HOME_HERO_GUEST_HEADING =
  "Learn, build skills, and machine knit with confidence.";
export const HOME_HERO_GUEST_COPY =
  "Whether you're a beginner or a seasoned pro, we provide the tools, patterns, and tutorials to help you spend less time guessing and more time knitting.";

export const HOME_HERO_MEMBER_HEADING = "Welcome back.";
export const HOME_HERO_MEMBER_COPY =
  "Your membership is ready. Jump into pattern builders, videos, and tools whenever you knit.";
export const HOME_HERO_MEMBER_SECONDARY_LABEL = "Create a Pattern";
export const HOME_HERO_MEMBER_SECONDARY_HREF = PATTERN_CATALOG_HREF;

export const HOME_CTA_GUEST_HEADING = "Ready to explore?";
export const HOME_CTA_GUEST_COPY =
  "Take your time looking around. When you're ready for full access to builders, courses, and member resources, we'd love to have you join.";

export const HOME_CTA_MEMBER_HEADING = "Ready when you are.";
export const HOME_CTA_MEMBER_COPY =
  "Your membership includes pattern builders, courses, videos, and tools. Start wherever you are today.";

const ROOT_SELECTOR = `[${HOME_HERO_PROMO_ROOT_ATTR}]`;
const GUEST_PANEL_SELECTOR = `[${HOME_HERO_PROMO_PANEL_ATTR}="guest"]`;
const MEMBER_PANEL_SELECTOR = `[${HOME_HERO_PROMO_PANEL_ATTR}="member"]`;
const HERO_SECTION_SELECTOR = "[data-home-hero]";
const CTA_SECTION_SELECTOR = "[data-home-cta]";
const GUEST_HEADING_ID = "home-hero-heading";
const MEMBER_HEADING_ID = "home-hero-heading-member";
const GUEST_CTA_HEADING_ID = "home-cta-heading";
const MEMBER_CTA_HEADING_ID = "home-cta-heading-member";

let bound = false;

export function resolveHomeHeroPromoMode(
  snapshot: HomeHeroPromoSnapshot,
): HomeHeroPromoMode {
  if (!snapshot || typeof snapshot !== "object") return "pending";

  if (snapshot.viewerAccessState === "memberAccess" || snapshot.hasMemberAccess === true) {
    return "member";
  }

  if (
    snapshot.viewerAccessState === "loggedOut" ||
    snapshot.viewerAccessState === "loggedInNoAccess" ||
    snapshot.hasMemberAccess === false
  ) {
    return "guest";
  }

  return "pending";
}

function readSitewideSnapshot(): HomeHeroPromoSnapshot {
  if (typeof window === "undefined") return null;
  return window.__KIN_MEMBER_ACCESS__ ?? null;
}

function snapshotFromDetail(detail: unknown): HomeHeroPromoSnapshot {
  if (detail && typeof detail === "object") {
    const record = detail as HomeHeroPromoSnapshot;
    if (
      record &&
      (typeof record.hasMemberAccess === "boolean" || typeof record.viewerAccessState === "string")
    ) {
      return record;
    }
  }
  return readSitewideSnapshot();
}

function setPanelVisibility(panel: HTMLElement | null, visible: boolean): void {
  if (!panel) return;
  panel.hidden = !visible;
  panel.setAttribute("aria-hidden", visible ? "false" : "true");
}

/**
 * Apply guest / member / pending to every `[data-home-promo]` box.
 * Pending suppresses the whole card (CSS + aria-hidden) so members never
 * see an empty white box or the join invitation.
 */
export function applyHomeHeroPromo(
  root: ParentNode,
  mode: HomeHeroPromoMode,
): void {
  root.querySelectorAll<HTMLElement>(ROOT_SELECTOR).forEach((box) => {
    box.dataset.homePromoState = mode;
    box.setAttribute("aria-busy", mode === "pending" ? "true" : "false");
    box.setAttribute("aria-hidden", mode === "pending" ? "true" : "false");

    const guest = box.querySelector<HTMLElement>(GUEST_PANEL_SELECTOR);
    const member = box.querySelector<HTMLElement>(MEMBER_PANEL_SELECTOR);

    if (mode === "pending") {
      setPanelVisibility(guest, false);
      setPanelVisibility(member, false);
    } else {
      setPanelVisibility(guest, mode === "guest");
      setPanelVisibility(member, mode === "member");
    }
  });

  const hero = root.querySelector<HTMLElement>(HERO_SECTION_SELECTOR);
  if (hero) {
    hero.setAttribute(
      "aria-labelledby",
      mode === "member" ? MEMBER_HEADING_ID : GUEST_HEADING_ID,
    );
  }

  const cta = root.querySelector<HTMLElement>(CTA_SECTION_SELECTOR);
  if (cta) {
    cta.setAttribute(
      "aria-labelledby",
      mode === "member" ? MEMBER_CTA_HEADING_ID : GUEST_CTA_HEADING_ID,
    );
  }
}

export function initHomeHeroPromo(root: ParentNode = document): void {
  const firstBox = root.querySelector<HTMLElement>(ROOT_SELECTOR);
  if (!firstBox) return;
  if (bound || firstBox.getAttribute(HOME_HERO_PROMO_BOUND_ATTR) === "true") return;
  firstBox.setAttribute(HOME_HERO_PROMO_BOUND_ATTR, "true");
  bound = true;

  const refresh = (detail?: unknown): void => {
    applyHomeHeroPromo(root, resolveHomeHeroPromoMode(snapshotFromDetail(detail)));
  };

  if (typeof window !== "undefined") {
    window.addEventListener("kin:member-access", ((event: Event) => {
      refresh((event as CustomEvent<HomeHeroPromoSnapshot>).detail);
    }) as EventListener);
    window.addEventListener("auth:updated", () => {
      refresh();
    });
  }

  refresh(readSitewideSnapshot());
}

/** Reset the bind-once flag in tests. */
export function resetHomeHeroPromoBindForTests(): void {
  bound = false;
}
