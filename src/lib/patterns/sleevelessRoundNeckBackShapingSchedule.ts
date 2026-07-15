/**
 * Sleeveless Round Neck **back** shaping schedule — narrowly scoped.
 *
 * Architecture:
 *   Pattern calculations ? `backNeckShoulderTimeline` (RowEntry[]) ? this schedule ? Shaping Map data
 *
 * Reads the already-calculated back neck/shoulder timeline (same source of truth as the written
 * instructions, checklist, and Japanese notation). Does not recompute pattern math or parse prose.
 *
 * Scope: shallow-round **pullover / cardigan back** with center neckline hold (three-stage workflow).
 * V-neck and other non-round back necklines return `null`.
 */

import { isSleevelessVNeckChoice } from "./sleevelessFrontDiagramSrc.ts";
import type { RowEntry, ShapingEvent } from "./shapingTimeline";
import type { ShapingMapData, ShapingMapStep } from "./shapingMapSvg";

/** Active edge for the first shoulder on the back (matches {@link BACK_NOTATION_DIAGRAM_SIDE}). */
export const SLEEVELESS_ROUND_BACK_FIRST_SHOULDER_EDGE = "right" as const;

export type SleevelessRoundBackShapingEdge = "left" | "right";

export type ShapingScheduleRegion = "shoulder" | "neck";

export type ShapingScheduleOpKind = "bindOff" | "decrease" | "hold";

export type SleevelessRoundNeckBackShapingOp = {
  region: ShapingScheduleRegion;
  kind: ShapingScheduleOpKind;
  stitches: number;
  repetitions: number;
  rowInterval: number;
  startRow: number;
  endRow: number;
};

export type ShoulderRepresentationMode = "shaped" | "straight";

/** Structured shaping schedule for one edge of a Sleeveless Round Neck back. */
export type SleevelessRoundNeckBackShapingSchedule = {
  neckProfile: "back";
  edge: SleevelessRoundBackShapingEdge;
  centerStitches: number;
  centerHeld: boolean;
  startRow: number;
  endRow: number;
  shoulderMode: ShoulderRepresentationMode;
  neckOps: SleevelessRoundNeckBackShapingOp[];
  shoulderOps: SleevelessRoundNeckBackShapingOp[];
  neckStitchesTotal: number;
  shoulderStitchesTotal: number;
};

type EdgePoint = { row: number; amount: number; kind: ShapingScheduleOpKind };

const DEFAULT_ROW_INTERVAL = 2;

function dominantKind(events: readonly ShapingEvent[]): ShapingScheduleOpKind {
  if (events.some((e) => e.kind === "bindOff")) return "bindOff";
  if (events.some((e) => e.kind === "hold")) return "hold";
  return "decrease";
}

function edgeAmount(
  entry: RowEntry,
  side: SleevelessRoundBackShapingEdge,
  edge: "outer" | "inner",
): EdgePoint | null {
  const matched = entry.events.filter((e) => {
    if (e.side !== side || e.edge !== edge) return false;
    if (e.amount <= 0) return false;
    if (edge === "outer") return e.kind === "bindOff" || e.kind === "decrease";
    return e.kind === "bindOff" || e.kind === "decrease" || e.kind === "hold";
  });
  if (matched.length === 0) return null;
  const amount = matched.reduce((sum, e) => sum + e.amount, 0);
  if (amount <= 0) return null;
  return { row: entry.row, amount, kind: dominantKind(matched) };
}

function centerAmount(entry: RowEntry): { amount: number; held: boolean } {
  const matched = entry.events.filter((e) => e.side === "center" && e.edge === "center");
  const amount = matched.reduce((sum, e) => sum + e.amount, 0);
  const held = matched.length > 0 && matched.every((e) => e.kind === "hold");
  return { amount, held };
}

function groupPoints(
  points: readonly EdgePoint[],
  region: ShapingScheduleRegion,
): SleevelessRoundNeckBackShapingOp[] {
  const ops: SleevelessRoundNeckBackShapingOp[] = [];
  let i = 0;
  while (i < points.length) {
    const first = points[i]!;
    const gap = i + 1 < points.length ? points[i + 1]!.row - first.row : 0;
    let k = i;
    while (
      gap > 0 &&
      k + 1 < points.length &&
      points[k + 1]!.amount === first.amount &&
      points[k + 1]!.kind === first.kind &&
      points[k + 1]!.row - points[k]!.row === gap
    ) {
      k += 1;
    }
    const last = points[k]!;
    ops.push({
      region,
      kind: first.kind,
      stitches: first.amount,
      repetitions: k - i + 1,
      rowInterval: gap > 0 ? gap : DEFAULT_ROW_INTERVAL,
      startRow: first.row,
      endRow: last.row,
    });
    i = k + 1;
  }
  return ops;
}

function collectEdgePoints(
  timeline: readonly RowEntry[],
  side: SleevelessRoundBackShapingEdge,
  edge: "outer" | "inner",
): EdgePoint[] {
  const points: EdgePoint[] = [];
  for (const entry of timeline) {
    const p = edgeAmount(entry, side, edge);
    if (p) points.push(p);
  }
  points.sort((a, b) => a.row - b.row);
  return points;
}

function detectShoulderRepresentationMode(
  shoulderPoints: readonly EdgePoint[],
  endRow: number,
): ShoulderRepresentationMode {
  if (shoulderPoints.length === 0) return "straight";
  return shoulderPoints.every((p) => p.row === endRow) ? "straight" : "shaped";
}

/**
 * True when the back timeline is a shallow-round neckline with center hold (round back only).
 * V-neck patterns are excluded even though the back timeline may still carry a center hold row.
 */
export function isSleevelessRoundBackNeckShapingMapSupported(
  timeline: readonly RowEntry[] | undefined,
  patternData?: unknown,
): boolean {
  if (isSleevelessVNeckChoice(patternData)) return false;
  if (!timeline || timeline.length === 0) return false;
  const sorted = [...timeline].sort((a, b) => a.row - b.row);
  const center = centerAmount(sorted[0]!);
  return center.amount > 0 && center.held;
}

/**
 * Build the Sleeveless Round Neck back shaping schedule for one edge (first shoulder = right,
 * second shoulder = left) from the live back timeline.
 */
export function buildSleevelessRoundNeckBackShapingSchedule(
  timeline: readonly RowEntry[] | undefined,
  options?: { edge?: SleevelessRoundBackShapingEdge },
): SleevelessRoundNeckBackShapingSchedule | null {
  if (!timeline || timeline.length === 0) return null;

  const edge: SleevelessRoundBackShapingEdge =
    options?.edge ?? SLEEVELESS_ROUND_BACK_FIRST_SHOULDER_EDGE;
  const sorted = [...timeline].sort((a, b) => a.row - b.row);

  const center = centerAmount(sorted[0]!);
  if (center.amount <= 0 || !center.held) return null;

  const shoulderPoints = collectEdgePoints(sorted, edge, "outer");
  const neckPoints = collectEdgePoints(sorted, edge, "inner");

  const neckOps = groupPoints(neckPoints, "neck");
  const shoulderOps = groupPoints(shoulderPoints, "shoulder");

  const rows = sorted.map((e) => e.row);
  const endRow = Math.max(...rows);
  const neckStitchesTotal = neckPoints.reduce((s, p) => s + p.amount, 0);
  const shoulderStitchesTotal = shoulderPoints.reduce((s, p) => s + p.amount, 0);

  return {
    neckProfile: "back",
    edge,
    centerStitches: center.amount,
    centerHeld: center.held,
    startRow: Math.min(...rows),
    endRow,
    shoulderMode: detectShoulderRepresentationMode(shoulderPoints, endRow),
    neckOps,
    shoulderOps,
    neckStitchesTotal,
    shoulderStitchesTotal,
  };
}

function opsToPoints(
  ops: readonly SleevelessRoundNeckBackShapingOp[],
): { row: number; stitches: number }[] {
  const points: { row: number; stitches: number }[] = [];
  for (const op of ops) {
    for (let r = 0; r < op.repetitions; r++) {
      points.push({ row: op.startRow + r * op.rowInterval, stitches: op.stitches });
    }
  }
  points.sort((a, b) => a.row - b.row);
  return points;
}

function pathStepsTopDown(
  points: readonly { row: number; stitches: number }[],
  trailingRows: number,
): { startRow: number; steps: ShapingMapStep[]; totalStitches: number } {
  if (points.length === 0) {
    return { startRow: 0, steps: [], totalStitches: 0 };
  }
  const desc = [...points].sort((a, b) => b.row - a.row);
  const startRow = desc[0]!.row;
  const steps: ShapingMapStep[] = [];
  let totalStitches = 0;
  for (let i = 0; i < desc.length; i++) {
    const cur = desc[i]!;
    const next = desc[i + 1];
    const rows = next ? Math.max(1, cur.row - next.row) : Math.max(1, trailingRows);
    steps.push({ stitches: cur.stitches, rows });
    totalStitches += cur.stitches;
  }
  return { startRow, steps, totalStitches };
}

function pathStepsBottomUp(
  points: readonly { row: number; stitches: number }[],
): { startRow: number; steps: ShapingMapStep[]; totalStitches: number } {
  if (points.length === 0) {
    return { startRow: 0, steps: [], totalStitches: 0 };
  }
  const asc = [...points].sort((a, b) => a.row - b.row);
  const startRow = asc[0]!.row;
  const steps: ShapingMapStep[] = [];
  let totalStitches = 0;
  for (let i = 0; i < asc.length; i++) {
    const cur = asc[i]!;
    const next = asc[i + 1];
    const rows = next ? Math.max(1, next.row - cur.row) : 0;
    steps.push({ stitches: cur.stitches, rows });
    totalStitches += cur.stitches;
  }
  return { startRow, steps, totalStitches };
}

/**
 * Convert a back schedule into {@link ShapingMapData} for {@link renderShapingMapSvg}.
 * The displayed map traces the **first shoulder** (right edge); the second shoulder mirrors it.
 */
export function backShapingScheduleToMapData(
  schedule: SleevelessRoundNeckBackShapingSchedule,
  options?: { title?: string; firstArmholeRc?: number | null },
): ShapingMapData {
  const neckPoints = opsToPoints(schedule.neckOps);
  const neckTrailing = schedule.neckOps[schedule.neckOps.length - 1]?.rowInterval ?? DEFAULT_ROW_INTERVAL;
  const neck = pathStepsTopDown(neckPoints, neckTrailing);

  const offsetRaw = Number(options?.firstArmholeRc);
  const offset = Number.isFinite(offsetRaw) ? Math.floor(offsetRaw) : 0;
  const toLocal = (row: number): number => row - offset;

  const localStart = toLocal(schedule.startRow);
  const localEnd = toLocal(schedule.endRow);
  const paths: ShapingMapData["paths"] = [];

  if (schedule.shoulderMode === "shaped" && schedule.shoulderStitchesTotal > 0) {
    const shoulderPoints = opsToPoints(schedule.shoulderOps);
    const shoulder = pathStepsBottomUp(shoulderPoints);

    if (shoulder.steps.length > 0) {
      paths.push({
        id: "shoulder",
        label: "Shoulder",
        edge: "left",
        rowDirection: "up",
        startX: 0,
        startRow: toLocal(shoulder.startRow),
        steps: shoulder.steps,
      });
    }

    if (neck.steps.length > 0) {
      paths.push({
        id: "neck",
        label: "Neck",
        edge: "left",
        rowDirection: "down",
        startX: shoulder.totalStitches,
        startRow: toLocal(neck.steps.length > 0 ? neck.startRow : shoulder.startRow),
        steps: neck.steps,
      });
    }
  } else if (schedule.shoulderStitchesTotal > 0) {
    const shoulderWidth = schedule.shoulderStitchesTotal;
    const verticalRows = Math.max(0, localEnd - localStart);
    const shoulderSteps: ShapingMapStep[] = [];

    if (verticalRows > 0) {
      shoulderSteps.push({ stitches: 0, rows: verticalRows, label: "" });
    }
    shoulderSteps.push({
      stitches: shoulderWidth,
      rows: 0,
      label: `-${shoulderWidth}`,
    });

    paths.push({
      id: "shoulder",
      label: "Shoulder",
      edge: "left",
      rowDirection: "up",
      startX: 0,
      startRow: localStart,
      steps: shoulderSteps,
    });

    if (neck.steps.length > 0) {
      const localHighestNeckRow = toLocal(neck.startRow);
      const knitEvenGap = Math.max(0, localEnd - localHighestNeckRow);
      const neckSteps: ShapingMapStep[] = [];
      if (knitEvenGap > 0) {
        neckSteps.push({ stitches: 0, rows: knitEvenGap, label: "" });
      }
      neckSteps.push(...neck.steps);

      paths.push({
        id: "neck",
        label: "Neck",
        edge: "left",
        rowDirection: "down",
        startX: shoulderWidth,
        startRow: localEnd,
        steps: neck.steps,
      });
    }
  } else if (neck.steps.length > 0) {
    paths.push({
      id: "neck",
      label: "Neck",
      edge: "left",
      rowDirection: "down",
      startX: 0,
      startRow: toLocal(neck.startRow),
      steps: neck.steps,
    });
  }

  return {
    title: options?.title ?? "Back neckline shaping map",
    rowMin: localStart,
    rowMax: localEnd,
    centerStitches: schedule.centerStitches,
    paths,
    edgeLabels: { shoulder: "Shoulder Edge", neck: "Neck Edge" },
  };
}

/**
 * Timeline ? back schedule ? {@link ShapingMapData}. Returns `null` for non-round back necklines
 * or timelines without a shallow center hold row.
 */
export function buildSleevelessRoundNeckBackShapingMapData(
  timeline: readonly RowEntry[] | undefined,
  options?: {
    edge?: SleevelessRoundBackShapingEdge;
    title?: string;
    firstArmholeRc?: number | null;
    patternData?: unknown;
  },
): ShapingMapData | null {
  if (!isSleevelessRoundBackNeckShapingMapSupported(timeline, options?.patternData)) {
    return null;
  }
  const schedule = buildSleevelessRoundNeckBackShapingSchedule(timeline, {
    ...(options?.edge ? { edge: options.edge } : {}),
  });
  if (!schedule) return null;
  if (schedule.neckStitchesTotal <= 0 && schedule.shoulderStitchesTotal <= 0) {
    return null;
  }
  return backShapingScheduleToMapData(schedule, {
    ...(options?.title ? { title: options.title } : {}),
    ...(options?.firstArmholeRc !== undefined ? { firstArmholeRc: options.firstArmholeRc } : {}),
  });
}
