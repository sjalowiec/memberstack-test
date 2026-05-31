/**
 * Resolves generator `style.bodyShape` without depending on measurement merge modules
 * (avoids circular imports with {@link sleevelessCustomMeasurementStorage}).
 */
import { CUSTOM_BUILD_STYLE_STORAGE_KEYS } from "./sleevelessCustomBuildStyleKeys";
import { SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";
import { mapExpressStyleKey } from "./syncSleevelessExpressDesignToStorage";

export function readExpressBuilderValues(): Record<string, string> {
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

/** Canonical Express style key from shape + front (matches `sleeveless-express-page.ts`). */
export function deriveExpressStyleKeyFromShapeFront(shape?: string, front?: string): string {
  const s = String(shape ?? "")
    .trim()
    .toLowerCase();
  const f = String(front ?? "")
    .trim()
    .toLowerCase();
  if (!s || !f) return "";
  if (s === "straight" && f === "closed") return "straight-pullover";
  if (s === "aline" && f === "closed") return "shaped-pullover";
  if (s === "straight" && f === "open") return "straight-cardigan";
  if (s === "aline" && f === "open") return "shaped-cardigan";
  if (s === "waist" && f === "closed") return "waist-pullover";
  if (s === "waist" && f === "open") return "waist-cardigan";
  return "";
}

/** Express `values.style`, or derived from `values.shape` + `values.front`. */
export function resolveExpressGarmentStyleKey(values: Record<string, string>): string {
  const style = values.style?.trim();
  if (style) return style;
  return deriveExpressStyleKeyFromShapeFront(values.shape, values.front);
}

/** Writes Custom Build style-step shape into Express builder `values` for generator resolution. */
export function mirrorCustomBuildBodyShapeToExpressBuilder(
  bodyShape: "straight" | "aline",
  garmentType: "pullover" | "cardigan" = "pullover",
): void {
  if (typeof localStorage === "undefined") return;
  const shape = bodyShape;
  const front = garmentType === "cardigan" ? "open" : "closed";
  const styleKey = deriveExpressStyleKeyFromShapeFront(shape, front);
  if (!styleKey) return;
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    let prev: Record<string, unknown> = {};
    if (raw) {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) prev = p as Record<string, unknown>;
    }
    const oldVals =
      prev.values && typeof prev.values === "object" && !Array.isArray(prev.values)
        ? { ...(prev.values as Record<string, string>) }
        : {};
    const values = { ...oldVals, shape, front, style: styleKey };
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({ ...prev, values }),
    );
  } catch {
    /* quota */
  }
}

export function readCustomBuildStyleBodyShapeFromStorage(): string | undefined {
  if (typeof localStorage === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape)?.trim().toLowerCase();
    if (raw === "aline" || raw === "shaped") return "aline";
    if (raw === "straight") return "straight";
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Generator only distinguishes straight vs A-line body math; unknown shapes fall back to straight. */
export function normalizeGeneratorBodyShape(raw: unknown): "straight" | "aline" {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "aline" || s === "shaped") return "aline";
  return "straight";
}

export type GeneratorBodyShapeResolutionSnapshot = {
  expressValuesStyle?: string;
  expressValuesShape?: string;
  expressValuesFront?: string;
  expressStyleKeyResolved: string;
  canonicalBodyShape?: string;
  patternBuilderBodyShape?: string;
  styleStepBodyShape?: string;
  finalBodyShape: "straight" | "aline";
};

export function snapshotGeneratorBodyShapeResolution(
  canonicalStyle: Record<string, unknown>,
  patternBuilderStyle: Record<string, unknown>,
): GeneratorBodyShapeResolutionSnapshot {
  const ev = readExpressBuilderValues();
  return {
    expressValuesStyle: ev.style?.trim() || undefined,
    expressValuesShape: ev.shape?.trim() || undefined,
    expressValuesFront: ev.front?.trim() || undefined,
    expressStyleKeyResolved: resolveExpressGarmentStyleKey(ev),
    canonicalBodyShape:
      typeof canonicalStyle.bodyShape === "string" ? canonicalStyle.bodyShape.trim() : undefined,
    patternBuilderBodyShape:
      typeof patternBuilderStyle.bodyShape === "string" ? patternBuilderStyle.bodyShape.trim() : undefined,
    styleStepBodyShape: readCustomBuildStyleBodyShapeFromStorage(),
    finalBodyShape: resolveGeneratorBodyShape(canonicalStyle, patternBuilderStyle),
  };
}

/** Temporary trace for Pattern tab / generator bodyShape precedence (remove when stable). */
export function logGeneratorBodyShapeResolution(
  label: string,
  canonicalStyle: Record<string, unknown>,
  patternBuilderStyle: Record<string, unknown>,
): GeneratorBodyShapeResolutionSnapshot {
  const snapshot = snapshotGeneratorBodyShapeResolution(canonicalStyle, patternBuilderStyle);
  if (typeof console !== "undefined" && typeof console.log === "function") {
    console.log(`[sleeveless bodyShape] ${label}`, snapshot);
  }
  return snapshot;
}

/**
 * Resolves `style.bodyShape` for generator input when canonical/PB style is stale.
 * Express garment style (`shaped-pullover`, or `values.shape` = aline) and custom-build style-step
 * aline win over stale canonical/patternBuilder `"straight"` (including after review sync).
 */
export function resolveGeneratorBodyShape(
  canonicalStyle: Record<string, unknown>,
  patternBuilderStyle: Record<string, unknown>,
): "straight" | "aline" {
  const ev = readExpressBuilderValues();

  const expressStyleKey = resolveExpressGarmentStyleKey(ev);
  if (expressStyleKey) {
    try {
      const fromKey = normalizeGeneratorBodyShape(mapExpressStyleKey(expressStyleKey).bodyShape);
      if (fromKey === "aline") return "aline";
    } catch {
      /* ignore — fall through */
    }
  }

  const shapeField = ev.shape?.trim();
  if (shapeField) {
    const fromShape = normalizeGeneratorBodyShape(shapeField);
    if (fromShape === "aline") return "aline";
  }

  const fromStyleStep = readCustomBuildStyleBodyShapeFromStorage();
  if (fromStyleStep === "aline") return "aline";

  const fromCanonical =
    typeof canonicalStyle.bodyShape === "string" ? canonicalStyle.bodyShape.trim() : "";
  const fromPb =
    typeof patternBuilderStyle.bodyShape === "string" ? patternBuilderStyle.bodyShape.trim() : "";
  if (fromCanonical || fromPb) {
    const stored = normalizeGeneratorBodyShape(fromCanonical || fromPb);
    if (stored === "aline") return "aline";
  }

  if (expressStyleKey) {
    try {
      return normalizeGeneratorBodyShape(mapExpressStyleKey(expressStyleKey).bodyShape);
    } catch {
      /* ignore */
    }
  }

  if (fromStyleStep) return normalizeGeneratorBodyShape(fromStyleStep);

  if (fromCanonical || fromPb) {
    return normalizeGeneratorBodyShape(fromCanonical || fromPb);
  }

  return "straight";
}
