/**
 * Custom Build — effective neck opening width for sleeveless / drop-shoulder pattern generation.
 *
 * Chart fallback (first positive match): `neck_width`, `neck_opening`, `neckOpening`,
 * then `neck_opening_width` in `fit.selectedMeasurements`.
 * Override: `fit.cbMeasurementOverrides.finishedNeckOpeningWidth` when `style.patternMode` is `custom-build`.
 * Express and non–custom-build modes always use the chart value.
 *
 * `neck_opening_width` is a legacy/alias key used by some saved Drop Shoulder drafts and
 * diagram helpers; it must resolve here so written neckline instructions and stitch math
 * stay aligned with Visual Guides / shaping notation.
 *
 * On project load, {@link normalizeSelectedMeasurementsNeckWidth} copies a legacy alias into
 * `neck_width` when missing so the canonical chart field is always present in the working draft.
 * Legacy keys are left in place for compatibility; new saves must not invent them.
 */

import {
  isCustomBuildPatternMode,
  positiveMeasurementInches,
} from "./customBuildEffectiveArmholeDepth";
import type { SleevelessPatternRecord } from "./patternStorage";

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

/**
 * Load-time normalization: ensure `neck_width` is populated from the first valid legacy alias
 * when the canonical key is missing. Does not delete aliases or touch CB overrides.
 */
export function normalizeSelectedMeasurementsNeckWidth(
  selectedMeasurements: Record<string, unknown>,
): Record<string, unknown> {
  if (positiveMeasurementInches(selectedMeasurements.neck_width) !== undefined) {
    return selectedMeasurements;
  }
  const fromAlias =
    positiveMeasurementInches(selectedMeasurements.neck_opening) ??
    positiveMeasurementInches(selectedMeasurements.neckOpening) ??
    positiveMeasurementInches(selectedMeasurements.neck_opening_width);
  if (fromAlias === undefined) {
    return selectedMeasurements;
  }
  return { ...selectedMeasurements, neck_width: fromAlias };
}

/** Apply {@link normalizeSelectedMeasurementsNeckWidth} to a saved pattern's fit section. */
export function normalizePatternRecordNeckWidth(
  pattern: SleevelessPatternRecord,
): SleevelessPatternRecord {
  const fit = section(pattern.fit);
  const sm = section(fit.selectedMeasurements);
  if (Object.keys(sm).length === 0) return pattern;
  const normalizedSm = normalizeSelectedMeasurementsNeckWidth(sm);
  if (normalizedSm === sm) return pattern;
  return {
    ...pattern,
    fit: {
      ...fit,
      selectedMeasurements: normalizedSm,
    },
  };
}

function chartNeckOpeningWidthInches(patternData: Record<string, unknown>): number | undefined {
  const fit = section(patternData.fit);
  const sm = section(fit.selectedMeasurements);
  return (
    positiveMeasurementInches(sm.neck_width) ??
    positiveMeasurementInches(sm.neck_opening) ??
    positiveMeasurementInches(sm.neckOpening) ??
    positiveMeasurementInches(sm.neck_opening_width)
  );
}

function customBuildNeckOpeningWidthOverrideInches(
  patternData: Record<string, unknown>,
): number | undefined {
  const fit = section(patternData.fit);
  const overrides = section(fit.cbMeasurementOverrides);
  return positiveMeasurementInches(overrides.finishedNeckOpeningWidth);
}

/**
 * Resolves neck opening width (inches) for neckline stitch counts, shaping, and diagram tokens.
 */
export function resolveEffectiveNeckOpeningWidthInches(
  patternData: Record<string, unknown>,
): number | undefined {
  const chartInches = chartNeckOpeningWidthInches(patternData);
  if (!isCustomBuildPatternMode(patternData)) {
    return chartInches;
  }
  const overrideInches = customBuildNeckOpeningWidthOverrideInches(patternData);
  return overrideInches ?? chartInches;
}
