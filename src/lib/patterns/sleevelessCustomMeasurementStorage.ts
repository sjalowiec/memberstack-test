/**
 * Custom Build — Step 3 measurement overrides.
 * Stored inside {@link SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY} as `cbMeasurementOverrides`
 * (values in inches as decimal strings). Falls back to legacy standalone key when present.
 *
 * Armhole depth override is applied in pattern generation when `style.patternMode` is `custom-build`
 * (see {@link resolveEffectiveArmholeDepthInches}); other fields are stored for future use.
 */
import { SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";

export const LEGACY_STANDALONE_MEASUREMENTS_KEY = "kbm_sleeveless_custom_measurements";

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

/** Returns override map (values stored as inches, string decimals). */
export function loadMeasurementOverrides(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  const legacy = readLegacyStandalone();
  const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
  const blob = parseExpressBlob(raw);
  const nested = blob?.cbMeasurementOverrides;
  const fromNested =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? Object.fromEntries(
          Object.entries(nested).filter(
            ([, v]) => typeof v === "string" && String(v).trim() !== "",
          ) as [string, string][],
        )
      : {};

  if (Object.keys(legacy).length > 0 && Object.keys(fromNested).length === 0) {
    return { ...legacy };
  }
  return { ...legacy, ...fromNested };
}

export function persistMeasurementOverrides(overrides: Record<string, string>): void {
  if (typeof localStorage === "undefined") return;
  const prevRaw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
  let prev: Record<string, unknown> = {};
  if (prevRaw) {
    try {
      const p = JSON.parse(prevRaw) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) prev = p as Record<string, unknown>;
    } catch {
      return;
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
    localStorage.removeItem(LEGACY_STANDALONE_MEASUREMENTS_KEY);
  } catch {
    /* ignore */
  }
}

export function clearMeasurementOverrides(): void {
  persistMeasurementOverrides({});
}
