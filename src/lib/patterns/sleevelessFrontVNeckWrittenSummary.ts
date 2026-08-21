/**
 * Pullover V-neck Front written-layer summaries.
 * Presentation only — uses already-calculated overlap / armhole / divide values.
 */

import {
  FRONT_VNECK_ARMHOLE_BEGINS_WHILE_VNECK_CONTINUES,
  FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST,
  type FrontArmholeNecklineOverlap,
  type FrontVNeckShapingTimingCase,
} from "./frontArmholeNecklineComposition";
import { vNeckDivideSideStartsFromLiveStitches, vNeckNeckDecreasesForSide } from "./legoBlocks/vNeckline";
import { ACTIVE_SHOULDER_PARK_NONWORKING_SIDE_SENTENCE } from "./neckShoulderActiveIntroCopy";

export const FRONT_VNECK_FIRST_SECOND_SHOULDER_SUMMARY =
  "Work First Shoulder as the active side. The Second Shoulder tab is the held side — return those stitches to the machine and work that side independently.";

function timesPhrase(n: number): string {
  return n === 1 ? "1 time" : `${n} times`;
}

function stitchNoun(n: number): string {
  return n === 1 ? "stitch" : "stitches";
}

function divideSidesPhrase(left: number, right: number): string {
  const L = Math.max(0, Math.floor(left));
  const R = Math.max(0, Math.floor(right));
  return L === R
    ? `${L} stitches on each side`
    : `${L} stitches left, ${R} stitches right`;
}

export function sleevelessPulloverVNeckDivideSummaryParagraph(args: {
  leftAtDivide: number;
  rightAtDivide: number;
}): string {
  return `Divide the Front at the center: ${divideSidesPhrase(args.leftAtDivide, args.rightAtDivide)}. ${ACTIVE_SHOULDER_PARK_NONWORKING_SIDE_SENTENCE} Work one shoulder at a time.`;
}

export function sleevelessPulloverVNeckNeckEdgeSummaryParagraph(args?: {
  leftNeckDecreases?: number;
  rightNeckDecreases?: number;
}): string {
  const L = args?.leftNeckDecreases;
  const R = args?.rightNeckDecreases;
  const countBit =
    L !== undefined && R !== undefined && L > 0 && R > 0
      ? L === R
        ? ` Each side decreases ${L} ${stitchNoun(L)} at the neck edge.`
        : ` The left side decreases ${L} ${stitchNoun(L)} and the right side decreases ${R} ${stitchNoun(R)} at the neck edge.`
      : "";
  return `Shape the V-neck at the neck (inner) edge.${countBit} Follow the row-by-row instructions below for the exact Neck decrease rows.`;
}

export function sleevelessPulloverVNeckPerSideArmholeSummaryParagraphs(args: {
  bindOffSts: number;
  remainingDecreaseSts: number;
  remainingDecreaseLocalRcs: readonly number[];
}): string[] {
  const out: string[] = [];
  const bo = Math.max(0, Math.floor(args.bindOffSts));
  const dec = Math.max(0, Math.floor(args.remainingDecreaseSts));
  if (bo > 0) {
    out.push(
      `After the divide, work each half independently. At the armhole (outside) edge of each shoulder, bind off OR hold ${bo} ${stitchNoun(bo)}.`,
    );
  }
  if (dec > 0) {
    out.push(
      `Continue armhole shaping by decreasing 1 stitch at the armhole edge every other row, ${timesPhrase(dec)}.`,
    );
    const rows = args.remainingDecreaseLocalRcs
      .filter((rc) => Number.isFinite(rc))
      .map((rc) => String(Math.max(0, Math.floor(rc))));
    if (rows.length > 0) {
      out.push(`Decrease on rows: ${rows.join(" - ")}.`);
    }
  }
  return out;
}

export type PulloverVNeckWrittenSummaryInput = {
  timing: FrontVNeckShapingTimingCase;
  overlap?: FrontArmholeNecklineOverlap | null;
  bindOffSts?: number;
  decreaseSts?: number;
  liveStitchesAtDivide?: number;
  shoulderStitches?: number;
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
 * Does not invent schedules — remaining armhole rows come from the overlap record.
 */
export function sleevelessPulloverVNeckWrittenSummaryParagraphs(
  args: PulloverVNeckWrittenSummaryInput,
): string[] {
  const sides = divideSidesFromInput(args);
  const out: string[] = [];
  if (sides) {
    out.push(
      sleevelessPulloverVNeckDivideSummaryParagraph({
        leftAtDivide: sides.left,
        rightAtDivide: sides.right,
      }),
    );
    const S = args.shoulderStitches;
    if (S !== undefined && Number.isFinite(S) && S > 0) {
      out.push(
        sleevelessPulloverVNeckNeckEdgeSummaryParagraph({
          leftNeckDecreases: vNeckNeckDecreasesForSide({
            sideStartStitches: sides.left,
            shoulderStitchesOnSide: S,
          }),
          rightNeckDecreases: vNeckNeckDecreasesForSide({
            sideStartStitches: sides.right,
            shoulderStitchesOnSide: S,
          }),
        }),
      );
    } else {
      out.push(sleevelessPulloverVNeckNeckEdgeSummaryParagraph());
    }
  } else {
    out.push(sleevelessPulloverVNeckNeckEdgeSummaryParagraph());
  }

  const bo = Math.max(0, Math.floor(args.bindOffSts ?? 0));
  if (args.timing === "before-armhole") {
    out.push(
      `When the armhole is reached, reset the row counter to 000. ${FRONT_VNECK_ARMHOLE_BEGINS_WHILE_VNECK_CONTINUES}`,
    );
  }
  if (args.timing === "with-armhole" || args.timing === "before-armhole") {
    const remaining = args.overlap
      ? args.overlap.remainingDecreaseSts
      : Math.max(0, Math.floor(args.decreaseSts ?? 0));
    const remainingRows = args.overlap ? args.overlap.remainingDecreaseLocalRcs : [];
    out.push(
      ...sleevelessPulloverVNeckPerSideArmholeSummaryParagraphs({
        bindOffSts: bo,
        remainingDecreaseSts: remaining,
        remainingDecreaseLocalRcs: remainingRows,
      }),
    );
  } else if (args.timing === "during-armhole" && args.overlap) {
    out.push(
      ...sleevelessPulloverVNeckPerSideArmholeSummaryParagraphs({
        bindOffSts: 0,
        remainingDecreaseSts: args.overlap.remainingDecreaseSts,
        remainingDecreaseLocalRcs: args.overlap.remainingDecreaseLocalRcs,
      }),
    );
  }

  out.push(FRONT_VNECK_FIRST_SECOND_SHOULDER_SUMMARY);
  out.push(FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST);
  return out.filter((p) => p.trim().length > 0);
}
