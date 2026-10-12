/**
 * Set-In Sleeve Edit Pattern — Sleeve tab diagram.
 *
 * Reuses the Drop Shoulder standalone sleeve trapezoid (no sleeve cap, no cuff-length
 * dimension). Overlay chips own the three editable values: upper arm, sleeve length,
 * and cuff circumference. Does not compute pattern math.
 */

import { buildDropShoulderEditSleeveFrameFromMeasurements } from "../dropShoulderEditMeasurementDiagramSvg";
import {
  DS_ARROW,
  DS_FILL,
  DS_STROKE,
  DS_VB_H,
  DS_VB_W,
  endCap,
  fmtNum,
} from "../dropShoulderPatternDiagramSvgShared";
import {
  dropShoulderSleeveBodyPath,
  type DropShoulderSleeveDiagramFrame,
} from "../dropShoulderSleeveDiagramSvgShared";
import { PATTERN_SUMMARY_MEASUREMENT_TARGETS } from "../patternSummaryMeasurementOverlay";

export const SET_IN_SLEEVE_EDIT_SLEEVE_MEASUREMENT_TARGET_IDS = [
  PATTERN_SUMMARY_MEASUREMENT_TARGETS.upperArm,
  PATTERN_SUMMARY_MEASUREMENT_TARGETS.armLength,
  PATTERN_SUMMARY_MEASUREMENT_TARGETS.cuffCircumference,
] as const;

/** Same gutters as the Drop Shoulder Sleeve tab, without the cuff-length dimension. */
const SLEEVE_DIM = {
  upperArm: 20,
  cuffCirc: 24,
  sleeveLength: 32,
} as const;

export type SetInSleeveEditSleeveMeasurementInput = {
  upperArmInches: number;
  cuffCircumferenceInches: number;
  sleeveLengthInches: number;
};

function hDim(x1: number, x2: number, y: number, role: string): string {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  return [
    `<g class="ds-edit-dim" data-role="${role}" data-end-cap="true">`,
    `<line x1="${fmtNum(left)}" y1="${fmtNum(y)}" x2="${fmtNum(right)}" y2="${fmtNum(y)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>`,
    endCap(left, y, false),
    endCap(right, y, false),
    `</g>`,
  ].join("");
}

function vDim(x: number, y1: number, y2: number, role: string): string {
  const top = Math.min(y1, y2);
  const bot = Math.max(y1, y2);
  return [
    `<g class="ds-edit-dim" data-role="${role}" data-end-cap="true">`,
    `<line x1="${fmtNum(x)}" y1="${fmtNum(top)}" x2="${fmtNum(x)}" y2="${fmtNum(bot)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>`,
    endCap(x, top, true),
    endCap(x, bot, true),
    `</g>`,
  ].join("");
}

function targetCircle(id: string, x: number, y: number): string {
  return `<circle id="${id}" cx="${fmtNum(x)}" cy="${fmtNum(y)}" r="2.5" fill="none"/>`;
}

function sleeveLengthDimX(frame: DropShoulderSleeveDiagramFrame): number {
  return Math.min(frame.wristLeft, frame.upperLeft) - SLEEVE_DIM.sleeveLength;
}

export function buildSetInSleeveEditSleeveMeasurementDiagramSvg(
  measurements: SetInSleeveEditSleeveMeasurementInput,
): string {
  const frame = buildDropShoulderEditSleeveFrameFromMeasurements({
    bustInches: 40,
    hipInches: 40,
    garmentLengthInches: 22,
    armholeDepthInches: 8,
    neckOpeningInches: 7,
    neckDepthInches: 3,
    hemDepthInches: 2,
    upperArmInches: measurements.upperArmInches,
    cuffCircumferenceInches: measurements.cuffCircumferenceInches,
    sleeveLengthInches: measurements.sleeveLengthInches,
    cuffDepthInches: 0,
  });
  const t = PATTERN_SUMMARY_MEASUREMENT_TARGETS;
  const upperY = frame.upperArmY - SLEEVE_DIM.upperArm;
  const cuffY = frame.wristY + SLEEVE_DIM.cuffCirc;
  const lengthX = sleeveLengthDimX(frame);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DS_VB_W} ${DS_VB_H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Set-in sleeve sleeve measurement diagram" focusable="false" class="express-mbp-art" data-set-in-sleeve-edit-diagram="true" data-set-in-sleeve-edit-piece="sleeve" data-sleeve-cap="false" data-display-unit="in">`,
    `<path data-role="sleeve-outline" data-sleeve-cap="false" d="${dropShoulderSleeveBodyPath(frame)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    hDim(frame.upperLeft, frame.upperRight, upperY, "dim-upper-arm"),
    hDim(frame.wristLeft, frame.wristRight, cuffY, "dim-cuff-circ"),
    vDim(lengthX, frame.top, frame.bottom, "dim-sleeve-length"),
    `<g data-role="measurement-targets">`,
    targetCircle(t.upperArm, frame.midX, upperY),
    targetCircle(t.armLength, lengthX, (frame.top + frame.bottom) / 2),
    targetCircle(t.cuffCircumference, frame.midX, cuffY),
    `</g>`,
    `</svg>`,
  ].join("");
}
