/**
 * Custom Build — effective armhole depth for sleeveless pattern generation.
 *
 * First active custom measurement override: armhole depth only (`fit.cbMeasurementOverrides.armholeDepth`).
 * Chart-derived `fit.selectedMeasurements.armhole_depth` is the fallback.
 * Express and non–custom-build modes always use the chart value.
 */

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

/** Positive inch measurement from chart fields or override strings. */
export function positiveMeasurementInches(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

export function isCustomBuildPatternMode(patternData: Record<string, unknown>): boolean {
  const style = section(patternData.style);
  return style.patternMode === "custom-build";
}

function chartArmholeDepthInches(patternData: Record<string, unknown>): number | undefined {
  const fit = section(patternData.fit);
  const sm = section(fit.selectedMeasurements);
  return positiveMeasurementInches(sm.armhole_depth);
}

function customBuildArmholeDepthOverrideInches(patternData: Record<string, unknown>): number | undefined {
  const fit = section(patternData.fit);
  const overrides = section(fit.cbMeasurementOverrides);
  return positiveMeasurementInches(overrides.armholeDepth);
}

/**
 * Resolves armhole depth (inches) used by {@link generateSleevelessBackPattern} and dependent row math.
 */
export function resolveEffectiveArmholeDepthInches(
  patternData: Record<string, unknown>,
): number | undefined {
  const chartInches = chartArmholeDepthInches(patternData);
  if (!isCustomBuildPatternMode(patternData)) {
    return chartInches;
  }
  const overrideInches = customBuildArmholeDepthOverrideInches(patternData);
  return overrideInches ?? chartInches;
}
