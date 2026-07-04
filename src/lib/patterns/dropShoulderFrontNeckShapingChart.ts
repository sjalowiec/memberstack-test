/**
 * Front neckline shaping chart for drop-shoulder patterns.
 * Reuses {@link buildTimeline} / {@link buildVNeckFrontFullWidthTimeline} - no duplicate neck math.
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
import { cardiganFrontInitialNeckBindOffStitches } from "./roundNeckNotation";
import type { RowEntry, ShapingEvent } from "./shapingTimeline";
import { buildVNeckFrontFullWidthTimeline } from "./vNeckFrontFullWidthTimeline";

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

function forceEven(n: number): number {
  const v = Math.max(0, Math.round(n));
  return v % 2 === 0 ? v : v + 1;
}

function appendDropShoulderStraightShoulderFinish(
  timeline: RowEntry[],
  totalRows: number,
  profile: "pullover" | "cardiganHalfFront",
): RowEntry[] {
  if (timeline.length === 0 || totalRows <= 0) return timeline;

  const out = [...timeline];
  const last = out[out.length - 1]!;
  let rc = last.row;
  let leftCount = last.stitchesL;
  let rightCount = last.stitchesR;

  while (rc < totalRows - 1) {
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

  const bindOffRc = Math.max(totalRows, rc + 1);
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

/**
 * Build the live front neckline chart for drop-shoulder (straight shoulders, no back chart).
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

  if (neckSts <= 0 || shoulderStsEach <= 0 || frontNeckDepthRows <= 0 || totalRows <= 0 || bustBodySts <= 0) {
    return null;
  }

  const isCardiganRoundHalfFront = isCardigan && !isVNeck;
  const shoulderBindoffRows = Math.max(1, Math.round(rowsPerInch));
  const timelineOpts = { straightShoulders: true as const };

  const necklineOpeningStsForFrontPiece = isCardiganRoundHalfFront
    ? Math.max(1, Math.round(neckSts / 2))
    : neckSts;
  const stitchesAfterArmholeForFrontPiece = isCardiganRoundHalfFront
    ? forceEven(bustBodySts / 2)
    : bustBodySts;
  const shoulderStsForFrontPiece = isCardiganRoundHalfFront
    ? Math.max(1, stitchesAfterArmholeForFrontPiece - necklineOpeningStsForFrontPiece)
    : shoulderStsEach;

  const neckProfile: NeckShoulderShapingPatternNumbers["neckProfile"] = isCardiganRoundHalfFront
    ? "cardiganHalfFront"
    : "front";

  const patternNumbers: NeckShoulderShapingPatternNumbers = {
    firstShapingRow: frontNecklineStartRC,
    shoulderStitchesPerSide: shoulderStsForFrontPiece,
    centerNeckBindOff: necklineOpeningStsForFrontPiece,
    ...(isCardiganRoundHalfFront
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
    const vFront = buildVNeckFrontFullWidthTimeline(patternNumbers, timelineOpts);
    timeline = vFront.timeline;
  } else {
    timeline = buildNeckShoulderTimelineAndChartRows(patternNumbers, timelineOpts).timeline;
  }

  if (timeline.length === 0) return null;

  timeline = appendDropShoulderStraightShoulderFinish(
    timeline,
    totalRows,
    isCardiganRoundHalfFront ? "cardiganHalfFront" : "pullover",
  );

  const chartRows = neckShoulderChartRowsFromTimeline(timeline);
  if (chartRows.length === 0) return null;

  const chart = neckShoulderShapingChartFromRows(chartRows, {
    timeline,
    ...(isVNeck ? { sleevelessFullWidthVNeckFront: true } : {}),
    ...(isCardiganRoundHalfFront ? { sleevelessCardiganFront: true } : {}),
  });

  return { chart, timeline, usesLiveRows: true };
}
