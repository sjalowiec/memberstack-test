/**
 * Saved-project sizing chart identity (chart audience + size label).
 * Detaches the active Blob project link when chart audience drifts (e.g. Child → Women).
 * Same-chart edits (size 6 → 8, cardigan → pullover, gauge/fit) stay linked to the saved project.
 * Same numeric labels on different charts are never equivalent (Child 8 ≠ Women 8).
 */
import { CUSTOM_PATTERN_EDITING_STATE_CHANGED_EVENT } from "./customPatternEditingEvents";
import {
  clearActiveCustomPatternProjectId,
  readActiveCustomPatternProjectId,
} from "./customPatternProjectActiveId";
import { getCurrentPattern, getPatternData } from "./patternStorage";
import { expressWhoToChartAudience } from "./syncSleevelessExpressDesignToStorage";
import { nonEmptyTrimmed } from "./sleevelessExpressSizeChartClient";

export const CUSTOM_PATTERN_SAVED_SIZING_IDENTITY_BASELINE_KEY =
  "kbm_custom_pattern_saved_sizing_identity_baseline";

export type SavedCustomPatternSizingIdentity = {
  chartAudience: string;
  selectedSize: string;
};

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

export function sizingIdentityKey(identity: SavedCustomPatternSizingIdentity): string {
  return `${identity.chartAudience}:${identity.selectedSize}`;
}

export function sizingIdentityEquals(
  a: SavedCustomPatternSizingIdentity,
  b: SavedCustomPatternSizingIdentity,
): boolean {
  return sizingIdentityKey(a) === sizingIdentityKey(b);
}

export function chartAudienceEquals(a: string, b: string): boolean {
  return String(a ?? "").trim() === String(b ?? "").trim();
}

/** True when the knitter moved to a different sizing chart (cross-audience edit). */
export function hasChartAudienceDrift(
  baseline: SavedCustomPatternSizingIdentity,
  current: SavedCustomPatternSizingIdentity,
): boolean {
  return !chartAudienceEquals(baseline.chartAudience, current.chartAudience);
}

export function buildSizingIdentityFromExpressValues(
  values: Record<string, string>,
): SavedCustomPatternSizingIdentity | null {
  const who = values.who?.trim();
  const selectedSize = values.selectedSize?.trim();
  if (!who || !selectedSize) return null;
  return {
    chartAudience: expressWhoToChartAudience(who),
    selectedSize,
  };
}

/** Canonical working draft audience + size (merged style/fit). */
export function buildSizingIdentityFromCanonicalDraft(): SavedCustomPatternSizingIdentity | null {
  const pattern = getCurrentPattern();
  const patternData = getPatternData();
  const style = { ...section(pattern.style), ...section(patternData.style) };
  const fit = { ...section(pattern.fit), ...section(patternData.fit) };
  const chartAudience = String(
    style.recipientCategory ?? fit.sizingChart ?? "",
  ).trim();
  const selectedSize = String(fit.selectedSize ?? "").trim();
  if (!chartAudience || !selectedSize) return null;
  return { chartAudience, selectedSize };
}

export function writeSavedSizingIdentityBaseline(
  identity: SavedCustomPatternSizingIdentity | null,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (!identity) {
      localStorage.removeItem(CUSTOM_PATTERN_SAVED_SIZING_IDENTITY_BASELINE_KEY);
      return;
    }
    localStorage.setItem(
      CUSTOM_PATTERN_SAVED_SIZING_IDENTITY_BASELINE_KEY,
      JSON.stringify(identity),
    );
  } catch {
    /* ignore */
  }
}

export function readSavedSizingIdentityBaseline(): SavedCustomPatternSizingIdentity | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CUSTOM_PATTERN_SAVED_SIZING_IDENTITY_BASELINE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const chartAudience = String((parsed as SavedCustomPatternSizingIdentity).chartAudience ?? "").trim();
    const selectedSize = String((parsed as SavedCustomPatternSizingIdentity).selectedSize ?? "").trim();
    if (!chartAudience || !selectedSize) return null;
    return { chartAudience, selectedSize };
  } catch {
    return null;
  }
}

export function clearSavedSizingIdentityBaseline(): void {
  writeSavedSizingIdentityBaseline(null);
}

/**
 * Clears the active saved-project link when chart audience no longer matches the baseline
 * captured at load/save. Same-chart size/style/fit edits remain linked; cross-chart edits
 * behave like starting a new pattern (no automatic measurement conversion).
 */
export function detachActiveSavedProjectWhenChartAudienceDrifts(
  current: SavedCustomPatternSizingIdentity | null,
): boolean {
  if (!readActiveCustomPatternProjectId() || !current) return false;
  const baseline = readSavedSizingIdentityBaseline();
  if (!baseline) return false;
  if (!hasChartAudienceDrift(baseline, current)) return false;
  clearActiveCustomPatternProjectId();
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("kbm-editing-saved-pattern");
    document.dispatchEvent(new CustomEvent(CUSTOM_PATTERN_EDITING_STATE_CHANGED_EVENT));
  }
  return true;
}

/** @deprecated Use {@link detachActiveSavedProjectWhenChartAudienceDrifts}. */
export const detachActiveSavedProjectWhenSizingIdentityDrifts =
  detachActiveSavedProjectWhenChartAudienceDrifts;

/** Express `values` with who + size — used before syncing wizard → canonical. */
export function expressValuesHaveSizingIdentity(values: Record<string, string>): boolean {
  return Boolean(nonEmptyTrimmed(values.who) && nonEmptyTrimmed(values.selectedSize));
}
