/**
 * Unified review — save/update saved projects (no load UI; use /account to open).
 */
import { initCustomPatternSavedProjectsPanel } from "../lib/patterns/customPatternSavedProjectsPanel";

function initReviewSavedProjects(): void {
  const root = document.querySelector("[data-cb-saved-projects]");
  if (!(root instanceof HTMLElement)) return;
  initCustomPatternSavedProjectsPanel(root, { showLoadControls: false });
}

if (typeof document !== "undefined") {
  const boot = (): void => initReviewSavedProjects();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
