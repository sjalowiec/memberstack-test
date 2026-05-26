/**
 * Hydrate local session state from a saved Custom Pattern project (canonical draft + Express wizard).
 * Call after loading a project from Blob storage so stale Express keys cannot overwrite another pattern.
 */
import { writeActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { loadProjectIntoWorkingDraft } from "./customPatternProjectClient";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import {
  captureSavedCustomPatternDirtyBaseline,
  scheduleCaptureSavedCustomPatternDirtyBaselineAfterHydration,
} from "./customPatternSavedProjectDirtyState";
import { isEditingSavedCustomPatternProject } from "./customPatternEditingUx";
import { getCurrentPattern, getPatternData } from "./patternStorage";
import {
  buildExpressValuesFromPattern,
  hasExpressChoicesToRestore,
  safeRestoreSleevelessExpressBuilderFromPattern,
} from "./restoreSleevelessExpressBuilderFromPattern";
import { loadExpressPersisted } from "./sleevelessExpressResume";

const EXPRESS_VALUE_COMPARE_KEYS = [
  "who",
  "selectedSize",
  "front",
  "neckline",
  "fit",
  "style",
] as const;

function trimVal(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** True when wizard storage already reflects the open saved project's canonical draft. */
export function expressBuilderMatchesActiveSavedProject(): boolean {
  if (!isEditingSavedCustomPatternProject()) return true;

  const fromPattern = buildExpressValuesFromPattern(getCurrentPattern(), getPatternData());
  if (!hasExpressChoicesToRestore(fromPattern)) return true;

  const persisted = loadExpressPersisted();
  const wizard = persisted?.values ?? {};
  for (const key of EXPRESS_VALUE_COMPARE_KEYS) {
    const canonical = trimVal(fromPattern[key]);
    const stored = trimVal(wizard[key]);
    if (canonical && stored && canonical !== stored) return false;
  }
  return true;
}

/** Rebuild `kbm_sleeveless_express_builder` from the working draft (saved project is source of truth). */
export function rehydrateExpressBuilderFromActiveSavedProject(): boolean {
  if (!isEditingSavedCustomPatternProject()) return false;
  return safeRestoreSleevelessExpressBuilderFromPattern(
    getCurrentPattern(),
    getPatternData(),
  );
}

/**
 * Copies the saved project into the working draft, restores Express wizard storage from it,
 * and records the dirty baseline. Use for library/account open and in-panel load.
 */
export function hydrateSavedCustomPatternProjectSession(project: CustomPatternProject): void {
  loadProjectIntoWorkingDraft(project);
  writeActiveCustomPatternProjectId(project.id, project.name);
  rehydrateExpressBuilderFromActiveSavedProject();
  captureSavedCustomPatternDirtyBaseline();
}

/**
 * Pattern tab — sync Express wizard storage from the working draft so a prior session cannot leak.
 * Does not update the dirty baseline (preview/generate must not clear unsaved state).
 */
export function ensureSavedCustomPatternSessionHydratedOnPatternPage(): void {
  if (!isEditingSavedCustomPatternProject()) return;
  rehydrateExpressBuilderFromActiveSavedProject();
}

/**
 * Express tab — rehydrate only when wizard storage disagrees with the working draft (stale handoff).
 * Re-baselines dirty state only after that corrective restore, not on every visit.
 */
export function ensureSavedCustomPatternSessionHydratedOnExpressPage(): void {
  if (!isEditingSavedCustomPatternProject()) return;
  if (!expressBuilderMatchesActiveSavedProject()) {
    const restored = rehydrateExpressBuilderFromActiveSavedProject();
    if (restored) {
      scheduleCaptureSavedCustomPatternDirtyBaselineAfterHydration();
    }
  }
}
