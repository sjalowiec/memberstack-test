import { helpHubFavoriteHref } from "./favoriteTips";

/**
 * Stored Help Hub slugs. The public address uses this value, not the title
 * or question, so a title edit does not change the URL.
 */
const PUBLIC_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

/** Permanent path for a published Help Hub article. Empty when the slug is missing. */
export function helpHubArticlePath(slug: string): string {
  const trimmed = slug.trim();
  if (!PUBLIC_SLUG.test(trimmed)) return "";
  return helpHubFavoriteHref(trimmed);
}

/** Absolute article URL on the site the reader is using. */
export function helpHubArticleAbsoluteUrl(slug: string, origin: string): string {
  const path = helpHubArticlePath(slug);
  const base = origin.trim();
  if (!path || !base) return "";
  try {
    return new URL(path, base).href;
  } catch {
    return "";
  }
}
