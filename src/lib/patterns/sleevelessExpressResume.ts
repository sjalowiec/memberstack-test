import { SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";

export {
  EXPRESS_EDITING_FALLBACK_LABEL,
  getExpressEditingProjectLabel,
} from "./customPatternEditingUx";

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
  /** Saved project reopened via Change Pattern Choices — unlock full wizard for editing. */
  editChoicesReopen?: boolean;
}

export const EXPRESS_FLOW_STEPS = 5;

export function isExpressEditChoicesReopenSession(
  persisted: ExpressPersistedV1 | null | undefined,
): boolean {
  return persisted?.editChoicesReopen === true;
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

/** Merge a partial snapshot into `kbm_sleeveless_express_builder` (preserves unrelated fields). */
export function writeExpressPersistedSnapshot(
  patch: Partial<ExpressPersistedV1> & { values?: Record<string, string> },
): void {
  if (typeof localStorage === "undefined") return;
  const prev = loadExpressPersisted() ?? {};
  const next: ExpressPersistedV1 = {
    ...prev,
    ...patch,
    values:
      patch.values != null
        ? { ...(prev.values ?? {}), ...patch.values }
        : prev.values,
  };
  try {
    localStorage.setItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota */
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

