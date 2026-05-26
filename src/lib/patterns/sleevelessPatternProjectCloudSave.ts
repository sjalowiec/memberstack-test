/**
 * Shared “Save pattern” action for sleeveless Customize (review) and Pattern tabs.
 * Uses `smartSaveCustomPatternProject` in create mode — always a new saved project record.
 */
import type { CustomPatternProject } from "./customPatternProjectTypes";
import { smartSaveCustomPatternProject } from "./customPatternSavedProjectsPanel";

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

  if (cloudSaveBtn) cloudSaveBtn.disabled = true;
  const res = await smartSaveCustomPatternProject({
    mode: "create",
    resolveName: () => name,
    onStatus: (message, isError) =>
      setSleevelessPatternProjectCloudSaveStatus(root, message, isError),
  });
  if (cloudSaveBtn) cloudSaveBtn.disabled = false;

  if (!res.ok) {
    setSleevelessPatternProjectCloudSaveStatus(root, res.error, true);
    return;
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
