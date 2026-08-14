/**
 * Print/PDF heading for the finished Hat Pattern page.
 *
 * Hats use `kbm_hat_draft`, not the sleeveless/sweater working draft
 * (`kbm_current_pattern.patternProject`). The shared print personalization
 * component must not inherit sweater titles such as "Women's Sleeveless".
 */

export const HAT_PATTERN_PRINT_TITLE = "Hat Pattern";

export type HatPatternPrintFields = {
  title: string;
  notes: string;
};

/** Canonical print/PDF fields for a generated hat pattern. */
export function resolveHatPatternPrintFields(): HatPatternPrintFields {
  return { title: HAT_PATTERN_PRINT_TITLE, notes: "" };
}
