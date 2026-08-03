/**
 * Single source of truth for sweater fit ease (inches added to chart bust/chest).
 * Used by chart measurement derivation, edit-drawer recalc, and UI copy.
 */
export const FIT_EASE_INCHES_BY_CHOICE = {
  close: 1,
  standard: 3,
  relaxed: 5,
} as const;

/**
 * Approximate centimeter ease shown on the Fit cards when centimeters are the active display
 * unit. These are the rounded "nice" cm figures knitters expect (2.5 / 7.5 / 12.5 cm), NOT a raw
 * 2.54× conversion of the inch ease. They are presentational only — the pattern math always uses
 * {@link FIT_EASE_INCHES_BY_CHOICE}, so switching units never changes the generated garment.
 */
export const FIT_EASE_CM_BY_CHOICE = {
  close: 2.5,
  standard: 7.5,
  relaxed: 12.5,
} as const;

export type FitEaseChoice = keyof typeof FIT_EASE_INCHES_BY_CHOICE;

/** Display unit for the Fit card ease copy — mirrors the builder measurement unit. */
export type FitEaseDisplayUnit = "in" | "cm";

const DEFAULT_FIT_EASE_CHOICE: FitEaseChoice = "standard";

const INCH_MARK = "\u2033";

/** Ease inches for a fit choice; unknown values fall back to standard (+3"). */
export function fitEaseInchesForChoice(fitPreference: string): number {
  const key = fitPreference as FitEaseChoice;
  const ease = FIT_EASE_INCHES_BY_CHOICE[key];
  return typeof ease === "number" ? ease : FIT_EASE_INCHES_BY_CHOICE[DEFAULT_FIT_EASE_CHOICE];
}

/**
 * Builder card subtext, e.g. `Approx. +5" ease` (inches) or `Approx. +12.5 cm ease` (centimeters).
 * The unit follows the builder's active measurement-unit toggle; defaults to inches so server
 * rendering and inch-only callers are unchanged.
 */
export function formatFitEaseApproxLabel(
  fitPreference: FitEaseChoice,
  unit: FitEaseDisplayUnit = "in",
): string {
  if (unit === "cm") {
    return `Approx. +${FIT_EASE_CM_BY_CHOICE[fitPreference]} cm ease`;
  }
  return `Approx. +${FIT_EASE_INCHES_BY_CHOICE[fitPreference]}${INCH_MARK} ease`;
}

/** Fit-help prose, e.g. `About 5" of ease.` */
export function formatFitEaseAboutProse(fitPreference: FitEaseChoice): string {
  return `About ${FIT_EASE_INCHES_BY_CHOICE[fitPreference]}${INCH_MARK} of ease.`;
}

/** Edit-drawer readout, e.g. `Relaxed fit · about +5" ease (applied to the chart measurements).` */
export function formatFitEaseEditDrawerLine(fitPreference: string): string {
  const fit = (fitPreference || DEFAULT_FIT_EASE_CHOICE) as FitEaseChoice;
  const ease = fitEaseInchesForChoice(fit);
  const label = fit.charAt(0).toUpperCase() + fit.slice(1);
  return `${label} fit \u00b7 about +${ease}${INCH_MARK} ease (applied to the chart measurements).`;
}
