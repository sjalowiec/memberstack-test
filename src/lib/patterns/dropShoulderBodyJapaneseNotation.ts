/**
 * Live Japanese notation tokens for drop-shoulder body SVGs (back + front).
 *
 * Drop shoulder has no armhole or shoulder shaping — only straight body rows and neckline
 * bind-off/shaping on the back and front. Values come from {@link SleevelessBackPatternResult.debug}
 * and the same round/V neckline helpers used by written instructions.
 */

import { evenShapingSchedule } from "./evenShapingSchedule";
import {
  resolveEffectiveBackNeckDepthInches,
  resolveEffectiveFrontNeckDepthInches,
} from "./customBuildEffectiveNeckDepth";
import { resolveEffectiveNeckOpeningWidthInches } from "./customBuildEffectiveNeckOpeningWidth";
import { calculateRoundNecklinePlan, isShallowHoldRoundPlan } from "./legoBlocks/roundNeckline";
import { neckDecreaseStitchesPerSideFromOpening } from "./legoBlocks/vNeckline";
import {
  cardiganFrontInitialNeckBindOffStitches,
  cardiganFrontNeckOpeningStitches,
} from "./roundNeckNotation";
import {
  backRoundNeckPlanForDepth,
  roundNeckPlanOneSideBackNeckEdgeJpLines,
  roundNeckPlanOneSideNeckEdgeJpLines,
} from "./roundNeckPlanPresentation";
import {
  resolveCardiganHalfFrontWidths,
  splitBodyBackCastOnToSymmetricCardiganHalves,
} from "./cardiganFrontBlock";
import {
  formatBindOffNotation,
  formatHoldNotation,
  formatBodyRowsNotation,
  formatCastOnNotation,
  formatRcNotation,
  formatRcResetSymbol,
  formatShapingSegment,
  bodyShapingJapaneseNotationFromAlinePlan,
  JP_BACK_NOTATION_SVG_TOKEN_KEYS,
  resolveAlineBodyShapingPlanForNotation,
  type JpBackNotationSvgTokenKey,
} from "./sleevelessBackJapaneseNotation";
import {
  scaleAlineBodyShapingPlanForCardiganHalf,
  type SleevelessAlineBodyShapingPlan,
} from "./sleevelessAlineShaping";
import { isSleevelessVNeckChoice } from "./sleevelessFrontDiagramSrc";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function joinNotationLines(lines: readonly string[]): string {
  return lines.filter((line) => line.length > 0).join("\n");
}

function forceEven(n: number): number {
  const r = Math.max(0, Math.round(n));
  return r % 2 === 0 ? r : r + 1;
}

/** Merge generator + diagram pattern inputs so notation can read measurements from either source. */
export function mergeDropShoulderNotationPatternData(
  generatorPatternData?: unknown,
  diagramPatternData?: unknown,
): Record<string, unknown> {
  const gen =
    generatorPatternData && typeof generatorPatternData === "object" && !Array.isArray(generatorPatternData)
      ? (generatorPatternData as Record<string, unknown>)
      : {};
  const diag =
    diagramPatternData && typeof diagramPatternData === "object" && !Array.isArray(diagramPatternData)
      ? (diagramPatternData as Record<string, unknown>)
      : {};
  const genFit = section(gen.fit);
  const diagFit = section(diag.fit);
  return {
    ...gen,
    ...diag,
    style: { ...section(gen.style), ...section(diag.style) },
    fit: {
      ...genFit,
      ...diagFit,
      selectedMeasurements: {
        ...section(genFit.selectedMeasurements),
        ...section(diagFit.selectedMeasurements),
      },
      cbMeasurementOverrides: {
        ...section(genFit.cbMeasurementOverrides),
        ...section(diagFit.cbMeasurementOverrides),
      },
    },
    yarnGaugeMachine: gen.yarnGaugeMachine ?? diag.yarnGaugeMachine,
  };
}

function neckOpeningInchesFromPatternData(patternData: Record<string, unknown>): number | undefined {
  // Includes legacy `neck_opening_width` via {@link resolveEffectiveNeckOpeningWidthInches}.
  return resolveEffectiveNeckOpeningWidthInches(patternData);
}

/** Full neck opening stitch count — debug first, then body/shoulder math, then pattern measurements. */
function resolveDropShoulderFullNecklineStitches(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): number {
  const d = result.debug;
  if (isFiniteNumber(d.necklineStitches) && d.necklineStitches > 0) {
    return Math.floor(d.necklineStitches);
  }
  const bodyWidth = isFiniteNumber(d.backStitches) ? Math.floor(d.backStitches) : 0;
  const shoulderEach = isFiniteNumber(d.shoulderStitches) ? Math.floor(d.shoulderStitches) : 0;
  if (bodyWidth > 0 && shoulderEach > 0 && bodyWidth > 2 * shoulderEach) {
    return bodyWidth - 2 * shoulderEach;
  }
  const pd =
    patternData && typeof patternData === "object" && !Array.isArray(patternData)
      ? (patternData as Record<string, unknown>)
      : {};
  const spi = d.stitchesPerInch;
  const neckIn = neckOpeningInchesFromPatternData(pd);
  if (neckIn !== undefined && isFiniteNumber(spi) && spi > 0) {
    return forceEven(neckIn * spi);
  }
  return 0;
}

function resolveDropShoulderBackNeckDepthRows(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): number {
  const d = result.debug;
  if (isFiniteNumber(d.backNeckDepthRows) && d.backNeckDepthRows > 0) {
    return Math.floor(d.backNeckDepthRows);
  }
  if (isFiniteNumber(d.reservedNecklineShoulderRows) && d.reservedNecklineShoulderRows > 0) {
    return Math.floor(d.reservedNecklineShoulderRows);
  }
  const pd =
    patternData && typeof patternData === "object" && !Array.isArray(patternData)
      ? (patternData as Record<string, unknown>)
      : {};
  const rpi = d.rowsPerInch;
  const backNeckDepthIn = resolveEffectiveBackNeckDepthInches(pd);
  if (backNeckDepthIn !== undefined && isFiniteNumber(rpi) && rpi > 0) {
    return Math.max(0, Math.round(backNeckDepthIn * rpi));
  }
  return 0;
}

function resolveDropShoulderFrontNeckDepthRows(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): number {
  const d = result.debug as { frontNecklineWorkingRows?: number; frontNeckDepthRows?: number; rowsPerInch?: number };
  const isVNeck = isDropShoulderVNeck(patternData);
  if (
    isVNeck &&
    isFiniteNumber(d.frontNecklineWorkingRows) &&
    d.frontNecklineWorkingRows > 0
  ) {
    return Math.floor(d.frontNecklineWorkingRows);
  }
  if (isFiniteNumber(d.frontNeckDepthRows) && d.frontNeckDepthRows > 0) {
    return Math.floor(d.frontNeckDepthRows);
  }
  const pd =
    patternData && typeof patternData === "object" && !Array.isArray(patternData)
      ? (patternData as Record<string, unknown>)
      : {};
  const rpi = d.rowsPerInch;
  const frontNeckDepthIn = resolveEffectiveFrontNeckDepthInches(pd);
  if (frontNeckDepthIn !== undefined && isFiniteNumber(rpi) && rpi > 0) {
    return Math.max(1, Math.round(frontNeckDepthIn * rpi));
  }
  return 0;
}

/** Cardigan half-front round neck — matches `buildCardiganFrontRows` CF bind-off + shaping. */
function dropShoulderCardiganRoundNeckEdgeNotationLines(
  fullNecklineSts: number,
  frontNeckDepthRows: number,
): {
  centerBindOff: number;
  shapingLines: string[];
} {
  const fullNeck = Math.max(0, Math.round(fullNecklineSts));
  if (fullNeck <= 0) return { centerBindOff: 0, shapingLines: [] };
  const plan = calculateRoundNecklinePlan({
    necklineStitches: fullNeck,
    necklineDepthRows: frontNeckDepthRows,
  });
  return {
    centerBindOff: cardiganFrontInitialNeckBindOffStitches(fullNeck, frontNeckDepthRows),
    shapingLines: roundNeckPlanOneSideNeckEdgeJpLines(plan, "right"),
  };
}

function emptyReplacements(): Record<JpBackNotationSvgTokenKey, string> {
  return Object.fromEntries(JP_BACK_NOTATION_SVG_TOKEN_KEYS.map((k) => [k, ""])) as Record<
    JpBackNotationSvgTokenKey,
    string
  >;
}

/** Straight body rows from hem through the armhole-marker section (no armhole bind-off/shaping). */
function dropShoulderStraightBodyRows(d: SleevelessBackPatternResult["debug"]): number {
  const body = isFiniteNumber(d.bodyRows) ? Math.max(0, Math.floor(d.bodyRows)) : 0;
  const aboveMarker = isFiniteNumber(d.armholeRows) ? Math.max(0, Math.floor(d.armholeRows)) : 0;
  return body + aboveMarker;
}

function dropShoulderAlineBodyShapingPlan(
  result: SleevelessBackPatternResult,
  patternData: unknown,
): SleevelessAlineBodyShapingPlan | null {
  return resolveAlineBodyShapingPlanForNotation(result, patternData);
}

/** JP body-row count beside the diagram — straight rows after A-line side shaping when applicable. */
function dropShoulderJpBodyRowsNotation(
  d: SleevelessBackPatternResult["debug"],
  alinePlan: SleevelessAlineBodyShapingPlan | null,
): string {
  if (alinePlan && alinePlan.shapingType !== "straight") {
    if (alinePlan.straightRowsBeforeArmhole > 0) {
      return formatBodyRowsNotation(alinePlan.straightRowsBeforeArmhole);
    }
    const armholeRc = armholeMarkerGarmentRc(d);
    const shapingEnd = alinePlan.shapingEndRow;
    if (armholeRc !== undefined && shapingEnd > 0) {
      return formatBodyRowsNotation(Math.max(0, Math.floor(armholeRc) - Math.floor(shapingEnd)));
    }
  }
  return formatBodyRowsNotation(dropShoulderStraightBodyRows(d));
}

function dropShoulderFrontAlineBodyShapingPlan(
  result: SleevelessBackPatternResult,
  patternData: unknown,
  castOnSts: number,
): SleevelessAlineBodyShapingPlan | null {
  let plan = dropShoulderAlineBodyShapingPlan(result, patternData);
  if (!plan || !isDropShoulderCardigan(patternData)) return plan;

  const d = result.debug;
  const hemBase =
    isFiniteNumber(d.hemCastOnStitches) && d.hemCastOnStitches > 0
      ? d.hemCastOnStitches
      : (d.backStitches ?? 0);
  const bustBase =
    isFiniteNumber(d.bustBodyStitches) && d.bustBodyStitches > 0
      ? d.bustBodyStitches
      : hemBase;
  const halfWidths = resolveCardiganHalfFrontWidths(
    {
      hemCastOnSts: hemBase,
      bustBodySts: bustBase,
      stitchesAfterArmhole: d.stitchesAfterArmhole ?? 0,
    },
    "left",
  );
  return scaleAlineBodyShapingPlanForCardiganHalf(plan, castOnSts, halfWidths.bustBodySts);
}

function armholeMarkerGarmentRc(d: SleevelessBackPatternResult["debug"]): number | undefined {
  if (isFiniteNumber(d.rowsFromCastOnToArmholeStart)) {
    return Math.max(0, Math.floor(d.rowsFromCastOnToArmholeStart));
  }
  if (isFiniteNumber(d.hemRows) && isFiniteNumber(d.bodyRows)) {
    return Math.max(0, Math.floor(d.hemRows) + Math.floor(d.bodyRows));
  }
  return undefined;
}

export function isDropShoulderBodyJapaneseNotationSupported(
  result: SleevelessBackPatternResult,
): boolean {
  if (!result.isDropShoulder) return false;
  const castOn = result.debug.hemCastOnStitches ?? result.debug.backStitches;
  return isFiniteNumber(castOn) && castOn > 0;
}

export function buildDropShoulderBackJapaneseNotationReplacements(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
  generatorPatternData?: unknown,
): Record<string, string> {
  const empty = emptyReplacements();
  if (!isDropShoulderBodyJapaneseNotationSupported(result)) return empty;

  const mergedPatternData = mergeDropShoulderNotationPatternData(generatorPatternData, patternData);
  const d = result.debug;
  const castOnSts = d.hemCastOnStitches ?? d.backStitches ?? 0;
  const alineBodyPlan = dropShoulderAlineBodyShapingPlan(result, mergedPatternData);
  const fullNecklineSts = resolveDropShoulderFullNecklineStitches(result, mergedPatternData);
  const backNeckDepthRows = resolveDropShoulderBackNeckDepthRows(result, mergedPatternData);
  const backRoundNeckPlan =
    fullNecklineSts > 0
      ? backRoundNeckPlanForDepth(fullNecklineSts, Math.max(1, backNeckDepthRows))
      : null;
  const centerBackNeckBindOff = backRoundNeckPlan?.centerBindOff ?? 0;
  const backNecklineShapingLines =
    backRoundNeckPlan !== null
      ? roundNeckPlanOneSideBackNeckEdgeJpLines(backRoundNeckPlan, "right")
      : [];
  const armholeMarkerRc = armholeMarkerGarmentRc(d);
  // After the written-instruction neckline reset, shaping starts at local RC:000.
  // Show the reset marker and post-reset origin — not the pre-reset garment RC.
  const hasBackNecklineReset = isFiniteNumber(d.backNecklineStartRC);

  return {
    "jp-caston": formatCastOnNotation(castOnSts),
    "jp-body-rows": dropShoulderJpBodyRowsNotation(d, alineBodyPlan),
    "jp-body-shaping": bodyShapingJapaneseNotationFromAlinePlan(alineBodyPlan),
    "jp-armhole-bo": "",
    "jp-armhole-shaping": "",
    "jp-neckline-bo":
      backRoundNeckPlan !== null && isShallowHoldRoundPlan(backRoundNeckPlan)
        ? formatHoldNotation(centerBackNeckBindOff)
        : formatBindOffNotation(centerBackNeckBindOff),
    "jp-neckline-shaping": joinNotationLines(backNecklineShapingLines),
    "jp-shoulder-shaping": "",
    "rc-caston": formatRcNotation(0),
    "rc-hem": formatRcNotation(d.hemRows),
    "rc-armhole-bo": armholeMarkerRc !== undefined ? formatRcNotation(armholeMarkerRc) : "",
    // Symbol only — `rc-neckline-start` already carries rc000 (avoid "↺ rc000" + "rc000").
    rc_reset: hasBackNecklineReset ? formatRcResetSymbol() : "",
    "rc-neckline-start": hasBackNecklineReset ? formatRcNotation(0) : "",
  };
}

function isDropShoulderCardigan(patternData: unknown): boolean {
  return String(section(patternData?.style).frontStyle || "") === "open";
}

function isDropShoulderVNeck(patternData: unknown): boolean {
  return isSleevelessVNeckChoice(patternData);
}

function dropShoulderFrontCastOnSts(
  result: SleevelessBackPatternResult,
  patternData: unknown,
): number {
  const d = result.debug;
  if (isDropShoulderCardigan(patternData)) {
    if (isFiniteNumber(d.cardiganHalfLeftCastOnSts) && d.cardiganHalfLeftCastOnSts > 0) {
      return d.cardiganHalfLeftCastOnSts;
    }
    const bodyWidth = d.hemCastOnStitches ?? d.backStitches ?? 0;
    return bodyWidth > 0
      ? splitBodyBackCastOnToSymmetricCardiganHalves(bodyWidth).leftFrontWidthSts
      : 0;
  }
  return d.hemCastOnStitches ?? d.backStitches ?? 0;
}

/**
 * V-neck JP from an already-resolved decrease count (same value written instructions pass to
 * {@link evenShapingSchedule}). Do not pass a full neck opening here — callers must supply
 * pullover per-side or cardigan `neckPerFront` stitches.
 */
function dropShoulderVNeckDecreaseNotationLines(
  decreaseStitches: number,
  depthRows: number,
): string[] {
  if (decreaseStitches <= 0 || depthRows <= 0) return [];
  const sched = evenShapingSchedule(decreaseStitches, depthRows);
  if (sched.count <= 0) return [];
  return [formatShapingSegment(1, sched.interval, sched.count)];
}

export function buildDropShoulderFrontJapaneseNotationReplacements(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
  generatorPatternData?: unknown,
): Record<string, string> {
  const empty = emptyReplacements();
  if (!isDropShoulderBodyJapaneseNotationSupported(result)) return empty;

  const mergedPatternData = mergeDropShoulderNotationPatternData(generatorPatternData, patternData);
  const d = result.debug;
  const castOnSts = dropShoulderFrontCastOnSts(result, mergedPatternData);
  const alineBodyPlan = dropShoulderFrontAlineBodyShapingPlan(
    result,
    mergedPatternData,
    castOnSts,
  );
  const fullNecklineSts = resolveDropShoulderFullNecklineStitches(result, mergedPatternData);
  const isCardigan = isDropShoulderCardigan(mergedPatternData);
  const isVNeck = isDropShoulderVNeck(mergedPatternData);
  const armholeMarkerRc = armholeMarkerGarmentRc(d);
  // Garment frontNecklineStartRC is where the written instructions reset; after reset,
  // notation labels use local RC:000 (same origin as the front shaping map).
  const hasFrontNecklineReset = isFiniteNumber(d.frontNecklineStartRC);
  const frontNeckDepthRows = resolveDropShoulderFrontNeckDepthRows(result, mergedPatternData);

  let centerNeckBindOff = 0;
  let necklineShapingLines: string[] = [];
  let frontRoundPlan: ReturnType<typeof calculateRoundNecklinePlan> | null = null;

  if (isVNeck) {
    // Match buildCardiganFrontRows / buildPulloverFrontRows: cardigan uses neckPerFront
    // (half opening) as the decrease count; pullover halves the full opening once.
    const decreaseStitches = isCardigan
      ? cardiganFrontNeckOpeningStitches(fullNecklineSts)
      : neckDecreaseStitchesPerSideFromOpening(fullNecklineSts);
    necklineShapingLines = dropShoulderVNeckDecreaseNotationLines(
      decreaseStitches,
      frontNeckDepthRows,
    );
  } else if (fullNecklineSts > 0) {
    if (isCardigan) {
      const cardiganRound = dropShoulderCardiganRoundNeckEdgeNotationLines(
        fullNecklineSts,
        frontNeckDepthRows,
      );
      centerNeckBindOff = cardiganRound.centerBindOff;
      necklineShapingLines = cardiganRound.shapingLines;
    } else {
      frontRoundPlan = calculateRoundNecklinePlan({
        necklineStitches: fullNecklineSts,
        necklineDepthRows: frontNeckDepthRows,
      });
      centerNeckBindOff = frontRoundPlan.centerBindOff;
      necklineShapingLines = roundNeckPlanOneSideNeckEdgeJpLines(frontRoundPlan, "right");
    }
  }

  const frontCenterIsHold =
    !isVNeck && !isCardigan && frontRoundPlan !== null && isShallowHoldRoundPlan(frontRoundPlan);

  return {
    "jp-caston": formatCastOnNotation(castOnSts),
    "jp-body-rows": dropShoulderJpBodyRowsNotation(d, alineBodyPlan),
    "jp-body-shaping": bodyShapingJapaneseNotationFromAlinePlan(alineBodyPlan),
    "jp-armhole-bo": "",
    "jp-armhole-shaping": "",
    "jp-neckline-bo": isVNeck
      ? ""
      : frontCenterIsHold
        ? formatHoldNotation(centerNeckBindOff)
        : formatBindOffNotation(centerNeckBindOff),
    "jp-neckline-shaping": joinNotationLines(necklineShapingLines),
    "jp-shoulder-shaping": "",
    "rc-caston": formatRcNotation(0),
    "rc-hem": formatRcNotation(d.hemRows),
    "rc-armhole-bo": armholeMarkerRc !== undefined ? formatRcNotation(armholeMarkerRc) : "",
    // Symbol only — `rc-neckline-start` already carries rc000 (avoid "↺ rc000" + "rc000").
    rc_reset: hasFrontNecklineReset ? formatRcResetSymbol() : "",
    "rc-neckline-start": hasFrontNecklineReset ? formatRcNotation(0) : "",
  };
}
