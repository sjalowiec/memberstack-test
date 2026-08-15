/** Catalog visibility in `src/data/videos-public.json`. */
export type VideoCatalogStatus = "draft" | "published" | "archived";

export type VideoCatalogRecord = {
  content_id?: string | number;
  slug?: string;
  title?: string;
  description?: string;
  summary?: string;
  posterUrl?: string;
  status?: string;
  category?: string;
  subcategory?: string;
};

/**
 * Effective catalog status. Missing or blank `status` is treated as `published`
 * so existing rows stay public without a migration.
 */
export function normalizeVideoCatalogStatus(raw: unknown): VideoCatalogStatus {
  if (raw === undefined || raw === null) return "published";
  if (typeof raw !== "string") return "published";
  const s = raw.trim().toLowerCase();
  if (s === "public") return "published";
  if (s === "draft" || s === "archived" || s === "published") return s;
  if (s === "") return "published";
  return "draft";
}

/** Whether a catalog row may appear on public video routes, search, or embeds. */
export function catalogVideoIsPublic(video: VideoCatalogRecord): boolean {
  return normalizeVideoCatalogStatus(video.status) === "published";
}

export function filterPublicCatalogVideos<T extends VideoCatalogRecord>(videos: T[]): T[] {
  return videos.filter(catalogVideoIsPublic);
}

export function findPublicCatalogVideoByContentId<T extends VideoCatalogRecord>(
  videos: T[],
  contentId: string | number,
): T | undefined {
  const id = String(contentId).trim();
  if (!id) return undefined;
  return filterPublicCatalogVideos(videos).find((v) => String(v.content_id ?? "").trim() === id);
}

function catalogVideoSearchText(video: VideoCatalogRecord): string {
  const parts = [video.title, video.description, video.summary, video.slug, video.category, video.subcategory];
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim() !== "")
    .join(" ")
    .toLowerCase();
}

export function searchPublicCatalogVideos<T extends VideoCatalogRecord>(
  videos: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return filterPublicCatalogVideos(videos);
  return filterPublicCatalogVideos(videos).filter((v) => catalogVideoSearchText(v).includes(q));
}
