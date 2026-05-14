/** Standalone Ask/Share route: load Hyvor for `PatternComments` (same loader as pattern tab switch). */
import { loadPatternComments } from "../lib/patterns/patternTabsClient";

function boot(): void {
  loadPatternComments();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
