/**
 * Data model for the Sleeveless Front Stitches & Rows diagram.
 *
 * Scope: pullover (V or round, straight or A-line) and cardigan (V or round,
 * straight or A-line). Reads a finalized {@link SleevelessBackPatternResult}.
 * No pattern math, no SVG.
 */

import { pulloverArmholeEvents, type FrontArmholeEvent } from "./frontArmholeNecklineComposition";
import { collectInnerNeckDecreasePointsFromTimeline } from "./notationOverlaySvg";
import {
  cardiganFrontInitialNeckBindOffStitches,
  cardiganFrontNeckOpeningStitches,
} from "./roundNeckNotation";
import {
  resolveSleevelessDiagramBodyShapeKind,
  shouldGenerateSleevelessAlineStsRows,
} from "./sleevelessDiagramBodyShapeSrc";
import {
  isSleevelessCardiganGarmentStyle,
  isSleevelessVNeckChoice,
} from "./sleevelessFrontDiagramSrc";
import {
  isSleevelessPulloverVNeckFrontNotation,
  resolveFrontVNeckNotationRcModel,
} from "./sleevelessFrontJapaneseNotation";
import { sleevelessCardiganFrontEdgeFinishingMode } from "./sleevelessPatternFinishing";
import { shoulderStitchesPerSideForDiagram } from "./sleevelessGarmentDiagramReplacements";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import { armholeBindOffDecreaseFromEachSide } from "./sleevelessBackJapaneseNotation";
import { buildSleevelessRoundNeckShapingSchedule } from "./sleevelessRoundNeckShapingSchedule";
import type { StitchDecreasePoint } from "./shapingNotationCompress";
import { collectCompleteShoulderShapingPoints } from "./shoulderShapingNotation";

export type SleevelessFrontStsRowsBodyShapingDirection = "straight" | "inward" | "outward";

/** Pullover tapers both sides; cardigan A-line shapes the side seam only. */
export type SleevelessFrontStsRowsBodyShapingEdge = "bothSides" | "sideSeamOnly";

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
  /** Pullover divides the full front; cardigan works one CF edge. */
  construction: "full-front-divide" | "half-front-cf";
};

export type SleevelessFrontStsRowsRoundNeckline = {
  style: "round";
  startGarmentRc: number;
  depthRows: number;
  necklineStitches: number;
  strategy: "deep-round" | "shallow-round";
  centerBindOffStitches: number;
  centerHeld: boolean;
  /** Pullover binds off the center; cardigan binds off the CF edge of one front. */
  construction: "full-front-center" | "half-front-cf";
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
  edgeScope: SleevelessFrontStsRowsBodyShapingEdge;
};

export type SleevelessFrontStsRowsFrontPiece = "fullFront" | "leftFront";

/**
 * Front-band finishing is never part of the knitted Front piece.
 * Pickup (round) or vertical bands (V) are attached later.
 */
export type SleevelessFrontStsRowsFrontBand = {
  includedInPiece: false;
  treatment: "pickup" | "verticalBand";
  edgeRows?: number;
  pickupStitches?: number;
};

export type SleevelessFrontStsRowsDiagramModel = {
  piece: "front";
  garmentStyle: "pullover" | "cardigan";
  frontPiece: SleevelessFrontStsRowsFrontPiece;
  bodyShape: "straight" | "aline";
  widths: SleevelessFrontStsRowsDiagramWidths;
  rows: SleevelessFrontStsRowsDiagramRows;
  neckline: SleevelessFrontStsRowsDiagramNeckline;
  armhole: SleevelessFrontStsRowsDiagramArmhole;
  shoulder: SleevelessFrontStsRowsDiagramShoulder;
  bodyShaping: SleevelessFrontStsRowsDiagramBodyShaping;
  frontBand?: SleevelessFrontStsRowsFrontBand;
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
function frontShoulderPoints(
  result: SleevelessBackPatternResult,
  shoulderBudget?: number,
): StitchDecreasePoint[] {
  const timeline = frontTimeline(result);
  if (timeline.length === 0) return [];
  const budget = shoulderBudget ?? shoulderStitchesPerSideForDiagram(result.debug);
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

function resolveBodyShaping(
  result: SleevelessBackPatternResult,
  stitchCounts?: { hemStitches: number; bustStitches: number },
  edgeScope: SleevelessFrontStsRowsBodyShapingEdge = "bothSides",
): SleevelessFrontStsRowsDiagramBodyShaping {
  const d = result.debug;
  const hemStitches = Math.max(
    1,
    Math.round(
      stitchCounts?.hemStitches ?? finiteOr(d.hemCastOnStitches, finiteOr(d.backStitches, 1)),
    ),
  );
  const bustStitches = Math.max(
    1,
    Math.round(stitchCounts?.bustStitches ?? finiteOr(d.bustBodyStitches, hemStitches)),
  );
  const rowNumbers = [...(d.alineBodyShapingRowNumbers ?? [])]
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    .map((n) => Math.floor(n))
    .sort((a, b) => a - b);
  const direction: SleevelessFrontStsRowsBodyShapingDirection =
    hemStitches > bustStitches ? "inward" : hemStitches < bustStitches ? "outward" : "straight";
  if (direction === "straight") {
    return { direction, hemStitches, bustStitches, startRc: 0, endRc: 0, rowNumbers: [], edgeScope };
  }
  if (rowNumbers.length === 0) {
    const hemRc = Math.max(0, Math.round(finiteOr(d.hemRows, 0)));
    const armholeRc = Math.max(
      hemRc,
      Math.floor(finiteOr(d.armholeStartRow, d.rowsFromCastOnToArmholeStart ?? 0)),
    );
    return {
      direction,
      hemStitches,
      bustStitches,
      startRc: hemRc,
      endRc: armholeRc,
      rowNumbers,
      edgeScope,
    };
  }
  return {
    direction,
    hemStitches,
    bustStitches,
    startRc: rowNumbers[0]!,
    endRc: rowNumbers[rowNumbers.length - 1]!,
    rowNumbers,
    edgeScope,
  };
}

function isPulloverRoundFront(patternData?: unknown): boolean {
  return (
    !isSleevelessCardiganGarmentStyle(patternData ?? {}) && !isSleevelessVNeckChoice(patternData ?? {})
  );
}

function isStraightCardiganFront(patternData?: unknown): boolean {
  return (
    isSleevelessCardiganGarmentStyle(patternData ?? {}) &&
    resolveSleevelessDiagramBodyShapeKind(patternData) === "straight"
  );
}

function isCardiganAlineFront(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): boolean {
  return (
    isSleevelessCardiganGarmentStyle(patternData ?? {}) &&
    shouldGenerateSleevelessAlineStsRows(patternData, result.debug.alineBodyShapingType)
  );
}

/** Armhole-edge events only — cardigan CF has no bind-off (band is added later). */
function cardiganLeftFrontArmholeEvents(args: {
  firstArmholeGarmentRc: number;
  bindOffSts: number;
  decreaseSts: number;
}): FrontArmholeEvent[] {
  return pulloverArmholeEvents(args).filter((ev) => ev.side === "right");
}

function cardiganLeftFrontWidths(
  result: SleevelessBackPatternResult,
): SleevelessFrontStsRowsDiagramWidths | null {
  const d = result.debug;
  const hemStitches = Math.round(finiteOr(d.cardiganHalfLeftCastOnSts, 0));
  const bustStitches = Math.round(finiteOr(d.cardiganHalfLeftBustBodySts, hemStitches));
  const stitchesAfterArmhole = Math.round(
    finiteOr(d.cardiganFrontPostArmholeSts, finiteOr(d.cardiganHalfLeftStitchesAfterArmhole, 0)),
  );
  const fullNeck = Math.max(0, Math.round(finiteOr(d.necklineStitches, 0)));
  const necklineStitches = cardiganFrontNeckOpeningStitches(fullNeck);
  const shoulderStitchesPerSide = Math.max(1, stitchesAfterArmhole - necklineStitches);
  if (
    !(hemStitches > 0) ||
    !(bustStitches > 0) ||
    !(stitchesAfterArmhole > 0) ||
    !isFiniteNumber(d.stitchesPerInch) ||
    d.stitchesPerInch <= 0 ||
    !isFiniteNumber(d.rowsPerInch) ||
    d.rowsPerInch <= 0
  ) {
    return null;
  }
  return {
    hemStitches,
    bustStitches,
    stitchesAfterArmhole,
    necklineStitches,
    shoulderStitchesPerSide,
    stitchesPerInch: d.stitchesPerInch,
  };
}

function cardiganFrontBand(result: SleevelessBackPatternResult, patternData?: unknown) {
  const treatment = sleevelessCardiganFrontEdgeFinishingMode(patternData);
  if (treatment !== "pickup" && treatment !== "verticalBand") return undefined;
  const d = result.debug;
  return {
    includedInPiece: false as const,
    treatment,
    edgeRows: isFiniteNumber(d.cardiganFrontEdgeRows)
      ? Math.round(d.cardiganFrontEdgeRows)
      : undefined,
    pickupStitches: isFiniteNumber(d.cardiganFrontEdgePickupSts)
      ? Math.round(d.cardiganFrontEdgePickupSts)
      : undefined,
  };
}

/** True when this result is in the Stitches & Rows model scope. */
export function shouldBuildSleevelessFrontStsRowsDiagramModel(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): boolean {
  if (!result.frontNeckShoulderChartUsesLiveRows) return false;
  const cardiganWidths = isSleevelessCardiganGarmentStyle(patternData ?? {})
    ? cardiganLeftFrontWidths(result)
    : null;
  if (isStraightCardiganFront(patternData)) {
    return cardiganWidths != null && cardiganWidths.hemStitches === cardiganWidths.bustStitches;
  }
  if (isCardiganAlineFront(result, patternData)) {
    return cardiganWidths != null && cardiganWidths.hemStitches !== cardiganWidths.bustStitches;
  }
  if (isSleevelessCardiganGarmentStyle(patternData ?? {})) return false;
  const bodyKind = resolveSleevelessDiagramBodyShapeKind(patternData);
  const generateAline = shouldGenerateSleevelessAlineStsRows(
    patternData,
    result.debug.alineBodyShapingType,
  );
  if (bodyKind !== "straight" && !generateAline) return false;
  return (
    isSleevelessPulloverVNeckFrontNotation(result, patternData) || isPulloverRoundFront(patternData)
  );
}

/**
 * Front measurement model for the Stitches & Rows renderer.
 * Pullover: V or round, straight or A-line. Cardigan: V or round, straight or A-line.
 * Returns `null` when the result is out of scope so hydration can keep the
 * existing Illustrator SVG.
 */
export function buildSleevelessFrontStsRowsDiagramModel(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): SleevelessFrontStsRowsDiagramModel | null {
  if (!shouldBuildSleevelessFrontStsRowsDiagramModel(result, patternData)) return null;
  if (isStraightCardiganFront(patternData) || isCardiganAlineFront(result, patternData)) {
    return buildCardiganFrontStsRowsDiagramModel(result, patternData);
  }

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
        construction: "full-front-divide",
      }
    : roundNecklineFromResult(result, {
        startGarmentRc: neckStartGarmentRc,
        depthRows: frontNeckDepthRows,
        necklineStitches,
        construction: "full-front-center",
      });

  return {
    piece: "front",
    garmentStyle: "pullover",
    frontPiece: "fullFront",
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
  args: {
    startGarmentRc: number;
    depthRows: number;
    necklineStitches: number;
    construction: SleevelessFrontStsRowsRoundNeckline["construction"];
    centerBindOffStitches?: number;
  },
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
      Math.round(
        finiteOr(
          args.centerBindOffStitches,
          finiteOr(d.frontCenterNeckBindOffStitches, schedule?.centerStitches ?? 0),
        ),
      ),
    ),
    centerHeld: schedule?.centerHeld === true || strategy === "shallow-round",
    construction: args.construction,
  };
}

function sharedFrontRows(result: SleevelessBackPatternResult): SleevelessFrontStsRowsDiagramRows | null {
  const d = result.debug;
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
  return {
    hemRows,
    sideSeamRowsAboveHem: sideSeam,
    rowsFromCastOnToArmholeStart,
    armholeRows,
    frontNeckDepthRows,
    expectedGarmentRows,
    frontFinalRow,
    rowsPerInch: d.rowsPerInch,
  };
}

/**
 * One LEFT FRONT panel. Widths come from cardiganHalfLeft* / post-armhole
 * debug — not full-back stitch counts. Front-band stitches are excluded.
 * A-line uses the same half-front hem/bust and the live shaping RCs; CF is
 * not a shaping edge (`sideSeamOnly`).
 */
function buildCardiganFrontStsRowsDiagramModel(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): SleevelessFrontStsRowsDiagramModel | null {
  const widths = cardiganLeftFrontWidths(result);
  const rows = sharedFrontRows(result);
  if (!widths || !rows) return null;
  const bodyShaping = resolveBodyShaping(
    result,
    { hemStitches: widths.hemStitches, bustStitches: widths.bustStitches },
    "sideSeamOnly",
  );
  const bodyShape: "straight" | "aline" =
    isCardiganAlineFront(result, patternData) && bodyShaping.direction !== "straight"
      ? "aline"
      : "straight";

  const d = result.debug;
  const isVNeck = isSleevelessVNeckChoice(patternData ?? {});
  const eachSide = d.armholeStitchesEachSide;
  if (!isFiniteNumber(eachSide) || eachSide <= 0) return null;
  const stitchesEachSide = Math.round(eachSide);
  const { bindOffSts, decreaseSts } = armholeBindOffDecreaseFromEachSide(stitchesEachSide);
  const armholeStart = Math.max(0, Math.floor(finiteOr(d.armholeStartRow, 0)));
  const neckStartGarmentRc = Math.max(
    0,
    Math.floor(finiteOr(d.frontNecklineStartRC, armholeStart)),
  );
  const events = cardiganLeftFrontArmholeEvents({
    firstArmholeGarmentRc: armholeStart,
    bindOffSts,
    decreaseSts,
  });
  const lastDecrease = events
    .filter((ev) => ev.kind === "decrease")
    .reduce((max, ev) => Math.max(max, ev.garmentRc), armholeStart);
  const lastArmholeGarmentRc = Math.max(armholeStart, lastDecrease);
  const shoulderStartGarmentRc = Math.max(
    lastArmholeGarmentRc,
    Math.floor(finiteOr(d.shoulderStartRow, lastArmholeGarmentRc)),
  );
  const timeline = frontTimeline(result);
  const neckline: SleevelessFrontStsRowsDiagramNeckline = isVNeck
    ? {
        style: "v-neck",
        startGarmentRc: neckStartGarmentRc,
        divideGarmentRc: neckStartGarmentRc,
        depthRows: rows.frontNeckDepthRows,
        necklineStitches: widths.necklineStitches,
        beginsBeforeArmhole: neckStartGarmentRc < armholeStart,
        innerDecreasePoints: collectInnerNeckDecreasePointsFromTimeline(timeline, "right"),
        construction: "half-front-cf",
      }
    : roundNecklineFromResult(result, {
        startGarmentRc: neckStartGarmentRc,
        depthRows: rows.frontNeckDepthRows,
        necklineStitches: widths.necklineStitches,
        construction: "half-front-cf",
        centerBindOffStitches: Math.round(
          finiteOr(
            d.cardiganFrontInitialNeckBindOffStitches,
            cardiganFrontInitialNeckBindOffStitches(
              finiteOr(d.necklineStitches, 0),
              rows.frontNeckDepthRows,
            ),
          ),
        ),
      });

  return {
    piece: "front",
    garmentStyle: "cardigan",
    frontPiece: "leftFront",
    bodyShape,
    widths,
    rows,
    neckline,
    armhole: {
      startGarmentRc: armholeStart,
      lastGarmentRc: lastArmholeGarmentRc,
      stitchesEachSide,
      bindOffStsEachSide: bindOffSts,
      decreaseStsEachSide: decreaseSts,
      events,
      overlapsNeckline: false,
    },
    shoulder: {
      startGarmentRc: shoulderStartGarmentRc,
      stitchesPerSide: widths.shoulderStitchesPerSide,
      points: frontShoulderPoints(result, widths.shoulderStitchesPerSide),
    },
    bodyShaping,
    frontBand: cardiganFrontBand(result, patternData),
  };
}
