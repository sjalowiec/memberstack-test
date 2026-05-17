/**
 * Custom Build — effective finished length (back neck to hem) for sleeveless pattern generation.
 *
 * Chart-derived `fit.selectedMeasurements.back_neck_to_hem` is the fallback.
 * Override: `fit.cbMeasurementOverrides.finishedLength` when `style.patternMode` is `custom-build`.
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

function chartFinishedLengthInches(patternData: Record<string, unknown>): number | undefined {
  const fit = section(patternData.fit);
  const sm = section(fit.selectedMeasurements);
  return positiveMeasurementInches(sm.back_neck_to_hem);
}

function customBuildFinishedLengthOverrideInches(
  patternData: Record<string, unknown>,
): number | undefined {
  const fit = section(patternData.fit);
  const overrides = section(fit.cbMeasurementOverrides);
  return positiveMeasurementInches(overrides.finishedLength);
}

/**
 * Resolves finished garment length in inches used by {@link generateSleevelessBackPattern} row math and diagrams.
 */
export function resolveEffectiveFinishedLengthInches(
  patternData: Record<string, unknown>,
): number | undefined {
  const chartInches = chartFinishedLengthInches(patternData);
  if (!isCustomBuildPatternMode(patternData)) {
    return chartInches;
  }
  const overrideInches = customBuildFinishedLengthOverrideInches(patternData);
  return overrideInches ?? chartInches;
}
