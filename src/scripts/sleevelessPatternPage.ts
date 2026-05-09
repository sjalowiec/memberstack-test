import { initSleevelessPatternBuilderPage } from "./sleevelessPatternPageShared.ts";
import { exportSleevelessGoldenBetaSnapshotJson } from "../lib/patterns/patternStorage.ts";

declare global {
  interface Window {
    kbmExportSleevelessGoldenBetaSnapshot?: () => string;
  }
}

function boot(): void {
  void initSleevelessPatternBuilderPage();

  if (import.meta.env?.DEV) {
    window.kbmExportSleevelessGoldenBetaSnapshot = function kbmExportSleevelessGoldenBetaSnapshot() {
      const json = exportSleevelessGoldenBetaSnapshotJson();
      console.log("[kbm] Golden beta snapshot JSON — save as sleevelessGoldenBeta.json:\n", json);
      try {
        void navigator.clipboard?.writeText?.(json).then(() => {
          console.log("[kbm] Golden beta snapshot copied to clipboard.");
        });
      } catch {
        /* ignore */
      }
      return json;
    };
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
