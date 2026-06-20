/**
 * Custom Build — effective shoulder width for sleeveless pattern generation.
 *
 * Chart-derived `fit.selectedMeasurements.shoulder_width` is the fallback.
 * Override: `fit.cbMeasurementOverrides.shoulderWidth` when `style.patternMode` is `custom-build`
 * (sleeveless only — drop-shoulder always uses the chart value).
 */

import {
  isCustomBuildPatternMode,
  positiveMeasurementInches,
} from "./customBuildEffectiveArmholeDepth";
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
  if (!isCustomBuildPatternMode(patternData)) {
    return chartInches;
  }
  if (
    isDropShoulderPatternRecord({ style: section(patternData.style) } as SleevelessPatternRecord)
  ) {
    return chartInches;
  }
  const overrideInches = customBuildShoulderWidthOverrideInches(patternData);
  return overrideInches ?? chartInches;
}
