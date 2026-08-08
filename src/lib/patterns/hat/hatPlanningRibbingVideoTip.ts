/**
 * Shared brim tip (Planning Ribbing for a Neat Seam, content_id 2211) for all hat crown styles.
 * Shown once before cast-on so knitters can adjust stitch count for ribbing.
 * Inline glossary-styled control opens KinCatalogVideoModal (not a tooltip).
 * Free / ungated (`access_level: public`).
 */
import {
  findPublicVideoByContentId,
  sleevelessHelpVideoFromCatalog,
  type SleevelessHelpVideoMeta,
} from "../sleevelessCatalogHelpVideo";
import type { PublicVideoRow } from "../../lessonVideo";
import videosPublic from "../../../data/videos-public.json";
import { normalizeAccessLevelRaw } from "../../videoAccessLevel";

/** Learning Library content_id for “Planning Ribbing for a Neat Seam”. */
export const HAT_PLANNING_RIBBING_VIDEO_CONTENT_ID = 2211;

export const HAT_PLANNING_RIBBING_VIDEO_TIP_ID = "hat-planning-ribbing-brim";

export const HAT_PLANNING_RIBBING_TIP_TITLE = "Planning a Ribbed Brim?";

export const HAT_PLANNING_RIBBING_TIP_TEXT =
  "If you plan to knit the brim in ribbing, you may need to add or subtract a stitch so the ribbing matches neatly at the seam. After completing the ribbing, increase or decrease back to the pattern stitch count.";

/** Accessible name for the inline video control. */
export const HAT_PLANNING_RIBBING_WATCH_LABEL = "Watch Planning Ribbing for a Neat Seam";

/** Visible phrase wrapped by the inline video control (video title only). */
export const HAT_PLANNING_RIBBING_VISIBLE_TEXT = "Planning Ribbing for a Neat Seam";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Resolve catalog row → Vimeo meta for KinCatalogVideoModal. */
export function resolveHatPlanningRibbingVideo(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): SleevelessHelpVideoMeta | null {
  return sleevelessHelpVideoFromCatalog(HAT_PLANNING_RIBBING_VIDEO_CONTENT_ID, catalog);
}

/** True when content_id 2211 is classified free (`access_level: public`) in the catalog. */
export function isHatPlanningRibbingVideoFree(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): boolean {
  const row = findPublicVideoByContentId(catalog, HAT_PLANNING_RIBBING_VIDEO_CONTENT_ID);
  if (!row) return false;
  return normalizeAccessLevelRaw((row as { access_level?: unknown }).access_level) === "public";
}

/**
 * Inline video-title control for the shared brim tip.
 * Uses glossary label/underline treatment; opens KinCatalogVideoModal (no tooltip).
 * Returns plain text when the catalog video cannot be resolved (no dead control).
 */
export function buildHatPlanningRibbingVideoHtml(
  video: SleevelessHelpVideoMeta | null = resolveHatPlanningRibbingVideo(),
): string {
  if (!video) return escapeHtml(HAT_PLANNING_RIBBING_VISIBLE_TEXT);
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
    ` class="kbm-kin-catalog-video glossary-tooltip-trigger"` +
    ` data-vimeo-id="${escapeHtml(video.id)}"` +
    ` data-video-title="${escapeHtml(video.title)}"` +
    ` data-testid="hat-planning-ribbing-video-watch"` +
    ` data-hat-planning-ribbing-video` +
    ` data-content-id="${HAT_PLANNING_RIBBING_VIDEO_CONTENT_ID}"` +
    ` data-hat-planning-ribbing-content-id="${HAT_PLANNING_RIBBING_VIDEO_CONTENT_ID}"` +
    ` aria-label="${escapeHtml(HAT_PLANNING_RIBBING_WATCH_LABEL)}"` +
    `${chaptersAttr}>` +
    `<span class="glossary-tooltip-label">` +
    `${escapeHtml(HAT_PLANNING_RIBBING_VISIBLE_TEXT)}` +
    `<sup class="glossary-tooltip-icon" aria-hidden="true">?</sup>` +
    `</span>` +
    `</button>`
  );
}

/**
 * Shared pattern tip HTML placed once before cast-on for all crown styles.
 * Advice only — does not change the calculated cast-on stitch count.
 */
export function buildHatPlanningRibbingBrimTipHtml(
  video: SleevelessHelpVideoMeta | null = resolveHatPlanningRibbingVideo(),
): string {
  const videoHtml = buildHatPlanningRibbingVideoHtml(video);
  return (
    `<div class="pattern-tip" data-tip data-tip-id="${HAT_PLANNING_RIBBING_VIDEO_TIP_ID}" data-hat-planning-ribbing-brim-tip>` +
    `<strong>${escapeHtml(HAT_PLANNING_RIBBING_TIP_TITLE)}</strong> ` +
    `${escapeHtml(HAT_PLANNING_RIBBING_TIP_TEXT)} ` +
    `${videoHtml}` +
    `</div>`
  );
}
