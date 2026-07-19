/**
 * Sleeveless Round Neck **front** shaping schedule � narrowly scoped.
 *
 * Architecture:
 *   Pattern calculations ? buildTimeline (RowEntry[]) ? this schedule ? Shaping Map data
 *
 * This module does NOT recompute any pattern math. It reads the already-calculated
 * neck/shoulder {@link RowEntry} timeline (the same source of truth that drives the
 * written chart table) and groups it into a small, explicit set of shaping operations
 * for one (active) edge of the front. A thin adapter then converts that schedule into
 * {@link ShapingMapData} for the existing {@link renderShapingMapSvg} renderer.
 *
 * It never parses written instruction strings, Japanese notation text, or rendered HTML.
 *
 * Scope: standard round-neck **pullover front** (a center bind-off/hold row is present).
 * V-neck fronts and cardigan half-fronts (no center bind-off row) return `null`, so their
 * existing behavior is untouched.
 */

import type { RowEntry, ShapingEvent } from "./shapingTimeline";
import type { ShapingMapData, ShapingMapStep } from "./shapingMapSvg";

/** Which physical edge of the front this schedule describes. */
export type ShapingScheduleEdge = "left" | "right";

/** Region of the garment an operation shapes: the outer (shoulder) or inner (neckline) edge. */
export type ShapingScheduleRegion = "shoulder" | "neck";

export type ShapingScheduleOpKind = "bindOff" | "decrease" | "hold";

/**
 * One grouped shaping operation: `stitches` removed `repetitions` times, spaced
 * `rowInterval` rows apart, from `startRow` (first RC) to `endRow` (last RC).
 * A single-occurrence op has `repetitions: 1` and `startRow === endRow`.
 */
export type SleevelessRoundNeckShapingOp = {
  region: ShapingScheduleRegion;
  kind: ShapingScheduleOpKind;
  /** Stitches affected on each repetition (positive count). */
  stitches: number;
  /** How many times this operation repeats. */
  repetitions: number;
  /** Rows between repetitions (e.g. 1 = every row, 2 = every other row). */
  rowInterval: number;
  /** First RC (machine row) of this operation. */
  startRow: number;
  /** Last RC (machine row) of this operation. */
  endRow: number;
};

/** How outer-edge bind-offs are drawn: stepped during ascent vs straight side + top completion. */
export type ShoulderRepresentationMode = "shaped" | "straight";

/** Structured shaping schedule for one edge of a Sleeveless Round Neck front. */
export type SleevelessRoundNeckShapingSchedule = {
  neckProfile: "front";
  /** Which edge these operations describe (currently the right / active side). */
  edge: ShapingScheduleEdge;
  /** Center neckline stitches bound off / held at the start of shaping. */
  centerStitches: number;
  /** Whether the center is held (shallow round) rather than bound off. */
  centerHeld: boolean;
  /** First shaping RC (the center bind-off row). */
  startRow: number;
  /** Last shaping RC in this neckline/shoulder section. */
  endRow: number;
  /**
   * Derived from outer-edge event placement in the timeline (never from trimming events).
   * `shaped`: bind-offs distributed across multiple RCs (sleeveless stepped shoulders).
   * `straight`: outer bind-offs only at the final RC (drop-shoulder completion bind-off).
   */
  shoulderMode: ShoulderRepresentationMode;
  /** Neckline (inner-edge) decreases / bind-offs, in RC order (ascending). */
  neckOps: SleevelessRoundNeckShapingOp[];
  /** Shoulder (outer-edge) bind-offs, in RC order (ascending). */
  shoulderOps: SleevelessRoundNeckShapingOp[];
  /** Total stitches removed at the neck edge (this side) across all neck ops. */
  neckStitchesTotal: number;
  /** Total stitches removed at the shoulder edge (this side) across all shoulder ops. */
  shoulderStitchesTotal: number;
};

type EdgePoint = { row: number; amount: number; kind: ShapingScheduleOpKind };

function dominantKind(events: readonly ShapingEvent[]): ShapingScheduleOpKind {
  if (events.some((e) => e.kind === "bindOff")) return "bindOff";
  if (events.some((e) => e.kind === "hold")) return "hold";
  return "decrease";
}

/** Sum + dominant kind for one side/edge on a single row (0 amount ? not a shaping point). */
function edgeAmount(
  entry: RowEntry,
  side: ShapingScheduleEdge,
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

const DEFAULT_ROW_INTERVAL = 2;

/**
 * Group consecutive same-amount, same-kind, evenly-spaced points into operations.
 * Points must be pre-sorted ascending by row.
 */
function groupPoints(
  points: readonly EdgePoint[],
  region: ShapingScheduleRegion,
): SleevelessRoundNeckShapingOp[] {
  const ops: SleevelessRoundNeckShapingOp[] = [];
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
  side: ShapingScheduleEdge,
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

/**
 * Classify shoulder representation from outer-edge event placement in the full timeline.
 * Does not remove or rewrite any events.
 */
export function detectShoulderRepresentationMode(
  shoulderPoints: readonly EdgePoint[],
  endRow: number,
): ShoulderRepresentationMode {
  if (shoulderPoints.length === 0) return "straight";
  return shoulderPoints.every((p) => p.row === endRow) ? "straight" : "shaped";
}

/**
 * Build the Sleeveless Round Neck front shaping schedule from the already-calculated
 * neck/shoulder timeline. Returns `null` when the timeline is not a round-neck pullover
 * front (no center bind-off/hold row), leaving V-neck / cardigan behavior untouched.
 */
export function buildSleevelessRoundNeckShapingSchedule(
  timeline: readonly RowEntry[] | undefined,
  options?: { edge?: ShapingScheduleEdge },
): SleevelessRoundNeckShapingSchedule | null {
  if (!timeline || timeline.length === 0) return null;

  const edge: ShapingScheduleEdge = options?.edge ?? "right";
  const sorted = [...timeline].sort((a, b) => a.row - b.row);

  const center = centerAmount(sorted[0]!);
  if (center.amount <= 0) return null; // Not a center-bind-off round neck front (V-neck / cardigan half front).

  const shoulderPoints = collectEdgePoints(sorted, edge, "outer");
  const neckPoints = collectEdgePoints(sorted, edge, "inner");

  const neckOps = groupPoints(neckPoints, "neck");
  const shoulderOps = groupPoints(shoulderPoints, "shoulder");

  const rows = sorted.map((e) => e.row);
  const endRow = Math.max(...rows);
  const neckStitchesTotal = neckPoints.reduce((s, p) => s + p.amount, 0);
  const shoulderStitchesTotal = shoulderPoints.reduce((s, p) => s + p.amount, 0);

  return {
    neckProfile: "front",
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

/** Expand grouped ops back to one point per repetition, ascending by row. */
function opsToPoints(
  ops: readonly SleevelessRoundNeckShapingOp[],
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

/**
 * Build a stepped path (top-down) from ascending shaping points. Each step binds off at a
 * row, then works down to the next (lower) row; the trailing run uses `trailingRows`.
 */
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

/**
 * Build a stepped path (bottom-up) from shaping points. Anchored at the LOWEST row, each step
 * binds off inward then works UP to the next (higher) row; the topmost step has no trailing run
 * so the path ends exactly on the highest shaping row.
 *
 * Used for shaped shoulders: outer bind-offs during ascent move the armhole edge inward.
 */
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
 * Adapter: convert a {@link SleevelessRoundNeckShapingSchedule} into {@link ShapingMapData}
 * for {@link renderShapingMapSvg}.
 *
 * `shaped` mode traces progressive outer-edge bind-offs (sleeveless stepped shoulders).
 * `straight` mode traces a vertical side edge, a horizontal shoulder completion at the top,
 * then neckline shaping down to center stitches (drop-shoulder).
 *
 * The schedule stores absolute (global garment) RC. Pass `firstArmholeRc` (`debug.armholeStartRow`)
 * so row labels match the written instructions and checklist.
 */
export function shapingScheduleToMapData(
  schedule: SleevelessRoundNeckShapingSchedule,
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

  if (schedule.shoulderMode === "shaped") {
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
        steps: neckSteps,
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
    title: options?.title ?? "Neckline & shoulder shaping map",
    rowMin: localStart,
    rowMax: localEnd,
    centerStitches: schedule.centerStitches,
    paths,
    edgeLabels: { shoulder: "Armhole Edge", neck: "Neck Edge" },
  };
}

/**
 * Convenience: timeline ? schedule ? {@link ShapingMapData} in one call. Returns `null`
 * when the timeline is not a round-neck pullover front (caller keeps its existing fallback).
 */
export function buildSleevelessRoundNeckShapingMapData(
  timeline: readonly RowEntry[] | undefined,
  options?: { edge?: ShapingScheduleEdge; title?: string; firstArmholeRc?: number | null },
): ShapingMapData | null {
  const schedule = buildSleevelessRoundNeckShapingSchedule(timeline, {
    ...(options?.edge ? { edge: options.edge } : {}),
  });
  if (!schedule) return null;
  return shapingScheduleToMapData(schedule, {
    ...(options?.title ? { title: options.title } : {}),
    ...(options?.firstArmholeRc !== undefined ? { firstArmholeRc: options.firstArmholeRc } : {}),
  });
}
