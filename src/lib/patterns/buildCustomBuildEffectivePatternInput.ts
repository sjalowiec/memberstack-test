/**
 * Normalized generator input for custom-build pattern math, garment diagrams, and written instructions.
 *
 * Single source of truth: canonical working draft (`kbm_current_pattern`) for measurement overrides,
 * merged with `patternBuilderData` for gauge and builder fields. Matches the measurements page
 * (`loadMeasurementOverrides`) while preventing stale express-shaped patternBuilderData from
 * suppressing edited overrides at generation time.
 */
import { isEditingSavedCustomPatternProject } from "./customPatternEditingUx";
import { getCurrentPattern, getPatternData } from "./patternStorage";
import {
  buildGeneratorPatternDataFromSources,
  mergedPatternForDisplayFromSources,
} from "./sleevelessPatternBuilderMerge";
import { mergeCbMeasurementOverridesFromFitSources } from "./sleevelessCustomMeasurementStorage";
import { CUSTOM_BUILD_STYLE_STORAGE_KEYS } from "./sleevelessCustomBuildStyleKeys";
import { readCustomBuildWizardGarmentType } from "./sleevelessCustomBuildWizardNeckline";

export type BuildCustomBuildEffectivePatternInputOptions = {
  /** Canonical working draft; defaults to {@link getCurrentPattern}. */
  canonicalPattern?: Record<string, unknown>;
  /** Builder mirror; defaults to {@link getPatternData}. */
  patternBuilderData?: Record<string, unknown>;
};

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function hasCbMeasurementOverrides(fit: unknown): boolean {
  return Object.keys(mergeCbMeasurementOverridesFromFitSources(fit, {})).length > 0;
}

function readCustomBuildStyleStepConfigured(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    for (const key of Object.values(CUSTOM_BUILD_STYLE_STORAGE_KEYS)) {
      if (localStorage.getItem(key)?.trim()) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** True when both storage records are express and no custom-build session signals are present. */
export function isIntentionalExpressOnlyGenerationSession(
  canonical: Record<string, unknown>,
  patternBuilderData: Record<string, unknown>,
): boolean {
  const canonMode = String(section(canonical.style).patternMode ?? "").trim();
  const pbMode = String(section(patternBuilderData.style).patternMode ?? "").trim();
  if (canonMode !== "express" || pbMode !== "express") return false;
  if (isEditingSavedCustomPatternProject()) return false;
  if (readCustomBuildWizardGarmentType()) return false;
  if (readCustomBuildStyleStepConfigured()) return false;
  return true;
}

/** Custom-build or saved custom-build generation — not a pure Express review session. */
export function isCustomBuildGenerationFlow(
  canonical: Record<string, unknown>,
  patternBuilderData: Record<string, unknown>,
): boolean {
  if (isEditingSavedCustomPatternProject()) return true;

  const canonMode = String(section(canonical.style).patternMode ?? "").trim();
  const pbMode = String(section(patternBuilderData.style).patternMode ?? "").trim();
  if (canonMode === "custom-build" || pbMode === "custom-build") return true;
  if (readCustomBuildWizardGarmentType() || readCustomBuildStyleStepConfigured()) return true;

  if (hasCbMeasurementOverrides(canonical.fit)) {
    return !isIntentionalExpressOnlyGenerationSession(canonical, patternBuilderData);
  }

  return false;
}

/** Ensures {@link resolveEffectiveHemDepthInches} and related helpers honor diagram overrides. */
export function forceCustomBuildPatternModeOnGeneratorInput(
  gen: Record<string, unknown>,
): Record<string, unknown> {
  const style = section(gen.style);
  if (style.patternMode === "custom-build") return gen;
  return {
    ...gen,
    style: { ...style, patternMode: "custom-build" },
  };
}

/**
 * Builds the object passed to {@link generateSleevelessBackPattern}, diagram token replacement,
 * and written-instruction helpers for custom-build sessions.
 */
export function buildCustomBuildEffectivePatternInput(
  options: BuildCustomBuildEffectivePatternInputOptions = {},
): Record<string, unknown> {
  const canonical = options.canonicalPattern ?? getCurrentPattern();
  const patternBuilderData = options.patternBuilderData ?? getPatternData();
  const merged = mergedPatternForDisplayFromSources(canonical, patternBuilderData);
  const gen = buildGeneratorPatternDataFromSources(merged, patternBuilderData, canonical);

  if (!hasCbMeasurementOverrides(section(gen.fit))) return gen;
  if (!isCustomBuildGenerationFlow(canonical, patternBuilderData)) return gen;

  return forceCustomBuildPatternModeOnGeneratorInput(gen);
}
