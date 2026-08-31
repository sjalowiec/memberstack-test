/**
 * Row Counter Reset — a required knitting action marker (NOT a pattern tip).
 *
 * Renders a visually distinct block that stops the knitter to reset their row
 * counter before continuing. Styled by `.row-counter-reset` rules in
 * `sleeveless-pattern-shared.css` (screen) and `sleeveless-print-route.css` (print).
 *
 * Not collapsible, not dismissible, and intentionally unlike `.pattern-tip`.
 */

/** Exact required wording for the reset marker. */
export const RESET_ROW_COUNTER_TEXT = "RESET ROW COUNTER TO 000";

/** Exact required wording for the stop-counter marker (same visual as reset). */
export const STOP_ROW_COUNTER_TEXT = "STOP ROW COUNTER";

/** Garment RC label shown above the reset marker (`RC: 000`). */
export function formatRowCounterResetGarmentRcLabel(garmentRc: number): string {
  const n = Math.max(0, Math.floor(garmentRc));
  return `RC: ${String(n).padStart(3, "0")}`;
}

/** Inline reset/refresh glyph (currentColor stroke so it prints with the accent text). */
const ROW_COUNTER_RESET_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">' +
  '<path d="M3 12a9 9 0 1 0 2.7-6.4L3 8"></path><path d="M3 3v5h5"></path></svg>';

/** Pause glyph in the same icon slot as the reset marker. */
const ROW_COUNTER_STOP_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" ' +
  'stroke="none" focusable="false">' +
  '<rect x="6" y="5" width="4" height="14" rx="1"></rect>' +
  '<rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>';

/**
 * Trusted HTML for the Row Counter Reset action marker.
 *
 * Block-level `<div>` (not wrapped in a paragraph) so renderers should push it
 * directly into the instruction column rather than into `paragraphs`/`trustedParagraphs`.
 * The garment RC label is rendered immediately above the reset button.
 */
export function rowCounterResetBlockHtml(garmentRc: number): string {
  const rcLabel = formatRowCounterResetGarmentRcLabel(garmentRc);
  return (
    `<div class="row-counter-reset-wrap">` +
    `<p class="row-counter-reset__garment-rc">${rcLabel}</p>` +
    `<div class="row-counter-reset" role="note" aria-label="${rcLabel}. Required action: ${RESET_ROW_COUNTER_TEXT}">` +
    `<span class="row-counter-reset__icon" aria-hidden="true">${ROW_COUNTER_RESET_ICON_SVG}</span>` +
    `<span class="row-counter-reset__text">${RESET_ROW_COUNTER_TEXT}</span>` +
    `</div></div>`
  );
}

/**
 * Trusted HTML for the Stop Row Counter action marker.
 *
 * Reuses the existing `.row-counter-reset` control (not a new component).
 * The garment RC label is rendered immediately above the stop button.
 */
export function rowCounterStopBlockHtml(garmentRc: number): string {
  const rcLabel = formatRowCounterResetGarmentRcLabel(garmentRc);
  return (
    `<div class="row-counter-reset-wrap">` +
    `<p class="row-counter-reset__garment-rc">${rcLabel}</p>` +
    `<div class="row-counter-reset" role="note" aria-label="${rcLabel}. Required action: ${STOP_ROW_COUNTER_TEXT}">` +
    `<span class="row-counter-reset__icon" aria-hidden="true">${ROW_COUNTER_STOP_ICON_SVG}</span>` +
    `<span class="row-counter-reset__text">${STOP_ROW_COUNTER_TEXT}</span>` +
    `</div></div>`
  );
}
