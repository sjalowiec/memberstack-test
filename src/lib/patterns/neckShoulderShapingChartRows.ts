/**
 * Live neckline / shoulder shaping chart rows from {@link buildTimeline}
 * (sleeveless — `neckProfile` + `neckDepthRows` per piece; start RC may differ on the front).
 */

import type { NeckShoulderShapingChartRow } from "./neckShoulderShapingChart";
import {
  buildTimeline,
  type RowEntry,
  type ShapingTimelineInputs as NeckShoulderShapingPatternNumbers,
} from "./shapingTimeline";

export type { NeckShoulderShapingPatternNumbers };

function fmt(v: number): string {
  return v > 0 ? `-${v}` : "-";
}

function toChartAction(entry: RowEntry): string {
  const hasNeck = entry.events.some((e) => e.side !== "center" && e.edge === "inner" && e.amount > 0);
  const hasShoulder = entry.events.some((e) => e.side !== "center" && e.edge === "outer" && e.amount > 0);
  if (hasNeck && hasShoulder) return "Shoulder / Neck";
  if (hasNeck) return "Neck";
  if (hasShoulder) return "Shoulder";
  return "";
}

function sumEvents(entry: RowEntry, side: "left" | "right", edge: "outer" | "inner"): number {
  return entry.events
    .filter((e) => e.side === side && e.edge === edge)
    .reduce((sum, e) => sum + e.amount, 0);
}

function centerBindOff(entry: RowEntry): number {
  return entry.events
    .filter((e) => e.side === "center" && e.edge === "center")
    .reduce((sum, e) => sum + e.amount, 0);
}

/** Chart table rows from a pre-built timeline (e.g. merged front neck + shoulder). */
export function neckShoulderChartRowsFromTimeline(timeline: RowEntry[]): NeckShoulderShapingChartRow[] {
  return mapTimelineToChartRows(timeline);
}

function mapTimelineToChartRows(timeline: RowEntry[]): NeckShoulderShapingChartRow[] {
  return timeline.map((entry) => {
    const leftSide = sumEvents(entry, "left", "outer");
    const leftNeck = sumEvents(entry, "left", "inner");
    const rightNeck = sumEvents(entry, "right", "inner");
    const rightSide = sumEvents(entry, "right", "outer");
    const centerNeck = centerBindOff(entry);

    return {
      row: entry.row,
      action: toChartAction(entry),
      leftSide: fmt(leftSide),
      leftNeck: fmt(leftNeck),
      centerNeck: fmt(centerNeck),
      rightNeck: fmt(rightNeck),
      rightSide: fmt(rightSide),
      leftStitchCount: Number.isFinite(entry.stitchesL) ? entry.stitchesL : 0,
      rightStitchCount: Number.isFinite(entry.stitchesR) ? entry.stitchesR : 0,
    };
  });
}

export function buildNeckShoulderShapingChartRows(
  patternNumbers: NeckShoulderShapingPatternNumbers
): NeckShoulderShapingChartRow[] {
  const timeline = buildTimeline(patternNumbers);
  return mapTimelineToChartRows(timeline);
}

/** Single `buildTimeline` call — use when attaching {@link RowEntry}[] to the chart for SVG. */
export function buildNeckShoulderTimelineAndChartRows(
  patternNumbers: NeckShoulderShapingPatternNumbers
): { timeline: RowEntry[]; chartRows: NeckShoulderShapingChartRow[] } {
  const timeline = buildTimeline(patternNumbers);
  return { timeline, chartRows: mapTimelineToChartRows(timeline) };
}
