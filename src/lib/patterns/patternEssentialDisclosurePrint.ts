/**
 * Shared print class for essential pattern instruction disclosures (row-by-row
 * shaping checklists). Native closed `<details>` hide their body in print via
 * `::details-content { content-visibility: hidden }`, so screen collapse must
 * not omit these instructions from PDF output.
 *
 * Do not add this class to optional help cards, quick tips, glossary popups,
 * videos, or other supplemental overlays.
 */
export const PATTERN_PRINT_ESSENTIAL_DISCLOSURE_CLASS = "pattern-print-essential-disclosure";
