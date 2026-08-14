/**
 * Hydrate local session state from a saved Custom Pattern project (canonical draft + Express wizard).
 * Call after loading a project from Blob storage so stale Express keys cannot overwrite another pattern.
 */
import { hydrateHatSavedProject, isHatCustomPatternProject } from "./hat/hatSavedProject";
import {
  syncAvailableNeedlesMirrorsFromAllSources,
} from "./availableNeedlesMirrors";
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
  type RestoreSleevelessExpressBuilderOptions,
} from "./restoreSleevelessExpressBuilderFromPattern";
import { loadExpressPersisted } from "./sleevelessExpressResume";
import {
  buildSizingIdentityFromExpressValues,
  expressValuesHaveSizingIdentity,
} from "./savedCustomPatternSessionIdentity";
import {
  nonEmptyTrimmed,
  resolveExpressChartFit,
} from "./sleevelessExpressSizeChartClient";
import { expressWhoToChartAudience, mapExpressStyleKey } from "./syncSleevelessExpressDesignToStorage";
import { syncExpressWizardToPatternStorage } from "./syncExpressWizardToPatternStorage";

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
export function rehydrateExpressBuilderFromActiveSavedProject(
  options: RestoreSleevelessExpressBuilderOptions = {},
): boolean {
  if (!isEditingSavedCustomPatternProject()) return false;
  return safeRestoreSleevelessExpressBuilderFromPattern(
    getCurrentPattern(),
    getPatternData(),
    options,
  );
}

/**
 * When the Express wizard has who + size that disagree with the canonical draft, treat the wizard
 * as the knitter's current choices and sync into `kbm_current_pattern` instead of overwriting the UI
 * from stale saved-project measurements (e.g. Child 8 → Ladies 8 with the same size label).
 */
export function promoteExpressBuilderToCanonicalWhenDrifted(): boolean {
  if (!isEditingSavedCustomPatternProject()) return false;

  const persisted = loadExpressPersisted();
  const wizard =
    persisted?.values && typeof persisted.values === "object" && !Array.isArray(persisted.values)
      ? { ...(persisted.values as Record<string, string>) }
      : {};

  if (!expressValuesHaveSizingIdentity(wizard)) return false;
  if (expressBuilderMatchesActiveSavedProject()) return false;

  const aud = expressWhoToChartAudience(wizard.who);
  const chartFit = nonEmptyTrimmed(wizard.selectedSize)
    ? resolveExpressChartFit(aud, wizard.selectedSize!.trim(), wizard.fit || "standard", {
        bodyShape: mapExpressStyleKey(wizard.style ?? "").bodyShape,
      })
    : null;

  syncExpressWizardToPatternStorage(wizard, chartFit, { preferDomGauge: false });
  return true;
}

/**
 * Copies the saved project into the working draft, restores Express wizard storage from it,
 * and records the dirty baseline. Use for library/account open and in-panel load.
 *
 * Pass `{ editChoicesReopen: true }` when opening for a full edit (My Patterns / library Open) so
 * every builder step is unlocked and prefilled — including gauge — instead of resuming at step 1.
 */
export function hydrateSavedCustomPatternProjectSession(
  project: CustomPatternProject,
  options: RestoreSleevelessExpressBuilderOptions = {},
): void {
  if (isHatCustomPatternProject(project)) {
    hydrateHatSavedProject(project);
    return;
  }
  loadProjectIntoWorkingDraft(project);
  writeActiveCustomPatternProjectId(project.id, project.name);
  rehydrateExpressBuilderFromActiveSavedProject(options);
  syncAvailableNeedlesMirrorsFromAllSources();
  captureSavedCustomPatternDirtyBaseline();
}

/**
 * Pattern tab — align Express wizard with the working draft, preferring live wizard choices over
 * stale canonical data when both are present. Does not update the dirty baseline.
 */
export function ensureSavedCustomPatternSessionHydratedOnPatternPage(): void {
  if (!isEditingSavedCustomPatternProject()) return;
  if (promoteExpressBuilderToCanonicalWhenDrifted()) {
    syncAvailableNeedlesMirrorsFromAllSources();
    return;
  }
  if (!expressBuilderMatchesActiveSavedProject()) {
    rehydrateExpressBuilderFromActiveSavedProject();
  }
  syncAvailableNeedlesMirrorsFromAllSources();
}

/**
 * Express tab — when wizard storage disagrees with the working draft, promote wizard → canonical
 * if the knitter has who + size set; otherwise restore from the saved project draft.
 */
export function ensureSavedCustomPatternSessionHydratedOnExpressPage(): void {
  if (!isEditingSavedCustomPatternProject()) return;
  if (expressBuilderMatchesActiveSavedProject()) return;
  if (promoteExpressBuilderToCanonicalWhenDrifted()) return;
  const restored = rehydrateExpressBuilderFromActiveSavedProject();
  if (restored) {
    scheduleCaptureSavedCustomPatternDirtyBaselineAfterHydration();
  }
}
