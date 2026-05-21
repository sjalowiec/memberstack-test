/**
 * Live Japanese notation tokens for the front pullover round-neck SVG (file-swap, mirrors back).
 */

import {
  armholeBindOffDecreaseFromEachSide,
  formatBindOffNotation,
  formatBodyRowsNotation,
  formatCastOnNotation,
  formatDecreaseNotationLines,
  formatRcNotation,
  formatRcResetNotation,
  garmentRcAtArmholeStart,
  JP_BACK_NOTATION_SVG_TOKEN_KEYS,
  type JpBackNotationSvgTokenKey,
} from "./sleevelessBackJapaneseNotation";
import {
  neckEdgeNotationLinesFromNeckShoulderChart,
  shoulderEdgeNotationLinesFromNeckShoulderChart,
} from "./notationOverlaySvg";
import {
  isSleevelessCardiganGarmentStyle,
  isSleevelessVNeckChoice,
  SLEEVELESS_PULLOVER_ROUND_FRONT_DIAGRAM_SRC,
} from "./sleevelessFrontDiagramSrc";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import type { StitchDecreasePoint } from "./shapingNotationCompress";

/** Pullover round-neck front measurement schematic (Stitches & Rows mode). */
export const SLEEVELESS_FRONT_DIAGRAM_STS_ROWS_SRC = SLEEVELESS_PULLOVER_ROUND_FRONT_DIAGRAM_SRC;

/** Pullover round-neck front Japanese notation schematic (Shaping Notation mode). */
export const SLEEVELESS_FRONT_JP_NOTATION_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-jp-front-round.svg";

/** Token names in `diagram-jp-front-round.svg` (same keys as back notation). */
export const JP_FRONT_NOTATION_SVG_TOKEN_KEYS = JP_BACK_NOTATION_SVG_TOKEN_KEYS;

export type JpFrontNotationSvgTokenKey = JpBackNotationSvgTokenKey;

const FRONT_NOTATION_DIAGRAM_SIDE: "left" | "right" = "right";

function joinNotationLines(lines: readonly string[]): string {
  return lines.filter((line) => line.length > 0).join("\n");
}

export function isFrontJapaneseNotationSupported(
  patternData: unknown,
  result: SleevelessBackPatternResult,
): boolean {
  if (isSleevelessCardiganGarmentStyle(patternData)) return false;
  if (isSleevelessVNeckChoice(patternData)) return false;
  if (!result.frontNeckShoulderChartUsesLiveRows) return false;
  if (result.frontNeckShoulderShapingChart.sleevelessFullWidthVNeckFront === true) return false;
  return true;
}

export function buildFrontJapaneseNotationReplacements(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): Record<string, string> {
  const empty = Object.fromEntries(JP_FRONT_NOTATION_SVG_TOKEN_KEYS.map((k) => [k, ""])) as Record<
    JpFrontNotationSvgTokenKey,
    string
  >;

  if (!isFrontJapaneseNotationSupported(patternData, result)) {
    return empty;
  }

  const d = result.debug;
  const castOnSts = d.hemCastOnStitches ?? d.backStitches;
  const bodyRows = d.bodyRows;

  const eachSide = d.armholeStitchesEachSide;
  const { bindOffSts, decreaseSts } =
    eachSide !== undefined ? armholeBindOffDecreaseFromEachSide(eachSide) : { bindOffSts: 0, decreaseSts: 0 };

  const armholeDecreasePoints: StitchDecreasePoint[] =
    decreaseSts > 0
      ? Array.from({ length: decreaseSts }, (_, i) => ({ row: i * 2, amount: 1 }))
      : [];

  const centerNeckBindOff = d.centerNeckBindOffStitches;
  const frontChart = result.frontNeckShoulderShapingChart;
  const necklineShapingLines = neckEdgeNotationLinesFromNeckShoulderChart(
    frontChart,
    FRONT_NOTATION_DIAGRAM_SIDE,
  );
  const shoulderShapingLines = shoulderEdgeNotationLinesFromNeckShoulderChart(
    frontChart,
    FRONT_NOTATION_DIAGRAM_SIDE,
  );

  const hemRows = d.hemRows;
  const necklineLocalRc = d.frontNecklineStartLocalRC;
  const armholeStartGarmentRc = garmentRcAtArmholeStart(d);

  return {
    "jp-caston": formatCastOnNotation(castOnSts),
    "jp-body-rows": formatBodyRowsNotation(bodyRows),
    "jp-armhole-bo": formatBindOffNotation(bindOffSts),
    "jp-armhole-shaping": joinNotationLines(formatDecreaseNotationLines(armholeDecreasePoints)),
    "jp-neckline-bo": formatBindOffNotation(centerNeckBindOff ?? 0),
    "jp-neckline-shaping": joinNotationLines(necklineShapingLines),
    "jp-shoulder-shaping": joinNotationLines(shoulderShapingLines),
    "rc-caston": formatRcNotation(0),
    "rc-hem": formatRcNotation(hemRows),
    "rc-armhole-bo":
      armholeStartGarmentRc !== undefined ? formatRcNotation(armholeStartGarmentRc) : "",
    rc_reset: formatRcResetNotation(0),
    "rc-neckline-start":
      necklineLocalRc !== undefined && Number.isFinite(necklineLocalRc)
        ? formatRcNotation(necklineLocalRc)
        : "",
  };
}
