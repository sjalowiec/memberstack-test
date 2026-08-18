/**
 * Gathered-crown help video (Gathered Top for Mittens and Hats, content_id 587).
 * Inline glossary-styled control opens KinCatalogVideoModal (not a tooltip).
 * Catalog row is existing Learning Library video (access_level may be member).
 */
import {
  findPublicVideoByContentId,
  sleevelessHelpVideoFromCatalog,
  type SleevelessHelpVideoMeta,
} from "../sleevelessCatalogHelpVideo";
import type { PublicVideoRow } from "../../lessonVideo";
import videosPublic from "../../../data/videos-public.json";
import { normalizeAccessLevelRaw } from "../../videoAccessLevel";

/** Learning Library content_id for “Gathered Top for Mittens and Hats”. */
export const HAT_GATHERED_TOP_VIDEO_CONTENT_ID = 587;

export const HAT_GATHERED_TOP_VIDEO_TIP_ID = "hat-gathered-top-video";

/** Accessible name for the inline video control. */
export const HAT_GATHERED_TOP_WATCH_LABEL = "Watch Gathered Top for Mittens and Hats";

/** Visible phrase wrapped by the inline video control. */
export const HAT_GATHERED_TOP_VISIBLE_TEXT = "gather the remaining stitches";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Resolve catalog row → Vimeo meta for KinCatalogVideoModal. */
export function resolveHatGatheredTopVideo(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): SleevelessHelpVideoMeta | null {
  return sleevelessHelpVideoFromCatalog(HAT_GATHERED_TOP_VIDEO_CONTENT_ID, catalog);
}

/** True when content_id 587 is classified free (`access_level: public`) in the catalog. */
export function isHatGatheredTopVideoFree(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): boolean {
  const row = findPublicVideoByContentId(catalog, HAT_GATHERED_TOP_VIDEO_CONTENT_ID);
  if (!row) return false;
  return normalizeAccessLevelRaw((row as { access_level?: unknown }).access_level) === "public";
}

/**
 * Inline gather control for gathered-crown instructions.
 * Uses glossary label/underline treatment; opens KinCatalogVideoModal (no tooltip).
 * Returns plain text when the catalog video cannot be resolved (no dead control).
 */
export function hatGatheredTopVisibleText(remainingStitches?: number): string {
  const n = remainingStitches != null ? Math.max(0, Math.round(remainingStitches)) : 0;
  return n > 0
    ? `gather the remaining ${n} stitches`
    : HAT_GATHERED_TOP_VISIBLE_TEXT;
}

export function buildHatGatheredTopVideoHtml(
  video: SleevelessHelpVideoMeta | null = resolveHatGatheredTopVideo(),
  remainingStitches?: number,
): string {
  const visible = hatGatheredTopVisibleText(remainingStitches);
  if (!video) return escapeHtml(visible);
  const chaptersAttr =
    video.jumpLinks.length > 0
      ? ` data-video-chapters="${escapeHtml(
          JSON.stringify(
            video.jumpLinks.map((j) => ({ label: j.label, time: j.seconds })),
          ),
        )}"`
      : "";
  return (
    `<button type="button"` +
    ` class="kbm-kin-catalog-video glossary-tooltip-trigger print-visible"` +
    ` data-vimeo-id="${escapeHtml(video.id)}"` +
    ` data-video-title="${escapeHtml(video.title)}"` +
    ` data-testid="hat-gathered-top-video-watch"` +
    ` data-hat-gathered-top-video` +
    ` data-tip-id="${HAT_GATHERED_TOP_VIDEO_TIP_ID}"` +
    ` data-content-id="${HAT_GATHERED_TOP_VIDEO_CONTENT_ID}"` +
    ` data-hat-gathered-top-content-id="${HAT_GATHERED_TOP_VIDEO_CONTENT_ID}"` +
    ` aria-label="${escapeHtml(HAT_GATHERED_TOP_WATCH_LABEL)}"` +
    `${chaptersAttr}>` +
    `<span class="glossary-tooltip-label">` +
    `${escapeHtml(visible)}` +
    `<sup class="glossary-tooltip-icon" aria-hidden="true">?</sup>` +
    `</span>` +
    `</button>`
  );
}
