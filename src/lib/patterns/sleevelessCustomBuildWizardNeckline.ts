/**
 * Custom Build wizard style inputs from express builder / style-step storage only (no sync imports).
 */
import { SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";

const CUSTOM_BUILD_NECKLINE_VALUES = new Set(["round", "v-neck"]);
const CUSTOM_BUILD_GARMENT_VALUES = new Set(["pullover", "cardigan"]);

/** `localStorage` key written by custom-style page when express `values.neckline` is absent. */
export const CUSTOM_BUILD_NECKLINE_STYLE_KEY = "necklineStyle";

/** `localStorage` key for pullover vs cardigan on the style step (`sleeveless-custom-style-page.ts`). */
export const CUSTOM_BUILD_GARMENT_TYPE_KEY = "garmentType";

function readExpressValues(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    const v = (p as { values?: unknown })?.values;
    if (v && typeof v === "object" && !Array.isArray(v)) return { ...(v as Record<string, string>) };
  } catch {
    /* ignore */
  }
  return {};
}

/** Neckline from Custom Build wizard (`values.neckline` or legacy `necklineStyle` key). */
export function readCustomBuildWizardNeckline(): string {
  const ev = readExpressValues();
  if (ev.neckline && CUSTOM_BUILD_NECKLINE_VALUES.has(ev.neckline)) return ev.neckline;
  if (typeof localStorage === "undefined") return "";
  try {
    const legacy = localStorage.getItem(CUSTOM_BUILD_NECKLINE_STYLE_KEY)?.trim() ?? "";
    if (CUSTOM_BUILD_NECKLINE_VALUES.has(legacy)) return legacy;
  } catch {
    /* ignore */
  }
  return "";
}

/** Pullover vs cardigan from the Custom Build style step (`garmentType` localStorage). */
export function readCustomBuildWizardGarmentType(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    const raw = localStorage.getItem(CUSTOM_BUILD_GARMENT_TYPE_KEY)?.trim() ?? "";
    if (CUSTOM_BUILD_GARMENT_VALUES.has(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "";
}
