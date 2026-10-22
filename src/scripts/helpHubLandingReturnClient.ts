/**
 * Save the Help Hub landing page when Read more opens a tip in this tab,
 * and restore it for browser Back or the article's Back to Help Hub link.
 */

import { installHelpHubFavoriteAnalytics, reportHelpHubTipPageOpen } from "../lib/analytics/helpHubGa";
import { bootFavoriteStars } from "../lib/favorites/bootFavoriteStars";
import {
  acknowledgeHelpHubArticleVisit,
  consumeHelpHubArticleBack,
  createHelpHubLandingReturn,
  createHelpHubLandingSnapshot,
  HELP_HUB_LANDING_RETURN_KEY,
  isPlainHelpHubReadMoreClick,
  landingSnapshotToRestore,
  parseHelpHubLandingReturn,
  serializeHelpHubLandingReturn,
  type HelpHubLandingReturn,
  type HelpHubLandingSnapshot,
} from "../lib/helpHub/landingReturn";
import { helpHubSlugFromFavoriteContentId } from "../lib/helpHub/discovery";
import { applyHelpHubIndexQuery } from "./helpHubIndexClient";
import {
  readHelpHubDiscoveryView,
  refreshHelpHubDiscoveryFavorites,
  restoreHelpHubDiscoveryView,
} from "./helpHubDiscoveryClient";

function readNavigationType(): string {
  try {
    const entry = performance.getEntriesByType("navigation")[0];
    if (entry && "type" in entry && typeof entry.type === "string") return entry.type;
  } catch {
    /* Older browsers still get a normal landing page. */
  }
  return "navigate";
}

export function readHelpHubLandingReturn(): HelpHubLandingReturn | null {
  try {
    return parseHelpHubLandingReturn(sessionStorage.getItem(HELP_HUB_LANDING_RETURN_KEY));
  } catch {
    return null;
  }
}

export function writeHelpHubLandingReturn(value: HelpHubLandingReturn | null): void {
  try {
    if (!value) sessionStorage.removeItem(HELP_HUB_LANDING_RETURN_KEY);
    else sessionStorage.setItem(HELP_HUB_LANDING_RETURN_KEY, serializeHelpHubLandingReturn(value));
  } catch {
    /* Storage can be unavailable. The link still opens the tip. */
  }
}

function readLandingChrome(root: ParentNode): {
  search: string;
  openNew: boolean;
  openFavorites: boolean;
  openCategories: string[];
  scrollY: number;
} {
  const input = root.querySelector("#help-hub-search-input");
  const search = input instanceof HTMLInputElement ? input.value : "";
  const newSection = root.querySelector("[data-help-hub-new]");
  const favoritesSection = root.querySelector("[data-help-hub-favorites]");
  const openCategories: string[] = [];
  root.querySelectorAll("[data-help-hub-category]").forEach((section) => {
    if (!(section instanceof HTMLDetailsElement) || !section.open) return;
    const key = section.dataset.helpHubCategory?.trim() ?? "";
    if (key) openCategories.push(key);
  });
  return {
    search,
    openNew: newSection instanceof HTMLDetailsElement && newSection.open,
    openFavorites: favoritesSection instanceof HTMLDetailsElement && favoritesSection.open,
    openCategories,
    scrollY: window.scrollY || document.documentElement.scrollTop || 0,
  };
}

function captureSnapshot(root: ParentNode, slug: string): HelpHubLandingSnapshot | null {
  const discovery = readHelpHubDiscoveryView();
  return createHelpHubLandingSnapshot({
    slug: discovery?.slug || slug,
    seenSlugs: discovery?.seenSlugs ?? [],
    ...readLandingChrome(root),
  });
}

/** Remember accordion, search, and scroll before a Help Hub tip opens in this tab. */
export function rememberHelpHubLandingDestination(root: ParentNode, destinationSlug: string): void {
  const discovery = readHelpHubDiscoveryView();
  const snapshot = createHelpHubLandingSnapshot({
    slug: destinationSlug,
    seenSlugs: discovery?.seenSlugs ?? [],
    ...readLandingChrome(root),
  });
  if (snapshot) writeHelpHubLandingReturn(createHelpHubLandingReturn(snapshot));
}

function slugFromExplore(explore: HTMLAnchorElement): string {
  try {
    const url = new URL(explore.getAttribute("href") || explore.href, window.location.origin);
    return helpHubSlugFromFavoriteContentId(url.pathname) ?? "";
  } catch {
    return "";
  }
}

function scrollToSaved(y: number): void {
  const top = Math.max(0, y);
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  const scroller = document.scrollingElement;
  if (scroller) scroller.scrollTop = top;
  window.scrollTo(0, top);
  root.style.scrollBehavior = previous;
}

function applySnapshot(root: ParentNode, snapshot: HelpHubLandingSnapshot): void {
  restoreHelpHubDiscoveryView({
    slug: snapshot.slug,
    seenSlugs: snapshot.seenSlugs,
  });

  const input = root.querySelector("#help-hub-search-input");
  if (input instanceof HTMLInputElement) input.value = snapshot.search;
  applyHelpHubIndexQuery(root, snapshot.search);

  const openCategories = new Set(snapshot.openCategories);
  const newSection = root.querySelector("[data-help-hub-new]");
  if (newSection instanceof HTMLDetailsElement && !newSection.hidden) {
    newSection.open = snapshot.openNew;
  }
  const favoritesSection = root.querySelector("[data-help-hub-favorites]");
  if (favoritesSection instanceof HTMLDetailsElement && !favoritesSection.hidden) {
    favoritesSection.open = snapshot.openFavorites;
  }
  root.querySelectorAll("[data-help-hub-category]").forEach((section) => {
    if (!(section instanceof HTMLDetailsElement)) return;
    if (section.hidden) {
      section.open = false;
      return;
    }
    const key = section.dataset.helpHubCategory ?? "";
    section.open = key !== "" && openCategories.has(key);
  });

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  const applyScroll = () => {
    scrollToSaved(snapshot.scrollY);
    if ("scrollRestoration" in history) history.scrollRestoration = "auto";
  };
  window.requestAnimationFrame(() => window.requestAnimationFrame(applyScroll));
  if (document.readyState !== "complete") {
    window.addEventListener("load", applyScroll, { once: true });
  }
}

export function initHelpHubLandingReturn(root: ParentNode): void {
  const explore = root.querySelector("[data-help-hub-discovery-explore]");
  if (explore instanceof HTMLAnchorElement) {
    explore.target = "_self";
    explore.addEventListener(
      "click",
      (event) => {
        if (!isPlainHelpHubReadMoreClick(event)) return;
        event.preventDefault();
        explore.target = "_self";
        const slug = slugFromExplore(explore);
        const snapshot = captureSnapshot(root, slug);
        if (snapshot) writeHelpHubLandingReturn(createHelpHubLandingReturn(snapshot));
        const href = explore.href;
        if (href) window.setTimeout(() => window.location.assign(href), 0);
      },
      true,
    );
  }

  const snapshot = landingSnapshotToRestore({
    stored: readHelpHubLandingReturn(),
    navigationType: readNavigationType(),
  });
  if (snapshot) {
    writeHelpHubLandingReturn(null);
    applySnapshot(root, snapshot);
  }

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    void refreshHelpHubDiscoveryFavorites();
    void bootFavoriteStars({ contentType: "reference" });
  });
}

export function initHelpHubArticleReturn(root: HTMLElement): void {
  const articleSlug = root.dataset.helpHubArticleSlug?.trim() ?? "";
  if (!articleSlug) return;
  reportHelpHubTipPageOpen(articleSlug);
  installHelpHubFavoriteAnalytics();
  const acknowledged = acknowledgeHelpHubArticleVisit(
    readHelpHubLandingReturn(),
    articleSlug,
    readNavigationType(),
  );
  const current = readHelpHubLandingReturn();
  if (acknowledged && acknowledged !== current) writeHelpHubLandingReturn(acknowledged);

  root.querySelectorAll(".page-back-link a").forEach((node) => {
    node.addEventListener("click", (event) => {
      if (!(event instanceof MouseEvent) || !isPlainHelpHubReadMoreClick(event)) return;
      const next = consumeHelpHubArticleBack(readHelpHubLandingReturn(), articleSlug);
      if (next) writeHelpHubLandingReturn(next);
    });
  });
}
