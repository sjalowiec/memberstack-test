/**
 * Effective finished hip circumference for sleeveless cast-on and diagram tokens.
 *
 * Chart-derived `fit.selectedMeasurements.finished_hip` is the fallback.
 * `fit.cbMeasurementOverrides.hip` (review / measurements diagram) applies in Express and Custom Build.
 * Custom-build also reads `measurements.finishedHip`. When hip is unavailable, callers default to bust.
 */

import {
  isCustomBuildPatternMode,
  positiveMeasurementInches,
} from "./customBuildEffectiveArmholeDepth";
import { resolveEffectiveFinishedBustInches } from "./customBuildEffectiveFinishedBust";
import { measurementsImplySleevelessAlineBody } from "./sleevelessAlineShaping";

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
function storedBodyShapeKey(patternData: Record<string, unknown>): string {
  const style = section(patternData.style);
  const raw = typeof style.bodyShape === "string" ? style.bodyShape : "";
  return raw.trim().toLowerCase();
}

export function resolveEffectiveFinishedHipInches(
  patternData: Record<string, unknown>,
): number | undefined {
  const overrideInches = customBuildFinishedHipOverrideInches(patternData);
  const bust = resolveEffectiveFinishedBustInches(patternData);
  const ignoreStaleWideHipOverride =
    overrideInches !== undefined &&
    storedBodyShapeKey(patternData) === "straight" &&
    !isCustomBuildPatternMode(patternData) &&
    bust !== undefined &&
    measurementsImplySleevelessAlineBody(bust, overrideInches);
  if (overrideInches !== undefined && !ignoreStaleWideHipOverride) {
    return overrideInches;
  }
  const chartInches = chartFinishedHipInches(patternData);
  if (!isCustomBuildPatternMode(patternData)) {
    return chartInches;
  }
  const layerInches = customBuildFinishedHipLayerInches(patternData);
  return layerInches ?? chartInches;
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
