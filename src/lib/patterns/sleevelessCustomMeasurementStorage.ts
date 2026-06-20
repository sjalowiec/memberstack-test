/**
 * Custom Build — Step 3 measurement overrides.
 * Stored inside {@link SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY} as `cbMeasurementOverrides`
 * (values in inches as decimal strings). Falls back to legacy standalone key when present.
 *
 * Armhole depth, finished length, finished bust, shoulder width, and neck opening width overrides
 * apply in pattern generation when `style.patternMode` is `custom-build` (see
 * {@link resolveEffectiveArmholeDepthInches}, {@link resolveEffectiveFinishedLengthInches},
 * {@link resolveEffectiveFinishedBustInches}, {@link resolveEffectiveShoulderWidthInches},
 * {@link resolveEffectiveNeckOpeningWidthInches}, {@link resolveEffectiveFrontNeckDepthInches},
 * {@link resolveEffectiveHemDepthInches}); other fields are stored for future use.
 */
import { isCustomBuildPatternMode, positiveMeasurementInches } from "./customBuildEffectiveArmholeDepth";
import { formatSwatchCountForGaugeInput } from "./gaugeDisplayFormat";
import { getExpressUiUnit } from "./sleevelessExpressSizeChartClient";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { overrideRecordsEqual } from "./patternSectionPatch";

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj as Record<string, unknown>;
  return {};
}

export const LEGACY_STANDALONE_MEASUREMENTS_KEY = "kbm_sleeveless_custom_measurements";

/** Diagram fields on Custom Build / unified review (`data-cb-measure-input`). */
export const CUSTOM_BUILD_DIAGRAM_OVERRIDE_KEYS = [
  "finishedNeckOpeningWidth",
  "neckDepth",
  "shoulderWidth",
  "armholeDepth",
  "chestBust",
  "hip",
  "finishedLength",
  "hemDepth",
  /** Drop Shoulder review diagram — ignored when inputs are absent (sleeveless pages). */
  "upperArm",
  "sleeveLength",
  "wrist",
] as const;

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

function parsePositiveInches(raw: string): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  const n = parseFloat(s.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return roundQuarter(n);
}

function formatOverrideInches(n: number): string {
  return formatSwatchCountForGaugeInput(roundQuarter(n));
}

/**
 * Ensures diagram hip reaches {@link generateSleevelessBackPattern} when stored on the working draft
 * or custom-build measurements layer but missing from merged fit sections.
 */
export function augmentCbMeasurementOverridesForGenerator(
  overrides: Record<string, string>,
  canonicalPattern?: Record<string, unknown>,
): Record<string, string> {
  if (overrides.hip?.trim()) return overrides;
  const pattern =
    canonicalPattern && typeof canonicalPattern === "object" && !Array.isArray(canonicalPattern)
      ? canonicalPattern
      : getCurrentPattern();
  if (!isCustomBuildPatternMode(pattern)) return overrides;
  const finishedHip = positiveMeasurementInches(section(pattern.measurements).finishedHip);
  if (finishedHip === undefined) return overrides;
  return { ...overrides, hip: formatOverrideInches(finishedHip) };
}

export type MeasurementOverrideKey =
  | "chestBust"
  | "hip"
  | "crossBack"
  | "finishedLength"
  | "hemDepth"
  | "hemToArmhole"
  | "widthAtHem"
  | "finishedNeckOpeningWidth"
  | "neckDepth"
  | "neckbandWidth"
  | "sweaterNeckOpeningWidth"
  | "armholeDepth"
  | "shoulderWidth";

interface ExpressPersistedShape {
  values?: Record<string, string>;
  cbMeasurementOverrides?: Record<string, string>;
}

function parseExpressBlob(raw: string | null): ExpressPersistedShape | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    return p as ExpressPersistedShape;
  } catch {
    return null;
  }
}

function readLegacyStandalone(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(LEGACY_STANDALONE_MEASUREMENTS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

function readOverrideMapFromFitSection(fit: unknown): Record<string, string> {
  const nested = section(fit).cbMeasurementOverrides;
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) return {};
  return Object.fromEntries(
    Object.entries(nested).filter(
      ([, v]) => typeof v === "string" && String(v).trim() !== "",
    ) as [string, string][],
  );
}

/** Canonical draft overrides (`kbm_current_pattern` + `patternBuilderData`). */
export function readCanonicalMeasurementOverrides(): Record<string, string> {
  const pattern = getCurrentPattern();
  const patternData = getPatternData();
  // `kbm_current_pattern` is the working draft; stale `patternBuilderData` must not win.
  return {
    ...readOverrideMapFromFitSection(patternData.fit),
    ...readOverrideMapFromFitSection(pattern.fit),
  };
}

/** Merge cbMeasurementOverrides with canonical draft (`base`) winning over patternBuilderData. */
export function mergeCbMeasurementOverridesFromFitSources(
  baseFit: unknown,
  patternBuilderFit: unknown,
): Record<string, string> {
  return {
    ...readOverrideMapFromFitSection(patternBuilderFit),
    ...readOverrideMapFromFitSection(baseFit),
  };
}

function isDiagramMeasureInput(el: unknown): el is HTMLInputElement {
  if (!el || typeof el !== "object" || !("value" in el)) return false;
  if (typeof HTMLInputElement !== "undefined") return el instanceof HTMLInputElement;
  return typeof (el as HTMLInputElement).value === "string";
}

function isDomElement(el: unknown): el is HTMLElement {
  if (!el || typeof el !== "object") return false;
  if (typeof HTMLElement !== "undefined") return el instanceof HTMLElement;
  return typeof (el as HTMLElement).querySelector === "function";
}

/** Read visible diagram inputs when present (unified review / measurements step). */
export function collectCustomBuildMeasurementOverridesFromDom(
  root: ParentNode,
  displayUnit: "in" | "cm" | null = null,
): Record<string, string> {
  const out: Record<string, string> = {};
  const unit = displayUnit ?? "in";
  for (const key of CUSTOM_BUILD_DIAGRAM_OVERRIDE_KEYS) {
    const input = root.querySelector(`[data-cb-measure-input="${key}"]`);
    if (!isDiagramMeasureInput(input)) continue;
    const raw = input.value.trim();
    if (!raw) continue;
    let inches: number | undefined;
    if (unit === "cm") {
      const n = parseFloat(raw.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(n) && n > 0) inches = roundQuarter(n / 2.54);
    } else {
      inches = parsePositiveInches(raw);
    }
    if (inches !== undefined) out[key] = formatOverrideInches(inches);
  }
  return out;
}

/**
 * Prefer the visible Customize / measurements diagram host so flush reads the edited inputs,
 * not an unrelated node elsewhere in the document.
 */
export function resolveCustomBuildMeasureFlushRoot(
  root?: ParentNode | null,
): ParentNode | undefined {
  if (typeof document === "undefined" && !root) return undefined;
  const scope = root ?? (typeof document !== "undefined" ? document : undefined);
  if (!scope?.querySelector) return scope ?? undefined;
  const measureRoot = scope.querySelector("[data-cb-measure-root]");
  if (measureRoot) return measureRoot;
  return scope;
}

/**
 * Scope for cloud save / update — always prefer the page's measurement diagram when present,
 * even when the caller passes a narrow panel root (e.g. `[data-cb-saved-projects]`).
 */
export function resolveCustomBuildSaveMeasureFlushRoot(
  scope?: ParentNode | null,
): ParentNode | undefined {
  if (typeof document !== "undefined") {
    const onPage = document.querySelector("[data-cb-measure-root]");
    if (onPage) return onPage;
    return resolveCustomBuildMeasureFlushRoot(document);
  }
  return resolveCustomBuildMeasureFlushRoot(scope ?? undefined);
}

function resolveDiagramDisplayUnit(root: ParentNode): "in" | "cm" | null {
  const measureRoot = root.querySelector("[data-cb-measure-root]");
  if (!isDomElement(measureRoot)) return null;
  const unitsHost = measureRoot.querySelector("[data-express-measurements-units-host]");
  if (
    isDomElement(unitsHost) &&
    typeof unitsHost.hasAttribute === "function" &&
    !unitsHost.hasAttribute("hidden")
  ) {
    return getExpressUiUnit();
  }
  return null;
}

/**
 * Merge diagram / express / canonical override maps into the working draft and express builder.
 * Call before cloud save so pending input values are not lost when blur did not fire.
 */
export function flushCustomBuildMeasurementOverridesToCanonical(
  options: { root?: ParentNode; displayUnit?: "in" | "cm" | null } = {},
): void {
  const root = resolveCustomBuildMeasureFlushRoot(
    options.root ?? (typeof document !== "undefined" ? document : undefined),
  );
  let overrides = loadMeasurementOverrides();
  if (root) {
    const displayUnit =
      options.displayUnit !== undefined ? options.displayUnit : resolveDiagramDisplayUnit(root);
    const fromDom = collectCustomBuildMeasurementOverridesFromDom(root, displayUnit);
    if (Object.keys(fromDom).length > 0) {
      overrides = { ...overrides, ...fromDom };
    }
  }
  if (Object.keys(overrides).length === 0) return;
  persistMeasurementOverrides(overrides);
}

/** Returns override map (values stored as inches, string decimals). */
export function loadMeasurementOverrides(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  const legacy = readLegacyStandalone();
  const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
  const blob = parseExpressBlob(raw);
  const nested = blob?.cbMeasurementOverrides;
  const fromExpress =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? Object.fromEntries(
          Object.entries(nested).filter(
            ([, v]) => typeof v === "string" && String(v).trim() !== "",
          ) as [string, string][],
        )
      : {};

  if (Object.keys(legacy).length > 0 && Object.keys(fromExpress).length === 0) {
    return { ...legacy, ...readOverrideMapFromFitSection(getPatternData().fit), ...readOverrideMapFromFitSection(getCurrentPattern().fit) };
  }
  // Express builder first; canonical working draft (`kbm_current_pattern`) wins last.
  return {
    ...legacy,
    ...fromExpress,
    ...readOverrideMapFromFitSection(getPatternData().fit),
    ...readOverrideMapFromFitSection(getCurrentPattern().fit),
  };
}

export function persistMeasurementOverrides(overrides: Record<string, string>): void {
  if (typeof localStorage === "undefined") return;

  const canonicalOverrides = readCanonicalMeasurementOverrides();
  const expressRaw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
  let expressOverrides: Record<string, string> = {};
  if (expressRaw) {
    try {
      const p = JSON.parse(expressRaw) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) {
        const nested = section((p as Record<string, unknown>).cbMeasurementOverrides);
        expressOverrides = Object.fromEntries(
          Object.entries(nested).filter(
            ([, v]) => typeof v === "string" && String(v).trim() !== "",
          ) as [string, string][],
        );
      }
    } catch {
      expressOverrides = {};
    }
  }

  const canonStyle = section(getCurrentPattern().style);
  const pbStyle = section(getPatternData().style);
  const canonMode = String(canonStyle.patternMode ?? "").trim();
  const patternModeAlreadyCustomBuild =
    canonMode === "custom-build" && String(pbStyle.patternMode ?? "").trim() === "custom-build";
  if (
    overrideRecordsEqual(overrides, canonicalOverrides) &&
    overrideRecordsEqual(overrides, expressOverrides) &&
    (canonMode === "express" || patternModeAlreadyCustomBuild)
  ) {
    return;
  }

  const prevRaw = expressRaw;
  let prev: Record<string, unknown> = {};
  if (prevRaw) {
    try {
      const p = JSON.parse(prevRaw) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) prev = p as Record<string, unknown>;
    } catch {
      prev = {};
    }
  }
  try {
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({
        ...prev,
        cbMeasurementOverrides: { ...overrides },
      }),
    );
  } catch {
    /* quota */
  }
  try {
    const pbFit = section(getPatternData().fit);
    const fitPatch = { ...pbFit, cbMeasurementOverrides: { ...overrides } };
    if (!overrideRecordsEqual(readOverrideMapFromFitSection(pbFit), overrides)) {
      savePatternData("fit", fitPatch);
    }
    const stylePatch =
      canonMode === "express"
        ? {}
        : canonMode === "custom-build"
          ? {}
          : { patternMode: "custom-build" as const };
    if (Object.keys(stylePatch).length > 0) {
      savePatternData("style", { ...pbStyle, ...stylePatch });
    }
    const canonFit = section(getCurrentPattern().fit);
    const canonFitPatch = { ...canonFit, cbMeasurementOverrides: { ...overrides } };
    const canonSave: { fit: Record<string, unknown>; style?: Record<string, unknown> } = {
      fit: canonFitPatch,
    };
    if (Object.keys(stylePatch).length > 0) {
      canonSave.style = stylePatch;
    }
    if (
      !overrideRecordsEqual(readOverrideMapFromFitSection(canonFit), overrides) ||
      Object.keys(stylePatch).length > 0
    ) {
      saveCurrentPattern(canonSave);
    }
    const hipIn = positiveMeasurementInches(overrides.hip);
    if (hipIn !== undefined && (canonMode === "custom-build" || patternModeAlreadyCustomBuild)) {
      const measurements = section(getCurrentPattern().measurements);
      const existing = positiveMeasurementInches(measurements.finishedHip);
      if (existing !== hipIn) {
        saveCurrentPattern({ measurements: { ...measurements, finishedHip: hipIn } });
      }
    }
  } catch {
    /* quota */
  }
  try {
    localStorage.removeItem(LEGACY_STANDALONE_MEASUREMENTS_KEY);
  } catch {
    /* ignore */
  }
}

export function clearMeasurementOverrides(): void {
  persistMeasurementOverrides({});
}

/** Drop override maps from the working draft fit section (Express builder key cleared separately). */
export function clearMeasurementOverridesOnWorkingDraft(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const pbFit = section(getPatternData().fit);
    if (pbFit.cbMeasurementOverrides) {
      const nextFit = { ...pbFit };
      delete nextFit.cbMeasurementOverrides;
      savePatternData("fit", nextFit);
    }
    const canon = getCurrentPattern();
    const canonFit = section(canon.fit);
    if (canonFit.cbMeasurementOverrides) {
      const nextCanonFit = { ...canonFit };
      delete nextCanonFit.cbMeasurementOverrides;
      saveCurrentPattern({ fit: nextCanonFit });
    }
  } catch {
    /* quota */
  }
}
