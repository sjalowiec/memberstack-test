/**
 * Data model for the Sleeveless Back Stitches & Rows diagram.
 *
 * Scope: straight or A-line body (pullover or cardigan). Back neckline is always
 * the Back round/shallow opening — never Front V-neck depth.
 * Reads a finalized {@link SleevelessBackPatternResult}. No pattern math, no SVG.
 */

import { pulloverArmholeEvents, type FrontArmholeEvent } from "./frontArmholeNecklineComposition";
import {
  resolveSleevelessDiagramBodyShapeKind,
  shouldGenerateSleevelessAlineStsRows,
} from "./sleevelessDiagramBodyShapeSrc";
import { isSleevelessCardiganGarmentStyle } from "./sleevelessFrontDiagramSrc";
import { shoulderStitchesPerSideForDiagram } from "./sleevelessGarmentDiagramReplacements";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import { armholeBindOffDecreaseFromEachSide } from "./sleevelessBackJapaneseNotation";
import type { StitchDecreasePoint } from "./shapingNotationCompress";
import { collectCompleteShoulderShapingPoints } from "./shoulderShapingNotation";

export type SleevelessBackStsRowsBodyShapingDirection = "straight" | "inward" | "outward";

export type SleevelessBackStsRowsDiagramWidths = {
  hemStitches: number;
  bustStitches: number;
  stitchesAfterArmhole: number;
  necklineStitches: number;
  shoulderStitchesPerSide: number;
  stitchesPerInch: number;
};

export type SleevelessBackStsRowsDiagramRows = {
  hemRows: number;
  sideSeamRowsAboveHem: number;
  rowsFromCastOnToArmholeStart: number;
  armholeRows: number;
  backNeckDepthRows: number;
  expectedGarmentRows: number;
  backFinalRow: number;
  rowsPerInch: number;
};

export type SleevelessBackStsRowsDiagramNeckline = {
  style: "round";
  startGarmentRc: number;
  depthRows: number;
  necklineStitches: number;
  strategy: "deep-round" | "shallow-round";
  centerBindOffStitches: number;
  centerHeld: boolean;
};

export type SleevelessBackStsRowsDiagramArmhole = {
  startGarmentRc: number;
  lastGarmentRc: number;
  stitchesEachSide: number;
  bindOffStsEachSide: number;
  decreaseStsEachSide: number;
  events: readonly FrontArmholeEvent[];
};

export type SleevelessBackStsRowsDiagramShoulder = {
  startGarmentRc: number;
  stitchesPerSide: number;
  points: readonly StitchDecreasePoint[];
};

export type SleevelessBackStsRowsDiagramBodyShaping = {
  direction: SleevelessBackStsRowsBodyShapingDirection;
  hemStitches: number;
  bustStitches: number;
  startRc: number;
  endRc: number;
  rowNumbers: readonly number[];
};

export type SleevelessBackStsRowsDiagramModel = {
  piece: "back";
  garmentStyle: "pullover" | "cardigan";
  bodyShape: "straight" | "aline";
  widths: SleevelessBackStsRowsDiagramWidths;
  rows: SleevelessBackStsRowsDiagramRows;
  neckline: SleevelessBackStsRowsDiagramNeckline;
  armhole: SleevelessBackStsRowsDiagramArmhole;
  shoulder: SleevelessBackStsRowsDiagramShoulder;
  bodyShaping: SleevelessBackStsRowsDiagramBodyShaping;
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function finiteOr(n: unknown, fallback: number): number {
  return isFiniteNumber(n) ? n : fallback;
}

function backTimeline(result: SleevelessBackPatternResult) {
  return result.backNeckShoulderTimeline ?? result.neckShoulderShapingChart.timeline ?? [];
}

function backShoulderPoints(result: SleevelessBackPatternResult): StitchDecreasePoint[] {
  const timeline = backTimeline(result);
  if (timeline.length === 0) return [];
  const budget = shoulderStitchesPerSideForDiagram(result.debug);
  const points = collectCompleteShoulderShapingPoints(timeline, "right", undefined, {
    shoulderStitchesBudget: budget,
  });
  const shoulderStart = result.debug.shoulderStartRow;
  if (shoulderStart !== undefined && Number.isFinite(shoulderStart)) {
    return points.filter((p) => p.row >= Math.floor(shoulderStart));
  }
  return points;
}

function sideSeamRowsAboveHem(d: SleevelessBackPatternResult["debug"]): number | undefined {
  const hemRows = isFiniteNumber(d.hemRows) ? Math.round(d.hemRows) : undefined;
  const castOnToArmhole = isFiniteNumber(d.rowsFromCastOnToArmholeStart)
    ? Math.round(d.rowsFromCastOnToArmholeStart)
    : isFiniteNumber(hemRows) && isFiniteNumber(d.bodyRows)
      ? hemRows + Math.round(d.bodyRows)
      : undefined;
  if (castOnToArmhole !== undefined && hemRows !== undefined) {
    return Math.max(0, castOnToArmhole - hemRows);
  }
  if (isFiniteNumber(d.bodyRows)) return Math.max(0, Math.round(d.bodyRows));
  return undefined;
}

function resolveBodyShaping(result: SleevelessBackPatternResult): SleevelessBackStsRowsDiagramBodyShaping {
  const d = result.debug;
  const hemStitches = Math.max(
    1,
    Math.round(finiteOr(d.hemCastOnStitches, finiteOr(d.backStitches, 1))),
  );
  const bustStitches = Math.max(1, Math.round(finiteOr(d.bustBodyStitches, hemStitches)));
  const rowNumbers = [...(d.alineBodyShapingRowNumbers ?? [])]
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    .map((n) => Math.floor(n))
    .sort((a, b) => a - b);
  const direction: SleevelessBackStsRowsBodyShapingDirection =
    hemStitches > bustStitches ? "inward" : hemStitches < bustStitches ? "outward" : "straight";
  if (direction === "straight") {
    return { direction, hemStitches, bustStitches, startRc: 0, endRc: 0, rowNumbers: [] };
  }
  if (rowNumbers.length === 0) {
    const hemRc = Math.max(0, Math.round(finiteOr(d.hemRows, 0)));
    const armholeRc = Math.max(
      hemRc,
      Math.floor(finiteOr(d.armholeStartRow, d.rowsFromCastOnToArmholeStart ?? 0)),
    );
    return { direction, hemStitches, bustStitches, startRc: hemRc, endRc: armholeRc, rowNumbers };
  }
  return {
    direction,
    hemStitches,
    bustStitches,
    startRc: rowNumbers[0]!,
    endRc: rowNumbers[rowNumbers.length - 1]!,
    rowNumbers,
  };
}

/** True when this result is in the Back Stitches & Rows model scope (straight or A-line). */
export function shouldBuildSleevelessBackStsRowsDiagramModel(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): boolean {
  if (!result.neckShoulderChartUsesLiveRows) return false;
  const bodyKind = resolveSleevelessDiagramBodyShapeKind(patternData);
  return (
    bodyKind === "straight" ||
    shouldGenerateSleevelessAlineStsRows(patternData, result.debug.alineBodyShapingType)
  );
}

/**
 * Back measurement model for the Stitches & Rows renderer (straight or A-line).
 * Returns `null` when the result is out of scope so hydration keeps the Illustrator SVG.
 */
export function buildSleevelessBackStsRowsDiagramModel(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): SleevelessBackStsRowsDiagramModel | null {
  if (!shouldBuildSleevelessBackStsRowsDiagramModel(result, patternData)) return null;

  const d = result.debug;
  const bodyShaping = resolveBodyShaping(result);
  const hemStitches = bodyShaping.hemStitches;
  const bustStitches = bodyShaping.bustStitches;
  const stitchesAfterArmhole = Math.round(finiteOr(d.stitchesAfterArmhole, bustStitches));
  const necklineStitches = Math.max(0, Math.round(finiteOr(d.necklineStitches, 0)));
  const shoulderStitchesPerSide = shoulderStitchesPerSideForDiagram(d);
  if (
    !(stitchesAfterArmhole > 0) ||
    !isFiniteNumber(d.stitchesPerInch) ||
    d.stitchesPerInch <= 0 ||
    !isFiniteNumber(d.rowsPerInch) ||
    d.rowsPerInch <= 0 ||
    shoulderStitchesPerSide === undefined
  ) {
    return null;
  }

  const hemRows = Math.max(0, Math.round(finiteOr(d.hemRows, 0)));
  const rowsFromCastOnToArmholeStart = Math.max(
    0,
    Math.round(finiteOr(d.rowsFromCastOnToArmholeStart, hemRows + finiteOr(d.bodyRows, 0))),
  );
  const sideSeam = sideSeamRowsAboveHem(d);
  const armholeRows = isFiniteNumber(d.armholeRows) ? Math.round(d.armholeRows) : undefined;
  const backNeckDepthRows = isFiniteNumber(d.backNeckDepthRows)
    ? Math.round(d.backNeckDepthRows)
    : undefined;
  const expectedGarmentRows = isFiniteNumber(d.expectedGarmentRows)
    ? Math.round(d.expectedGarmentRows)
    : undefined;
  const backFinalRow = Math.round(finiteOr(d.backFinalRow, finiteOr(d.expectedGarmentRows, 0)));
  if (
    sideSeam === undefined ||
    armholeRows === undefined ||
    backNeckDepthRows === undefined ||
    expectedGarmentRows === undefined
  ) {
    return null;
  }

  const armholeStart = Math.max(0, Math.floor(finiteOr(d.armholeStartRow, 0)));
  const neckStartGarmentRc = Math.max(
    0,
    Math.floor(finiteOr(d.backNecklineStartRC, armholeStart)),
  );
  const eachSide = d.armholeStitchesEachSide;
  if (!isFiniteNumber(eachSide) || eachSide <= 0) return null;
  const stitchesEachSide = Math.round(eachSide);
  const { bindOffSts, decreaseSts } = armholeBindOffDecreaseFromEachSide(stitchesEachSide);
  const events = pulloverArmholeEvents({
    firstArmholeGarmentRc: armholeStart,
    bindOffSts,
    decreaseSts,
  });
  const lastDecrease = events
    .filter((ev) => ev.kind === "decrease")
    .reduce((max, ev) => Math.max(max, ev.garmentRc), armholeStart);
  const lastArmholeGarmentRc = Math.max(
    armholeStart,
    Math.floor(finiteOr(d.armholeEndRow, lastDecrease)),
  );
  const shoulderStartGarmentRc = Math.max(
    lastArmholeGarmentRc,
    Math.floor(finiteOr(d.shoulderStartRow, lastArmholeGarmentRc)),
  );

  const strategy: "deep-round" | "shallow-round" =
    d.backNeckRoundNecklineStrategy === "deep-round" ? "deep-round" : "shallow-round";

  return {
    piece: "back",
    garmentStyle: isSleevelessCardiganGarmentStyle(patternData ?? {}) ? "cardigan" : "pullover",
    bodyShape: shouldGenerateSleevelessAlineStsRows(patternData, d.alineBodyShapingType)
      ? "aline"
      : "straight",
    widths: {
      hemStitches,
      bustStitches,
      stitchesAfterArmhole,
      necklineStitches,
      shoulderStitchesPerSide,
      stitchesPerInch: d.stitchesPerInch,
    },
    rows: {
      hemRows,
      sideSeamRowsAboveHem: sideSeam,
      rowsFromCastOnToArmholeStart,
      armholeRows,
      backNeckDepthRows,
      expectedGarmentRows,
      backFinalRow,
      rowsPerInch: d.rowsPerInch,
    },
    neckline: {
      style: "round",
      startGarmentRc: neckStartGarmentRc,
      depthRows: backNeckDepthRows,
      necklineStitches,
      strategy,
      centerBindOffStitches: Math.max(0, Math.round(finiteOr(d.centerNeckBindOffStitches, 0))),
      centerHeld: strategy === "shallow-round",
    },
    armhole: {
      startGarmentRc: armholeStart,
      lastGarmentRc: lastArmholeGarmentRc,
      stitchesEachSide,
      bindOffStsEachSide: bindOffSts,
      decreaseStsEachSide: decreaseSts,
      events,
    },
    shoulder: {
      startGarmentRc: shoulderStartGarmentRc,
      stitchesPerSide: shoulderStitchesPerSide,
      points: backShoulderPoints(result),
    },
    bodyShaping,
  };
}
