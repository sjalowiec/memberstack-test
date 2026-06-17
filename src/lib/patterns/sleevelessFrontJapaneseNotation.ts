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
import { shoulderStitchesPerSideForDiagram } from "./sleevelessGarmentDiagramReplacements";
import { isSleevelessCardiganFrontNeckShoulderChart } from "./neckShoulderShapingChart";
import {
  cardiganFrontInitialNeckBindOffStitches,
  type RoundNeckNotationSide,
} from "./roundNeckNotation";
import { neckEdgeNotationLinesFromNeckShoulderChart } from "./notationOverlaySvg";
import {
  generateSleevelessBackPattern,
  initialNeckBindOffFromNeckShoulderChart,
} from "./sleevelessPatternOutput";

/** Closed pullover front chart (one neck edge) — cardigan `jp-neckline-shaping` matches this sequence. */
export function pulloverRoundFrontNeckEdgeNotationLines(
  patternData: Record<string, unknown>,
  side: RoundNeckNotationSide = "right",
): string[] {
  const base =
    patternData && typeof patternData === "object" && !Array.isArray(patternData)
      ? ({ ...patternData } as Record<string, unknown>)
      : {};
  const styleIn =
    base.style && typeof base.style === "object" && !Array.isArray(base.style)
      ? ({ ...(base.style as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const pullover = generateSleevelessBackPattern({
    ...base,
    style: {
      ...styleIn,
      garmentStyle: "pullover",
      frontStyle: "closed",
      neckline: styleIn.neckline ?? "round",
    },
  });
  if (!pullover.frontNeckShoulderChartUsesLiveRows) return [];
  return neckEdgeNotationLinesFromNeckShoulderChart(
    pullover.frontNeckShoulderShapingChart,
    side,
  );
}
import { shoulderShapingNotationLinesFromTimeline } from "./shoulderShapingNotation";
import {
  applySleevelessDiagramBodyShapeSuffix,
  resolveSleevelessDiagramBodyShapeKind,
} from "./sleevelessDiagramBodyShapeSrc";
import { resolveCardiganHalfFrontWidths } from "./cardiganFrontBlock";
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

/** Pullover round-neck A-line front Japanese notation schematic (Shaping Notation mode). */
export const SLEEVELESS_PULLOVER_ROUND_ALINE_FRONT_JP_NOTATION_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-jp-front-round-aline.svg";

/** Pullover V-neck front Japanese notation schematic (Shaping Notation mode). */
export const SLEEVELESS_PULLOVER_V_FRONT_JP_NOTATION_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-jp-front-v.svg";

/** Pullover V-neck A-line front Japanese notation schematic (Shaping Notation mode). */
export const SLEEVELESS_PULLOVER_V_ALINE_FRONT_JP_NOTATION_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-jp-front-v-aline.svg";

/** Round-neck cardigan front measurement schematic (Stitches & Rows mode). */
export const SLEEVELESS_CARDIGAN_ROUND_FRONT_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-cardigan-round.svg";

/** V-neck cardigan front measurement schematic (Stitches & Rows mode). */
export const SLEEVELESS_CARDIGAN_V_FRONT_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-cardigan-v.svg";

/** Round-neck cardigan front Japanese notation schematic (Shaping Notation mode). */
export const SLEEVELESS_CARDIGAN_ROUND_FRONT_JP_NOTATION_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-jp-cardigan-round.svg";

/** Round-neck cardigan A-line front Japanese notation schematic (Shaping Notation mode). */
export const SLEEVELESS_CARDIGAN_ROUND_ALINE_FRONT_JP_NOTATION_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-jp-cardigan-round-aline.svg";

/** V-neck cardigan front Japanese notation schematic (Shaping Notation mode). */
export const SLEEVELESS_CARDIGAN_V_FRONT_JP_NOTATION_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-jp-cardigan-v.svg";

/** V-neck cardigan A-line front Japanese notation schematic (Shaping Notation mode). */
export const SLEEVELESS_CARDIGAN_V_ALINE_FRONT_JP_NOTATION_DIAGRAM_SRC =
  "/images/patterns/sleeveless/diagrams/diagram-jp-cardigan-v-aline.svg";

/** Alias used by Japanese notation fetch/replace (shaping notation mode, round pullover). */
export const JP_FRONT_NOTATION_SVG_SRC = SLEEVELESS_FRONT_JP_NOTATION_DIAGRAM_SRC;

export type SleevelessFrontDiagramViewMode = "sts-rows" | "shaping-notation";

/** Canonical front garment diagram URL for the pattern-tab mode toggle (pullover and cardigan). */
export function resolveSleevelessFrontDiagramSrc(
  mode: SleevelessFrontDiagramViewMode,
  patternData: unknown,
): string {
  const bodyShapeKind = resolveSleevelessDiagramBodyShapeKind(patternData);
  const shapingNotation = mode === "shaping-notation";
  if (isSleevelessCardiganGarmentStyle(patternData)) {
    if (isSleevelessVNeckChoice(patternData)) {
      const straightBase = shapingNotation
        ? SLEEVELESS_CARDIGAN_V_FRONT_JP_NOTATION_DIAGRAM_SRC
        : SLEEVELESS_CARDIGAN_V_FRONT_DIAGRAM_SRC;
      return applySleevelessDiagramBodyShapeSuffix(straightBase, bodyShapeKind);
    }
    const straightBase = shapingNotation
      ? SLEEVELESS_CARDIGAN_ROUND_FRONT_JP_NOTATION_DIAGRAM_SRC
      : SLEEVELESS_CARDIGAN_ROUND_FRONT_DIAGRAM_SRC;
    return applySleevelessDiagramBodyShapeSuffix(straightBase, bodyShapeKind);
  }
  if (isSleevelessVNeckChoice(patternData)) {
    const straightBase = shapingNotation
      ? SLEEVELESS_PULLOVER_V_FRONT_JP_NOTATION_DIAGRAM_SRC
      : SLEEVELESS_PULLOVER_V_FRONT_DIAGRAM_SRC;
    return applySleevelessDiagramBodyShapeSuffix(straightBase, bodyShapeKind);
  }
  const straightBase = shapingNotation
    ? SLEEVELESS_FRONT_JP_NOTATION_DIAGRAM_SRC
    : SLEEVELESS_PULLOVER_ROUND_FRONT_DIAGRAM_SRC;
  return applySleevelessDiagramBodyShapeSuffix(straightBase, bodyShapeKind);
}

/** Token names in pullover front Japanese notation SVGs (same set as back). */
export const JP_FRONT_NOTATION_SVG_TOKEN_KEYS = JP_BACK_NOTATION_SVG_TOKEN_KEYS;

export type JpFrontNotationSvgTokenKey = JpBackNotationSvgTokenKey;

const FRONT_NOTATION_DIAGRAM_SIDE: "left" | "right" = "right";

function patternDataWithGeneratorInputsFromResult(
  result: SleevelessBackPatternResult,
  patternData: unknown,
): Record<string, unknown> {
  const base =
    patternData && typeof patternData === "object" && !Array.isArray(patternData)
      ? ({ ...(patternData as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const fitIn =
    base.fit && typeof base.fit === "object" && !Array.isArray(base.fit)
      ? (base.fit as Record<string, unknown>)
      : undefined;
  const sm =
    fitIn?.selectedMeasurements &&
    typeof fitIn.selectedMeasurements === "object" &&
    !Array.isArray(fitIn.selectedMeasurements)
      ? (fitIn.selectedMeasurements as Record<string, unknown>)
      : undefined;
  if (sm?.finished_bust_chest !== undefined && base.yarnGaugeMachine) {
    return base;
  }

  const d = result.debug;
  const rowsPerInch = d.rowsPerInch;
  const backNeckDepthIn =
    rowsPerInch > 0 && Number.isFinite(d.backNeckDepthRows)
      ? d.backNeckDepthRows / rowsPerInch
      : undefined;

  return {
    ...base,
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: d.finishedBustChest,
        back_neck_to_hem: d.backNeckToHem,
        armhole_depth: d.armholeDepth,
        neck_opening: d.necklineWidthInches,
        shoulder_width: d.shoulderWidthInches,
        front_neck_depth: d.frontNeckDepth,
        ...(backNeckDepthIn !== undefined ? { back_neck_depth: backNeckDepthIn } : {}),
      },
    },
    yarnGaugeMachine:
      base.yarnGaugeMachine ??
      ({
        gaugeStitchesPerInch: d.stitchesPerInch,
        gaugeRowsPerInch: d.rowsPerInch,
        availableNeedles: 200,
      } as const),
    style: {
      ...(typeof base.style === "object" && base.style && !Array.isArray(base.style)
        ? (base.style as Record<string, unknown>)
        : {}),
      recipientCategory: "misses",
    },
  };
}

/**
 * Round cardigan `jp-neckline-shaping` — same one-edge schedule as closed pullover round front
 * (full neck opening N). Reconstructs generator inputs from {@link result} when patternData is
 * style-only (pattern tab page path).
 */
function cardiganRoundFrontNeckEdgeNotationLines(
  result: SleevelessBackPatternResult,
  patternData: unknown,
  side: RoundNeckNotationSide = FRONT_NOTATION_DIAGRAM_SIDE,
): string[] {
  const merged = patternDataWithGeneratorInputsFromResult(result, patternData);
  return pulloverRoundFrontNeckEdgeNotationLines(merged, side);
}

/** Closed pullover front shoulder bind-off schedule from the front timeline; cardigan half-front uses back. */
function canonicalShoulderShapingNotationLines(
  result: SleevelessBackPatternResult,
  patternData: unknown,
  side: RoundNeckNotationSide = FRONT_NOTATION_DIAGRAM_SIDE,
): string[] {
  const frontChart = result.frontNeckShoulderShapingChart;
  const isCardiganRoundHalfFront =
    isSleevelessCardiganGarmentStyle(patternData) &&
    isSleevelessCardiganFrontNeckShoulderChart(frontChart) &&
    !isSleevelessVNeckChoice(patternData);

  const timeline = isCardiganRoundHalfFront
    ? (result.backNeckShoulderTimeline ?? result.neckShoulderShapingChart.timeline ?? [])
    : (result.frontNeckShoulderTimeline ??
      result.backNeckShoulderTimeline ??
      result.neckShoulderShapingChart.timeline ??
      []);
  if (timeline.length === 0) return [];
  const budget = shoulderStitchesPerSideForDiagram(result.debug);
  return shoulderShapingNotationLinesFromTimeline(timeline, side, undefined, {
    shoulderStitchesBudget: budget,
  });
}

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

/**
 * Front cast-on for Japanese notation — cardigan half-panel (same source as sts/rows diagram
 * {@link resolveCardiganHalfFrontWidths}), else full front/back hem for pullovers.
 */
function frontJapaneseNotationCastOnSts(
  result: SleevelessBackPatternResult,
  patternData: unknown,
): number {
  const d = result.debug;
  if (isSleevelessCardiganGarmentStyle(patternData)) {
    if (d.cardiganHalfLeftCastOnSts !== undefined) {
      return d.cardiganHalfLeftCastOnSts;
    }
    const hemBase =
      d.hemCastOnStitches !== undefined && d.hemCastOnStitches > 0
        ? d.hemCastOnStitches
        : d.backStitches !== undefined && d.backStitches > 0
          ? d.backStitches
          : 0;
    if (hemBase > 0) {
      const bustBase =
        d.bustBodyStitches !== undefined && d.bustBodyStitches > 0
          ? d.bustBodyStitches
          : hemBase;
      return resolveCardiganHalfFrontWidths(
        {
          hemCastOnSts: hemBase,
          bustBodySts: bustBase,
          stitchesAfterArmhole: d.stitchesAfterArmhole ?? 0,
        },
        "left",
      ).hemCastOnSts;
    }
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

  const frontChart = result.frontNeckShoulderShapingChart;
  const fullNecklineSts = d.necklineStitches ?? 0;
  const isVNeckFront =
    isSleevelessVNeckChoice(patternData) || frontChart.sleevelessFullWidthVNeckFront === true;
  /** Round cardigan half-front only — V-neck cardigan uses live front chart/timeline like pullover V-neck. */
  const isCardiganRoundFront =
    isSleevelessCardiganGarmentStyle(patternData ?? {}) &&
    isSleevelessCardiganFrontNeckShoulderChart(frontChart) &&
    !isVNeckFront;
  const centerNeckBindOff = isCardiganRoundFront
    ? cardiganFrontInitialNeckBindOffStitches(fullNecklineSts)
    : result.frontNeckShoulderChartUsesLiveRows
      ? initialNeckBindOffFromNeckShoulderChart(frontChart, {
          fullNecklineStitches: fullNecklineSts,
        })
      : (d.cardiganFrontInitialNeckBindOffStitches ?? d.centerNeckBindOffStitches ?? 0);
  const necklineShapingLines = isCardiganRoundFront
    ? cardiganRoundFrontNeckEdgeNotationLines(result, patternData ?? {}, FRONT_NOTATION_DIAGRAM_SIDE)
    : neckEdgeNotationLinesFromNeckShoulderChart(frontChart, FRONT_NOTATION_DIAGRAM_SIDE);
  /** Back / closed-pullover shoulder schedule — not cardigan half-front timeline compression. */
  const shoulderShapingLines = canonicalShoulderShapingNotationLines(
    result,
    patternData ?? {},
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
