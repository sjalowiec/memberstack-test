/**
 * Shared plain-text wording for neckline / shoulder chart intros (online + print).
 * Kept separate from {@link neckShoulderShapingChartHtml} to avoid importing that module from
 * {@link sleevelessPatternOutput} (cycle: chart HTML already imports pattern output for bind-off formatting).
 */

import {
  resolveFrontVNeckRowCounterDisplayPolicy,
  type FrontArmholeNecklineOverlap,
  type FrontVNeckShapingTimingCase,
} from "./frontArmholeNecklineComposition";
import type { NeckShoulderShapingChart } from "./neckShoulderShapingChart";
import {
  isFullWidthVNeckFrontStyleChart,
  isSleevelessCardiganFrontNeckShoulderChart,
} from "./neckShoulderShapingChart";

/** Glossary id for “Scrap off” (lifeline / remove-from-bed technique). */
export const SCRAP_OFF_GLOSSARY_ID = 311;

/** Glossary id for “bind off”. */
export const BIND_OFF_GLOSSARY_ID = 804;

/** Phrase given bold emphasis in HTML renderings of {@link ACTIVE_SHOULDER_CHART_INTRO_SENTENCE}. */
export const ACTIVE_SHOULDER_REVERSE_SHAPING_EMPHASIS =
  "reversing the neckline and shoulder shaping";

/**
 * Drop-shoulder variant of {@link ACTIVE_SHOULDER_REVERSE_SHAPING_EMPHASIS}. Drop-shoulder shoulders
 * are worked straight (no shoulder shaping), so only the neckline shaping is reversed.
 */
export const ACTIVE_SHOULDER_REVERSE_NECKLINE_ONLY_EMPHASIS = "reversing the neckline shaping";

/**
 * Former chart-intro reminder for drop-shoulder straight shoulders (now stated once in back
 * written instructions). Kept for tests and copy reference.
 */
export const DROP_SHOULDER_NO_SHOULDER_SHAPING_NOTE =
  "Drop-shoulder shoulders are worked straight. There is no shoulder shaping in this pattern.";

export const ACTIVE_SHOULDER_CHART_INTRO_SENTENCE =
  `Follow the checklist row by row for the first shoulder. Then return the held stitches to the machine and work the second shoulder, ${ACTIVE_SHOULDER_REVERSE_SHAPING_EMPHASIS} so that neckline shaping remains on the neck edge and shoulder shaping remains on the shoulder edge.`;

/** Drop-shoulder variant of {@link ACTIVE_SHOULDER_CHART_INTRO_SENTENCE} (straight shoulders, neckline shaping only). */
export const ACTIVE_SHOULDER_CHART_INTRO_SENTENCE_NECKLINE_ONLY =
  `Follow the checklist row by row for the first shoulder. Then return the held stitches to the machine and work the second shoulder, ${ACTIVE_SHOULDER_REVERSE_NECKLINE_ONLY_EMPHASIS} so it remains on the neck edge.`;

/**
 * Emphasis phrase for the reverse-shaping instruction. Sleeveless reverses neckline + shoulder
 * shaping; drop shoulder (straight shoulders) reverses only the neckline shaping.
 */
export function activeShoulderReverseShapingEmphasis(shouldersShaped = true): string {
  return shouldersShaped
    ? ACTIVE_SHOULDER_REVERSE_SHAPING_EMPHASIS
    : ACTIVE_SHOULDER_REVERSE_NECKLINE_ONLY_EMPHASIS;
}

/** Chart intro sentence; drop shoulder (straight shoulders) reverses only the neckline shaping. */
export function activeShoulderChartIntroSentence(shouldersShaped = true): string {
  return shouldersShaped
    ? ACTIVE_SHOULDER_CHART_INTRO_SENTENCE
    : ACTIVE_SHOULDER_CHART_INTRO_SENTENCE_NECKLINE_ONLY;
}

/** Park the non-working shoulder before shaping one side at a time (online + print). */
export const ACTIVE_SHOULDER_PARK_NONWORKING_SIDE_SENTENCE =
  "Place the remaining stitches on hold, or transfer them to scrap yarn if preferred.";

export const ACTIVE_SHOULDER_DIVIDE_SENTENCE =
  `${ACTIVE_SHOULDER_PARK_NONWORKING_SIDE_SENTENCE} work one shoulder at a time.`;

/** Plain tail for sleeveless full-width V-neck front chart intros (no center bind-off). */
export const ACTIVE_VNECK_CENTER_DIVIDE_TAIL =
  "divide the piece at the center. Shape each side independently with decreases along the neck edge per the chart — there is no center bind-off";

export const CARDIGAN_FRONT_NECKLINE_START_TAIL = "begin neckline shaping at the center-front edge";

/** Cardigan V-neck that already owns the garment row counter (Case 4 / before-armhole). */
export const CARDIGAN_FRONT_VNECK_START_TAIL = "begin V-neck shaping at the center-front edge";

export const CARDIGAN_FRONT_SHAPING_TOGETHER_SENTENCE =
  "Work the neckline shaping and shoulder shaping together following the chart below.";

/** Drop-shoulder cardigan front chart intro (straight shoulders — neckline shaping only). */
export const CARDIGAN_FRONT_NECKLINE_ONLY_SENTENCE =
  "Work the neckline shaping following the chart below.";

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

function cardiganFrontUsesContinuousGarmentRc(
  chart?: NeckShoulderShapingChart,
  overlapFallback?: FrontArmholeNecklineOverlap | null,
  timingCase?: FrontVNeckShapingTimingCase,
): boolean {
  if (timingCase === "before-armhole") return true;
  return (
    resolveFrontVNeckRowCounterDisplayPolicy(
      chart?.frontVNeckArmholeComposition ?? overlapFallback ?? undefined,
    ) === "continuous-garment-rc"
  );
}

function formatArmholeRcAnchoredSentence(
  localStartRcLabel: string | undefined,
  tail: string,
  options?: { atRcPrefix?: boolean },
): string {
  const localStartLabel = String(localStartRcLabel ?? "").trim();
  const rcColon = localStartLabel.match(/^RC:\s*(\d{1,4})$/i);
  if (rcColon) {
    const n = String(Math.max(0, parseInt(rcColon[1], 10))).padStart(3, "0");
    if (options?.atRcPrefix) {
      return `At RC ${n}, ${tail}.`;
    }
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
  const divideTail = centerCountLabel
    ? `divide the neckline by removing the center ${centerCountLabel} neckline stitches from work. Scrap off, bind off, or place these stitches on hold according to your preferred method`
    : "divide the neckline by removing the center neckline stitches from work. Scrap off, bind off, or place these stitches on hold according to your preferred method";
  return formatArmholeRcAnchoredSentence(args.localStartRcLabel, divideTail);
}

/** Cardigan front: neckline begins at the open center-front edge (no pullover divide language). */
export function formatActiveShoulderCardiganFrontNecklinePlainSentence(args: {
  localStartRcLabel?: string | undefined;
  chart?: NeckShoulderShapingChart | undefined;
  frontArmholeNecklineOverlap?: FrontArmholeNecklineOverlap | null;
  frontVNeckShapingTimingCase?: FrontVNeckShapingTimingCase;
}): string {
  const continuous = cardiganFrontUsesContinuousGarmentRc(
    args.chart,
    args.frontArmholeNecklineOverlap,
    args.frontVNeckShapingTimingCase,
  );
  return formatArmholeRcAnchoredSentence(
    args.localStartRcLabel,
    continuous ? CARDIGAN_FRONT_VNECK_START_TAIL : CARDIGAN_FRONT_NECKLINE_START_TAIL,
    { atRcPrefix: continuous },
  );
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
