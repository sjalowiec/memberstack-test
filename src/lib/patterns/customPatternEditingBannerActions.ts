/**
 * Update / exit actions for the Custom Build “Editing saved pattern” banner.
 */
import { clearActiveCustomPatternProjectId, readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { clearSavedCustomPatternDirtyBaseline } from "./customPatternSavedProjectDirtyState";
import { isEditingSavedCustomPatternProject } from "./customPatternEditingUx";
import { prepareCustomBuildPatternGeneration } from "./prepareCustomBuildPatternGeneration";
import { resolveCustomBuildSaveMeasureFlushRoot } from "./sleevelessCustomMeasurementStorage";
import { smartSaveCustomPatternProject } from "./customPatternSavedProjectsPanel";
import { refreshCustomPatternSavedProjectsPanelUi } from "./customPatternSavedProjectsPanel";
import { syncCustomBuildCustomizeAccessChrome } from "./customBuildCustomizeAccess";
import { syncCustomBuildFoundationPageHeader } from "./customBuildFoundationPageEditingUx";
import { syncPatternWorkspaceExpressTabLabel } from "./patternWorkspaceExpressTabLabel";
import { getPatternProjectMeta } from "./sleevelessPatternProjectMeta";
import { CUSTOM_PATTERN_EDITING_STATE_CHANGED_EVENT } from "./customPatternEditingEvents";

export { CUSTOM_PATTERN_EDITING_STATE_CHANGED_EVENT };

export const CB_EDITING_BANNER_UPDATE_SELECTOR = "[data-cb-editing-banner-update]";
export const CB_EDITING_BANNER_CANCEL_SELECTOR = "[data-cb-editing-banner-cancel]";
export const CB_EDITING_BANNER_STATUS_SELECTOR = "[data-cb-editing-banner-status]";

/** Syncs body class + saved-project panel when editing mode toggles. */
export function syncEditingSavedPatternChrome(root: ParentNode = document): void {
  if (typeof document === "undefined") return;
  const editing = isEditingSavedCustomPatternProject();
  document.documentElement.classList.toggle("kbm-editing-saved-pattern", editing);
  syncPatternWorkspaceExpressTabLabel(root);
  syncCustomBuildFoundationPageHeader(root);
  syncCustomBuildCustomizeAccessChrome(root);
  root.querySelectorAll("[data-cb-saved-projects]").forEach((el) => {
    if (el instanceof HTMLElement) refreshCustomPatternSavedProjectsPanelUi(el);
  });
}

export function dispatchCustomPatternEditingStateChanged(): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent(CUSTOM_PATTERN_EDITING_STATE_CHANGED_EVENT));
  syncEditingSavedPatternChrome(document);
}

/** Resolves the name used when updating the active saved project from the current page. */
export function resolveProjectNameForEditingBannerUpdate(root: ParentNode = document): string {
  const reviewTitle = root.querySelector<HTMLInputElement>("[data-sleeveless-pattern-project-title]");
  const fromReview = reviewTitle?.value?.trim() ?? "";
  if (fromReview) return fromReview;

  const panelName = root.querySelector<HTMLInputElement>("[data-cb-project-name]");
  const fromPanel = panelName?.value?.trim() ?? "";
  if (fromPanel) return fromPanel;

  return getPatternProjectMeta().title.trim();
}

export type UpdateActiveSavedCustomPatternResult =
  | { ok: true; projectName: string }
  | { ok: false; error: string };

/** Overwrites the active saved Blob project from the working draft. */
export async function runUpdateActiveSavedCustomPattern(
  root?: ParentNode,
  options?: {
    onStatus?: (message: string, isError?: boolean) => void;
  },
): Promise<UpdateActiveSavedCustomPatternResult> {
  if (!readActiveCustomPatternProjectId()) {
    const error = "Open a saved project before updating.";
    options?.onStatus?.(error, true);
    return { ok: false, error };
  }

  const scope =
    root ?? (typeof document !== "undefined" ? document : undefined);
  const measureRoot = resolveCustomBuildSaveMeasureFlushRoot(scope);
  const name = scope
    ? resolveProjectNameForEditingBannerUpdate(scope)
    : getPatternProjectMeta().title.trim();
  if (!name) {
    const error = "Enter a pattern name before updating.";
    options?.onStatus?.(error, true);
    return { ok: false, error };
  }

  prepareCustomBuildPatternGeneration({
    root: measureRoot,
    rehydrateSavedProject: false,
  });

  const res = await smartSaveCustomPatternProject({
    mode: "update",
    resolveName: () => name,
    onStatus: options?.onStatus,
    root: measureRoot,
  });

  if (!res.ok) {
    return { ok: false, error: res.error };
  }

  dispatchCustomPatternEditingStateChanged();
  return { ok: true, projectName: res.project.name };
}

/**
 * Leaves saved-pattern editing mode without deleting the saved project.
 * Clears active-project keys only; working draft stays in localStorage.
 */
export function exitEditingSavedCustomPattern(): void {
  clearActiveCustomPatternProjectId();
  clearSavedCustomPatternDirtyBaseline();
  dispatchCustomPatternEditingStateChanged();
}
