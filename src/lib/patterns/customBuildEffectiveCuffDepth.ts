/**
 * Effective ribbed cuff depth for sweater sleeve generation.
 *
 * Fallback: audience default from {@link getDefaultCuffLengthInches} (2″ adult/kid, 1″ baby).
 * Drop Shoulder, Set-In Sleeve, and the Sideways sweater read
 * `fit.cbMeasurementOverrides.cuffDepth`, including 0 for no ribbing, on Express
 * and Custom Build. A missing override keeps the audience default. Patterns
 * without sleeves keep the previous rule: Express uses the default, and Custom
 * Build reads a positive override only.
 */

import {
  isCustomBuildPatternMode,
  positiveMeasurementInches,
} from "./customBuildEffectiveArmholeDepth";
import { getDefaultCuffLengthInches, type PatternAudience } from "./hemDefaults";
import { patternHonorsSleeveCuffDepthOverride } from "./sleeveCuffRibbingDepth";

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function cuffDepthOverrideRaw(patternData: Record<string, unknown>): unknown {
  const fit = section(patternData.fit);
  return section(fit.cbMeasurementOverrides).cuffDepth;
}

/**
 * Finished cuff depth from a stored override. `0` is no ribbing.
 * Empty or negative values are omitted so the audience default can apply.
 */
export function parseCuffDepthOverrideInches(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const text = String(raw).trim();
  if (!text) return undefined;
  const n = typeof raw === "number" ? raw : Number(text.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

/** Resolves finished ribbed cuff depth (inches) for cuff row counts and diagram labels. */
export function resolveEffectiveCuffDepthInches(
  patternData: Record<string, unknown>,
  audience: PatternAudience,
): number {
  const defaultInches = getDefaultCuffLengthInches(audience);
  const stored = cuffDepthOverrideRaw(patternData);
  if (patternHonorsSleeveCuffDepthOverride(patternData)) {
    return parseCuffDepthOverrideInches(stored) ?? defaultInches;
  }
  if (!isCustomBuildPatternMode(patternData)) {
    return defaultInches;
  }
  return positiveMeasurementInches(stored) ?? defaultInches;
}
