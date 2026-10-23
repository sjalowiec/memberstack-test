/**
 * SVG measurement-target ids for the Socks Summary/Edit static sock image.
 * Invisible circles sit over {@link SOCK_SUMMARY_ART_SRC}; chips use the shared
 * {@link PatternSummaryMeasurementField} overlay — not a Socks-specific chip system.
 */
import type { PatternSummaryMeasurementField } from "../patternSummaryMeasurementField";

/** Static Summary/Edit art. Distinct from the catalog thumbnail. */
export const SOCK_SUMMARY_ART_SRC = "/images/patterns/christmas-stocking-builder.png";

export const SOCK_EDIT_MEASUREMENT_TARGETS = {
  legLength: "target_sock_leg_length",
  legCircumference: "target_sock_leg_circumference",
  footLength: "target_sock_foot_length",
  footCircumference: "target_sock_foot_circumference",
} as const;

/**
 * Percent-of-image anchors (viewBox 0 0 100 100) for the diagonal single-sock drawing.
 * Placed beside the sock, not on the ribbing or toe.
 */
export const SOCK_SUMMARY_CHIP_TARGET_POINTS = {
  legLength: { x: 28, y: 32 },
  legCircumference: { x: 48, y: 12 },
  footLength: { x: 52, y: 92 },
  footCircumference: { x: 86, y: 64 },
} as const;

/**
 * Desktop chip transforms. Park chips in the white space around the sock.
 */
export const SOCK_EDIT_MEASUREMENT_TRANSFORMS = {
  /** Left of the vertical leg. */
  legLength: "translate(calc(-100% - 8px), -50%)",
  /** Above the cuff. */
  legCircumference: "translate(-50%, calc(-100% - 8px))",
  /** Below the foot. */
  footLength: "translate(-50%, 12px)",
  /** Right of the foot/body. */
  footCircumference: "translate(12px, -50%)",
} as const;

export type SockEditMeasurementTargetId =
  (typeof SOCK_EDIT_MEASUREMENT_TARGETS)[keyof typeof SOCK_EDIT_MEASUREMENT_TARGETS];

const SOCK_MEASURE_INPUT = {
  inputType: "number" as const,
  inputMode: "decimal",
  step: "0.25",
  min: "0",
  unitSuffixAttr: "data-christmas-stocking-edit-unit-suffix",
  errorDataAttr: "data-christmas-stocking-edit-error",
  editable: true,
};

/**
 * Socks Summary/Edit Perfect Fit measurements. Derived construction values
 * (ankle, heel/toe depth, rows/stitches) are not chips.
 */
export const SOCK_SUMMARY_MEASUREMENT_FIELDS: PatternSummaryMeasurementField[] = [
  {
    ...SOCK_MEASURE_INPUT,
    id: "legLength",
    label: "Leg Length",
    targetId: SOCK_EDIT_MEASUREMENT_TARGETS.legLength,
    transform: SOCK_EDIT_MEASUREMENT_TRANSFORMS.legLength,
    inputId: "christmas-stocking-edit-leg-length",
    inputDataAttr: "data-christmas-stocking-edit-leg-length",
    testId: "christmas-stocking-edit-chip-leg-length",
    inputTestId: "christmas-stocking-edit-leg-length",
    errorKey: "legLength",
  },
  {
    ...SOCK_MEASURE_INPUT,
    id: "footLength",
    label: "Foot Length",
    targetId: SOCK_EDIT_MEASUREMENT_TARGETS.footLength,
    transform: SOCK_EDIT_MEASUREMENT_TRANSFORMS.footLength,
    inputId: "christmas-stocking-edit-foot-length",
    inputDataAttr: "data-christmas-stocking-edit-foot-length",
    testId: "christmas-stocking-edit-chip-foot-length",
    inputTestId: "christmas-stocking-edit-foot-length",
    errorKey: "footLength",
  },
  {
    ...SOCK_MEASURE_INPUT,
    id: "footCircumference",
    label: "Foot Circumference",
    targetId: SOCK_EDIT_MEASUREMENT_TARGETS.footCircumference,
    transform: SOCK_EDIT_MEASUREMENT_TRANSFORMS.footCircumference,
    inputId: "christmas-stocking-edit-foot-circ",
    inputDataAttr: "data-christmas-stocking-edit-foot-circ",
    testId: "christmas-stocking-edit-chip-foot-circ",
    inputTestId: "christmas-stocking-edit-foot-circ",
    errorKey: "footCircumference",
  },
];
