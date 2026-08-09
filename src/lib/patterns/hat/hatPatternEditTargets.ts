/**
 * SVG measurement-target ids for the hat Edit Pattern drawer overlay.
 * Anchors are emitted by `buildHatPatternDiagramSvg` (same diagram as the pattern page).
 */
export const HAT_EDIT_MEASUREMENT_TARGETS = {
  circumference: "target_hat_circumference",
  length: "target_hat_length",
  brimDepth: "target_hat_brim",
} as const;

export type HatEditMeasurementTargetId =
  (typeof HAT_EDIT_MEASUREMENT_TARGETS)[keyof typeof HAT_EDIT_MEASUREMENT_TARGETS];
