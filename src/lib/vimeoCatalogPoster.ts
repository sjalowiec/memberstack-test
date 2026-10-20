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

/**
 * Catalog posters use a stable 1280×720 Vimeo CDN address.
 * oEmbed usually returns a smaller size such as `-d_960?region=us`.
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
  const sized = url.pathname.replace(/-d_\d+(?:x\d+)?$/, "-d_1280x720");
  if (!sized.endsWith("-d_1280x720")) return null;
  return `https://i.vimeocdn.com${sized}?r=pad`;
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
