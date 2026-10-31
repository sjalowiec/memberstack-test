import { slugify } from "../slugify";
import { videoContentIdKey } from "./videoPosterOverrides";

/**
 * New catalog numbers start at 5001.
 *
 * Legacy video numbers in `videos-public.json` run from 97 through 2216.
 * Three of those legacy ids are text, not integers: "249", "249-1", and "249-2".
 * Videos added on this site already use 5001 and 5002, the same floor lessons use
 * so new ids stay out of the legacy range.
 *
 * Postgres does not assign video Content IDs. `video_poster_overrides.content_id`
 * and `watson_tip_of_the_week.video_content_id` are text columns with no default.
 */
export const NEW_VIDEO_CONTENT_ID_FLOOR = 5000;

const NEW_VIDEO_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type VideoIdentityRow = {
  content_id?: unknown;
  slug?: unknown;
  title?: unknown;
  [key: string]: unknown;
};

function numericVideoContentId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = parseInt(value.trim(), 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

/** Next unused integer above the legacy floor and every reserved id. */
export function nextVideoContentId(reserved: readonly unknown[]): number {
  const used = new Set<string>();
  let max = NEW_VIDEO_CONTENT_ID_FLOOR;
  for (const value of reserved) {
    const key = videoContentIdKey(value);
    if (key) used.add(key);
    const numeric = numericVideoContentId(value);
    if (numeric != null && numeric > max) max = numeric;
  }
  let next = max + 1;
  while (used.has(String(next))) next += 1;
  return next;
}

/**
 * Keep Content IDs already in the catalog. Assign a new id only when a row has none.
 * A Content ID that is not already in the catalog is rejected so the browser cannot choose one.
 */
export function assignNewVideoContentIds(
  source: readonly VideoIdentityRow[],
  submitted: readonly unknown[],
): { ok: true; videos: Record<string, unknown>[] } | { ok: false; error: string } {
  const sourceIdValue = new Map<string, unknown>();
  for (const row of source) {
    const key = videoContentIdKey(row.content_id);
    if (!key) continue;
    if (sourceIdValue.has(key)) {
      return { ok: false, error: `Video number ${key} appears more than once, so nothing was saved.` };
    }
    sourceIdValue.set(key, row.content_id);
  }

  const videos: Record<string, unknown>[] = [];
  const needsId: number[] = [];
  for (let index = 0; index < submitted.length; index += 1) {
    const raw = submitted[index];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, error: `Video ${index + 1} must be an object.` };
    }
    const row = { ...(raw as Record<string, unknown>) };
    const key = videoContentIdKey(row.content_id);
    if (!key) {
      delete row.content_id;
      needsId.push(videos.length);
    } else if (sourceIdValue.has(key)) {
      row.content_id = sourceIdValue.get(key);
    } else {
      return {
        ok: false,
        error: "New videos receive a Content ID when they are saved. Leave Content ID empty and save again.",
      };
    }
    videos.push(row);
  }

  const reserved: unknown[] = [...sourceIdValue.values()];
  for (const index of needsId) {
    const contentId = nextVideoContentId(reserved);
    videos[index].content_id = contentId;
    reserved.push(contentId);
  }
  return { ok: true, videos };
}

export function suggestedVideoSlug(title: string): string {
  return slugify(title);
}

/** Slug shown in the editor. Existing videos and a hand-edited slug stay as typed. */
export function slugFieldValue(input: {
  isNew: boolean;
  slugEdited: boolean;
  title: string;
  currentSlug: string;
}): string {
  if (!input.isNew || input.slugEdited) return input.currentSlug;
  return suggestedVideoSlug(input.title);
}

export function videoSlugFormatError(slug: string): string | null {
  const trimmed = slug.trim();
  if (!trimmed) return "Slug is required.";
  if (!NEW_VIDEO_SLUG.test(trimmed)) return "Use lowercase letters, numbers, and hyphens.";
  return null;
}

export function videoSlugConflict(
  slug: string,
  videos: readonly VideoIdentityRow[],
  ignore?: { contentId?: unknown },
): string | null {
  const wanted = slug.trim().toLowerCase();
  if (!wanted) return "Slug is required.";
  const ignoreId = videoContentIdKey(ignore?.contentId);
  for (const video of videos) {
    const existing = typeof video.slug === "string" ? video.slug.trim() : "";
    if (!existing || existing.toLowerCase() !== wanted) continue;
    if (ignoreId && videoContentIdKey(video.content_id) === ignoreId) continue;
    const title = typeof video.title === "string" ? video.title.trim() : "";
    return title
      ? `That slug is already used by "${title}".`
      : `That slug is already used.`;
  }
  return null;
}

export function videoSlugDraftError(
  slug: string,
  videos: readonly VideoIdentityRow[],
  options: { isNew: boolean; originalSlug?: string; contentId?: unknown },
): string | null {
  const trimmed = slug.trim();
  if (!trimmed) return "Slug is required.";
  const unchanged = !options.isNew && trimmed === (options.originalSlug ?? "").trim();
  if (!unchanged) {
    const format = videoSlugFormatError(trimmed);
    if (format) return format;
  }
  return videoSlugConflict(trimmed, videos, options.isNew ? undefined : { contentId: options.contentId });
}

/** Reject a new or changed slug that is malformed or already used. Unchanged legacy slugs stay. */
export function catalogSlugSaveError(
  source: readonly VideoIdentityRow[],
  submitted: readonly VideoIdentityRow[],
): string | null {
  const originalSlug = new Map<string, string>();
  for (const row of source) {
    const id = videoContentIdKey(row.content_id);
    if (!id) continue;
    originalSlug.set(id, typeof row.slug === "string" ? row.slug : "");
  }

  const seen = new Set<string>();
  for (let index = 0; index < submitted.length; index += 1) {
    const row = submitted[index];
    const slug = typeof row.slug === "string" ? row.slug.trim() : "";
    if (!slug) return `Video ${index + 1}: slug is required.`;
    const id = videoContentIdKey(row.content_id);
    const previous = id ? originalSlug.get(id) : undefined;
    const unchanged = previous !== undefined && previous.trim() === slug;
    if (!unchanged) {
      const format = videoSlugFormatError(slug);
      if (format) return `Video ${index + 1}: ${format}`;
    }
    const key = slug.toLowerCase();
    if (seen.has(key)) return `That slug is already used.`;
    seen.add(key);
  }
  return null;
}
