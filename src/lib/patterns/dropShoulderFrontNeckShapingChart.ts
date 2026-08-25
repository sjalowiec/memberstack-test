/**
 * Drop-shoulder neckline shaping charts/timelines.
 * Front: live checklist chart + shaping-map timeline.
 * Back: shaping-map timeline only (written prose, no back checklist chart).
 * Round necks reuse {@link buildTimeline}; V-necks use the same {@link evenShapingSchedule}
 * as Drop Shoulder written instructions (not an independent V rhythm).
 */

import {
  neckShoulderShapingChartFromRows,
  type NeckShoulderShapingChart,
} from "./neckShoulderShapingChart";
import {
  buildNeckShoulderTimelineAndChartRows,
  neckShoulderChartRowsFromTimeline,
  type NeckShoulderShapingPatternNumbers,
} from "./neckShoulderShapingChartRows";
import { armholeLocalRcActiveShoulderChecklistStart } from "./neckShoulderActiveSideChecklist";
import type { NeckShoulderChartRenderOptions } from "./neckShoulderShapingChartHtml";
import { cardiganFrontInitialNeckBindOffStitches, cardiganFrontNeckOpeningStitches } from "./roundNeckNotation";
import { neckDecreaseStitchesPerSideFromOpening } from "./legoBlocks/vNeckline";
import {
  evenShapingGarmentRowNumbers,
  evenShapingSchedule,
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
export function buildDropShoulderVNeckEvenScheduleTimeline(inputs: {
  isCardigan: boolean;
  neckSts: number;
  shoulderStsEach: number;
  frontNeckDepthRows: number;
  firstShapingRow: number;
  bustBodySts: number;
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

  const decreaseLocalRcs = new Set(evenShapingGarmentRowNumbers(0, sched));
  const frontWidth = inputs.isCardigan ? forceEven(bust / 2) : bust;
  const startStitches = inputs.isCardigan
    ? Math.max(S + decreaseCount, frontWidth)
    : frontWidth;

  // Cardigan half-front: CF edge on the right. Pullover: both inner edges for full-width chart;
  // active-side rendering shows one shoulder.
  let rightCount = inputs.isCardigan ? startStitches : Math.ceil(startStitches / 2);
  let leftCount = inputs.isCardigan ? 0 : Math.floor(startStitches / 2);
  const centerWidth = inputs.isCardigan ? 0 : startStitches % 2;

  const rows: RowEntry[] = [];
  for (let local = 0; local < depth; local++) {
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

  const lastKnitRc = Math.max(0, Math.floor(totalRows) - 1);
  const out = timeline.filter((row) => row.row <= lastKnitRc);
  if (out.length === 0) return timeline;

  const last = out[out.length - 1]!;
  let rc = last.row;
  let leftCount = last.stitchesL;
  let rightCount = last.stitchesR;

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

  // Always bind off on the garment shoulder RC — never past `totalRows`.
  const bindOffRc = Math.floor(totalRows);
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
    rowsPerInch,
  } = inputs;

  if (!dropShoulderFrontNeckShapingChartInputsReady(inputs)) {
    return null;
  }

  const isCardiganHalfFront = isCardigan;
  const shoulderBindoffRows = Math.max(1, Math.round(rowsPerInch));
  const timelineOpts = { straightShoulders: true as const };
  const frontNeckWorkingRows = dropShoulderFrontNecklineWorkingRows(
    frontNecklineStartRC,
    totalRows,
    frontNeckDepthRows,
  );

  const necklineOpeningStsForFrontPiece = isCardiganHalfFront
    ? Math.max(1, Math.round(neckSts / 2))
    : neckSts;
  const stitchesAfterArmholeForFrontPiece = isCardiganHalfFront
    ? forceEven(bustBodySts / 2)
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
  if (isVNeck) {
    timeline = buildDropShoulderVNeckEvenScheduleTimeline({
      isCardigan,
      neckSts,
      shoulderStsEach: isCardigan ? shoulderStsForFrontPiece : shoulderStsEach,
      frontNeckDepthRows: frontNeckWorkingRows,
      firstShapingRow: frontNecklineStartRC,
      bustBodySts,
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

/**
 * Checklist RC origin for the drop-shoulder front chart: neckline reset
 * (`frontNecklineStartRC` → local RC:000), not armhole-local garment offset.
 */
export function dropShoulderFrontChartActiveSideRcStart(
  chart: NeckShoulderShapingChart,
  frontNecklineStartRC: number | null | undefined,
): number {
  return armholeLocalRcActiveShoulderChecklistStart(chart, frontNecklineStartRC, {
    includeCenterNecklineSetupRow: true,
  });
}

/**
 * Online/print table options for the drop-shoulder front neckline chart.
 * No workflow preamble — center bind-off is the first table row at RC:000.
 */
export function dropShoulderFrontNeckChartTableOptions(
  activeSideRcStart: number,
): NeckShoulderChartRenderOptions {
  return {
    activeSideOnly: true,
    activeSideRcStart,
    includeCenterNecklineSetupRow: true,
    hideCenterNecklineSetupRow: false,
    tableHeading: "Front Neckline Shaping Chart",
    shouldersShaped: false,
  };
}
