/** Glossary entry for traditional stitches–rows–times diagram notation. */
export const JAPANESE_NOTATION_TRADITIONAL_GLOSSARY_ID = 1779400000001;

/** Glossary entry for Knit It Now shaping notation charts (row-by-row wording). */
export const SHAPING_NOTATION_KIN_GLOSSARY_ID = 1779400000002;

/**
 * Subtle help line above inline shaping notation diagrams.
 * Hydrate `.glossary-tooltip-placeholder` after mount (and when the help line is shown).
 */
export function buildShapingNotationChartHelpHtml(
  escapeAttr: (s: string) => string,
  escapeText: (s: string) => string,
): string {
  const term = "Shaping Notation";
  const placeholder = `<span class="glossary-tooltip-placeholder" data-glossary-id="${SHAPING_NOTATION_KIN_GLOSSARY_ID}" data-term="${escapeAttr(term)}">${escapeText(term)}</span>`;
  return `<p class="sleeveless-shaping-notation-help no-print" data-sleeveless-shaping-notation-help hidden>Need help reading this chart? Learn about ${placeholder}.</p>`;
}
