import type { FavoriteRecord } from "./favoriteContentTypes";

/** Max favorite videos shown on the account dashboard summary. */
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
