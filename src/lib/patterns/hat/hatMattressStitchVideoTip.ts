/**
 * Finishing help video (Mattress Stitch, content_id 2210) for all hat crown styles.
 * Inline glossary-styled control opens the site-wide KinCatalogVideoModal (not a tooltip).
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

/** Learning Library content_id for “Mattress Stitch”. */
export const HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID = 2210;

export const HAT_MATTRESS_STITCH_VIDEO_TIP_ID = "hat-mattress-stitch-video";

/** Accessible name for the inline video control. */
export const HAT_MATTRESS_STITCH_WATCH_LABEL = "Watch the Mattress Stitch video";

/** Visible phrase wrapped by the inline video control. */
export const HAT_MATTRESS_STITCH_VISIBLE_TEXT = "mattress stitch";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Resolve catalog row → Vimeo meta for KinCatalogVideoModal. */
export function resolveHatMattressStitchVideo(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): SleevelessHelpVideoMeta | null {
  return sleevelessHelpVideoFromCatalog(HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID, catalog);
}

/** True when content_id 2210 is classified free (`access_level: public`) in the catalog. */
export function isHatMattressStitchVideoFree(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): boolean {
  const row = findPublicVideoByContentId(catalog, HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID);
  if (!row) return false;
  return normalizeAccessLevelRaw((row as { access_level?: unknown }).access_level) === "public";
}

/**
 * Inline “mattress stitch” control for shared hat finishing copy.
 * Uses glossary label/underline treatment; opens KinCatalogVideoModal (no tooltip).
 * Returns plain text when the catalog video cannot be resolved (no dead control).
 */
export function buildHatMattressStitchVideoHtml(
  video: SleevelessHelpVideoMeta | null = resolveHatMattressStitchVideo(),
): string {
  if (!video) return escapeHtml(HAT_MATTRESS_STITCH_VISIBLE_TEXT);
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
    ` data-testid="hat-mattress-stitch-video-watch"` +
    ` data-hat-mattress-stitch-video` +
    ` data-tip-id="${HAT_MATTRESS_STITCH_VIDEO_TIP_ID}"` +
    ` data-content-id="${HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID}"` +
    ` data-hat-mattress-stitch-content-id="${HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID}"` +
    ` aria-label="${escapeHtml(HAT_MATTRESS_STITCH_WATCH_LABEL)}"` +
    `${chaptersAttr}>` +
    `<span class="glossary-tooltip-label">` +
    `${escapeHtml(HAT_MATTRESS_STITCH_VISIBLE_TEXT)}` +
    `<sup class="glossary-tooltip-icon" aria-hidden="true">?</sup>` +
    `</span>` +
    `</button>`
  );
}
