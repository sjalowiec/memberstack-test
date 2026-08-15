/**
 * Optional Four-Gore (wedge-4-decrease) pattern tip that opens catalog video 2209
 * in the site-wide KinCatalogVideoModal. Free / ungated lead-magnet help.
 */
import {
  findPublicVideoByContentId,
  sleevelessHelpVideoFromCatalog,
  type SleevelessHelpVideoMeta,
} from "../sleevelessCatalogHelpVideo";
import type { PublicVideoRow } from "../../lessonVideo";
import videosPublic from "../../../data/videos-public.json";
import { normalizeAccessLevelRaw } from "../../videoAccessLevel";

/** Learning Library content_id for “Basic Decreasing”. */
export const HAT_FOUR_GORE_CROWN_VIDEO_CONTENT_ID = 2209;

export const HAT_FOUR_GORE_CROWN_VIDEO_TIP_ID = "hat-four-gore-crown-video";

export const HAT_FOUR_GORE_CROWN_TIP_TITLE = "Cleaner Edges for Seaming";

export const HAT_FOUR_GORE_CROWN_TIP_MESSAGE =
  "Work the decreases two stitches in from each edge. This leaves a clean edge and makes the crown easier to seam.";

export const HAT_FOUR_GORE_CROWN_WATCH_LABEL = "Watch the Basic Decreasing Video";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Resolve catalog row → Vimeo meta for KinCatalogVideoModal. */
export function resolveHatFourGoreCrownVideo(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): SleevelessHelpVideoMeta | null {
  return sleevelessHelpVideoFromCatalog(HAT_FOUR_GORE_CROWN_VIDEO_CONTENT_ID, catalog);
}

/** True when content_id 2209 is classified free (`access_level: public`) in the catalog. */
export function isHatFourGoreCrownVideoFree(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): boolean {
  const row = findPublicVideoByContentId(catalog, HAT_FOUR_GORE_CROWN_VIDEO_CONTENT_ID);
  if (!row) return false;
  return normalizeAccessLevelRaw((row as { access_level?: unknown }).access_level) === "public";
}

/**
 * Pattern tip HTML for Four-Gore crown decrease instructions.
 * Returns "" when the catalog video cannot be resolved (no dead Watch control).
 */
export function buildHatFourGoreCrownVideoTipHtml(
  video: SleevelessHelpVideoMeta | null = resolveHatFourGoreCrownVideo(),
): string {
  if (!video) return "";
  const chaptersAttr =
    video.jumpLinks.length > 0
      ? ` data-video-chapters="${escapeHtml(
          JSON.stringify(
            video.jumpLinks.map((j) => ({ label: j.label, time: j.seconds })),
          ),
        )}"`
      : "";
  return (
    `<div class="pattern-tip" data-tip data-tip-id="${HAT_FOUR_GORE_CROWN_VIDEO_TIP_ID}" data-hat-four-gore-crown-video-tip data-content-id="${HAT_FOUR_GORE_CROWN_VIDEO_CONTENT_ID}">` +
    `<p class="hat-four-gore-crown-video-tip__title"><strong>${escapeHtml(HAT_FOUR_GORE_CROWN_TIP_TITLE)}</strong></p>` +
    `<p class="hat-four-gore-crown-video-tip__message">${escapeHtml(HAT_FOUR_GORE_CROWN_TIP_MESSAGE)}</p>` +
    `<p class="hat-four-gore-crown-video-tip__actions pattern-tip-media-no-print no-print">` +
    `<button type="button" class="kbm-kin-catalog-video hat-four-gore-crown-video-tip__watch"` +
    ` data-vimeo-id="${escapeHtml(video.id)}"` +
    ` data-video-title="${escapeHtml(video.title)}"` +
    ` data-testid="hat-four-gore-crown-video-watch"` +
    ` data-hat-four-gore-crown-content-id="${HAT_FOUR_GORE_CROWN_VIDEO_CONTENT_ID}"` +
    `${chaptersAttr}>${escapeHtml(HAT_FOUR_GORE_CROWN_WATCH_LABEL)}</button>` +
    `</p>` +
    `</div>`
  );
}
