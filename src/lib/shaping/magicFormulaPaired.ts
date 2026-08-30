/**
 * Paired (both-sides) Magic Formula shaping.
 *
 * Reuses {@link magicFormulaIntervals} — the same interval split as the Magic Formula
 * tool (`src/pages/tools/magic-formula.astro` `runShapingEngine` for both-sides).
 *
 * Does **not** call {@link computeAutoShaping}: that helper treats stitch change as a
 * one-side event count and switches to slope when `|end − start| > rows`. Socks (and
 * any both-sides tube) need `floor(|end − start| / 2)` paired events, one stitch at
 * each side, and must stay on Magic Formula.
 *
 * Never silently clamps: if the required paired events cannot fit with at least one
 * row per event, this returns a validation error instead of reducing the event count.
 */

import { magicFormulaIntervals } from "./autoShaping";
import { generateRowByRow, type ShapingStep } from "./generateRowByRow";

export type MagicFormulaPairedDirection = "none" | "increase" | "decrease";

export type MagicFormulaPairedInput = {
  startSts: number;
  endSts: number;
  rows: number;
};

export type MagicFormulaPairedEvent = {
  rowNumber: number;
  stitchesAfter: number;
  /** +2 increase or −2 decrease for one paired (both-sides) event. */
  stitchChange: number;
};

export type MagicFormulaPairedSuccess = {
  ok: true;
  method: "magic";
  noShaping: boolean;
  direction: MagicFormulaPairedDirection;
  startSts: number;
  endSts: number;
  stitchChange: number;
  pairedEventCount: number;
  rows: number;
  shortInterval: number;
  longInterval: number;
  shortCount: number;
  longCount: number;
  steps: ShapingStep[];
  shapingMode: "both";
  events: MagicFormulaPairedEvent[];
};

export type MagicFormulaPairedFailureReason =
  | "invalid-input"
  | "odd-stitch-change"
  | "too-few-rows"
  | "invalid-schedule";

export type MagicFormulaPairedFailure = {
  ok: false;
  reason: MagicFormulaPairedFailureReason;
  message: string;
};

export type MagicFormulaPairedResult = MagicFormulaPairedSuccess | MagicFormulaPairedFailure;

function isPositiveInteger(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

function emptySchedule(
  startSts: number,
  endSts: number,
  rows: number,
): MagicFormulaPairedSuccess {
  return {
    ok: true,
    method: "magic",
    noShaping: true,
    direction: "none",
    startSts,
    endSts,
    stitchChange: 0,
    pairedEventCount: 0,
    rows,
    shortInterval: 0,
    longInterval: 0,
    shortCount: 0,
    longCount: 0,
    steps: [],
    shapingMode: "both",
    events: [],
  };
}

/**
 * Distribute paired (one stitch each side) Magic Formula events between `startSts`
 * and `endSts` over `rows`. Callers pass knitting-order start/end so the expanded
 * events run in the order instructions will later follow.
 */
export function computeMagicFormulaPairedShaping(
  input: MagicFormulaPairedInput,
): MagicFormulaPairedResult {
  const startSts = input.startSts;
  const endSts = input.endSts;
  const rows = input.rows;

  if (!isPositiveInteger(startSts) || !isPositiveInteger(endSts) || !Number.isInteger(rows)) {
    return {
      ok: false,
      reason: "invalid-input",
      message: "Start stitches, target stitches, and row count must be positive whole numbers.",
    };
  }
  if (startSts < 2 || endSts < 2) {
    return {
      ok: false,
      reason: "invalid-input",
      message: "Start and target stitch counts must be at least 2.",
    };
  }
  if (rows < 1) {
    return {
      ok: false,
      reason: "invalid-input",
      message: "There must be at least 1 row available for shaping.",
    };
  }

  const stitchChange = endSts - startSts;
  const absChange = Math.abs(stitchChange);
  if (absChange % 2 !== 0) {
    return {
      ok: false,
      reason: "odd-stitch-change",
      message:
        "Stitch difference must be even so shaping can be worked in pairs (one stitch at each side).",
    };
  }

  const pairedEventCount = absChange / 2;
  if (pairedEventCount === 0) {
    return emptySchedule(startSts, endSts, rows);
  }

  if (pairedEventCount > rows) {
    return {
      ok: false,
      reason: "too-few-rows",
      message: `These socks need ${pairedEventCount} paired shaping events, but the leg is only ${rows} rows long. Lengthen the leg, reduce the circumference difference, or use a tighter row gauge.`,
    };
  }

  const mf = magicFormulaIntervals(rows, pairedEventCount);
  const scheduledEvents = mf.shortCount + mf.longCount;
  const rowSum = mf.shortCount * mf.shortInterval + mf.longCount * mf.longInterval;
  if (
    scheduledEvents !== pairedEventCount ||
    mf.shortInterval < 1 ||
    (mf.longCount > 0 && mf.longInterval < 1) ||
    rowSum !== rows
  ) {
    return {
      ok: false,
      reason: "invalid-schedule",
      message: "Magic Formula cannot distribute this leg shaping across the available rows.",
    };
  }

  const direction = stitchChange > 0 ? ("increase" as const) : ("decrease" as const);
  const stitchDeltaPerEvent = stitchChange > 0 ? 2 : -2;
  const rowEntries = generateRowByRow({
    startingStitches: startSts,
    steps: mf.steps,
    shapingMode: "both",
    direction,
  });

  const last = rowEntries[rowEntries.length - 1];
  if (
    rowEntries.length !== pairedEventCount ||
    !last ||
    last.stitchesAfter !== endSts ||
    last.rowNumber !== rows
  ) {
    return {
      ok: false,
      reason: "invalid-schedule",
      message: "Magic Formula cannot distribute this leg shaping across the available rows.",
    };
  }

  return {
    ok: true,
    method: "magic",
    noShaping: false,
    direction,
    startSts,
    endSts,
    stitchChange,
    pairedEventCount,
    rows,
    shortInterval: mf.shortInterval,
    longInterval: mf.longInterval,
    shortCount: mf.shortCount,
    longCount: mf.longCount,
    steps: mf.steps,
    shapingMode: "both",
    events: rowEntries.map((entry) => ({
      rowNumber: entry.rowNumber,
      stitchesAfter: entry.stitchesAfter,
      stitchChange: stitchDeltaPerEvent,
    })),
  };
}
