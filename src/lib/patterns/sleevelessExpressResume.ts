import { getPatternProjectMeta } from "./sleevelessPatternProjectMeta";
import { SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";

/** Generic label when the knitter has not set a custom project name. */
export const EXPRESS_EDITING_FALLBACK_LABEL = "Sleeveless Sweater";

/** Express wizard snapshot shape (`kbm_sleeveless_express_builder`). */
export interface ExpressPersistedV1 {
  values?: Record<string, string>;
  openStep?: number;
  maxReachable?: number;
  gaugeStitchRaw?: string;
  gaugeRowRaw?: string;
  /** Needle bed width from Express gauge step (`express-available-needles`). */
  availableNeedles?: string;
  flowSteps?: number;
  whoSizeCombined?: boolean;
}

export function loadExpressPersisted(): ExpressPersistedV1 | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    return p as ExpressPersistedV1;
  } catch {
    return null;
  }
}

/** True when the knitter has meaningful in-progress Express choices worth resuming. */
export function hasExpressResumeProgress(values: Record<string, string>): boolean {
  const trimmed = (v: string | undefined) => (v ?? "").trim();
  const who = trimmed(values.who);
  const size = trimmed(values.selectedSize);
  if (who || size) return true;
  if (trimmed(values.neckline) || trimmed(values.fit)) return true;
  // Ignore legacy sessions where Pullover was auto-selected before the user chose a front style.
  const legacyAutoPulloverOnly =
    trimmed(values.shape) === "straight" &&
    trimmed(values.front) === "closed" &&
    trimmed(values.style) === "straight-pullover" &&
    !who &&
    !size &&
    !trimmed(values.neckline) &&
    !trimmed(values.fit);
  if (legacyAutoPulloverOnly) return false;
  if (trimmed(values.front)) return true;
  return false;
}

/** Display name for the compact Express “Editing:” row (custom title only). */
export function getExpressEditingProjectLabel(): string {
  const meta = getPatternProjectMeta();
  const title = meta.title.trim();
  if (title && meta.titleCustomized) return title;
  return EXPRESS_EDITING_FALLBACK_LABEL;
}
