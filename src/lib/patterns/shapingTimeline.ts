import {
  calculateDocumentedShallowRoundNecklineShaping,
  calculateRoundNecklinePlan,
  calculateRoundNecklineShaping,
  isShallowHoldRoundPlan,
  normalizeRoundNecklineDepthRows,
  type RoundNecklineShapingResult,
} from "./legoBlocks/roundNeckline";
import { distributeTotalAcrossRows } from "./distributeTotalAcrossRows";

export { distributeTotalAcrossRows };

export type NeckProfile = "back" | "front" | "cardiganHalfFront";

export type ShapingTimelineInputs = {
  firstShapingRow: number;
  /**
   * Final shoulder width per side (target after inner neckline shaping removes neck-edge stitches).
   */
  shoulderStitchesPerSide: number;
  /** Total neckline opening width N (full neck width in stitches). */
  centerNeckBindOff: number;
  /**
   * Round cardigan half front only: first CF-edge bind-off (half of full-garment center BO).
   * When set, row 0 inner bind-off uses this instead of `calculateRoundNecklineShaping(N).centerBindOff`.
   */
  cardiganCfInitialBindOff?: number;
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
  kind: "bindOff" | "decrease" | "hold";
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
 * Canonical outer-shoulder bind-off chunks (per action row) + placement span. For sleeveless,
 * computed from the **back** neck/shoulder inputs and applied to both back and front timelines.
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

/**
 * RC numbers for one 1-stitch decrease each, spread across `[startRow, endRow]` inclusive.
 * Sleeveless V-neck inner-neck RCs use {@link distributeVNeckInnerDecreaseRows} in `vNeckline.ts`
 * instead; this helper remains for overflow packing and other callers.
 *
 * - When `count` fits within the row span, RCs use endpoint interpolation (legacy even spacing).
 * - When `count` exceeds the span, {@link distributeTotalAcrossRows} allocates multiple decreases per
 *   row; the returned list may repeat RCs (one entry per 1-st decrease).
 */
export function distributeEvenly(count: number, startRow: number, endRow: number): number[] {
  const start = Math.floor(startRow);
  const end = Math.floor(endRow);
  if (count <= 0 || !Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return [];
  }
  const span = end - start + 1;
  if (span <= 0) return [];

  if (count <= span) {
    if (count === 1) {
      return [start];
    }
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.round((i * (span - 1)) / (count - 1));
      out.push(start + idx);
    }
    return out;
  }

  const perRow = distributeTotalAcrossRows(count, span);
  const out: number[] = [];
  for (let j = 0; j < span; j++) {
    const n = perRow[j] ?? 0;
    const rc = start + j;
    for (let k = 0; k < n; k++) {
      out.push(rc);
    }
  }
  return out;
}

/**
 * Inner-neck events for one post-center row index (stair bind-offs, hold groups, or deep singles).
 *
 * Post-center garment RC is `firstRow + 1 + i` (local RC from neckline reset = `i + 1`).
 *
 * Deep round (center bind-off): matches written neck-edge schedule —
 * stairs/singles on every other row starting at local RC:002 (002, 004, 006…).
 * Local RC:001 is knit-even after the RC:000 center bind-off.
 *
 * Shallow hold (back): keeps the historical consecutive-stair then every-other hold layout.
 */
function backInnerNeckRow(
  i: number,
  neckPlan: RoundNecklineShapingResult,
  stairRowCount: number,
  neckInnerRowSpan: number,
  shallowHold: boolean,
): { events: ShapingEvent[]; innerNetL: number; innerNetR: number } {
  const events: ShapingEvent[] = [];
  let innerNetL = 0;
  let innerNetR = 0;
  if (i >= neckInnerRowSpan) {
    return { events, innerNetL, innerNetR };
  }

  if (!shallowHold) {
    // Deep: local RC 2, 4, 6… → action index 0, 1, 2…
    const localFromCenter = i + 1;
    if (localFromCenter % 2 !== 0) {
      return { events, innerNetL, innerNetR };
    }
    const actionIndex = localFromCenter / 2 - 1;
    if (actionIndex < stairRowCount) {
      const leftStair = neckPlan.left.stairSteps;
      const rightStair = neckPlan.right.stairSteps;
      const lb = leftStair[actionIndex] ?? 0;
      const rb = rightStair[actionIndex] ?? 0;
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
    const si = actionIndex - stairRowCount;
    if (si < neckPlan.left.singleDecreaseCount) {
      events.push({ kind: "decrease", side: "left", edge: "inner", amount: 1 });
      innerNetL += 1;
    }
    if (si < neckPlan.right.singleDecreaseCount) {
      events.push({ kind: "decrease", side: "right", edge: "inner", amount: 1 });
      innerNetR += 1;
    }
    return { events, innerNetL, innerNetR };
  }

  // Shallow hold: stairs on consecutive post-center rows, then holds every other row.
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
  if (j % 2 !== 0) {
    return { events, innerNetL, innerNetR };
  }
  const si = j / 2;
  const lb = neckPlan.left.holdGroups[si] ?? 0;
  const rb = neckPlan.right.holdGroups[si] ?? 0;
  if (lb > 0) {
    events.push({ kind: "hold", side: "left", edge: "inner", amount: lb });
    innerNetL += lb;
  }
  if (rb > 0) {
    events.push({ kind: "hold", side: "right", edge: "inner", amount: rb });
    innerNetR += rb;
  }
  return { events, innerNetL, innerNetR };
}

/** CF-edge inner-neck row for one cardigan half front (all neckline stitches on the right / active inner edge). */
function cardiganCfInnerNeckRow(
  i: number,
  neckPlan: RoundNecklineShapingResult,
  stairRowCount: number,
  neckInnerRowSpan: number,
  cfInitialHold: number,
  shallowHold: boolean,
): { events: ShapingEvent[]; innerNetR: number } {
  const events: ShapingEvent[] = [];
  let innerNetR = 0;
  if (i >= neckInnerRowSpan) {
    return { events, innerNetR };
  }
  if (i === 0 && cfInitialHold > 0) {
    events.push({
      kind: shallowHold ? "hold" : "bindOff",
      side: "right",
      edge: "inner",
      amount: cfInitialHold,
    });
    innerNetR += cfInitialHold;
    return { events, innerNetR };
  }
  const stairIndex = cfInitialHold > 0 ? i - 1 : i;
  if (stairIndex >= 0 && stairIndex < stairRowCount) {
    const leftStair = neckPlan.left.stairSteps;
    const rightStair = neckPlan.right.stairSteps;
    const lb = leftStair[stairIndex] ?? 0;
    const rb = rightStair[stairIndex] ?? 0;
    const amount = lb + rb;
    if (amount > 0) {
      events.push({ kind: "bindOff", side: "right", edge: "inner", amount });
      innerNetR += amount;
    }
    return { events, innerNetR };
  }
  const j = stairIndex - stairRowCount;
  if (j % 2 !== 0) {
    return { events, innerNetR };
  }
  const si = j / 2;
  if (shallowHold) {
    const amount = (neckPlan.left.holdGroups[si] ?? 0) + (neckPlan.right.holdGroups[si] ?? 0);
    if (amount > 0) {
      events.push({ kind: "hold", side: "right", edge: "inner", amount });
      innerNetR += amount;
    }
  } else {
    let amount = 0;
    if (si < neckPlan.left.singleDecreaseCount) amount += 1;
    if (si < neckPlan.right.singleDecreaseCount) amount += 1;
    if (amount > 0) {
      events.push({ kind: "decrease", side: "right", edge: "inner", amount });
      innerNetR += amount;
    }
  }
  return { events, innerNetR };
}

function neckInnerRowSpanForPlan(neckPlan: RoundNecklineShapingResult, stairRowCount: number): number {
  if (isShallowHoldRoundPlan(neckPlan)) {
    const maxHold = Math.max(neckPlan.left.holdGroups.length, neckPlan.right.holdGroups.length);
    return stairRowCount + (maxHold > 0 ? 2 * maxHold - 1 : 0);
  }
  const maxSingles = Math.max(neckPlan.left.singleDecreaseCount, neckPlan.right.singleDecreaseCount);
  // Deep: actions at local RC 2, 4, …, 2*(stairs+singles) → max post-center index i = 2*(s+n)-1.
  return 2 * (stairRowCount + maxSingles);
}

/**
 * Round-neck cardigan half front: one panel (no center divide). All {@link stitchesAfterArmhole}
 * stitches start on the active side; CF neck shaping is right-inner only; shoulder bind-offs are
 * right-outer only.
 */
export function buildCardiganHalfFrontTimeline(
  inputs: ShapingTimelineInputs,
  options?: BuildTimelineOptions,
): RowEntry[] {
  const firstRow = Math.floor(inputs.firstShapingRow);
  const S = Math.round(inputs.shoulderStitchesPerSide);
  const N = Math.round(inputs.centerNeckBindOff);
  const neckDepthRows = normalizeRoundNecklineDepthRows(inputs.neckDepthRows);
  const B = Math.round(inputs.stitchesAfterArmhole);
  const shoulderBindoffRowsRaw = inputs.shoulderBindoffRows;
  const minFinalStitchesPerSide = Math.max(
    0,
    Math.floor(Number(options?.minFinalStitchesPerSide ?? 0)),
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
  if (S <= 0 || N <= 0 || neckDepthRows <= 0 || B <= 0 || B < N) {
    return [];
  }

  const workRows = neckDepthRows - 1;
  if (workRows < 0) {
    return [];
  }

  const neckPlanResult = calculateRoundNecklinePlan({
    necklineStitches: N,
    necklineDepthRows: neckDepthRows,
  });
  const neckPlan: RoundNecklineShapingResult = {
    necklineStitches: neckPlanResult.necklineStitches,
    centerBindOff: neckPlanResult.centerBindOff,
    left: neckPlanResult.left,
    right: neckPlanResult.right,
    totalCheck: neckPlanResult.totalCheck,
  };
  const cfInitialBindOff = Math.max(
    0,
    Math.floor(inputs.cardiganCfInitialBindOff ?? neckPlan.centerBindOff),
  );
  const leftStair = neckPlan.left.stairSteps;
  const rightStair = neckPlan.right.stairSteps;
  const stairRowCount = Math.max(leftStair.length, rightStair.length);
  const shallowHold = neckPlanResult.strategy === "shallow-round";
  const neckInnerRowSpan =
    (cfInitialBindOff > 0 ? 1 : 0) + neckInnerRowSpanForPlan(neckPlan, stairRowCount);

  const shoulderBandTotal = B - N;
  const shoulderBindoffRowsIn = Math.max(1, Math.floor(shoulderBindoffRowsRaw));
  const schedule = options?.shoulderSchedule ?? undefined;
  const shoulderStartsAtFirstPostCenter = options?.shoulderStartsAtFirstPostCenter === true;

  const shoulderRightPerRow = Array(workRows).fill(0);
  if (!options?.straightShoulders && shoulderBandTotal > 0) {
    let placementRowsEff = Math.min(shoulderBindoffRowsIn, workRows);
    let rightChunks: number[];

    if (schedule && schedule.placementRows > 0 && schedule.rightChunks.length > 0) {
      if (workRows >= schedule.placementRows) {
        placementRowsEff = schedule.placementRows;
        // One outer shoulder edge on the half front — reuse back cadence (one side), not L+R combined.
        rightChunks = [...schedule.rightChunks];
      } else {
        const shoulderActionSlots = Math.max(1, Math.ceil(placementRowsEff / 2));
        rightChunks = distributeTotalAcrossRows(shoulderBandTotal, shoulderActionSlots);
      }
    } else if (placementRowsEff > 0) {
      const shoulderActionSlots = Math.max(1, Math.ceil(placementRowsEff / 2));
      rightChunks = distributeTotalAcrossRows(shoulderBandTotal, shoulderActionSlots);
    } else {
      rightChunks = [];
    }

    if (placementRowsEff > 0 && rightChunks.length > 0) {
      const startI = shoulderStartsAtFirstPostCenter ? 0 : workRows - placementRowsEff;
      for (let k = 0; k < rightChunks.length; k++) {
        const rowIdx = startI + 2 * k;
        if (rowIdx >= workRows || rowIdx < 0) break;
        shoulderRightPerRow[rowIdx] = rightChunks[k] ?? 0;
      }
    }
  }

  let shoulderRemR = shoulderBandTotal;
  let carryShoulderR = 0;

  let leftOuterEdge = 1;
  let leftInnerEdge = 0;
  let rightInnerEdge = 1;
  let rightOuterEdge = B;

  let leftCount = 0;
  let rightCount = B;

  const rows: RowEntry[] = [];
  const plannedInnerRPerRow: number[] = [];
  for (let i = 0; i < workRows; i++) {
    const planned = cardiganCfInnerNeckRow(
      i,
      neckPlan,
      stairRowCount,
      neckInnerRowSpan,
      cfInitialBindOff,
      shallowHold,
    );
    plannedInnerRPerRow.push(Math.max(0, planned.innerNetR));
  }
  const futureInnerRAfterRow = Array(workRows).fill(0);
  let suffixR = 0;
  for (let i = workRows - 1; i >= 0; i--) {
    futureInnerRAfterRow[i] = suffixR;
    suffixR += plannedInnerRPerRow[i] ?? 0;
  }

  for (let i = 0; i < workRows; i++) {
    const rc = firstRow + i;
    const events: ShapingEvent[] = [];
    let shoulderBoR = 0;
    let innerNetR = 0;

    const inner = cardiganCfInnerNeckRow(
      i,
      neckPlan,
      stairRowCount,
      neckInnerRowSpan,
      cfInitialBindOff,
      shallowHold,
    );
    events.push(...inner.events);
    innerNetR = inner.innerNetR;
    if (innerNetR > 0) {
      const stairIndex = cfInitialBindOff > 0 ? i - 1 : i;
      if (stairIndex >= 0 && stairIndex < stairRowCount) {
        const rb = (neckPlan.right.stairSteps[stairIndex] ?? 0) + (neckPlan.left.stairSteps[stairIndex] ?? 0);
        if (rb > 0) {
          rightInnerEdge += rb;
        }
      } else {
        rightInnerEdge += innerNetR;
      }
      rightCount -= innerNetR;
    }

    const wantShoulderR = (shoulderRightPerRow[i] ?? 0) + carryShoulderR;
    const capShoulderR = Math.min(wantShoulderR, shoulderRemR);
    const protectedRightStitches = minFinalStitchesPerSide + (futureInnerRAfterRow[i] ?? 0);
    const maxShoulderBoR = Math.max(0, rightCount - protectedRightStitches);
    shoulderBoR = Math.min(capShoulderR, maxShoulderBoR);
    shoulderRemR -= shoulderBoR;
    carryShoulderR =
      shoulderBoR < wantShoulderR && shoulderBoR === rightCount && rightCount < capShoulderR
        ? wantShoulderR - shoulderBoR
        : 0;

    if (shoulderBoR > 0) {
      events.push({ kind: "bindOff", side: "right", edge: "outer", amount: shoulderBoR });
      rightOuterEdge -= shoulderBoR;
      rightCount -= shoulderBoR;
    }

    rightCount = Math.max(0, rightCount);
    const netR = shoulderBoR + innerNetR;

    const rowEntry: RowEntry = {
      row: rc,
      events,
      stitchesL: leftCount,
      stitchesR: rightCount,
      netChangeL: 0,
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
 * Compute outer-shoulder bind-off chunks exactly as {@link buildTimeline} would for these inputs.
 * For sleeveless patterns, pass **back** {@link ShapingTimelineInputs} so shoulder placement follows
 * the round back neck budget; the same schedule is then reused on the front timeline for matching
 * shoulder shaping.
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
  /** When set (typically from {@link computeShoulderBindoffSchedule} on **back** sleeveless inputs), outer shoulder amounts match that schedule instead of being recomputed from this piece's row budget. */
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
  /**
   * Drop-shoulder fronts: skip graduated outer-shoulder bind-offs during the neck-depth window;
   * shoulder stitches stay straight until the final bind-off row appended by the drop-shoulder chart builder.
   */
  straightShoulders?: boolean;
};

/**
 * Unified neckline + shoulder scheduler: one row budget ({@link ShapingTimelineInputs.neckDepthRows}),
 * inner-neck and outer-shoulder actions may occur on the same RC.
 *
 * Round neck — back: always documented shallow (center ≈ 50%, singles every other row).
 * Round neck — front: deep-thirds when depth allows, else same shallow formula.
 * Sleeveless V-neck **front** uses `buildVNeckFrontFullWidthTimeline` (`vNeckFrontFullWidthTimeline.ts`)
 * instead (no center row); back pieces continue to use this function unchanged.
 */
export function buildTimeline(inputs: ShapingTimelineInputs, options?: BuildTimelineOptions): RowEntry[] {
  if (inputs.neckProfile === "cardiganHalfFront") {
    return buildCardiganHalfFrontTimeline(inputs, options);
  }

  const firstRow = Math.floor(inputs.firstShapingRow);
  const S = Math.round(inputs.shoulderStitchesPerSide);
  const N = Math.round(inputs.centerNeckBindOff);
  const neckDepthRows = normalizeRoundNecklineDepthRows(inputs.neckDepthRows);
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

  /** Back always shallow; front uses depth-aware deep vs shallow plan. */
  const frontRoundPlan =
    inputs.neckProfile !== "back"
      ? calculateRoundNecklinePlan({
          necklineStitches: N,
          necklineDepthRows: neckDepthRows,
        })
      : null;
  const neckPlan: RoundNecklineShapingResult =
    inputs.neckProfile === "back"
      ? calculateDocumentedShallowRoundNecklineShaping({
          necklineStitches: N,
          necklineDepthRows: neckDepthRows,
        })
      : {
          necklineStitches: frontRoundPlan!.necklineStitches,
          centerBindOff: frontRoundPlan!.centerBindOff,
          left: frontRoundPlan!.left,
          right: frontRoundPlan!.right,
          totalCheck: frontRoundPlan!.totalCheck,
        };
  const centerBindOffAmount = neckPlan.centerBindOff;
  const shallowHold =
    inputs.neckProfile === "back" || frontRoundPlan!.strategy === "shallow-round";

  const leftStair = neckPlan.left.stairSteps;
  const rightStair = neckPlan.right.stairSteps;
  const stairRowCount = Math.max(leftStair.length, rightStair.length);
  const neckInnerRowSpan = neckInnerRowSpanForPlan(neckPlan, stairRowCount);

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
  if (!options?.straightShoulders && shoulderBandTotal > 0) {
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
    const planned = backInnerNeckRow(
      i,
      neckPlan,
      stairRowCount,
      neckInnerRowSpan,
      shallowHold,
    );
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
    events: [
      {
        kind: shallowHold ? "hold" : "bindOff",
        side: "center",
        edge: "center",
        amount: centerBindOffAmount,
      },
    ],
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

    const inner = backInnerNeckRow(
      i,
      neckPlan,
      stairRowCount,
      neckInnerRowSpan,
      shallowHold,
    );
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
 * When the back neck row budget is shorter than the front, outer shoulder chunks can match
 * but inner-neck consumption leaves extra stitches on the back active side. Trim the back
 * final row to the front final per-side counts via inner-neck decreases so checklists match.
 */
export function alignBackNeckShoulderTimelineFinalCountsToFront(
  backTimeline: readonly RowEntry[],
  frontTimeline: readonly RowEntry[],
): RowEntry[] {
  if (backTimeline.length === 0 || frontTimeline.length === 0) {
    return [...backTimeline];
  }
  const frontLast = frontTimeline[frontTimeline.length - 1];
  const backLast = backTimeline[backTimeline.length - 1];
  if (!frontLast || !backLast) return [...backTimeline];

  const deltaR = Math.max(0, Math.floor(backLast.stitchesR) - Math.floor(frontLast.stitchesR));
  const deltaL = Math.max(0, Math.floor(backLast.stitchesL) - Math.floor(frontLast.stitchesL));
  if (deltaR === 0 && deltaL === 0) return [...backTimeline];

  const rows = backTimeline.map((row) => ({ ...row, events: [...row.events] }));
  const lastIdx = rows.length - 1;
  const last = rows[lastIdx]!;
  const events = [...last.events];
  if (deltaL > 0) {
    events.push({ kind: "decrease", side: "left", edge: "inner", amount: deltaL });
  }
  if (deltaR > 0) {
    events.push({ kind: "decrease", side: "right", edge: "inner", amount: deltaR });
  }
  rows[lastIdx] = {
    ...last,
    events,
    stitchesL: last.stitchesL - deltaL,
    stitchesR: last.stitchesR - deltaR,
    netChangeL: last.netChangeL + deltaL,
    netChangeR: last.netChangeR + deltaR,
    leftInnerEdge: last.leftInnerEdge - deltaL,
    rightInnerEdge: last.rightInnerEdge + deltaR,
  };
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
