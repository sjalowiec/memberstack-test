/**
 * Construction-aware blueprint SVG for the interactive measurement editor (chips-over-artwork).
 *
 * Sleeveless uses the body-only schematic; Drop Shoulder uses a schematic that also carries
 * sleeve measurement targets (upper arm, cuff, sleeve length). Both share the same overlay
 * positioning system in {@link patternSummaryMeasurementOverlay} — only the artwork differs.
 */

import { getCurrentPattern, getPatternData } from "./patternStorage";

export const SLEEVELESS_MEASUREMENT_BLUEPRINT_SVG_URL = "/images/patterns/pattern_summary.svg";
export const DROP_SHOULDER_MEASUREMENT_BLUEPRINT_SVG_URL =
  "/images/patterns/drop-shoulder-summary.svg";

/** True when the active working pattern is a drop-shoulder construction. */
export function isDropShoulderConstruction(): boolean {
  try {
    const canon = (getCurrentPattern().style as Record<string, unknown> | undefined)?.construction;
    if (canon === "drop-shoulder") return true;
    const pb = (getPatternData().style as Record<string, unknown> | undefined)?.construction;
    return pb === "drop-shoulder";
  } catch {
    return false;
  }
}

/** Blueprint artwork URL for the active construction (Drop Shoulder gets the sleeved diagram). */
export function resolveMeasurementBlueprintSvgUrl(): string {
  return isDropShoulderConstruction()
    ? DROP_SHOULDER_MEASUREMENT_BLUEPRINT_SVG_URL
    : SLEEVELESS_MEASUREMENT_BLUEPRINT_SVG_URL;
}
