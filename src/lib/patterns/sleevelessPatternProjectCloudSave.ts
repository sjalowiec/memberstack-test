/**
 * Shared “Save pattern” action for sleeveless Customize (review) and Pattern tabs.
 * Updates the linked saved project when one is active; otherwise creates a new record.
 */
import type { CustomPatternProject } from "./customPatternProjectTypes";
import {
  resolveDefaultCustomPatternSaveMode,
  smartSaveCustomPatternProject,
} from "./customPatternSavedProjectsPanel";
import {
  canCreatePatternForSystem,
  canEditPatternSettingsForSystem,
  resolvePatternSystemAlreadyClaimedCopy,
  resolvePatternSystemSaveLoggedOutCopy,
} from "./sleevelessPatternSystemAccess";
import { offerPatternEditingUnlockModal } from "./patternEditingUnlockModal";
import {
  markFreePatternClaimedForSystem,
  resolveSleevelessUserAccess,
} from "./sleevelessPatternSystemAccessClient";
import { isFreeClaimedForSystem } from "./patternSystemFreeClaim";
import { resolvePatternSystemFromPage, type PatternSystemId } from "./patternSystemId";

/** @deprecated Use {@link resolvePatternSystemSaveLoggedOutCopy}. */
export const SLEEVELESS_SAVE_LOGGED_OUT_COPY = resolvePatternSystemSaveLoggedOutCopy("sleeveless");

/** @deprecated Use {@link resolvePatternSystemAlreadyClaimedCopy}. */
export const SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY =
  resolvePatternSystemAlreadyClaimedCopy("sleeveless");

export function resolveSaveLoggedOutCopy(systemId?: PatternSystemId): string {
  return resolvePatternSystemSaveLoggedOutCopy(systemId ?? resolvePatternSystemFromPage());
}

export function resolveSaveAlreadyClaimedCopy(systemId?: PatternSystemId): string {
  return resolvePatternSystemAlreadyClaimedCopy(systemId ?? resolvePatternSystemFromPage());
}

export function setSleevelessPatternProjectCloudSaveStatus(
  root: HTMLElement,
  message: string,
  isError = false,
): void {
  const el = root.querySelector("[data-cb-project-status]");
  if (!el || typeof el !== "object" || !("textContent" in el)) return;
  (el as HTMLElement).textContent = message;
  (el as HTMLElement).classList.toggle("cb-project-status--error", isError);
}

export type RunSleevelessPatternProjectCloudSaveOptions = {
  resolveName: () => string;
  onMissingName?: () => void;
  onSuccess?: (result: { project: CustomPatternProject; created: boolean }) => void;
  patternSystem?: PatternSystemId;
};

/** Create or update the active saved project; update status element inside `root`. */
export async function runSleevelessPatternProjectCloudSave(
  root: HTMLElement,
  options: RunSleevelessPatternProjectCloudSaveOptions,
): Promise<void> {
  const cloudSaveBtn = root.querySelector<HTMLButtonElement>(
    "[data-sleeveless-pattern-project-cloud-save]",
  );
  const patternSystem = options.patternSystem ?? resolvePatternSystemFromPage();
  const name = options.resolveName().trim();
  if (!name) {
    setSleevelessPatternProjectCloudSaveStatus(root, "Enter a pattern name before saving.", true);
    options.onMissingName?.();
    return;
  }

  const access = await resolveSleevelessUserAccess();
  const willCreateNew = resolveDefaultCustomPatternSaveMode() === "create";
  if (willCreateNew && !canCreatePatternForSystem(access, patternSystem)) {
    const message = access.loggedIn
      ? resolveSaveAlreadyClaimedCopy(patternSystem)
      : resolveSaveLoggedOutCopy(patternSystem);
    setSleevelessPatternProjectCloudSaveStatus(root, message, true);
    return;
  }

  // Overwriting/renaming the linked saved project is an edit — gate like My Patterns.
  if (!willCreateNew && !canEditPatternSettingsForSystem(access, patternSystem)) {
    if (typeof document !== "undefined") {
      offerPatternEditingUnlockModal(access, { patternSystem });
    }
    setSleevelessPatternProjectCloudSaveStatus(
      root,
      resolveSaveAlreadyClaimedCopy(patternSystem),
      true,
    );
    return;
  }

  if (cloudSaveBtn) cloudSaveBtn.disabled = true;
  const res = await smartSaveCustomPatternProject({
    resolveName: () => name,
    root,
    onStatus: (message, isError) =>
      setSleevelessPatternProjectCloudSaveStatus(root, message, isError),
  });
  if (cloudSaveBtn) cloudSaveBtn.disabled = false;

  if (!res.ok) {
    setSleevelessPatternProjectCloudSaveStatus(root, res.error, true);
    return;
  }

  if (
    res.created &&
    !isFreeClaimedForSystem(access.freeClaimsBySystem, patternSystem)
  ) {
    await markFreePatternClaimedForSystem(patternSystem, res.project.id);
  }

  options.onSuccess?.(res);
  setSleevelessPatternProjectCloudSaveStatus(
    root,
    res.created ? `Saved “${res.project.name}”.` : `Updated “${res.project.name}”.`,
  );
}

export function bindSleevelessPatternProjectCloudSave(
  root: HTMLElement,
  options: RunSleevelessPatternProjectCloudSaveOptions,
): void {
  const cloudSaveBtn = root.querySelector<HTMLButtonElement>(
    "[data-sleeveless-pattern-project-cloud-save]",
  );
  if (!cloudSaveBtn || cloudSaveBtn.dataset.sleevelessPatternCloudSaveBound === "1") return;
  cloudSaveBtn.dataset.sleevelessPatternCloudSaveBound = "1";
  cloudSaveBtn.addEventListener("click", () => {
    void runSleevelessPatternProjectCloudSave(root, options);
  });
}
