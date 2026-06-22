/**
 * Drop-shoulder body diagram SVG paths — sole source of truth for back/front diagrams.
 *
 * Pullover vs cardigan front schematics and Japanese notation assets are selected from
 * `patternData` style (same cardigan detection as sleeveless). Back assets are shared.
 * No body-shape variants or sleeveless fallbacks.
 */

import {
  buildSleevelessGarmentDiagramReplacements,
  shoulderStitchesPerSideForDiagram,
  type BuildSleevelessGarmentDiagramReplacementsOptions,
} from "./sleevelessGarmentDiagramReplacements";
import { isSleevelessCardiganGarmentStyle } from "./sleevelessFrontDiagramSrc";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function resolveDropShoulderBodyWidthSts(d: SleevelessBackPatternResult["debug"]): number {
  if (isFiniteNumber(d.backStitches) && d.backStitches > 0) {
    return Math.round(d.backStitches);
  }
  if (isFiniteNumber(d.hemCastOnStitches) && d.hemCastOnStitches > 0) {
    return Math.round(d.hemCastOnStitches);
  }
  if (isFiniteNumber(d.stitchesAfterArmhole) && d.stitchesAfterArmhole > 0) {
    return Math.round(d.stitchesAfterArmhole);
  }
  return 0;
}

/**
 * Per-side final shoulder stitch count for drop-shoulder measurement-chart labels.
 *
 * (body width stitches − neck opening stitches) / 2 — same as
 * {@link generateDropShoulderPattern} `shoulderStsEach` / `debug.shoulderStitches`.
 */
export function resolveDropShoulderShoulderStitchesForDiagram(
  result: SleevelessBackPatternResult,
  _options: Pick<
    BuildSleevelessGarmentDiagramReplacementsOptions,
    "measurementPiece" | "cardiganHalfSide"
  > & { patternData: Record<string, unknown> },
): string {
  const d = result?.debug ?? {};
  const bodyWidthSts = resolveDropShoulderBodyWidthSts(d);
  const neckSts =
    isFiniteNumber(d.necklineStitches) && d.necklineStitches > 0
      ? Math.round(d.necklineStitches)
      : 0;

  if (bodyWidthSts > 0) {
    if (isFiniteNumber(d.shoulderStitches) && d.shoulderStitches > 0) {
      return String(Math.round(d.shoulderStitches));
    }
    if (neckSts > 0) {
      return String(Math.max(0, Math.round((bodyWidthSts - neckSts) / 2)));
    }
  }

  const perSide = shoulderStitchesPerSideForDiagram(d);
  return perSide !== undefined ? String(perSide) : "";
}

/** @deprecated Use {@link resolveDropShoulderShoulderStitchesForDiagram}. */
export const resolveDropShoulderShoulderStsForDiagram = resolveDropShoulderShoulderStitchesForDiagram;

/**
 * Cross-shoulder stitch count (`{{cross-shoulder-width}}`) — post-armhole body width for the
 * piece being diagrammed (full back width on back/pullover front; half-panel width on cardigan front).
 */
export function resolveDropShoulderCrossShoulderWidthForDiagram(
  result: SleevelessBackPatternResult,
  unit: "cm" | "in" = "in",
  options?: BuildSleevelessGarmentDiagramReplacementsOptions,
): string {
  if (options) {
    const base = buildSleevelessGarmentDiagramReplacements(result, unit, options);
    if (base.SHOULDER_STS) return base.SHOULDER_STS;
  }
  const bodyWidthSts = resolveDropShoulderBodyWidthSts(result?.debug ?? {});
  return bodyWidthSts > 0 ? String(bodyWidthSts) : "";
}

/** Cross-shoulder inch/cm label (`{{cross-shoulder}}`) — same as legacy `SHOULDER_WIDTH`. */
export function resolveDropShoulderCrossShoulderForDiagram(
  result: SleevelessBackPatternResult,
  unit: "cm" | "in",
  options: BuildSleevelessGarmentDiagramReplacementsOptions,
): string {
  const base = buildSleevelessGarmentDiagramReplacements(result, unit, options);
  return base.SHOULDER_WIDTH;
}

/** Drop-shoulder shoulder / cross-shoulder measurement tokens for body SVGs. */
export function resolveDropShoulderShoulderMeasurementReplacements(
  result: SleevelessBackPatternResult,
  unit: "cm" | "in",
  options: BuildSleevelessGarmentDiagramReplacementsOptions,
): Record<string, string> {
  const crossShoulder = buildSleevelessGarmentDiagramReplacements(result, unit, options);
  return {
    "shoulder-stitches": resolveDropShoulderShoulderStitchesForDiagram(result, options),
    "cross-shoulder-width": crossShoulder.SHOULDER_STS,
    "cross-shoulder": crossShoulder.SHOULDER_WIDTH,
  };
}

/** Stitches/rows schematic + measurement-chart tokens for drop-shoulder body SVGs. */
export function buildDropShoulderBodyDiagramReplacements(
  result: SleevelessBackPatternResult,
  unit: "cm" | "in",
  options: BuildSleevelessGarmentDiagramReplacementsOptions,
): Record<string, string> {
  return {
    ...buildSleevelessGarmentDiagramReplacements(result, unit, options),
    ...resolveDropShoulderShoulderMeasurementReplacements(result, unit, options),
  };
}

/** Merge shoulder / cross-shoulder measurement tokens into Japanese notation replacement maps. */
export function withDropShoulderShoulderMeasurementReplacements(
  replacements: Record<string, string>,
  result: SleevelessBackPatternResult,
  unit: "cm" | "in",
  options: Pick<
    BuildSleevelessGarmentDiagramReplacementsOptions,
    "measurementPiece" | "cardiganHalfSide"
  > & { patternData: Record<string, unknown> },
): Record<string, string> {
  return {
    ...replacements,
    ...resolveDropShoulderShoulderMeasurementReplacements(result, unit, {
      patternData: options.patternData,
      measurementPiece: options.measurementPiece,
      cardiganHalfSide: options.cardiganHalfSide,
    }),
  };
}

/** @deprecated Use {@link withDropShoulderShoulderMeasurementReplacements}. */
export function withDropShoulderShoulderStsReplacement(
  replacements: Record<string, string>,
  result: SleevelessBackPatternResult,
  options: Pick<
    BuildSleevelessGarmentDiagramReplacementsOptions,
    "measurementPiece" | "cardiganHalfSide"
  > & { patternData: Record<string, unknown> },
): Record<string, string> {
  return withDropShoulderShoulderMeasurementReplacements(
    replacements,
    result,
    "in",
    options,
  );
}

export const DROP_SHOULDER_BODY_BACK_STS_ROWS_SRC =
  "/images/patterns/drop-shoulder/drop-body-back.svg";

export const DROP_SHOULDER_BODY_FRONT_STS_ROWS_SRC =
  "/images/patterns/drop-shoulder/drop-body-front.svg";

export const DROP_SHOULDER_BODY_CARDIGAN_STS_ROWS_SRC =
  "/images/patterns/drop-shoulder/body/drop_body_cardigan.svg";

export const DROP_SHOULDER_BODY_BACK_NOTATION_SRC =
  "/images/patterns/drop-shoulder/jp-drop-body-back.svg";

export const DROP_SHOULDER_BODY_FRONT_NOTATION_SRC =
  "/images/patterns/drop-shoulder/jp-drop-body-front.svg";

export const DROP_SHOULDER_BODY_CARDIGAN_NOTATION_SRC =
  "/images/patterns/drop-shoulder/japanese/jp-drop-body-cardigan.svg";

export type DropShoulderBodyDiagramViewMode = "sts-rows" | "shaping-notation";

export function isDropShoulderCardiganGarmentStyle(patternData: unknown): boolean {
  return isSleevelessCardiganGarmentStyle(patternData);
}

export function resolveDropShoulderBackDiagramSrc(
  mode: DropShoulderBodyDiagramViewMode,
  _patternData?: unknown,
): string {
  return mode === "shaping-notation"
    ? DROP_SHOULDER_BODY_BACK_NOTATION_SRC
    : DROP_SHOULDER_BODY_BACK_STS_ROWS_SRC;
}

export function resolveDropShoulderFrontDiagramSrc(
  mode: DropShoulderBodyDiagramViewMode,
  patternData?: unknown,
): string {
  const isCardigan = isDropShoulderCardiganGarmentStyle(patternData);
  if (mode === "shaping-notation") {
    return isCardigan
      ? DROP_SHOULDER_BODY_CARDIGAN_NOTATION_SRC
      : DROP_SHOULDER_BODY_FRONT_NOTATION_SRC;
  }
  return isCardigan
    ? DROP_SHOULDER_BODY_CARDIGAN_STS_ROWS_SRC
    : DROP_SHOULDER_BODY_FRONT_STS_ROWS_SRC;
}
