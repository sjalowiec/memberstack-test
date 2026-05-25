/**
 * Custom Build — save/load saved projects (Netlify Blobs).
 * Working draft stays in localStorage (`kbm_current_pattern`); this UI writes/reads Blob-backed projects.
 */
import { initCustomPatternSavedProjectsPanel } from "../lib/patterns/customPatternSavedProjectsPanel";

function initCustomBuildSavedProjects(): void {
  const root = document.querySelector("[data-cb-saved-projects]");
  if (!(root instanceof HTMLElement)) return;
  initCustomPatternSavedProjectsPanel(root);
}

if (typeof document !== "undefined") {
  const boot = (): void => initCustomBuildSavedProjects();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
