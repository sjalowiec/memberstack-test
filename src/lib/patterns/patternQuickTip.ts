/**
 * Reusable Quick Tip markup for pattern help (trusted HTML only — never user input).
 * Lightweight contextual help: not a glossary tooltip, not a Help Card.
 * Pair with `pattern-quick-tip.css` and {@link patternTipWrapperHtml} (`tipPresentation: "quick-tip"`).
 */

export type PatternQuickTipOptions = {
  /** Collapsed row label (plain text). */
  summaryLabel: string;
  /** Trusted HTML inside the expanded body (e.g. paragraphs with glossary placeholders). */
  bodyHtml: string;
};

/** Inner `<details>` markup; wrapped by `.pattern-tip.pattern-quick-tip` in the pattern renderer. */
export function buildPatternQuickTipInnerHtml(options: PatternQuickTipOptions): string {
  const label = String(options.summaryLabel ?? "").trim();
  const body = String(options.bodyHtml ?? "").trim();
  return (
    '<details class="pattern-quick-tip__details">' +
    '<summary class="pattern-quick-tip__summary">' +
    '<span class="pattern-quick-tip__chevron" aria-hidden="true">' +
    '<i class="fa-solid fa-chevron-right"></i></span>' +
    '<span class="pattern-quick-tip__summary-inner">' +
    '<i class="fa-solid fa-lightbulb pattern-quick-tip__icon" aria-hidden="true"></i>' +
    `<span class="pattern-quick-tip__label">${label}</span>` +
    "</span></summary>" +
    `<div class="pattern-quick-tip__body">${body}</div>` +
    "</details>"
  );
}
