/**
 * Display metadata for account My Favorites groups (title + href + optional thumb).
 */

import type { FavoriteContentType } from "./favoriteContentTypes";
import { normalizeFavoriteHref, titleFromFavoriteHref } from "./favoriteHref";

export type FavoriteItemMeta = {
  content_id: string;
  title: string;
  href: string;
  posterUrl?: string;
};

export const FAVORITE_GROUP_ORDER: readonly {
  contentType: FavoriteContentType;
  label: string;
  viewAllHref?: string;
}[] = [
  { contentType: "video", label: "Videos", viewAllHref: "/videos/?cat=favorites" },
  { contentType: "stitch", label: "Stitches" },
  { contentType: "reference", label: "Reference Pages" },
  { contentType: "tool", label: "Tools" },
] as const;

export function hrefForFavorite(
  contentType: FavoriteContentType,
  contentId: string,
  meta?: FavoriteItemMeta | null,
): string {
  if (meta?.href) return meta.href;
  switch (contentType) {
    case "video":
      return `/videos/${encodeURIComponent(contentId)}`;
    case "stitch":
      return `/stitch/${encodeURIComponent(contentId)}`;
    case "tool":
      return "/tools";
    case "reference":
      return normalizeFavoriteHref(contentId) || "/reference";
    default:
      return "/";
  }
}

export function titleForFavorite(
  contentType: FavoriteContentType,
  contentId: string,
  meta?: FavoriteItemMeta | null,
): string {
  if (meta?.title?.trim()) return meta.title.trim();
  switch (contentType) {
    case "video":
      return "Video";
    case "stitch":
      return `Stitch #${contentId}`;
    case "tool":
      return "Tool";
    case "reference":
      return titleFromFavoriteHref(contentId);
    default:
      return "Favorite";
  }
}
