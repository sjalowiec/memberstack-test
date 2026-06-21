/**
 * Construction-aware blueprint SVG for the interactive measurement editor (chips-over-artwork).
 *
 * Sleeveless uses the body-only schematic; Drop Shoulder uses a schematic that also carries
 * sleeve measurement targets (upper arm, cuff, sleeve length). Both share the same overlay
 * positioning system in {@link patternSummaryMeasurementOverlay} — only the artwork differs.
 */

import {
  isActiveDropShoulderConstruction,
  isDropShoulderWorkspaceMeasurementSummaryPage,
} from "./patternConstructionIdentity";

export {
  isDropShoulderWorkspaceMeasurementSummaryPage,
  /** @deprecated Use isDropShoulderWorkspaceMeasurementSummaryPage. */
  isDropShoulderReviewPage,
} from "./patternConstructionIdentity";

export const SLEEVELESS_MEASUREMENT_BLUEPRINT_SVG_URL = "/images/patterns/pattern_summary.svg";
export const DROP_SHOULDER_MEASUREMENT_BLUEPRINT_SVG_URL =
  "/images/patterns/drop-shoulder/drop_shoulder_summary.svg";

/** Keep in sync with `drop_shoulder_summary.svg` viewBox (SSR/CSS fallback before JS hydrates). */
export const DROP_SHOULDER_SUMMARY_SVG_VIEWBOX = {
  width: 228.87,
  height: 423.24,
} as const;

export const DROP_SHOULDER_SUMMARY_ASPECT_RATIO_CSS =
  `${DROP_SHOULDER_SUMMARY_SVG_VIEWBOX.width} / ${DROP_SHOULDER_SUMMARY_SVG_VIEWBOX.height}`;

/** True when the active working pattern is a drop-shoulder construction. */
export function isDropShoulderConstruction(): boolean {
  if (isDropShoulderWorkspaceMeasurementSummaryPage()) return true;
  return isActiveDropShoulderConstruction();
}

/** Blueprint artwork URL for the active construction (Drop Shoulder gets the sleeved diagram). */
export function resolveMeasurementBlueprintSvgUrl(): string {
  return isDropShoulderConstruction()
    ? DROP_SHOULDER_MEASUREMENT_BLUEPRINT_SVG_URL
    : SLEEVELESS_MEASUREMENT_BLUEPRINT_SVG_URL;
}
