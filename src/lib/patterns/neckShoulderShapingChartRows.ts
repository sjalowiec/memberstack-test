/**
 * Live neckline / shoulder shaping chart rows from {@link buildTimeline}
 * (sleeveless — `neckProfile` + `neckDepthRows` per piece; start RC may differ on the front).
 */

import type { NeckShoulderShapingChartRow } from "./neckShoulderShapingChart";
import {
  buildTimeline,
  type BuildTimelineOptions,
  type RowEntry,
  type ShapingTimelineInputs as NeckShoulderShapingPatternNumbers,
} from "./shapingTimeline";

export type { NeckShoulderShapingPatternNumbers };
export type { ShoulderBindoffSchedule } from "./shapingTimeline";

function fmt(v: number): string {
  return v > 0 ? `-${v}` : "-";
}

function toChartAction(entry: RowEntry): string {
  const hasNeck = entry.events.some((e) => e.side !== "center" && e.edge === "inner" && e.amount > 0);
  const hasShoulder = entry.events.some(
    (e) =>
      e.side !== "center" &&
      e.edge === "outer" &&
      e.amount > 0 &&
      (e.kind === "bindOff" || e.kind === "decrease")
  );
  if (hasNeck && hasShoulder) return "Shoulder / Neck";
  if (hasNeck) return "Neck";
  if (hasShoulder) return "Shoulder";
  return "";
}

function sumEvents(entry: RowEntry, side: "left" | "right", edge: "outer" | "inner"): number {
  return entry.events
    .filter((e) => {
      if (e.side !== side || e.edge !== edge) return false;
      if (edge === "outer") {
        return e.amount > 0 && (e.kind === "bindOff" || e.kind === "decrease");
      }
      return true;
    })
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
  const rows = timeline.map((entry) => {
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
  annotateSplitCarriageShoulderDisplay(timeline, rows);
  return rows;
}

/**
 * Display-only: symmetric outer-shoulder bind-offs are executed left edge then right edge on the
 * following carriage pass. Timeline keeps both events on one RC for geometry; the chart mirrors
 * machine order by showing the left amount on RC N and the same right amount on RC N+1 when N+1
 * is otherwise plain (no neck/center/outer shaping).
 */
function annotateSplitCarriageShoulderDisplay(
  timeline: RowEntry[],
  rows: NeckShoulderShapingChartRow[]
): void {
  if (timeline.length !== rows.length) return;

  function outerShoulderLR(entry: RowEntry): { L: number; R: number } {
    let L = 0;
    let R = 0;
    for (const e of entry.events) {
      if (e.edge !== "outer" || e.amount <= 0) continue;
      if (e.kind !== "bindOff" && e.kind !== "decrease") continue;
      if (e.side === "left") L += e.amount;
      if (e.side === "right") R += e.amount;
    }
    return { L, R };
  }

  function innerNeckTotal(entry: RowEntry): number {
    let n = 0;
    for (const e of entry.events) {
      if (e.edge !== "inner" || e.amount <= 0) continue;
      if (e.kind !== "bindOff" && e.kind !== "decrease") continue;
      n += e.amount;
    }
    return n;
  }

  function centerBindRow(entry: RowEntry): number {
    return entry.events
      .filter((e) => e.side === "center" && e.edge === "center")
      .reduce((s, e) => s + e.amount, 0);
  }

  for (let i = 0; i + 1 < timeline.length; i++) {
    const cur = timeline[i]!;
    const nxt = timeline[i + 1]!;
    if (nxt.row !== cur.row + 1) continue;

    const { L, R } = outerShoulderLR(cur);
    if (L <= 0 || L !== R) continue;
    if (innerNeckTotal(cur) > 0 || centerBindRow(cur) > 0) continue;

    const nxtOut = outerShoulderLR(nxt);
    if (nxtOut.L > 0 || nxtOut.R > 0) continue;
    if (innerNeckTotal(nxt) > 0 || centerBindRow(nxt) > 0) continue;

    const r0 = rows[i]!;
    const r1 = rows[i + 1]!;
    if (r0.row !== cur.row || r1.row !== nxt.row) continue;

    r0.rightSide = "-";
    r1.rightSide = fmt(R);
    const nextAction = String(r1.action ?? "").trim();
    if (!nextAction) {
      r1.action = "Shoulder";
    }
  }
}

export function buildNeckShoulderShapingChartRows(
  patternNumbers: NeckShoulderShapingPatternNumbers,
  options?: BuildTimelineOptions
): NeckShoulderShapingChartRow[] {
  const timeline = buildTimeline(patternNumbers, options);
  return mapTimelineToChartRows(timeline);
}

/** Single `buildTimeline` call — use when attaching {@link RowEntry}[] to the chart for SVG. */
export function buildNeckShoulderTimelineAndChartRows(
  patternNumbers: NeckShoulderShapingPatternNumbers,
  options?: BuildTimelineOptions
): { timeline: RowEntry[]; chartRows: NeckShoulderShapingChartRow[] } {
  const timeline = buildTimeline(patternNumbers, options);
  return { timeline, chartRows: mapTimelineToChartRows(timeline) };
}
