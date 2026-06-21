/**
 * Custom Build — effective ribbed cuff depth for drop-shoulder sleeve generation.
 *
 * Fallback: audience default from {@link getDefaultCuffLengthInches} (2″ adult/kid, 1″ baby).
 * Override: `fit.cbMeasurementOverrides.cuffDepth` when `style.patternMode` is `custom-build`.
 * Express and non–custom-build modes always use the audience default.
 */

import {
  isCustomBuildPatternMode,
  positiveMeasurementInches,
} from "./customBuildEffectiveArmholeDepth";
import { getDefaultCuffLengthInches, type PatternAudience } from "./hemDefaults";

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function customBuildCuffDepthOverrideInches(patternData: Record<string, unknown>): number | undefined {
  const fit = section(patternData.fit);
  const overrides = section(fit.cbMeasurementOverrides);
  return positiveMeasurementInches(overrides.cuffDepth);
}

/** Resolves finished ribbed cuff depth (inches) for cuff row counts and diagram labels. */
export function resolveEffectiveCuffDepthInches(
  patternData: Record<string, unknown>,
  audience: PatternAudience,
): number {
  const defaultInches = getDefaultCuffLengthInches(audience);
  if (!isCustomBuildPatternMode(patternData)) {
    return defaultInches;
  }
  const overrideInches = customBuildCuffDepthOverrideInches(patternData);
  return overrideInches ?? defaultInches;
}
