/**
 * Optional Swirl Crown (spiral) pattern tip that opens catalog video 260
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

/** Learning Library content_id for “Shaped Crown Hat on the Machine”. */
export const HAT_SWIRL_CROWN_VIDEO_CONTENT_ID = 260;

export const HAT_SWIRL_CROWN_VIDEO_TIP_ID = "hat-swirl-crown-video";

export const HAT_SWIRL_CROWN_TIP_TITLE = "Swirl Crown Tip";

export const HAT_SWIRL_CROWN_TIP_MESSAGE =
  "Not sure how the swirl shaping works? Watch this video for a step-by-step demonstration.";

export const HAT_SWIRL_CROWN_WATCH_LABEL = "Watch the Swirl Crown Video";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Resolve catalog row → Vimeo meta for KinCatalogVideoModal. */
export function resolveHatSwirlCrownVideo(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): SleevelessHelpVideoMeta | null {
  return sleevelessHelpVideoFromCatalog(HAT_SWIRL_CROWN_VIDEO_CONTENT_ID, catalog);
}

/** True when content_id 260 is classified free (`access_level: public`) in the catalog. */
export function isHatSwirlCrownVideoFree(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): boolean {
  const row = findPublicVideoByContentId(catalog, HAT_SWIRL_CROWN_VIDEO_CONTENT_ID);
  if (!row) return false;
  return normalizeAccessLevelRaw((row as { access_level?: unknown }).access_level) === "public";
}

/**
 * Pattern tip HTML for Swirl Crown instructions.
 * Returns "" when the catalog video cannot be resolved (no dead Watch control).
 */
export function buildHatSwirlCrownVideoTipHtml(
  video: SleevelessHelpVideoMeta | null = resolveHatSwirlCrownVideo(),
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
    `<div class="pattern-tip" data-tip data-tip-id="${HAT_SWIRL_CROWN_VIDEO_TIP_ID}" data-hat-swirl-crown-video-tip data-content-id="${HAT_SWIRL_CROWN_VIDEO_CONTENT_ID}">` +
    `<p class="hat-swirl-crown-video-tip__title"><strong>${escapeHtml(HAT_SWIRL_CROWN_TIP_TITLE)}</strong></p>` +
    `<p class="hat-swirl-crown-video-tip__message">${escapeHtml(HAT_SWIRL_CROWN_TIP_MESSAGE)}</p>` +
    `<p class="hat-swirl-crown-video-tip__actions pattern-tip-media-no-print no-print">` +
    `<button type="button" class="kbm-kin-catalog-video hat-swirl-crown-video-tip__watch"` +
    ` data-vimeo-id="${escapeHtml(video.id)}"` +
    ` data-video-title="${escapeHtml(video.title)}"` +
    ` data-testid="hat-swirl-crown-video-watch"` +
    ` data-hat-swirl-crown-content-id="${HAT_SWIRL_CROWN_VIDEO_CONTENT_ID}"` +
    `${chaptersAttr}>${escapeHtml(HAT_SWIRL_CROWN_WATCH_LABEL)}</button>` +
    `</p>` +
    `</div>`
  );
}
