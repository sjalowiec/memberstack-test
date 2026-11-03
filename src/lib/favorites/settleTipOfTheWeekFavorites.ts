/**
 * Copy Tip of the Week favorites that name a real video onto that video,
 * then drop only those tip rows. Rotating URLs and unknown ids are left stored.
 */

import { FavoritesAuthError, addFavorite, listFavorites, removeFavorite } from "./favoritesClient";
import {
  referenceFavoriteUsesTipOfTheWeek,
  tipFavoritesToConvert,
  type StoredTipFavorite,
  type TipVideoMapping,
} from "./tipOfTheWeekFavoriteMigration";

const META_URL = "/api/content-favorites/meta";

async function loadTipVideoIds(): Promise<TipVideoMapping[] | null> {
  try {
    const response = await fetch(META_URL, { credentials: "same-origin" });
    if (!response.ok) return null;
    const body = (await response.json()) as { "tip-video-ids"?: unknown };
    if (!Array.isArray(body["tip-video-ids"])) return null;
    const rows: TipVideoMapping[] = [];
    for (const row of body["tip-video-ids"]) {
      if (!row || typeof row !== "object") continue;
      const contentId = String((row as TipVideoMapping).contentId ?? "").trim();
      const videoContentId = String((row as TipVideoMapping).videoContentId ?? "").trim();
      if (!contentId || !videoContentId) continue;
      rows.push({ contentId, videoContentId });
    }
    return rows;
  } catch {
    return null;
  }
}

/**
 * Persist conversions for the signed-in member.
 * Throws when the member is signed out. Other failures leave favorites unchanged.
 * Video pages pass `includeReference: false` so a normal visit only checks tip favorites.
 */
export async function settleTipOfTheWeekFavorites(
  options: { includeReference?: boolean } = {},
): Promise<void> {
  const includeReference = options.includeReference !== false;
  let tipRows: { content_id: string }[] = [];
  let referenceRows: { content_id: string }[] = [];
  try {
    tipRows = await listFavorites("tip-of-the-week");
    if (includeReference) referenceRows = await listFavorites("reference");
  } catch (error) {
    if (error instanceof FavoritesAuthError) throw error;
    return;
  }

  const sources: StoredTipFavorite[] = [
    ...tipRows.map((row) => ({
      contentType: "tip-of-the-week" as const,
      contentId: String(row.content_id ?? ""),
    })),
    ...referenceRows.map((row) => ({
      contentType: "reference" as const,
      contentId: String(row.content_id ?? ""),
    })),
  ];
  const interesting = sources.filter((row) => {
    if (!row.contentId.trim()) return false;
    if (row.contentType === "tip-of-the-week") return true;
    return referenceFavoriteUsesTipOfTheWeek(row.contentId);
  });
  if (interesting.length === 0) return;

  const tips = await loadTipVideoIds();
  if (!tips) return;

  const planned = tipFavoritesToConvert(sources, tips);
  if (planned.length === 0) return;

  let videoIds: Set<string>;
  try {
    const videos = await listFavorites("video");
    videoIds = new Set(videos.map((row) => String(row.content_id ?? "").trim()).filter(Boolean));
  } catch (error) {
    if (error instanceof FavoritesAuthError) throw error;
    return;
  }

  for (const item of planned) {
    try {
      if (!videoIds.has(item.videoContentId)) {
        await addFavorite("video", item.videoContentId);
        videoIds.add(item.videoContentId);
      }
    } catch (error) {
      if (error instanceof FavoritesAuthError) throw error;
      continue;
    }
    try {
      await removeFavorite(item.contentType, item.contentId);
    } catch (error) {
      if (error instanceof FavoritesAuthError) throw error;
    }
  }
}
