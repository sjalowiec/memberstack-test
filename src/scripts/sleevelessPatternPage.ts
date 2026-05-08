import { initSleevelessPatternBuilderPage } from "./sleevelessPatternPageShared.ts";

function boot(): void {
  void initSleevelessPatternBuilderPage();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
