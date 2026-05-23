/**
 * Custom Build — effective ribbed hem depth for sleeveless pattern generation.
 *
 * Fallback: audience default from {@link getDefaultHemLengthInches} (2″ adult/kid, 1″ baby).
 * Override: `fit.cbMeasurementOverrides.hemDepth` when `style.patternMode` is `custom-build`.
 * Express and non–custom-build modes always use the audience default.
 */

import {
  isCustomBuildPatternMode,
  positiveMeasurementInches,
} from "./customBuildEffectiveArmholeDepth";
import { getDefaultHemLengthInches, type PatternAudience } from "./hemDefaults";

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function customBuildHemDepthOverrideInches(patternData: Record<string, unknown>): number | undefined {
  const fit = section(patternData.fit);
  const overrides = section(fit.cbMeasurementOverrides);
  return positiveMeasurementInches(overrides.hemDepth);
}

/**
 * Resolves finished ribbed hem depth (inches) for hem row counts and diagram labels.
 */
export function resolveEffectiveHemDepthInches(
  patternData: Record<string, unknown>,
  audience: PatternAudience,
): number {
  const defaultInches = getDefaultHemLengthInches(audience);
  if (!isCustomBuildPatternMode(patternData)) {
    return defaultInches;
  }
  const overrideInches = customBuildHemDepthOverrideInches(patternData);
  return overrideInches ?? defaultInches;
}
