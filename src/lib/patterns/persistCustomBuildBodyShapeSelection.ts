/**
 * Custom Build body-shape write path (`/patterns/sleeveless/custom-style`).
 * Synchronous persistence to style-step localStorage, express builder, and pattern storage.
 */
import { CUSTOM_BUILD_STYLE_STORAGE_KEYS } from "./sleevelessCustomBuildStyleKeys";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import {
  mirrorCustomBuildBodyShapeToExpressBuilder,
  readExpressBuilderValues,
} from "./sleevelessGeneratorBodyShape";
import { resolveSleevelessGarmentStyleForHandoff } from "./sleevelessGarmentStyleHandoff";
import { syncCustomBuildToPatternStorage } from "./syncCustomBuildToPatternStorage";

export type CustomBuildBodyShapeChoice = "straight" | "aline";

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj as Record<string, unknown>;
  return {};
}

function readGarmentTypeFromStorage(): "pullover" | "cardigan" {
  if (typeof localStorage === "undefined") return "pullover";
  try {
    const raw = localStorage.getItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType)?.trim().toLowerCase();
    if (raw === "cardigan") return "cardigan";
  } catch {
    /* ignore */
  }
  return "pullover";
}

/** Temporary trace for A-line save path (remove when stable). */
export function logCustomBuildBodyShapeWrite(
  label: string,
  selectedOption: string,
): void {
  if (typeof console === "undefined" || typeof console.log !== "function") return;
  const ev = readExpressBuilderValues();
  const pbStyle = section(getPatternData().style);
  let localStorageBodyShape: string | null = null;
  try {
    localStorageBodyShape = localStorage.getItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape);
  } catch {
    /* ignore */
  }
  console.log(`[custom-build bodyShape] ${label}`, {
    selectedOption,
    savedBodyShape: localStorageBodyShape,
    savedPatternBuilderDataStyleBodyShape: pbStyle.bodyShape,
    savedExpressValuesShape: ev.shape,
    savedExpressValuesStyle: ev.style,
  });
}

/**
 * Writes A-line/straight to all stores the Pattern tab reads. Does not change resolver logic.
 */
export function persistCustomBuildBodyShapeSelection(
  bodyShape: CustomBuildBodyShapeChoice,
  options: {
    label?: string;
    garmentType?: "pullover" | "cardigan";
    /** When true (default), runs full custom-build sync after direct writes. */
    runFullSync?: boolean;
    /** When true, only updates bodyShape — does not overwrite garmentStyle (Review handoff). */
    preserveGarmentStyle?: boolean;
  } = {},
): void {
  const normalized: CustomBuildBodyShapeChoice = bodyShape === "aline" ? "aline" : "straight";
  const preserveGarment = options.preserveGarmentStyle === true;
  const canonStyle = section(getCurrentPattern().style);
  const pbStyle = section(getPatternData().style);
  const ev = readExpressBuilderValues();
  const garmentResolved = preserveGarment
    ? resolveSleevelessGarmentStyleForHandoff(canonStyle, pbStyle, ev, readGarmentTypeFromStorage())
    : null;
  const garmentType =
    options.garmentType ?? (garmentResolved?.garmentStyle ?? readGarmentTypeFromStorage());

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape, normalized);
    } catch {
      /* quota */
    }
  }

  mirrorCustomBuildBodyShapeToExpressBuilder(normalized, garmentType);

  const stylePatch: Record<string, unknown> = {
    ...pbStyle,
    bodyShape: normalized,
    patternMode: "custom-build",
    ...(preserveGarment
      ? {}
      : {
          garmentStyle: garmentType,
          frontStyle: garmentType === "cardigan" ? "open" : "closed",
        }),
  };
  savePatternData("style", stylePatch);

  saveCurrentPattern({
    style: {
      ...canonStyle,
      bodyShape: normalized,
      patternMode: "custom-build",
      ...(preserveGarment
        ? {}
        : {
            garmentStyle: garmentType,
            frontStyle: garmentType === "cardigan" ? "open" : "closed",
          }),
    },
  });

  if (options.runFullSync !== false) {
    syncCustomBuildToPatternStorage({
      awaitCharts: false,
      ...(preserveGarment ? { preserveGarmentStyle: true } : {}),
    });
  }

  logCustomBuildBodyShapeWrite(options.label ?? "persist", normalized);
}

/** True when custom build style step or express builder already has A-line selected. */
export function customBuildBodyShapeSelectionIsAline(): boolean {
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape)?.trim().toLowerCase();
      if (raw === "aline" || raw === "shaped") return true;
    } catch {
      /* ignore */
    }
  }
  const ev = readExpressBuilderValues();
  if (ev.shape?.trim().toLowerCase() === "aline") return true;
  const style = ev.style?.trim().toLowerCase() ?? "";
  return style === "shaped-pullover" || style === "shaped-cardigan";
}

/** Apply express `values` shape/style from saved custom-build body shape (do not clobber aline). */
export function applyCustomBuildBodyShapeToExpressValues(values: Record<string, string>): void {
  if (customBuildBodyShapeSelectionIsAline()) {
    values.shape = "aline";
    values.front = values.front === "open" ? "open" : "closed";
    values.style = values.front === "open" ? "shaped-cardigan" : "shaped-pullover";
    return;
  }
  if (!values.shape?.trim()) values.shape = "straight";
  if (!values.front?.trim()) values.front = "closed";
  if (!values.style?.trim()) {
    values.style = values.front === "open" ? "straight-cardigan" : "straight-pullover";
  }
}
