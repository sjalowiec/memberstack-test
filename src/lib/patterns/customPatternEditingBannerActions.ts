/**
 * Update / exit actions for the Custom Build “Editing saved pattern” banner.
 */
import { clearActiveCustomPatternProjectId, readActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { clearSavedCustomPatternDirtyBaseline } from "./customPatternSavedProjectDirtyState";
import { isEditingSavedCustomPatternProject } from "./customPatternEditingUx";
import { prepareCustomBuildPatternGeneration } from "./prepareCustomBuildPatternGeneration";
import { resolveCustomBuildSaveMeasureFlushRoot } from "./sleevelessCustomMeasurementStorage";
import { logSavedPatternUpdateFlowDiagnostics } from "./customPatternProjectClient";
import { smartSaveCustomPatternProject } from "./customPatternSavedProjectsPanel";
import { refreshCustomPatternSavedProjectsPanelUi } from "./customPatternSavedProjectsPanel";
import { syncCustomBuildCustomizeAccessChrome } from "./customBuildCustomizeAccess";
import { syncCustomBuildFoundationPageHeader } from "./customBuildFoundationPageEditingUx";
import { syncPatternWorkspaceExpressTabLabel } from "./patternWorkspaceExpressTabLabel";
import { getPatternProjectMeta } from "./sleevelessPatternProjectMeta";
import { CUSTOM_PATTERN_EDITING_STATE_CHANGED_EVENT } from "./customPatternEditingEvents";

export { CUSTOM_PATTERN_EDITING_STATE_CHANGED_EVENT };

export const CB_EDITING_BANNER_UPDATE_SELECTOR = "[data-cb-editing-banner-update]";
export const CB_EDITING_BANNER_COPY_SELECTOR = "[data-cb-editing-banner-copy]";
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
    /** Pin the saved project id for this update (set when opening / starting edit). */
    activeProjectId?: string;
    /** When true, caller already flushed diagram inputs and synced storage (Edit Pattern apply). */
    skipPreSavePrepare?: boolean;
  },
): Promise<UpdateActiveSavedCustomPatternResult> {
  const pinnedActiveId = options?.activeProjectId?.trim() || readActiveCustomPatternProjectId();
  logSavedPatternUpdateFlowDiagnostics("run-update-start", {
    pinnedSavedProjectId: pinnedActiveId,
    skipPreSavePrepare: options?.skipPreSavePrepare === true,
  });

  if (!pinnedActiveId) {
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

  if (!options?.skipPreSavePrepare) {
    prepareCustomBuildPatternGeneration({
      root: measureRoot,
      rehydrateSavedProject: false,
    });
  }

  logSavedPatternUpdateFlowDiagnostics("run-update-before-smart-save", {
    pinnedSavedProjectId: pinnedActiveId,
  });

  const res = await smartSaveCustomPatternProject({
    mode: "update",
    activeProjectId: pinnedActiveId,
    resolveName: () => name,
    onStatus: options?.onStatus,
    root: measureRoot,
  });

  if (!res.ok) {
    return { ok: false, error: res.error };
  }

  logSavedPatternUpdateFlowDiagnostics("run-update-after-smart-save", {
    pinnedSavedProjectId: pinnedActiveId,
    returnedSavedProjectId: res.project.id,
  });

  dispatchCustomPatternEditingStateChanged();
  return { ok: true, projectName: res.project.name };
}

export type CopyActiveSavedCustomPatternResult =
  | { ok: true; projectName: string }
  | { ok: false; error: string };

/**
 * Saves the current working draft as a NEW saved project ("Save a Copy"), preserving
 * the original's sizing chart (handled by the copy path). The new copy becomes the
 * active/open project; the original saved project is left unchanged.
 */
export async function runCopyActiveSavedCustomPattern(
  root?: ParentNode,
  options?: {
    onStatus?: (message: string, isError?: boolean) => void;
  },
): Promise<CopyActiveSavedCustomPatternResult> {
  if (!readActiveCustomPatternProjectId()) {
    const error = "Open a saved project before saving a copy.";
    options?.onStatus?.(error, true);
    return { ok: false, error };
  }

  const scope = root ?? (typeof document !== "undefined" ? document : undefined);
  const measureRoot = resolveCustomBuildSaveMeasureFlushRoot(scope);
  const name = scope
    ? resolveProjectNameForEditingBannerUpdate(scope)
    : getPatternProjectMeta().title.trim();
  if (!name) {
    const error = "Enter a pattern name before saving a copy.";
    options?.onStatus?.(error, true);
    return { ok: false, error };
  }

  prepareCustomBuildPatternGeneration({
    root: measureRoot,
    rehydrateSavedProject: false,
  });

  const res = await smartSaveCustomPatternProject({
    mode: "copy",
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
