/**
 * Hydrate the account My Favorites dashboard (accordion by content type).
 * Accordion exclusivity matches My Patterns (`name` + toggle handler).
 */
import {
  formatFavoriteGroupHeading,
  sortFavoriteIdsByTitle,
} from "../lib/favorites/accountFavoritesPreview";
import {
  FAVORITE_GROUP_ORDER,
  hrefForFavorite,
  titleForFavorite,
  type FavoriteItemMeta,
} from "../lib/favorites/favoriteCatalog";
import { favoriteStarButtonHtml, escapeHtml } from "../lib/favorites/favoriteStarUi";
import { initFavoriteStarController } from "../lib/favorites/favoriteStarController";
import type { FavoriteContentType, FavoriteRecord } from "../lib/favorites/favoriteContentTypes";
import { FAVORITE_CONTENT_TYPES } from "../lib/favorites/favoriteContentTypes";
import { FavoritesAuthError, listFavorites } from "../lib/favorites/favoritesClient";

type MetaByType = Record<FavoriteContentType, Map<string, FavoriteItemMeta>>;

function readMeta(): MetaByType {
  const empty = () =>
    ({
      video: new Map(),
      stitch: new Map(),
      reference: new Map(),
      tool: new Map(),
    }) satisfies MetaByType;

  const el = document.getElementById("account-favorites-meta");
  const maps = empty();
  if (!el?.textContent) return maps;

  try {
    const parsed = JSON.parse(el.textContent) as Partial<
      Record<FavoriteContentType, FavoriteItemMeta[]>
    >;
    for (const type of FAVORITE_CONTENT_TYPES) {
      const rows = parsed[type];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const id = String(row?.content_id ?? "").trim();
        if (!id) continue;
        maps[type].set(id, {
          content_id: id,
          title: typeof row.title === "string" ? row.title : "",
          href: typeof row.href === "string" ? row.href : "",
          posterUrl: typeof row.posterUrl === "string" ? row.posterUrl : "",
        });
      }
    }
  } catch {
    /* ignore */
  }
  return maps;
}

function thumbHtml(
  contentType: FavoriteContentType,
  href: string,
  posterUrl: string | undefined,
): string {
  if (!posterUrl) {
    return `<a class="account-favorites__thumb" href="${escapeHtml(href)}" aria-hidden="true"></a>`;
  }
  const square = contentType === "stitch" || contentType === "tool";
  const icon = contentType === "tool";
  const cls =
    "account-favorites__thumb" +
    (square ? " account-favorites__thumb--square" : "") +
    (icon ? " account-favorites__thumb--icon" : "");
  return (
    `<a class="${cls}" href="${escapeHtml(href)}">` +
    `<img src="${escapeHtml(posterUrl)}" alt="" loading="lazy" />` +
    `</a>`
  );
}

function wireExclusiveAccordionGroups(root: HTMLElement): void {
  const groups = [
    ...root.querySelectorAll<HTMLDetailsElement>("[data-kbm-my-favorites-group]"),
  ];
  for (const details of groups) {
    if (details.dataset.kbmMyFavoritesGroupBound === "1") continue;
    details.dataset.kbmMyFavoritesGroupBound = "1";
    details.addEventListener("toggle", () => {
      if (!details.open) return;
      for (const other of groups) {
        if (other !== details && other.open) other.open = false;
      }
    });
  }
}

function renderGroup(options: {
  detailsEl: HTMLDetailsElement;
  listEl: HTMLElement;
  labelEl: HTMLElement;
  contentType: FavoriteContentType;
  label: string;
  ids: string[];
  meta: Map<string, FavoriteItemMeta>;
}): void {
  const { detailsEl, listEl, labelEl, contentType, label, ids, meta } = options;

  labelEl.textContent = formatFavoriteGroupHeading(label, ids.length);

  if (ids.length === 0) {
    listEl.innerHTML = "";
    detailsEl.hidden = true;
    detailsEl.open = false;
    return;
  }

  detailsEl.hidden = false;
  listEl.innerHTML = ids
    .map((id) => {
      const info = meta.get(id) ?? null;
      const title = titleForFavorite(contentType, id, info);
      const href = hrefForFavorite(contentType, id, info);
      const poster = thumbHtml(contentType, href, info?.posterUrl);
      const star = favoriteStarButtonHtml({
        contentType,
        contentId: id,
        title,
        isFavorite: true,
      });
      return (
        `<li class="account-favorites__item" data-favorite-content-id="${escapeHtml(id)}" data-favorite-content-type="${escapeHtml(contentType)}">` +
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

async function loadAllFavorites(): Promise<Record<FavoriteContentType, FavoriteRecord[]>> {
  const entries = await Promise.all(
    FAVORITE_CONTENT_TYPES.map(async (contentType) => {
      try {
        const favorites = await listFavorites(contentType);
        return [contentType, favorites] as const;
      } catch (error) {
        if (error instanceof FavoritesAuthError) throw error;
        return [contentType, [] as FavoriteRecord[]] as const;
      }
    }),
  );
  return Object.fromEntries(entries) as Record<FavoriteContentType, FavoriteRecord[]>;
}

async function boot(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-kbm-my-favorites]");
  if (!root) return;

  const statusEl = root.querySelector<HTMLElement>("[data-kbm-my-favorites-status]");
  const emptyEl = root.querySelector<HTMLElement>("[data-kbm-my-favorites-empty]");
  if (!statusEl || !emptyEl) return;

  const metaByType = readMeta();
  let favoritesByType = Object.fromEntries(
    FAVORITE_CONTENT_TYPES.map((t) => [t, [] as FavoriteRecord[]]),
  ) as Record<FavoriteContentType, FavoriteRecord[]>;

  wireExclusiveAccordionGroups(root);

  const paint = () => {
    let total = 0;

    for (const group of FAVORITE_GROUP_ORDER) {
      const detailsEl = root.querySelector<HTMLDetailsElement>(
        `details[data-kbm-my-favorites-group="${group.contentType}"]`,
      );
      const listEl = root.querySelector<HTMLElement>(
        `[data-kbm-my-favorites-list="${group.contentType}"]`,
      );
      const labelEl = root.querySelector<HTMLElement>(
        `[data-kbm-my-favorites-group-label="${group.contentType}"]`,
      );
      if (!detailsEl || !listEl || !labelEl) continue;

      const rows = favoritesByType[group.contentType] ?? [];
      const meta = metaByType[group.contentType];
      const ids = sortFavoriteIdsByTitle(
        rows.map((f) => f.content_id).filter(Boolean),
        (id) => titleForFavorite(group.contentType, id, meta.get(id) ?? null),
      );

      total += ids.length;
      renderGroup({
        detailsEl,
        listEl,
        labelEl,
        contentType: group.contentType,
        label: group.label,
        ids,
        meta,
      });
    }

    if (total === 0) {
      emptyEl.hidden = false;
      statusEl.textContent = "";
    } else {
      emptyEl.hidden = true;
      statusEl.textContent = "";
    }
  };

  initFavoriteStarController({
    root,
    statusEl,
    onChanged: (detail) => {
      const list = favoritesByType[detail.contentType] ?? [];
      if (!detail.isFavorite) {
        favoritesByType[detail.contentType] = list.filter((f) => f.content_id !== detail.contentId);
        paint();
      } else if (!list.some((f) => f.content_id === detail.contentId)) {
        favoritesByType[detail.contentType] = [
          ...list,
          {
            id: `local-${detail.contentId}`,
            member_id: "",
            content_type: detail.contentType,
            content_id: detail.contentId,
            created_at: new Date().toISOString(),
          },
        ];
        paint();
      }
    },
  });

  try {
    favoritesByType = await loadAllFavorites();
    paint();
  } catch (error) {
    if (error instanceof FavoritesAuthError) {
      statusEl.textContent = "Sign in to see your favorites.";
      emptyEl.hidden = true;
      FAVORITE_GROUP_ORDER.forEach((group) => {
        const detailsEl = root.querySelector<HTMLDetailsElement>(
          `details[data-kbm-my-favorites-group="${group.contentType}"]`,
        );
        if (detailsEl) {
          detailsEl.hidden = true;
          detailsEl.open = false;
        }
      });
      return;
    }
    statusEl.textContent = "Could not load favorites. Please try again.";
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
