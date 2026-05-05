import { calculateNecklineShaping } from "./legoBlocks/necklineShaping";
import { calculateSlopeShaping } from "./legoBlocks/slopeShaping";

export type ShapingTimelineInputs = {
  firstShapingRow: number;
  shoulderStitchesPerSide: number;
  centerNeckBindOff: number;
  shapingWorkRows: number;
};

export type ShapingEvent = {
  kind: "bindOff" | "decrease";
  side: "left" | "right" | "center";
  edge: "outer" | "inner" | "center";
  amount: number;
};

export type RowEntry = {
  row: number;
  events: ShapingEvent[];
  stitchesL: number;
  stitchesR: number;
  netChangeL: number;
  netChangeR: number;
  isSplit: boolean;
  centerWidth: number;
  leftOuterEdge: number;
  leftInnerEdge: number;
  rightInnerEdge: number;
  rightOuterEdge: number;
};

function expandSteps(steps: { stitches: number; times: number }[]): number[] {
  const out: number[] = [];
  for (const step of steps) {
    for (let i = 0; i < step.times; i++) {
      out.push(step.stitches);
    }
  }
  return out;
}

function assertRowInvariants(row: RowEntry, expectedLeft: number, expectedRight: number): void {
  const stitchesL = row.leftInnerEdge - row.leftOuterEdge + 1;
  const stitchesR = row.rightOuterEdge - row.rightInnerEdge + 1;
  console.assert(
    stitchesL === row.stitchesL,
    `[buildTimeline] left inclusive-space invariant failed at row ${row.row}`
  );
  console.assert(
    stitchesR === row.stitchesR,
    `[buildTimeline] right inclusive-space invariant failed at row ${row.row}`
  );
  console.assert(
    row.stitchesL === expectedLeft,
    `[buildTimeline] left stitch total mismatch at row ${row.row}`
  );
  console.assert(
    row.stitchesR === expectedRight,
    `[buildTimeline] right stitch total mismatch at row ${row.row}`
  );
}

export function buildTimeline(inputs: ShapingTimelineInputs): RowEntry[] {
  const firstRow = Math.floor(inputs.firstShapingRow);
  const S = Math.round(inputs.shoulderStitchesPerSide);
  const N = Math.round(inputs.centerNeckBindOff);
  const workRows = Math.floor(inputs.shapingWorkRows);

  if (
    !Number.isFinite(firstRow) ||
    !Number.isFinite(S) ||
    !Number.isFinite(N) ||
    !Number.isFinite(workRows)
  ) {
    return [];
  }
  if (S <= 0 || N <= 0 || workRows <= 0) {
    return [];
  }

  let neckTotalPerSide = Math.min(S - 1, Math.max(0, Math.min(Math.floor(N / 2), Math.ceil(workRows / 2))));
  if (neckTotalPerSide === 0 && S > 1) {
    neckTotalPerSide = 1;
  }

  let shoulderTotalPerSide = S - neckTotalPerSide;
  if (shoulderTotalPerSide < 1) {
    shoulderTotalPerSide = Math.min(S, Math.max(1, S - 1));
    neckTotalPerSide = S - shoulderTotalPerSide;
  }

  const neckStepCount = Math.min(workRows, Math.max(1, neckTotalPerSide));
  const neckExpanded =
    neckTotalPerSide > 0 ? expandSteps(calculateNecklineShaping(neckTotalPerSide, neckStepCount)) : [];

  /**
   * Shoulder shaping binds off/decreases on every other shaping row inside the timeline
   * (machine rows firstRow+1, firstRow+3, … = 1-based odd rows within the shoulder-depth span).
   * Even-indexed spacer rows remain in the timeline with no shoulder action.
   */
  const shoulderActionSlots = Math.ceil(workRows / 2);
  const slopeRowsForShoulder =
    shoulderActionSlots > 0 ? Math.max(2, shoulderActionSlots * 2) : 2;
  const shoulderExpanded =
    shoulderTotalPerSide > 0
      ? expandSteps(calculateSlopeShaping(slopeRowsForShoulder, shoulderTotalPerSide))
      : [];

  const neckPerRow = Array(workRows).fill(0);
  for (let i = 0; i < workRows && i < neckExpanded.length; i++) {
    neckPerRow[i] = neckExpanded[i];
  }

  const shoulderPerRow = Array(workRows).fill(0);
  for (let k = 0; k < shoulderExpanded.length && 2 * k < workRows; k++) {
    shoulderPerRow[2 * k] = shoulderExpanded[k];
  }

  let leftOuterEdge = 1;
  let leftInnerEdge = S;
  let rightInnerEdge = S + N + 1;
  let rightOuterEdge = 2 * S + N;

  let leftCount = S;
  let rightCount = S;

  const rows: RowEntry[] = [];

  const centerRow: RowEntry = {
    row: firstRow,
    events: [{ kind: "bindOff", side: "center", edge: "center", amount: N }],
    stitchesL: leftCount,
    stitchesR: rightCount,
    netChangeL: 0,
    netChangeR: 0,
    isSplit: true,
    centerWidth: rightInnerEdge - leftInnerEdge - 1,
    leftOuterEdge,
    leftInnerEdge,
    rightInnerEdge,
    rightOuterEdge,
  };
  assertRowInvariants(centerRow, leftCount, rightCount);
  rows.push(centerRow);

  for (let i = 0; i < workRows; i++) {
    const neckDec = Math.max(0, neckPerRow[i] ?? 0);
    const shoulderDec = Math.max(0, shoulderPerRow[i] ?? 0);

    const events: ShapingEvent[] = [];
    if (shoulderDec > 0) {
      events.push({ kind: "decrease", side: "left", edge: "outer", amount: shoulderDec });
      events.push({ kind: "decrease", side: "right", edge: "outer", amount: shoulderDec });
      leftOuterEdge += shoulderDec;
      rightOuterEdge -= shoulderDec;
      leftCount -= shoulderDec;
      rightCount -= shoulderDec;
    }
    if (neckDec > 0) {
      events.push({ kind: "decrease", side: "left", edge: "inner", amount: neckDec });
      events.push({ kind: "decrease", side: "right", edge: "inner", amount: neckDec });
      leftInnerEdge -= neckDec;
      rightInnerEdge += neckDec;
      leftCount -= neckDec;
      rightCount -= neckDec;
    }

    leftCount = Math.max(0, leftCount);
    rightCount = Math.max(0, rightCount);

    const rowEntry: RowEntry = {
      row: firstRow + 1 + i,
      events,
      stitchesL: leftCount,
      stitchesR: rightCount,
      netChangeL: -(shoulderDec + neckDec),
      netChangeR: -(shoulderDec + neckDec),
      isSplit: true,
      centerWidth: rightInnerEdge - leftInnerEdge - 1,
      leftOuterEdge,
      leftInnerEdge,
      rightInnerEdge,
      rightOuterEdge,
    };
    assertRowInvariants(rowEntry, leftCount, rightCount);
    rows.push(rowEntry);
  }

  return rows;
}
