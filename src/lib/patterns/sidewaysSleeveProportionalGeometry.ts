/**
 * Shared Sideways V-Neck sleeve silhouette.
 *
 * One garment inch is the same SVG distance on both axes. Upper arm, wrist,
 * and sleeve length are not fitted into a fixed canvas. Callers place this
 * local frame (upper arm and wrist centered on x = 0) and grow their own
 * viewBox around it.
 */

import {
  buildDropShoulderMeasurementSleeveFrame,
  offsetDropShoulderSleeveDiagramFrame,
  type DropShoulderSleeveDiagramFrame,
} from "./dropShoulderSleeveDiagramSvgShared";

/** SVG user-units per finished garment inch, shared by Build/Edit and both finished sleeve diagrams. */
export const SIDEWAYS_SLEEVE_PX_PER_INCH = 16;

export type SidewaysSleeveDirection = "cuff-up" | "top-down";

export type SidewaysProportionalSleeve = {
  frame: DropShoulderSleeveDiagramFrame;
  pxPerInch: number;
  upperArmInches: number;
  wristInches: number;
  sleeveLengthInches: number;
  cuffDepthInches: number;
};

function positiveInches(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function flipCuffUpFrameToTopDown(
  frame: DropShoulderSleeveDiagramFrame,
): DropShoulderSleeveDiagramFrame {
  const flip = (y: number) => frame.top + frame.bottom - y;
  return {
    ...frame,
    direction: "top-down",
    cuffJoinY: flip(frame.cuffJoinY),
    wristY: flip(frame.wristY),
    upperArmY: flip(frame.upperArmY),
  };
}

/**
 * Cuff-up local frame, or the same silhouette flipped for top-down.
 * Widths and length stay full circumference inches times {@link SIDEWAYS_SLEEVE_PX_PER_INCH}.
 * Cuff depth is a portion of that length, on the same scale.
 */
export function sidewaysProportionalSleeveLocalFrame(input: {
  upperArmInches: number;
  wristInches: number;
  sleeveLengthInches: number;
  cuffDepthInches: number;
  direction: SidewaysSleeveDirection;
}): SidewaysProportionalSleeve {
  const pxPerInch = SIDEWAYS_SLEEVE_PX_PER_INCH;
  const upperArmInches = positiveInches(input.upperArmInches, 12);
  const wristInches = positiveInches(input.wristInches, 7);
  const sleeveLengthInches = positiveInches(input.sleeveLengthInches, 16);
  const cuffDepthInches =
    Number.isFinite(input.cuffDepthInches) && input.cuffDepthInches > 0 ? input.cuffDepthInches : 0;
  const cuffUp = buildDropShoulderMeasurementSleeveFrame({
    upperArmWidthPx: upperArmInches * SIDEWAYS_SLEEVE_PX_PER_INCH,
    cuffWidthPx: wristInches * SIDEWAYS_SLEEVE_PX_PER_INCH,
    sleeveLengthPx: sleeveLengthInches * SIDEWAYS_SLEEVE_PX_PER_INCH,
    cuffDepthPx: cuffDepthInches * SIDEWAYS_SLEEVE_PX_PER_INCH,
  });
  const length = cuffUp.bottom - cuffUp.top;
  const cuffH = Math.min(cuffDepthInches * SIDEWAYS_SLEEVE_PX_PER_INCH, length);
  const withCuff =
    Math.abs(cuffUp.bottom - cuffUp.cuffJoinY - cuffH) < 0.001
      ? cuffUp
      : { ...cuffUp, cuffJoinY: cuffUp.bottom - cuffH };
  return {
    frame: input.direction === "top-down" ? flipCuffUpFrameToTopDown(withCuff) : withCuff,
    pxPerInch,
    upperArmInches,
    wristInches,
    sleeveLengthInches,
    cuffDepthInches,
  };
}

export type SidewaysSleeveAnnotationPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/** Shift the local silhouette into the padding and return a viewBox that wraps it. */
export function placeSidewaysProportionalSleeve(
  local: DropShoulderSleeveDiagramFrame,
  padding: SidewaysSleeveAnnotationPadding,
): {
  frame: DropShoulderSleeveDiagramFrame;
  viewBox: { x: number; y: number; width: number; height: number };
} {
  const left = Math.min(local.wristLeft, local.upperLeft, local.cuffJoinLeft);
  const right = Math.max(local.wristRight, local.upperRight, local.cuffJoinRight);
  const frame = offsetDropShoulderSleeveDiagramFrame(
    local,
    padding.left - left,
    padding.top - local.top,
  );
  return {
    frame,
    viewBox: {
      x: 0,
      y: 0,
      width: padding.left + (right - left) + padding.right,
      height: padding.top + (local.bottom - local.top) + padding.bottom,
    },
  };
}
