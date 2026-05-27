/**
 * Workspace Create tab — always starts a brand-new Express pattern session
 * (same reset as “New Pattern”, including unsaved-changes prompt when editing a saved project).
 */
import { startNewCustomPatternFromWorkspace } from "./startNewCustomPatternWorkflow";
import { PATTERN_WORKSPACE_EXPRESS_TAB_SELECTOR } from "./patternWorkspaceExpressTabLabel";

const CREATE_TAB_BOUND_ATTR = "data-pattern-workspace-create-tab-bound";

export function initPatternWorkspaceCreateTab(doc: Document = document): void {
  doc.querySelectorAll(PATTERN_WORKSPACE_EXPRESS_TAB_SELECTOR).forEach((el) => {
    if (!(el instanceof HTMLAnchorElement)) return;
    if (el.getAttribute(CREATE_TAB_BOUND_ATTR) === "1") return;
    el.setAttribute(CREATE_TAB_BOUND_ATTR, "1");

    let busy = false;
    el.addEventListener("click", (event) => {
      event.preventDefault();
      if (busy) return;
      busy = true;
      void startNewCustomPatternFromWorkspace(doc).finally(() => {
        busy = false;
      });
    });
  });
}

/** Same session reset as a Create tab click (skips unsaved dialog and navigation). */
export { applyStartNewCustomPatternSession as resetSessionForPatternWorkspaceCreateTab } from "./startNewCustomPatternWorkflow";
