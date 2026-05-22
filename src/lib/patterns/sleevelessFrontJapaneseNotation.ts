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
import { neckEdgeNotationLinesFromNeckShoulderChart } from "./notationOverlaySvg";
import { shoulderShapingNotationLinesFromTimeline } from "./shoulderShapingNotation";
import {
  isSleevelessCardiganGarmentStyle,
  isSleevelessVNeckChoice,
  SLEEVELESS_PULLOVER_ROUND_FRONT_DIAGRAM_SRC,
  SLEEVELESS_PULLOVER_V_FRONT_DIAGRAM_SRC,
} from "./sleevelessFrontDiagramSrc";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import type { StitchDecreasePoint } from "./shapingNotationCompress";

/** Pullover round-neck front measurement schematic (Stitches & Rows mode). */
export const SLEEVELESS_FRONT_DIAGRAM_STS_ROWS_SRC = SLEEVELESS_PULLOVER_ROUND_FRONT_DIAGRAM_SRC;

/** Pullover round-neck front Japanese notation schematic (Shaping Notation mode). */
export const SLEEVELESS_FRONT_JP_NOTATION_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-jp-front-round.svg";

/** Pullover V-neck front Japanese notation schematic (Shaping Notation mode). */
export const SLEEVELESS_PULLOVER_V_FRONT_JP_NOTATION_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-jp-front-v.svg";

/** Round-neck cardigan front measurement schematic (Stitches & Rows mode). */
export const SLEEVELESS_CARDIGAN_ROUND_FRONT_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-cardigan-round.svg";

/** V-neck cardigan front measurement schematic (Stitches & Rows mode). */
export const SLEEVELESS_CARDIGAN_V_FRONT_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-cardigan-v.svg";

/** Round-neck cardigan front Japanese notation schematic (Shaping Notation mode). */
export const SLEEVELESS_CARDIGAN_ROUND_FRONT_JP_NOTATION_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-jp-cardigan-round.svg";

/** V-neck cardigan front Japanese notation schematic (Shaping Notation mode). */
export const SLEEVELESS_CARDIGAN_V_FRONT_JP_NOTATION_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-jp-cardigan-v.svg";

/** Alias used by Japanese notation fetch/replace (shaping notation mode, round pullover). */
export const JP_FRONT_NOTATION_SVG_SRC = SLEEVELESS_FRONT_JP_NOTATION_DIAGRAM_SRC;

export type SleevelessFrontDiagramViewMode = "sts-rows" | "shaping-notation";

/** Canonical front garment diagram URL for the pattern-tab mode toggle (pullover and cardigan). */
export function resolveSleevelessFrontDiagramSrc(
  mode: SleevelessFrontDiagramViewMode,
  patternData: unknown,
): string {
  const shapingNotation = mode === "shaping-notation";
  if (isSleevelessCardiganGarmentStyle(patternData)) {
    if (isSleevelessVNeckChoice(patternData)) {
      return shapingNotation
        ? SLEEVELESS_CARDIGAN_V_FRONT_JP_NOTATION_DIAGRAM_SRC
        : SLEEVELESS_CARDIGAN_V_FRONT_DIAGRAM_SRC;
    }
    return shapingNotation
      ? SLEEVELESS_CARDIGAN_ROUND_FRONT_JP_NOTATION_DIAGRAM_SRC
      : SLEEVELESS_CARDIGAN_ROUND_FRONT_DIAGRAM_SRC;
  }
  if (isSleevelessVNeckChoice(patternData)) {
    return shapingNotation
      ? SLEEVELESS_PULLOVER_V_FRONT_JP_NOTATION_DIAGRAM_SRC
      : SLEEVELESS_PULLOVER_V_FRONT_DIAGRAM_SRC;
  }
  return shapingNotation
    ? SLEEVELESS_FRONT_JP_NOTATION_DIAGRAM_SRC
    : SLEEVELESS_FRONT_DIAGRAM_STS_ROWS_SRC;
}

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
  if (!result.frontNeckShoulderChartUsesLiveRows) return false;
  return true;
}

/** Front cast-on for Japanese notation — cardigan half-panel when available, else full front/back hem. */
function frontJapaneseNotationCastOnSts(
  result: SleevelessBackPatternResult,
  patternData: unknown,
): number {
  const d = result.debug;
  if (
    isSleevelessCardiganGarmentStyle(patternData) &&
    d.cardiganHalfLeftCastOnSts !== undefined
  ) {
    return d.cardiganHalfLeftCastOnSts;
  }
  return d.hemCastOnStitches ?? d.backStitches ?? 0;
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
  const castOnSts = frontJapaneseNotationCastOnSts(result, patternData ?? {});
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
  const isVNeckFront =
    isSleevelessVNeckChoice(patternData) || frontChart.sleevelessFullWidthVNeckFront === true;
  const necklineShapingLines = neckEdgeNotationLinesFromNeckShoulderChart(
    frontChart,
    FRONT_NOTATION_DIAGRAM_SIDE,
  );
  const frontTimeline = result.frontNeckShoulderTimeline ?? frontChart.timeline ?? [];
  const shoulderShapingLines =
    frontTimeline.length > 0
      ? shoulderShapingNotationLinesFromTimeline(frontTimeline, FRONT_NOTATION_DIAGRAM_SIDE)
      : [];

  const hemRows = d.hemRows;
  const necklineLocalRc = d.frontNecklineStartLocalRC;
  const armholeStartGarmentRc = garmentRcAtArmholeStart(d);

  return {
    "jp-caston": formatCastOnNotation(castOnSts),
    "jp-body-rows": formatBodyRowsNotation(bodyRows),
    "jp-armhole-bo": formatBindOffNotation(bindOffSts),
    "jp-armhole-shaping": joinNotationLines(formatDecreaseNotationLines(armholeDecreasePoints)),
    "jp-neckline-bo": isVNeckFront ? "" : formatBindOffNotation(centerNeckBindOff ?? 0),
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
