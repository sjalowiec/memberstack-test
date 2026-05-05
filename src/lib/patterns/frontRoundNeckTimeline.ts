/**
 * Converts {@link calculateRoundFrontNeckline} output into {@link RowEntry} timelines
 * compatible with {@link buildTimeline} geometry (chart, execution, SVG).
 */

import type { RoundFrontNecklineResult } from "./legoBlocks/roundFrontNeckline";
import type { RowEntry, ShapingEvent } from "./shapingTimeline";

export type RowEntriesFromRoundFrontArgs = {
  round: RoundFrontNecklineResult;
  necklineStitches: number;
  shoulderStitchesPerSide: number;
  startRC: number;
  /** Total neck-section rows, including the center bind-off row at {@link startRC}. */
  neckDepthRows: number;
};

/**
 * One {@link RowEntry} per RC from {@link startRC} through {@link startRC} + {@link neckDepthRows} - 1.
 * Plain rows use `events: []` and carry stitch counts forward.
 */
export function rowEntriesFromRoundFrontNecklineResult(args: RowEntriesFromRoundFrontArgs): RowEntry[] {
  const N = Math.round(args.necklineStitches);
  const S = Math.round(args.shoulderStitchesPerSide);
  const startRC = Math.floor(args.startRC);
  const neckDepthRows = Math.floor(args.neckDepthRows);
  const round = args.round;

  if (!Number.isFinite(N) || N <= 0 || !Number.isFinite(S) || S <= 0 || neckDepthRows <= 0) {
    return [];
  }

  const lastRC = startRC + neckDepthRows - 1;
  const C = round.centerBindOff;

  let leftOuterEdge = 1;
  let leftInnerEdge = S;
  let rightInnerEdge = S + N + 1;
  let rightOuterEdge = 2 * S + N;
  let leftCount = S;
  let rightCount = S;

  const rows: RowEntry[] = [];

  const steepStartRC = round.steepStartRC;
  const gradualStartRC = round.gradualStartRC;

  for (let rc = startRC; rc <= lastRC; rc++) {
    const events: ShapingEvent[] = [];
    let innerNetL = 0;
    let innerNetR = 0;

    if (rc === startRC) {
      events.push({ kind: "bindOff", side: "center", edge: "center", amount: C });
    } else if (rc >= steepStartRC && rc < steepStartRC + round.steepRows) {
      events.push({ kind: "decrease", side: "left", edge: "inner", amount: 1 });
      events.push({ kind: "decrease", side: "right", edge: "inner", amount: 1 });
      leftInnerEdge -= 1;
      leftCount -= 1;
      innerNetL += 1;
      rightInnerEdge += 1;
      rightCount -= 1;
      innerNetR += 1;
    } else if (rc >= gradualStartRC && rc < gradualStartRC + round.gradualRows) {
      const i = rc - gradualStartRC;
      const isActionRow = i % 2 === 0;
      const actionIndex = Math.floor(i / 2);

      const leftDec = isActionRow && actionIndex < round.gradualStitchesLeft ? 1 : 0;
      const rightDec = isActionRow && actionIndex < round.gradualStitchesRight ? 1 : 0;

      if (leftDec > 0) {
        events.push({ kind: "decrease", side: "left", edge: "inner", amount: leftDec });
        leftInnerEdge -= leftDec;
        leftCount -= leftDec;
        innerNetL += leftDec;
      }
      if (rightDec > 0) {
        events.push({ kind: "decrease", side: "right", edge: "inner", amount: rightDec });
        rightInnerEdge += rightDec;
        rightCount -= rightDec;
        innerNetR += rightDec;
      }
    } else if (rc > startRC) {
      // Straight / filler — every RC from end of gradual through last neck RC, plain knitting
    }

    leftCount = Math.max(0, leftCount);
    rightCount = Math.max(0, rightCount);

    const netL = innerNetL;
    const netR = innerNetR;

    rows.push({
      row: rc,
      events,
      stitchesL: leftCount,
      stitchesR: rightCount,
      netChangeL: -netL,
      netChangeR: -netR,
      isSplit: true,
      centerWidth: rightInnerEdge - leftInnerEdge - 1,
      leftOuterEdge,
      leftInnerEdge,
      rightInnerEdge,
      rightOuterEdge,
    });

    if (rc === startRC) {
      if (C < N) {
        const gapAfter = N - C;
        rightInnerEdge = leftInnerEdge + gapAfter + 1;
        rightOuterEdge = 2 * S + N - C;
      } else {
        rightInnerEdge = leftInnerEdge + 1;
        rightOuterEdge = 2 * S;
      }
    }
  }

  return rows;
}
