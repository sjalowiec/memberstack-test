/**
 * Auto-selecting shaping engine (Slope vs Magic Formula)
 *
 * Chooses shaping math from the relationship between total stitch change and row depth:
 * - When stitchChange > rowDepth, use slope-style grouping (multiple stitches per shaping row).
 * - When rowDepth >= stitchChange, use Magic Formula–style spacing (typically one stitch per event).
 *
 * Wording stays edge-neutral; pattern templates add placement ("At both sides", etc.).
 */

import type { ShapingStep } from './generateRowByRow';

export type ShapingMethod = 'slope' | 'magic';
export type ShapingDirection = 'decrease' | 'increase';

export interface AutoShapingInput {
  startSts: number;
  endSts: number;
  /** Vertical depth available for shaping (rows) */
  rows: number;
  /** Optional label echoed back for templates (not inserted into instruction lines). */
  placementContext?: string;
}

/** One structured shaping block (sts per action × row interval × repeat count). */
export interface StructuredShapingStep {
  sts: number;
  rows: number;
  times: number;
}

export interface AutoShapingResult {
  method: ShapingMethod;
  direction: ShapingDirection | null;
  stitchChange: number;
  rowDepth: number;
  startSts: number;
  endSts: number;
  placementContext?: string;
  /** True when startSts === endSts */
  noShaping: boolean;
  /** When inputs are unusable (e.g. rows < 1) */
  invalid?: boolean;
  invalidReason?: string;
  /** Grouped steps for templates / row-by-row expansion */
  structuredSteps: StructuredShapingStep[];
  /** Neutral instruction lines (no edge placement) */
  instructions: string[];
}

const verb = (d: ShapingDirection) => (d === 'decrease' ? 'Decrease' : 'Increase');

function stitchWord(n: number): string {
  return n === 1 ? 'stitch' : 'stitches';
}

/**
 * Magic Formula–style distribution for one stitch per shaping event (one-side total change).
 * Mirrors the interval split used in `src/pages/tools/magic-formula.astro` `runShapingEngine`.
 */
export function magicFormulaIntervals(
  totalRows: number,
  shapingEvents: number
): {
  shortInterval: number;
  longInterval: number;
  shortCount: number;
  longCount: number;
  steps: ShapingStep[];
} {
  if (shapingEvents <= 0) {
    return { shortInterval: 0, longInterval: 0, shortCount: 0, longCount: 0, steps: [] };
  }

  let events = shapingEvents;
  let intervalExact = totalRows / events;
  let shortInterval = Math.floor(intervalExact);
  let longInterval = Math.ceil(intervalExact);

  // With auto-selection we only call this when rowDepth >= stitchChange (events),
  // so shortInterval is normally >= 1. Kept for parity with the tool if reused elsewhere.
  if (shortInterval < 1) {
    events = Math.min(events, totalRows);
    if (events <= 0) {
      return { shortInterval: 0, longInterval: 0, shortCount: 0, longCount: 0, steps: [] };
    }
    intervalExact = totalRows / events;
    shortInterval = Math.floor(intervalExact);
    longInterval = Math.ceil(intervalExact);
    if (shortInterval < 1) shortInterval = 1;
    if (longInterval < 1) longInterval = 1;
  }

  let shortCount: number;
  let longCount: number;
  if (shortInterval === longInterval) {
    shortCount = events;
    longCount = 0;
  } else {
    longCount = totalRows - shortInterval * events;
    shortCount = events - longCount;
    if (longCount < 0) longCount = 0;
    if (shortCount < 0) shortCount = 0;
  }

  const steps: ShapingStep[] = [];
  if (longCount > 0) steps.push({ sts: 1, rows: longInterval, times: longCount });
  if (shortCount > 0) steps.push({ sts: 1, rows: shortInterval, times: shortCount });

  return {
    shortInterval,
    longInterval,
    shortCount,
    longCount,
    steps,
  };
}

function rowIntervalPhrase(rowsBetween: number): string {
  if (rowsBetween <= 1) return 'every row';
  if (rowsBetween === 2) return 'every other row';
  return `every ${rowsBetween} rows`;
}

function formatMagicInstructionLine(
  direction: ShapingDirection,
  rowsBetween: number,
  times: number
): string {
  const v = verb(direction);
  const interval = rowIntervalPhrase(rowsBetween);
  const timeWord = times === 1 ? 'time' : 'times';
  return `${v} 1 ${stitchWord(1)} ${interval} ${times} ${timeWord}.`;
}

function buildMagicInstructions(
  direction: ShapingDirection,
  mf: ReturnType<typeof magicFormulaIntervals>
): string[] {
  const lines: string[] = [];
  for (const step of mf.steps) {
    lines.push(formatMagicInstructionLine(direction, step.rows, step.times));
  }
  return lines;
}

/**
 * Slope-style grouping when total stitch change exceeds available rows (stitchChange > rowDepth).
 * For rowDepth === 1, all stitches are worked in one pass (every row). For rowDepth >= 2,
 * shaping uses every other row with floor(rowDepth/2) shaping passes (measurement-wizard style).
 */
function computeSlopeStructuredSteps(stitchChange: number, rowDepth: number): StructuredShapingStep[] {
  if (rowDepth < 1 || stitchChange < 1) return [];

  // Single row of depth: one action takes the full change (cannot alternate rows).
  if (rowDepth === 1) {
    return [{ sts: stitchChange, rows: 1, times: 1 }];
  }

  // Fewer rows than stitches: group multiple stitches per shaping row. Aligns with the
  // shoulder / slope pattern used in the Magic Formula measurement wizard: work shaping
  // every other row when the segment is long enough for that rhythm (floor(rowDepth/2) passes).
  const rowInterval = 2;
  const shapingRows = Math.max(1, Math.floor(rowDepth / rowInterval));

  const stsPerBase = Math.floor(stitchChange / shapingRows);
  const extra = stitchChange % shapingRows;
  const timesLarger = extra;
  const timesBase = shapingRows - extra;

  const steps: StructuredShapingStep[] = [];
  if (timesLarger > 0) {
    steps.push({ sts: stsPerBase + 1, rows: rowInterval, times: timesLarger });
  }
  if (timesBase > 0) {
    steps.push({ sts: stsPerBase, rows: rowInterval, times: timesBase });
  }

  return steps;
}

function formatSlopeInstructionLine(direction: ShapingDirection, step: StructuredShapingStep): string {
  const v = verb(direction);
  const interval = rowIntervalPhrase(step.rows);
  const timeWord = step.times === 1 ? 'time' : 'times';
  return `${v} ${step.sts} ${stitchWord(step.sts)} ${interval} ${step.times} ${timeWord}.`;
}

function buildSlopeInstructions(direction: ShapingDirection, steps: StructuredShapingStep[]): string[] {
  return steps.map((s) => formatSlopeInstructionLine(direction, s));
}

/**
 * Decide slope vs Magic Formula and return neutral structured data + instruction lines.
 *
 * Decision rule:
 * - stitchChange > rowDepth  → slope (more stitches than rows: group multiple sts per shaping row).
 * - rowDepth >= stitchChange → Magic Formula (enough rows to space single-stitch events).
 *
 * Row-by-row tables: pass `structuredSteps` (same shape as `ShapingStep` in
 * `generateRowByRow.ts`) to `generateRowByRow` with `shapingMode: 'one'` for total stitch
 * counts on one edge; use `both` only if your `startSts`/`endSts` already represent both
 * sides combined.
 */
export function computeAutoShaping(input: AutoShapingInput): AutoShapingResult {
  const startSts = Math.trunc(input.startSts);
  const endSts = Math.trunc(input.endSts);
  const rowDepth = Math.trunc(input.rows);
  const stitchChange = Math.abs(startSts - endSts);

  const base: Omit<AutoShapingResult, 'method' | 'noShaping' | 'structuredSteps' | 'instructions' | 'invalid' | 'invalidReason'> = {
    direction: null,
    stitchChange,
    rowDepth,
    startSts,
    endSts,
    placementContext: input.placementContext,
  };

  if (rowDepth < 1) {
    return {
      ...base,
      method: 'magic',
      noShaping: false,
      invalid: true,
      invalidReason: 'rows must be at least 1',
      structuredSteps: [],
      instructions: [],
    };
  }

  if (stitchChange === 0) {
    return {
      ...base,
      method: 'magic',
      noShaping: true,
      structuredSteps: [],
      instructions: [],
    };
  }

  const direction: ShapingDirection = endSts < startSts ? 'decrease' : 'increase';

  // --- Method selection (math only; templates add edge placement) ---
  // More stitches to change than rows to work them in → cannot space one stitch per row;
  // use slope-style chunks (multiple sts per shaping row, typically every other row).
  // Enough rows to cover each single-stitch move → Magic Formula spacing (Diophantine-style split).
  if (stitchChange > rowDepth) {
    const structuredSteps = computeSlopeStructuredSteps(stitchChange, rowDepth);
    return {
      ...base,
      method: 'slope',
      direction,
      noShaping: false,
      structuredSteps,
      instructions: buildSlopeInstructions(direction, structuredSteps),
    };
  }

  const mf = magicFormulaIntervals(rowDepth, stitchChange);
  const structuredSteps: StructuredShapingStep[] = mf.steps.map((s) => ({
    sts: s.sts,
    rows: s.rows,
    times: s.times,
  }));

  return {
    ...base,
    method: 'magic',
    direction,
    noShaping: false,
    structuredSteps,
    instructions: buildMagicInstructions(direction, mf),
  };
}
