/**
 * Read-only Drop Shoulder sleeve diagram adapter.
 *
 * Copies already-calculated sleeve debug values into a structured model for SVG
 * renderers. Does not compute stitches, rows, shaping, or sizing.
 */

import {
  castOnEdgeDiagramLabel,
  formatPatternDiagramMeasurement,
  formatStitchesRowsDiagramLabel,
} from "./patternStitchesRowsDiagramLabel";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import type { DropShoulderSleeveDirection } from "./dropShoulderSleeveConstruction";
import { resolveDropShoulderSleeveBodyRowsForDiagram } from "./sleevelessGarmentDiagramReplacements";
import type { DropShoulderDiagramUnit } from "./dropShoulderPatternDiagramModel";

export type DropShoulderSleeveStitchesRowsModel = {
  unit: DropShoulderDiagramUnit;
  direction: DropShoulderSleeveDirection;
  stitchesPerInch: number;
  rowsPerInch: number;
  wristStitches: number;
  topStitches: number;
  cuffRows: number;
  sleeveBodyRows: number;
  sleeveTotalRows: number;
  wristWidthLabel: string;
  topWidthLabel: string;
  cuffDepthLabel: string;
  sleeveBodyLengthLabel: string;
  sleeveTotalLengthLabel: string;
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

function formatRowsLengthLabel(
  rows: number,
  inches: number | undefined,
  unit: DropShoulderDiagramUnit,
): string {
  const rowN = Math.max(0, Math.round(rows));
  if (rowN <= 0) return "";
  return formatStitchesRowsDiagramLabel(rowN, "rows", formatPatternDiagramMeasurement(inches, unit));
}

/**
 * Sleeve Stitches & Rows model from existing Drop Shoulder debug.
 * Returns `null` when required fields are missing (renderer keeps Illustrator).
 */
export function buildDropShoulderSleeveStitchesRowsModel(
  result: Pick<SleevelessBackPatternResult, "debug" | "isDropShoulder"> | null | undefined,
  direction: DropShoulderSleeveDirection = "cuff-up",
  unit: DropShoulderDiagramUnit = "in",
): DropShoulderSleeveStitchesRowsModel | null {
  if (!result || result.isDropShoulder !== true) return null;
  const d = result.debug as
    | (SleevelessBackPatternResult["debug"] & {
        dropShoulderSleeveTotalRows?: number;
        dropShoulderSleeveBodyRows?: number;
        dropShoulderSleeveCuffRows?: number;
        dropShoulderSleeveTopStitches?: number;
        dropShoulderSleeveWristStitches?: number;
        dropShoulderSleeveLengthInches?: number;
        dropShoulderWristInches?: number;
        dropShoulderUpperArmInches?: number;
        dropShoulderCuffDepthInches?: number;
      })
    | undefined;
  if (!d) return null;

  const spi = d.stitchesPerInch;
  const rpi = d.rowsPerInch;
  if (!isFiniteNumber(spi) || spi <= 0 || !isFiniteNumber(rpi) || rpi <= 0) return null;

  const wristStitches = positiveInt(d.dropShoulderSleeveWristStitches);
  const topStitches = positiveInt(d.dropShoulderSleeveTopStitches);
  const cuffRows = positiveInt(d.dropShoulderSleeveCuffRows);
  const sleeveBodyRows = positiveInt(resolveDropShoulderSleeveBodyRowsForDiagram(d));
  const sleeveTotalRows =
    positiveInt(d.dropShoulderSleeveTotalRows) ||
    (cuffRows > 0 || sleeveBodyRows > 0 ? cuffRows + sleeveBodyRows : 0);

  if (wristStitches <= 0 || topStitches <= 0 || sleeveTotalRows <= 0) return null;
  if (cuffRows <= 0 && sleeveBodyRows <= 0) return null;

  return {
    unit,
    direction: direction === "top-down" ? "top-down" : "cuff-up",
    stitchesPerInch: spi,
    rowsPerInch: rpi,
    wristStitches,
    topStitches,
    cuffRows,
    sleeveBodyRows,
    sleeveTotalRows,
    wristWidthLabel: castOnEdgeDiagramLabel(wristStitches, spi, unit),
    topWidthLabel: castOnEdgeDiagramLabel(topStitches, spi, unit),
    cuffDepthLabel: formatRowsLengthLabel(cuffRows, storedInches(d.dropShoulderCuffDepthInches), unit),
    sleeveBodyLengthLabel: formatRowsLengthLabel(sleeveBodyRows, undefined, unit),
    sleeveTotalLengthLabel: formatRowsLengthLabel(
      sleeveTotalRows,
      storedInches(d.dropShoulderSleeveLengthInches),
      unit,
    ),
  };
}
