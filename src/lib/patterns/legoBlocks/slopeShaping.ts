/**
 * General slope shaping: distribute more stitches than rows across every-other-row actions.
 * Uses the same stitch-distribution math as {@link distributeTotalAcrossRows}.
 * Japanese notation uses the shared `Ns-Mr-Kx` formatter ({@link formatShapingSegment}).
 */

import { distributeTotalAcrossRows } from "../distributeTotalAcrossRows";
import { formatShapingSegment } from "../shapingNotationCompress";

export type SlopeStep = {
  stitches: number;
  times: number;
};

export type SlopeShapingSuccess = {
  ok: true;
  stitches: number;
  rows: number;
  /** Always 2 — shaping occurs every other row. */
  rowInterval: 2;
  shapingActions: number;
  /** Per-action stitch amounts, larger amounts first. */
  sequence: number[];
  /** Run-length compressed instruction groups matching `sequence`. */
  steps: SlopeStep[];
};

export type SlopeShapingFailure = {
  ok: false;
  reason: "invalid" | "not-slope";
};

export type SlopeShapingResult = SlopeShapingSuccess | SlopeShapingFailure;

/** One shaping action on a specific row counter. */
export type SlopeRowAction = {
  rc: number;
  stitches: number;
};

/**
 * Practical knitting output derived from a successful {@link calculateSlopeShaping} result.
 * Summary, row-by-row directions, and Japanese notation all share this same distribution.
 */
export type SlopeShapingPresentation = {
  summary: string;
  rowByRow: SlopeRowAction[];
  /** Japanese notation lines in working order (`Ns-Mr-Kx`). */
  japaneseNotationLines: string[];
};

function isPositiveWholeNumber(n: number): boolean {
  return Number.isFinite(n) && Number.isInteger(n) && n > 0;
}

function stitchWord(n: number): string {
  return n === 1 ? "1 stitch" : `${n} stitches`;
}

function timesWord(n: number): string {
  return n === 1 ? "1 time" : `${n} times`;
}

/** Compress a shaping sequence into consecutive stitch/times groups. */
export function compressSlopeSequence(sequence: readonly number[]): SlopeStep[] {
  const steps: SlopeStep[] = [];
  for (const stitches of sequence) {
    if (!Number.isFinite(stitches) || stitches <= 0) continue;
    const amount = Math.round(stitches);
    const last = steps[steps.length - 1];
    if (last && last.stitches === amount) {
      last.times += 1;
    } else {
      steps.push({ stitches: amount, times: 1 });
    }
  }
  return steps;
}

/**
 * Japanese notation lines from compressed slope steps.
 * Always uses the slope row interval (every other row → `2r`).
 */
export function slopeJapaneseNotationLines(
  steps: readonly SlopeStep[],
  rowInterval: number = 2,
): string[] {
  return steps.map((step) => formatShapingSegment(step.stitches, rowInterval, step.times));
}

/** Row-counter actions starting at RC 0, advancing by `rowInterval`. */
export function slopeRowByRowActions(
  sequence: readonly number[],
  rowInterval: number = 2,
): SlopeRowAction[] {
  return sequence.map((stitches, index) => ({
    rc: index * rowInterval,
    stitches,
  }));
}

function formatStepClause(step: SlopeStep): string {
  return `bind off or hold ${stitchWord(step.stitches)} at the shaping edge every other row, ${timesWord(step.times)}`;
}

/** Concise summary instruction(s) for the compressed step groups. */
export function slopeSummaryInstruction(steps: readonly SlopeStep[]): string {
  if (steps.length === 0) return "";
  if (steps.length === 1) {
    return `Beginning at RC 0, ${formatStepClause(steps[0]!)}.`;
  }
  const parts = steps.map((step, index) => {
    if (index === 0) return `Beginning at RC 0, ${formatStepClause(step)}`;
    return `then ${formatStepClause(step)}`;
  });
  return `${parts.join("; ")}.`;
}

/** Build practical knitting output from a successful slope calculation. */
export function buildSlopeShapingPresentation(
  result: SlopeShapingSuccess,
): SlopeShapingPresentation {
  const rowByRow = slopeRowByRowActions(result.sequence, result.rowInterval);
  const japaneseNotationLines = slopeJapaneseNotationLines(result.steps, result.rowInterval);
  const summary = slopeSummaryInstruction(result.steps);
  return { summary, rowByRow, japaneseNotationLines };
}

/**
 * Calculate every-other-row slope shaping when there are more stitches than rows.
 *
 * @param stitches - Positive whole number of stitches to shape
 * @param rows - Positive whole number of rows available
 */
export function calculateSlopeShaping(stitches: number, rows: number): SlopeShapingResult {
  if (!isPositiveWholeNumber(stitches) || !isPositiveWholeNumber(rows)) {
    return { ok: false, reason: "invalid" };
  }

  if (stitches <= rows) {
    return { ok: false, reason: "not-slope" };
  }

  const shapingActions = Math.ceil(rows / 2);
  const sequence = distributeTotalAcrossRows(stitches, shapingActions);
  const steps = compressSlopeSequence(sequence);

  return {
    ok: true,
    stitches,
    rows,
    rowInterval: 2,
    shapingActions,
    sequence,
    steps,
  };
}
