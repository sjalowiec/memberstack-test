/**
 * Shared cuff-up sweater cuff.
 *
 * Drop Shoulder, Set-In Sleeve, and the Sideways conventional sleeve all size
 * this band with the same depth resolver and piece-number formula. Written
 * choices stay in `sidewaysCuffUpCuffChoiceLines`. The row-counter reset stays
 * in `cuffUpSleeveRowCounter`.
 *
 * Finished sleeve length includes the cuff. Body rows are the requested length
 * minus the cuff rows. The cuff is not added on after that length.
 */

import { resolveEffectiveCuffDepthInches } from "../customBuildEffectiveCuffDepth";
import {
  calculateDropShoulderSleevePieceNumbers,
  type DropShoulderSleevePieceNumbers,
} from "../dropShoulderSleevePieceNumbers";
import { calculateCuffRowsFromInches, type PatternAudience } from "../hemDefaults";

export type CuffUpSweaterSleevePiece = DropShoulderSleevePieceNumbers & {
  /** Finished cuff depth used for rows and diagram labels. */
  cuffDepthInches: number;
};

/**
 * Largest cuff that still leaves the finished sleeve at the requested length.
 * The shared piece formula will otherwise lengthen the sleeve when cuff rows
 * plus two exceed the requested row count.
 */
export function cuffDepthInchesThatFitFinishedSleeveLength(
  cuffDepthInches: number,
  sleeveLengthInches: number | undefined,
  rowsPerInch: number,
): number {
  if (
    !(cuffDepthInches > 0) ||
    sleeveLengthInches === undefined ||
    !(sleeveLengthInches > 0) ||
    !(rowsPerInch > 0)
  ) {
    return cuffDepthInches;
  }
  const totalRows = Math.round(sleeveLengthInches * rowsPerInch);
  if (totalRows <= 2) return 0;
  if (calculateCuffRowsFromInches(rowsPerInch, cuffDepthInches) + 2 <= totalRows) {
    return cuffDepthInches;
  }
  let maxRows = totalRows - 2;
  maxRows -= maxRows % 2;
  while (maxRows > 0) {
    const fitted = maxRows / rowsPerInch;
    if (calculateCuffRowsFromInches(rowsPerInch, fitted) + 2 <= totalRows) {
      return Math.min(cuffDepthInches, fitted);
    }
    maxRows -= 2;
  }
  return 0;
}

/**
 * Cuff depth plus the shared sleeve piece counts.
 * `keepRequestedSleeveLength` shortens a cuff that would otherwise push the
 * finished length past the request. Drop Shoulder leaves this off and keeps
 * its existing length rule.
 */
export function resolveCuffUpSweaterSleevePiece(args: {
  patternData: Record<string, unknown>;
  audience: PatternAudience;
  finishedUpperArmInches?: number;
  finishedWristInches?: number;
  sleeveLengthInches?: number;
  stitchesPerInch: number;
  rowsPerInch: number;
  keepRequestedSleeveLength?: boolean;
}): CuffUpSweaterSleevePiece {
  const requested = resolveEffectiveCuffDepthInches(args.patternData, args.audience);
  const cuffDepthInches = args.keepRequestedSleeveLength
    ? cuffDepthInchesThatFitFinishedSleeveLength(
        requested,
        args.sleeveLengthInches,
        args.rowsPerInch,
      )
    : requested;
  const piece = calculateDropShoulderSleevePieceNumbers({
    finishedUpperArmInches: args.finishedUpperArmInches,
    finishedWristInches: args.finishedWristInches,
    sleeveLengthInches: args.sleeveLengthInches,
    stitchesPerInch: args.stitchesPerInch,
    rowsPerInch: args.rowsPerInch,
    cuffDepthInches,
  });
  return { ...piece, cuffDepthInches };
}
