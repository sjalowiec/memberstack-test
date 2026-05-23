/**
 * Canonical shoulder bind-off notation for garment overview and charts.
 * All outer-shoulder bind-off events from the timeline, plus any stitches still on the
 * active side after the last shaping row (final "bind off remaining" — expressed as notation,
 * not duplicated in separate prose).
 */

import {
  compressStitchDecreasePointsToNotationLines,
  type StitchDecreasePoint,
} from "./shapingNotationCompress";
import type { RowEntry } from "./shapingTimeline";

export type ShoulderNotationSide = "left" | "right";

function sortTimelineByRow(timeline: readonly RowEntry[]): RowEntry[] {
  return [...timeline].sort((a, b) => a.row - b.row);
}

/** Outer-edge shoulder bind-off amounts per timeline row for one diagram side. */
export function collectOuterShoulderBindOffPoints(
  timeline: readonly RowEntry[],
  side: ShoulderNotationSide,
): StitchDecreasePoint[] {
  return sortTimelineByRow(timeline)
    .map((entry) => {
      let amount = 0;
      for (const ev of entry.events) {
        if (ev.kind !== "bindOff" || ev.edge !== "outer") continue;
        if (side === "left" ? ev.side !== "left" : ev.side !== "right") continue;
        amount += ev.amount;
      }
      return { row: entry.row, amount };
    })
    .filter((p) => p.amount > 0);
}

/** Stitches left on one side after the last timeline row (final shoulder remainder). */
export function finalShoulderRemainderStitches(
  timeline: readonly RowEntry[],
  side: ShoulderNotationSide,
): number {
  const sorted = sortTimelineByRow(timeline);
  const last = sorted[sorted.length - 1];
  if (!last) return 0;
  return Math.max(0, Math.floor(side === "left" ? last.stitchesL : last.stitchesR));
}

/**
 * Complete shoulder shaping points: scheduled outer bind-offs plus final remainder on the
 * last row when those stitches are not already removed by timeline events.
 */
export function collectCompleteShoulderShapingPoints(
  timeline: readonly RowEntry[],
  side: ShoulderNotationSide,
): StitchDecreasePoint[] {
  const points = collectOuterShoulderBindOffPoints(timeline, side);
  const remainder = finalShoulderRemainderStitches(timeline, side);
  if (remainder <= 0) return points;

  const lastBindRow = points.length > 0 ? points[points.length - 1]!.row : undefined;
  const sorted = sortTimelineByRow(timeline);
  const lastTimelineRow = sorted[sorted.length - 1]?.row ?? 0;
  const gap =
    points.length >= 2
      ? Math.max(1, points[points.length - 1]!.row - points[points.length - 2]!.row)
      : 2;
  const finalRow = lastBindRow !== undefined ? lastBindRow + gap : lastTimelineRow;

  return [...points, { row: finalRow, amount: remainder }];
}

/** Japanese-style shoulder segments (`5s-2r-4x`) without a `bo` prefix. */
export function shoulderShapingNotationLinesFromTimeline(
  timeline: readonly RowEntry[],
  side: ShoulderNotationSide,
): string[] {
  return compressStitchDecreasePointsToNotationLines(collectCompleteShoulderShapingPoints(timeline, side));
}

/** Sum stitch counts encoded in `Ns-Mr-Kx` notation lines (ignores optional `bo` prefix). */
export function totalStitchesFromShapingNotationLines(lines: readonly string[]): number {
  let sum = 0;
  for (const raw of lines) {
    const line = raw.replace(/^bo/i, "").trim();
    const m = line.match(/^(\d+)s-(\d+)r-(\d+)x$/i);
    if (!m) continue;
    sum += Math.max(0, parseInt(m[1]!, 10)) * Math.max(0, parseInt(m[3]!, 10));
  }
  return sum;
}

/** True when the final shoulder remainder is already represented in complete shaping notation. */
export function isFinalShoulderBindoffCoveredByShaping(
  timeline: readonly RowEntry[],
  side: ShoulderNotationSide,
): boolean {
  return finalShoulderRemainderStitches(timeline, side) <= 0;
}
