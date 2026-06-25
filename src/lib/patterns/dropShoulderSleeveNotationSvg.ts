/**
 * Drop-shoulder sleeve diagram SVG paths (measurements + shaping notation).
 */

import { resolveDropShoulderDiagramSvg } from "./dropShoulderDiagramSvgResolver";
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
  return resolveDropShoulderDiagramSvg({
    piece: "sleeve",
    mode: "sts-rows",
    bodyShape: "straight",
    sleeveDirection: direction,
  }).src;
}

export function resolveDropShoulderSleeveNotationSvgSrc(
  direction: DropShoulderSleeveDirection,
): string {
  return resolveDropShoulderDiagramSvg({
    piece: "sleeve",
    mode: "japanese",
    bodyShape: "straight",
    sleeveDirection: direction,
  }).src;
}
