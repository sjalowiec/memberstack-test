/**
 * Shared favorite content-type definitions.
 * Add new literals here (and in the Netlify store allowlist) when extending.
 */

export const FAVORITE_CONTENT_TYPES = ["video", "stitch", "reference", "tool"] as const;

export type FavoriteContentType = (typeof FAVORITE_CONTENT_TYPES)[number];

export type FavoriteRecord = {
  id: string;
  member_id: string;
  content_type: FavoriteContentType;
  content_id: string;
  created_at: string;
};

export function isFavoriteContentType(value: unknown): value is FavoriteContentType {
  return typeof value === "string" && (FAVORITE_CONTENT_TYPES as readonly string[]).includes(value);
}

/** Normalize a content id to a non-empty string, or null when invalid. */
export function normalizeFavoriteContentId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}
