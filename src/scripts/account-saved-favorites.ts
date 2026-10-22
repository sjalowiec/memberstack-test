/**
 * Hydrate the collapsed Account list of saved Tips of the Week and Knit-ables.
 * Titles and links come from the live catalog, not from the favorite row.
 */
import {
  reportContentFavoriteOpen,
  reportContentFavoritesOpen,
  trackSavedContentFavoriteChange,
} from "../lib/analytics/contentFavoritesGa";
import type { FavoriteContentType, FavoriteRecord } from "../lib/favorites/favoriteContentTypes";
import {
  FavoritesAuthError,
  listFavorites,
  removeFavorite,
} from "../lib/favorites/favoritesClient";
import { escapeHtml } from "../lib/favorites/favoriteStarUi";

type SavedType = Extract<FavoriteContentType, "tip-of-the-week" | "knit-able">;

type SavedItem = {
  contentType: SavedType;
  contentId: string;
  createdAt: string;
};

type MetaRow = {
  contentId: string;
  title: string;
  href: string;
};

const GROUPS: { contentType: SavedType; label: string; unavailable: string }[] = [
  {
    contentType: "tip-of-the-week",
    label: "Tips of the Week",
    unavailable: "This tip is no longer available.",
  },
  {
    contentType: "knit-able",
    label: "Knit-ables",
    unavailable: "This Knit-able is no longer available.",
  },
];

const META_URL = "/api/content-favorites/meta";

function sortNewest(items: SavedItem[]): SavedItem[] {
  return items.slice().sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.contentId < b.contentId ? -1 : 1;
  });
}

async function loadMeta(): Promise<Record<SavedType, Map<string, MetaRow>>> {
  const maps: Record<SavedType, Map<string, MetaRow>> = {
    "tip-of-the-week": new Map(),
    "knit-able": new Map(),
  };
  const response = await fetch(META_URL, { credentials: "same-origin" });
  if (!response.ok) return maps;
  const body = (await response.json()) as Partial<Record<SavedType, MetaRow[]>>;
  for (const group of GROUPS) {
    const rows = body[group.contentType];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const contentId = String(row?.contentId ?? "").trim();
      if (!contentId) continue;
      maps[group.contentType].set(contentId, {
        contentId,
        title: typeof row.title === "string" ? row.title.trim() : "",
        href: typeof row.href === "string" ? row.href.trim() : "",
      });
    }
  }
  return maps;
}

function itemHtml(item: SavedItem, meta: MetaRow | undefined, unavailable: string): string {
  const title = meta?.title || unavailable;
  const href = meta?.href || "";
  const note =
    meta && !href
      ? `<span class="account-saved-favorites__note">Not available right now.</span>`
      : "";
  const titleHtml = href
    ? `<a class="account-saved-favorites__link" href="${escapeHtml(href)}" data-kbm-saved-favorite-link data-content-type="${escapeHtml(item.contentType)}" data-content-id="${escapeHtml(item.contentId)}">${escapeHtml(title)}</a>`
    : `<span class="account-saved-favorites__title">${escapeHtml(title)}</span>`;
  const label = meta?.title ? `Remove ${meta.title} from favorites` : "Remove this favorite";
  return (
    `<li class="account-saved-favorites__item">` +
    `<div>${titleHtml}${note}</div>` +
    `<button type="button" class="account-saved-favorites__remove" data-kbm-saved-favorite-remove data-content-type="${escapeHtml(item.contentType)}" data-content-id="${escapeHtml(item.contentId)}" aria-label="${escapeHtml(label)}">Remove</button>` +
    `</li>`
  );
}

async function boot(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-kbm-saved-favorites]");
  if (!root || root.dataset.kbmSavedFavoritesBound === "1") return;
  root.dataset.kbmSavedFavoritesBound = "1";

  const statusEl = root.querySelector<HTMLElement>("[data-kbm-saved-favorites-status]");
  const groupsEl = root.querySelector<HTMLElement>("[data-kbm-saved-favorites-groups]");
  const emptyEl = root.querySelector<HTMLElement>("[data-kbm-saved-favorites-empty]");
  const accordion = root.querySelector<HTMLDetailsElement>("[data-kbm-saved-favorites-accordion]");
  if (!statusEl || !groupsEl || !emptyEl || !accordion) return;

  let items: SavedItem[] = [];
  let meta: Record<SavedType, Map<string, MetaRow>> = {
    "tip-of-the-week": new Map(),
    "knit-able": new Map(),
  };
  const removing = new Set<string>();
  let openedTracked = false;

  const paint = () => {
    const sections = GROUPS.map((group) => {
      const rows = sortNewest(items.filter((item) => item.contentType === group.contentType));
      if (rows.length === 0) return "";
      const list = rows
        .map((item) => itemHtml(item, meta[group.contentType].get(item.contentId), group.unavailable))
        .join("");
      return (
        `<section>` +
        `<h3 class="account-saved-favorites__group-title">${escapeHtml(group.label)}</h3>` +
        `<ul class="account-saved-favorites__list">${list}</ul>` +
        `</section>`
      );
    }).join("");

    if (!sections) {
      groupsEl.hidden = true;
      groupsEl.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    groupsEl.hidden = false;
    groupsEl.innerHTML = sections;
  };

  accordion.addEventListener("toggle", () => {
    if (!accordion.open || openedTracked) return;
    openedTracked = true;
    reportContentFavoritesOpen();
  });

  groupsEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const link = target.closest<HTMLAnchorElement>("[data-kbm-saved-favorite-link]");
    if (link) {
      reportContentFavoriteOpen({
        contentType: link.getAttribute("data-content-type") || "",
        contentId: link.getAttribute("data-content-id") || "",
        source: "account",
      });
      return;
    }

    const button = target.closest<HTMLButtonElement>("[data-kbm-saved-favorite-remove]");
    if (!button) return;
    event.preventDefault();
    const contentType = button.getAttribute("data-content-type") || "";
    const contentId = button.getAttribute("data-content-id") || "";
    if (contentType !== "tip-of-the-week" && contentType !== "knit-able") return;
    const key = `${contentType}\0${contentId}`;
    if (removing.has(key)) return;
    removing.add(key);
    button.disabled = true;

    const previous = items.slice();
    items = items.filter((item) => !(item.contentType === contentType && item.contentId === contentId));
    paint();
    statusEl.textContent = "";

    void removeFavorite(contentType, contentId)
      .then(() => {
        trackSavedContentFavoriteChange({
          contentType,
          contentId,
          isFavorite: false,
          source: "account",
        });
      })
      .catch(() => {
        items = previous;
        paint();
        statusEl.textContent = "Could not remove that favorite. It is still saved.";
      })
      .finally(() => {
        removing.delete(key);
      });
  });

  try {
    const [tipRows, knitRows, loadedMeta] = await Promise.all([
      listFavorites("tip-of-the-week"),
      listFavorites("knit-able"),
      loadMeta().catch(() => meta),
    ]);
    meta = loadedMeta;
    items = sortNewest([
      ...rowsOf("tip-of-the-week", tipRows),
      ...rowsOf("knit-able", knitRows),
    ]);
    statusEl.textContent = "";
    paint();
  } catch (error) {
    statusEl.textContent =
      error instanceof FavoritesAuthError
        ? "Sign in to see favorites saved to your account."
        : "Could not load your favorites. Please try again.";
  }
}

function rowsOf(contentType: SavedType, rows: FavoriteRecord[]): SavedItem[] {
  return rows
    .map((row) => ({
      contentType,
      contentId: String(row.content_id || "").trim(),
      createdAt: String(row.created_at || ""),
    }))
    .filter((row) => row.contentId);
}

void boot();
