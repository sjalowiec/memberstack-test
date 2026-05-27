/**
 * Sleeveless workspace Create tab label: “Create” vs “Edit” when a saved project is active.
 */
import { CUSTOM_PATTERN_EDITING_STATE_CHANGED_EVENT } from "./customPatternEditingBannerActions";
import { isEditingSavedCustomPatternProject } from "./customPatternEditingUx";

export const PATTERN_WORKSPACE_EXPRESS_TAB_SELECTOR = "[data-pattern-workspace-express-tab]";
export const PATTERN_WORKSPACE_EXPRESS_TAB_LABEL_SELECTOR =
  "[data-pattern-workspace-express-tab-label]";

export const PATTERN_WORKSPACE_EXPRESS_TAB_LABEL_CREATE = "Create";
export const PATTERN_WORKSPACE_EXPRESS_TAB_LABEL_EDIT = "Edit";

export function resolvePatternWorkspaceExpressTabLabel(): string {
  return isEditingSavedCustomPatternProject()
    ? PATTERN_WORKSPACE_EXPRESS_TAB_LABEL_EDIT
    : PATTERN_WORKSPACE_EXPRESS_TAB_LABEL_CREATE;
}

/** Updates visible label, aria-label, and title on workspace express (Create) tabs. */
export function syncPatternWorkspaceExpressTabLabel(root: ParentNode = document): void {
  const label = resolvePatternWorkspaceExpressTabLabel();
  root.querySelectorAll(PATTERN_WORKSPACE_EXPRESS_TAB_SELECTOR).forEach((tab) => {
    if (!(tab instanceof Element)) return;
    tab.setAttribute("aria-label", label);
    tab.setAttribute("title", label);
    const visible = tab.querySelector(PATTERN_WORKSPACE_EXPRESS_TAB_LABEL_SELECTOR);
    if (visible) visible.textContent = label;
  });
}

let expressTabLabelInitBound = false;

/** Run once on pages with pattern workspace tabs (library drawer bundle). */
export function initPatternWorkspaceExpressTabLabel(doc: Document = document): void {
  syncPatternWorkspaceExpressTabLabel(doc);

  if (expressTabLabelInitBound) return;
  expressTabLabelInitBound = true;

  const sync = (): void => syncPatternWorkspaceExpressTabLabel(doc);

  doc.addEventListener(CUSTOM_PATTERN_EDITING_STATE_CHANGED_EVENT, sync);

  window.addEventListener("storage", (ev: StorageEvent) => {
    if (!ev.key) return;
    if (ev.key.startsWith("kbm_custom_pattern_active_project_")) {
      sync();
    }
  });
}
