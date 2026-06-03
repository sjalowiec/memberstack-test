/**
 * Shared “Save pattern” action for sleeveless Customize (review) and Pattern tabs.
 * Updates the linked saved project when one is active; otherwise creates a new record.
 */
import type { CustomPatternProject } from "./customPatternProjectTypes";
import {
  resolveDefaultCustomPatternSaveMode,
  smartSaveCustomPatternProject,
} from "./customPatternSavedProjectsPanel";
import { canCreateSleevelessPattern } from "./sleevelessPatternSystemAccess";
import {
  markFreeSleevelessPatternClaimed,
  resolveSleevelessUserAccess,
} from "./sleevelessPatternSystemAccessClient";

/** Shown when a logged-out visitor tries to save a sleeveless pattern. */
export const SLEEVELESS_SAVE_LOGGED_OUT_COPY =
  "Log in to create your free Sleeveless Pattern.";

/**
 * Shown when a free user who already claimed their pattern tries to create another.
 * Paragraph breaks (\n\n) render as separate paragraphs on the locked card
 * (see `.sleeveless-new-pattern-locked__body`); they collapse to spaces in the
 * single-line inline save-status element, which is acceptable there.
 */
export const SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY =
  "You’ve already created your free Sleeveless Pattern.\n\nTo create additional versions, change your gauge or measurements, or explore different style choices, you’ll need access to the Sleeveless Pattern System.\n\nMembers already have access, or you can purchase the Sleeveless Pattern System separately.";

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
};

/** Create or update the active saved project; update status element inside `root`. */
export async function runSleevelessPatternProjectCloudSave(
  root: HTMLElement,
  options: RunSleevelessPatternProjectCloudSaveOptions,
): Promise<void> {
  const cloudSaveBtn = root.querySelector<HTMLButtonElement>(
    "[data-sleeveless-pattern-project-cloud-save]",
  );
  const name = options.resolveName().trim();
  if (!name) {
    setSleevelessPatternProjectCloudSaveStatus(root, "Enter a pattern name before saving.", true);
    options.onMissingName?.();
    return;
  }

  // Gate creation of NEW patterns by Memberstack access. Updating an existing saved pattern
  // (e.g. renaming a free claimed pattern or editing notes) is always allowed when logged in.
  const access = await resolveSleevelessUserAccess();
  const willCreateNew = resolveDefaultCustomPatternSaveMode() === "create";
  if (willCreateNew && !canCreateSleevelessPattern(access)) {
    const message = access.loggedIn
      ? SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY
      : SLEEVELESS_SAVE_LOGGED_OUT_COPY;
    setSleevelessPatternProjectCloudSaveStatus(root, message, true);
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

  // First saved pattern on the account → record the one-time creation allowance as used
  // (account-tied). Done for members too: it has no effect while they have access, but once
  // entitlement ends it correctly locks creation + regeneration of all saved patterns. We only
  // mark on the very first create so the recorded id stays the account's first pattern.
  if (res.created && !access.freeClaimed) {
    await markFreeSleevelessPatternClaimed(res.project.id);
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
