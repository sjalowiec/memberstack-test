/**
 * Keeps the builder Fit cards' ease subtext (`Approx. +3" ease`) in sync with the active
 * measurement-unit toggle. The cards are server-rendered in inches; this rewrites each ease chip
 * to inches or centimeters using the shared {@link formatFitEaseApproxLabel} copy, so a single
 * unit source drives both the diagram/gauge and the Fit descriptions.
 *
 * The DOM surface is intentionally minimal (querySelectorAll + getAttribute + textContent) so the
 * behavior can be exercised with a lightweight fake in tests that run without jsdom.
 */
import {
  formatFitEaseApproxLabel,
  type FitEaseChoice,
  type FitEaseDisplayUnit,
} from "./fitEaseInches";

/** Attribute stamped on each Fit card ease chip; value is the fit choice (close/standard/relaxed). */
export const FIT_EASE_LABEL_ATTR = "data-sg-fit-ease";

interface FitEaseLabelElement {
  getAttribute(name: string): string | null;
  textContent: string | null;
}

interface FitEaseLabelRoot {
  querySelectorAll(selector: string): ArrayLike<FitEaseLabelElement>;
}

function isFitEaseChoice(value: string | null): value is FitEaseChoice {
  return value === "close" || value === "standard" || value === "relaxed";
}

/**
 * Rewrites every `[data-sg-fit-ease]` chip within `root` to the ease copy for `unit`.
 * Returns the number of chips updated (useful for assertions / diagnostics).
 */
export function applyFitEaseUnitLabels(root: FitEaseLabelRoot, unit: FitEaseDisplayUnit): number {
  const nodes = root.querySelectorAll(`[${FIT_EASE_LABEL_ATTR}]`);
  let updated = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    const el = nodes[i];
    const choice = el.getAttribute(FIT_EASE_LABEL_ATTR);
    if (!isFitEaseChoice(choice)) continue;
    el.textContent = formatFitEaseApproxLabel(choice, unit);
    updated += 1;
  }
  return updated;
}
