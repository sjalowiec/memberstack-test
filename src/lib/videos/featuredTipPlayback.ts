/**
 * Playback for the current Tip of the Week.
 *
 * The tip schedule (status, dates, and video id) is the only temporary
 * public-access rule. The catalog access level is not changed. A stored
 * tip checkbox on any video is ignored.
 */
import { loadPublicTipOfTheWeekPage } from "../tipOfTheWeek/publicPage";
import { selectPublicFeaturedTip } from "../tipOfTheWeek/schedule";
import { videoContentIdKey } from "./videoPosterOverrides";

type ScheduledTipPlayback = {
  status: "draft" | "scheduled" | "active" | "archived";
  availableFrom: string;
  availableThrough: string;
  updatedAt?: string;
  videoContentId: string;
};

type PlaybackFlagRow = {
  content_id?: unknown;
  featuredTipPlayback?: boolean;
};

/** Content id that is free today, from the same picker the public tip page uses. */
export function featuredTipContentIdForPlayback(
  tips: readonly ScheduledTipPlayback[],
  todayLa: string,
): string | null {
  const tip = selectPublicFeaturedTip(tips, todayLa);
  if (!tip) return null;
  const id = videoContentIdKey(tip.videoContentId);
  return id || null;
}

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

/**
 * Copy the catalog for playback. Only the current featured content id is
 * playable beyond its stored access level. Any earlier tip flag is left on
 * the record and is not a grant. When the free window has no featured tip,
 * every row keeps its stored access level.
 */
export function markCurrentFeaturedTipForPlayback<T>(
  videos: readonly T[],
  featuredContentId: string | null,
): T[] {
  const wanted = videoContentIdKey(featuredContentId);
  return videos.map((video) => {
    if (!video || typeof video !== "object") return video;
    const row = video as T & PlaybackFlagRow;
    const isCurrent = Boolean(wanted) && videoContentIdKey(row.content_id) === wanted;
    if (isCurrent) {
      if (row.featuredTipPlayback === true) return video;
      return { ...row, featuredTipPlayback: true };
    }
    if (row.featuredTipPlayback === true) {
      return { ...row, featuredTipPlayback: false };
    }
    return video;
  });
}
