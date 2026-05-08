import { calculateRoundNecklineShaping } from "./legoBlocks/roundNeckline";

export type NeckProfile = "back" | "front";

export type ShapingTimelineInputs = {
  firstShapingRow: number;
  /**
   * Final shoulder width per side (target after inner neckline shaping removes neck-edge stitches).
   */
  shoulderStitchesPerSide: number;
  /** Total neckline opening width N (full neck width in stitches). */
  centerNeckBindOff: number;
  /**
   * Total RC rows for this neckline/shoulder section, including the center bind-off row.
   * Post-center shaping rows = neckDepthRows − 1 (must match piece neck-depth budget).
   */
  neckDepthRows: number;
  /** Caller hints front vs back piece (same inner-neck math for both; RC span differs via `neckDepthRows` / `firstShapingRow`). */
  neckProfile: NeckProfile;
  /**
   * B — stitch count across the piece after armhole shaping (`stitchesAfterArmhole`).
   * With center bind-off C, each side starts with shoulder sts + neck-edge sts:
   * left/right ≈ floor/ceil((B−N)/2) + floor/ceil((N−C)/2), and left + (N−C) + right = B−C.
   */
  stitchesAfterArmhole: number;
  /**
   * Vertical span for shoulder bind-offs (typically 1" at row gauge).
   * Bind-offs overlay only the last min(shoulderBindoffRows, workRows) post-center rows.
   */
  shoulderBindoffRows: number;
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

/**
 * Canonical outer-shoulder bind-off chunks (per action row) + placement span from the **front** neck
 * schedule. Apply to both front and back timelines so armhole columns and SVG shorthand match.
 */
export type ShoulderBindoffSchedule = {
  leftChunks: number[];
  rightChunks: number[];
  /** Rows at the end of the post-center window where shoulder actions occur (matches buildTimeline tail overlay). */
  placementRows: number;
};

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

/** Spread whole stitches across row slots; remainder stitches go to the earliest rows. */
export function distributeTotalAcrossRows(total: number, rows: number): number[] {
  const r = Math.max(0, Math.floor(rows));
  if (r === 0) return [];
  const t = Math.max(0, Math.round(total));
  if (t === 0) return Array(r).fill(0);
  const base = Math.floor(t / r);
  const rem = t % r;
  const out: number[] = [];
  for (let i = 0; i < r; i++) {
    out.push(base + (i < rem ? 1 : 0));
  }
  return out;
}

/** Inner-neck events for one post-center row index (thirds-based stair bind-offs + singles every other row). */
function backInnerNeckRow(
  i: number,
  neckPlan: ReturnType<typeof calculateRoundNecklineShaping>,
  stairRowCount: number,
  neckInnerRowSpan: number
): { events: ShapingEvent[]; innerNetL: number; innerNetR: number } {
  const events: ShapingEvent[] = [];
  let innerNetL = 0;
  let innerNetR = 0;
  if (i >= neckInnerRowSpan) {
    return { events, innerNetL, innerNetR };
  }
  if (i < stairRowCount) {
    const leftStair = neckPlan.left.stairSteps;
    const rightStair = neckPlan.right.stairSteps;
    const lb = leftStair[i] ?? 0;
    const rb = rightStair[i] ?? 0;
    if (lb > 0) {
      events.push({ kind: "bindOff", side: "left", edge: "inner", amount: lb });
      innerNetL += lb;
    }
    if (rb > 0) {
      events.push({ kind: "bindOff", side: "right", edge: "inner", amount: rb });
      innerNetR += rb;
    }
    return { events, innerNetL, innerNetR };
  }
  const j = i - stairRowCount;
  if (j % 2 === 0) {
    const si = j / 2;
    if (si < neckPlan.left.singleDecreaseCount) {
      events.push({ kind: "decrease", side: "left", edge: "inner", amount: 1 });
      innerNetL += 1;
    }
    if (si < neckPlan.right.singleDecreaseCount) {
      events.push({ kind: "decrease", side: "right", edge: "inner", amount: 1 });
      innerNetR += 1;
    }
  }
  return { events, innerNetL, innerNetR };
}

/**
 * Compute outer-shoulder bind-off chunks exactly as {@link buildTimeline} would for these inputs.
 * Call with **front** pattern numbers so back + front can share one shoulder sequence.
 */
export function computeShoulderBindoffSchedule(inputs: ShapingTimelineInputs): ShoulderBindoffSchedule | null {
  const neckDepthRows = Math.floor(inputs.neckDepthRows);
  const workRows = neckDepthRows - 1;
  const B = Math.round(inputs.stitchesAfterArmhole);
  const N = Math.round(inputs.centerNeckBindOff);
  const shoulderBindoffRowsRaw = inputs.shoulderBindoffRows;

  if (
    !Number.isFinite(neckDepthRows) ||
    !Number.isFinite(workRows) ||
    workRows < 0 ||
    !Number.isFinite(B) ||
    !Number.isFinite(N) ||
    !Number.isFinite(shoulderBindoffRowsRaw)
  ) {
    return null;
  }
  const shoulderBandTotal = B - N;
  if (shoulderBandTotal <= 0) return null;

  const leftShoulderTotal = Math.floor(shoulderBandTotal / 2);
  const rightShoulderTotal = Math.ceil(shoulderBandTotal / 2);
  const shoulderBindoffRowsIn = Math.max(1, Math.floor(shoulderBindoffRowsRaw));
  const placementRows = Math.min(shoulderBindoffRowsIn, workRows);
  const shoulderActionSlots = Math.max(1, Math.ceil(placementRows / 2));
  const leftChunks = distributeTotalAcrossRows(leftShoulderTotal, shoulderActionSlots);
  const rightChunks = distributeTotalAcrossRows(rightShoulderTotal, shoulderActionSlots);
  return { leftChunks, rightChunks, placementRows };
}

export type BuildTimelineOptions = {
  /** When set (typically from {@link computeShoulderBindoffSchedule} on front inputs), outer shoulder amounts match that schedule instead of being recomputed from this piece's row budget. */
  shoulderSchedule?: ShoulderBindoffSchedule | null;
  /**
   * Place outer-shoulder shaping from the first post-center row onward (row-by-row cadence still
   * alternates action/return rows). This is used when armhole depth must end exactly at the first
   * shoulder shaping row.
   */
  shoulderStartsAtFirstPostCenter?: boolean;
  /**
   * Preserve this many stitches per side after shoulder scheduling.
   * Used to keep front/back final shoulder remainder aligned unless intentionally overridden.
   */
  minFinalStitchesPerSide?: number;
};

/**
 * Unified neckline + shoulder scheduler: one row budget ({@link ShapingTimelineInputs.neckDepthRows}),
 * inner-neck and outer-shoulder actions may occur on the same RC.
 */
export function buildTimeline(inputs: ShapingTimelineInputs, options?: BuildTimelineOptions): RowEntry[] {
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
    return [];
  }
  if (S <= 0 || N <= 0 || neckDepthRows <= 0 || B <= 0) {
    return [];
  }
  if (B < N) {
    return [];
  }

  const workRows = neckDepthRows - 1;
  if (workRows < 0) {
    return [];
  }

  /** Thirds-based round neck (stairs + singles) — same inner-neck plan for back and front charts; RC span differs via {@link neckDepthRows}. */
  const neckPlan = calculateRoundNecklineShaping({ necklineStitches: N });
  const centerBindOffAmount = neckPlan.centerBindOff;

  const leftStair = neckPlan.left.stairSteps;
  const rightStair = neckPlan.right.stairSteps;
  const stairRowCount = Math.max(leftStair.length, rightStair.length);
  const maxSingles = Math.max(neckPlan.left.singleDecreaseCount, neckPlan.right.singleDecreaseCount);
  const singlesPhaseSpanRows = maxSingles > 0 ? 2 * maxSingles - 1 : 0;
  const neckInnerRowSpan = stairRowCount + singlesPhaseSpanRows;

  const C = centerBindOffAmount;
  const shoulderBandTotal = B - N;
  const neckOpeningRemainingAfterBo = N - C;
  const leftStart =
    Math.floor(shoulderBandTotal / 2) + Math.floor(neckOpeningRemainingAfterBo / 2);
  const rightStart =
    Math.ceil(shoulderBandTotal / 2) + Math.ceil(neckOpeningRemainingAfterBo / 2);

  const shoulderBindoffRowsIn = Math.max(1, Math.floor(shoulderBindoffRowsRaw));
  const leftShoulderTotal = Math.floor(shoulderBandTotal / 2);
  const rightShoulderTotal = Math.ceil(shoulderBandTotal / 2);
  const schedule = options?.shoulderSchedule ?? undefined;
  const shoulderStartsAtFirstPostCenter = options?.shoulderStartsAtFirstPostCenter === true;

  const shoulderLeftPerRow = Array(workRows).fill(0);
  const shoulderRightPerRow = Array(workRows).fill(0);
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
        /** Short neck budget vs canonical front: preserve stitch totals, allow chunk pattern to compress. */
        const shoulderActionSlots = Math.max(1, Math.ceil(placementRowsEff / 2));
        leftChunks = distributeTotalAcrossRows(leftShoulderTotal, shoulderActionSlots);
        rightChunks = distributeTotalAcrossRows(rightShoulderTotal, shoulderActionSlots);
      }
    } else if (placementRowsEff > 0) {
      /** Shoulder bind-offs on alternating rows only (action / return / action …), same rhythm as inner-neck singles. */
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

  let shoulderRemL = leftShoulderTotal;
  let shoulderRemR = rightShoulderTotal;
  let carryShoulderL = 0;
  let carryShoulderR = 0;

  let leftOuterEdge = 1;
  let leftInnerEdge = leftStart;
  let rightInnerEdge = leftInnerEdge + N + 1;
  let rightOuterEdge = rightInnerEdge + rightStart - 1;

  let leftCount = leftStart;
  let rightCount = rightStart;

  const rows: RowEntry[] = [];
  const plannedInnerLPerRow: number[] = [];
  const plannedInnerRPerRow: number[] = [];
  for (let i = 0; i < workRows; i++) {
    const planned = backInnerNeckRow(i, neckPlan, stairRowCount, neckInnerRowSpan);
    plannedInnerLPerRow.push(Math.max(0, planned.innerNetL));
    plannedInnerRPerRow.push(Math.max(0, planned.innerNetR));
  }
  const futureInnerLAfterRow = Array(workRows).fill(0);
  const futureInnerRAfterRow = Array(workRows).fill(0);
  let suffixL = 0;
  let suffixR = 0;
  for (let i = workRows - 1; i >= 0; i--) {
    futureInnerLAfterRow[i] = suffixL;
    futureInnerRAfterRow[i] = suffixR;
    suffixL += plannedInnerLPerRow[i] ?? 0;
    suffixR += plannedInnerRPerRow[i] ?? 0;
  }

  const centerRow: RowEntry = {
    row: firstRow,
    events: [{ kind: "bindOff", side: "center", edge: "center", amount: centerBindOffAmount }],
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

  if (centerBindOffAmount < N) {
    const gapAfter = N - centerBindOffAmount;
    rightInnerEdge = leftInnerEdge + gapAfter + 1;
    rightOuterEdge = rightInnerEdge + rightStart - 1;
  } else {
    rightInnerEdge = leftInnerEdge + 1;
    rightOuterEdge = rightInnerEdge + rightStart - 1;
  }

  for (let i = 0; i < workRows; i++) {
    const rc = firstRow + 1 + i;
    const events: ShapingEvent[] = [];
    let shoulderBoL = 0;
    let shoulderBoR = 0;
    let innerNetL = 0;
    let innerNetR = 0;

    const inner = backInnerNeckRow(i, neckPlan, stairRowCount, neckInnerRowSpan);
    events.push(...inner.events);
    innerNetL = inner.innerNetL;
    innerNetR = inner.innerNetR;
    if (innerNetL > 0) {
      const lb = neckPlan.left.stairSteps[i] ?? 0;
      if (i < stairRowCount && lb > 0) {
        leftInnerEdge -= lb;
        leftCount -= lb;
      } else if (i >= stairRowCount) {
        leftInnerEdge -= innerNetL;
        leftCount -= innerNetL;
      }
    }
    if (innerNetR > 0) {
      const rb = neckPlan.right.stairSteps[i] ?? 0;
      if (i < stairRowCount && rb > 0) {
        rightInnerEdge += rb;
        rightCount -= rb;
      } else if (i >= stairRowCount) {
        rightInnerEdge += innerNetR;
        rightCount -= innerNetR;
      }
    }

    const wantShoulderL = (shoulderLeftPerRow[i] ?? 0) + carryShoulderL;
    const wantShoulderR = (shoulderRightPerRow[i] ?? 0) + carryShoulderR;
    const capShoulderL = Math.min(wantShoulderL, shoulderRemL);
    const capShoulderR = Math.min(wantShoulderR, shoulderRemR);
    const protectedLeftStitches = minFinalStitchesPerSide + (futureInnerLAfterRow[i] ?? 0);
    const protectedRightStitches = minFinalStitchesPerSide + (futureInnerRAfterRow[i] ?? 0);
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

    leftCount = Math.max(0, leftCount);
    rightCount = Math.max(0, rightCount);

    const netL = shoulderBoL + innerNetL;
    const netR = shoulderBoR + innerNetR;

    const rowEntry: RowEntry = {
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
    };
    assertRowInvariants(rowEntry, leftCount, rightCount);
    rows.push(rowEntry);
  }

  return rows;
}

/**
 * Post-center rows used by the **back** round-neck plan (stair bind-offs + singles phase).
 * Shoulder shaping may also occur on these same row indices when using {@link buildTimeline}.
 */
export function neckInnerPostCenterRowSpan(necklineStitches: number): number {
  const N = Math.round(necklineStitches);
  if (!Number.isFinite(N) || N <= 2) return 0;
  const neckPlan = calculateRoundNecklineShaping({ necklineStitches: N });
  const stairRowCount = Math.max(neckPlan.left.stairSteps.length, neckPlan.right.stairSteps.length);
  const maxSingles = Math.max(
    neckPlan.left.singleDecreaseCount,
    neckPlan.right.singleDecreaseCount
  );
  const singlesPhaseSpanRows = maxSingles > 0 ? 2 * maxSingles - 1 : 0;
  return stairRowCount + singlesPhaseSpanRows;
}
