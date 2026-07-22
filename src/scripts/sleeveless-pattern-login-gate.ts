import { initPatternMembershipPageGate } from "../lib/patterns/patternMembershipPageGate";

function bootPatternMembershipPageGate(): void {
  const root = document.querySelector("[data-sleeveless-pattern-gate]");
  if (!(root instanceof HTMLElement)) return;
  void initPatternMembershipPageGate(root);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootPatternMembershipPageGate);
  } else {
    bootPatternMembershipPageGate();
  }
}
