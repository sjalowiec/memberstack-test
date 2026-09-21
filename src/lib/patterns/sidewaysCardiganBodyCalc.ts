/**
 * Pure sideways-cardigan body math (rotated gauge, true drop shoulder).
 *
 * Do not use {@link sleevelessBackHalfStitchesFromCircumference} or other bottom-up
 * half-circumference stitch helpers here. In this construction:
 *
 * - Garment length, V-neck depth, and armhole-slit depth are stitch-gauge dimensions.
 * - Finished bust, neck-opening widths, and shoulder spans are row-gauge dimensions.
 *
 * Each armhole is a bind-off / immediate cast-on slit. It does not occupy body rows.
 * Slit depth is half the finished upper-arm measurement (the sleeve top is sewn around
 * both sides of the slit). The straight sleeve top still uses the full upper arm.
 *
 * Garment sections are the primary row calculations:
 *   frontRows = round((finishedBust / 4) × rowsPerInch)
 *   rawHalfNeckRows = round((neckOpening / 2) × rowsPerInch)
 *   halfNeckRows = rawHalfNeckRows, or the next even integer when raw is odd
 *     (short-row V shaping is every other row, so each V must occupy an even row count)
 *   backRows = 2 × frontRows
 *   backNeckRows = 2 × halfNeckRows
 *   shoulderRows = frontRows − halfNeckRows
 *   actualTotalBustRows = 4 × frontRows
 *
 * Cardigan and pullover use the same geometry (half the circumference in the front,
 * half in the back) and different knitting sequences. Body rows are seven sections:
 *   Cardigan: V1 → front shoulder 1 → back shoulder 1 → back neck →
 *             back shoulder 2 → front shoulder 2 → V2
 *   Pullover: front shoulder 1 → V1 → V2 → front shoulder 2 →
 *             back shoulder 1 → back neck → back shoulder 2
 *
 * The two slits sit at the side-seam boundaries (between the front and back shoulders).
 * A pullover knits only one slit; the cast-on / bind-off edges form the other.
 */

import { computeDropShoulderArmholeDepthInches } from "./dropShoulderArmholeDepth";
import { evenPositiveBodyStitches } from "./sleevelessBodyStitchMath";
import { inchesToRows, rowsToInches } from "./sleevelessRowAccounting";

export const SIDEWAYS_CARDIGAN_BODY_ROW_SECTION_KEYS = [
  "firstFrontVNeckShapingRows",
  "firstFrontShoulderRows",
  "firstBackShoulderRows",
  "backNeckOpeningRows",
  "secondBackShoulderRows",
  "secondFrontShoulderRows",
  "secondFrontVNeckShapingRows",
] as const;

export type SidewaysCardiganBodyRowSectionKey =
  (typeof SIDEWAYS_CARDIGAN_BODY_ROW_SECTION_KEYS)[number];

export type SidewaysCardiganBodyCalcInput = {
  garmentLengthInches: number;
  vNeckDepthInches: number;
  finishedBustCircumferenceInches: number;
  /** Finished sleeve upper-arm circumference — the straight sleeve top. */
  finishedUpperArmInches: number;
  neckOpeningWidthInches: number;
  /** Chart back-neck depth (straight rectangular opening). Optional on row-allocation only. */
  backNeckDepthInches?: number;
  stitchesPerInch: number;
  rowsPerInch: number;
};

export type SidewaysCardiganFrontPanel = {
  vNeckShapingRows: number;
  shoulderRows: number;
};

export type SidewaysCardiganShoulderRows = {
  firstFrontRows: number;
  firstBackRows: number;
  secondBackRows: number;
  secondFrontRows: number;
};

export type SidewaysCardiganBodyRowSequence = {
  firstFrontVNeckShapingRows: number;
  firstFrontShoulderRows: number;
  firstBackShoulderRows: number;
  backNeckOpeningRows: number;
  secondBackShoulderRows: number;
  secondFrontShoulderRows: number;
  secondFrontVNeckShapingRows: number;
};

/** Bind-off / cast-on slit at a side-seam boundary — not a body-row section. */
export type SidewaysCardiganArmholeSlit = {
  depthInches: number;
  depthStitches: number;
  afterSection: "firstFrontShoulder" | "secondBackShoulder";
  beforeSection: "firstBackShoulder" | "secondFrontShoulder";
};

export type SidewaysCardiganBustRowFit = {
  requestedTotalBustRows: number;
  actualTotalBustRows: number;
  requestedFinishedBustInches: number;
  actualFinishedBustInches: number;
  adjustmentRows: number;
  adjustmentInches: number;
};

export const SIDEWAYS_CARDIGAN_NON_POSITIVE_SHOULDER_ROWS = "non-positive-shoulder-rows";

export type SidewaysCardiganBodyCalcError = {
  code: typeof SIDEWAYS_CARDIGAN_NON_POSITIVE_SHOULDER_ROWS;
  message: string;
  requestedTotalBustRows: number;
  requestedFinishedBustInches: number;
  neckOpeningRows: number;
  rawHalfNeckRows: number;
  halfNeckRows: number;
  frontRows: number;
  remainingRowsForShoulders: number;
  roundedShoulderRows: number;
};

export type SidewaysCardiganBodyCalc = {
  garmentLengthStitches: number;
  vNeckDepthStitches: number;
  backNeckDepthInches: number;
  backNeckDepthStitches: number;
  armholeDepthInches: number;
  armholeDepthStitches: number;
  firstArmholeDepthStitches: number;
  secondArmholeDepthStitches: number;
  armholeSlits: {
    first: SidewaysCardiganArmholeSlit;
    second: SidewaysCardiganArmholeSlit;
  };
  frontRows: number;
  backRows: number;
  /**
   * Raw half-neck rows: round((neckOpening / 2) × rowsPerInch). May be odd.
   * Short-row V shaping uses {@link halfNeckRows}, which rounds an odd raw value up to even.
   */
  rawHalfNeckRows: number;
  /** Even half-neck rows used for V shaping, back neck, and shoulders. */
  halfNeckRows: number;
  /** Raw full-neck rows: round(neckOpening × rowsPerInch). May be odd. */
  neckOpeningRows: number;
  frontNeckOpeningRows: number;
  backNeckOpeningRows: number;
  shoulders: SidewaysCardiganShoulderRows;
  fronts: {
    first: SidewaysCardiganFrontPanel;
    second: SidewaysCardiganFrontPanel;
  };
  bodyRowSequence: SidewaysCardiganBodyRowSequence;
  bust: SidewaysCardiganBustRowFit;
};

export type SidewaysCardiganBodyCalcResult =
  | { ok: true; calc: SidewaysCardiganBodyCalc }
  | { ok: false; error: SidewaysCardiganBodyCalcError };

function stitchesAlongLength(inches: number, stitchesPerInch: number): number {
  if (!(inches > 0) || !(stitchesPerInch > 0)) return 0;
  return evenPositiveBodyStitches(inches * stitchesPerInch);
}

function rowsAlongCircumference(inches: number, rowsPerInch: number): number {
  return inchesToRows(inches, rowsPerInch);
}

/**
 * Short-row V shaping is every other row. An odd raw half-neck row count cannot
 * complete the last two-row interval, so it rounds up to the next even integer.
 */
export function evenRowCountForShortRowShaping(rawRows: number): number {
  const n = Math.max(0, Math.trunc(rawRows));
  if (n === 0) return 0;
  return n % 2 === 0 ? n : n + 1;
}

function identicalShoulders(rows: number): SidewaysCardiganShoulderRows {
  return {
    firstFrontRows: rows,
    firstBackRows: rows,
    secondBackRows: rows,
    secondFrontRows: rows,
  };
}

function identicalFronts(panel: SidewaysCardiganFrontPanel): {
  first: SidewaysCardiganFrontPanel;
  second: SidewaysCardiganFrontPanel;
} {
  return { first: { ...panel }, second: { ...panel } };
}

export function calculateSidewaysCardiganBody(
  input: SidewaysCardiganBodyCalcInput,
): SidewaysCardiganBodyCalcResult {
  const garmentLengthStitches = stitchesAlongLength(
    input.garmentLengthInches,
    input.stitchesPerInch,
  );
  const vNeckDepthStitches = stitchesAlongLength(input.vNeckDepthInches, input.stitchesPerInch);
  const backNeckDepthInches =
    input.backNeckDepthInches !== undefined && input.backNeckDepthInches > 0
      ? input.backNeckDepthInches
      : 0;
  const backNeckDepthStitches = stitchesAlongLength(backNeckDepthInches, input.stitchesPerInch);
  const requestedTotalBustRows = rowsAlongCircumference(
    input.finishedBustCircumferenceInches,
    input.rowsPerInch,
  );
  const neckOpeningRows = rowsAlongCircumference(
    input.neckOpeningWidthInches,
    input.rowsPerInch,
  );
  const frontRows = rowsAlongCircumference(
    input.finishedBustCircumferenceInches / 4,
    input.rowsPerInch,
  );
  const rawHalfNeckRows = rowsAlongCircumference(
    input.neckOpeningWidthInches / 2,
    input.rowsPerInch,
  );
  const halfNeckRows = evenRowCountForShortRowShaping(rawHalfNeckRows);
  const backRows = 2 * frontRows;
  const backNeckRows = 2 * halfNeckRows;
  const shoulderRows = frontRows - halfNeckRows;
  const armholeDepthInches =
    computeDropShoulderArmholeDepthInches(input.finishedUpperArmInches) ?? 0;
  const armholeDepthStitches = stitchesAlongLength(
    armholeDepthInches,
    input.stitchesPerInch,
  );

  if (shoulderRows <= 0) {
    return {
      ok: false,
      error: {
        code: SIDEWAYS_CARDIGAN_NON_POSITIVE_SHOULDER_ROWS,
        message:
          "These measurements leave no rows for the four identical shoulder sections. Reduce the neck-opening width or increase the finished bust.",
        requestedTotalBustRows,
        requestedFinishedBustInches: input.finishedBustCircumferenceInches,
        neckOpeningRows,
        rawHalfNeckRows,
        halfNeckRows,
        frontRows,
        remainingRowsForShoulders: shoulderRows,
        roundedShoulderRows: shoulderRows,
      },
    };
  }

  const actualTotalBustRows = 4 * frontRows;
  const actualFinishedBustInches =
    rowsToInches(actualTotalBustRows, input.rowsPerInch) ?? 0;
  const adjustmentRows = actualTotalBustRows - requestedTotalBustRows;
  const adjustmentInches = rowsToInches(adjustmentRows, input.rowsPerInch) ?? 0;

  const frontPanel: SidewaysCardiganFrontPanel = {
    vNeckShapingRows: halfNeckRows,
    shoulderRows,
  };
  const shoulders = identicalShoulders(shoulderRows);
  const bodyRowSequence: SidewaysCardiganBodyRowSequence = {
    firstFrontVNeckShapingRows: halfNeckRows,
    firstFrontShoulderRows: shoulders.firstFrontRows,
    firstBackShoulderRows: shoulders.firstBackRows,
    backNeckOpeningRows: backNeckRows,
    secondBackShoulderRows: shoulders.secondBackRows,
    secondFrontShoulderRows: shoulders.secondFrontRows,
    secondFrontVNeckShapingRows: halfNeckRows,
  };

  return {
    ok: true,
    calc: {
      garmentLengthStitches,
      vNeckDepthStitches,
      backNeckDepthInches,
      backNeckDepthStitches,
      armholeDepthInches,
      armholeDepthStitches,
      firstArmholeDepthStitches: armholeDepthStitches,
      secondArmholeDepthStitches: armholeDepthStitches,
      armholeSlits: {
        first: {
          depthInches: armholeDepthInches,
          depthStitches: armholeDepthStitches,
          afterSection: "firstFrontShoulder",
          beforeSection: "firstBackShoulder",
        },
        second: {
          depthInches: armholeDepthInches,
          depthStitches: armholeDepthStitches,
          afterSection: "secondBackShoulder",
          beforeSection: "secondFrontShoulder",
        },
      },
      frontRows,
      backRows,
      rawHalfNeckRows,
      halfNeckRows,
      neckOpeningRows,
      frontNeckOpeningRows: halfNeckRows,
      backNeckOpeningRows: backNeckRows,
      shoulders,
      fronts: identicalFronts(frontPanel),
      bodyRowSequence,
      bust: {
        requestedTotalBustRows,
        actualTotalBustRows,
        requestedFinishedBustInches: input.finishedBustCircumferenceInches,
        actualFinishedBustInches,
        adjustmentRows,
        adjustmentInches,
      },
    },
  };
}

export function armholeSlitsMatch(calc: SidewaysCardiganBodyCalc): boolean {
  return calc.firstArmholeDepthStitches === calc.secondArmholeDepthStitches;
}

/** Two V sections match; each V is half the back-neck; two V sections equal one back-neck. */
export function neckSectionsMatch(calc: SidewaysCardiganBodyCalc): boolean {
  const seq = calc.bodyRowSequence;
  return (
    seq.firstFrontVNeckShapingRows === seq.secondFrontVNeckShapingRows &&
    seq.firstFrontVNeckShapingRows * 2 === seq.backNeckOpeningRows &&
    calc.fronts.first.vNeckShapingRows === calc.fronts.second.vNeckShapingRows &&
    calc.fronts.first.vNeckShapingRows * 2 === calc.backNeckOpeningRows &&
    calc.frontNeckOpeningRows === seq.firstFrontVNeckShapingRows &&
    calc.halfNeckRows === seq.firstFrontVNeckShapingRows &&
    calc.backNeckOpeningRows === seq.backNeckOpeningRows
  );
}

export function garmentSectionIdentitiesHold(calc: SidewaysCardiganBodyCalc): boolean {
  const shoulder = calc.shoulders.firstFrontRows;
  return (
    calc.frontRows === calc.halfNeckRows + shoulder &&
    calc.backRows === 2 * calc.frontRows &&
    calc.backRows === shoulder + calc.backNeckOpeningRows + shoulder &&
    calc.bust.actualTotalBustRows === 4 * calc.frontRows &&
    calc.bust.actualTotalBustRows === 2 * calc.backRows &&
    calc.backNeckOpeningRows === 2 * calc.halfNeckRows
  );
}

export function shoulderRowCountsMatch(calc: SidewaysCardiganBodyCalc): boolean {
  const { firstFrontRows, firstBackRows, secondBackRows, secondFrontRows } = calc.shoulders;
  return (
    firstFrontRows === firstBackRows &&
    firstBackRows === secondBackRows &&
    secondBackRows === secondFrontRows
  );
}

export function frontsAreMirrored(calc: SidewaysCardiganBodyCalc): boolean {
  return (
    calc.fronts.first.vNeckShapingRows === calc.fronts.second.vNeckShapingRows &&
    calc.fronts.first.shoulderRows === calc.fronts.second.shoulderRows
  );
}

export function sevenSectionsSumToActualBustRows(calc: SidewaysCardiganBodyCalc): boolean {
  return sumBodyRowSections(calc.bodyRowSequence) === calc.bust.actualTotalBustRows;
}

export function sumBodyRowSections(sequence: SidewaysCardiganBodyRowSequence): number {
  return SIDEWAYS_CARDIGAN_BODY_ROW_SECTION_KEYS.reduce(
    (sum, key) => sum + sequence[key],
    0,
  );
}

export function hasNoArmholeRowSections(calc: SidewaysCardiganBodyCalc): boolean {
  const keys = Object.keys(calc.bodyRowSequence);
  return (
    keys.length === SIDEWAYS_CARDIGAN_BODY_ROW_SECTION_KEYS.length &&
    keys.every((key) =>
      (SIDEWAYS_CARDIGAN_BODY_ROW_SECTION_KEYS as readonly string[]).includes(key),
    ) &&
    !keys.some((key) => /armhole/i.test(key)) &&
    !("armholeOpeningRows" in calc) &&
    !("firstArmholeOpeningRows" in calc) &&
    !("secondArmholeOpeningRows" in calc) &&
    !("rowAllocation" in calc)
  );
}
