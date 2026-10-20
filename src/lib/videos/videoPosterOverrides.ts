import { normalizeVideoForSave } from "../videosPublicRecord";

export type VideoPosterOverride = {
  contentId: string;
  posterUrl: string;
};

export type VideoPosterSavePlan =
  | { ok: true; overrides: VideoPosterOverride[]; message: string }
  | { ok: false; error: string };

const STORED_THUMBNAIL_MESSAGE =
  "Saved. The thumbnail is stored and will show on the video page, Video Library, and Tip of the Week.";
const CURRENT_THUMBNAIL_MESSAGE =
  "Saved. The thumbnail matches the catalog, so the video page, Video Library, and Tip of the Week keep the current picture.";

export function videoContentIdKey(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^-?\d+$/.test(trimmed)) return String(parseInt(trimmed, 10));
  return trimmed;
}

export function applyVideoPosterOverrides<T>(
  videos: T[],
  overrides: ReadonlyMap<string, string>,
): T[] {
  if (overrides.size === 0) return videos;
  return videos.map((video) => {
    if (!video || typeof video !== "object") return video;
    const contentId = videoContentIdKey((video as { content_id?: unknown }).content_id);
    if (!contentId || !overrides.has(contentId)) return video;
    const posterUrl = overrides.get(contentId) ?? "";
    const next = { ...(video as Record<string, unknown>) };
    if (posterUrl) next.posterUrl = posterUrl;
    else delete next.posterUrl;
    return next as T;
  });
}

function posterOf(video: Record<string, unknown>): string {
  return typeof video.posterUrl === "string" ? video.posterUrl.trim() : "";
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stableValue(item));
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = stableValue((value as Record<string, unknown>)[key]);
  }
  return out;
}

function comparableRecord(video: Record<string, unknown>): Record<string, unknown> {
  const next = { ...(stableValue(video) as Record<string, unknown>) };
  delete next.posterUrl;
  delete next.poster_url;
  if (next.status === "published") delete next.status;
  return next;
}

function changedFields(source: Record<string, unknown>, submitted: Record<string, unknown>): string[] {
  const left = comparableRecord(source);
  const right = comparableRecord(submitted);
  const fields = new Set([...Object.keys(left), ...Object.keys(right)]);
  const changed: string[] = [];
  for (const field of fields) {
    if (JSON.stringify(left[field]) !== JSON.stringify(right[field])) changed.push(field);
  }
  return changed.sort();
}

function normalizeCatalog(raw: unknown[], label: string): { ok: true; videos: Record<string, unknown>[] } | { ok: false; error: string } {
  const videos: Record<string, unknown>[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const normalized = normalizeVideoForSave(raw[index], index);
    if (!normalized.ok) {
      return { ok: false, error: `${label} ${normalized.error} Nothing was saved.` };
    }
    videos.push(normalized.video);
  }
  return { ok: true, videos };
}

function indexByContentId(
  videos: Record<string, unknown>[],
): { ok: true; byId: Map<string, Record<string, unknown>> } | { ok: false; error: string } {
  const byId = new Map<string, Record<string, unknown>>();
  for (const video of videos) {
    const contentId = videoContentIdKey(video.content_id);
    if (!contentId) {
      return { ok: false, error: "A catalog video is missing a content ID, so nothing was saved." };
    }
    if (byId.has(contentId)) {
      return {
        ok: false,
        error: `Content ID ${contentId} appears more than once, so nothing was saved.`,
      };
    }
    byId.set(contentId, video);
  }
  return { ok: true, byId };
}

/**
 * Persist poster differences only. Any other catalog change is rejected so a
 * thumbnail save cannot quietly drop title, slug, or access edits.
 */
export function planVideoPosterSave(sourceRaw: unknown[], submittedRaw: unknown[]): VideoPosterSavePlan {
  if (sourceRaw.length !== submittedRaw.length) {
    return {
      ok: false,
      error: "This save would add or remove catalog videos, so nothing was saved. Only thumbnails are stored.",
    };
  }

  const sourceNormalized = normalizeCatalog(sourceRaw, "Catalog file:");
  if (!sourceNormalized.ok) return sourceNormalized;
  const submittedNormalized = normalizeCatalog(submittedRaw, "Save:");
  if (!submittedNormalized.ok) return submittedNormalized;

  const sourceIndexed = indexByContentId(sourceNormalized.videos);
  if (!sourceIndexed.ok) return sourceIndexed;
  const submittedIndexed = indexByContentId(submittedNormalized.videos);
  if (!submittedIndexed.ok) return submittedIndexed;

  for (const [contentId, submitted] of submittedIndexed.byId) {
    const source = sourceIndexed.byId.get(contentId);
    if (!source) {
      return {
        ok: false,
        error: `Content ID ${contentId} is not in the catalog, so nothing was saved. Only thumbnails are stored.`,
      };
    }
    const fields = changedFields(source, submitted);
    if (fields.length > 0) {
      const sample = fields.slice(0, 5).join(", ");
      return {
        ok: false,
        error: `This save changes ${sample} for content ID ${contentId}, not only the thumbnail, so nothing was saved.`,
      };
    }
  }

  for (const contentId of sourceIndexed.byId.keys()) {
    if (!submittedIndexed.byId.has(contentId)) {
      return {
        ok: false,
        error: `Content ID ${contentId} was missing from this save, so nothing was saved. Only thumbnails are stored.`,
      };
    }
  }

  const overrides: VideoPosterOverride[] = [];
  for (const [contentId, submitted] of submittedIndexed.byId) {
    const source = sourceIndexed.byId.get(contentId);
    if (!source) continue;
    const posterUrl = posterOf(submitted);
    if (posterUrl !== posterOf(source)) overrides.push({ contentId, posterUrl });
  }
  overrides.sort((a, b) => a.contentId.localeCompare(b.contentId, "en", { numeric: true }));

  return {
    ok: true,
    overrides,
    message: overrides.length > 0 ? STORED_THUMBNAIL_MESSAGE : CURRENT_THUMBNAIL_MESSAGE,
  };
}
