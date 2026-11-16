/**
 * Quick Tip for the Drop Shoulder instruction that puts the opposite side into hold.
 * Resolves Learning Library content_id 867 from `videos-public.json`.
 */
import {
  sleevelessHelpVideoFromCatalog,
  type SleevelessHelpVideoMeta,
} from "./sleevelessCatalogHelpVideo";
import type { PublicVideoRow } from "../lessonVideo";
import videosPublic from "../../data/videos-public.json";
import { buildPatternQuickTipInnerHtml } from "./patternQuickTip";
import {
  buildPatternExplainerVideoBodyHtml,
  PATTERN_TIP_MEDIA_NO_PRINT_CLASS,
} from "./patternExplainerVideoTip";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";

export { PATTERN_TIP_MEDIA_NO_PRINT_CLASS };

/** Learning Library content_id for “Hold That Needle!”. */
export const DROP_SHOULDER_HOLD_POSITION_VIDEO_CONTENT_ID = 867;

export const DROP_SHOULDER_HOLD_POSITION_VIDEO_TIP_ID = "drop-shoulder-hold-position-video";

export const DROP_SHOULDER_HOLD_POSITION_VIDEO_HEADING = "Hold position";

export const DROP_SHOULDER_HOLD_POSITION_VIDEO_COPY =
  "Watch how the hold position works before you put the opposite side into hold.";

export function resolveDropShoulderHoldPositionVideo(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): SleevelessHelpVideoMeta | null {
  return sleevelessHelpVideoFromCatalog(DROP_SHOULDER_HOLD_POSITION_VIDEO_CONTENT_ID, catalog);
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function dropShoulderHoldPositionVideoBodyHtml(
  video: SleevelessHelpVideoMeta | null = resolveDropShoulderHoldPositionVideo(),
): string {
  if (!video) return "";
  const embed = buildPatternExplainerVideoBodyHtml({
    video: {
      vimeoId: video.id,
      title: video.title,
      privacyHash: video.privacyHash,
      posterUrl: video.posterUrl,
    },
    explainerKey: "drop-shoulder-hold-position",
    classPrefix: "ds-hold-position-video",
    introHtml: `<p>${escapeHtml(DROP_SHOULDER_HOLD_POSITION_VIDEO_COPY)}</p>`,
  });
  return (
    `<div data-content-id="${DROP_SHOULDER_HOLD_POSITION_VIDEO_CONTENT_ID}" data-drop-shoulder-hold-position-video>` +
    embed +
    `</div>`
  );
}

/** Quick Tip row. Null when catalog content_id 867 cannot be resolved. */
export function dropShoulderHoldPositionVideoRow(
  video: SleevelessHelpVideoMeta | null = resolveDropShoulderHoldPositionVideo(),
): Extract<SleevelessPatternDisplayRow, { kind: "block" }> | null {
  const bodyHtml = dropShoulderHoldPositionVideoBodyHtml(video);
  if (!bodyHtml) return null;
  return {
    kind: "block",
    paragraphs: [],
    tipHtml: buildPatternQuickTipInnerHtml({
      summaryLabel: DROP_SHOULDER_HOLD_POSITION_VIDEO_HEADING,
      bodyHtml,
    }),
    tipHtmlIsFull: true,
    tipPresentation: "quick-tip",
    tipId: DROP_SHOULDER_HOLD_POSITION_VIDEO_TIP_ID,
  };
}
