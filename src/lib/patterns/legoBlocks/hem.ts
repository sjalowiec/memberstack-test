/**
 * Shared HEM lego block - the single source of truth for the pattern-output HEM section
 * heading and its Hem glossary tooltip/link.
 *
 * Reused by both the sleeveless and drop-shoulder pattern generators. Pattern-specific
 * values and instructions (cast-on stitch count, hem depth, row/RC counts, carriage
 * direction, machine setup, body shaping, and every calculation output) stay in the
 * pattern generators - this block only owns the reusable, glossary-linked HEM heading.
 */
import { buildGlossaryTooltipPlaceholderHtml } from "../../glossary/glossaryTooltipPrint";
import type { SleevelessPatternDisplayRow } from "../sleevelessPatternOutput";

/**
 * Glossary entry id for "Hem" (see `src/data/glossary.json`). One entry intentionally covers
 * every hem treatment (1x1/2x2 ribbing, mock ribbing, rolled stockinette, fold-up band, hung
 * hems), so the glossary tooltip on the heading is the only help this section needs.
 */
export const HEM_GLOSSARY_ID = 1783693868473;

/** Plain-text HEM section title (used for the section slug/id and plain-text lines). */
export const HEM_SECTION_TITLE = "HEM";

function glossaryPlaceholderAttrEscape(s: string): string {
  return String(s).replace(/"/g, "&quot;");
}

/**
 * Trusted heading HTML for the HEM section: the whole "HEM" heading is the Hem glossary
 * trigger (visible text "HEM", glossary term "Hem"). Uses the project's standard glossary
 * placeholder markup - the same span other glossary-enabled pattern text uses.
 */
export function hemSectionHeadingHtml(): string {
  return buildGlossaryTooltipPlaceholderHtml(
    HEM_GLOSSARY_ID,
    HEM_SECTION_TITLE,
    glossaryPlaceholderAttrEscape,
    (s) => s,
  );
}

/**
 * HEM section display row. `title` stays the plain "HEM" text (drives the section slug/id and
 * plain-text output); `titleHtml` carries the glossary-linked heading for the rendered pattern.
 */
export function hemSectionRow(): Extract<SleevelessPatternDisplayRow, { kind: "section" }> {
  return { kind: "section", title: HEM_SECTION_TITLE, titleHtml: hemSectionHeadingHtml() };
}
