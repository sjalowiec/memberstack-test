/**
 * Shared plain-text wording for neckline / shoulder chart intros (online + print).
 * Kept separate from {@link neckShoulderShapingChartHtml} to avoid importing that module from
 * {@link sleevelessPatternOutput} (cycle: chart HTML already imports pattern output for bind-off formatting).
 */

import type { NeckShoulderShapingChart } from "./neckShoulderShapingChart";
import {
  isFullWidthVNeckFrontStyleChart,
  isSleevelessCardiganFrontNeckShoulderChart,
} from "./neckShoulderShapingChart";

/** Glossary id for “Scrap off” (lifeline / remove-from-bed technique). */
export const SCRAP_OFF_GLOSSARY_ID = 311;

export const ACTIVE_SHOULDER_CHART_INTRO_SENTENCE =
  "Follow the chart row by row for the active shoulder, then repeat for the second shoulder, reversing the edge landmarks.";

export const ACTIVE_SHOULDER_DIVIDE_SENTENCE =
  "Place the opposite shoulder into hold position and work one shoulder at a time.";

/** Plain tail for sleeveless full-width V-neck front chart intros (no center bind-off). */
export const ACTIVE_VNECK_CENTER_DIVIDE_TAIL =
  "divide the piece at the center. Shape each side independently with decreases along the neck edge per the chart — there is no center bind-off";

export const CARDIGAN_FRONT_NECKLINE_START_TAIL = "begin neckline shaping at the center-front edge";

export const CARDIGAN_FRONT_SHAPING_TOGETHER_SENTENCE =
  "Work the neckline shaping and shoulder shaping together following the chart below.";

export const CARDIGAN_FRONT_OPPOSITE_FRONT_SENTENCE =
  "Once this front is complete, cut yarn and work the opposite front, reversing the edge shaping.";

/** True when intro copy should use V-neck divide wording (not round-neck center scrap/bind-off). */
export function activeShoulderIntroUsesVNeckDivideCopy(chart?: NeckShoulderShapingChart): boolean {
  return chart !== undefined && isFullWidthVNeckFrontStyleChart(chart);
}

/** True when chart intro/completion should use cardigan front wording. */
export function activeShoulderIntroIsCardiganFront(args: {
  chart?: NeckShoulderShapingChart | undefined;
  isCardiganFront?: boolean | undefined;
}): boolean {
  return args.isCardiganFront === true || isSleevelessCardiganFrontNeckShoulderChart(args.chart);
}

/**
 * True when the chart intro should include center-neckline divide/setup copy (round neck center
 * scrap-off, or V-neck divide-at-center without bind-off).
 */
export function activeShoulderCenterDivideIntroApplies(
  centerBindOffStitches?: number,
  chart?: NeckShoulderShapingChart,
): boolean {
  if (activeShoulderIntroIsCardiganFront({ chart })) return true;
  if (activeShoulderIntroUsesVNeckDivideCopy(chart)) return true;
  const n = Number(centerBindOffStitches);
  return Number.isFinite(n) && n > 0;
}

function formatArmholeRcAnchoredSentence(
  localStartRcLabel: string | undefined,
  tail: string,
): string {
  const localStartLabel = String(localStartRcLabel ?? "").trim();
  const rcColon = localStartLabel.match(/^RC:(\d{1,4})$/i);
  if (rcColon) {
    const n = String(Math.max(0, parseInt(rcColon[1], 10))).padStart(3, "0");
    return `When Armhole RC reaches ${n}, ${tail}.`;
  }
  if (localStartLabel) {
    return `At ${localStartLabel}, ${tail}.`;
  }
  return `${tail.charAt(0).toUpperCase()}${tail.slice(1)}.`;
}

/**
 * Center bind-off milestone uses Armhole RC (post armhole reset). Pass `RC:078`-style labels from
 * {@link sleevelessPatternOutput} debug locals.
 */
export function formatActiveShoulderCenterNecklinePlainSentence(args: {
  localStartRcLabel?: string | undefined;
  centerBindOffStitches?: number | undefined;
}): string {
  const centerCount = Number(args.centerBindOffStitches);
  const centerCountLabel =
    Number.isFinite(centerCount) && centerCount > 0 ? String(Math.round(centerCount)) : "";
  const scrapOffTail = centerCountLabel
    ? `scrap off the center ${centerCountLabel} neckline stitches to divide the neckline`
    : "scrap off the center neckline stitches to divide the neckline";
  return formatArmholeRcAnchoredSentence(args.localStartRcLabel, scrapOffTail);
}

/** Cardigan front: neckline begins at the open center-front edge (no pullover divide language). */
export function formatActiveShoulderCardiganFrontNecklinePlainSentence(args: {
  localStartRcLabel?: string | undefined;
}): string {
  return formatArmholeRcAnchoredSentence(args.localStartRcLabel, CARDIGAN_FRONT_NECKLINE_START_TAIL);
}

/** V-neck front: divide at center and neck-edge decreases — no center bind-off. */
export function formatActiveShoulderVNeckCenterPlainSentence(args: {
  localStartRcLabel?: string | undefined;
}): string {
  return formatArmholeRcAnchoredSentence(args.localStartRcLabel, ACTIVE_VNECK_CENTER_DIVIDE_TAIL);
}

/** Plain paragraphs placed above the checklist / chart (same order as HTML intro). */
export function activeShoulderIntroPlainParagraphs(args: {
  localStartRcLabel?: string | undefined;
  centerBindOffStitches?: number | undefined;
  chart?: NeckShoulderShapingChart | undefined;
  isCardiganFront?: boolean | undefined;
}): readonly string[] {
  const isCardiganFront = activeShoulderIntroIsCardiganFront(args);

  if (isCardiganFront) {
    if (activeShoulderCenterDivideIntroApplies(args.centerBindOffStitches, args.chart)) {
      return [
        formatActiveShoulderCardiganFrontNecklinePlainSentence(args),
        CARDIGAN_FRONT_SHAPING_TOGETHER_SENTENCE,
      ];
    }
    return [CARDIGAN_FRONT_SHAPING_TOGETHER_SENTENCE];
  }

  const out: string[] = [];
  if (activeShoulderIntroUsesVNeckDivideCopy(args.chart)) {
    out.push(formatActiveShoulderVNeckCenterPlainSentence(args));
    out.push(ACTIVE_SHOULDER_DIVIDE_SENTENCE);
  } else if (activeShoulderCenterDivideIntroApplies(args.centerBindOffStitches, args.chart)) {
    out.push(formatActiveShoulderCenterNecklinePlainSentence(args));
    out.push(ACTIVE_SHOULDER_DIVIDE_SENTENCE);
  }
  out.push(ACTIVE_SHOULDER_CHART_INTRO_SENTENCE);
  return out;
}
