/**
 * Pure merge helpers for sleeveless pattern display + {@link generateSleevelessBackPattern} input.
 * Mirrors the former inline logic on the builder pattern tab / print route (localStorage-free).
 */
import { loadMeasurementOverrides } from "./sleevelessCustomMeasurementStorage";
import {
  readCustomBuildWizardGarmentType,
  readCustomBuildWizardNeckline,
} from "./sleevelessCustomBuildWizardNeckline";

export function sectionPattern(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

export function mergedPatternForDisplayFromSources(
  base: Record<string, unknown>,
  patternBuilderData: Record<string, unknown>,
): Record<string, unknown> {
  const patternData = patternBuilderData;
  const st = { ...sectionPattern(base.style), ...sectionPattern(patternData.style) };
  const ft = { ...sectionPattern(base.fit), ...sectionPattern(patternData.fit) };
  let yarnGauge = { ...sectionPattern(base.yarnGauge) };
  let machine = { ...sectionPattern(base.machine) };
  const ygm = patternData.yarnGaugeMachine;
  if (ygm && typeof ygm === "object" && !Array.isArray(ygm)) {
    const y = ygm as Record<string, unknown>;
    if ("yarnNotes" in y) {
      yarnGauge = {
        ...yarnGauge,
        yarnName: typeof y.yarnNotes === "string" ? y.yarnNotes : String(y.yarnNotes ?? ""),
      };
    }
    if ("yarnWeight" in y) {
      yarnGauge = {
        ...yarnGauge,
        yarnWeight: typeof y.yarnWeight === "string" ? y.yarnWeight : String(y.yarnWeight ?? ""),
      };
    }
    if ("gaugeStitchesPerInch" in y) {
      const v = y.gaugeStitchesPerInch;
      yarnGauge = { ...yarnGauge, stitchGauge: v !== undefined && v !== null ? String(v) : "" };
    }
    if ("gaugeRowsPerInch" in y) {
      const v = y.gaugeRowsPerInch;
      yarnGauge = { ...yarnGauge, rowGauge: v !== undefined && v !== null ? String(v) : "" };
    }
    if ("gaugeStitchRaw" in y) {
      const v = y.gaugeStitchRaw;
      yarnGauge = { ...yarnGauge, gaugeStitchRaw: v !== undefined && v !== null ? String(v) : "" };
    }
    if ("gaugeRowRaw" in y) {
      const v = y.gaugeRowRaw;
      yarnGauge = { ...yarnGauge, gaugeRowRaw: v !== undefined && v !== null ? String(v) : "" };
    }
    if ("gaugeRawUnit" in y) {
      const u = y.gaugeRawUnit;
      yarnGauge = {
        ...yarnGauge,
        gaugeRawUnit: u === "cm" || u === "in" ? u : "",
      };
    }
    yarnGauge.gaugeUnits = "per_inch";
    if ("availableNeedles" in y) {
      const v = y.availableNeedles;
      machine = { ...machine, availableNeedles: v !== undefined && v !== null ? String(v) : "" };
    }
  }
  return { ...base, style: st, fit: ft, yarnGauge, machine };
}

/**
 * Canonical `kbm_current_pattern` can be `custom-build` while `patternBuilderData` still has a stale
 * `express` mode from an earlier session. Generator + diagram routing must prefer `custom-build`.
 */
/** True when a stored neckline token is V-neck (canonical `v` or builder `v-neck`). */
export function storageNecklineIndicatesVNeck(raw: unknown): boolean {
  const n = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!n) return false;
  if (n === "round" || n === "crew" || n === "scoop" || n === "boat" || n === "square") return false;
  if (n === "v" || n === "v-neck" || n === "vneck" || n === "v_neck" || n === "v neck") return true;
  if (/\bv[\s_-]?neck\b/.test(n)) return true;
  return false;
}

/**
 * Custom Build neckline for generator/diagrams: prefer V when either canonical or PB indicates V-neck.
 * Canonical-only `??` merge left stale `round` on `kbm_current_pattern` winning over PB `v` / `v-neck`.
 */
export function resolveCustomBuildNecklineForStyle(
  canonicalStyle: Record<string, unknown>,
  patternBuilderStyle: Record<string, unknown>,
  wizardNeckline?: string,
): string | undefined {
  if (storageNecklineIndicatesVNeck(wizardNeckline)) return "v";
  const c = String(canonicalStyle.neckline ?? "").trim();
  const p = String(patternBuilderStyle.neckline ?? "").trim();
  if (storageNecklineIndicatesVNeck(c) || storageNecklineIndicatesVNeck(p)) return "v";
  if (c || p) {
    const pick = c || p;
    const lower = pick.toLowerCase();
    if (lower === "round" || lower === "crew") return "round";
    return pick;
  }
  return undefined;
}

export type CustomBuildGarmentStyleFields = {
  garmentStyle: "pullover" | "cardigan";
  frontStyle: "open" | "closed";
};

function styleRecordIndicatesCardigan(style: Record<string, unknown>): boolean {
  const gs = String(style.garmentStyle ?? "")
    .trim()
    .toLowerCase();
  const fs = String(style.frontStyle ?? "")
    .trim()
    .toLowerCase();
  return gs === "cardigan" || fs === "open";
}

/**
 * Custom Build garment routing for generator/diagrams. Wizard `garmentType` wins; stale canonical
 * `cardigan` / `open` must not override patternBuilderData pullover (routes to cardigan SVG family).
 */
export function resolveCustomBuildGarmentStyleForStyle(
  canonicalStyle: Record<string, unknown>,
  patternBuilderStyle: Record<string, unknown>,
  wizardGarmentType?: string,
): CustomBuildGarmentStyleFields {
  const wizard = String(wizardGarmentType ?? "")
    .trim()
    .toLowerCase();
  if (wizard === "cardigan") return { garmentStyle: "cardigan", frontStyle: "open" };
  if (wizard === "pullover") return { garmentStyle: "pullover", frontStyle: "closed" };

  const canonicalCardigan = styleRecordIndicatesCardigan(canonicalStyle);
  const pbCardigan = styleRecordIndicatesCardigan(patternBuilderStyle);
  if (canonicalCardigan && !pbCardigan) {
    return { garmentStyle: "pullover", frontStyle: "closed" };
  }
  if (pbCardigan) return { garmentStyle: "cardigan", frontStyle: "open" };
  if (canonicalCardigan) return { garmentStyle: "cardigan", frontStyle: "open" };

  const gs = String(patternBuilderStyle.garmentStyle ?? canonicalStyle.garmentStyle ?? "")
    .trim()
    .toLowerCase();
  if (gs === "cardigan") return { garmentStyle: "cardigan", frontStyle: "open" };
  return { garmentStyle: "pullover", frontStyle: "closed" };
}

export function resolveGeneratorPatternMode(
  canonicalStyle: Record<string, unknown>,
  patternBuilderStyle: Record<string, unknown>,
): string | undefined {
  const modes = [canonicalStyle.patternMode, patternBuilderStyle.patternMode].map((m) =>
    String(m ?? "").trim(),
  );
  if (modes.some((m) => m === "custom-build")) return "custom-build";
  if (modes.some((m) => m === "express")) return "express";
  return modes.find((m) => m) || undefined;
}

/**
 * Merges Custom Build measurement overrides from Express builder storage into generator input and
 * ensures `style.patternMode` is `custom-build` so {@link resolveEffectiveArmholeDepthInches} applies.
 */
export function applyCustomBuildMeasurementOverridesToGenerator(
  gen: Record<string, unknown>,
  loadOverrides: () => Record<string, string> = loadMeasurementOverrides,
): Record<string, unknown> {
  const style = sectionPattern(gen.style);
  if (style.patternMode === "express") return gen;

  const fromStorage = loadOverrides();
  const fromFit = sectionPattern(sectionPattern(gen.fit).cbMeasurementOverrides);
  const overrides = { ...fromFit, ...fromStorage };
  if (Object.keys(overrides).length === 0) return gen;

  return {
    ...gen,
    style: { ...style, patternMode: "custom-build" },
    fit: { ...sectionPattern(gen.fit), cbMeasurementOverrides: overrides },
  };
}

/** Shape expected by {@link generateSleevelessBackPattern}. */
export function buildGeneratorPatternDataFromSources(
  merged: Record<string, unknown>,
  patternBuilderData: Record<string, unknown>,
): Record<string, unknown> {
  const pb = patternBuilderData;
  const fitMerged = { ...sectionPattern(merged.fit), ...sectionPattern(pb.fit) };
  const smA = sectionPattern(fitMerged.selectedMeasurements);
  const smB = sectionPattern(sectionPattern(pb.fit).selectedMeasurements);
  const cbOverrides = sectionPattern(sectionPattern(pb.fit).cbMeasurementOverrides);
  const fit = {
    ...fitMerged,
    selectedMeasurements: { ...smB, ...smA },
    ...(Object.keys(cbOverrides).length > 0 ? { cbMeasurementOverrides: cbOverrides } : {}),
  };
  const canonicalStyle = sectionPattern(merged.style);
  const pbStyle = sectionPattern(pb.style);
  const patternMode = resolveGeneratorPatternMode(canonicalStyle, pbStyle);
  const style = {
    ...canonicalStyle,
    ...pbStyle,
    ...(patternMode ? { patternMode } : {}),
    // Custom Build sync writes garment/neckline to canonical; stale express `patternBuilderData` must not win.
    ...(patternMode === "custom-build"
      ? {
          ...resolveCustomBuildGarmentStyleForStyle(
            canonicalStyle,
            pbStyle,
            readCustomBuildWizardGarmentType(),
          ),
          neckline: resolveCustomBuildNecklineForStyle(
            canonicalStyle,
            pbStyle,
            readCustomBuildWizardNeckline(),
          ),
        }
      : {}),
  };
  const ygm =
    pb.yarnGaugeMachine && typeof pb.yarnGaugeMachine === "object"
      ? sectionPattern(pb.yarnGaugeMachine)
      : {};
  const ygMerged = sectionPattern(merged.yarnGauge);
  const gen = {
    fit,
    style,
    yarnGaugeMachine: {
      gaugeStitchesPerInch: ygm.gaugeStitchesPerInch ?? ygMerged.stitchGauge,
      gaugeRowsPerInch: ygm.gaugeRowsPerInch ?? ygMerged.rowGauge,
      availableNeedles: ygm.availableNeedles ?? sectionPattern(merged.machine).availableNeedles,
    },
  };
  return applyCustomBuildMeasurementOverridesToGenerator(gen);
}

/**
 * Pattern payload for garment diagram variant selection + measurement tokens.
 * Uses the same style/fit shape as {@link buildGeneratorPatternDataFromSources} so front schematic
 * routing matches {@link generateSleevelessBackPattern} (avoids stale root-level `neckline` on canonical records).
 */
export function buildSleevelessGarmentDiagramPatternData(
  patternMerged: Record<string, unknown>,
  generatorPatternData?: Record<string, unknown>,
): Record<string, unknown> {
  const gen =
    generatorPatternData && typeof generatorPatternData === "object" && !Array.isArray(generatorPatternData)
      ? generatorPatternData
      : {};
  const canonicalStyle = sectionPattern(patternMerged.style);
  const genStyle = sectionPattern(gen.style);
  const patternMode = resolveGeneratorPatternMode(canonicalStyle, genStyle);
  const style = {
    ...canonicalStyle,
    ...genStyle,
    ...(patternMode === "custom-build"
      ? {
          ...resolveCustomBuildGarmentStyleForStyle(
            canonicalStyle,
            genStyle,
            readCustomBuildWizardGarmentType(),
          ),
          neckline: resolveCustomBuildNecklineForStyle(
            canonicalStyle,
            genStyle,
            readCustomBuildWizardNeckline(),
          ),
        }
      : {}),
  };
  const fit = { ...sectionPattern(patternMerged.fit), ...sectionPattern(gen.fit) };
  return { style, fit };
}
