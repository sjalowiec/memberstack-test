/**
 * SVG measurement-target ids for the hat Summary/Edit overlay.
 * Anchors are emitted by `buildHatPatternDiagramSvg` (same diagram as the pattern page).
 *
 * Chip transforms (via `data-measurement-transform`) park fields beside the three
 * measurement arrows in `summaryEdit` mode (no sts/rows/inch/cm text on the SVG).
 */
export const HAT_EDIT_MEASUREMENT_TARGETS = {
  circumference: "target_hat_circumference",
  length: "target_hat_length",
  brimDepth: "target_hat_brim",
} as const;

/**
 * Desktop chip transforms for Summary/Edit (`summaryEdit` diagram mode).
 * Length sits centered in the expanded left viewBox gutter; brim/size beside their arrows.
 */
export const HAT_EDIT_MEASUREMENT_TRANSFORMS = {
  /** Centered under the horizontal finished-width arrow. */
  circumference: "translate(-50%, 8px)",
  /** Centered on the left-gutter length target (inside diagram workspace). */
  length: "translate(-50%, -50%)",
  /** Right of the vertical brim-height arrow. */
  brimDepth: "translate(8px, -50%)",
} as const;

export type HatEditMeasurementTargetId =
  (typeof HAT_EDIT_MEASUREMENT_TARGETS)[keyof typeof HAT_EDIT_MEASUREMENT_TARGETS];
