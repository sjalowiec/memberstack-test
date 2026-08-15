/**
 * Pattern-family measurement fields for the shared Summary/Edit workspace.
 *
 * The Lego block renders compact inputs consistently. Each pattern's diagram
 * renderer still owns geometry and SVG target ids — this type only describes
 * the editable (or display-only) chip associated with an anchor.
 */

export type PatternSummaryMeasurementField = {
  /** Stable key within the pattern family (not a garment-type branch). */
  id: string;
  label: string;
  /** SVG element id produced by the pattern-specific diagram renderer. */
  targetId: string;
  /** CSS transform used by the shared overlay binder (desktop chips). */
  transform?: string;
  editable?: boolean;
  inputType?: "number" | "text";
  inputMode?: string;
  step?: string;
  min?: string;
  /** Input element id (label `for`). */
  inputId?: string;
  /** Pattern-owned data attribute on the input, e.g. `data-hat-edit-circ`. */
  inputDataAttr?: string;
  /** Chip wrapper test id. */
  testId?: string;
  /** Input test id. */
  inputTestId?: string;
  /** Pattern-owned error attribute name, e.g. `data-hat-edit-error`. */
  errorDataAttr?: string;
  /** Value for `errorDataAttr` (validation key owned by the pattern family). */
  errorKey?: string;
  /** Attribute stamped on the unit suffix so the pattern script can update it. */
  unitSuffixAttr?: string;
  /** Optional secondary line (stitches, rows, etc.). */
  secondary?: string;
};

export const PATTERN_SUMMARY_MEASURE_CHIP_CLASS = "ps-measure-chip";
export const PATTERN_SUMMARY_MEASURE_CHIP_INVALID_CLASS = "ps-measure-chip--invalid";
export const PATTERN_SUMMARY_MEASURE_STAGE_CLASS = "ps-measure-stage";
export const PATTERN_SUMMARY_EDIT_WORKSPACE_ATTR = "data-pattern-summary-edit";
