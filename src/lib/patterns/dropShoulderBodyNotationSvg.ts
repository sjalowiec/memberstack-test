/**
 * Drop-shoulder body diagram SVG paths — sole source of truth for back/front diagrams.
 *
 * One fixed SVG per piece and display mode. No body-shape variants, alternate filenames,
 * legacy body-folder paths, or sleeveless fallbacks.
 */

import {
  buildSleevelessGarmentDiagramReplacements,
  shoulderStitchesPerSideForDiagram,
  type BuildSleevelessGarmentDiagramReplacementsOptions,
} from "./sleevelessGarmentDiagramReplacements";
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

/** Full cross-shoulder / body width in stitches (`{{cross-shoulder-width}}`). */
export function resolveDropShoulderCrossShoulderWidthForDiagram(
  result: SleevelessBackPatternResult,
): string {
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
  return {
    "shoulder-stitches": resolveDropShoulderShoulderStitchesForDiagram(result, options),
    "cross-shoulder-width": resolveDropShoulderCrossShoulderWidthForDiagram(result),
    "cross-shoulder": resolveDropShoulderCrossShoulderForDiagram(result, unit, options),
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

export const DROP_SHOULDER_BODY_BACK_NOTATION_SRC =
  "/images/patterns/drop-shoulder/jp-drop-body-back.svg";

export const DROP_SHOULDER_BODY_FRONT_NOTATION_SRC =
  "/images/patterns/drop-shoulder/jp-drop-body-front.svg";

export type DropShoulderBodyDiagramViewMode = "sts-rows" | "shaping-notation";

export function resolveDropShoulderBackDiagramSrc(mode: DropShoulderBodyDiagramViewMode): string {
  return mode === "shaping-notation"
    ? DROP_SHOULDER_BODY_BACK_NOTATION_SRC
    : DROP_SHOULDER_BODY_BACK_STS_ROWS_SRC;
}

export function resolveDropShoulderFrontDiagramSrc(mode: DropShoulderBodyDiagramViewMode): string {
  return mode === "shaping-notation"
    ? DROP_SHOULDER_BODY_FRONT_NOTATION_SRC
    : DROP_SHOULDER_BODY_FRONT_STS_ROWS_SRC;
}
