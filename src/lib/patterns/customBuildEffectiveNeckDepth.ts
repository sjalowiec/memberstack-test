/**
 * Custom Build — effective neck depth for sweater pattern generation.
 *
 * Chart fallback: `fit.selectedMeasurements.front_neck_depth` (front scoop) and
 * `back_neck_depth` (back neckline row budget).
 * Override: `fit.cbMeasurementOverrides.neckDepth` replaces front neck depth only when
 * `style.patternMode` is `custom-build` (matches the Measurements step diagram field).
 * Express and non–custom-build modes always use chart values.
 *
 * Sweater-wide back neck rule: chart values below 1″ are kept; values above 1″ are
 * capped at 1″. Front neck depth is not capped here.
 */

import {
  isCustomBuildPatternMode,
  positiveMeasurementInches,
} from "./customBuildEffectiveArmholeDepth";

/** Maximum back neck depth (inches) for all sweater constructions. */
export const SWEATER_BACK_NECK_DEPTH_MAX_INCHES = 1;

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function chartFrontNeckDepthInches(patternData: Record<string, unknown>): number | undefined {
  const fit = section(patternData.fit);
  const sm = section(fit.selectedMeasurements);
  return positiveMeasurementInches(sm.front_neck_depth);
}

function chartBackNeckDepthInches(patternData: Record<string, unknown>): number | undefined {
  const fit = section(patternData.fit);
  const sm = section(fit.selectedMeasurements);
  return positiveMeasurementInches(sm.back_neck_depth);
}

function customBuildNeckDepthOverrideInches(patternData: Record<string, unknown>): number | undefined {
  const fit = section(patternData.fit);
  const overrides = section(fit.cbMeasurementOverrides);
  return positiveMeasurementInches(overrides.neckDepth);
}

/**
 * Resolves front neck depth (inches) for neckline row budget, start RC, and front shaping timelines.
 */
export function resolveEffectiveFrontNeckDepthInches(
  patternData: Record<string, unknown>,
): number | undefined {
  const chartInches = chartFrontNeckDepthInches(patternData);
  if (!isCustomBuildPatternMode(patternData)) {
    return chartInches;
  }
  const overrideInches = customBuildNeckDepthOverrideInches(patternData);
  return overrideInches ?? chartInches;
}

/**
 * Resolves back neck depth (inches) from chart measurements only (no Custom Build override field).
 * Caps at {@link SWEATER_BACK_NECK_DEPTH_MAX_INCHES}; values below the max are unchanged.
 * Missing/invalid chart values stay undefined.
 */
export function resolveEffectiveBackNeckDepthInches(
  patternData: Record<string, unknown>,
): number | undefined {
  const chartInches = chartBackNeckDepthInches(patternData);
  if (chartInches === undefined) return undefined;
  return Math.min(chartInches, SWEATER_BACK_NECK_DEPTH_MAX_INCHES);
}
