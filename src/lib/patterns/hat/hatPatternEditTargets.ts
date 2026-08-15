/**
 * SVG measurement-target ids for the hat Summary/Edit overlay.
 * Anchors are emitted by `buildHatPatternDiagramSvg` (same diagram as the pattern page).
 *
 * Chip transforms (via `data-measurement-transform`) park fields beside the three
 * measurement arrows in `summaryEdit` mode (no sts/rows/inch/cm text on the SVG).
 */
import type { PatternSummaryMeasurementField } from "../patternSummaryMeasurementField";

export const HAT_EDIT_MEASUREMENT_TARGETS = {
  circumference: "target_hat_circumference",
  length: "target_hat_length",
  brimDepth: "target_hat_brim",
} as const;

/**
 * Desktop chip transforms for Summary/Edit (`summaryEdit` diagram mode).
 * Anchors sit on the dimension arrows; these offsets park the chip beside the line.
 */
export const HAT_EDIT_MEASUREMENT_TRANSFORMS = {
  /** Directly under the horizontal finished-width arrow. */
  circumference: "translate(-50%, 4px)",
  /** Immediately left of the total-length arrow (gutter, not overlapping the hat). */
  length: "translate(calc(-100% - 6px), -50%)",
  /** Immediately right of the brim-height arrow (stage padding keeps it in-bounds). */
  brimDepth: "translate(6px, -50%)",
} as const;

export type HatEditMeasurementTargetId =
  (typeof HAT_EDIT_MEASUREMENT_TARGETS)[keyof typeof HAT_EDIT_MEASUREMENT_TARGETS];

const HAT_MEASURE_INPUT = {
  inputType: "number" as const,
  inputMode: "decimal",
  step: "0.25",
  min: "0",
  unitSuffixAttr: "data-hat-edit-unit-suffix",
  errorDataAttr: "data-hat-edit-error",
  editable: true,
};

/**
 * Hat Summary/Edit diagram measurements. Geometry/anchors stay in the hat SVG;
 * the shared workspace renders these as compact chips.
 */
export const HAT_SUMMARY_MEASUREMENT_FIELDS: PatternSummaryMeasurementField[] = [
  {
    ...HAT_MEASURE_INPUT,
    id: "circumference",
    label: "Finished hat size",
    targetId: HAT_EDIT_MEASUREMENT_TARGETS.circumference,
    transform: HAT_EDIT_MEASUREMENT_TRANSFORMS.circumference,
    inputId: "hat-edit-circ",
    inputDataAttr: "data-hat-edit-circ",
    testId: "hat-edit-chip-circumference",
    inputTestId: "hat-edit-circ",
    errorKey: "finishedCircumference",
  },
  {
    ...HAT_MEASURE_INPUT,
    id: "length",
    label: "Finished hat length",
    targetId: HAT_EDIT_MEASUREMENT_TARGETS.length,
    transform: HAT_EDIT_MEASUREMENT_TRANSFORMS.length,
    inputId: "hat-edit-length",
    inputDataAttr: "data-hat-edit-length",
    testId: "hat-edit-chip-length",
    inputTestId: "hat-edit-length",
    errorKey: "finishedHatLength",
  },
  {
    ...HAT_MEASURE_INPUT,
    id: "brim",
    label: "Visible Brim Height",
    targetId: HAT_EDIT_MEASUREMENT_TARGETS.brimDepth,
    transform: HAT_EDIT_MEASUREMENT_TRANSFORMS.brimDepth,
    inputId: "hat-edit-brim",
    inputDataAttr: "data-hat-edit-brim",
    testId: "hat-edit-chip-brim",
    inputTestId: "hat-edit-brim",
    errorKey: "brimLength",
  },
];
