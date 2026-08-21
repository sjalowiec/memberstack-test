/**
 * Pullover V-neck Front written-layer summaries.
 * Presentation only — uses already-calculated overlap / armhole / divide values.
 */

import {
  FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST,
  type FrontArmholeNecklineOverlap,
  type FrontVNeckShapingTimingCase,
} from "./frontArmholeNecklineComposition";
import { vNeckDivideSideStartsFromLiveStitches } from "./legoBlocks/vNeckline";

/** True when generated armhole events remain at or after the V-neck divide. */
export function pulloverVNeckArmholeShapingRemainsAfterDivide(
  overlap?: FrontArmholeNecklineOverlap | null,
): boolean {
  if (!overlap) return false;
  if (overlap.remainingDecreaseSts > 0) return true;
  if (overlap.remainingDecreaseLocalRcs.length > 0) return true;
  return overlap.lastArmholeGarmentRc >= overlap.divideGarmentRc;
}

export const FRONT_VNECK_SIMULTANEOUS_TOGETHER =
  "You will be shaping the V-neck and armhole at the same time. Work the V-neck shaping at the inside edge and the armhole shaping at the outside edge.";

export const FRONT_VNECK_SIMULTANEOUS_FROM_THIS_POINT =
  "From this point, you will be shaping the V-neck and armhole at the same time. Work the V-neck shaping at the inside edge and the armhole shaping at the outside edge.";

export const FRONT_VNECK_SIMULTANEOUS_ARMHOLE_JOINS =
  "From this point, you will be shaping the armhole and V-neck at the same time. Work the armhole shaping at the outside edge and the V-neck shaping at the inside edge.";

export const FRONT_VNECK_HANDOFF_ARMHOLE_JOINS = "Begin armhole shaping. Continue V-neck shaping.";

function timesPhrase(n: number): string {
  return n === 1 ? "1 time" : `${n} times`;
}

function stitchNoun(n: number): string {
  return n === 1 ? "stitch" : "stitches";
}

function decreaseRowsPhrase(rcs: readonly number[]): string {
  return rcs
    .filter((rc) => Number.isFinite(rc))
    .map((rc) => String(Math.max(0, Math.floor(rc))))
    .join(", ");
}

function divideSidesPhrase(left: number, right: number): string {
  const L = Math.max(0, Math.floor(left));
  const R = Math.max(0, Math.floor(right));
  return L === R ? `${L} stitches each side` : `${L} stitches left, ${R} stitches right`;
}

export function sleevelessPulloverVNeckDivideSummaryParagraph(args: {
  leftAtDivide: number;
  rightAtDivide: number;
}): string {
  return `Divide the Front at center: ${divideSidesPhrase(args.leftAtDivide, args.rightAtDivide)}. Place one side on hold and work one shoulder at a time.`;
}

export function sleevelessPulloverVNeckCompactArmholeSummaryParagraph(args: {
  bindOffSts: number;
  remainingDecreaseSts: number;
  remainingDecreaseLocalRcs: readonly number[];
  remainingOnly?: boolean;
}): string | undefined {
  const bo = Math.max(0, Math.floor(args.bindOffSts));
  const dec = Math.max(0, Math.floor(args.remainingDecreaseSts));
  const rows = decreaseRowsPhrase(args.remainingDecreaseLocalRcs);
  if (args.remainingOnly) {
    if (dec <= 0) return undefined;
    const more = dec === 1 ? "1 more time" : `${dec} more times`;
    return rows
      ? `Continue the armhole shaping by decreasing 1 stitch at the armhole edge every other row, ${more}, on rows ${rows}.`
      : `Continue the armhole shaping by decreasing 1 stitch at the armhole edge every other row, ${more}.`;
  }
  if (bo > 0 && dec > 0) {
    return rows
      ? `At the armhole edge, bind off or hold ${bo} ${stitchNoun(bo)}, then decrease 1 stitch every other row, ${timesPhrase(dec)}, on rows ${rows}.`
      : `At the armhole edge, bind off or hold ${bo} ${stitchNoun(bo)}, then decrease 1 stitch every other row, ${timesPhrase(dec)}.`;
  }
  if (bo > 0) {
    return `At the armhole edge, bind off or hold ${bo} ${stitchNoun(bo)}.`;
  }
  if (dec > 0) {
    return rows
      ? `Decrease 1 stitch every other row, ${timesPhrase(dec)}, on rows ${rows}.`
      : `Decrease 1 stitch every other row, ${timesPhrase(dec)}.`;
  }
  return undefined;
}

export type PulloverVNeckWrittenSummaryInput = {
  timing: FrontVNeckShapingTimingCase;
  overlap?: FrontArmholeNecklineOverlap | null;
  bindOffSts?: number;
  decreaseSts?: number;
  liveStitchesAtDivide?: number;
  /** `vneck-start` is the Begin V-neck block; `armhole-join` is Case 4 when the armhole begins. */
  phase?: "vneck-start" | "armhole-join";
};

function divideSidesFromInput(args: PulloverVNeckWrittenSummaryInput): {
  left: number;
  right: number;
} | null {
  if (args.overlap) {
    return { left: args.overlap.leftAtDivide, right: args.overlap.rightAtDivide };
  }
  if (args.liveStitchesAtDivide !== undefined && Number.isFinite(args.liveStitchesAtDivide)) {
    return vNeckDivideSideStartsFromLiveStitches(args.liveStitchesAtDivide);
  }
  return null;
}

/**
 * Written shaping summary after the RC → action begin line.
 * Simultaneous-shaping copy is emitted only when remaining armhole events exist.
 */
export function sleevelessPulloverVNeckWrittenSummaryParagraphs(
  args: PulloverVNeckWrittenSummaryInput,
): string[] {
  const phase = args.phase ?? "vneck-start";
  const remains = pulloverVNeckArmholeShapingRemainsAfterDivide(args.overlap);
  const bo = Math.max(0, Math.floor(args.bindOffSts ?? 0));
  const out: string[] = [];

  if (phase === "armhole-join") {
    if (remains) out.push(FRONT_VNECK_SIMULTANEOUS_ARMHOLE_JOINS);
    const remaining = args.overlap
      ? args.overlap.remainingDecreaseSts
      : Math.max(0, Math.floor(args.decreaseSts ?? 0));
    const remainingRows = args.overlap ? args.overlap.remainingDecreaseLocalRcs : [];
    const armhole = sleevelessPulloverVNeckCompactArmholeSummaryParagraph({
      bindOffSts: bo,
      remainingDecreaseSts: remaining,
      remainingDecreaseLocalRcs: remainingRows,
    });
    if (armhole) out.push(armhole);
    return out.filter((p) => p.trim().length > 0);
  }

  if (args.timing === "with-armhole" && remains) {
    out.push(FRONT_VNECK_SIMULTANEOUS_TOGETHER);
  } else if (args.timing === "during-armhole" && remains) {
    out.push(FRONT_VNECK_SIMULTANEOUS_FROM_THIS_POINT);
  }

  const sides = divideSidesFromInput(args);
  if (sides) {
    out.push(
      sleevelessPulloverVNeckDivideSummaryParagraph({
        leftAtDivide: sides.left,
        rightAtDivide: sides.right,
      }),
    );
  }

  if (args.timing === "with-armhole") {
    const remaining = args.overlap
      ? args.overlap.remainingDecreaseSts
      : Math.max(0, Math.floor(args.decreaseSts ?? 0));
    const remainingRows = args.overlap ? args.overlap.remainingDecreaseLocalRcs : [];
    const armhole = sleevelessPulloverVNeckCompactArmholeSummaryParagraph({
      bindOffSts: bo,
      remainingDecreaseSts: remaining,
      remainingDecreaseLocalRcs: remainingRows,
    });
    if (armhole) out.push(armhole);
  } else if (args.timing === "during-armhole" && args.overlap && remains) {
    const armhole = sleevelessPulloverVNeckCompactArmholeSummaryParagraph({
      bindOffSts: 0,
      remainingDecreaseSts: args.overlap.remainingDecreaseSts,
      remainingDecreaseLocalRcs: args.overlap.remainingDecreaseLocalRcs,
      remainingOnly: true,
    });
    if (armhole) out.push(armhole);
  }

  out.push(FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST);
  return out.filter((p) => p.trim().length > 0);
}
