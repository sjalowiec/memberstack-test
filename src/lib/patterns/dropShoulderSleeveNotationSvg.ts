/**
 * Drop-shoulder sleeve diagram SVG paths (measurements + shaping notation).
 */

import type { DropShoulderSleeveDirection } from "./dropShoulderSleeveConstruction";

export const DROP_SHOULDER_SLEEVE_MEASUREMENT_BOTTOM_UP_SRC =
  "/images/patterns/drop-shoulder/drop-body-sleeve.svg";

export const DROP_SHOULDER_SLEEVE_MEASUREMENT_TOP_DOWN_SRC =
  "/images/patterns/drop-shoulder/drop-body-sleeve-top-down.svg";

export const DROP_SHOULDER_SLEEVE_NOTATION_BOTTOM_UP_SRC =
  "/images/patterns/drop-shoulder/JP-drop-body-sleeve.svg";

export const DROP_SHOULDER_SLEEVE_NOTATION_TOP_DOWN_SRC =
  "/images/patterns/drop-shoulder/jp-drop-body-sleeve-top-down.svg";

export function resolveDropShoulderSleeveMeasurementSvgSrc(
  direction: DropShoulderSleeveDirection,
): string {
  return direction === "top-down"
    ? DROP_SHOULDER_SLEEVE_MEASUREMENT_TOP_DOWN_SRC
    : DROP_SHOULDER_SLEEVE_MEASUREMENT_BOTTOM_UP_SRC;
}

export function resolveDropShoulderSleeveNotationSvgSrc(
  direction: DropShoulderSleeveDirection,
): string {
  return direction === "top-down"
    ? DROP_SHOULDER_SLEEVE_NOTATION_TOP_DOWN_SRC
    : DROP_SHOULDER_SLEEVE_NOTATION_BOTTOM_UP_SRC;
}
