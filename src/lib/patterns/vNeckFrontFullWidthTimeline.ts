/**
 * Full-width (unsplit) front V-neck timeline: symmetric inner-neck decreases from the V RC through
 * the shoulder line, merged with the same outer-shoulder bind-off overlay as {@link buildTimeline}.
 * No center neckline bind-off row — reuses {@link calculateVNeckNeckEdgePlan} / {@link vNeckPlanToInnerEdgeEventsByRow}.
 */

import {
  calculateVNeckNeckEdgePlan,
  vNeckDivideSideStartsFromLiveStitches,
  vNeckNeckDecreasesForSide,
  vNeckPlanToInnerEdgeEventsByRow,
} from "./legoBlocks/vNeckline";
import type { BuildTimelineOptions, RowEntry, ShapingEvent, ShapingTimelineInputs } from "./shapingTimeline";
import { distributeTotalAcrossRows } from "./shapingTimeline";

function innerDecreaseAmountAtRc(
  eventsByRow: Map<number, ShapingEvent[]>,
  rc: number,
  side: "left" | "right"
): number {
  const evs = eventsByRow.get(rc);
  if (!evs) return 0;
  let n = 0;
  for (const e of evs) {
    if (e.kind === "decrease" && e.side === side && e.edge === "inner") n += e.amount;
  }
  return n;
}

export type VNeckFrontFullWidthTimelineResult = {
  timeline: RowEntry[];
  /** Warnings from {@link calculateVNeckNeckEdgePlan} (row span, stitch budget, etc.). */
  vNeckPlanWarnings: string[];
};

/**
 * Same RC span as round-neck front {@link buildTimeline}: `neckDepthRows` rows starting at
 * `firstShapingRow` (inclusive). Shoulder bind-offs land on the same RCs as post-center rows on the
 * round path (never on a dedicated “center only” row).
 */
export function buildVNeckFrontFullWidthTimeline(
  inputs: ShapingTimelineInputs,
  options?: BuildTimelineOptions
): VNeckFrontFullWidthTimelineResult {
  const firstRow = Math.floor(inputs.firstShapingRow);
  const S = Math.round(inputs.shoulderStitchesPerSide);
  const N = Math.round(inputs.centerNeckBindOff);
  const neckDepthRows = Math.floor(inputs.neckDepthRows);
  const B = Math.round(inputs.stitchesAfterArmhole);
  const shoulderBindoffRowsRaw = inputs.shoulderBindoffRows;
  const minFinalStitchesPerSide = Math.max(
    0,
    Math.floor(Number(options?.minFinalStitchesPerSide ?? 0))
  );

  if (
    !Number.isFinite(firstRow) ||
    !Number.isFinite(S) ||
    !Number.isFinite(N) ||
    !Number.isFinite(neckDepthRows) ||
    !Number.isFinite(B) ||
    !Number.isFinite(shoulderBindoffRowsRaw)
  ) {
    return { timeline: [], vNeckPlanWarnings: [] };
  }
  if (S <= 0 || N <= 0 || neckDepthRows <= 0 || B <= 0 || B < N) {
    return { timeline: [], vNeckPlanWarnings: [] };
  }

  const workRows = neckDepthRows - 1;
  if (workRows < 0) {
    return { timeline: [], vNeckPlanWarnings: [] };
  }

  const shoulderBandTotal = B - N;
  const { left: leftStart, right: rightStart } = vNeckDivideSideStartsFromLiveStitches(B);

  const shoulderBindoffRowsIn = Math.max(1, Math.floor(shoulderBindoffRowsRaw));
  const leftShoulderTotal = Math.floor(shoulderBandTotal / 2);
  const rightShoulderTotal = Math.ceil(shoulderBandTotal / 2);
  const leftNeckDecreases = vNeckNeckDecreasesForSide({
    sideStartStitches: leftStart,
    shoulderStitchesOnSide: leftShoulderTotal,
  });
  const rightNeckDecreases = vNeckNeckDecreasesForSide({
    sideStartStitches: rightStart,
    shoulderStitchesOnSide: rightShoulderTotal,
  });
  const schedule = options?.shoulderSchedule ?? undefined;
  const shoulderStartsAtFirstPostCenter = options?.shoulderStartsAtFirstPostCenter === true;

  const shoulderLeftPerRow = Array<number>(workRows).fill(0);
  const shoulderRightPerRow = Array<number>(workRows).fill(0);
  if (shoulderBandTotal > 0) {
    let placementRowsEff = Math.min(shoulderBindoffRowsIn, workRows);
    let leftChunks: number[];
    let rightChunks: number[];

    if (schedule && schedule.placementRows > 0 && schedule.leftChunks.length > 0) {
      if (workRows >= schedule.placementRows) {
        placementRowsEff = schedule.placementRows;
        leftChunks = [...schedule.leftChunks];
        rightChunks = [...schedule.rightChunks];
      } else {
        const shoulderActionSlots = Math.max(1, Math.ceil(placementRowsEff / 2));
        leftChunks = distributeTotalAcrossRows(leftShoulderTotal, shoulderActionSlots);
        rightChunks = distributeTotalAcrossRows(rightShoulderTotal, shoulderActionSlots);
      }
    } else if (placementRowsEff > 0) {
      const shoulderActionSlots = Math.max(1, Math.ceil(placementRowsEff / 2));
      leftChunks = distributeTotalAcrossRows(leftShoulderTotal, shoulderActionSlots);
      rightChunks = distributeTotalAcrossRows(rightShoulderTotal, shoulderActionSlots);
    } else {
      leftChunks = [];
      rightChunks = [];
    }

    if (placementRowsEff > 0 && leftChunks.length > 0) {
      const startI = shoulderStartsAtFirstPostCenter ? 0 : workRows - placementRowsEff;
      for (let k = 0; k < leftChunks.length; k++) {
        const rowIdx = startI + 2 * k;
        if (rowIdx >= workRows || rowIdx < 0) break;
        shoulderLeftPerRow[rowIdx] = leftChunks[k] ?? 0;
        shoulderRightPerRow[rowIdx] = rightChunks[k] ?? 0;
      }
    }
  }

  const firstDecreaseRow = firstRow + 1;
  const lastShapingRow = firstRow + neckDepthRows - 1;

  const vPlanLeft = calculateVNeckNeckEdgePlan({
    stitchesAfterArmhole: B,
    neckOpeningStitches: N,
    neckDecreaseStitchesPerSide: leftNeckDecreases,
    vNeckStartRow: firstDecreaseRow,
    shoulderEndRow: lastShapingRow,
    side: "left",
  });
  const vPlanRight = calculateVNeckNeckEdgePlan({
    stitchesAfterArmhole: B,
    neckOpeningStitches: N,
    neckDecreaseStitchesPerSide: rightNeckDecreases,
    vNeckStartRow: firstDecreaseRow,
    shoulderEndRow: lastShapingRow,
    side: "right",
  });
  const vNeckPlanWarnings = [...vPlanLeft.warnings, ...vPlanRight.warnings];
  const innerByRowLeft = vNeckPlanToInnerEdgeEventsByRow(vPlanLeft);
  const innerByRowRight = vNeckPlanToInnerEdgeEventsByRow(vPlanRight);

  const plannedInnerLPerRow: number[] = [];
  const plannedInnerRPerRow: number[] = [];
  for (let rowIdx = 0; rowIdx < neckDepthRows; rowIdx++) {
    const rc = firstRow + rowIdx;
    plannedInnerLPerRow.push(innerDecreaseAmountAtRc(innerByRowLeft, rc, "left"));
    plannedInnerRPerRow.push(innerDecreaseAmountAtRc(innerByRowRight, rc, "right"));
  }

  const futureInnerLAfterRow = Array<number>(neckDepthRows).fill(0);
  const futureInnerRAfterRow = Array<number>(neckDepthRows).fill(0);
  let suffixL = 0;
  let suffixR = 0;
  for (let i = neckDepthRows - 1; i >= 0; i--) {
    futureInnerLAfterRow[i] = suffixL;
    futureInnerRAfterRow[i] = suffixR;
    suffixL += plannedInnerLPerRow[i] ?? 0;
    suffixR += plannedInnerRPerRow[i] ?? 0;
  }

  let shoulderRemL = leftShoulderTotal;
  let shoulderRemR = rightShoulderTotal;
  let carryShoulderL = 0;
  let carryShoulderR = 0;

  /** 0 when B is even (halves meet at center); 1 when B is odd (explicit center stitch between halves). */
  const centerStitchGap = B % 2;

  let leftOuterEdge = 1;
  let leftInnerEdge = leftStart;
  let rightInnerEdge = leftInnerEdge + centerStitchGap + 1;
  let rightOuterEdge = rightInnerEdge + rightStart - 1;

  let leftCount = leftStart;
  let rightCount = rightStart;

  const rows: RowEntry[] = [];

  rows.push({
    row: firstRow,
    events: [],
    stitchesL: leftStart,
    stitchesR: rightStart,
    netChangeL: 0,
    netChangeR: 0,
    isSplit: true,
    centerWidth: centerStitchGap,
    leftOuterEdge,
    leftInnerEdge,
    rightInnerEdge,
    rightOuterEdge,
  });

  for (let rowIdx = 1; rowIdx < neckDepthRows; rowIdx++) {
    const rc = firstRow + rowIdx;
    const events: ShapingEvent[] = [];
    const innerNetL = plannedInnerLPerRow[rowIdx] ?? 0;
    const innerNetR = plannedInnerRPerRow[rowIdx] ?? 0;

    if (innerNetL > 0) {
      events.push({ kind: "decrease", side: "left", edge: "inner", amount: innerNetL });
      leftInnerEdge -= innerNetL;
      leftCount -= innerNetL;
    }
    if (innerNetR > 0) {
      events.push({ kind: "decrease", side: "right", edge: "inner", amount: innerNetR });
      rightInnerEdge += innerNetR;
      rightCount -= innerNetR;
    }

    let shoulderBoL = 0;
    let shoulderBoR = 0;
    const shoulderI = rowIdx - 1;
    if (shoulderI >= 0 && shoulderI < workRows) {
      const wantShoulderL = (shoulderLeftPerRow[shoulderI] ?? 0) + carryShoulderL;
      const wantShoulderR = (shoulderRightPerRow[shoulderI] ?? 0) + carryShoulderR;
      const capShoulderL = Math.min(wantShoulderL, shoulderRemL);
      const capShoulderR = Math.min(wantShoulderR, shoulderRemR);
      const protectedLeftStitches = minFinalStitchesPerSide + (futureInnerLAfterRow[rowIdx] ?? 0);
      const protectedRightStitches = minFinalStitchesPerSide + (futureInnerRAfterRow[rowIdx] ?? 0);
      const maxShoulderBoL = Math.max(0, leftCount - protectedLeftStitches);
      const maxShoulderBoR = Math.max(0, rightCount - protectedRightStitches);
      shoulderBoL = Math.min(capShoulderL, maxShoulderBoL);
      shoulderBoR = Math.min(capShoulderR, maxShoulderBoR);
      shoulderRemL -= shoulderBoL;
      shoulderRemR -= shoulderBoR;
      carryShoulderL =
        shoulderBoL < wantShoulderL && shoulderBoL === leftCount && leftCount < capShoulderL
          ? wantShoulderL - shoulderBoL
          : 0;
      carryShoulderR =
        shoulderBoR < wantShoulderR && shoulderBoR === rightCount && rightCount < capShoulderR
          ? wantShoulderR - shoulderBoR
          : 0;

      if (shoulderBoL > 0) {
        events.push({ kind: "bindOff", side: "left", edge: "outer", amount: shoulderBoL });
        leftOuterEdge += shoulderBoL;
        leftCount -= shoulderBoL;
      }
      if (shoulderBoR > 0) {
        events.push({ kind: "bindOff", side: "right", edge: "outer", amount: shoulderBoR });
        rightOuterEdge -= shoulderBoR;
        rightCount -= shoulderBoR;
      }
    }

    leftCount = Math.max(0, leftCount);
    rightCount = Math.max(0, rightCount);

    const netL = shoulderBoL + innerNetL;
    const netR = shoulderBoR + innerNetR;

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
  }

  return { timeline: rows, vNeckPlanWarnings };
}
