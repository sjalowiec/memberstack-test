/**
 * Read-only Drop Shoulder diagram adapter.
 *
 * Copies already-calculated pattern values into a structured model for SVG
 * renderers. Does not compute stitches, rows, shaping, or sizing.
 *
 * Width/length labels use finished measurements already stored on the pattern.
 * A span with no stored measurement keeps its stitch or row count only.
 */

import {
  formatPatternDiagramCountLabel,
  formatPatternDiagramMeasurement,
} from "./patternStitchesRowsDiagramLabel";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import { cardiganFrontNeckOpeningStitches } from "./roundNeckNotation";
import {
  dropShoulderDiagramBodyShapeFromPattern,
  dropShoulderGarmentFromPattern,
  dropShoulderNecklineFromPattern,
  type DropShoulderBodyShape,
  type DropShoulderGarment,
  type DropShoulderNeckline,
} from "./dropShoulderDiagramSvgResolver";

export type DropShoulderDiagramUnit = "in" | "cm";

export type DropShoulderBackStitchesRowsModel = {
  unit: DropShoulderDiagramUnit;
  stitchesPerInch: number;
  rowsPerInch: number;
  hemStitches: number;
  bodyWidthStitches: number;
  crossShoulderStitches: number;
  necklineStitches: number;
  shoulderStitchesEach: number;
  hemRows: number;
  /** Rows from top of hem to the armhole marker. */
  bodyRowsToArmhole: number;
  /**
   * Full physical armhole depth (marker → shoulder), including neckline rows
   * worked after a row-counter reset.
   */
  armholeRows: number;
  /** Back neckline depth in rows — a subset of {@link armholeRows}, never added to it. */
  backNeckDepthRows: number;
  /** `min(backNeckDepthRows, armholeRows)` — neck cutout height inside the armhole span. */
  necklineRowsInsideArmhole: number;
  /** Rows from the armhole marker up to the start of neckline depth. */
  armholeEvenRows: number;
  rowsFromCastOnToArmhole: number;
  finalRC: number;
  hemStitchesLabel: string;
  bodyWidthLabel: string;
  crossShoulderLabel: string;
  necklineWidthLabel: string;
  shoulderStitchesLabel: string;
  hemDepthLabel: string;
  bodyLengthLabel: string;
  /** e.g. `36 rows / 4.5 in` */
  armholeDepthLabel: string;
  necklineDepthLabel: string;
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function positiveInt(n: unknown): number {
  if (!isFiniteNumber(n) || n <= 0) return 0;
  return Math.max(0, Math.round(n));
}

function storedInches(n: unknown): number | undefined {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
}

function formatStitchWidthLabel(
  stitches: number,
  inches: number | undefined,
  unit: DropShoulderDiagramUnit,
): string {
  const sts = positiveInt(stitches);
  if (sts <= 0) return "";
  return formatPatternDiagramCountLabel(sts, "sts", formatPatternDiagramMeasurement(inches, unit));
}

function formatRowsLengthLabel(
  rows: number,
  inches: number | undefined,
  unit: DropShoulderDiagramUnit,
): string {
  const rowN = Math.max(0, Math.round(rows));
  if (rowN <= 0) return "";
  return formatPatternDiagramCountLabel(rowN, "rows", formatPatternDiagramMeasurement(inches, unit));
}

/**
 * Back Stitches & Rows diagram model from an existing Drop Shoulder pattern result.
 * Returns `null` when required debug fields are missing (renderer should keep the legacy SVG).
 */
export function buildDropShoulderBackStitchesRowsModel(
  result: Pick<SleevelessBackPatternResult, "debug"> | null | undefined,
  unit: DropShoulderDiagramUnit = "in",
): DropShoulderBackStitchesRowsModel | null {
  const d = result?.debug;
  if (!d) return null;

  const spi = d.stitchesPerInch;
  const rpi = d.rowsPerInch;
  if (!isFiniteNumber(spi) || spi <= 0 || !isFiniteNumber(rpi) || rpi <= 0) return null;

  const armholeRows = positiveInt(d.armholeRows);
  if (armholeRows <= 0) return null;

  const hemStitches = positiveInt(d.hemCastOnStitches || d.backStitches);
  const bodyWidthStitches = positiveInt(d.backStitches || d.hemCastOnStitches);
  const crossShoulderStitches = positiveInt(
    d.stitchesAfterArmhole || d.backStitches || hemStitches,
  );
  const necklineStitches = positiveInt(d.necklineStitches);
  const shoulderStitchesEach = positiveInt(d.shoulderStitches);
  const hemRows = positiveInt(d.hemRows);
  const bodyRowsToArmhole = positiveInt(d.bodyRows);
  const backNeckDepthRows = positiveInt(d.backNeckDepthRows || d.reservedNecklineShoulderRows);

  if (hemStitches <= 0 || bodyWidthStitches <= 0) return null;

  const necklineRowsInsideArmhole = Math.min(backNeckDepthRows, armholeRows);
  const armholeEvenRows = Math.max(0, armholeRows - necklineRowsInsideArmhole);
  const backWidthInches = storedInches(d.finishedBustChest);
  const pieceWidthInches = backWidthInches !== undefined ? backWidthInches / 2 : undefined;
  const hemWidthInches = hemStitches === bodyWidthStitches ? pieceWidthInches : undefined;

  return {
    unit,
    stitchesPerInch: spi,
    rowsPerInch: rpi,
    hemStitches,
    bodyWidthStitches,
    crossShoulderStitches,
    necklineStitches,
    shoulderStitchesEach,
    hemRows,
    bodyRowsToArmhole,
    armholeRows,
    backNeckDepthRows,
    necklineRowsInsideArmhole,
    armholeEvenRows,
    rowsFromCastOnToArmhole: positiveInt(d.rowsFromCastOnToArmholeStart),
    finalRC: positiveInt(d.finalRC || d.totalCalculatedRows),
    hemStitchesLabel: formatStitchWidthLabel(hemStitches, hemWidthInches, unit),
    bodyWidthLabel: formatStitchWidthLabel(bodyWidthStitches, pieceWidthInches, unit),
    crossShoulderLabel: formatStitchWidthLabel(
      crossShoulderStitches,
      storedInches(d.shoulderWidthInches),
      unit,
    ),
    necklineWidthLabel: formatStitchWidthLabel(
      necklineStitches,
      storedInches(d.necklineWidthInches),
      unit,
    ),
    shoulderStitchesLabel:
      shoulderStitchesEach > 0 ? `${shoulderStitchesEach} sts` : "",
    hemDepthLabel: formatRowsLengthLabel(hemRows, undefined, unit),
    bodyLengthLabel: formatRowsLengthLabel(
      bodyRowsToArmhole,
      storedInches(d.bodyInchesToArmhole),
      unit,
    ),
    armholeDepthLabel: formatRowsLengthLabel(armholeRows, storedInches(d.armholeDepth), unit),
    necklineDepthLabel: formatRowsLengthLabel(
      necklineRowsInsideArmhole,
      storedInches(d.reservedNecklineShoulderInches),
      unit,
    ),
  };
}

export type DropShoulderFrontStitchesRowsModel = DropShoulderBackStitchesRowsModel & {
  piece: "front";
  garment: DropShoulderGarment;
  neckline: DropShoulderNeckline;
  bodyShape: DropShoulderBodyShape;
  /** Front neck depth rows from the generator — may exceed {@link DropShoulderBackStitchesRowsModel.armholeRows}. */
  frontNeckDepthRows: number;
  /** Neck opening stitches on this piece (full N on pullover; half N on cardigan). */
  frontNecklineStitches: number;
};

/**
 * Front Stitches & Rows diagram model from an existing Drop Shoulder pattern result.
 * Reads generator debug + existing style flags. Does not compute new stitch/row math.
 */
export function buildDropShoulderFrontStitchesRowsModel(
  result: Pick<SleevelessBackPatternResult, "debug"> | null | undefined,
  patternData: unknown,
  unit: DropShoulderDiagramUnit = "in",
): DropShoulderFrontStitchesRowsModel | null {
  const base = buildDropShoulderBackStitchesRowsModel(result, unit);
  if (!base) return null;
  const d = result?.debug;
  if (!d) return null;

  const garment = dropShoulderGarmentFromPattern(patternData);
  const neckline = dropShoulderNecklineFromPattern(patternData);
  const bodyShape = dropShoulderDiagramBodyShapeFromPattern(patternData);
  const isCardigan = garment === "cardigan";

  const frontNeckDepthRows = positiveInt(d.frontNeckDepthRows);
  const armholeEvenRows = Math.max(0, base.armholeRows - frontNeckDepthRows);

  const fullNeck = base.necklineStitches;
  const frontNecklineStitches = isCardigan
    ? cardiganFrontNeckOpeningStitches(fullNeck)
    : fullNeck;

  const panelHem = isCardigan ? positiveInt(d.cardiganHalfLeftCastOnSts) : base.hemStitches;
  const panelBody = isCardigan
    ? positiveInt(d.cardiganHalfLeftBustBodySts) || positiveInt(d.cardiganHalfLeftStitchesAfterArmhole)
    : base.bodyWidthStitches;
  const panelTop = isCardigan
    ? positiveInt(d.cardiganHalfLeftStitchesAfterArmhole) || panelBody
    : base.crossShoulderStitches;
  if (panelHem <= 0 || panelBody <= 0) return null;

  const finishedBust = storedInches(d.finishedBustChest);
  const panelWidthInches =
    finishedBust === undefined ? undefined : finishedBust / (isCardigan ? 4 : 2);
  const neckWidthInches = storedInches(d.necklineWidthInches);
  const panelNeckInches =
    neckWidthInches === undefined ? undefined : isCardigan ? neckWidthInches / 2 : neckWidthInches;
  const panelHemInches = panelHem === panelBody ? panelWidthInches : undefined;

  return {
    ...base,
    piece: "front",
    garment,
    neckline,
    bodyShape,
    frontNeckDepthRows,
    frontNecklineStitches,
    hemStitches: panelHem,
    bodyWidthStitches: panelBody,
    crossShoulderStitches: panelTop,
    necklineStitches: frontNecklineStitches,
    necklineRowsInsideArmhole: frontNeckDepthRows,
    armholeEvenRows,
    hemStitchesLabel: formatStitchWidthLabel(panelHem, panelHemInches, unit),
    bodyWidthLabel: formatStitchWidthLabel(panelBody, panelWidthInches, unit),
    crossShoulderLabel: formatStitchWidthLabel(
      panelTop,
      isCardigan ? undefined : storedInches(d.shoulderWidthInches),
      unit,
    ),
    necklineWidthLabel: formatStitchWidthLabel(frontNecklineStitches, panelNeckInches, unit),
    necklineDepthLabel: formatRowsLengthLabel(
      frontNeckDepthRows,
      storedInches(d.frontNeckDepth),
      unit,
    ),
  };
}
