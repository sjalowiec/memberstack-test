/**
 * Shared Drop Shoulder sleeve piece numbers (flat tapered sleeve).
 *
 * One stitch/row formula for Drop Shoulder generation and Sideways V-Neck cuff-up /
 * top-down sleeves. Do not introduce a second sleeve-sizing system.
 */

import { calculateCuffRowsFromInches } from "./hemDefaults";
import { evenPositiveBodyStitches } from "./sleevelessBodyStitchMath";

export type DropShoulderSleevePieceNumberInput = {
  finishedUpperArmInches?: number;
  finishedWristInches?: number;
  sleeveLengthInches?: number;
  stitchesPerInch: number;
  rowsPerInch: number;
  cuffDepthInches: number;
};

export type DropShoulderSleevePieceNumbers = {
  /** Finished upper-arm stitches (straight sleeve-top width). */
  topSts: number;
  wristSts: number;
  cuffRows: number;
  sleeveBodyRows: number;
  sleeveTotalRows: number;
};

/**
 * Stitch and row counts for a conventional (non-sideways) drop-shoulder sleeve.
 *
 * Matches {@link generateDropShoulderPattern}: even stitch rounding, even cuff rows,
 * and `sleeveTotalRows = max(cuffRows + 2, round(sleeveLength × rpi))`.
 */
export function calculateDropShoulderSleevePieceNumbers(
  input: DropShoulderSleevePieceNumberInput,
): DropShoulderSleevePieceNumbers {
  const spi = input.stitchesPerInch;
  const rpi = input.rowsPerInch;
  const topSts =
    input.finishedUpperArmInches !== undefined && spi > 0
      ? evenPositiveBodyStitches(input.finishedUpperArmInches * spi)
      : 0;
  const wristSts =
    input.finishedWristInches !== undefined && spi > 0
      ? evenPositiveBodyStitches(input.finishedWristInches * spi)
      : 0;
  const cuffRows = calculateCuffRowsFromInches(rpi, input.cuffDepthInches);
  const sleeveLengthIn = input.sleeveLengthInches;
  const sleeveTotalRows =
    sleeveLengthIn && rpi > 0 ? Math.max(cuffRows + 2, Math.round(sleeveLengthIn * rpi)) : 0;
  const sleeveBodyRows = Math.max(0, sleeveTotalRows - cuffRows);
  return { topSts, wristSts, cuffRows, sleeveBodyRows, sleeveTotalRows };
}
