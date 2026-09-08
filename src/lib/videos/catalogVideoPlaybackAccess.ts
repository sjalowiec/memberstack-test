/**
 * Catalog video *playback* access (not catalog visibility).
 *
 * Visitors may see titles, thumbnails, and descriptions for published catalog
 * rows. Playback of member-only videos uses the same {@link hasMemberAccess}
 * determination as the rest of the site. Do not treat login or plan presence
 * alone as enough to play.
 *
 * Intentionally playable without membership:
 *   - `access_level` public / open / free
 *   - the current Tuesday Tip (`isTipOfWeek` / `tipOfWeek`)
 */
export type CatalogVideoPlaybackAccess = "open" | "member";

export type CatalogVideoPlaybackFields = {
  access_level?: unknown;
  isTipOfWeek?: boolean;
  tipOfWeek?: boolean;
};

export function isFeaturedTipCatalogVideo(video: CatalogVideoPlaybackFields): boolean {
  return video.isTipOfWeek === true || video.tipOfWeek === true;
}

/** JSON synonyms that mean "playable without membership". */
export function isOpenCatalogVideoAccessLevel(raw: unknown): boolean {
  const level = String(raw ?? "").trim().toLowerCase();
  return level === "open" || level === "public" || level === "free";
}

/**
 * Same playback rule as `/videos/[id]` and GatedVimeoEmbed.
 * Unknown or omitted `access_level` is member-only.
 */
export function catalogVideoPlaybackAccess(
  video: CatalogVideoPlaybackFields,
): CatalogVideoPlaybackAccess {
  if (isFeaturedTipCatalogVideo(video)) return "open";
  return isOpenCatalogVideoAccessLevel(video.access_level) ? "open" : "member";
}

/** @deprecated Use {@link catalogVideoPlaybackAccess}. */
export function effectiveCatalogVideoAccess(
  video: CatalogVideoPlaybackFields,
): CatalogVideoPlaybackAccess {
  return catalogVideoPlaybackAccess(video);
}
