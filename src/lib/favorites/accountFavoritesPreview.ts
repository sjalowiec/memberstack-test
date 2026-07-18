import type { FavoriteRecord } from "./favoriteContentTypes";

/** Max favorite videos shown on the account dashboard summary (legacy helper; accordion lists show all). */
export const ACCOUNT_FAVORITES_PREVIEW_LIMIT = 5;

/**
 * Newest-first preview of favorite content ids for the account dashboard.
 * Keeps the full list available elsewhere (e.g. `/videos/?cat=favorites`).
 */
export function selectFavoritePreviewIds(
  favorites: readonly Pick<FavoriteRecord, "content_id" | "created_at">[],
  limit: number = ACCOUNT_FAVORITES_PREVIEW_LIMIT,
): string[] {
  if (!Array.isArray(favorites) || favorites.length === 0 || limit <= 0) return [];

  return [...favorites]
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .slice(0, limit)
    .map((f) => f.content_id)
    .filter((id) => Boolean(id));
}

/** Heading label like `Videos (3)`. */
export function formatFavoriteGroupHeading(label: string, count: number): string {
  const safeLabel = label.trim() || "Favorites";
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return `${safeLabel} (${n})`;
}

/**
 * Sort favorite content ids alphabetically by resolved display title.
 * Ties break on content_id for stable ordering.
 */
export function sortFavoriteIdsByTitle(
  ids: readonly string[],
  resolveTitle: (contentId: string) => string,
): string[] {
  return [...ids]
    .filter((id) => Boolean(id))
    .sort((a, b) => {
      const titleCmp = resolveTitle(a).localeCompare(resolveTitle(b), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      if (titleCmp !== 0) return titleCmp;
      return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
    });
}
