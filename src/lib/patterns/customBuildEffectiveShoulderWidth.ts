/**
 * Custom Build — effective shoulder width for sleeveless pattern generation.
 *
 * Chart-derived `fit.selectedMeasurements.shoulder_width` is the fallback.
 * Override: `fit.cbMeasurementOverrides.shoulderWidth` when `style.patternMode` is `custom-build`.
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

function chartShoulderWidthInches(patternData: Record<string, unknown>): number | undefined {
  const fit = section(patternData.fit);
  const sm = section(fit.selectedMeasurements);
  return positiveMeasurementInches(sm.shoulder_width);
}

function customBuildShoulderWidthOverrideInches(
  patternData: Record<string, unknown>,
): number | undefined {
  const fit = section(patternData.fit);
  const overrides = section(fit.cbMeasurementOverrides);
  return positiveMeasurementInches(overrides.shoulderWidth);
}

/**
 * Resolves shoulder width (inches) for stitches-after-armhole, shaping, and diagram tokens.
 */
export function resolveEffectiveShoulderWidthInches(
  patternData: Record<string, unknown>,
): number | undefined {
  const chartInches = chartShoulderWidthInches(patternData);
  if (!isCustomBuildPatternMode(patternData)) {
    return chartInches;
  }
  const overrideInches = customBuildShoulderWidthOverrideInches(patternData);
  return overrideInches ?? chartInches;
}
