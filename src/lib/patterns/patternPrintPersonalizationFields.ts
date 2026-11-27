/**
 * Resolves print/PDF title + notes for the shared PatternPrintPersonalization slots.
 *
 * Sweater pages (sleeveless / drop shoulder) use `kbm_current_pattern.patternProject`.
 * The finished Hat Pattern page shares the same print component but must not read
 * that sweater store — hats live in `kbm_hat_draft`.
 * The finished Socks Pattern page likewise must not read the sweater store —
 * socks live in `kbm_socks_draft`.
 * The finished Mitten Pattern page uses `kbm_mitten_draft`.
 */

import {
  resolveHatPatternPrintFields,
  type HatPatternPrintFields,
} from "./hat/hatPatternPrintTitle";
import { resolveSockPatternPrintFields } from "./sock/sockPatternPrintTitle";
import { resolveSockPatternPrintFields as resolveChristmasStockingPatternPrintFields } from "./christmasStocking/sockPatternPrintTitle";
import { resolveTriangleScarfPatternPrintFields } from "./triangleScarf/triangleScarfPatternPrintTitle";
import { resolveMittenPatternPrintFields } from "./mitten/mittenPatternPrint";

export type PatternPrintPersonalizationFields = HatPatternPrintFields;

export function isHatPatternPrintPage(
  root: { querySelector: (selectors: string) => unknown } | null | undefined,
): boolean {
  return Boolean(root?.querySelector("[data-hat-pattern-page]"));
}

export function isSockPatternPrintPage(
  root: { querySelector: (selectors: string) => unknown } | null | undefined,
): boolean {
  return Boolean(root?.querySelector("[data-socks-pattern-page]"));
}

export function isChristmasStockingPatternPrintPage(
  root: { querySelector: (selectors: string) => unknown } | null | undefined,
): boolean {
  return Boolean(root?.querySelector("[data-christmas-stocking-pattern-page]"));
}

export function isTriangleScarfPatternPrintPage(
  root: { querySelector: (selectors: string) => unknown } | null | undefined,
): boolean {
  return Boolean(root?.querySelector("[data-triangle-scarf-pattern-page]"));
}

export function isMittenPatternPrintPage(
  root: { querySelector: (selectors: string) => unknown } | null | undefined,
): boolean {
  return Boolean(root?.querySelector("[data-mitten-pattern]"));
}

/**
 * Pattern-type-aware print fields. Hat and Socks pages always use their own
 * draft title; sweater pages keep the sleeveless/drop-shoulder project name unchanged.
 */
export function resolvePatternPrintPersonalizationFields(input: {
  isHatPatternPage: boolean;
  isSockPatternPage?: boolean;
  isChristmasStockingPatternPage?: boolean;
  isTriangleScarfPatternPage?: boolean;
  isMittenPatternPage?: boolean;
  sleevelessFields: PatternPrintPersonalizationFields;
}): PatternPrintPersonalizationFields {
  if (input.isHatPatternPage) {
    return resolveHatPatternPrintFields();
  }
  if (input.isTriangleScarfPatternPage) {
    return resolveTriangleScarfPatternPrintFields();
  }
  if (input.isChristmasStockingPatternPage) {
    return resolveChristmasStockingPatternPrintFields();
  }
  if (input.isSockPatternPage) {
    return resolveSockPatternPrintFields();
  }
  if (input.isMittenPatternPage) {
    return resolveMittenPatternPrintFields();
  }
  return {
    title: input.sleevelessFields.title,
    notes: input.sleevelessFields.notes,
  };
}
