/**
 * Custom Build — effective finished hip circumference for sleeveless diagram tokens.
 *
 * Chart-derived `fit.selectedMeasurements.finished_hip` is the primary fallback.
 * Custom-build: `measurements.finishedHip`, then `fit.cbMeasurementOverrides.hip`.
 * When hip is unavailable, callers default to finished bust (see diagram replacements).
 */

import {
  isCustomBuildPatternMode,
  positiveMeasurementInches,
} from "./customBuildEffectiveArmholeDepth";
import { resolveEffectiveFinishedBustInches } from "./customBuildEffectiveFinishedBust";

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function chartFinishedHipInches(patternData: Record<string, unknown>): number | undefined {
  const fit = section(patternData.fit);
  const sm = section(fit.selectedMeasurements);
  return positiveMeasurementInches(sm.finished_hip);
}

function customBuildFinishedHipLayerInches(
  patternData: Record<string, unknown>,
): number | undefined {
  const measurements = section(patternData.measurements);
  return positiveMeasurementInches(measurements.finishedHip);
}

function customBuildFinishedHipOverrideInches(
  patternData: Record<string, unknown>,
): number | undefined {
  const fit = section(patternData.fit);
  const overrides = section(fit.cbMeasurementOverrides);
  return positiveMeasurementInches(overrides.hip);
}

/**
 * Resolves finished hip circumference (inches) for diagram `{{HIP_*}}` tokens.
 * Returns undefined when no hip value is stored — use bust as the diagram fallback.
 */
export function resolveEffectiveFinishedHipInches(
  patternData: Record<string, unknown>,
): number | undefined {
  const chartInches = chartFinishedHipInches(patternData);
  if (!isCustomBuildPatternMode(patternData)) {
    return chartInches;
  }
  const overrideInches = customBuildFinishedHipOverrideInches(patternData);
  const layerInches = customBuildFinishedHipLayerInches(patternData);
  return overrideInches ?? layerInches ?? chartInches;
}

/** Finished hip for diagrams, falling back to bust when hip is not set yet. */
export function resolveDiagramFinishedHipInches(
  patternData: Record<string, unknown>,
  finishedBustChest: number | undefined,
): number | undefined {
  return (
    resolveEffectiveFinishedHipInches(patternData) ??
    (finishedBustChest !== undefined && finishedBustChest > 0 ? finishedBustChest : undefined)
  );
}
