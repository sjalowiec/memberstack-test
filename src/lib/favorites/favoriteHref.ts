/**
 * Path helpers for favorite content ids that are URL paths (reference pages).
 */

/** Normalize a site path used as a reference favorite content_id. */
export function normalizeFavoriteHref(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  let s = String(value).trim();
  if (!s) return null;
  if (!s.startsWith("/")) s = `/${s}`;
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

/** Best-effort title from a path when catalog metadata is missing. */
export function titleFromFavoriteHref(href: string): string {
  const path = normalizeFavoriteHref(href);
  if (!path) return "Reference page";
  const segment = path.split("/").filter(Boolean).pop() || path;
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}
