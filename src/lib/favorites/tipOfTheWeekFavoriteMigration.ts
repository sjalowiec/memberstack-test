/**
 * Decide what to do with a saved Tip of the Week favorite.
 * A tip id that matches a stored tip's video becomes that video favorite.
 * A bare /tip-of-the-week URL is excluded. Nothing is guessed or deleted here.
 */

export type TipVideoMapping = {
  contentId: string;
  videoContentId: string;
};

export type TipFavoritePlan =
  | { action: "convert"; videoContentId: string; via: "tip" | "video-permalink" }
  | { action: "exclude"; reason: "rotating-url" | "unresolved" }
  | { action: "keep" };

const ROTATING_TIP_ID = "tip-of-the-week";
const TIP_PATH = "/tip-of-the-week";

function lookupVideo(
  tipId: string,
  tips: readonly TipVideoMapping[],
): string | null {
  const want = tipId.trim();
  if (!want) return null;
  const match = tips.find((tip) => tip.contentId.trim() === want);
  const videoContentId = match?.videoContentId.trim() || "";
  return videoContentId || null;
}

function videoIdFromPermalink(path: string): string | null {
  const match = /^\/videos\/([^/]+)$/.exec(path);
  if (!match?.[1]) return null;
  let id = match[1];
  try {
    id = decodeURIComponent(id);
  } catch {
    return null;
  }
  id = id.trim();
  if (!id || id === "." || id === "..") return null;
  return id;
}

function pathAndTipParam(contentId: string): { path: string; tipId: string } | null {
  const raw = contentId.trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const path = url.pathname.replace(/\/+$/, "") || "/";
      return { path, tipId: url.searchParams.get("tip")?.trim() || "" };
    } catch {
      return null;
    }
  }

  if (raw.startsWith("/")) {
    const hash = raw.indexOf("#");
    const withoutHash = hash >= 0 ? raw.slice(0, hash) : raw;
    const queryAt = withoutHash.indexOf("?");
    const path = (queryAt >= 0 ? withoutHash.slice(0, queryAt) : withoutHash).replace(/\/+$/, "") || "/";
    const query = queryAt >= 0 ? withoutHash.slice(queryAt + 1) : "";
    return { path, tipId: new URLSearchParams(query).get("tip")?.trim() || "" };
  }

  return null;
}

/**
 * Classify one stored id against known tip → video mappings.
 * `keep` means this id is not a Tip of the Week favorite.
 */
export function planTipOfTheWeekFavorite(
  contentId: string,
  tips: readonly TipVideoMapping[],
): TipFavoritePlan {
  const raw = contentId.trim();
  if (!raw) return { action: "keep" };

  const located = pathAndTipParam(raw);
  if (located) {
    const directVideoId = videoIdFromPermalink(located.path);
    if (directVideoId) return { action: "convert", videoContentId: directVideoId, via: "video-permalink" };
    if (located.path !== TIP_PATH) return { action: "keep" };
    if (!located.tipId) return { action: "exclude", reason: "rotating-url" };
    const videoContentId = lookupVideo(located.tipId, tips);
    if (!videoContentId) return { action: "exclude", reason: "unresolved" };
    return { action: "convert", videoContentId, via: "tip" };
  }

  if (/[/?#:]/.test(raw)) return { action: "keep" };

  const videoContentId = lookupVideo(raw, tips);
  if (videoContentId) return { action: "convert", videoContentId, via: "tip" };
  if (raw === ROTATING_TIP_ID) return { action: "exclude", reason: "rotating-url" };
  return { action: "exclude", reason: "unresolved" };
}

/** Reference rows are migrated only when they actually point at a tip. */
export function referenceFavoriteUsesTipOfTheWeek(contentId: string): boolean {
  const plan = planTipOfTheWeekFavorite(contentId, []);
  if (plan.action === "convert") return false;
  if (plan.action !== "exclude") return false;
  const raw = contentId.trim();
  if (raw === ROTATING_TIP_ID) return true;
  return /\/tip-of-the-week(?:[/?#]|$)/i.test(raw);
}

/** True when the saved value is only the rotating Tip of the Week page. */
export function isRotatingTipOfTheWeekFavorite(contentId: string): boolean {
  const plan = planTipOfTheWeekFavorite(contentId, []);
  return plan.action === "exclude" && plan.reason === "rotating-url";
}

export type StoredTipFavorite = {
  contentType: "tip-of-the-week" | "reference";
  contentId: string;
};

/**
 * Favorites that can be copied onto the permanent video.
 * Rotating and unknown rows are left stored and are not part of this list.
 */
export function tipFavoritesToConvert(
  rows: readonly StoredTipFavorite[],
  tips: readonly TipVideoMapping[],
): { contentType: StoredTipFavorite["contentType"]; contentId: string; videoContentId: string }[] {
  const planned: {
    contentType: StoredTipFavorite["contentType"];
    contentId: string;
    videoContentId: string;
  }[] = [];
  for (const row of rows) {
    const contentId = row.contentId.trim();
    if (!contentId) continue;
    if (row.contentType === "reference") {
      if (!referenceFavoriteUsesTipOfTheWeek(contentId)) continue;
      const plan = planTipOfTheWeekFavorite(contentId, tips);
      if (plan.action !== "convert" || plan.via !== "tip") continue;
      planned.push({ contentType: row.contentType, contentId, videoContentId: plan.videoContentId });
      continue;
    }
    const plan = planTipOfTheWeekFavorite(contentId, tips);
    if (plan.action !== "convert") continue;
    planned.push({ contentType: "tip-of-the-week", contentId, videoContentId: plan.videoContentId });
  }
  return planned;
}
