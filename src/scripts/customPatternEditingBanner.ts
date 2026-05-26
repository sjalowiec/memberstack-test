import { initCustomPatternEditingBanner } from "../lib/patterns/customPatternEditingBanner";

function boot(): void {
  initCustomPatternEditingBanner();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}

