/**
 * Sleeveless A-line body shaping (hem/hip → bust), straight fit unchanged.
 */

import { distributeVNeckInnerDecreaseRows } from "./legoBlocks/vNeckline";
import {
  SLEEVELESS_ALINE_HIP_MAX_INCHES_ABOVE_BUST,
  SLEEVELESS_ALINE_MAX_SIDE_STITCH_CHANGE_RATIO,
} from "./sleevelessHipSizingLimits";

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

export function isSleevelessAlineBodyShape(patternData: Record<string, unknown>): boolean {
  const style = section(patternData.style);
  const fit = section(patternData.fit);
  const legacy = section(patternData.fitConfig);
  const shape =
    (typeof style.bodyShape === "string" && style.bodyShape) ||
    (typeof legacy.shape === "string" && legacy.shape) ||
    "";
  return shape === "aline";
}

function evenPositiveInt(n: number): number {
  const v = Math.max(0, Math.round(n));
  if (v <= 0) return 0;
  return v % 2 === 0 ? v : v + 1;
}

function formatRcColon(rc: number): string {
  const n = Math.max(0, Math.floor(rc));
  return `RC:${String(n).padStart(3, "0")}`;
}

export type SleevelessAlineShapingType = "straight" | "decrease-to-bust" | "increase-to-bust";

export type SleevelessAlineBodyZonePlan = {
  rows: number;
  endSts: number;
  shapingRowNumbers: number[];
  instructionLines: string[];
};

export type SleevelessAlineBodyShapingPlan = {
  shapingType: SleevelessAlineShapingType;
  hemCastOnSts: number;
  bustBodySts: number;
  /** Total stitch count change on the piece (both side edges combined). */
  totalStitchDifference: number;
  /** One decrease/increase at each side edge per shaping row. */
  pairedShapingRows: number;
  shapingRowNumbers: number[];
  /**
   * Diagram `HIP_ROWS`: rows from hem/cast-on edge to the hip line.
   * For sleeveless A-line the hip line is the cast-on / hem width (0 rows above that edge).
   */
  hipRowsFromHem: number;
  bodyFirstHalf: SleevelessAlineBodyZonePlan;
  bodySecondHalf: SleevelessAlineBodyZonePlan;
  warnings: string[];
};

export type ComputeSleevelessAlineBodyShapingArgs = {
  bustBodySts: number;
  finishedHipInches: number | undefined;
  finishedBustInches: number | undefined;
  stitchesPerInch: number;
  bodyToArmholeRows: number;
  /** Ribbed hem rows — shaping RCs start after this (not inside the hem). */
  hemRows: number;
};

function formatBodyShapingInstruction(
  shapingType: SleevelessAlineShapingType,
  rowNumbers: readonly number[],
): string[] {
  if (shapingType === "straight" || rowNumbers.length === 0) return [];
  const verb = shapingType === "decrease-to-bust" ? "Decrease" : "Increase";
  const list = rowNumbers.map((r) => formatRcColon(r)).join(", ");
  return [`${verb} 1 stitch at each side edge on the following rows: ${list}.`];
}

/** Evenly space paired shaping rows between the first body row and the armhole. */
export function distributeSleevelessAlineBodyShapingRows(
  hemRows: number,
  bodyToArmholeRows: number,
  pairedShapingRows: number,
): number[] {
  if (pairedShapingRows <= 0 || bodyToArmholeRows <= 0) return [];
  const startRow = Math.max(0, Math.floor(hemRows)) + 1;
  const endRow = Math.max(startRow, Math.floor(hemRows) + Math.floor(bodyToArmholeRows));
  return distributeVNeckInnerDecreaseRows(pairedShapingRows, startRow, endRow);
}

function buildZonePlan(
  rows: number,
  endSts: number,
  shapingType: SleevelessAlineShapingType,
  shapingRowNumbers: readonly number[],
): SleevelessAlineBodyZonePlan {
  return {
    rows,
    endSts,
    shapingRowNumbers: [...shapingRowNumbers],
    instructionLines: formatBodyShapingInstruction(shapingType, shapingRowNumbers),
  };
}

/**
 * When A-line applies, returns cast-on at hip/hem width and side shaping across the body
 * (after the ribbed hem) to bust width at the armhole. Hip is at the cast-on edge, not mid-body.
 */
export function computeSleevelessAlineBodyShaping(
  args: ComputeSleevelessAlineBodyShapingArgs,
): SleevelessAlineBodyShapingPlan | null {
  const {
    bustBodySts,
    finishedHipInches,
    finishedBustInches,
    stitchesPerInch,
    bodyToArmholeRows,
    hemRows,
  } = args;
  const warnings: string[] = [];

  if (bustBodySts <= 0 || bodyToArmholeRows <= 0 || stitchesPerInch <= 0) {
    return null;
  }

  const hipCirc =
    finishedHipInches !== undefined && finishedHipInches > 0
      ? finishedHipInches
      : finishedBustInches;
  if (hipCirc === undefined || hipCirc <= 0) {
    return null;
  }

  const hipBodyRaw = Math.round(hipCirc * stitchesPerInch) / 2;
  const hemCastOnSts = evenPositiveInt(hipBodyRaw);
  const totalStitchDifference = Math.abs(hemCastOnSts - bustBodySts);
  const pairedShapingRows = totalStitchDifference / 2;

  const maxSideChange = Math.max(
    1,
    Math.floor(bustBodySts * SLEEVELESS_ALINE_MAX_SIDE_STITCH_CHANGE_RATIO),
  );
  if (totalStitchDifference > maxSideChange) {
    const isFlare = hemCastOnSts > bustBodySts;
    warnings.push(
      isFlare
        ? `A-line hip flare is large (${totalStitchDifference} stitches across the body) — verify hip measurement and body length in Fit.`
        : `A-line hip taper is large (${totalStitchDifference} stitches across the body) — verify hip measurement and body length in Fit.`,
    );
  }

  let shapingType: SleevelessAlineShapingType = "straight";
  if (hemCastOnSts > bustBodySts) {
    shapingType = "decrease-to-bust";
  } else if (hemCastOnSts < bustBodySts) {
    shapingType = "increase-to-bust";
  }

  const shapingRowNumbers =
    shapingType === "straight"
      ? []
      : distributeSleevelessAlineBodyShapingRows(hemRows, bodyToArmholeRows, pairedShapingRows);

  const firstHalfRows = Math.floor(bodyToArmholeRows / 2);
  const secondHalfRows = bodyToArmholeRows - firstHalfRows;
  const firstZoneEndRc = Math.max(0, Math.floor(hemRows)) + firstHalfRows;
  const firstZoneRows = shapingRowNumbers.filter((r) => r <= firstZoneEndRc);
  const secondZoneRows = shapingRowNumbers.filter((r) => r > firstZoneEndRc);

  const stsChangeAfterFirst = firstZoneRows.length * 2;
  const bodyFirstEndSts =
    shapingType === "decrease-to-bust"
      ? hemCastOnSts - stsChangeAfterFirst
      : shapingType === "increase-to-bust"
        ? hemCastOnSts + stsChangeAfterFirst
        : hemCastOnSts;

  const bodyFirstHalf = buildZonePlan(firstHalfRows, bodyFirstEndSts, shapingType, firstZoneRows);
  const bodySecondHalf = buildZonePlan(
    secondHalfRows,
    bustBodySts,
    shapingType,
    secondZoneRows,
  );

  return {
    shapingType,
    hemCastOnSts,
    bustBodySts,
    totalStitchDifference,
    pairedShapingRows,
    shapingRowNumbers,
    hipRowsFromHem: 0,
    bodyFirstHalf,
    bodySecondHalf,
    warnings,
  };
}

export function hipInchesAboveBustForValidation(
  finishedHip: number | undefined,
  finishedBust: number | undefined,
): number | undefined {
  if (finishedHip === undefined || finishedBust === undefined) return undefined;
  return finishedHip - finishedBust;
}

export { SLEEVELESS_ALINE_HIP_MAX_INCHES_ABOVE_BUST };
