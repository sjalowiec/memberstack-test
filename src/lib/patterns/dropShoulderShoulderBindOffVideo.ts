/**
 * Single hardcoded explainer video for the Drop Shoulder pattern's shoulder
 * bind-off step. Intentionally minimal — no JSON, admin UI, or video registry.
 *
 * It reuses the site's existing collapsible Pattern Tip (Quick Tip) system, so it
 * inherits the shared show/hide behaviour: it collapses/expands like other tips and
 * follows the same global / per-tip print rules as every other pattern tip. The Vimeo
 * embed is hidden in print via {@link PATTERN_TIP_MEDIA_NO_PRINT_CLASS}; the summary
 * label and caption still print when Show Tips is on.
 *
 * The embed mirrors the responsive iframe used by `src/components/media/VimeoEmbed.astro`
 * (that Astro component can't render inside the client-side pattern renderer, so the same
 * player embed is reproduced here as a trusted HTML string).
 */
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { buildPatternQuickTipInnerHtml } from "./patternQuickTip";
import {
  buildPatternExplainerVideoBodyHtml,
  PATTERN_TIP_MEDIA_NO_PRINT_CLASS,
} from "./patternExplainerVideoTip";

export { PATTERN_TIP_MEDIA_NO_PRINT_CLASS };

export const DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO = {
  vimeoId: "1208746621",
  title: "My Favorite Bind Off",
  duration: "1:20",
  heading: "Bind-Off Refresher",
} as const;

/** Stable id for the tip wrapper (`data-tip-id`) — enables per-tip dismiss. */
export const DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO_TIP_ID =
  "drop-shoulder-shoulder-bind-off-video";

/** Trusted body markup shown inside the expanded Quick Tip (Vimeo embed + title + duration). */
export function dropShoulderShoulderBindOffVideoBodyHtml(
  video = DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO,
): string {
  return buildPatternExplainerVideoBodyHtml({
    video: {
      vimeoId: video.vimeoId,
      title: video.title,
      duration: video.duration,
    },
    explainerKey: "drop-shoulder-shoulder-bind-off",
    classPrefix: "ds-bindoff-video",
  });
}

/**
 * A collapsible Pattern Tip (Quick Tip) display row carrying the explainer video.
 * Insert immediately before the shoulder bind-off instructions in the Drop Shoulder pattern.
 */
export function dropShoulderShoulderBindOffVideoRow(): Extract<
  SleevelessPatternDisplayRow,
  { kind: "block" }
> {
  return {
    kind: "block",
    paragraphs: [],
    tipHtml: buildPatternQuickTipInnerHtml({
      summaryLabel: DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO.heading,
      bodyHtml: dropShoulderShoulderBindOffVideoBodyHtml(),
    }),
    tipHtmlIsFull: true,
    tipPresentation: "quick-tip",
    tipId: DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO_TIP_ID,
  };
}
