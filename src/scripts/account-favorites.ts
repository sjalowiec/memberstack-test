/**
 * Hydrate the account My Favorites dashboard summary (Videos group).
 */
import { selectFavoritePreviewIds } from "../lib/favorites/accountFavoritesPreview";
import { favoriteStarButtonHtml, escapeHtml } from "../lib/favorites/favoriteStarUi";
import { initFavoriteStarController } from "../lib/favorites/favoriteStarController";
import type { FavoriteRecord } from "../lib/favorites/favoriteContentTypes";
import { FavoritesAuthError, listFavorites } from "../lib/favorites/favoritesClient";

type VideoMeta = {
  content_id: string;
  title: string;
  posterUrl?: string;
};

function readVideoMeta(): Map<string, VideoMeta> {
  const el = document.getElementById("account-favorites-video-meta");
  const map = new Map<string, VideoMeta>();
  if (!el?.textContent) return map;
  try {
    const parsed = JSON.parse(el.textContent) as VideoMeta[];
    if (!Array.isArray(parsed)) return map;
    for (const row of parsed) {
      const id = String(row?.content_id ?? "").trim();
      if (!id) continue;
      map.set(id, {
        content_id: id,
        title: typeof row.title === "string" && row.title.trim() ? row.title : "Video",
        posterUrl: typeof row.posterUrl === "string" ? row.posterUrl : "",
      });
    }
  } catch {
    /* ignore */
  }
  return map;
}

function renderList(options: {
  listEl: HTMLElement;
  groupEl: HTMLElement;
  emptyEl: HTMLElement;
  statusEl: HTMLElement;
  ids: string[];
  meta: Map<string, VideoMeta>;
}): void {
  const { listEl, groupEl, emptyEl, statusEl, ids, meta } = options;

  if (ids.length === 0) {
    listEl.innerHTML = "";
    groupEl.hidden = true;
    emptyEl.hidden = false;
    statusEl.textContent = "";
    return;
  }

  emptyEl.hidden = true;
  groupEl.hidden = false;
  statusEl.textContent = "";

  listEl.innerHTML = ids
    .map((id) => {
      const info = meta.get(id);
      const title = info?.title || "Video";
      const href = `/videos/${encodeURIComponent(id)}`;
      const poster = info?.posterUrl
        ? `<a class="account-favorites__thumb" href="${escapeHtml(href)}"><img src="${escapeHtml(info.posterUrl)}" alt="" loading="lazy" /></a>`
        : `<a class="account-favorites__thumb" href="${escapeHtml(href)}" aria-hidden="true"></a>`;
      const star = favoriteStarButtonHtml({
        contentType: "video",
        contentId: id,
        title,
        isFavorite: true,
      });
      return (
        `<li class="account-favorites__item" data-favorite-content-id="${escapeHtml(id)}">` +
        poster +
        `<div class="account-favorites__body">` +
        `<div class="favorite-title-row">` +
        `<a class="account-favorites__title-link" href="${escapeHtml(href)}">${escapeHtml(title)}</a>` +
        star +
        `</div>` +
        `</div>` +
        `</li>`
      );
    })
    .join("");
}

async function boot(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-kbm-my-favorites]");
  if (!root) return;

  const statusEl = root.querySelector<HTMLElement>("[data-kbm-my-favorites-status]");
  const groupEl = root.querySelector<HTMLElement>("[data-kbm-my-favorites-videos]");
  const listEl = root.querySelector<HTMLElement>("[data-kbm-my-favorites-list]");
  const emptyEl = root.querySelector<HTMLElement>("[data-kbm-my-favorites-empty]");
  if (!statusEl || !groupEl || !listEl || !emptyEl) return;

  const meta = readVideoMeta();
  let favorites: FavoriteRecord[] = [];

  const paint = () => {
    const previewIds = selectFavoritePreviewIds(favorites);
    renderList({ listEl, groupEl, emptyEl, statusEl, ids: previewIds, meta });
  };

  initFavoriteStarController({
    root,
    statusEl,
    onChanged: (detail) => {
      if (detail.contentType !== "video") return;
      if (!detail.isFavorite) {
        favorites = favorites.filter((f) => f.content_id !== detail.contentId);
        paint();
      }
    },
  });

  try {
    favorites = await listFavorites("video");
    paint();
  } catch (error) {
    if (error instanceof FavoritesAuthError) {
      statusEl.textContent = "Sign in to see your favorites.";
      groupEl.hidden = true;
      emptyEl.hidden = true;
      return;
    }
    statusEl.textContent = "Could not load favorites. Please try again.";
    groupEl.hidden = true;
    emptyEl.hidden = true;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void boot();
  });
} else {
  void boot();
}
