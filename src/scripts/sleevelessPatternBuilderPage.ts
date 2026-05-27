import { applySleevelessPatternOnlineProjectHeader } from "./sleevelessPatternOnlineProjectHeader.ts";
import { initSleevelessPatternBuilderPage } from "./sleevelessPatternPageShared.ts";

function boot(): void {
  applySleevelessPatternOnlineProjectHeader();
  void initSleevelessPatternBuilderPage();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
