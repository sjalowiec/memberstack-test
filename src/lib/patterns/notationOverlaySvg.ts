import type { NeckShoulderShapingChart, NeckShoulderShapingChartRow } from "./neckShoulderShapingChart";
import type { RowEntry } from "./shapingTimeline";
import {
  compressStitchDecreasePointsToNotationLines,
  type StitchDecreasePoint,
} from "./shapingNotationCompress";
import { shoulderShapingNotationLinesFromTimeline } from "./shoulderShapingNotation";

type DiagramSide = "left" | "right";
type EdgeKind = "neck" | "shoulder";

function parseDecreaseCell(cell: string): number {
  const text = String(cell ?? "").trim();
  if (!text || text === "-") return 0;
  const normalized = text.replace(/[^\d-]/g, "");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.abs(Math.trunc(n)));
}

function edgeDecreaseForRow(row: NeckShoulderShapingChartRow, side: DiagramSide, edge: EdgeKind): number {
  if (side === "right") {
    return edge === "neck" ? parseDecreaseCell(row.rightNeck) : parseDecreaseCell(row.rightSide);
  }
  return edge === "neck" ? parseDecreaseCell(row.leftNeck) : parseDecreaseCell(row.leftSide);
}

function collectEdgePoints(rows: readonly NeckShoulderShapingChartRow[], side: DiagramSide, edge: EdgeKind): StitchDecreasePoint[] {
  return [...rows]
    .sort((a, b) => a.row - b.row)
    .map((row) => ({
      row: row.row,
      amount: edgeDecreaseForRow(row, side, edge),
    }))
    .filter((item) => item.amount > 0);
}

function sortTimelineByRow(timeline: readonly RowEntry[]): RowEntry[] {
  return [...timeline].sort((a, b) => a.row - b.row);
}

/** Inner-neck machine decreases only (excludes bind-off / other inner events) for V-neck diagram copy. */
function innerNeckDecreaseAmountForSide(entry: RowEntry, side: DiagramSide): number {
  const lr: "left" | "right" = side === "left" ? "left" : "right";
  let n = 0;
  for (const e of entry.events) {
    if (e.side !== lr || e.edge !== "inner") continue;
    if (e.kind !== "decrease" || e.amount <= 0) continue;
    n += e.amount;
  }
  return n;
}

export function collectInnerNeckDecreasePointsFromTimeline(
  timeline: readonly RowEntry[],
  side: DiagramSide,
): StitchDecreasePoint[] {
  return sortTimelineByRow(timeline)
    .map((entry) => ({
      row: entry.row,
      amount: innerNeckDecreaseAmountForSide(entry, side),
    }))
    .filter((p) => p.amount > 0);
}

/** V-neck (and tests): inner-edge decrease plan from live timeline rows. */
export function innerNeckDecreaseNotationLinesFromTimeline(
  timeline: readonly RowEntry[],
  side: DiagramSide,
): string[] {
  return compressStitchDecreasePointsToNotationLines(collectInnerNeckDecreasePointsFromTimeline(timeline, side));
}

/** Neck-edge grouped notation lines (round-neck: chart cells; V-neck front may use timeline inner decreases). */
export function neckEdgeNotationLinesFromNeckShoulderChart(
  chart: NeckShoulderShapingChart,
  side: DiagramSide,
  overlayOpts?: NotationOverlayDiagramOptions,
): string[] {
  return notationLinesForEdge(chart, side, "neck", overlayOpts);
}

function notationLinesForEdge(
  chart: NeckShoulderShapingChart,
  side: DiagramSide,
  edge: EdgeKind,
  overlayOpts?: NotationOverlayDiagramOptions,
): string[] {
  if (chart.timeline && chart.timeline.length > 0) {
    if (edge === "shoulder") {
      return shoulderShapingNotationLinesFromTimeline(chart.timeline, side);
    }
    if (edge === "neck" && overlayOpts?.innerNeckNotationFromTimeline === true) {
      const pts = collectInnerNeckDecreasePointsFromTimeline(chart.timeline, side);
      return compressStitchDecreasePointsToNotationLines(pts);
    }
  }
  const points = collectEdgePoints(chart.rows, side, edge);
  return compressStitchDecreasePointsToNotationLines(points);
}

export type NotationOverlayDiagramOptions = {
  /** Underlay silhouette (round vs V front); defaults to round shoulder reference icon. */
  outlineImageSrc?: string;
  /**
   * When true with a populated `chart.timeline`, inner-neck notation is derived from timeline
   * inner-edge **decrease** events only (V-neck front). Round-neck charts keep the default chart-cell path.
   */
  innerNeckNotationFromTimeline?: boolean;
};
