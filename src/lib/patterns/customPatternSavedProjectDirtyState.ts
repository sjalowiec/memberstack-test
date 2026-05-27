/**
 * Dirty-state for Custom Pattern projects (saved + unsaved custom-build drafts).
 * Compares the working draft to a baseline captured on load, after page init, or after save.
 */
import { buildSavePayloadFromWorkingDraft } from "./customPatternProjectClient";
import type { SaveCustomPatternProjectRequest } from "./customPatternProjectTypes";
import {
  readActiveCustomPatternProjectId,
  readActiveCustomPatternProjectLinkedName,
} from "./customPatternProjectActiveId";
import { isEditingSavedCustomPatternProject } from "./customPatternEditingUx";
import { getPatternProjectMeta } from "./sleevelessPatternProjectMeta";
import { getCurrentPattern, getPatternData } from "./patternStorage";
import { readCanonicalMeasurementOverrides } from "./sleevelessCustomMeasurementStorage";
import {
  resolveGeneratorPatternMode,
  sectionPattern,
} from "./sleevelessPatternBuilderMerge";

export const CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_KEY =
  "kbm_custom_pattern_saved_dirty_baseline";
export const CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_PROJECT_KEY =
  "kbm_custom_pattern_saved_dirty_baseline_project_id";

/** Stored in the project-id slot when tracking an unsaved custom-build draft (no Blob id yet). */
export const CUSTOM_PATTERN_UNSAVED_DRAFT_BASELINE_SENTINEL = "__custom_build_draft__";

/** Stable JSON for comparing draft vs last-saved baseline (ignores volatile ids/timestamps). */
export function normalizeCustomPatternDirtySnapshot(
  payload: SaveCustomPatternProjectRequest,
): string {
  const pattern = payload.pattern;
  const { id: _id, createdAt: _c, updatedAt: _u, ...patternBody } = pattern;
  return JSON.stringify({
    name: payload.name.trim(),
    notes: (payload.notes ?? "").trim(),
    family: payload.family ?? "sleeveless",
    source: payload.source,
    pattern: patternBody,
    customOverrides: payload.customOverrides ?? {},
  });
}

function resolveDirtySnapshotName(): string {
  const meta = getPatternProjectMeta();
  const title = meta.title.trim();
  if (title) return title;
  const linked = readActiveCustomPatternProjectLinkedName().trim();
  if (linked) return linked;
  return "Untitled pattern";
}

/** Brand-new custom-build session with local draft only (not linked to a saved Blob project). */
export function isUnsavedCustomBuildDraftSession(): boolean {
  if (isEditingSavedCustomPatternProject()) return false;
  const canonicalStyle = sectionPattern(getCurrentPattern().style);
  const pbStyle = sectionPattern(getPatternData().style);
  if (resolveGeneratorPatternMode(canonicalStyle, pbStyle) === "custom-build") {
    return true;
  }
  return Object.keys(readCanonicalMeasurementOverrides()).length > 0;
}

function resolveDirtyBaselineProjectKey(): string {
  const projectId = readActiveCustomPatternProjectId();
  if (projectId) return projectId;
  if (isUnsavedCustomBuildDraftSession()) {
    return CUSTOM_PATTERN_UNSAVED_DRAFT_BASELINE_SENTINEL;
  }
  return "";
}

export function buildCurrentCustomPatternDirtySnapshot(): string {
  return normalizeCustomPatternDirtySnapshot(
    buildSavePayloadFromWorkingDraft(resolveDirtySnapshotName()),
  );
}

/** @deprecated Alias — use {@link buildCurrentCustomPatternDirtySnapshot}. */
export const buildCurrentSavedCustomPatternDirtySnapshot = buildCurrentCustomPatternDirtySnapshot;

export function clearSavedCustomPatternDirtyBaseline(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_KEY);
    localStorage.removeItem(CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_PROJECT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * After page init normalizes the working draft, re-capture baseline once (saved project or custom-build draft).
 * Not used on preview/generate navigation — only load/save should reset the baseline.
 */
export function scheduleCaptureCustomPatternDirtyBaselineAfterHydration(): void {
  if (!isEditingSavedCustomPatternProject() && !isUnsavedCustomBuildDraftSession()) {
    return;
  }
  const capture = (): void => captureCustomPatternDirtyBaseline();
  if (typeof queueMicrotask === "function") {
    queueMicrotask(capture);
    return;
  }
  setTimeout(capture, 0);
}

/** @deprecated Alias — use {@link scheduleCaptureCustomPatternDirtyBaselineAfterHydration}. */
export const scheduleCaptureSavedCustomPatternDirtyBaselineAfterHydration =
  scheduleCaptureCustomPatternDirtyBaselineAfterHydration;

/** Record the working draft as clean (after load, page init, or save/update). */
export function captureCustomPatternDirtyBaseline(): void {
  if (typeof localStorage === "undefined") return;
  const baselineProjectKey = resolveDirtyBaselineProjectKey();
  if (!baselineProjectKey) {
    clearSavedCustomPatternDirtyBaseline();
    return;
  }
  try {
    localStorage.setItem(
      CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_PROJECT_KEY,
      baselineProjectKey,
    );
    localStorage.setItem(
      CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_KEY,
      buildCurrentCustomPatternDirtySnapshot(),
    );
  } catch {
    /* ignore */
  }
}

/** @deprecated Alias — use {@link captureCustomPatternDirtyBaseline}. */
export const captureSavedCustomPatternDirtyBaseline = captureCustomPatternDirtyBaseline;

function hasUnsavedAgainstStoredBaseline(expectedProjectKey: string): boolean {
  let storedProjectKey = "";
  let baseline = "";
  try {
    storedProjectKey =
      localStorage.getItem(CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_PROJECT_KEY)?.trim() ??
      "";
    baseline = localStorage.getItem(CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_KEY) ?? "";
  } catch {
    return false;
  }

  if (storedProjectKey && storedProjectKey !== expectedProjectKey) {
    return false;
  }

  if (!baseline) {
    return true;
  }

  return buildCurrentCustomPatternDirtySnapshot() !== baseline;
}

/** Saved project or unsaved custom-build draft with a dirty working copy. */
export function hasUnsavedCustomPatternChanges(): boolean {
  if (typeof localStorage === "undefined") return false;

  const savedProjectId = readActiveCustomPatternProjectId();
  if (savedProjectId) {
    return hasUnsavedAgainstStoredBaseline(savedProjectId);
  }

  if (!isUnsavedCustomBuildDraftSession()) {
    return false;
  }

  return hasUnsavedAgainstStoredBaseline(CUSTOM_PATTERN_UNSAVED_DRAFT_BASELINE_SENTINEL);
}

/** @deprecated Alias — use {@link hasUnsavedCustomPatternChanges}. */
export function hasUnsavedSavedCustomPatternChanges(): boolean {
  if (!isEditingSavedCustomPatternProject()) {
    return hasUnsavedCustomPatternChanges();
  }
  return hasUnsavedAgainstStoredBaseline(readActiveCustomPatternProjectId());
}
