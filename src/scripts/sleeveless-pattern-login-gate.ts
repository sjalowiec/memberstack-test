import { initSleevelessPatternMemberGate } from "../lib/patterns/sleevelessPatternLoginGate";

function bootSleevelessPatternLoginGate(): void {
  const root = document.querySelector("[data-sleeveless-pattern-gate]");
  if (!(root instanceof HTMLElement)) return;
  void initSleevelessPatternMemberGate(root);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootSleevelessPatternLoginGate);
  } else {
    bootSleevelessPatternLoginGate();
  }
}
