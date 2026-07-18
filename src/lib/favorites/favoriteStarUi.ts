/**
 * Shared favorite-star markup, aria labels, and DOM sync helpers.
 */

import type { FavoriteContentType } from "./favoriteContentTypes";
import { normalizeFavoriteContentId } from "./favoriteContentTypes";

export const FAVORITE_STAR_CLASS = "favorite-star";
export const FAVORITE_STAR_ICON_CLASS = "favorite-star__icon";

export function favoriteSaveLabel(title: string): string {
  const name = title.trim() || "this item";
  return `Save ${name} to favorites`;
}

export function favoriteRemoveLabel(title: string): string {
  const name = title.trim() || "this item";
  return `Remove ${name} from favorites`;
}

export function favoriteAriaLabel(title: string, isFavorite: boolean): string {
  return isFavorite ? favoriteRemoveLabel(title) : favoriteSaveLabel(title);
}

/** Escape text for safe insertion into HTML text/attribute contexts. */
export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Font Awesome outline/filled star icon markup (decorative; aria-hidden on parent icon).
 */
export function favoriteStarIconHtml(isFavorite: boolean): string {
  const iconClass = isFavorite ? "fa-solid fa-star" : "fa-regular fa-star";
  return `<i class="${FAVORITE_STAR_ICON_CLASS} ${iconClass}" aria-hidden="true"></i>`;
}

export type FavoriteStarButtonOptions = {
  contentType: FavoriteContentType;
  contentId: string | number;
  title: string;
  isFavorite: boolean;
  extraClass?: string;
};

/** Safe HTML for a favorite star button (catalog string rendering). */
export function favoriteStarButtonHtml(options: FavoriteStarButtonOptions): string {
  const contentId = normalizeFavoriteContentId(options.contentId);
  if (!contentId) return "";

  const title = options.title.trim() || "this item";
  const pressed = options.isFavorite ? "true" : "false";
  const label = escapeHtml(favoriteAriaLabel(title, options.isFavorite));
  const extra = options.extraClass ? ` ${escapeHtml(options.extraClass)}` : "";
  const savedClass = options.isFavorite ? " is-favorite" : "";

  return (
    `<button type="button"` +
    ` class="${FAVORITE_STAR_CLASS}${savedClass}${extra}"` +
    ` data-favorite-star` +
    ` data-content-type="${escapeHtml(options.contentType)}"` +
    ` data-content-id="${escapeHtml(contentId)}"` +
    ` data-favorite-title="${escapeHtml(title)}"` +
    ` aria-pressed="${pressed}"` +
    ` aria-label="${label}"` +
    `>` +
    favoriteStarIconHtml(options.isFavorite) +
    `</button>`
  );
}

/** Apply pressed/saved visual + aria state to a star button. */
export function applyFavoriteStarState(
  button: HTMLButtonElement,
  isFavorite: boolean,
  title?: string,
): void {
  const resolvedTitle =
    title?.trim() || button.getAttribute("data-favorite-title")?.trim() || "this item";
  button.setAttribute("data-favorite-title", resolvedTitle);
  button.setAttribute("aria-pressed", isFavorite ? "true" : "false");
  button.setAttribute("aria-label", favoriteAriaLabel(resolvedTitle, isFavorite));
  button.classList.toggle("is-favorite", isFavorite);

  const icon = button.querySelector(`.${FAVORITE_STAR_ICON_CLASS}`);
  if (icon) {
    icon.classList.remove("fa-solid", "fa-regular");
    icon.classList.add(isFavorite ? "fa-solid" : "fa-regular", "fa-star");
    icon.setAttribute("aria-hidden", "true");
  }
}

/** Sync all visible stars for a content id (catalog + detail + account). */
export function syncFavoriteStarsInDocument(
  contentType: FavoriteContentType,
  contentId: string | number,
  isFavorite: boolean,
  root: ParentNode = document,
): void {
  const id = normalizeFavoriteContentId(contentId);
  if (!id) return;
  root.querySelectorAll<HTMLButtonElement>("[data-favorite-star]").forEach((btn) => {
    if (btn.getAttribute("data-content-type") !== contentType) return;
    if (btn.getAttribute("data-content-id") !== id) return;
    applyFavoriteStarState(btn, isFavorite);
  });
}

/** Pure helper: filter catalog video rows by a set of favorite content ids. */
export function filterVideosByFavoriteIds<T extends { content_id?: string | number | null }>(
  videos: T[],
  favoriteIds: Iterable<string>,
): T[] {
  const set = new Set(Array.from(favoriteIds, (id) => String(id)));
  return videos.filter((v) => {
    const id = normalizeFavoriteContentId(v.content_id);
    return id != null && set.has(id);
  });
}
