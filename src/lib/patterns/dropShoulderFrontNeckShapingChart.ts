/**
 * Drop-shoulder neckline shaping charts/timelines.
 * Front: live checklist chart + shaping-map timeline.
 * Back: shaping-map timeline only (written prose, no back checklist chart).
 * Round necks reuse {@link buildTimeline}; V-necks use the same {@link evenShapingSchedule}
 * as Drop Shoulder written instructions (not an independent V rhythm).
 */

import {
  isSleevelessCardiganFrontNeckShoulderChart,
  neckShoulderShapingChartFromRows,
  type NeckShoulderShapingChart,
} from "./neckShoulderShapingChart";
import {
  buildNeckShoulderTimelineAndChartRows,
  neckShoulderChartRowsFromTimeline,
  type NeckShoulderShapingPatternNumbers,
} from "./neckShoulderShapingChartRows";
import { armholeLocalRcActiveShoulderChecklistStart } from "./neckShoulderActiveSideChecklist";
import {
  necklineShapingTwoSideTabPresentation,
  type NeckShoulderChartRenderOptions,
} from "./neckShoulderShapingChartHtml";
import { cardiganFrontInitialNeckBindOffStitches, cardiganFrontNeckOpeningStitches } from "./roundNeckNotation";
import { neckDecreaseStitchesPerSideFromOpening } from "./legoBlocks/vNeckline";
import {
  calculateRoundNecklinePlan,
  isShallowHoldRoundPlan,
} from "./legoBlocks/roundNeckline";
import {
  evenShapingGarmentRowNumbers,
  evenShapingSchedule,
  shapingActionRowNumbers,
} from "./evenShapingSchedule";
import type { RowEntry, ShapingEvent } from "./shapingTimeline";

export type DropShoulderFrontNeckChartInputs = {
  isCardigan: boolean;
  isVNeck: boolean;
  neckSts: number;
  /** Per-side shoulder budget on the front piece (half-panel for round cardigan). */
  shoulderStsEach: number;
  frontNeckDepthRows: number;
  frontNecklineStartRC: number;
  totalRows: number;
  bustBodySts: number;
  /**
   * Stitches on the front piece when the neckline begins.
   * Cardigan charts use this half-front count instead of rounding the full back width up to even.
   */
  frontPieceStitches?: number;
  rowsPerInch: number;
};

export type DropShoulderFrontNeckChartResult = {
  chart: NeckShoulderShapingChart;
  timeline: RowEntry[];
  usesLiveRows: true;
};

/** True when live front neckline chart/map inputs are sufficient (chart/checklist begin at local RC 000). */
export function dropShoulderFrontNeckShapingChartInputsReady(inputs: {
  neckSts: number;
  shoulderStsEach: number;
  frontNeckDepthRows: number;
  totalRows: number;
  bustBodySts: number;
}): boolean {
  const { neckSts, shoulderStsEach, frontNeckDepthRows, totalRows, bustBodySts } = inputs;
  return (
    neckSts > 0 &&
    shoulderStsEach > 0 &&
    frontNeckDepthRows > 0 &&
    totalRows > 0 &&
    bustBodySts > 0
  );
}

function forceEven(n: number): number {
  const v = Math.max(0, Math.round(n));
  return v % 2 === 0 ? v : v + 1;
}

/**
 * Local RC of the front shoulder bind-off after the neckline row-counter reset.
 * This is the garment remaining from {@link neckGarmentStartRc} to {@link totalGarmentRows}
 * — the same shoulder line the back uses (`totalRows`).
 */
export function dropShoulderFrontShoulderCompletionLocalRc(
  neckGarmentStartRc: number,
  totalGarmentRows: number,
): number {
  return Math.max(0, Math.floor(totalGarmentRows) - Math.floor(neckGarmentStartRc));
}

/**
 * Neckline working row budget for written V-neck schedules and the front chart timeline.
 * Caps the designed front neck depth so shaping cannot run past the garment shoulder.
 */
export function dropShoulderFrontNecklineWorkingRows(
  neckGarmentStartRc: number,
  totalGarmentRows: number,
  designedNeckDepthRows: number,
): number {
  const available = dropShoulderFrontShoulderCompletionLocalRc(
    neckGarmentStartRc,
    totalGarmentRows,
  );
  const designed = Math.max(0, Math.floor(designedNeckDepthRows));
  if (available <= 0) return designed;
  if (designed <= 0) return available;
  return Math.min(designed, available);
}

/** Local RC of the last outer shoulder bind-off on a drop-shoulder front timeline. */
export function dropShoulderFrontTimelineShoulderBindOffLocalRc(
  timeline: readonly RowEntry[] | undefined,
  necklineOriginRc: number,
): number | undefined {
  if (!timeline || timeline.length === 0) return undefined;
  const origin = Math.floor(necklineOriginRc);
  const bindOff = [...timeline]
    .reverse()
    .find((row) =>
      row.events.some((e) => e.kind === "bindOff" && e.edge === "outer" && e.amount > 0),
    );
  if (!bindOff) return undefined;
  return Math.max(0, Math.floor(bindOff.row) - origin);
}

/**
 * Drop-shoulder V-neck front timeline using the same {@link evenShapingSchedule} as written
 * instructions (`buildCardiganFrontRows` / pullover V path). Local RC origin is the neckline
 * reset (`firstShapingRow`); decrease RCs match {@link evenShapingGarmentRowNumbers}(0, sched).
 */
export type DropShoulderCardiganNeckAction = {
  /** Offset from the neckline row-counter origin (local RC 000, or garment RC when there is no reset). */
  localRc: number;
  amount: number;
  kind: "bindOff" | "decrease" | "hold";
};

/**
 * Cardigan round-front neck actions in the same order and row spacing as the written instructions:
 * half of the full-neck center bind-off, then one side of that plan (stairs every other row, then
 * single decreases every other row). Shallow plans use the combined center-front hold groups.
 */
export function dropShoulderCardiganRoundFrontNeckActions(
  fullNeckStitches: number,
  necklineDepthRows: number,
): DropShoulderCardiganNeckAction[] {
  const fullNeck = Math.max(0, Math.round(fullNeckStitches));
  const depth = Math.max(0, Math.floor(necklineDepthRows));
  if (fullNeck <= 0 || depth <= 0) return [];

  const plan = calculateRoundNecklinePlan({
    necklineStitches: fullNeck,
    necklineDepthRows: depth,
  });
  const actions: DropShoulderCardiganNeckAction[] = [];

  if (isShallowHoldRoundPlan(plan)) {
    // Combined holds already remove half the neck. A separate center bind-off would
    // take those stitches off twice and leave the front shoulder short of the back.
    const combined = [...plan.left.holdGroups];
    for (let i = 0; i < plan.right.holdGroups.length; i++) {
      combined[i] = (combined[i] ?? 0) + (plan.right.holdGroups[i] ?? 0);
    }
    let rc = 0;
    for (const amount of combined) {
      if (amount <= 0) continue;
      actions.push({ localRc: rc, amount, kind: "hold" });
      rc += 2;
    }
    return actions;
  }

  const cfBindOff = cardiganFrontInitialNeckBindOffStitches(fullNeck, depth);
  if (cfBindOff > 0) {
    actions.push({ localRc: 0, amount: cfBindOff, kind: "bindOff" });
  }

  const stairs = plan.right.stairSteps.filter((amount) => amount > 0);
  for (const [index, localRc] of shapingActionRowNumbers(2, stairs.length, 2).entries()) {
    const amount = stairs[index];
    if (amount !== undefined && amount > 0) {
      actions.push({ localRc, amount, kind: "bindOff" });
    }
  }
  for (const localRc of shapingActionRowNumbers(2 * (stairs.length + 1), plan.right.singleDecreaseCount, 2)) {
    actions.push({ localRc, amount: 1, kind: "decrease" });
  }
  return actions;
}

/** Highest local RC in {@link dropShoulderCardiganRoundFrontNeckActions}, or 0 when there is no shaping. */
export function dropShoulderCardiganRoundFrontNeckLastLocalRc(
  fullNeckStitches: number,
  necklineDepthRows: number,
): number {
  const actions = dropShoulderCardiganRoundFrontNeckActions(fullNeckStitches, necklineDepthRows);
  if (actions.length === 0) return 0;
  return Math.max(...actions.map((action) => action.localRc));
}

/**
 * Cardigan round-front timeline whose neck actions match {@link dropShoulderCardiganRoundFrontNeckActions}
 * and whose starting width is the real half-front stitch count.
 */
export function buildDropShoulderCardiganRoundFrontTimeline(inputs: {
  fullNeckStitches: number;
  necklineDepthRows: number;
  firstShapingRow: number;
  totalRows: number;
  frontPieceStitches: number;
}): RowEntry[] {
  const firstRow = Math.floor(inputs.firstShapingRow);
  const totalRows = Math.floor(inputs.totalRows);
  const frontStitches = Math.round(inputs.frontPieceStitches);
  const actions = dropShoulderCardiganRoundFrontNeckActions(
    inputs.fullNeckStitches,
    inputs.necklineDepthRows,
  );
  if (!Number.isFinite(firstRow) || frontStitches <= 0 || totalRows < firstRow || actions.length === 0) {
    return [];
  }

  const byLocal = new Map<number, DropShoulderCardiganNeckAction[]>();
  for (const action of actions) {
    const list = byLocal.get(action.localRc) ?? [];
    list.push(action);
    byLocal.set(action.localRc, list);
  }
  const lastLocal = Math.max(...actions.map((action) => action.localRc));
  const lastRow = Math.min(totalRows, firstRow + lastLocal);

  let rightCount = frontStitches;
  let rightOuterEdge = frontStitches;
  const rows: RowEntry[] = [];
  for (let local = 0; local <= lastRow - firstRow; local++) {
    const events: ShapingEvent[] = [];
    let removed = 0;
    for (const action of byLocal.get(local) ?? []) {
      if (action.amount <= 0 || rightCount <= 0) continue;
      const amount = Math.min(action.amount, rightCount);
      events.push({ kind: action.kind, side: "right", edge: "inner", amount });
      removed += amount;
      rightCount -= amount;
      rightOuterEdge -= amount;
    }
    rows.push({
      row: firstRow + local,
      events,
      stitchesL: 0,
      stitchesR: rightCount,
      netChangeL: 0,
      netChangeR: -removed,
      isSplit: true,
      centerWidth: 0,
      leftOuterEdge: 1,
      leftInnerEdge: 0,
      rightInnerEdge: 1,
      rightOuterEdge,
    });
  }
  return rows;
}

export function buildDropShoulderVNeckEvenScheduleTimeline(inputs: {
  isCardigan: boolean;
  neckSts: number;
  shoulderStsEach: number;
  frontNeckDepthRows: number;
  firstShapingRow: number;
  bustBodySts: number;
  frontPieceStitches?: number;
}): RowEntry[] {
  const firstRow = Math.floor(inputs.firstShapingRow);
  const depth = Math.floor(inputs.frontNeckDepthRows);
  const S = Math.max(0, Math.round(inputs.shoulderStsEach));
  const fullNeck = Math.max(0, Math.round(inputs.neckSts));
  const bust = Math.max(0, Math.round(inputs.bustBodySts));
  if (!Number.isFinite(firstRow) || S <= 0 || fullNeck <= 0 || depth <= 0 || bust <= 0) {
    return [];
  }

  const decreaseCount = inputs.isCardigan
    ? cardiganFrontNeckOpeningStitches(fullNeck)
    : neckDecreaseStitchesPerSideFromOpening(fullNeck);
  if (decreaseCount <= 0) return [];

  const sched = evenShapingSchedule(decreaseCount, depth);
  if (sched.count <= 0) return [];

  const decreaseLocalRcs = new Set(
    evenShapingGarmentRowNumbers(0, sched).filter((n) => n >= 0 && n <= depth),
  );
  const frontWidth = inputs.isCardigan
    ? Math.max(0, Math.round(inputs.frontPieceStitches ?? forceEven(bust / 2)))
    : bust;
  const startStitches = inputs.isCardigan
    ? Math.max(S + decreaseCount, frontWidth)
    : frontWidth;

  // Cardigan half-front: CF edge on the right. Pullover: both inner edges for full-width chart;
  // active-side rendering shows one shoulder.
  let rightCount = inputs.isCardigan ? startStitches : Math.ceil(startStitches / 2);
  let leftCount = inputs.isCardigan ? 0 : Math.floor(startStitches / 2);
  const centerWidth = inputs.isCardigan ? 0 : startStitches % 2;

  const rows: RowEntry[] = [];
  // Include local === depth so a last decrease on the shoulder RC is not dropped.
  for (let local = 0; local <= depth; local++) {
    const rc = firstRow + local;
    const events: ShapingEvent[] = [];
    let netR = 0;
    let netL = 0;
    if (decreaseLocalRcs.has(local)) {
      if (rightCount > S) {
        events.push({ kind: "decrease", side: "right", edge: "inner", amount: 1 });
        rightCount -= 1;
        netR = -1;
      }
      if (!inputs.isCardigan && leftCount > S) {
        events.push({ kind: "decrease", side: "left", edge: "inner", amount: 1 });
        leftCount -= 1;
        netL = -1;
      }
    }
    const rightInner = inputs.isCardigan ? 1 : leftCount + centerWidth + 1;
    rows.push({
      row: rc,
      events,
      stitchesL: leftCount,
      stitchesR: rightCount,
      netChangeL: netL,
      netChangeR: netR,
      isSplit: !inputs.isCardigan,
      centerWidth,
      leftOuterEdge: 1,
      leftInnerEdge: leftCount,
      rightInnerEdge: rightInner,
      rightOuterEdge: leftCount + centerWidth + rightCount,
    });
  }
  return rows;
}

function appendDropShoulderStraightShoulderFinish(
  timeline: RowEntry[],
  totalRows: number,
  profile: "pullover" | "cardiganHalfFront",
): RowEntry[] {
  if (timeline.length === 0 || totalRows <= 0) return timeline;

  const bindOffRc = Math.floor(totalRows);
  const out = timeline.filter((row) => row.row <= bindOffRc);
  if (out.length === 0) return timeline;

  const last = out[out.length - 1]!;
  let rc = last.row;
  let leftCount = last.stitchesL;
  let rightCount = last.stitchesR;

  const lastKnitRc = Math.max(0, bindOffRc - 1);
  while (rc < lastKnitRc) {
    rc += 1;
    out.push({
      row: rc,
      events: [],
      stitchesL: leftCount,
      stitchesR: rightCount,
      netChangeL: 0,
      netChangeR: 0,
      isSplit: last.isSplit,
      centerWidth: last.centerWidth,
      leftOuterEdge: last.leftOuterEdge,
      leftInnerEdge: last.leftInnerEdge,
      rightInnerEdge: last.rightInnerEdge,
      rightOuterEdge: last.rightOuterEdge,
    });
  }

  const events: ShapingEvent[] = [];
  if (profile === "cardiganHalfFront") {
    if (rightCount > 0) {
      events.push({ kind: "bindOff", side: "right", edge: "outer", amount: rightCount });
      rightCount = 0;
    }
  } else {
    if (leftCount > 0) {
      events.push({ kind: "bindOff", side: "left", edge: "outer", amount: leftCount });
      leftCount = 0;
    }
    if (rightCount > 0) {
      events.push({ kind: "bindOff", side: "right", edge: "outer", amount: rightCount });
      rightCount = 0;
    }
  }

  if (events.length === 0) return out;

  // Shoulder RC only — never past `totalRows`. A decrease that lands on bindOffRc stays.
  if (rc === bindOffRc) {
    const cur = out[out.length - 1]!;
    out[out.length - 1] = {
      ...cur,
      events: [...cur.events, ...events],
      stitchesL: leftCount,
      stitchesR: rightCount,
      netChangeL:
        (cur.netChangeL ?? 0) +
        (profile === "cardiganHalfFront"
          ? 0
          : -(events.find((e) => e.side === "left")?.amount ?? 0)),
      netChangeR: (cur.netChangeR ?? 0) + -(events.find((e) => e.side === "right")?.amount ?? 0),
    };
    return out;
  }

  out.push({
    row: bindOffRc,
    events,
    stitchesL: leftCount,
    stitchesR: rightCount,
    netChangeL: profile === "cardiganHalfFront" ? 0 : -(events.find((e) => e.side === "left")?.amount ?? 0),
    netChangeR: -(events.find((e) => e.side === "right")?.amount ?? 0),
    isSplit: last.isSplit,
    centerWidth: last.centerWidth,
    leftOuterEdge: last.leftOuterEdge,
    leftInnerEdge: last.leftInnerEdge,
    rightInnerEdge: last.rightInnerEdge,
    rightOuterEdge: last.rightOuterEdge,
  });
  return out;
}

export type DropShoulderBackNeckTimelineInputs = {
  backNeckSts: number;
  shoulderStsEach: number;
  backNeckDepthRows: number;
  backNecklineStartRC: number;
  totalRows: number;
  bustBodySts: number;
  rowsPerInch: number;
};

/** True when live back neckline map inputs are sufficient (straight shoulders OK). */
export function dropShoulderBackNeckShapingTimelineInputsReady(inputs: {
  backNeckSts: number;
  shoulderStsEach: number;
  backNeckDepthRows: number;
  totalRows: number;
  bustBodySts: number;
}): boolean {
  const { backNeckSts, shoulderStsEach, backNeckDepthRows, totalRows, bustBodySts } = inputs;
  return (
    backNeckSts > 0 &&
    shoulderStsEach > 0 &&
    backNeckDepthRows > 0 &&
    totalRows > 0 &&
    bustBodySts > 0
  );
}

/**
 * Build the live back neckline timeline for drop-shoulder shaping maps (straight shoulders).
 * Does not produce a checklist chart — drop-shoulder back instructions stay prose-only.
 * Returns null when neck/shoulder inputs are insufficient.
 */
export function buildDropShoulderBackNeckShapingTimeline(
  inputs: DropShoulderBackNeckTimelineInputs,
): RowEntry[] | null {
  const {
    backNeckSts,
    shoulderStsEach,
    backNeckDepthRows,
    backNecklineStartRC,
    totalRows,
    bustBodySts,
    rowsPerInch,
  } = inputs;

  if (!dropShoulderBackNeckShapingTimelineInputsReady(inputs)) {
    return null;
  }

  const shoulderBindoffRows = Math.max(1, Math.round(rowsPerInch));
  const patternNumbers: NeckShoulderShapingPatternNumbers = {
    firstShapingRow: backNecklineStartRC,
    shoulderStitchesPerSide: shoulderStsEach,
    centerNeckBindOff: backNeckSts,
    neckDepthRows: backNeckDepthRows,
    neckProfile: "back",
    stitchesAfterArmhole: bustBodySts,
    shoulderBindoffRows,
  };

  let timeline = buildNeckShoulderTimelineAndChartRows(patternNumbers, {
    straightShoulders: true,
  }).timeline;
  if (timeline.length === 0) return null;

  timeline = appendDropShoulderStraightShoulderFinish(timeline, totalRows, "pullover");
  return timeline.length > 0 ? timeline : null;
}

/**
 * Build the live front neckline chart for drop-shoulder (straight shoulders).
 * Returns null when neck/shoulder inputs are insufficient.
 */
export function buildDropShoulderFrontNeckShapingChart(
  inputs: DropShoulderFrontNeckChartInputs,
): DropShoulderFrontNeckChartResult | null {
  const {
    isCardigan,
    isVNeck,
    neckSts,
    shoulderStsEach,
    frontNeckDepthRows,
    frontNecklineStartRC,
    totalRows,
    bustBodySts,
    frontPieceStitches,
    rowsPerInch,
  } = inputs;

  if (!dropShoulderFrontNeckShapingChartInputsReady(inputs)) {
    return null;
  }

  const isCardiganHalfFront = isCardigan;
  const shoulderBindoffRows = Math.max(1, Math.round(rowsPerInch));
  const timelineOpts = { straightShoulders: true as const };

  const necklineOpeningStsForFrontPiece = isCardiganHalfFront
    ? Math.max(1, Math.round(neckSts / 2))
    : neckSts;
  const cardiganFrontStitches =
    frontPieceStitches !== undefined && frontPieceStitches > 0
      ? Math.round(frontPieceStitches)
      : forceEven(bustBodySts / 2);
  const stitchesAfterArmholeForFrontPiece = isCardiganHalfFront
    ? cardiganFrontStitches
    : bustBodySts;
  const shoulderStsForFrontPiece = isCardiganHalfFront
    ? Math.max(1, stitchesAfterArmholeForFrontPiece - necklineOpeningStsForFrontPiece)
    : shoulderStsEach;

  const neckProfile: NeckShoulderShapingPatternNumbers["neckProfile"] = isCardiganHalfFront
    ? "cardiganHalfFront"
    : "front";

  const patternNumbers: NeckShoulderShapingPatternNumbers = {
    firstShapingRow: frontNecklineStartRC,
    shoulderStitchesPerSide: shoulderStsForFrontPiece,
    centerNeckBindOff: necklineOpeningStsForFrontPiece,
    ...(isCardiganHalfFront && !isVNeck
      ? {
          cardiganCfInitialBindOff: cardiganFrontInitialNeckBindOffStitches(
            neckSts,
            frontNeckDepthRows,
          ),
        }
      : {}),
    neckDepthRows: frontNeckDepthRows,
    neckProfile,
    stitchesAfterArmhole: stitchesAfterArmholeForFrontPiece,
    shoulderBindoffRows,
  };

  let timeline: RowEntry[] = [];
  if (isCardiganHalfFront && !isVNeck) {
    timeline = buildDropShoulderCardiganRoundFrontTimeline({
      fullNeckStitches: neckSts,
      necklineDepthRows: frontNeckDepthRows,
      firstShapingRow: frontNecklineStartRC,
      totalRows,
      frontPieceStitches: cardiganFrontStitches,
    });
  } else if (isVNeck) {
    timeline = buildDropShoulderVNeckEvenScheduleTimeline({
      isCardigan,
      neckSts,
      shoulderStsEach: isCardigan ? shoulderStsForFrontPiece : shoulderStsEach,
      frontNeckDepthRows,
      firstShapingRow: frontNecklineStartRC,
      bustBodySts,
      frontPieceStitches: isCardigan ? cardiganFrontStitches : undefined,
    });
  } else {
    timeline = buildNeckShoulderTimelineAndChartRows(patternNumbers, timelineOpts).timeline;
  }

  if (timeline.length === 0) return null;

  timeline = appendDropShoulderStraightShoulderFinish(
    timeline,
    totalRows,
    isCardiganHalfFront ? "cardiganHalfFront" : "pullover",
  );

  const chartRows = neckShoulderChartRowsFromTimeline(timeline);
  if (chartRows.length === 0) return null;

  const chart = neckShoulderShapingChartFromRows(chartRows, {
    timeline,
    ...(isVNeck ? { sleevelessFullWidthVNeckFront: true } : {}),
    ...(isCardiganHalfFront ? { sleevelessCardiganFront: true } : {}),
  });

  return { chart, timeline, usesLiveRows: true };
}

/** True when Front neckline starts at or after the armhole marker (local RC 000 after reset). */
export function dropShoulderFrontUsesLocalNecklineRc(
  frontNecklineStartRC: number | null | undefined,
  armholeStartRow: number | null | undefined,
): boolean {
  if (typeof frontNecklineStartRC !== "number" || !Number.isFinite(frontNecklineStartRC)) {
    return false;
  }
  if (typeof armholeStartRow !== "number" || !Number.isFinite(armholeStartRow)) {
    return true;
  }
  return frontNecklineStartRC >= armholeStartRow;
}

/**
 * Subtract this from garment timeline RCs for Front chart/map labels.
 * Before-armhole: 0 (continuous garment RC). At/after: frontNecklineStartRC (local 000).
 */
export function dropShoulderFrontNecklineDisplayRcOffset(
  frontNecklineStartRC: number | null | undefined,
  armholeStartRow: number | null | undefined,
): number {
  if (!dropShoulderFrontUsesLocalNecklineRc(frontNecklineStartRC, armholeStartRow)) {
    return 0;
  }
  return Math.max(0, Math.floor(frontNecklineStartRC as number));
}

/**
 * Checklist RC origin for the drop-shoulder front chart.
 * At/after the armhole marker: neckline reset (`frontNecklineStartRC` → local RC:000).
 * Before the marker: continuous garment RC (same origin as written instructions).
 */
export function dropShoulderFrontChartActiveSideRcStart(
  chart: NeckShoulderShapingChart,
  frontNecklineStartRC: number | null | undefined,
  armholeStartRow?: number | null,
): number {
  const offset = dropShoulderFrontNecklineDisplayRcOffset(
    frontNecklineStartRC,
    armholeStartRow,
  );
  return armholeLocalRcActiveShoulderChecklistStart(chart, offset, {
    includeCenterNecklineSetupRow: true,
  });
}

/**
 * Online/print table options for the drop-shoulder front neckline chart.
 * No workflow preamble — center bind-off is the first table row (local 000 after reset,
 * or garment RC when the neckline begins before the armhole marker).
 * Pullover Front uses the shared two-side tab Lego; cardigan half-fronts stay single-side.
 */
export function dropShoulderFrontNeckChartTableOptions(
  activeSideRcStart: number,
  chart?: NeckShoulderShapingChart,
): NeckShoulderChartRenderOptions {
  const isCardiganFront = isSleevelessCardiganFrontNeckShoulderChart(chart);
  return {
    activeSideOnly: true,
    activeSideRcStart,
    includeCenterNecklineSetupRow: true,
    hideCenterNecklineSetupRow: false,
    shouldersShaped: false,
    ...(isCardiganFront
      ? { tableHeading: "Front Neckline Shaping Chart", isCardiganFront: true }
      : necklineShapingTwoSideTabPresentation()),
  };
}
