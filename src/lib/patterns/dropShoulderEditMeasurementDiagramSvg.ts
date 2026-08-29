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
import {
  formatMeasurementDisplayFromInches,
  type MeasurementDisplayUnit,
} from "./patternMeasurementDisplayUnit";
import {
  DS_ARROW,
  DS_FILL,
  DS_MUTED,
  DS_STROKE,
  DS_FS_SMALL,
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
  textFont,
  type DropShoulderDiagramFrame,
} from "./dropShoulderPatternDiagramSvgShared";
import {
  buildDropShoulderSleeveFrame,
  dropShoulderSleeveBodyPath,
  drawSleeveCuffDepth,
  drawSleeveCuffJoin,
  drawSleeveTotalLength,
  drawSleeveUpperArmWidth,
  drawSleeveWristWidth,
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

function unitLabel(inches: number, unit: MeasurementDisplayUnit): string {
  const value = formatMeasurementDisplayFromInches(inches, unit);
  if (!value) return "";
  return `${value} ${unit}`;
}

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

function hDim(x1: number, x2: number, y: number, role: string, label: string): string {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const mid = (left + right) / 2;
  return [
    `<g class="ds-edit-dim" data-role="${role}" data-end-cap="true">`,
    `<line x1="${fmtNum(left)}" y1="${fmtNum(y)}" x2="${fmtNum(right)}" y2="${fmtNum(y)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>`,
    endCap(left, y, false),
    endCap(right, y, false),
    label
      ? `<text x="${fmtNum(mid)}" y="${fmtNum(y - 6)}" text-anchor="middle" fill="${DS_MUTED}" ${textFont(DS_FS_SMALL)}>${label}</text>`
      : "",
    `</g>`,
  ].join("");
}

function vDim(
  x: number,
  y1: number,
  y2: number,
  role: string,
  label: string,
  labelSide: "left" | "right",
): string {
  const top = Math.min(y1, y2);
  const bot = Math.max(y1, y2);
  const mid = (top + bot) / 2;
  const labelX = labelSide === "left" ? x - 12 : x + 12;
  return [
    `<g class="ds-edit-dim" data-role="${role}" data-end-cap="true">`,
    `<line x1="${fmtNum(x)}" y1="${fmtNum(top)}" x2="${fmtNum(x)}" y2="${fmtNum(bot)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>`,
    endCap(x, top, true),
    endCap(x, bot, true),
    label
      ? `<text transform="translate(${fmtNum(labelX)} ${fmtNum(mid)}) rotate(-90)" text-anchor="middle" fill="${DS_MUTED}" ${textFont(DS_FS_SMALL)}>${label}</text>`
      : "",
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
  const { frame, measurements, displayUnit } = model;
  const u = (n: number) => unitLabel(n, displayUnit);
  const bustY = frame.armholeMarkerY + (frame.hemTopY - frame.armholeMarkerY) * 0.32;
  const hipY = frame.hemTopY + (frame.bottom - frame.hemTopY) * 0.45;
  const bustX = bodyWidthXAt(frame, bustY);
  const hipX = bodyWidthXAt(frame, hipY);
  return [
    hDim(frame.neckLeftX, frame.neckRightX, frame.top - 18, "dim-neck-opening", u(measurements.neckOpeningInches)),
    vDim(frame.neckLeftX - 16, frame.top, frame.neckBottomY, "dim-neck-depth", u(measurements.neckDepthInches), "left"),
    hDim(bustX.left, bustX.right, bustY, "dim-bust", u(measurements.bustInches)),
    hDim(hipX.left, hipX.right, hipY, "dim-hip", u(measurements.hipInches)),
    vDim(frame.right + 28, frame.top, frame.bottom, "dim-garment-length", u(measurements.garmentLengthInches), "right"),
    vDim(frame.hemRight + 18, frame.hemTopY, frame.bottom, "dim-hem-depth", u(measurements.hemDepthInches), "right"),
    vDim(frame.left - 22, frame.top, frame.armholeMarkerY, "dim-armhole-depth", u(measurements.armholeDepthInches), "left"),
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

function buildStandaloneSleeveFrame(
  measurements: DropShoulderEditMeasurementInput,
): DropShoulderSleeveDiagramFrame {
  const cuff = Math.max(0.25, measurements.cuffDepthInches);
  const total = Math.max(cuff + 1, measurements.sleeveLengthInches);
  const body = Math.max(1, total - cuff);
  return buildDropShoulderSleeveFrame({
    unit: "in",
    direction: "cuff-up",
    stitchesPerInch: 1,
    rowsPerInch: 1,
    wristStitches: Math.max(1, measurements.cuffCircumferenceInches),
    topStitches: Math.max(1, measurements.upperArmInches),
    cuffRows: cuff,
    sleeveBodyRows: body,
    sleeveTotalRows: total,
    wristWidthLabel: "",
    topWidthLabel: "",
    cuffDepthLabel: "",
    sleeveBodyLengthLabel: "",
    sleeveTotalLengthLabel: "",
  });
}

function drawSleeveTargets(frame: DropShoulderSleeveDiagramFrame): string {
  const t = DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS;
  const cuffMidY = (Math.min(frame.wristY, frame.cuffJoinY) + Math.max(frame.wristY, frame.cuffJoinY)) / 2;
  return [
    `<g data-role="measurement-targets">`,
    targetCircle(t.upperArm, frame.midX, frame.upperArmY - 16),
    targetCircle(
      t.armLength,
      Math.min(frame.wristLeft, frame.upperLeft) - 40,
      (frame.top + frame.bottom) / 2,
    ),
    targetCircle(t.cuffCircumference, frame.midX, frame.wristY + 22),
    targetCircle(t.cuffDepth, frame.wristRight + 18, cuffMidY),
    `</g>`,
  ].join("");
}

export function buildDropShoulderEditSleeveMeasurementDiagramSvg(
  input: DropShoulderEditMeasurementDiagramInput,
): string {
  const unit = input.displayUnit === "cm" ? "cm" : "in";
  const frame = buildStandaloneSleeveFrame(input.measurements);
  const u = (n: number) => unitLabel(n, unit);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DS_VB_W} ${DS_VB_H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Drop shoulder sleeve measurement diagram" focusable="false" class="express-mbp-art" data-drop-shoulder-edit-diagram="true" data-drop-shoulder-edit-piece="sleeve" data-display-unit="${unit}" data-sleeve-cap="false">`,
    `<path data-role="sleeve-outline" data-sleeve-cap="false" d="${dropShoulderSleeveBodyPath(frame)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    drawSleeveCuffJoin(frame),
    drawSleeveUpperArmWidth(frame, u(input.measurements.upperArmInches)),
    drawSleeveWristWidth(frame, u(input.measurements.cuffCircumferenceInches)),
    drawSleeveCuffDepth(frame, u(input.measurements.cuffDepthInches)),
    drawSleeveTotalLength(frame, u(input.measurements.sleeveLengthInches)),
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
