/**
 * Custom Build — Yarn & Gauge hub step: continues to classic yarn/gauge form.
 */
import { syncCustomBuildToPatternStorage } from "../lib/patterns/syncCustomBuildToPatternStorage";

function initCustomBuildYarnGaugePage(): void {
  document.querySelector("[data-cb-yarn-continue]")?.addEventListener("click", () => {
    syncCustomBuildToPatternStorage({ awaitCharts: false });
  });
}

if (typeof document !== "undefined") {
  const boot = (): void => initCustomBuildYarnGaugePage();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
