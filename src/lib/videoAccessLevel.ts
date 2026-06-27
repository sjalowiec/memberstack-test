/**
 * Admin video access levels for `videos-public.json` (`access_level` field).
 * Distinct from catalog `status` (draft / published / archived).
 */

export const VIDEO_ACCESS_LEVELS = ["public", "member", "draft"] as const;

export type VideoAccessLevel = (typeof VIDEO_ACCESS_LEVELS)[number];

export function normalizeAccessLevelRaw(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).trim().toLowerCase();
}

export function isValidVideoAccessLevel(value: string): value is VideoAccessLevel {
  return (VIDEO_ACCESS_LEVELS as readonly string[]).includes(value);
}

/** True when `access_level` is missing, blank, or not public / member / draft. */
export function videoAccessNeedsReview(raw: unknown): boolean {
  const value = normalizeAccessLevelRaw(raw);
  if (!value) return true;
  return !isValidVideoAccessLevel(value);
}

export function accessLevelSummaryBucket(raw: unknown): VideoAccessLevel | "needsReview" {
  const value = normalizeAccessLevelRaw(raw);
  if (isValidVideoAccessLevel(value)) return value;
  return "needsReview";
}

export function validatePendingAccessLevel(
  value: unknown,
): { ok: true; access_level: VideoAccessLevel } | { ok: false; error: string } {
  const normalized = normalizeAccessLevelRaw(value);
  if (!normalized) {
    return { ok: false, error: "access_level is required (choose public, member, or draft)." };
  }
  if (!isValidVideoAccessLevel(normalized)) {
    return {
      ok: false,
      error: `Invalid access_level "${String(value).trim()}". Must be public, member, or draft.`,
    };
  }
  return { ok: true, access_level: normalized };
}
