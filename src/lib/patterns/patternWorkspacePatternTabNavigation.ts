/**
 * Workspace “My Pattern” tab — flush pending Customize measurements before navigation.
 */
import { prepareCustomBuildPatternGeneration } from "./prepareCustomBuildPatternGeneration";
import { hasUnsavedCustomPatternChanges } from "./customPatternSavedProjectDirtyState";
import { navigateToPatternWithUnsavedEditsGuard } from "./savedCustomPatternUnsavedViewGuard";
export function wirePatternWorkspacePatternTabPreGeneration(doc: Document = document): void {
  doc.querySelectorAll('.pattern-workspace-tabs a[data-tab="pattern"]').forEach((el) => {
    if (!(el instanceof HTMLAnchorElement)) return;
    const href = el.href;
    if (!href) return;

    el.addEventListener("click", (ev) => {
      if (!doc.querySelector("[data-cb-measure-root]")) return;
      prepareCustomBuildPatternGeneration({ root: doc });
      if (!hasUnsavedCustomPatternChanges()) return;
      ev.preventDefault();
      void navigateToPatternWithUnsavedEditsGuard({ href, root: doc });
    });
  });
}
