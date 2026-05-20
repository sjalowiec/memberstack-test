/**
 * Temporary console tracing for Custom Build cardigan → Pattern generator handoff.
 * Remove after root cause is verified in the browser.
 */
import { getCurrentPattern, getPatternData, SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";
import { CUSTOM_BUILD_STYLE_STORAGE_KEYS } from "./sleevelessCustomBuildStyleKeys";
import { readCustomBuildWizardGarmentType } from "./sleevelessCustomBuildWizardNeckline";
import { sectionPattern } from "./sleevelessPatternBuilderMerge";

export type CustomBuildGarmentHandoffSnapshot = {
  phase: string;
  localStorageGarmentType: string;
  localStorageBodyShape: string;
  expressValuesStyle: string;
  expressValuesFront: string;
  kbmCanonicalGarmentStyle: string;
  kbmCanonicalFrontStyle: string;
  kbmCanonicalPatternMode: string;
  /** Style passed into resolve (kbm_current_pattern when provided, else merged fallback). */
  resolveCanonicalGarmentStyle: string;
  resolveCanonicalFrontStyle: string;
  mergedGarmentStyle: string;
  mergedFrontStyle: string;
  patternBuilderGarmentStyle: string;
  patternBuilderFrontStyle: string;
  patternBuilderPatternMode: string;
  wizardGarmentType: string;
  resolvedGarmentStyle: string;
  resolvedFrontStyle: string;
  finalGeneratorGarmentStyle?: string;
  finalGeneratorFrontStyle?: string;
};

function lsGet(key: string): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(key)?.trim() ?? "";
  } catch {
    return "";
  }
}

function readExpressStyleFront(): { style: string; front: string } {
  if (typeof localStorage === "undefined") return { style: "", front: "" };
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return { style: "", front: "" };
    const p = JSON.parse(raw) as { values?: Record<string, string> };
    const v = p?.values ?? {};
    return {
      style: String(v.style ?? "").trim(),
      front: String(v.front ?? "").trim(),
    };
  } catch {
    return { style: "", front: "" };
  }
}

export function buildCustomBuildGarmentHandoffSnapshot(
  phase: string,
  opts: {
    merged?: Record<string, unknown>;
    patternBuilderData?: Record<string, unknown>;
    canonicalPattern?: Record<string, unknown>;
    finalGeneratorInput?: Record<string, unknown>;
    resolvedGarmentStyle?: string;
    resolvedFrontStyle?: string;
  } = {},
): CustomBuildGarmentHandoffSnapshot {
  const kbm = getCurrentPattern();
  const pb = opts.patternBuilderData ?? getPatternData();
  const kbmStyle = sectionPattern(kbm.style);
  const pbStyle = sectionPattern(pb.style);
  const mergedStyle = opts.merged ? sectionPattern(opts.merged.style) : {};
  const resolveCanonStyle = sectionPattern(
    opts.canonicalPattern?.style !== undefined ? opts.canonicalPattern.style : opts.merged?.style,
  );
  const genStyle = opts.finalGeneratorInput ? sectionPattern(opts.finalGeneratorInput.style) : {};
  const express = readExpressStyleFront();

  return {
    phase,
    localStorageGarmentType: lsGet(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType),
    localStorageBodyShape: lsGet(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape),
    expressValuesStyle: express.style,
    expressValuesFront: express.front,
    kbmCanonicalGarmentStyle: String(kbmStyle.garmentStyle ?? ""),
    kbmCanonicalFrontStyle: String(kbmStyle.frontStyle ?? ""),
    kbmCanonicalPatternMode: String(kbmStyle.patternMode ?? ""),
    resolveCanonicalGarmentStyle: String(resolveCanonStyle.garmentStyle ?? ""),
    resolveCanonicalFrontStyle: String(resolveCanonStyle.frontStyle ?? ""),
    mergedGarmentStyle: String(mergedStyle.garmentStyle ?? ""),
    mergedFrontStyle: String(mergedStyle.frontStyle ?? ""),
    patternBuilderGarmentStyle: String(pbStyle.garmentStyle ?? ""),
    patternBuilderFrontStyle: String(pbStyle.frontStyle ?? ""),
    patternBuilderPatternMode: String(pbStyle.patternMode ?? ""),
    wizardGarmentType: readCustomBuildWizardGarmentType(),
    resolvedGarmentStyle: opts.resolvedGarmentStyle ?? "",
    resolvedFrontStyle: opts.resolvedFrontStyle ?? "",
    ...(opts.finalGeneratorInput
      ? {
          finalGeneratorGarmentStyle: String(genStyle.garmentStyle ?? ""),
          finalGeneratorFrontStyle: String(genStyle.frontStyle ?? ""),
        }
      : {}),
  };
}

export function logCustomBuildGarmentHandoff(
  phase: string,
  opts: Parameters<typeof buildCustomBuildGarmentHandoffSnapshot>[1] = {},
): void {
  if (typeof console === "undefined" || typeof console.group !== "function") return;
  const snapshot = buildCustomBuildGarmentHandoffSnapshot(phase, opts);
  console.group(`[kbm CB garment handoff] ${phase}`);
  console.log(snapshot);
  console.groupEnd();
}

/** Temporary trace for Cardigan UI click → storage (remove after verification). */
export type CardiganSelectionWriteSnapshot = {
  phase: "before" | "after";
  selectedUiValue: string;
  localStorageGarmentType: string;
  kbmCanonicalGarmentStyle: string;
  kbmCanonicalFrontStyle: string;
  patternBuilderGarmentStyle: string;
  patternBuilderFrontStyle: string;
  expressValuesFront: string;
  expressValuesStyle: string;
};

export function buildCardiganSelectionWriteSnapshot(
  phase: "before" | "after",
  selectedUiValue: string,
): CardiganSelectionWriteSnapshot {
  const kbm = getCurrentPattern();
  const pb = getPatternData();
  const kbmStyle = sectionPattern(kbm.style);
  const pbStyle = sectionPattern(pb.style);
  const express = readExpressStyleFront();
  return {
    phase,
    selectedUiValue,
    localStorageGarmentType: lsGet(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType),
    kbmCanonicalGarmentStyle: String(kbmStyle.garmentStyle ?? ""),
    kbmCanonicalFrontStyle: String(kbmStyle.frontStyle ?? ""),
    patternBuilderGarmentStyle: String(pbStyle.garmentStyle ?? ""),
    patternBuilderFrontStyle: String(pbStyle.frontStyle ?? ""),
    expressValuesFront: express.front,
    expressValuesStyle: express.style,
  };
}

export function logCardiganSelectionWrite(
  label: string,
  before: CardiganSelectionWriteSnapshot,
  after: CardiganSelectionWriteSnapshot,
): void {
  if (typeof console === "undefined" || typeof console.group !== "function") return;
  console.group(`[kbm cardigan selection write] ${label}`);
  console.log("before", before);
  console.log("after", after);
  console.groupEnd();
}

/** Temporary trace on Summary / Measurements load before garment label (remove after verification). */
export function logSummaryGarmentRead(context: string): void {
  if (typeof console === "undefined" || typeof console.group !== "function") return;
  const snap = buildCardiganSelectionWriteSnapshot("before", readCustomBuildWizardGarmentType());
  console.group("[kbm summary garment read]");
  console.log({ context, ...snap });
  console.groupEnd();
}

/** Hard test: raw `localStorage.getItem("garmentType")` only (remove after verification). */
export function logGarmentTypeRaw(groupLabel: string): void {
  if (typeof console === "undefined" || typeof console.group !== "function") return;
  let raw: string | null = null;
  try {
    raw = typeof localStorage !== "undefined" ? localStorage.getItem("garmentType") : null;
  } catch {
    raw = null;
  }
  console.group(groupLabel);
  console.log('localStorage.getItem("garmentType")', raw);
  console.groupEnd();
}
