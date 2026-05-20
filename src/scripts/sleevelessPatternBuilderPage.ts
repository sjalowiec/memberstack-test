import { getPatternData } from "../lib/patterns/patternStorage.ts";
import { logCustomBuildGarmentHandoff } from "../lib/patterns/customBuildGarmentHandoffDebug";
import { syncCustomBuildToPatternStorage } from "../lib/patterns/syncCustomBuildToPatternStorage.ts";
import { applySleevelessPatternOnlineProjectHeader } from "./sleevelessPatternOnlineProjectHeader.ts";
import { initSleevelessPatternBuilderPage } from "./sleevelessPatternPageShared.ts";

function boot(): void {
  const data = getPatternData();
  const style = data.style as Record<string, unknown> | undefined;
  if (style?.patternMode === "custom-build") {
    syncCustomBuildToPatternStorage({ awaitCharts: false });
    logCustomBuildGarmentHandoff("pattern builder page boot (after sync)");
  }
  applySleevelessPatternOnlineProjectHeader();
  void initSleevelessPatternBuilderPage();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
