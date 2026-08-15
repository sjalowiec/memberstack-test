/**
 * Resolves print/PDF title + notes for the shared PatternPrintPersonalization slots.
 *
 * Sweater pages (sleeveless / drop shoulder) use `kbm_current_pattern.patternProject`.
 * The finished Hat Pattern page shares the same print component but must not read
 * that sweater store — hats live in `kbm_hat_draft`.
 */

import {
  resolveHatPatternPrintFields,
  type HatPatternPrintFields,
} from "./hat/hatPatternPrintTitle";

export type PatternPrintPersonalizationFields = HatPatternPrintFields;

export function isHatPatternPrintPage(
  root: { querySelector: (selectors: string) => unknown } | null | undefined,
): boolean {
  return Boolean(root?.querySelector("[data-hat-pattern-page]"));
}

/**
 * Pattern-type-aware print fields. Hat pages always use the hat title;
 * sweater pages keep the sleeveless/drop-shoulder project name unchanged.
 */
export function resolvePatternPrintPersonalizationFields(input: {
  isHatPatternPage: boolean;
  sleevelessFields: PatternPrintPersonalizationFields;
}): PatternPrintPersonalizationFields {
  if (input.isHatPatternPage) {
    return resolveHatPatternPrintFields();
  }
  return {
    title: input.sleevelessFields.title,
    notes: input.sleevelessFields.notes,
  };
}
