/**
 * Contextual Quick Tip for Drop Shoulder pullover **round** front necklines.
 *
 * Resolves Learning Library content_id 2212 (“Shallow Neckline, No Shoulder Shaping”)
 * from `videos-public.json` — title, Vimeo id, privacy hash, and poster come from
 * the catalog record. Do not hard-code the Vimeo id here.
 *
 * Shown only for the construction the video demonstrates: a full-width pullover
 * front, center bind-off/hold, neck-edge decreases, and straight shoulders.
 * Not shown for V-neck, cardigan half-fronts, or the back (back already has its
 * own divide-and-shape helper).
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

/** Learning Library content_id for “Shallow Neckline, No Shoulder Shaping”. */
export const DROP_SHOULDER_ROUND_NECKLINE_VIDEO_CONTENT_ID = 2212;

export const DROP_SHOULDER_ROUND_NECKLINE_VIDEO_TIP_ID =
  "drop-shoulder-round-neckline-video";

export const DROP_SHOULDER_ROUND_NECKLINE_VIDEO_HEADING =
  "Need help shaping the neckline?";

export const DROP_SHOULDER_ROUND_NECKLINE_VIDEO_COPY =
  "Watch this quick demonstration of the neckline shaping process before you begin.";

export function resolveDropShoulderRoundNecklineVideo(
  catalog: PublicVideoRow[] = videosPublic as PublicVideoRow[],
): SleevelessHelpVideoMeta | null {
  return sleevelessHelpVideoFromCatalog(
    DROP_SHOULDER_ROUND_NECKLINE_VIDEO_CONTENT_ID,
    catalog,
  );
}

/**
 * True when the generated Drop Shoulder front uses the same round-neckline,
 * no-shoulder-shaping process shown in catalog video 2212.
 */
export function dropShoulderRoundNecklineVideoApplies(args: {
  isVNeck: boolean;
  isCardigan: boolean;
  hasRoundNeckShaping: boolean;
}): boolean {
  return !args.isVNeck && !args.isCardigan && args.hasRoundNeckShaping;
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Trusted Quick Tip body: intro copy + catalog-resolved Vimeo embed. */
export function dropShoulderRoundNecklineVideoBodyHtml(
  video: SleevelessHelpVideoMeta | null = resolveDropShoulderRoundNecklineVideo(),
): string {
  if (!video) return "";
  const embed = buildPatternExplainerVideoBodyHtml({
    video: {
      vimeoId: video.id,
      title: video.title,
      privacyHash: video.privacyHash,
      posterUrl: video.posterUrl,
    },
    explainerKey: "drop-shoulder-round-neckline",
    classPrefix: "ds-round-neckline-video",
    introHtml: `<p>${escapeHtml(DROP_SHOULDER_ROUND_NECKLINE_VIDEO_COPY)}</p>`,
  });
  return (
    `<div data-content-id="${DROP_SHOULDER_ROUND_NECKLINE_VIDEO_CONTENT_ID}" data-drop-shoulder-round-neckline-video>` +
    embed +
    `</div>`
  );
}

/**
 * Collapsible Pattern Tip (Quick Tip) display row for catalog video 2212.
 * Returns null when the catalog row cannot be resolved (no dead embed).
 */
export function dropShoulderRoundNecklineVideoRow(
  video: SleevelessHelpVideoMeta | null = resolveDropShoulderRoundNecklineVideo(),
): Extract<SleevelessPatternDisplayRow, { kind: "block" }> | null {
  const bodyHtml = dropShoulderRoundNecklineVideoBodyHtml(video);
  if (!bodyHtml) return null;
  return {
    kind: "block",
    paragraphs: [],
    tipHtml: buildPatternQuickTipInnerHtml({
      summaryLabel: DROP_SHOULDER_ROUND_NECKLINE_VIDEO_HEADING,
      bodyHtml,
    }),
    tipHtmlIsFull: true,
    tipPresentation: "quick-tip",
    tipId: DROP_SHOULDER_ROUND_NECKLINE_VIDEO_TIP_ID,
  };
}
