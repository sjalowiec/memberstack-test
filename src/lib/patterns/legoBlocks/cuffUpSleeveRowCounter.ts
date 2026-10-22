/**
 * Shared Cuff-Up sleeve row-counter rule.
 *
 * After the selected cuff treatment is finished, the sleeve-body row counter
 * starts at RC 000. Rows used for ribbing, hems, mock ribbing, scrap, ravel
 * cord, hand-knit ribbing, or any other cuff treatment are not part of that
 * count. Top-down sleeves do not use this reset.
 */

/** Exact instruction at the cuff-complete → sleeve-body transition. */
export const CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET = "Reset row counter to RC 000.";

/**
 * Display block inserted once, after every cuff option and before the sleeve body.
 * Screen and print use the shared Reset Row Counter marker at RC 000.
 * {@link CUFF_UP_SLEEVE_BODY_ROW_COUNTER_RESET} remains the plain-text sentence.
 */
export function cuffUpSleeveBodyRowCounterResetBlock(): {
  kind: "block";
  paragraphs: string[];
  rowCounterReset: true;
  rowCounterResetGarmentRc: 0;
} {
  return {
    kind: "block",
    paragraphs: [],
    rowCounterReset: true,
    rowCounterResetGarmentRc: 0,
  };
}

/**
 * Sleeve-body row counter for a cuff-up sleeve.
 * `sleeveBodyRowNumber` is counted from the first sleeve-body row, after the cuff.
 */
export function cuffUpSleeveBodyRowCounter(sleeveBodyRowNumber: number): number {
  return Math.max(0, Math.floor(sleeveBodyRowNumber));
}
