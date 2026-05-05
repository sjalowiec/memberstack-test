import { calculateRoundFrontNeckline } from "./legoBlocks/roundFrontNeckline";
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
  neckProfile: NeckProfile;
  /**
   * B — stitch count across the piece after armhole shaping (`stitchesAfterArmhole`).
   * With center bind-off C, each side starts with shoulder sts + neck-edge sts:
   * left/right ≈ floor/ceil((B−N)/2) + floor/ceil((N−C)/2), and left + (N−C) + right = B−C.
   */
  stitchesAfterArmhole: number;
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

/** Inner-neck events for one post-center row index (back — round neckline stair + singles). */
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

/** Inner-neck events for one post-center row index (front — alternate round neckline from {@link calculateRoundFrontNeckline}). */
function frontInnerNeckRow(
  rc: number,
  round: ReturnType<typeof calculateRoundFrontNeckline>,
  startRC: number
): { events: ShapingEvent[]; innerNetL: number; innerNetR: number } {
  const events: ShapingEvent[] = [];
  let innerNetL = 0;
  let innerNetR = 0;

  if (rc === startRC) {
    return { events, innerNetL, innerNetR };
  }
  if (rc >= round.steepStartRC && rc < round.steepStartRC + round.steepRows) {
    events.push({ kind: "decrease", side: "left", edge: "inner", amount: 1 });
    events.push({ kind: "decrease", side: "right", edge: "inner", amount: 1 });
    innerNetL += 1;
    innerNetR += 1;
    return { events, innerNetL, innerNetR };
  }
  if (rc >= round.gradualStartRC && rc < round.gradualStartRC + round.gradualRows) {
    const idx = rc - round.gradualStartRC;
    const isActionRow = idx % 2 === 0;
    const actionIndex = Math.floor(idx / 2);
    const leftDec = isActionRow && actionIndex < round.gradualStitchesLeft ? 1 : 0;
    const rightDec = isActionRow && actionIndex < round.gradualStitchesRight ? 1 : 0;
    if (leftDec > 0) {
      events.push({ kind: "decrease", side: "left", edge: "inner", amount: leftDec });
      innerNetL += leftDec;
    }
    if (rightDec > 0) {
      events.push({ kind: "decrease", side: "right", edge: "inner", amount: rightDec });
      innerNetR += rightDec;
    }
  }
  return { events, innerNetL, innerNetR };
}

/**
 * Unified neckline + shoulder scheduler: one row budget ({@link ShapingTimelineInputs.neckDepthRows}),
 * inner-neck and outer-shoulder actions may occur on the same RC.
 */
export function buildTimeline(inputs: ShapingTimelineInputs): RowEntry[] {
  const firstRow = Math.floor(inputs.firstShapingRow);
  const S = Math.round(inputs.shoulderStitchesPerSide);
  const N = Math.round(inputs.centerNeckBindOff);
  const neckDepthRows = Math.floor(inputs.neckDepthRows);
  const profile = inputs.neckProfile;
  const B = Math.round(inputs.stitchesAfterArmhole);

  if (
    !Number.isFinite(firstRow) ||
    !Number.isFinite(S) ||
    !Number.isFinite(N) ||
    !Number.isFinite(neckDepthRows) ||
    !Number.isFinite(B)
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

  let centerBindOffAmount: number;
  let leftInnerPlanned: number;
  let rightInnerPlanned: number;

  let neckPlan: ReturnType<typeof calculateRoundNecklineShaping> | undefined;
  let stairRowCount = 0;
  let neckInnerRowSpan = 0;

  let roundFront: ReturnType<typeof calculateRoundFrontNeckline> | undefined;

  if (profile === "back") {
    neckPlan = calculateRoundNecklineShaping({ necklineStitches: N });
    centerBindOffAmount = neckPlan.centerBindOff;
    leftInnerPlanned =
      neckPlan.left.stairSteps.reduce((a, b) => a + b, 0) + neckPlan.left.singleDecreaseCount;
    rightInnerPlanned =
      neckPlan.right.stairSteps.reduce((a, b) => a + b, 0) + neckPlan.right.singleDecreaseCount;

    const leftStair = neckPlan.left.stairSteps;
    const rightStair = neckPlan.right.stairSteps;
    stairRowCount = Math.max(leftStair.length, rightStair.length);
    const maxSingles = Math.max(
      neckPlan.left.singleDecreaseCount,
      neckPlan.right.singleDecreaseCount
    );
    const singlesPhaseSpanRows = maxSingles > 0 ? 2 * maxSingles - 1 : 0;
    neckInnerRowSpan = stairRowCount + singlesPhaseSpanRows;
  } else {
    roundFront = calculateRoundFrontNeckline({
      necklineStitches: N,
      neckDepthRows,
      startRC: firstRow,
      shoulderStitchesPerSide: S,
    });
    centerBindOffAmount = roundFront.centerBindOff;
    const remaining = N - centerBindOffAmount;
    const rightSideTotal = Math.ceil(remaining / 2);
    const leftSideTotal = Math.floor(remaining / 2);
    leftInnerPlanned = leftSideTotal;
    rightInnerPlanned = rightSideTotal;
  }

  const C = centerBindOffAmount;
  const shoulderBandTotal = B - N;
  const neckOpeningRemainingAfterBo = N - C;
  const leftStart =
    Math.floor(shoulderBandTotal / 2) + Math.floor(neckOpeningRemainingAfterBo / 2);
  const rightStart =
    Math.ceil(shoulderBandTotal / 2) + Math.ceil(neckOpeningRemainingAfterBo / 2);

  /** Outer-edge shoulder decreases (reserved — do not fund from S − innerPlanned). */
  const shoulderLeftPerRow = Array(workRows).fill(0);
  const shoulderRightPerRow = Array(workRows).fill(0);

  let leftOuterEdge = 1;
  let leftInnerEdge = leftStart;
  let rightInnerEdge = leftInnerEdge + N + 1;
  let rightOuterEdge = rightInnerEdge + rightStart - 1;

  let leftCount = leftStart;
  let rightCount = rightStart;

  const rows: RowEntry[] = [];

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
    let shoulderDecL = 0;
    let shoulderDecR = 0;
    let innerNetL = 0;
    let innerNetR = 0;

    if (profile === "back" && neckPlan) {
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
    } else if (profile === "front" && roundFront) {
      const inner = frontInnerNeckRow(rc, roundFront, firstRow);
      events.push(...inner.events);
      innerNetL = inner.innerNetL;
      innerNetR = inner.innerNetR;
      if (innerNetL > 0) {
        leftInnerEdge -= innerNetL;
        leftCount -= innerNetL;
      }
      if (innerNetR > 0) {
        rightInnerEdge += innerNetR;
        rightCount -= innerNetR;
      }
    }

    shoulderDecL = Math.max(0, shoulderLeftPerRow[i] ?? 0);
    shoulderDecR = Math.max(0, shoulderRightPerRow[i] ?? 0);
    if (shoulderDecL > 0) {
      events.push({ kind: "decrease", side: "left", edge: "outer", amount: shoulderDecL });
      leftOuterEdge += shoulderDecL;
      leftCount -= shoulderDecL;
    }
    if (shoulderDecR > 0) {
      events.push({ kind: "decrease", side: "right", edge: "outer", amount: shoulderDecR });
      rightOuterEdge -= shoulderDecR;
      rightCount -= shoulderDecR;
    }

    leftCount = Math.max(0, leftCount);
    rightCount = Math.max(0, rightCount);

    const netL = shoulderDecL + innerNetL;
    const netR = shoulderDecR + innerNetR;

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
