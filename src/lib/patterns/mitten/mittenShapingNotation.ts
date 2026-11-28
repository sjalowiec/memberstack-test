/**
 * Mitten shaping notation from the approved calc.
 * Tokens use the shared stitches–rows–times notation. No second stitch formula.
 */

import { formatBodyRowsNotation, formatCastOnNotation } from "../sleevelessBackJapaneseNotation";
import {
  consolidateConsecutiveJapaneseNotationLines,
  formatShapingSegment,
} from "../shapingNotationCompress";
import type { ShortRowShaping } from "../sock/sockMath";
import { goredMarkerPlacement, type GoreReturn, type MittenCalc } from "./mittenMath";

export const MITTEN_INCREASE_EVENLY_GLOSSARY_ID = 645;
export const MITTEN_INCREASE_EVENLY_GLOSSARY_TERM = "Increase Evenly";

/** One even increase across the row, once. Omitted when the cuff and hand already match. */
export function mittenHandIncreaseNotation(increaseSts: number): string {
  if (!(increaseSts > 0)) return "";
  return `+${formatShapingSegment(increaseSts, 1, 1)}`;
}

/** Fingertip short rows: hold in, the center that remains, then return. Same order as the instructions. */
export function mittenFingertipShortRowNotation(shaping: ShortRowShaping): string[] {
  const remaining = shaping.remainingStitches;
  return [
    `-${formatShapingSegment(1, 1, shaping.shortRowInSteps)}`,
    remaining === 1 ? "1 st" : `${remaining} sts`,
    `+${formatShapingSegment(1, 1, shaping.shortRowOutSteps)}`,
  ];
}

/**
 * Gored-thumb returns, in the approved return order.
 * Each return is one row. Identical neighbors use the shared notation consolidator.
 */
export function mittenGoreShortRowNotation(returns: readonly GoreReturn[]): string[] {
  const segments = returns.map((ret) => formatShapingSegment(ret.needles, 1, 1));
  return consolidateConsecutiveJapaneseNotationLines(segments).map((line) => `+${line}`);
}

export type MittenShapingNotation = {
  castOn: string;
  cuffRows: string;
  handIncrease: string;
  handStsLabel: string;
  hand1Rows: string;
  straightRows: string;
  fingertip: string[];
  thumbRows: string;
  thumbStsLabel: string;
  markerRows: string;
  goreShortRows: string[];
  goreStartLabel: string;
};

function stitchLabel(count: number): string {
  return count === 1 ? "1 st" : `${count} sts`;
}

/** Notation for one mitten. The mirrored mitten uses the same tokens on the opposite edge. */
export function buildMittenShapingNotation(calc: MittenCalc): MittenShapingNotation {
  const gore = calc.gore;
  const place = goredMarkerPlacement(calc);
  return {
    castOn: formatCastOnNotation(calc.cuffSts),
    cuffRows: formatBodyRowsNotation(calc.cuffRows),
    handIncrease: mittenHandIncreaseNotation(calc.increaseSts),
    handStsLabel: stitchLabel(calc.handSts),
    hand1Rows: formatBodyRowsNotation(place ? place.rowsFromCuff : calc.hand1Rows),
    straightRows: formatBodyRowsNotation(place ? place.straightRowsAfterUpper : calc.straightRows),
    fingertip: mittenFingertipShortRowNotation(calc.fingertip),
    thumbRows: formatBodyRowsNotation(calc.thumbRows),
    thumbStsLabel: stitchLabel(calc.thumbSts),
    markerRows: gore ? formatBodyRowsNotation(gore.markerRows) : "",
    goreShortRows: gore ? mittenGoreShortRowNotation(gore.returns) : [],
    goreStartLabel: gore ? stitchLabel(gore.startWorkingNeedles) : "",
  };
}
