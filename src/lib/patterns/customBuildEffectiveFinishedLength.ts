/**
 * Effective finished length (back neck to hem) for sweater pattern generation.
 *
 * A saved `fit.cbMeasurementOverrides.finishedLength` is the finished measurement
 * the editor shows. Express and Custom Build both use it. The chart value
 * `fit.selectedMeasurements.back_neck_to_hem` is the fallback when that field was not saved.
 */

import { positiveMeasurementInches } from "./customBuildEffectiveArmholeDepth";

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
  const overrideInches = customBuildFinishedLengthOverrideInches(patternData);
  return overrideInches ?? chartFinishedLengthInches(patternData);
}
