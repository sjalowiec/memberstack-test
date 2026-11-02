import { videoContentIdKey } from "./videos/videoPosterOverrides";

const VIMEO_REFERRERS = [
  "https://knititnow.com",
  "https://www.knititnow.com",
  "https://knitbymachine.com",
  "https://www.knitbymachine.com",
] as const;

export type VimeoCatalogPosterResult =
  | { ok: true; posterUrl: string }
  | { ok: false; error: string };

/** Vimeo page URL used for oEmbed. Optional hash is only for unlisted videos. */
export function vimeoOembedPageUrl(vimeoId: number, privacyHash?: string): string | null {
  if (!Number.isInteger(vimeoId) || vimeoId <= 0) return null;
  const hash = (privacyHash || "").trim();
  if (hash && !/^[A-Za-z0-9]+$/.test(hash)) return null;
  return hash ? `https://vimeo.com/${vimeoId}/${hash}` : `https://vimeo.com/${vimeoId}`;
}

const DASH_SIZE = /-d_\d+(?:x\d+)?$/;
const UNDERSCORE_SIZE = /_\d+(?:x\d+)?$/;

/**
 * Catalog posters use a stable 1280×720 Vimeo CDN address.
 * oEmbed usually returns a smaller size such as `-d_960?region=us`.
 * Some videos use `_960` instead of `-d_960`. Those stay on the underscore
 * address; rewriting them to `-d_1280x720` does not load.
 */
export function catalogPosterUrlFromThumbnail(thumbnailUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(thumbnailUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "i.vimeocdn.com") return null;
  if (!/^\/video\/[A-Za-z0-9._-]+$/.test(url.pathname)) return null;

  let sized = url.pathname;
  if (DASH_SIZE.test(sized)) sized = sized.replace(DASH_SIZE, "-d_1280x720");
  else if (UNDERSCORE_SIZE.test(sized)) sized = sized.replace(UNDERSCORE_SIZE, "_1280x720");
  else return null;

  return `https://i.vimeocdn.com${sized}?r=pad`;
}

function vimeoIdKey(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return String(parseInt(value.trim(), 10));
  return "";
}

/**
 * Load the current Vimeo picture when a save would show no picture, or would
 * keep the previous picture after the Vimeo ID changed.
 * A picture the admin typed in is kept.
 */
export function posterSyncAction(input: {
  previousVimeoId: unknown;
  nextVimeoId: unknown;
  previousPoster: string;
  nextPoster: string;
}): "keep" | "load" {
  const nextId = vimeoIdKey(input.nextVimeoId);
  if (!nextId) return "keep";
  if (!input.nextPoster.trim()) return "load";
  const previousId = vimeoIdKey(input.previousVimeoId);
  if (previousId && previousId !== nextId && input.nextPoster.trim() === input.previousPoster.trim()) {
    return "load";
  }
  return "keep";
}

export async function fetchVimeoCatalogPoster(
  vimeoId: number,
  privacyHash?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VimeoCatalogPosterResult> {
  const pageUrl = vimeoOembedPageUrl(vimeoId, privacyHash);
  if (!pageUrl) return { ok: false, error: "Enter a Vimeo ID first." };

  const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(pageUrl)}&width=1280`;
  let sawNotFound = false;

  for (const referer of VIMEO_REFERRERS) {
    try {
      const response = await fetchImpl(oembedUrl, { headers: { Referer: referer } });
      if (response.status === 404) {
        sawNotFound = true;
        continue;
      }
      if (!response.ok) continue;
      const data = (await response.json()) as { thumbnail_url?: unknown };
      const raw = typeof data.thumbnail_url === "string" ? data.thumbnail_url : "";
      const posterUrl = raw ? catalogPosterUrlFromThumbnail(raw) : null;
      if (posterUrl) return { ok: true, posterUrl };
    } catch {
      continue;
    }
  }

  if (sawNotFound) return { ok: false, error: "Vimeo could not find that video." };
  return { ok: false, error: "Vimeo did not return a thumbnail for that video." };
}

function posterOf(video: unknown): string {
  if (!video || typeof video !== "object") return "";
  const poster = (video as { posterUrl?: unknown }).posterUrl;
  return typeof poster === "string" ? poster.trim() : "";
}

/**
 * Fill a missing thumbnail, or replace the previous thumbnail when the Vimeo ID changed.
 * Does not replace a thumbnail the admin already chose.
 */
export async function syncSubmittedVideoPosters(
  videos: Record<string, unknown>[],
  source: readonly unknown[],
  posterOverrides: ReadonlyMap<string, string>,
  fetchPoster: typeof fetchVimeoCatalogPoster = fetchVimeoCatalogPoster,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sourceById = new Map<string, unknown>();
  for (const row of source) {
    if (!row || typeof row !== "object") continue;
    const contentId = videoContentIdKey((row as { content_id?: unknown }).content_id);
    if (contentId) sourceById.set(contentId, row);
  }

  for (const video of videos) {
    const contentId = videoContentIdKey(video.content_id);
    const sourceVideo = contentId ? sourceById.get(contentId) : undefined;
    const previousPoster =
      contentId && posterOverrides.has(contentId)
        ? (posterOverrides.get(contentId) ?? "").trim()
        : posterOf(sourceVideo);
    const nextPoster = posterOf(video);
    const previousVimeoId =
      sourceVideo && typeof sourceVideo === "object"
        ? (sourceVideo as { vimeo_id?: unknown }).vimeo_id
        : undefined;
    if (
      posterSyncAction({
        previousVimeoId,
        nextVimeoId: video.vimeo_id,
        previousPoster,
        nextPoster,
      }) !== "load"
    ) {
      continue;
    }

    const nextVimeoId = typeof video.vimeo_id === "number" ? video.vimeo_id : 0;
    const hash = typeof video.vimeo_hash === "string" ? video.vimeo_hash.trim() : "";
    const sameVimeoId =
      previousVimeoId != null && String(previousVimeoId).trim() === String(nextVimeoId);
    const loaded = await fetchPoster(nextVimeoId, sameVimeoId ? hash : undefined);
    if (!loaded.ok) {
      if (nextPoster) {
        const title = typeof video.title === "string" ? video.title.trim() : "";
        const label = title || contentId || "this video";
        return {
          ok: false,
          error: `The Vimeo ID for ${label} changed, but Vimeo did not return a thumbnail. Refresh the thumbnail, or put the previous Vimeo ID back. Nothing was saved.`,
        };
      }
      continue;
    }
    video.posterUrl = loaded.posterUrl;
  }

  return { ok: true };
}
