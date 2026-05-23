/**
 * Custom Build — effective neck opening width for sleeveless pattern generation.
 *
 * Chart fallback: `neck_width`, then `neck_opening`, then `neckOpening` in
 * `fit.selectedMeasurements` (same precedence as {@link generateSleevelessBackPattern}).
 * Override: `fit.cbMeasurementOverrides.finishedNeckOpeningWidth` when `style.patternMode` is `custom-build`.
 * Express and non–custom-build modes always use the chart value.
 */

import {
  isCustomBuildPatternMode,
  positiveMeasurementInches,
} from "./customBuildEffectiveArmholeDepth";

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function chartNeckOpeningWidthInches(patternData: Record<string, unknown>): number | undefined {
  const fit = section(patternData.fit);
  const sm = section(fit.selectedMeasurements);
  return (
    positiveMeasurementInches(sm.neck_width) ??
    positiveMeasurementInches(sm.neck_opening) ??
    positiveMeasurementInches(sm.neckOpening)
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
