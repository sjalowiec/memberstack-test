import { initSleevelessBetaPatternPage } from "./sleevelessPatternPageShared.ts";

function boot(): void {
  void initSleevelessBetaPatternPage();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
