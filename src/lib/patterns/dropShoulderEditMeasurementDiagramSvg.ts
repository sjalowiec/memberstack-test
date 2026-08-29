/**
 * Drop Shoulder Edit Pattern measurement diagram.
 *
 * Measurement-focused Front garment: one SVG with body + both sleeves attached
 * at the Drop Shoulder armhole openings. Reuses approved body frame/path helpers
 * and sleeve trapezoid geometry. Does not invent neckline, body-shape, or sleeve math.
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
  buildDropShoulderMeasurementSleeveFrame,
  dropShoulderSleeveBodyPath,
  drawSleeveCuffJoin,
  type DropShoulderSleeveDiagramFrame,
} from "./dropShoulderSleeveDiagramSvgShared";

/** Downward hang from a horizontal sleeve, for readability. Attach edge stays at the opening. */
export const DROP_SHOULDER_EDIT_SLEEVE_HANG_DEG = 12;

export const DROP_SHOULDER_EDIT_MEASUREMENT_TARGET_IDS = [
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.neckOpening,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.neckDepth,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.bust,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.garmentLength,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.hip,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.hem,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.armholeDepth,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.upperArm,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.armLength,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.cuffCircumference,
  DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS.cuffDepth,
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

type Pt = { x: number; y: number };

export type DropShoulderEditAttachedSleeve = {
  side: "left" | "right";
  origin: Pt;
  rotateDeg: number;
  frame: DropShoulderSleeveDiagramFrame;
};

export type DropShoulderEditMeasurementDiagramModel = {
  isVNeck: boolean;
  isCardigan: boolean;
  bodyShapeKind: SleevelessEffectiveBodyShapeKind;
  tapered: boolean;
  displayUnit: MeasurementDisplayUnit;
  frame: DropShoulderDiagramFrame;
  pxPerInch: number;
  leftSleeve: DropShoulderEditAttachedSleeve;
  rightSleeve: DropShoulderEditAttachedSleeve;
  viewBox: { x: number; y: number; width: number; height: number };
  measurements: DropShoulderEditMeasurementInput;
};

function svgRotate(x: number, y: number, deg: number): Pt {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

export function dropShoulderEditSleeveWorldPoint(
  local: Pt,
  origin: Pt,
  rotateDeg: number,
): Pt {
  const r = svgRotate(local.x, local.y, rotateDeg);
  return { x: origin.x + r.x, y: origin.y + r.y };
}

export function dropShoulderEditSleeveRotateDeg(side: "left" | "right"): number {
  return side === "right"
    ? -90 + DROP_SHOULDER_EDIT_SLEEVE_HANG_DEG
    : 90 - DROP_SHOULDER_EDIT_SLEEVE_HANG_DEG;
}

function frontWidthPxPerInch(frame: DropShoulderDiagramFrame, bustInches: number): number {
  const bodyW = Math.max(1, frame.right - frame.left);
  const frontInches = Math.max(1, bustInches / 2);
  return bodyW / frontInches;
}

function buildAttachedSleeve(
  side: "left" | "right",
  frame: DropShoulderDiagramFrame,
  measurements: DropShoulderEditMeasurementInput,
  pxPerInch: number,
): DropShoulderEditAttachedSleeve {
  const sleeveFrame = buildDropShoulderMeasurementSleeveFrame({
    upperArmWidthPx: Math.max(8, (Math.max(1, measurements.upperArmInches) / 2) * pxPerInch),
    cuffWidthPx: Math.max(6, (Math.max(1, measurements.cuffCircumferenceInches) / 2) * pxPerInch),
    sleeveLengthPx: Math.max(12, Math.max(1, measurements.sleeveLengthInches) * pxPerInch),
    cuffDepthPx: Math.max(0, measurements.cuffDepthInches) * pxPerInch,
  });
  const openingMidY = (frame.top + frame.armholeMarkerY) / 2;
  return {
    side,
    origin: {
      x: side === "right" ? frame.right : frame.left,
      y: openingMidY,
    },
    rotateDeg: dropShoulderEditSleeveRotateDeg(side),
    frame: sleeveFrame,
  };
}

function sleeveWorldCorners(sleeve: DropShoulderEditAttachedSleeve): Pt[] {
  const { frame, origin, rotateDeg } = sleeve;
  return [
    { x: frame.upperLeft, y: frame.top },
    { x: frame.upperRight, y: frame.top },
    { x: frame.wristLeft, y: frame.bottom },
    { x: frame.wristRight, y: frame.bottom },
    { x: frame.cuffJoinLeft, y: frame.cuffJoinY },
    { x: frame.cuffJoinRight, y: frame.cuffJoinY },
  ].map((p) => dropShoulderEditSleeveWorldPoint(p, origin, rotateDeg));
}

function computeViewBox(
  frame: DropShoulderDiagramFrame,
  sleeves: DropShoulderEditAttachedSleeve[],
): { x: number; y: number; width: number; height: number } {
  const pts: Pt[] = [
    { x: frame.left, y: frame.top },
    { x: frame.right, y: frame.top },
    { x: frame.hemLeft, y: frame.bottom },
    { x: frame.hemRight, y: frame.bottom },
    { x: frame.neckLeftX, y: frame.neckBottomY },
    { x: frame.neckRightX, y: frame.neckBottomY },
  ];
  for (const sleeve of sleeves) pts.push(...sleeveWorldCorners(sleeve));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
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
  const pxPerInch = frontWidthPxPerInch(rawFrame, measurements.bustInches);
  const leftSleeve = buildAttachedSleeve("left", rawFrame, measurements, pxPerInch);
  const rightSleeve = buildAttachedSleeve("right", rawFrame, measurements, pxPerInch);
  const viewBox = computeViewBox(rawFrame, [leftSleeve, rightSleeve]);
  const dx = -viewBox.x;
  const dy = -viewBox.y;
  const frame = offsetDropShoulderDiagramFrame(rawFrame, dx, dy);
  const shiftSleeve = (sleeve: DropShoulderEditAttachedSleeve): DropShoulderEditAttachedSleeve => ({
    ...sleeve,
    origin: { x: sleeve.origin.x + dx, y: sleeve.origin.y + dy },
  });
  return {
    isVNeck,
    isCardigan,
    bodyShapeKind,
    tapered,
    displayUnit: input.displayUnit === "cm" ? "cm" : "in",
    frame,
    pxPerInch,
    leftSleeve: shiftSleeve(leftSleeve),
    rightSleeve: shiftSleeve(rightSleeve),
    viewBox: { x: 0, y: 0, width: viewBox.width, height: viewBox.height },
    measurements,
  };
}

function unitLabel(inches: number, unit: MeasurementDisplayUnit): string {
  const value = formatMeasurementDisplayFromInches(inches, unit);
  if (!value) return "";
  return `${value} ${unit}`;
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

function vDim(x: number, y1: number, y2: number, role: string, label: string, labelSide: "left" | "right"): string {
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

function drawSleeve(sleeve: DropShoulderEditAttachedSleeve): string {
  const { origin, rotateDeg, frame, side } = sleeve;
  return [
    `<g data-role="sleeve" data-sleeve-side="${side}" data-sleeve-cap="false" transform="translate(${fmtNum(origin.x)} ${fmtNum(origin.y)}) rotate(${fmtNum(rotateDeg)})">`,
    `<path data-role="sleeve-outline" data-sleeve-cap="false" d="${dropShoulderSleeveBodyPath(frame)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    drawSleeveCuffJoin(frame),
    `</g>`,
  ].join("");
}

function drawDimensions(model: DropShoulderEditMeasurementDiagramModel): string {
  const { frame, measurements, displayUnit, rightSleeve } = model;
  const u = (n: number) => unitLabel(n, displayUnit);
  const bustY = frame.armholeMarkerY + (frame.hemTopY - frame.armholeMarkerY) * 0.32;
  const hipY = frame.hemTopY + (frame.bottom - frame.hemTopY) * 0.45;
  const bustX = bodyWidthXAt(frame, bustY);
  const hipX = bodyWidthXAt(frame, hipY);
  const neckY = frame.top - 18;
  const neckDepthX = frame.neckLeftX - 16;
  const lengthX = Math.max(frame.right, ...sleeveWorldCorners(rightSleeve).map((p) => p.x)) + 28;
  const hemX = frame.hemRight + 18;
  const armholeX = frame.left - 22;
  const attachTop = dropShoulderEditSleeveWorldPoint(
    { x: rightSleeve.frame.upperLeft, y: rightSleeve.frame.top },
    rightSleeve.origin,
    rightSleeve.rotateDeg,
  );
  const attachBot = dropShoulderEditSleeveWorldPoint(
    { x: rightSleeve.frame.upperRight, y: rightSleeve.frame.top },
    rightSleeve.origin,
    rightSleeve.rotateDeg,
  );
  const cuffA = dropShoulderEditSleeveWorldPoint(
    { x: rightSleeve.frame.wristLeft, y: rightSleeve.frame.bottom },
    rightSleeve.origin,
    rightSleeve.rotateDeg,
  );
  const cuffB = dropShoulderEditSleeveWorldPoint(
    { x: rightSleeve.frame.wristRight, y: rightSleeve.frame.bottom },
    rightSleeve.origin,
    rightSleeve.rotateDeg,
  );
  const cuffJoinA = dropShoulderEditSleeveWorldPoint(
    { x: rightSleeve.frame.cuffJoinLeft, y: rightSleeve.frame.cuffJoinY },
    rightSleeve.origin,
    rightSleeve.rotateDeg,
  );
  const sleeveMidOuter = dropShoulderEditSleeveWorldPoint(
    { x: (rightSleeve.frame.upperRight + rightSleeve.frame.wristRight) / 2, y: (rightSleeve.frame.top + rightSleeve.frame.bottom) / 2 },
    rightSleeve.origin,
    rightSleeve.rotateDeg,
  );
  const upperArmY = (attachTop.y + attachBot.y) / 2;
  const cuffMidX = (cuffA.x + cuffB.x) / 2;
  const cuffMidY = (cuffA.y + cuffB.y) / 2;
  const cuffJoinMidY = (cuffJoinA.y + cuffA.y) / 2;
  return [
    hDim(frame.neckLeftX, frame.neckRightX, neckY, "dim-neck-opening", u(measurements.neckOpeningInches)),
    vDim(neckDepthX, frame.top, frame.neckBottomY, "dim-neck-depth", u(measurements.neckDepthInches), "left"),
    hDim(bustX.left, bustX.right, bustY, "dim-bust", u(measurements.bustInches)),
    hDim(hipX.left, hipX.right, hipY, "dim-hip", u(measurements.hipInches)),
    vDim(lengthX, frame.top, frame.bottom, "dim-garment-length", u(measurements.garmentLengthInches), "right"),
    vDim(hemX, frame.hemTopY, frame.bottom, "dim-hem-depth", u(measurements.hemDepthInches), "right"),
    vDim(armholeX, frame.top, frame.armholeMarkerY, "dim-armhole-depth", u(measurements.armholeDepthInches), "left"),
    vDim(
      Math.min(attachTop.x, attachBot.x) + 16,
      attachTop.y,
      attachBot.y,
      "dim-upper-arm",
      u(measurements.upperArmInches),
      "right",
    ),
    vDim(
      sleeveMidOuter.x + 22,
      rightSleeve.origin.y,
      cuffMidY,
      "dim-sleeve-length",
      u(measurements.sleeveLengthInches),
      "right",
    ),
    hDim(cuffA.x, cuffB.x, cuffMidY + 16, "dim-cuff-width", u(measurements.cuffCircumferenceInches)),
    vDim(cuffMidX + 18, cuffJoinMidY, cuffMidY, "dim-cuff-depth", u(measurements.cuffDepthInches), "right"),
  ].join("");
}

function targetCircle(id: string, x: number, y: number): string {
  return `<circle id="${id}" cx="${fmtNum(x)}" cy="${fmtNum(y)}" r="2.5" fill="none"/>`;
}

function drawTargets(model: DropShoulderEditMeasurementDiagramModel): string {
  const { frame, rightSleeve } = model;
  const t = DROP_SHOULDER_SUMMARY_MEASUREMENT_TARGETS;
  const bustY = frame.armholeMarkerY + (frame.hemTopY - frame.armholeMarkerY) * 0.32;
  const hipY = frame.hemTopY + (frame.bottom - frame.hemTopY) * 0.45;
  const attachTop = dropShoulderEditSleeveWorldPoint(
    { x: rightSleeve.frame.upperLeft, y: rightSleeve.frame.top },
    rightSleeve.origin,
    rightSleeve.rotateDeg,
  );
  const attachBot = dropShoulderEditSleeveWorldPoint(
    { x: rightSleeve.frame.upperRight, y: rightSleeve.frame.top },
    rightSleeve.origin,
    rightSleeve.rotateDeg,
  );
  const cuffA = dropShoulderEditSleeveWorldPoint(
    { x: rightSleeve.frame.wristLeft, y: rightSleeve.frame.bottom },
    rightSleeve.origin,
    rightSleeve.rotateDeg,
  );
  const cuffB = dropShoulderEditSleeveWorldPoint(
    { x: rightSleeve.frame.wristRight, y: rightSleeve.frame.bottom },
    rightSleeve.origin,
    rightSleeve.rotateDeg,
  );
  const cuffJoinA = dropShoulderEditSleeveWorldPoint(
    { x: rightSleeve.frame.cuffJoinLeft, y: rightSleeve.frame.cuffJoinY },
    rightSleeve.origin,
    rightSleeve.rotateDeg,
  );
  const upperMid = { x: (attachTop.x + attachBot.x) / 2, y: (attachTop.y + attachBot.y) / 2 };
  const cuffMid = { x: (cuffA.x + cuffB.x) / 2, y: (cuffA.y + cuffB.y) / 2 };
  const sleeveLen = {
    x: Math.max(attachTop.x, cuffA.x, cuffB.x) + 22,
    y: (rightSleeve.origin.y + cuffMid.y) / 2,
  };
  const lengthX = Math.max(frame.right, cuffA.x, cuffB.x, attachTop.x) + 28;
  return [
    `<g data-role="measurement-targets">`,
    targetCircle(t.neckOpening, frame.midX, frame.top - 18),
    targetCircle(t.neckDepth, frame.neckLeftX - 16, (frame.top + frame.neckBottomY) / 2),
    targetCircle(t.bust, frame.midX, bustY),
    targetCircle(t.hip, frame.midX, hipY),
    targetCircle(t.garmentLength, lengthX, (frame.top + frame.bottom) / 2),
    targetCircle(t.hem, frame.hemRight + 18, (frame.hemTopY + frame.bottom) / 2),
    targetCircle(t.armholeDepth, frame.left - 22, (frame.top + frame.armholeMarkerY) / 2),
    targetCircle(t.upperArm, upperMid.x + 16, upperMid.y),
    targetCircle(t.armLength, sleeveLen.x, sleeveLen.y),
    targetCircle(t.cuffCircumference, cuffMid.x, cuffMid.y + 16),
    targetCircle(t.cuffDepth, cuffMid.x + 18, (cuffJoinA.y + cuffMid.y) / 2),
    `</g>`,
  ].join("");
}

export function buildDropShoulderEditMeasurementDiagramSvg(
  input: DropShoulderEditMeasurementDiagramInput,
): string {
  const model = buildDropShoulderEditMeasurementDiagramModel(input);
  const { width, height } = model.viewBox;
  const neckline = model.isVNeck ? "v-neck" : "round";
  const garment = model.isCardigan ? "cardigan" : "pullover";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmtNum(width)} ${fmtNum(height)}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Drop shoulder sweater measurement diagram" focusable="false" class="express-mbp-art" data-drop-shoulder-edit-diagram="true" data-drop-shoulder-edit-neckline="${neckline}" data-drop-shoulder-edit-garment="${garment}" data-drop-shoulder-edit-body-shape="${model.bodyShapeKind}" data-display-unit="${model.displayUnit}" data-integrated-garment="true" data-sleeve-count="2">`,
    drawSleeve(model.leftSleeve),
    drawSleeve(model.rightSleeve),
    drawBody(model),
    drawDimensions(model),
    drawTargets(model),
    `</svg>`,
  ].join("");
}

export { bodyWidthXAt as dropShoulderEditBodyWidthXAt };
