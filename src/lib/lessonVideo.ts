/**
 * Resolve lesson video playback from `videoSlug` (stable key into `videos-public.json`).
 */

export type PublicVideoRow = {
  content_id?: string | number;
  slug?: string;
  title?: string;
  vimeo_id?: number;
  vimeo_id_public?: number;
  access_level?: string;
  /** `draft`, `published`, or `archived`. Omitted = legacy published. */
  status?: string;
  /** Public exception: featured Tuesday Tip plays for everyone. */
  isTipOfWeek?: boolean;
  /** Alias used by admin editing; mirrored with isTipOfWeek. */
  tipOfWeek?: boolean;
  tipHeadline?: string;
  tipNote?: string;
  tipHistory?: Array<{ date: string; headline?: string; note?: string }>;
  /** Optional: future transcript / search pipeline */
  transcript_json?: unknown;
  vtt_url?: string;
  search_ready?: boolean;
  /** Optional catalog chapters for modal jump controls (same shape as `jumpLinks`). */
  chapters?: Array<{ label: string; time: number }>;
  /** Optional jump markers when `chapters` is not used (detail page + modal use the merged parser). */
  jumpLinks?: Array<{ label: string; time: number }>;
};

/** Stable key: `slug` when non-empty, else `String(content_id)`. */
export function stableVideoKey(v: PublicVideoRow): string {
  const s = typeof v.slug === "string" ? v.slug.trim() : "";
  if (s) return s;
  return String(v.content_id ?? "");
}

export function vimeoNumericIdFromPublicVideo(v: PublicVideoRow): string | null {
  const n =
    typeof v.vimeo_id === "number" && Number.isFinite(v.vimeo_id)
      ? v.vimeo_id
      : typeof v.vimeo_id_public === "number" && Number.isFinite(v.vimeo_id_public)
        ? v.vimeo_id_public
        : null;
  return n !== null ? String(Math.trunc(n)) : null;
}

/** Find video by stable key (slug or content_id string). */
export function findPublicVideoByKey(
  videos: PublicVideoRow[],
  key: string,
): PublicVideoRow | undefined {
  const k = key.trim();
  if (!k) return undefined;
  return videos.find((v) => stableVideoKey(v) === k);
}
