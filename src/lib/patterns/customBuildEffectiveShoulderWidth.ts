/**
 * Effective shoulder width for sleeveless and set-in pattern generation.
 *
 * A saved `fit.cbMeasurementOverrides.shoulderWidth` is the finished shoulder the editor shows.
 * Express and Custom Build both use it. Chart `fit.selectedMeasurements.shoulder_width` is the fallback.
 * Drop Shoulder hides this field. Its cross-shoulder is the finished bust width, so a stored
 * shoulder override is ignored.
 */

import { positiveMeasurementInches } from "./customBuildEffectiveArmholeDepth";
import { isDropShoulderPatternRecord } from "./patternConstructionIdentity";
import type { SleevelessPatternRecord } from "./patternStorage";

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
  if (
    isDropShoulderPatternRecord({ style: section(patternData.style) } as SleevelessPatternRecord)
  ) {
    return chartInches;
  }
  const overrideInches = customBuildShoulderWidthOverrideInches(patternData);
  return overrideInches ?? chartInches;
}
