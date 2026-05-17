/**
 * Custom Build — effective finished bust/chest for sleeveless pattern generation.
 *
 * Chart-derived `fit.selectedMeasurements.finished_bust_chest` is the fallback.
 * Override: `fit.cbMeasurementOverrides.chestBust` when `style.patternMode` is `custom-build`.
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

function chartFinishedBustInches(patternData: Record<string, unknown>): number | undefined {
  const fit = section(patternData.fit);
  const sm = section(fit.selectedMeasurements);
  return positiveMeasurementInches(sm.finished_bust_chest);
}

function customBuildFinishedBustOverrideInches(
  patternData: Record<string, unknown>,
): number | undefined {
  const fit = section(patternData.fit);
  const overrides = section(fit.cbMeasurementOverrides);
  return positiveMeasurementInches(overrides.chestBust);
}

/**
 * Resolves finished bust/chest circumference (inches) for cast-on, width, and diagram tokens.
 */
export function resolveEffectiveFinishedBustInches(
  patternData: Record<string, unknown>,
): number | undefined {
  const chartInches = chartFinishedBustInches(patternData);
  if (!isCustomBuildPatternMode(patternData)) {
    return chartInches;
  }
  const overrideInches = customBuildFinishedBustOverrideInches(patternData);
  return overrideInches ?? chartInches;
}
