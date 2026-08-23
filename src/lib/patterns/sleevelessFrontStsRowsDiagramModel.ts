/**
 * Data model for the Sleeveless Front Stitches & Rows diagram.
 *
 * Scope: pullover, V-neck or round neck, straight body.
 * Reads a finalized {@link SleevelessBackPatternResult}. No pattern math, no SVG.
 */

import { pulloverArmholeEvents, type FrontArmholeEvent } from "./frontArmholeNecklineComposition";
import { collectInnerNeckDecreasePointsFromTimeline } from "./notationOverlaySvg";
import { resolveSleevelessDiagramBodyShapeKind } from "./sleevelessDiagramBodyShapeSrc";
import {
  isSleevelessCardiganGarmentStyle,
  isSleevelessVNeckChoice,
} from "./sleevelessFrontDiagramSrc";
import {
  isSleevelessPulloverVNeckFrontNotation,
  resolveFrontVNeckNotationRcModel,
} from "./sleevelessFrontJapaneseNotation";
import { shoulderStitchesPerSideForDiagram } from "./sleevelessGarmentDiagramReplacements";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import { armholeBindOffDecreaseFromEachSide } from "./sleevelessBackJapaneseNotation";
import { buildSleevelessRoundNeckShapingSchedule } from "./sleevelessRoundNeckShapingSchedule";
import type { StitchDecreasePoint } from "./shapingNotationCompress";
import { collectCompleteShoulderShapingPoints } from "./shoulderShapingNotation";

export type SleevelessFrontStsRowsBodyShapingDirection = "straight" | "inward" | "outward";

export type SleevelessFrontStsRowsDiagramWidths = {
  hemStitches: number;
  bustStitches: number;
  stitchesAfterArmhole: number;
  necklineStitches: number;
  shoulderStitchesPerSide: number;
  stitchesPerInch: number;
};

export type SleevelessFrontStsRowsDiagramRows = {
  hemRows: number;
  /** Cast-on → armhole minus hem band (diagram `SIDE_LENGTH_ROWS`). */
  sideSeamRowsAboveHem: number;
  rowsFromCastOnToArmholeStart: number;
  armholeRows: number;
  frontNeckDepthRows: number;
  expectedGarmentRows: number;
  frontFinalRow: number;
  rowsPerInch: number;
};

export type SleevelessFrontStsRowsVNeckline = {
  style: "v-neck";
  startGarmentRc: number;
  divideGarmentRc: number;
  depthRows: number;
  necklineStitches: number;
  beginsBeforeArmhole: boolean;
  /** Right-neck inner decreases from the live front timeline (pullover is mirrored). */
  innerDecreasePoints: readonly StitchDecreasePoint[];
};

export type SleevelessFrontStsRowsRoundNeckline = {
  style: "round";
  startGarmentRc: number;
  depthRows: number;
  necklineStitches: number;
  strategy: "deep-round" | "shallow-round";
  centerBindOffStitches: number;
  centerHeld: boolean;
};

export type SleevelessFrontStsRowsDiagramNeckline =
  | SleevelessFrontStsRowsVNeckline
  | SleevelessFrontStsRowsRoundNeckline;

export function isSleevelessFrontStsRowsVNeckline(
  neckline: SleevelessFrontStsRowsDiagramNeckline,
): neckline is SleevelessFrontStsRowsVNeckline {
  return neckline.style === "v-neck";
}

export function isSleevelessFrontStsRowsRoundNeckline(
  neckline: SleevelessFrontStsRowsDiagramNeckline,
): neckline is SleevelessFrontStsRowsRoundNeckline {
  return neckline.style === "round";
}

export type SleevelessFrontStsRowsDiagramArmhole = {
  startGarmentRc: number;
  lastGarmentRc: number;
  stitchesEachSide: number;
  bindOffStsEachSide: number;
  decreaseStsEachSide: number;
  events: readonly FrontArmholeEvent[];
  overlapsNeckline: boolean;
};

export type SleevelessFrontStsRowsDiagramShoulder = {
  startGarmentRc: number;
  stitchesPerSide: number;
  /** Right-shoulder bind-off points from the live front timeline (pullover is mirrored). */
  points: readonly StitchDecreasePoint[];
};

export type SleevelessFrontStsRowsDiagramBodyShaping = {
  direction: SleevelessFrontStsRowsBodyShapingDirection;
  hemStitches: number;
  bustStitches: number;
  startRc: number;
  endRc: number;
  rowNumbers: readonly number[];
};

export type SleevelessFrontStsRowsDiagramModel = {
  piece: "front";
  garmentStyle: "pullover";
  bodyShape: "straight";
  widths: SleevelessFrontStsRowsDiagramWidths;
  rows: SleevelessFrontStsRowsDiagramRows;
  neckline: SleevelessFrontStsRowsDiagramNeckline;
  armhole: SleevelessFrontStsRowsDiagramArmhole;
  shoulder: SleevelessFrontStsRowsDiagramShoulder;
  bodyShaping: SleevelessFrontStsRowsDiagramBodyShaping;
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function finiteOr(n: unknown, fallback: number): number {
  return isFiniteNumber(n) ? n : fallback;
}

function frontTimeline(result: SleevelessBackPatternResult) {
  return result.frontNeckShoulderTimeline ?? result.frontNeckShoulderShapingChart.timeline ?? [];
}

/**
 * Same shoulder-point collection as the live V-neck notation generator
 * (`pulloverVNeckFrontShoulderPoints`) — no extra math.
 */
function frontShoulderPoints(result: SleevelessBackPatternResult): StitchDecreasePoint[] {
  const timeline = frontTimeline(result);
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

function resolveBodyShaping(result: SleevelessBackPatternResult): SleevelessFrontStsRowsDiagramBodyShaping {
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
  const direction: SleevelessFrontStsRowsBodyShapingDirection =
    hemStitches > bustStitches ? "inward" : hemStitches < bustStitches ? "outward" : "straight";
  if (direction === "straight") {
    return { direction, hemStitches, bustStitches, startRc: 0, endRc: 0, rowNumbers: [] };
  }
  if (rowNumbers.length === 0) {
    const armholeRc = Math.max(
      0,
      Math.floor(finiteOr(d.armholeStartRow, d.rowsFromCastOnToArmholeStart ?? 0)),
    );
    return { direction, hemStitches, bustStitches, startRc: 0, endRc: armholeRc, rowNumbers };
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

function isPulloverRoundFront(patternData?: unknown): boolean {
  return (
    !isSleevelessCardiganGarmentStyle(patternData ?? {}) && !isSleevelessVNeckChoice(patternData ?? {})
  );
}

/** True when this result is in the Stitches & Rows model scope (pullover V or round, straight). */
export function shouldBuildSleevelessFrontStsRowsDiagramModel(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): boolean {
  if (isSleevelessCardiganGarmentStyle(patternData ?? {})) return false;
  if (!result.frontNeckShoulderChartUsesLiveRows) return false;
  if (resolveSleevelessDiagramBodyShapeKind(patternData) !== "straight") return false;
  return (
    isSleevelessPulloverVNeckFrontNotation(result, patternData) || isPulloverRoundFront(patternData)
  );
}

/**
 * Pullover Front, straight-body measurement model for the Stitches & Rows renderer.
 * V-neck and round neck only. Returns `null` when the result is out of scope
 * so hydration can keep the existing Illustrator SVG.
 */
export function buildSleevelessFrontStsRowsDiagramModel(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): SleevelessFrontStsRowsDiagramModel | null {
  if (!shouldBuildSleevelessFrontStsRowsDiagramModel(result, patternData)) return null;

  const d = result.debug;
  const isVNeck = isSleevelessPulloverVNeckFrontNotation(result, patternData);
  const overlap = isVNeck ? d.frontArmholeNecklineOverlap : undefined;
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
  const frontNeckDepthRows = isFiniteNumber(d.frontNeckDepthRows)
    ? Math.round(d.frontNeckDepthRows)
    : undefined;
  const expectedGarmentRows = isFiniteNumber(d.expectedGarmentRows)
    ? Math.round(d.expectedGarmentRows)
    : undefined;
  const frontFinalRow = Math.round(finiteOr(d.frontFinalRow, finiteOr(d.expectedGarmentRows, 0)));
  if (
    sideSeam === undefined ||
    armholeRows === undefined ||
    frontNeckDepthRows === undefined ||
    expectedGarmentRows === undefined
  ) {
    return null;
  }

  const vRcModel = isVNeck ? resolveFrontVNeckNotationRcModel(result) : null;
  const armholeStart = Math.max(
    0,
    Math.floor(
      finiteOr(isVNeck ? vRcModel?.armholeBoGarmentRc : undefined, d.armholeStartRow ?? 0),
    ),
  );
  const neckStartGarmentRc = isVNeck
    ? Math.max(
        0,
        Math.floor(finiteOr(overlap?.divideGarmentRc, finiteOr(d.frontNecklineStartRC, armholeStart))),
      )
    : Math.max(0, Math.floor(finiteOr(d.frontNecklineStartRC, armholeStart)));
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
  const lastArmholeGarmentRc = isVNeck
    ? Math.max(armholeStart, Math.floor(finiteOr(overlap?.lastArmholeGarmentRc, lastDecrease)))
    : Math.max(armholeStart, lastDecrease);
  const shoulderStartGarmentRc = Math.max(
    lastArmholeGarmentRc,
    Math.floor(finiteOr(d.shoulderStartRow, lastArmholeGarmentRc)),
  );

  const timeline = frontTimeline(result);
  const shoulderPoints = frontShoulderPoints(result);
  const neckline: SleevelessFrontStsRowsDiagramNeckline = isVNeck
    ? {
        style: "v-neck",
        startGarmentRc: neckStartGarmentRc,
        divideGarmentRc: Math.max(
          0,
          Math.floor(finiteOr(overlap?.divideGarmentRc, neckStartGarmentRc)),
        ),
        depthRows: frontNeckDepthRows,
        necklineStitches,
        beginsBeforeArmhole: overlap?.necklineBeginsBeforeArmhole === true,
        innerDecreasePoints: collectInnerNeckDecreasePointsFromTimeline(timeline, "right"),
      }
    : roundNecklineFromResult(result, {
        startGarmentRc: neckStartGarmentRc,
        depthRows: frontNeckDepthRows,
        necklineStitches,
      });

  return {
    piece: "front",
    garmentStyle: "pullover",
    bodyShape: "straight",
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
      frontNeckDepthRows,
      expectedGarmentRows,
      frontFinalRow,
      rowsPerInch: d.rowsPerInch,
    },
    neckline,
    armhole: {
      startGarmentRc: armholeStart,
      lastGarmentRc: lastArmholeGarmentRc,
      stitchesEachSide,
      bindOffStsEachSide: bindOffSts,
      decreaseStsEachSide: decreaseSts,
      events,
      overlapsNeckline: isVNeck && overlap != null,
    },
    shoulder: {
      startGarmentRc: shoulderStartGarmentRc,
      stitchesPerSide: shoulderStitchesPerSide,
      points: shoulderPoints,
    },
    bodyShaping,
  };
}

function roundNecklineFromResult(
  result: SleevelessBackPatternResult,
  args: { startGarmentRc: number; depthRows: number; necklineStitches: number },
): SleevelessFrontStsRowsRoundNeckline {
  const d = result.debug;
  const schedule = buildSleevelessRoundNeckShapingSchedule(frontTimeline(result));
  const strategy: "deep-round" | "shallow-round" =
    d.frontNeckRoundNecklineStrategy === "shallow-round" ||
    (d.frontNeckRoundNecklineStrategy !== "deep-round" && schedule?.centerHeld === true)
      ? "shallow-round"
      : "deep-round";
  return {
    style: "round",
    startGarmentRc: args.startGarmentRc,
    depthRows: args.depthRows,
    necklineStitches: args.necklineStitches,
    strategy,
    centerBindOffStitches: Math.max(
      0,
      Math.round(finiteOr(d.frontCenterNeckBindOffStitches, schedule?.centerStitches ?? 0)),
    ),
    centerHeld: schedule?.centerHeld === true || strategy === "shallow-round",
  };
}
