/**
 * V-neck (LEGO foundation): inner-neck decreases from V start RC to shoulder end RC on one split half (`side`).
 * Shoulder shaping overlays use the same {@link RowEntry} / {@link ShapingEvent} conventions as round neck.
 */

import type { ShapingEvent } from "../shapingTimeline";
import { distributeEvenly } from "../shapingTimeline";

export type VNeckNeckEdgeInputs = {
  /** Full piece width in stitches after armhole shaping (builder passes B before front split). */
  stitchesAfterArmhole: number;
  /** Finished neck opening width N in stitches (from neck opening × stitch gauge). */
  neckOpeningStitches: number;
  /** RC where neck-edge decreases begin on this half (after plain rows from armhole / lifeline). */
  vNeckStartRow: number;
  /** RC of last shaping row for this shoulder/neck section (same vertical budget as shoulder timeline). */
  shoulderEndRow: number;
  /** Working the split piece: decreases at the neck toward center are on this edge. */
  side: "left" | "right";
  /**
   * TODO builder: optional — derive `vNeckStartRow` from armhole checkpoint RC + `vNeckDepth` × row gauge.
   */
  rowGauge?: number;
};

export type VNeckNeckEdgePlan = {
  stitchesAfterArmhole: number;
  neckOpeningStitches: number;
  neckDecreaseStitchesPerSide: number;
  shapingRowsAvailable: number;
  /** One RC per 1-stitch decrease (may repeat RC when decreases exceed row span). */
  decreaseRows: number[];
  side: "left" | "right";
  warnings: string[];
};

/**
 * Per-side neck-edge stitch budget from finished opening N (symmetric V).
 * Uses `floor(N/2)` per product convention for half the neck opening per split side.
 */
export function neckDecreaseStitchesPerSideFromOpening(neckOpeningStitches: number): number {
  const N = Math.max(0, Math.round(neckOpeningStitches));
  return Math.floor(N / 2);
}

/**
 * RC list for `count` single inner-neck decreases on inclusive `[startRow, endRow]`:
 * - `count === span`: every carriage row (contiguous).
 * - `1 < count < span`: first decrease at `startRow`, last at `endRow`, with (count−1) gaps that differ by at most 1
 *   (classic knitting spacing — avoids unnecessary “5/8/8/5” phasing from endpoint-only rounding).
 * - `count > span`: {@link distributeEvenly} packs multiple decreases on some rows.
 */
export function distributeVNeckInnerDecreaseRows(count: number, startRow: number, endRow: number): number[] {
  const start = Math.floor(startRow);
  const end = Math.floor(endRow);
  if (count <= 0 || !Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return [];
  }
  const span = end - start + 1;
  if (span <= 0) return [];

  if (count > span) {
    return distributeEvenly(count, start, end);
  }
  if (count === 1) {
    return [start];
  }
  if (count === span) {
    return Array.from({ length: span }, (_, i) => start + i);
  }

  const totalSteps = span - 1;
  const numGaps = count - 1;
  const base = Math.floor(totalSteps / numGaps);
  const rem = totalSteps % numGaps;
  const gaps: number[] = [];
  for (let g = 0; g < numGaps; g++) {
    gaps.push(base + (g < rem ? 1 : 0));
  }
  const out: number[] = [];
  let cur = start;
  out.push(cur);
  for (let g = 0; g < numGaps; g++) {
    cur += gaps[g]!;
    out.push(cur);
  }
  return out;
}

/**
 * Computes inner-neck decrease RCs for one half of a split front (or mirrored logic on back).
 * Does not build a full {@link RowEntry} timeline — use {@link vNeckPlanToInnerEdgeEventsByRow} for events.
 */
export function calculateVNeckNeckEdgePlan(inputs: VNeckNeckEdgeInputs): VNeckNeckEdgePlan {
  const warnings: string[] = [];
  const B = Math.round(inputs.stitchesAfterArmhole);
  const N = Math.round(inputs.neckOpeningStitches);
  const vStart = Math.floor(inputs.vNeckStartRow);
  const vEnd = Math.floor(inputs.shoulderEndRow);
  const side = inputs.side;

  const neckDecreaseStitchesPerSide = neckDecreaseStitchesPerSideFromOpening(N);
  const shapingRowsAvailable = vEnd >= vStart ? vEnd - vStart + 1 : 0;

  if (!Number.isFinite(B) || B <= 0) {
    warnings.push("stitchesAfterArmhole must be a positive finite number.");
  }
  if (!Number.isFinite(N) || N <= 0) {
    warnings.push("neckOpeningStitches must be a positive finite number.");
  }
  if (!Number.isFinite(vStart) || !Number.isFinite(vEnd) || vEnd < vStart) {
    warnings.push("shoulderEndRow must be >= vNeckStartRow for a valid V-neck span.");
  }

  let decreaseRows: number[] = [];
  if (neckDecreaseStitchesPerSide > 0 && shapingRowsAvailable > 0 && vEnd >= vStart) {
    decreaseRows = distributeVNeckInnerDecreaseRows(neckDecreaseStitchesPerSide, vStart, vEnd);
  } else if (neckDecreaseStitchesPerSide > 0) {
    warnings.push("No valid row span for V-neck decreases; decreaseRows left empty.");
  }

  if (
    neckDecreaseStitchesPerSide > shapingRowsAvailable &&
    shapingRowsAvailable > 0 &&
    neckDecreaseStitchesPerSide > 0
  ) {
    warnings.push(
      `V-neck: ${neckDecreaseStitchesPerSide} neck-edge decreases exceed ${shapingRowsAvailable} shaping rows; multiple decreases on some rows.`
    );
  }

  void inputs.rowGauge;

  return {
    stitchesAfterArmhole: B,
    neckOpeningStitches: N,
    neckDecreaseStitchesPerSide,
    shapingRowsAvailable,
    decreaseRows,
    side,
    warnings,
  };
}

/**
 * Maps a V-neck plan to inner-edge {@link ShapingEvent}s keyed by RC (merged amounts when multiple
 * decreases fall on the same row). Compatible with {@link neckShoulderChartRowsFromTimeline}.
 */
export function vNeckPlanToInnerEdgeEventsByRow(plan: VNeckNeckEdgePlan): Map<number, ShapingEvent[]> {
  const counts = new Map<number, number>();
  for (const rc of plan.decreaseRows) {
    counts.set(rc, (counts.get(rc) ?? 0) + 1);
  }
  const side = plan.side;
  const map = new Map<number, ShapingEvent[]>();
  const sorted = [...counts.keys()].sort((a, b) => a - b);
  for (const rc of sorted) {
    const amt = counts.get(rc) ?? 0;
    if (amt <= 0) continue;
    map.set(rc, [{ kind: "decrease", side, edge: "inner", amount: amt }]);
  }
  return map;
}

/**
 * Public, garment-agnostic inputs for {@link buildVNecklinePlan}.
 *
 * The names mirror how the sleeveless / set-in-sleeve / drop-shoulder / cardigan builders already
 * describe the V-neck section, so this block can be lifted into future sweater patterns without
 * adapter code.
 */
export type BuildVNecklinePlanInputs = {
  /** B — total stitches across the piece after armhole shaping (before the front split). */
  stitchesAfterArmhole: number;
  /** N — finished neck opening width in stitches (neck opening inches × stitch gauge). */
  neckWidthSts: number;
  /**
   * Vertical row budget reserved for the V-neck section (from V start row through last shaping row,
   * inclusive). Used as a sanity-check against `firstShapingRow` / `lastShapingRow`; not used to drive
   * math when both rows are supplied so the builder retains full control.
   */
  neckDepthRows: number;
  /** Rows per inch — kept on the plan for downstream chart/SVG/instructions; not required for math. */
  rowGauge?: number;
  /** Which split half this plan describes (decreases land on the inner edge of this side). */
  side: "left" | "right";
  /** RC of the first inner-neck decrease row (V start). */
  firstShapingRow: number;
  /** RC of the last shaping row for the V-neck section (typically same RC as last shoulder shaping row). */
  lastShapingRow: number;
};

/**
 * Structured V-neck plan returned by {@link buildVNecklinePlan}.
 *
 * Contract:
 * - V-neck shaping starts at the neckline depth row (`firstShapingRow`) and ends at `lastShapingRow`.
 * - All decreases happen at the **inner** neck edge of this `side`.
 * - Shoulder shaping is **not** included here — merge it on the same RC axis in the builder
 *   (see `vNeckShoulderBridge.buildVNeckShoulderEventsByRow`) so this block can be reused by
 *   pieces with different shoulder shapes (set-in sleeve, drop shoulder, cardigan, etc.).
 * - The returned data is intended for chart/SVG/instruction builders to consume — no HTML.
 */
export type VNecklinePlan = {
  side: "left" | "right";
  stitchesAfterArmhole: number;
  neckWidthSts: number;
  neckDepthRows: number;
  firstShapingRow: number;
  lastShapingRow: number;
  /** Row span actually available between `firstShapingRow` and `lastShapingRow`, inclusive. */
  shapingRowsAvailable: number;
  /** Per-side inner-neck stitch budget (`floor(neckWidthSts / 2)` by product convention). */
  neckDecreaseStitchesPerSide: number;
  /** Flat list of RCs, one entry per 1-stitch decrease (may repeat when the row span is too short). */
  decreaseRows: number[];
  /** Inner-neck {@link ShapingEvent}s keyed by RC (amounts merged when multiple land on the same row). */
  eventsByRow: Map<number, ShapingEvent[]>;
  warnings: string[];
};

/**
 * Build a structured V-neck shaping plan for one split-front half.
 *
 * Reusable across sleeveless, set-in sleeve, drop shoulder, cardigan, etc. — the inputs describe
 * "where the neck section sits in row time" (`firstShapingRow` / `lastShapingRow`) plus the neck
 * stitch budget; no garment-specific knowledge leaks into this block.
 *
 * What this block does:
 * - V-neck shaping starts at the neckline depth row (`firstShapingRow`).
 * - Decreases happen at the **inner** neck edge only (one per `side`).
 * - Shoulder shaping stays separate so each garment type can layer its own shoulder schedule on
 *   the same RC axis (use the bridge helper in `vNeckShoulderBridge.ts`).
 * - Returns data for downstream chart / SVG / instruction builders — never HTML.
 *
 * Math note: numbers (per-side decrease count, even spacing) are derived from
 * {@link calculateVNeckNeckEdgePlan}. To adjust V-neck math after Sue confirms numbers, edit
 * {@link neckDecreaseStitchesPerSideFromOpening} and / or {@link distributeVNeckInnerDecreaseRows} in
 * {@link calculateVNeckNeckEdgePlan} — the public {@link BuildVNecklinePlanInputs} shape stays stable.
 */
export function buildVNecklinePlan(inputs: BuildVNecklinePlanInputs): VNecklinePlan {
  const stitchesAfterArmhole = Math.round(inputs.stitchesAfterArmhole);
  const neckWidthSts = Math.round(inputs.neckWidthSts);
  const neckDepthRows = Math.floor(inputs.neckDepthRows);
  const firstShapingRow = Math.floor(inputs.firstShapingRow);
  const lastShapingRow = Math.floor(inputs.lastShapingRow);
  const side = inputs.side;

  const corePlan = calculateVNeckNeckEdgePlan({
    stitchesAfterArmhole,
    neckOpeningStitches: neckWidthSts,
    vNeckStartRow: firstShapingRow,
    shoulderEndRow: lastShapingRow,
    side,
    rowGauge: inputs.rowGauge,
  });

  const warnings = [...corePlan.warnings];
  if (
    Number.isFinite(neckDepthRows) &&
    neckDepthRows > 0 &&
    neckDepthRows !== corePlan.shapingRowsAvailable
  ) {
    warnings.push(
      `V-neck row budget mismatch: neckDepthRows=${neckDepthRows} but firstShapingRow..lastShapingRow span=${corePlan.shapingRowsAvailable}. Using the explicit row span.`
    );
  }

  const eventsByRow = vNeckPlanToInnerEdgeEventsByRow(corePlan);

  return {
    side,
    stitchesAfterArmhole: corePlan.stitchesAfterArmhole,
    neckWidthSts: corePlan.neckOpeningStitches,
    neckDepthRows,
    firstShapingRow,
    lastShapingRow,
    shapingRowsAvailable: corePlan.shapingRowsAvailable,
    neckDecreaseStitchesPerSide: corePlan.neckDecreaseStitchesPerSide,
    decreaseRows: [...corePlan.decreaseRows],
    eventsByRow,
    warnings,
  };
}
