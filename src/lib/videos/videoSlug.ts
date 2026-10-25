/** Slug helpers shared by the video editor (browser) and the save API (server). */
import { videoContentIdKey } from "./videoPosterOverrides";

export function slugFromTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function videoSlugKey(video: Record<string, unknown>): string {
  return typeof video.slug === "string" ? video.slug.trim().toLowerCase() : "";
}

/** `base`, or `base-2`, `base-3`, … when another video already uses it. */
export function uniqueVideoSlug(
  base: string,
  catalog: Record<string, unknown>[],
  exceptContentId?: string,
): string {
  const taken = new Set(
    catalog
      .filter((video) => videoContentIdKey(video.content_id) !== exceptContentId)
      .map(videoSlugKey),
  );
  const root = base || "video";
  if (!taken.has(root)) return root;
  for (let n = 2; ; n += 1) {
    const candidate = `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
