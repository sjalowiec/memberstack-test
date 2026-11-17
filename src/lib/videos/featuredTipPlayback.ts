/**
 * Playback for the current Tip of the Week.
 *
 * The video record keeps its member access level. During the free window,
 * the existing featured-tip rule (`isTipOfWeek`) is applied to that one
 * catalog row so the player treats it as public. Other rows are unchanged.
 */
import { loadPublicTipOfTheWeekPage } from "../tipOfTheWeek/publicPage";
import { videoContentIdKey } from "./videoPosterOverrides";

type PlaybackFlagRow = {
  content_id?: unknown;
  isTipOfWeek?: boolean;
  tipOfWeek?: boolean;
};

export async function loadCurrentFeaturedTipVideoContentId(): Promise<string | null> {
  if (process.env.VITEST === "true" && process.env.FEATURED_TIP_PLAYBACK_DB_IN_TEST !== "1") {
    return null;
  }
  try {
    const state = await loadPublicTipOfTheWeekPage();
    if (state.kind !== "featured" || state.model.isPreview) return null;
    const id = videoContentIdKey(state.model.tip.videoContentId);
    return id || null;
  } catch {
    return null;
  }
}

/** Copy the catalog and flag only the current featured tip for public playback. */
export function markCurrentFeaturedTipForPlayback<T>(
  videos: readonly T[],
  featuredContentId: string | null,
): T[] {
  const wanted = videoContentIdKey(featuredContentId);
  if (!wanted) return [...videos];
  return videos.map((video) => {
    if (!video || typeof video !== "object") return video;
    const row = video as T & PlaybackFlagRow;
    if (videoContentIdKey(row.content_id) !== wanted) return video;
    if (row.isTipOfWeek === true && row.tipOfWeek === true) return video;
    return { ...row, isTipOfWeek: true, tipOfWeek: true };
  });
}
