/**
 * Shared instructional video tip for shaped round **back** necklines that use the
 * divide-and-shape workflow (Drop Shoulder + Sleeveless).
 *
 * Collapsible Pattern Tip (Quick Tip) with a responsive Vimeo embed. Closed by default.
 * Embed is print-hidden via {@link PATTERN_TIP_MEDIA_NO_PRINT_CLASS}; tip text follows
 * normal pattern-tip print rules.
 *
 * Insert once, on BACK only, immediately after the begin/lifeline intro and before
 * RIGHT SIDE / first-shoulder knitting instructions.
 */
import { buildPatternQuickTipInnerHtml } from "./patternQuickTip";
import {
  buildPatternExplainerVideoBodyHtml,
  PATTERN_TIP_MEDIA_NO_PRINT_CLASS,
} from "./patternExplainerVideoTip";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";

export { PATTERN_TIP_MEDIA_NO_PRINT_CLASS };

/** Matches sleeveless `LIFELINE_BEFORE_DIVIDING_NECKLINE_PLAIN` without importing that module. */
const LIFELINE_BEFORE_DIVIDING_NECKLINE_PLAIN =
  "Optional: Add a lifeline before dividing the neckline.";

export const ROUND_BACK_NECKLINE_SHAPING_VIDEO = {
  vimeoId: "1211185343",
  title: "Shape a Round Back Neckline",
  summaryLabel: "Need help shaping the back neckline?",
  introText:
    "Watch a short demonstration of dividing the neckline and working each shoulder separately.",
} as const;

/** Stable id for the tip wrapper (`data-tip-id`) ù enables per-tip dismiss. */
export const ROUND_BACK_NECKLINE_SHAPING_VIDEO_TIP_ID =
  "round-back-neckline-shaping-video";

const BEGIN_BACK_NECKLINE_RE =
  /^Begin back neckline(?: and shoulder)? shaping\.$/i;

function stripHtmlToPlain(html: string): string {
  return String(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when a summary/intro line is the back round-neck begin sentence. */
export function isBeginBackNecklineShapingLine(line: string): boolean {
  return BEGIN_BACK_NECKLINE_RE.test(stripHtmlToPlain(line));
}

/** True when a line is the optional lifeline-before-dividing reminder. */
export function isLifelineBeforeDividingNecklineLine(line: string): boolean {
  return (
    stripHtmlToPlain(line).toLowerCase() ===
    LIFELINE_BEFORE_DIVIDING_NECKLINE_PLAIN.toLowerCase()
  );
}

/**
 * Split summary lines so the video tip can sit after begin + lifeline and before
 * first-shoulder / divide setup instructions. Returns null when the intro is absent
 * (non-qualifying neckline styles).
 */
export function splitAfterRoundBackNecklineIntro(lines: readonly string[]): {
  intro: string[];
  rest: string[];
} | null {
  if (lines.length === 0 || !isBeginBackNecklineShapingLine(lines[0]!)) {
    return null;
  }
  if (lines.length >= 2 && isLifelineBeforeDividingNecklineLine(lines[1]!)) {
    return { intro: lines.slice(0, 2), rest: lines.slice(2) };
  }
  return { intro: lines.slice(0, 1), rest: lines.slice(1) };
}

/** Trusted body markup for the expanded Quick Tip. */
export function roundBackNecklineShapingVideoBodyHtml(
  video = ROUND_BACK_NECKLINE_SHAPING_VIDEO,
): string {
  return buildPatternExplainerVideoBodyHtml({
    video: { vimeoId: video.vimeoId, title: video.title },
    explainerKey: "round-back-neckline-shaping",
    classPrefix: "round-back-neckline-video",
    introHtml: `<p>${video.introText}</p>`,
  });
}

/**
 * Collapsible Pattern Tip (Quick Tip) display row for the round back neckline video.
 * Use on BACK neckline sections only ù never on front or V-neck shaping blocks.
 */
export function roundBackNecklineShapingVideoRow(): Extract<
  SleevelessPatternDisplayRow,
  { kind: "block" }
> {
  return {
    kind: "block",
    paragraphs: [],
    tipHtml: buildPatternQuickTipInnerHtml({
      summaryLabel: ROUND_BACK_NECKLINE_SHAPING_VIDEO.summaryLabel,
      bodyHtml: roundBackNecklineShapingVideoBodyHtml(),
    }),
    tipHtmlIsFull: true,
    tipPresentation: "quick-tip",
    tipId: ROUND_BACK_NECKLINE_SHAPING_VIDEO_TIP_ID,
  };
}
