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
import { positiveMeasurementInches } from "./customBuildEffectiveArmholeDepth";
import { calculateRoundNecklinePlan, isShallowHoldRoundPlan } from "./legoBlocks/roundNeckline";
import { neckDecreaseStitchesPerSideFromOpening } from "./legoBlocks/vNeckline";
import {
  cardiganFrontNeckOpeningStitches,
} from "./roundNeckNotation";
import {
  backRoundNeckPlanForDepth,
  roundNeckPlanOneSideBackNeckEdgeJpLines,
  roundNeckPlanOneSideNeckEdgeJpLines,
} from "./roundNeckPlanPresentation";
import {
  formatBindOffNotation,
  formatHoldNotation,
  formatBodyRowsNotation,
  formatCastOnNotation,
  formatRcNotation,
  formatRcResetNotation,
  formatShapingSegment,
  JP_BACK_NOTATION_SVG_TOKEN_KEYS,
  type JpBackNotationSvgTokenKey,
} from "./sleevelessBackJapaneseNotation";
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
  const resolved = resolveEffectiveNeckOpeningWidthInches(patternData);
  if (resolved !== undefined) return resolved;
  const sm = section(section(patternData.fit).selectedMeasurements);
  return positiveMeasurementInches(sm.neck_opening_width);
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
  const d = result.debug;
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

/** Cardigan half-front round neck — matches `buildCardiganFrontRows` CF bind-off + singles. */
function dropShoulderCardiganRoundNeckEdgeNotationLines(neckPerFront: number): {
  centerBindOff: number;
  shapingLines: string[];
} {
  const n = Math.max(0, Math.round(neckPerFront));
  if (n <= 0) return { centerBindOff: 0, shapingLines: [] };
  const cfBindOff = Math.min(n, Math.max(2, Math.round(n / 3)));
  const remaining = Math.max(0, n - cfBindOff);
  const shapingLines =
    remaining > 0 ? [formatShapingSegment(1, 2, remaining)] : [];
  return { centerBindOff: cfBindOff, shapingLines };
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
  const bodyRows = dropShoulderStraightBodyRows(d);
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
  const finalGarmentRc = isFiniteNumber(d.finalRC)
    ? Math.max(0, Math.floor(d.finalRC))
    : isFiniteNumber(d.backNecklineStartRC)
      ? Math.max(0, Math.floor(d.backNecklineStartRC))
      : isFiniteNumber(d.totalCalculatedRows)
        ? Math.max(0, Math.floor(d.totalCalculatedRows))
        : undefined;
  const necklineRc =
    isFiniteNumber(d.backNecklineStartRC)
      ? Math.max(armholeMarkerRc ?? 0, Math.floor(d.backNecklineStartRC))
      : backNeckDepthRows > 0 && finalGarmentRc !== undefined
        ? Math.max(armholeMarkerRc ?? 0, finalGarmentRc - backNeckDepthRows)
        : finalGarmentRc;

  return {
    "jp-caston": formatCastOnNotation(castOnSts),
    "jp-body-rows": formatBodyRowsNotation(bodyRows),
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
    rc_reset: formatRcResetNotation(0),
    "rc-neckline-start": necklineRc !== undefined ? formatRcNotation(necklineRc) : "",
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
    const bodyWidth = d.backStitches ?? d.hemCastOnStitches ?? 0;
    return bodyWidth > 0 ? Math.max(1, Math.round(bodyWidth / 2)) : 0;
  }
  return d.hemCastOnStitches ?? d.backStitches ?? 0;
}

function dropShoulderVNeckEdgeNotationLines(
  fullNecklineSts: number,
  depthRows: number,
): string[] {
  const perSide = neckDecreaseStitchesPerSideFromOpening(fullNecklineSts);
  if (perSide <= 0 || depthRows <= 0) return [];
  const sched = evenShapingSchedule(perSide, depthRows);
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
  const bodyRows = dropShoulderStraightBodyRows(d);
  const fullNecklineSts = resolveDropShoulderFullNecklineStitches(result, mergedPatternData);
  const isCardigan = isDropShoulderCardigan(mergedPatternData);
  const isVNeck = isDropShoulderVNeck(mergedPatternData);
  const armholeMarkerRc = armholeMarkerGarmentRc(d);
  const necklineRc = isFiniteNumber(d.frontNecklineStartRC)
    ? Math.max(0, Math.floor(d.frontNecklineStartRC))
    : undefined;
  const frontNeckDepthRows = resolveDropShoulderFrontNeckDepthRows(result, mergedPatternData);

  let centerNeckBindOff = 0;
  let necklineShapingLines: string[] = [];
  let frontRoundPlan: ReturnType<typeof calculateRoundNecklinePlan> | null = null;

  if (isVNeck) {
    const neckOpening = isCardigan
      ? cardiganFrontNeckOpeningStitches(fullNecklineSts)
      : fullNecklineSts;
    necklineShapingLines = dropShoulderVNeckEdgeNotationLines(neckOpening, frontNeckDepthRows);
  } else if (fullNecklineSts > 0) {
    if (isCardigan) {
      const neckPerFront = cardiganFrontNeckOpeningStitches(fullNecklineSts);
      const cardiganRound = dropShoulderCardiganRoundNeckEdgeNotationLines(neckPerFront);
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
    "jp-body-rows": formatBodyRowsNotation(bodyRows),
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
    rc_reset: formatRcResetNotation(0),
    "rc-neckline-start": necklineRc !== undefined ? formatRcNotation(necklineRc) : "",
  };
}
