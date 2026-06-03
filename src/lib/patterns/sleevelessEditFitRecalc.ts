/**
 * Edit Pattern Workspace — live recalculation of the fit-derived finished measurements when the
 * user changes the Fit control.
 *
 * Fit ease (`close` +1″, `standard` +3″, `relaxed` +5″) is applied to the body chart row to derive
 * the FINISHED bust/chest and hip. The measurement diagram stores those as `cbMeasurementOverrides`
 * (chestBust / hip), and {@link resolveEffectiveFinishedBustInches} prefers the override over the
 * chart `selectedMeasurements`. So when the user changes fit in the editor, the stored override
 * must be refreshed from the chart row + new ease — otherwise the pattern keeps the value captured
 * at the fit it was originally built with (e.g. Close 22″ never moves to Standard 24″).
 *
 * Only the ease-derived diagram fields (chestBust, hip) are recomputed here. The other diagram
 * fields (shoulder, armhole, neck opening/depth, length, hem) are not affected by fit ease, so any
 * user customisation of those is preserved untouched.
 */
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import { formatSwatchCountForGaugeInput } from "./gaugeDisplayFormat";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

/** Diagram override keys whose finished value is derived from body chart + fit ease. */
export const FIT_DERIVED_OVERRIDE_KEYS = ["chestBust", "hip"] as const;

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

export type FitDerivedOverrideOptions = {
  /** "straight" (hip follows bust) or "aline" (hip gets its own eased value). Default straight. */
  bodyShape?: string;
  /** Current override map to merge onto, so non-ease fields are preserved. */
  existingOverrides?: Record<string, string>;
};

/**
 * Returns the override map with the fit-derived finished bust/chest and hip recomputed from the
 * chart row and selected fit, merged over any existing (non-ease) overrides.
 */
export function computeFitDerivedMeasurementOverrides(
  row: ChartRow,
  fitPreference: string,
  options: FitDerivedOverrideOptions = {},
): Record<string, string> {
  const next: Record<string, string> = { ...(options.existingOverrides ?? {}) };
  const computed = computeDefaultMeasurementsFromChartRow(row, fitPreference, {
    bodyShape: options.bodyShape,
  });

  const chest = computed.finished_bust_chest;
  if (Number.isFinite(chest) && chest > 0) {
    next.chestBust = formatSwatchCountForGaugeInput(roundQuarter(chest));
  }

  const hip = computed.finished_hip;
  if (Number.isFinite(hip) && hip > 0) {
    next.hip = formatSwatchCountForGaugeInput(roundQuarter(hip));
  }

  return next;
}
