/**
 * Dirty-state for an open saved Custom Pattern project (sleeveless workflow).
 * Compares the working draft to a baseline captured on load or after save/update.
 */
import { buildSavePayloadFromWorkingDraft } from "./customPatternProjectClient";
import type { SaveCustomPatternProjectRequest } from "./customPatternProjectTypes";
import {
  readActiveCustomPatternProjectId,
  readActiveCustomPatternProjectLinkedName,
} from "./customPatternProjectActiveId";
import { isEditingSavedCustomPatternProject } from "./customPatternEditingUx";
import { getPatternProjectMeta } from "./sleevelessPatternProjectMeta";

export const CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_KEY =
  "kbm_custom_pattern_saved_dirty_baseline";
export const CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_PROJECT_KEY =
  "kbm_custom_pattern_saved_dirty_baseline_project_id";

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

export function buildCurrentSavedCustomPatternDirtySnapshot(): string {
  return normalizeCustomPatternDirtySnapshot(
    buildSavePayloadFromWorkingDraft(resolveDirtySnapshotName()),
  );
}

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
 * After a corrective Express rehydrate from the working draft (stale wizard storage),
 * re-capture the dirty baseline once page init has finished.
 * Not used on preview/generate navigation — only load/save should reset the baseline.
 */
export function scheduleCaptureSavedCustomPatternDirtyBaselineAfterHydration(): void {
  if (!isEditingSavedCustomPatternProject()) return;
  const capture = (): void => captureSavedCustomPatternDirtyBaseline();
  if (typeof queueMicrotask === "function") {
    queueMicrotask(capture);
    return;
  }
  setTimeout(capture, 0);
}

/** Record the working draft as matching the active saved project (after load or save). */
export function captureSavedCustomPatternDirtyBaseline(): void {
  if (typeof localStorage === "undefined") return;
  const projectId = readActiveCustomPatternProjectId();
  if (!projectId) {
    clearSavedCustomPatternDirtyBaseline();
    return;
  }
  try {
    localStorage.setItem(
      CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_PROJECT_KEY,
      projectId,
    );
    localStorage.setItem(
      CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_KEY,
      buildCurrentSavedCustomPatternDirtySnapshot(),
    );
  } catch {
    /* ignore */
  }
}

export function hasUnsavedSavedCustomPatternChanges(): boolean {
  if (!isEditingSavedCustomPatternProject()) return false;
  if (typeof localStorage === "undefined") return false;

  const projectId = readActiveCustomPatternProjectId();
  let storedProjectId = "";
  let baseline = "";
  try {
    storedProjectId =
      localStorage.getItem(CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_PROJECT_KEY)?.trim() ??
      "";
    baseline = localStorage.getItem(CUSTOM_PATTERN_SAVED_DIRTY_BASELINE_KEY) ?? "";
  } catch {
    return false;
  }

  if (!projectId) {
    return false;
  }

  if (storedProjectId && storedProjectId !== projectId) {
    return false;
  }

  if (!baseline) {
    return true;
  }

  return buildCurrentSavedCustomPatternDirtySnapshot() !== baseline;
}
