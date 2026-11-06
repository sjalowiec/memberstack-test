/**
 * Effective ribbed hem depth for sweater pattern generation.
 *
 * A saved `fit.cbMeasurementOverrides.hemDepth` is the finished hem the editor shows.
 * Express and Custom Build both use it. The audience default (2″ adult/kid, 1″ baby)
 * applies only when that field was not saved. Zero is not a hem depth.
 */

import { positiveMeasurementInches } from "./customBuildEffectiveArmholeDepth";
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
  const overrideInches = customBuildHemDepthOverrideInches(patternData);
  return overrideInches ?? getDefaultHemLengthInches(audience);
}
