/**
 * Drop Shoulder Edit Pattern measurement diagrams (Body tab / Sleeve tab).
 *
 * Measurement-focused Front body and standalone sleeve silhouettes.
 * Reuses approved Drop Shoulder body frame/path helpers and sleeve trapezoid
 * geometry. Does not invent neckline, body-shape, or sleeve math.
 */

import { DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS } from "./patternSummaryMeasurementOverlay";
import {
  resolveSleevelessEditMeasurementBodyShapeKind,
  resolveSleevelessEditMeasurementIsCardigan,
  resolveSleevelessEditMeasurementIsVNeck,
} from "./sleevelessEditMeasurementDiagramSvg";
import type { SleevelessEffectiveBodyShapeKind } from "./sleevelessAlineShaping";
import type { MeasurementDisplayUnit } from "./patternMeasurementDisplayUnit";
import {
  DS_ARROW,
  DS_FILL,
  DS_STROKE,
  DS_VB_H,
  DS_VB_W,
  bodyWidthXAt,
  buildDropShoulderMeasurementBodyFrame,
  dropShoulderFrontBodyPath,
  dropShoulderFrontNecklineDeepestY,
  drawArmholeMarker,
  endCap,
  fmtNum,
  offsetDropShoulderDiagramFrame,
  type DropShoulderDiagramFrame,
} from "./dropShoulderPatternDiagramSvgShared";
import {
  buildDropShoulderMeasurementSleeveFrame,
  dropShoulderSleeveBodyPath,
  drawSleeveCuffJoin,
  offsetDropShoulderSleeveDiagramFrame,
  type DropShoulderSleeveDiagramFrame,
} from "./dropShoulderSleeveDiagramSvgShared";
import type { DropShoulderEditPreviewTab } from "./dropShoulderEditMeasurementPreview";

export const DROP_SHOULDER_EDIT_BODY_MEASUREMENT_TARGET_IDS = [
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.neckOpening,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.neckDepth,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.bust,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.garmentLength,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.hip,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.hem,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.armholeDepth,
] as const;

export const DROP_SHOULDER_EDIT_SLEEVE_MEASUREMENT_TARGET_IDS = [
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.upperArm,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.armLength,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.cuffCircumference,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.cuffDepth,
] as const;

/** @deprecated Use body + sleeve target lists; kept for overlay-id audits. */
export const DROP_SHOULDER_EDIT_MEASUREMENT_TARGET_IDS = [
  ...DROP_SHOULDER_EDIT_BODY_MEASUREMENT_TARGET_IDS,
  ...DROP_SHOULDER_EDIT_SLEEVE_MEASUREMENT_TARGET_IDS,
] as const;

export type DropShoulderEditMeasurementInput = {
  bustInches: number;
  hipInches: number;
  garmentLengthInches: number;
  armholeDepthInches: number;
  neckOpeningInches: number;
  neckDepthInches: number;
  hemDepthInches: number;
  upperArmInches: number;
  cuffCircumferenceInches: number;
  sleeveLengthInches: number;
  cuffDepthInches: number;
};

export type DropShoulderEditMeasurementDiagramInput = {
  measurements: DropShoulderEditMeasurementInput;
  patternData?: unknown;
  liveNeckline?: string;
  liveGarmentStyle?: string;
  displayUnit?: MeasurementDisplayUnit;
};

export type DropShoulderEditMeasurementDiagramModel = {
  isVNeck: boolean;
  isCardigan: boolean;
  bodyShapeKind: SleevelessEffectiveBodyShapeKind;
  tapered: boolean;
  displayUnit: MeasurementDisplayUnit;
  frame: DropShoulderDiagramFrame;
  viewBox: { x: number; y: number; width: number; height: number };
  measurements: DropShoulderEditMeasurementInput;
};

function computeBodyViewBox(frame: DropShoulderDiagramFrame): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const xs = [frame.left, frame.right, frame.hemLeft, frame.hemRight, frame.neckLeftX, frame.neckRightX];
  const ys = [frame.top, frame.bottom, frame.neckBottomY, frame.armholeMarkerY, frame.hemTopY];
  const padX = 72;
  const padY = 56;
  const minX = Math.min(...xs) - padX;
  const minY = Math.min(...ys) - padY;
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) + padX - minX,
    height: Math.max(...ys) + padY - minY,
  };
}

export function buildDropShoulderEditMeasurementDiagramModel(
  input: DropShoulderEditMeasurementDiagramInput,
): DropShoulderEditMeasurementDiagramModel {
  const { measurements } = input;
  const isVNeck = resolveSleevelessEditMeasurementIsVNeck(input.patternData, input.liveNeckline);
  const isCardigan = resolveSleevelessEditMeasurementIsCardigan(
    input.patternData,
    input.liveGarmentStyle,
  );
  const bodyShapeKind = resolveSleevelessEditMeasurementBodyShapeKind(
    measurements.bustInches,
    measurements.hipInches,
    input.patternData,
  );
  const tapered = bodyShapeKind !== "straight";
  const rawFrame = buildDropShoulderMeasurementBodyFrame(measurements);
  const viewBox = computeBodyViewBox(rawFrame);
  const frame = offsetDropShoulderDiagramFrame(rawFrame, -viewBox.x, -viewBox.y);
  return {
    isVNeck,
    isCardigan,
    bodyShapeKind,
    tapered,
    displayUnit: input.displayUnit === "cm" ? "cm" : "in",
    frame,
    viewBox: { x: 0, y: 0, width: viewBox.width, height: viewBox.height },
    measurements,
  };
}

/** Dimension line + end caps only. Overlay chips own the numeric/unit value. */
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

function drawBody(model: DropShoulderEditMeasurementDiagramModel): string {
  const { frame, isVNeck, isCardigan } = model;
  const neckline = isVNeck ? "v" : "round";
  const d = dropShoulderFrontBodyPath(frame, "pullover", neckline);
  const deepestY = dropShoulderFrontNecklineDeepestY(frame, "pullover", neckline);
  const cf = isCardigan
    ? `<line data-role="center-front-opening" x1="${fmtNum(frame.midX)}" y1="${fmtNum(deepestY)}" x2="${fmtNum(frame.midX)}" y2="${fmtNum(frame.bottom)}" fill="none" stroke="${DS_STROKE}" stroke-width="1.6"/>`
    : "";
  return [
    `<path data-role="body-outline" data-shaped-armhole="false" data-armhole-style="drop-shoulder" d="${d}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    `<line data-role="armhole-opening" data-side="left" x1="${fmtNum(frame.left)}" y1="${fmtNum(frame.top)}" x2="${fmtNum(frame.left)}" y2="${fmtNum(frame.armholeMarkerY)}" fill="none" stroke="${DS_STROKE}" stroke-width="1.6"/>`,
    `<line data-role="armhole-opening" data-side="right" x1="${fmtNum(frame.right)}" y1="${fmtNum(frame.top)}" x2="${fmtNum(frame.right)}" y2="${fmtNum(frame.armholeMarkerY)}" fill="none" stroke="${DS_STROKE}" stroke-width="1.6"/>`,
    drawArmholeMarker(frame, "both"),
    cf,
  ].join("");
}

function drawBodyDimensions(model: DropShoulderEditMeasurementDiagramModel): string {
  const { frame } = model;
  const bustY = frame.armholeMarkerY + (frame.hemTopY - frame.armholeMarkerY) * 0.32;
  const hipY = frame.hemTopY + (frame.bottom - frame.hemTopY) * 0.45;
  const bustX = bodyWidthXAt(frame, bustY);
  const hipX = bodyWidthXAt(frame, hipY);
  return [
    hDim(frame.neckLeftX, frame.neckRightX, frame.top - 18, "dim-neck-opening"),
    vDim(frame.neckLeftX - 16, frame.top, frame.neckBottomY, "dim-neck-depth"),
    hDim(bustX.left, bustX.right, bustY, "dim-bust"),
    hDim(hipX.left, hipX.right, hipY, "dim-hip"),
    vDim(frame.right + 28, frame.top, frame.bottom, "dim-garment-length"),
    vDim(frame.hemRight + 18, frame.hemTopY, frame.bottom, "dim-hem-depth"),
    vDim(frame.left - 22, frame.top, frame.armholeMarkerY, "dim-armhole-depth"),
  ].join("");
}

function targetCircle(id: string, x: number, y: number): string {
  return `<circle id="${id}" cx="${fmtNum(x)}" cy="${fmtNum(y)}" r="2.5" fill="none"/>`;
}

function drawBodyTargets(model: DropShoulderEditMeasurementDiagramModel): string {
  const { frame } = model;
  const t = DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS;
  const bustY = frame.armholeMarkerY + (frame.hemTopY - frame.armholeMarkerY) * 0.32;
  const hipY = frame.hemTopY + (frame.bottom - frame.hemTopY) * 0.45;
  return [
    `<g data-role="measurement-targets">`,
    targetCircle(t.neckOpening, frame.midX, frame.top - 18),
    targetCircle(t.neckDepth, frame.neckLeftX - 16, (frame.top + frame.neckBottomY) / 2),
    targetCircle(t.bust, frame.midX, bustY),
    targetCircle(t.hip, frame.midX, hipY),
    targetCircle(t.garmentLength, frame.right + 28, (frame.top + frame.bottom) / 2),
    targetCircle(t.hem, frame.hemRight + 18, (frame.hemTopY + frame.bottom) / 2),
    targetCircle(t.armholeDepth, frame.left - 22, (frame.top + frame.armholeMarkerY) / 2),
    `</g>`,
  ].join("");
}

export function buildDropShoulderEditBodyMeasurementDiagramSvg(
  input: DropShoulderEditMeasurementDiagramInput,
): string {
  const model = buildDropShoulderEditMeasurementDiagramModel(input);
  const { width, height } = model.viewBox;
  const neckline = model.isVNeck ? "v-neck" : "round";
  const garment = model.isCardigan ? "cardigan" : "pullover";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmtNum(width)} ${fmtNum(height)}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Drop shoulder body measurement diagram" focusable="false" class="express-mbp-art" data-drop-shoulder-edit-diagram="true" data-drop-shoulder-edit-piece="body" data-drop-shoulder-edit-neckline="${neckline}" data-drop-shoulder-edit-garment="${garment}" data-drop-shoulder-edit-body-shape="${model.bodyShapeKind}" data-display-unit="${model.displayUnit}">`,
    drawBody(model),
    drawBodyDimensions(model),
    drawBodyTargets(model),
    `</svg>`,
  ].join("");
}

/**
 * Dedicated Sleeve-tab drawing frame. Same 430×520 viewBox as other Drop Shoulder
 * schematics, but the silhouette is scaled into the inner content rect instead of
 * stretching to fill DS_BODY_MAX_H (pattern-page Stitches & Rows behavior).
 */
const DS_SLEEVE_PAD_TOP = 64;
const DS_SLEEVE_PAD_BOTTOM = 68;
const DS_SLEEVE_PAD_LEFT = 84;
const DS_SLEEVE_PAD_RIGHT = 78;
/** Typical long-sleeve envelope so short sleeves stay proportionally short. */
const DS_SLEEVE_REF_LENGTH_IN = 22;
/** ~18" upper-arm circumference laid flat. */
const DS_SLEEVE_REF_FLAT_WIDTH_IN = 9;
const DS_SLEEVE_CONTENT_FILL = 0.78;
const DS_SLEEVE_DIM = {
  upperArm: 20,
  cuffCirc: 24,
  sleeveLength: 32,
  cuffDepth: 22,
} as const;

function buildStandaloneSleeveFrame(
  measurements: DropShoulderEditMeasurementInput,
): DropShoulderSleeveDiagramFrame {
  const lengthIn = Math.max(1, measurements.sleeveLengthInches);
  const cuffDepthIn = Math.max(0, Math.min(measurements.cuffDepthInches, lengthIn * 0.95));
  const upperFlatIn = Math.max(0.5, measurements.upperArmInches / 2);
  const cuffFlatIn = Math.max(0.4, measurements.cuffCircumferenceInches / 2);
  const contentW = DS_VB_W - DS_SLEEVE_PAD_LEFT - DS_SLEEVE_PAD_RIGHT;
  const contentH = DS_VB_H - DS_SLEEVE_PAD_TOP - DS_SLEEVE_PAD_BOTTOM;
  const envelopeW = Math.max(upperFlatIn, cuffFlatIn, DS_SLEEVE_REF_FLAT_WIDTH_IN);
  const envelopeH = Math.max(lengthIn, DS_SLEEVE_REF_LENGTH_IN);
  const pxPerInch =
    Math.min(contentW / envelopeW, contentH / envelopeH) * DS_SLEEVE_CONTENT_FILL;
  const local = buildDropShoulderMeasurementSleeveFrame({
    upperArmWidthPx: upperFlatIn * pxPerInch,
    cuffWidthPx: cuffFlatIn * pxPerInch,
    sleeveLengthPx: lengthIn * pxPerInch,
    cuffDepthPx: cuffDepthIn * pxPerInch,
  });
  const sleeveH = local.bottom - local.top;
  const midX = DS_VB_W / 2;
  const desiredTop = (DS_VB_H - sleeveH) / 2;
  const top = Math.min(
    DS_VB_H - DS_SLEEVE_PAD_BOTTOM - sleeveH,
    Math.max(DS_SLEEVE_PAD_TOP, desiredTop),
  );
  return offsetDropShoulderSleeveDiagramFrame(local, midX, top);
}

function sleeveLengthDimX(frame: DropShoulderSleeveDiagramFrame): number {
  return Math.min(frame.wristLeft, frame.upperLeft) - DS_SLEEVE_DIM.sleeveLength;
}

function sleeveUpperArmDimY(frame: DropShoulderSleeveDiagramFrame): number {
  return frame.upperArmY - DS_SLEEVE_DIM.upperArm;
}

function sleeveCuffCircDimY(frame: DropShoulderSleeveDiagramFrame): number {
  return frame.wristY + DS_SLEEVE_DIM.cuffCirc;
}

function sleeveCuffDepthDimX(frame: DropShoulderSleeveDiagramFrame): number {
  return frame.wristRight + DS_SLEEVE_DIM.cuffDepth;
}

function drawSleeveTargets(frame: DropShoulderSleeveDiagramFrame): string {
  const t = DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS;
  const cuffMidY = (Math.min(frame.wristY, frame.cuffJoinY) + Math.max(frame.wristY, frame.cuffJoinY)) / 2;
  return [
    `<g data-role="measurement-targets">`,
    targetCircle(t.upperArm, frame.midX, sleeveUpperArmDimY(frame)),
    targetCircle(t.armLength, sleeveLengthDimX(frame), (frame.top + frame.bottom) / 2),
    targetCircle(t.cuffCircumference, frame.midX, sleeveCuffCircDimY(frame)),
    targetCircle(t.cuffDepth, sleeveCuffDepthDimX(frame), cuffMidY),
    `</g>`,
  ].join("");
}

function drawSleeveEditDimensions(frame: DropShoulderSleeveDiagramFrame): string {
  const cuffY1 = Math.min(frame.wristY, frame.cuffJoinY);
  const cuffY2 = Math.max(frame.wristY, frame.cuffJoinY);
  return [
    hDim(frame.upperLeft, frame.upperRight, sleeveUpperArmDimY(frame), "dim-upper-arm"),
    hDim(frame.wristLeft, frame.wristRight, sleeveCuffCircDimY(frame), "dim-cuff-circ"),
    vDim(sleeveCuffDepthDimX(frame), cuffY1, cuffY2, "dim-cuff-depth"),
    vDim(sleeveLengthDimX(frame), frame.top, frame.bottom, "dim-sleeve-length"),
  ].join("");
}

export function buildDropShoulderEditSleeveMeasurementDiagramSvg(
  input: DropShoulderEditMeasurementDiagramInput,
): string {
  const unit = input.displayUnit === "cm" ? "cm" : "in";
  const frame = buildStandaloneSleeveFrame(input.measurements);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DS_VB_W} ${DS_VB_H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Drop shoulder sleeve measurement diagram" focusable="false" class="express-mbp-art" data-drop-shoulder-edit-diagram="true" data-drop-shoulder-edit-piece="sleeve" data-drop-shoulder-edit-sleeve-layout="compact" data-display-unit="${unit}" data-sleeve-cap="false">`,
    `<path data-role="sleeve-outline" data-sleeve-cap="false" d="${dropShoulderSleeveBodyPath(frame)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    drawSleeveCuffJoin(frame),
    drawSleeveEditDimensions(frame),
    drawSleeveTargets(frame),
    `</svg>`,
  ].join("");
}

export function buildDropShoulderEditMeasurementDiagramSvg(
  input: DropShoulderEditMeasurementDiagramInput,
  piece: DropShoulderEditPreviewTab = "body",
): string {
  return piece === "sleeve"
    ? buildDropShoulderEditSleeveMeasurementDiagramSvg(input)
    : buildDropShoulderEditBodyMeasurementDiagramSvg(input);
}

export function buildDropShoulderEditSleeveFrameFromMeasurements(
  measurements: DropShoulderEditMeasurementInput,
): DropShoulderSleeveDiagramFrame {
  return buildStandaloneSleeveFrame(measurements);
}

export { bodyWidthXAt as dropShoulderEditBodyWidthXAt };
