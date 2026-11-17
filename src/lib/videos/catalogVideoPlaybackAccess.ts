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
 *   - the current Tip of the Week, and only during its free window
 *
 * The video record keeps its own access level. A stored `isTipOfWeek` /
 * `tipOfWeek` checkbox is not a playback grant: those flags drifted from the
 * tip schedule. Callers apply the live schedule with
 * `markCurrentFeaturedTipForPlayback`, which sets `featuredTipPlayback` on
 * that one copy.
 */
export type CatalogVideoPlaybackAccess = "open" | "member";

export type CatalogVideoPlaybackFields = {
  access_level?: unknown;
  /** Set only on the playback copy of the tip that is free today. */
  featuredTipPlayback?: boolean;
  /** Stored catalog label. Ignored for playback so it cannot outlive the schedule. */
  isTipOfWeek?: boolean;
  tipOfWeek?: boolean;
};

export function isFeaturedTipCatalogVideo(video: CatalogVideoPlaybackFields): boolean {
  return video.featuredTipPlayback === true;
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
