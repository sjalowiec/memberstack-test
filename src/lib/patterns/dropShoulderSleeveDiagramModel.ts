/**
 * Read-only Drop Shoulder sleeve diagram adapter.
 *
 * Copies already-calculated sleeve debug values into a structured model for SVG
 * renderers. Does not compute stitches, rows, shaping, or sizing.
 */

import { lengthFromRowsForDiagram } from "./sleevelessRowAccounting";
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

function formatLengthNumber(n: number): string {
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 1e-9) return String(rounded);
  const one = Math.round(n * 10) / 10;
  return String(one).replace(/\.0$/, "");
}

function formatLength(inchesOrCm: number, unit: DropShoulderDiagramUnit): string {
  return `${formatLengthNumber(inchesOrCm)} ${unit}`;
}

function formatStitchWidthLabel(
  stitches: number,
  stitchesPerInch: number,
  unit: DropShoulderDiagramUnit,
): string {
  const sts = positiveInt(stitches);
  if (sts <= 0) return "";
  if (!(stitchesPerInch > 0)) return `${sts} sts`;
  const inches = sts / stitchesPerInch;
  const converted = unit === "cm" ? inches * 2.54 : inches;
  return `${sts} sts / ${formatLength(converted, unit)}`;
}

function formatRowsLengthLabel(
  rows: number,
  rowsPerInch: number,
  unit: DropShoulderDiagramUnit,
): string {
  const rowN = Math.max(0, Math.round(rows));
  if (rowN <= 0) return "";
  const fromRows = lengthFromRowsForDiagram(rowN, rowsPerInch, unit);
  if (fromRows === undefined) return `${rowN} rows`;
  return `${rowN} rows / ${formatLength(fromRows, unit)}`;
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
    wristWidthLabel: formatStitchWidthLabel(wristStitches, spi, unit),
    topWidthLabel: formatStitchWidthLabel(topStitches, spi, unit),
    cuffDepthLabel: formatRowsLengthLabel(cuffRows, rpi, unit),
    sleeveBodyLengthLabel: formatRowsLengthLabel(sleeveBodyRows, rpi, unit),
    sleeveTotalLengthLabel: formatRowsLengthLabel(sleeveTotalRows, rpi, unit),
  };
}
