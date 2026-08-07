/**
 * Pure merge helpers for sleeveless pattern display + {@link generateSleevelessBackPattern} input.
 * Mirrors the former inline logic on the builder pattern tab / print route (localStorage-free).
 */
import {
  augmentCbMeasurementOverridesForGenerator,
  loadMeasurementOverrides,
  mergeCbMeasurementOverridesFromFitSources,
} from "./sleevelessCustomMeasurementStorage";
import {
  logSleevelessGarmentKindResolution,
  resolveSleevelessGarmentKind,
  sleevelessGarmentKindToStyleFields,
  type ResolveSleevelessGarmentKindOptions,
  type SleevelessGarmentKind,
} from "./resolveSleevelessGarmentKind";
import { CUSTOM_BUILD_STYLE_STORAGE_KEYS } from "./sleevelessCustomBuildStyleKeys";
import {
  readCustomBuildWizardGarmentType,
  readCustomBuildWizardNeckline,
} from "./sleevelessCustomBuildWizardNeckline";
import { mapExpressStyleKey } from "./syncSleevelessExpressDesignToStorage";
import { SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";
import {
  reconcileStraightTorsoOverridesAfterChartSync,
  reconcileStraightTorsoOverridesPreservingUserHip,
} from "./sleevelessCustomBuildBodyMeasurements";
import { resolveEffectiveFinishedBustInches } from "./customBuildEffectiveFinishedBust";

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
  const cbOverrides = mergeCbMeasurementOverridesFromFitSources(base.fit, patternData.fit);
  if (Object.keys(cbOverrides).length > 0) {
    ft.cbMeasurementOverrides = cbOverrides;
  }
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
  let merged = { ...base, style: st, fit: ft, yarnGauge, machine };
  const patternMode = resolveGeneratorPatternMode(
    sectionPattern(base.style),
    sectionPattern(patternData.style),
    { canonicalFit: base.fit },
  );
  if (patternMode === "custom-build") {
    const garment = resolveSleevelessGarmentKindForSources({
      canonicalStyle: sectionPattern(base.style),
      patternBuilderStyle: sectionPattern(patternData.style),
      mergedStyle: st,
      expressValues: readExpressBuilderValues(),
      wizardGarmentType: readCustomBuildWizardGarmentType(),
    });
    const resolvedStyle = { ...st, ...sleevelessGarmentKindToStyleFields(garment) };
    merged = { ...merged, style: resolvedStyle };
    logSleevelessGarmentKindResolution(
      {
        wizardGarmentType: readCustomBuildWizardGarmentType(),
        canonicalStyle: sectionPattern(base.style),
        patternBuilderStyle: sectionPattern(patternData.style),
        mergedStyle: st,
        expressValues: readExpressBuilderValues(),
      },
      garment,
    );
  }
  return merged;
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

export function resolveSleevelessGarmentKindForSources(
  options: ResolveSleevelessGarmentKindOptions,
): SleevelessGarmentKind {
  return resolveSleevelessGarmentKind(options);
}

/**
 * Custom Build garment routing for generator/diagrams (delegates to {@link resolveSleevelessGarmentKind}).
 */
export function resolveCustomBuildGarmentStyleForStyle(
  canonicalStyle: Record<string, unknown>,
  patternBuilderStyle: Record<string, unknown>,
  wizardGarmentType?: string,
  expressValues?: Record<string, unknown>,
  mergedStyle?: Record<string, unknown>,
): CustomBuildGarmentStyleFields {
  return sleevelessGarmentKindToStyleFields(
    resolveSleevelessGarmentKind({
      wizardGarmentType,
      canonicalStyle,
      patternBuilderStyle,
      expressValues,
      mergedStyle,
    }),
  );
}

export function resolveGeneratorPatternMode(
  canonicalStyle: Record<string, unknown>,
  patternBuilderStyle: Record<string, unknown>,
  options?: { canonicalFit?: unknown },
): string | undefined {
  const modes = [canonicalStyle.patternMode, patternBuilderStyle.patternMode].map((m) =>
    String(m ?? "").trim(),
  );
  if (modes.some((m) => m === "custom-build")) return "custom-build";

  const canonMode = String(canonicalStyle.patternMode ?? "").trim();
  const canonicalOverrides = mergeCbMeasurementOverridesFromFitSources(options?.canonicalFit, {});
  const hasCanonicalMeasurementOverrides = Object.keys(canonicalOverrides).length > 0;

  if (modes.some((m) => m === "express")) {
    // Stale express-shaped patternBuilderData must not suppress canonical draft overrides.
    if (hasCanonicalMeasurementOverrides && canonMode !== "express") {
      return "custom-build";
    }
    return "express";
  }

  if (hasCanonicalMeasurementOverrides && canonMode !== "express") {
    return "custom-build";
  }

  return modes.find((m) => m) || undefined;
}

function readExpressBuilderValues(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return {};
    const v = (p as Record<string, unknown>).values;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return { ...(v as Record<string, string>) };
    }
  } catch {
    /* ignore */
  }
  return {};
}

function readCustomBuildStyleBodyShapeFromStorage(): string | undefined {
  if (typeof localStorage === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape)?.trim();
    if (raw === "aline" || raw === "straight") return raw;
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Generator only distinguishes straight vs A-line body math; unknown shapes fall back to straight. */
export function normalizeGeneratorBodyShape(raw: unknown): "straight" | "aline" {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return s === "aline" ? "aline" : "straight";
}

/**
 * Resolves `style.bodyShape` for generator input when canonical/PB style is stale.
 * Always returns `straight` or `aline` so builder/pattern init never sees undefined.
 */
export function resolveGeneratorBodyShape(
  canonicalStyle: Record<string, unknown>,
  patternBuilderStyle: Record<string, unknown>,
): "straight" | "aline" {
  const fromStyleStep = readCustomBuildStyleBodyShapeFromStorage();
  if (fromStyleStep) return normalizeGeneratorBodyShape(fromStyleStep);

  const expressStyleKey = readExpressBuilderValues().style?.trim();
  if (expressStyleKey) {
    try {
      return normalizeGeneratorBodyShape(mapExpressStyleKey(expressStyleKey).bodyShape);
    } catch {
      /* ignore — fall through */
    }
  }

  const fromStored =
    (typeof canonicalStyle.bodyShape === "string" && canonicalStyle.bodyShape.trim()) ||
    (typeof patternBuilderStyle.bodyShape === "string" && patternBuilderStyle.bodyShape.trim());
  if (fromStored) return normalizeGeneratorBodyShape(fromStored);

  return "straight";
}

/**
 * Merges review / measurement diagram overrides from storage and generator fit into
 * {@link generateSleevelessBackPattern} input (hip, bust, armhole, etc.).
 */
export function applyCustomBuildMeasurementOverridesToGenerator(
  gen: Record<string, unknown>,
  loadOverrides: () => Record<string, string> = loadMeasurementOverrides,
): Record<string, unknown> {
  let fromStorage: Record<string, string> = {};
  try {
    fromStorage = loadOverrides();
  } catch {
    /* localStorage unavailable or corrupt — continue without review overrides */
  }
  const fromFit = sectionPattern(sectionPattern(gen.fit).cbMeasurementOverrides);
  // Canonical draft overrides merged into `gen.fit` win over express / patternBuilder storage.
  let overrides = { ...fromStorage, ...fromFit };
  if (Object.keys(overrides).length === 0) return gen;

  const bodyShape = String(sectionPattern(gen.style).bodyShape ?? "").trim().toLowerCase();
  if (bodyShape === "straight") {
    const bust =
      resolveEffectiveFinishedBustInches(gen) ??
      sectionPattern(sectionPattern(gen.fit).selectedMeasurements).finished_bust_chest;
    const bustIn = typeof bust === "number" && bust > 0 ? bust : undefined;
    if (bustIn !== undefined) {
      const mode = String(sectionPattern(gen.style).patternMode ?? "").trim();
      // Custom Build honors an intentionally wide hip the knitter set on a straight torso. Express
      // has no such control, so a stale hip left over from another size (e.g. 43″ on a Men's Med
      // close bust 37″) must drop to bust — otherwise the straight torso widens into an A-line cast-on.
      overrides =
        mode === "custom-build"
          ? reconcileStraightTorsoOverridesPreservingUserHip(bustIn, overrides)
          : reconcileStraightTorsoOverridesAfterChartSync(bustIn, overrides);
    }
  }

  return {
    ...gen,
    fit: { ...sectionPattern(gen.fit), cbMeasurementOverrides: overrides },
  };
}

/** Shape expected by {@link generateSleevelessBackPattern}. */
export function buildGeneratorPatternDataFromSources(
  merged: Record<string, unknown>,
  patternBuilderData: Record<string, unknown>,
  /** `kbm_current_pattern` — use for garment resolve; do not use merged.style (PB spread wins there). */
  canonicalPattern?: Record<string, unknown>,
): Record<string, unknown> {
  const pb = patternBuilderData;
  const canonicalFit = canonicalPattern?.fit ?? merged.fit;
  const fitMerged = { ...sectionPattern(merged.fit), ...sectionPattern(pb.fit) };
  const smA = sectionPattern(fitMerged.selectedMeasurements);
  const smB = sectionPattern(sectionPattern(pb.fit).selectedMeasurements);
  const canonicalRecord =
    canonicalPattern && typeof canonicalPattern === "object" && !Array.isArray(canonicalPattern)
      ? canonicalPattern
      : merged;
  const cbOverrides = augmentCbMeasurementOverridesForGenerator(
    {
      ...mergeCbMeasurementOverridesFromFitSources(canonicalFit, {
        ...sectionPattern(merged.fit),
        ...sectionPattern(pb.fit),
      }),
      ...loadMeasurementOverrides(),
    },
    canonicalRecord,
  );
  const fit = {
    ...fitMerged,
    selectedMeasurements: { ...smB, ...smA },
    ...(Object.keys(cbOverrides).length > 0 ? { cbMeasurementOverrides: cbOverrides } : {}),
  };
  const mergedStyle = sectionPattern(merged.style);
  const storageCanonicalStyle = sectionPattern(
    canonicalPattern?.style !== undefined ? canonicalPattern.style : merged.style,
  );
  const pbStyle = sectionPattern(pb.style);
  const patternMode = resolveGeneratorPatternMode(storageCanonicalStyle, pbStyle, { canonicalFit });
  const bodyShape = resolveGeneratorBodyShape(storageCanonicalStyle, pbStyle);
  const wizardGarment = readCustomBuildWizardGarmentType();
  const expressValues = readExpressBuilderValues();
  const garmentKind =
    patternMode === "custom-build"
      ? resolveSleevelessGarmentKindForSources({
          wizardGarmentType: wizardGarment,
          canonicalStyle: storageCanonicalStyle,
          patternBuilderStyle: pbStyle,
          expressValues,
          mergedStyle,
        })
      : null;
  const style = {
    ...mergedStyle,
    ...pbStyle,
    bodyShape,
    ...(patternMode ? { patternMode } : {}),
    // Custom Build sync writes garment/neckline to canonical; stale express `patternBuilderData` must not win.
    ...(garmentKind
      ? {
          ...sleevelessGarmentKindToStyleFields(garmentKind),
          neckline: resolveCustomBuildNecklineForStyle(
            storageCanonicalStyle,
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
  const measurements = sectionPattern(merged.measurements);
  const rawUnitCandidate = ygm.gaugeRawUnit ?? ygMerged.gaugeRawUnit;
  const gaugeRawUnit = rawUnitCandidate === "cm" || rawUnitCandidate === "in" ? rawUnitCandidate : undefined;
  const gen = {
    fit,
    style,
    ...(Object.keys(measurements).length > 0 ? { measurements } : {}),
    ...(gaugeRawUnit
      ? {
          yarnGauge: {
            ...ygMerged,
            gaugeRawUnit,
          },
        }
      : Object.keys(ygMerged).length > 0
        ? { yarnGauge: ygMerged }
        : {}),
    yarnGaugeMachine: {
      gaugeStitchesPerInch: ygm.gaugeStitchesPerInch ?? ygMerged.stitchGauge,
      gaugeRowsPerInch: ygm.gaugeRowsPerInch ?? ygMerged.rowGauge,
      availableNeedles: ygm.availableNeedles ?? sectionPattern(merged.machine).availableNeedles,
      ...(gaugeRawUnit ? { gaugeRawUnit } : {}),
    },
  };
  const finalGen = applyCustomBuildMeasurementOverridesToGenerator(gen);
  if (patternMode === "custom-build" && garmentKind) {
    logSleevelessGarmentKindResolution(
      {
        wizardGarmentType: wizardGarment,
        canonicalStyle: storageCanonicalStyle,
        patternBuilderStyle: pbStyle,
        expressValues,
        mergedStyle,
      },
      garmentKind,
    );
  }
  return finalGen;
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
  const expressValues = readExpressBuilderValues();
  const garmentKind =
    patternMode === "custom-build"
      ? resolveSleevelessGarmentKindForSources({
          wizardGarmentType: readCustomBuildWizardGarmentType(),
          canonicalStyle,
          patternBuilderStyle: genStyle,
          expressValues,
          mergedStyle: { ...canonicalStyle, ...genStyle },
        })
      : null;
  const style = {
    ...canonicalStyle,
    ...genStyle,
    ...(garmentKind
      ? {
          ...sleevelessGarmentKindToStyleFields(garmentKind),
          neckline: resolveCustomBuildNecklineForStyle(
            canonicalStyle,
            genStyle,
            readCustomBuildWizardNeckline(),
          ),
        }
      : {}),
  };
  if (garmentKind) {
    logSleevelessGarmentKindResolution(
      {
        wizardGarmentType: readCustomBuildWizardGarmentType(),
        canonicalStyle,
        patternBuilderStyle: genStyle,
        expressValues,
        mergedStyle: { ...canonicalStyle, ...genStyle },
      },
      garmentKind,
    );
  }
  const fit = { ...sectionPattern(patternMerged.fit), ...sectionPattern(gen.fit) };
  return { style, fit };
}
