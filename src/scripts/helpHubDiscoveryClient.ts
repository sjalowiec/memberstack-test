/**
 * Landing-page Help Hub conversation.
 * Surprise Me swaps the question and saved quick answer in place.
 * Read more, Surprise Me, and favorite changes are recorded without the question text.
 */

import {
  FAVORITES_CHANGE_EVENT,
  isFavoritesMemberLoggedIn,
  listFavorites,
} from "../lib/favorites/favoritesClient";
import { applyFavoriteStarState } from "../lib/favorites/favoriteStarUi";
import {
  helpHubFavoriteContentId,
  helpHubSlugFromFavoriteContentId,
  nextDiscoveryIndex,
  type HelpHubDiscoveryEntry,
} from "../lib/helpHub/discovery";
import { reportHelpHubAction } from "../lib/analytics/helpHubGa";
import type { HelpHubDiscoveryActivityType } from "../lib/helpHub/discoveryActivity";
import { resolveActivitySender } from "../lib/searchActivityClient";

const ACTIVITY_ENDPOINT = "/api/help-hub/discovery-activity";

export type HelpHubDiscoveryViewState = {
  slug: string;
  seenSlugs: string[];
};

type HelpHubDiscoveryBridge = {
  read: () => HelpHubDiscoveryViewState;
  restore: (state: HelpHubDiscoveryViewState) => void;
  refreshFavorites: () => Promise<void>;
};

let discoveryBridge: HelpHubDiscoveryBridge | null = null;

export function readHelpHubDiscoveryView(): HelpHubDiscoveryViewState | null {
  return discoveryBridge?.read() ?? null;
}

export function restoreHelpHubDiscoveryView(state: HelpHubDiscoveryViewState): void {
  discoveryBridge?.restore(state);
}

export function refreshHelpHubDiscoveryFavorites(): Promise<void> {
  return discoveryBridge?.refreshFavorites() ?? Promise.resolve();
}

function readEntries(section: ParentNode): HelpHubDiscoveryEntry[] {
  const node = section.querySelector("[data-help-hub-discovery-entries]");
  if (!node) return [];
  try {
    const parsed = JSON.parse(node.textContent || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is HelpHubDiscoveryEntry => {
      if (!item || typeof item !== "object") return false;
      const entry = item as HelpHubDiscoveryEntry;
      return Boolean(entry.slug && entry.question && entry.answer);
    });
  } catch {
    return [];
  }
}

function track(eventType: HelpHubDiscoveryActivityType, slug: string): void {
  if (eventType === "surprise_me" || eventType === "discovery_open") {
    reportHelpHubAction(eventType, slug, "discovery_card");
  }
  void (async () => {
    try {
      const sender = await resolveActivitySender();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sender.token) headers.Authorization = `Bearer ${sender.token}`;
      await fetch(ACTIVITY_ENDPOINT, {
        method: "POST",
        headers,
        keepalive: true,
        body: JSON.stringify({
          eventType,
          slug,
          identity: sender.identity,
          sourcePage: window.location.pathname,
        }),
      });
    } catch {
      // Activity tracking must never block the page.
    }
  })();
}

export function initHelpHubDiscovery(root: ParentNode): void {
  const section = root.querySelector("[data-help-hub-discovery]");
  if (!(section instanceof HTMLElement)) return;
  const entries = readEntries(section);
  if (entries.length === 0) return;

  const questionEl = section.querySelector("[data-help-hub-discovery-question]");
  const answerEl = section.querySelector("[data-help-hub-discovery-answer-text]");
  const explore = section.querySelector("[data-help-hub-discovery-explore]");
  const surprise = section.querySelector("[data-help-hub-discovery-surprise]");
  const favorite = section.querySelector("[data-favorite-star]");
  const status = section.querySelector("[data-help-hub-discovery-status]");
  if (
    !(questionEl instanceof HTMLElement) ||
    !(answerEl instanceof HTMLElement) ||
    !(explore instanceof HTMLAnchorElement) ||
    !(surprise instanceof HTMLButtonElement) ||
    !(favorite instanceof HTMLButtonElement)
  ) {
    return;
  }

  let current = 0;
  let seen = new Set<number>([0]);
  const savedIds = new Set<string>();
  let favoriteWatch: { slug: string; before: boolean; sawBusy: boolean } | null = null;

  function currentEntry(): HelpHubDiscoveryEntry | null {
    return entries[current] ?? null;
  }

  function render(index: number, announce: boolean): void {
    const entry = entries[index];
    if (!entry) return;
    current = index;
    questionEl.textContent = entry.question;
    answerEl.textContent = entry.answer;
    explore.href = `/help-hub/${encodeURIComponent(entry.slug)}`;
    const favoriteId = helpHubFavoriteContentId(entry.slug);
    favorite.setAttribute("data-content-id", favoriteId);
    applyFavoriteStarState(favorite, savedIds.has(favoriteId), entry.question);
    if (announce && status instanceof HTMLElement) {
      status.textContent = `Question: ${entry.question} Answer: ${entry.answer}`;
    }
  }

  explore.target = "_self";
  explore.addEventListener("click", () => {
    const slug = currentEntry()?.slug;
    if (slug) track("discovery_open", slug);
  });

  surprise.addEventListener("click", () => {
    const next = nextDiscoveryIndex(entries.length, current, seen);
    if (!next) return;
    seen = next.seen;
    render(next.index, true);
    const slug = currentEntry()?.slug;
    if (slug) track("surprise_me", slug);
  });

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-favorite-star]") !== favorite) return;
      favoriteWatch = {
        slug: currentEntry()?.slug ?? "",
        before: favorite.getAttribute("aria-pressed") === "true",
        sawBusy: false,
      };
    },
    true,
  );

  const favoriteObserver = new MutationObserver(() => {
    if (!favoriteWatch) {
      const contentId = favorite.getAttribute("data-content-id") || "";
      if (contentId && favorite.getAttribute("aria-pressed") === "true") savedIds.add(contentId);
      return;
    }
    if (favorite.getAttribute("aria-busy") === "true") {
      favoriteWatch.sawBusy = true;
      return;
    }
    if (!favoriteWatch.sawBusy) return;
    const after = favorite.getAttribute("aria-pressed") === "true";
    const contentId = favorite.getAttribute("data-content-id") || "";
    if (after) savedIds.add(contentId);
    else savedIds.delete(contentId);
    if (favoriteWatch.slug && after !== favoriteWatch.before) {
      track(after ? "favorite_save" : "favorite_remove", favoriteWatch.slug);
    }
    favoriteWatch = null;
  });
  favoriteObserver.observe(favorite, {
    attributes: true,
    attributeFilter: ["aria-pressed", "aria-busy"],
  });

  window.addEventListener(FAVORITES_CHANGE_EVENT, (event) => {
    const detail = (
      event as CustomEvent<{ contentType?: string; contentId?: string; isFavorite?: boolean }>
    ).detail;
    if (detail?.contentType !== "reference" || typeof detail.contentId !== "string") return;
    if (!helpHubSlugFromFavoriteContentId(detail.contentId)) return;
    if (detail.isFavorite) savedIds.add(detail.contentId);
    else savedIds.delete(detail.contentId);
    if (detail.contentId === favorite.getAttribute("data-content-id")) {
      applyFavoriteStarState(
        favorite,
        detail.isFavorite === true,
        favorite.getAttribute("data-favorite-title") || undefined,
      );
    }
  });

  function slugIndex(slug: string): number {
    const key = slug.trim().toLowerCase();
    return entries.findIndex((entry) => entry.slug.trim().toLowerCase() === key);
  }

  async function loadSavedFavorites(): Promise<void> {
    try {
      if (!(await isFavoritesMemberLoggedIn())) return;
      const rows = await listFavorites("reference");
      const nextIds = new Set<string>();
      for (const row of rows) {
        const contentId = String(row.content_id || "");
        if (helpHubSlugFromFavoriteContentId(contentId)) nextIds.add(contentId);
      }
      const currentId = favorite.getAttribute("data-content-id") || "";
      if (currentId && favorite.getAttribute("aria-pressed") === "true") nextIds.add(currentId);
      savedIds.clear();
      for (const contentId of nextIds) savedIds.add(contentId);
      if (favorite.getAttribute("aria-busy") === "true") return;
      render(current, false);
    } catch {
      // The favorite button still uses the shared login and save behavior.
    }
  }

  discoveryBridge = {
    read: () => {
      const seenSlugs: string[] = [];
      for (const index of seen) {
        const slug = entries[index]?.slug;
        if (slug && !seenSlugs.includes(slug)) seenSlugs.push(slug);
      }
      return { slug: currentEntry()?.slug ?? "", seenSlugs };
    },
    restore: (state) => {
      const index = slugIndex(state.slug);
      if (index < 0) return;
      const nextSeen = new Set<number>();
      for (const slug of state.seenSlugs) {
        const seenIndex = slugIndex(slug);
        if (seenIndex >= 0) nextSeen.add(seenIndex);
      }
      nextSeen.add(index);
      seen = nextSeen;
      render(index, false);
    },
    refreshFavorites: loadSavedFavorites,
  };

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    void loadSavedFavorites();
  });

  void loadSavedFavorites();
}
