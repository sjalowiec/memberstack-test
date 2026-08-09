/**
 * Finished hat pattern “New Pattern” — clear local hat draft, then open the hat builder
 * with `?new=1` (same clear-on-arrival pattern as sweater New Pattern).
 */
import { startNewHatPatternFromFinishedPage } from "./hatFreshStart";

export function initHatPatternNewPattern(doc: Document = document): void {
  const trigger = doc.querySelector("[data-hat-pattern-new-pattern-trigger]");
  if (!(trigger instanceof HTMLButtonElement)) return;
  if (trigger.dataset.hatNewPatternBound === "true") return;
  trigger.dataset.hatNewPatternBound = "true";

  let busy = false;
  trigger.addEventListener("click", () => {
    if (busy) return;
    busy = true;
    try {
      startNewHatPatternFromFinishedPage();
    } finally {
      busy = false;
    }
  });
}
