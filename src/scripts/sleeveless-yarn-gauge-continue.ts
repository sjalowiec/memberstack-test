/**
 * Classic Yarn & Gauge page — sync Custom Build state before opening the pattern tab.
 */
import { syncCustomBuildToPatternStorage } from "../lib/patterns/syncCustomBuildToPatternStorage";

export function wireYarnGaugePatternContinue(): void {
  syncCustomBuildToPatternStorage({ awaitCharts: false });

  document.querySelector("[data-sg-yarn-continue-pattern]")?.addEventListener("click", () => {
    syncCustomBuildToPatternStorage({ awaitCharts: false });
  });
}

if (typeof document !== "undefined") {
  const boot = (): void => wireYarnGaugePatternContinue();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
