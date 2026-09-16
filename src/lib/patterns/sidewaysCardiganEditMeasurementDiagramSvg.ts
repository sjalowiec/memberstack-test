/**
 * Sideways V-Neck Summary/Edit measurement diagram.
 *
 * Finished-garment profile sized from inch measurements — not stitch or row counts.
 * Cardigan: unrolled sideways body (fronts above and below the back, V-neck at each
 * center front). Pullover: closed body that starts at an underarm (scrap-on / graft),
 * not at center front.
 */

import { computeDropShoulderArmholeDepthInches } from "./dropShoulderArmholeDepth";
import {
  DS_ARROW,
  DS_FILL,
  DS_FONT,
  DS_MUTED,
  DS_STROKE,
  DS_VB_H,
  DS_VB_W,
  endCap,
  fmtNum,
} from "./dropShoulderPatternDiagramSvgShared";
import {
  buildDropShoulderMeasurementSleeveFrame,
  dropShoulderSleeveBodyPath,
  drawSleeveCuffJoin,
  offsetDropShoulderSleeveDiagramFrame,
  type DropShoulderSleeveDiagramFrame,
} from "./dropShoulderSleeveDiagramSvgShared";
import type { DropShoulderEditPreviewTab } from "./dropShoulderEditMeasurementPreview";
import type { MeasurementDisplayUnit } from "./patternMeasurementDisplayUnit";
import type { SidewaysCardiganGarmentStyle } from "./sidewaysCardiganConstructionIdentity";

export const SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS = {
  finishedBust: "target_sideways_bust",
  finishedLength: "target_sideways_back_length",
  neckOpeningWidth: "target_sideways_neck_opening",
  vNeckDepth: "target_sideways_vneck_depth",
  armholeDepth: "target_sideways_armhole_depth",
  upperArm: "target_sideways_upper_arm",
  sleeveLength: "target_sideways_sleeve_length",
  wrist: "target_sideways_wrist",
} as const;

export const SIDEWAYS_SUMMARY_DERIVED_ROLES = {
  armholeDepth: "derived-armhole-depth",
  shoulderSection: "derived-shoulder-section",
  halfNeckOpening: "derived-half-neck-opening",
} as const;

const PAD = { top: 56, right: 96, bottom: 118, left: 132 };
const MIN_SECTION = 28;
const MIN_V_CUT = 26;
const MIN_ARMHOLE = 18;
const MIN_BODY_W = 88;
const MIN_SLEEVE_L = 48;
const MIN_SLEEVE_W = 22;

export type SidewaysCardiganEditMeasurementInput = {
  finishedBustInches: number;
  finishedLengthInches: number;
  neckOpeningWidthInches: number;
  vNeckDepthInches: number;
  finishedUpperArmInches: number;
  sleeveLengthInches: number;
  wristInches: number;
  backNeckDepthInches?: number;
};

export type SidewaysCardiganEditMeasurementDiagramInput = {
  measurements: SidewaysCardiganEditMeasurementInput;
  garmentStyle: SidewaysCardiganGarmentStyle;
  displayUnit?: MeasurementDisplayUnit;
};

export type SidewaysCardiganSummaryDerivedInches = {
  armholeDepthInches: number;
  halfNeckOpeningInches: number;
  shoulderSectionInches: number;
};

export type SidewaysCardiganEditMeasurementFrame = {
  garmentStyle: SidewaysCardiganGarmentStyle;
  hemX: number;
  neckX: number;
  bodyW: number;
  topY: number;
  bottomY: number;
  firstVEndY: number;
  firstArmholeY: number;
  backNeckStartY: number;
  backNeckEndY: number;
  secondArmholeY: number;
  secondVStartY: number;
  vCutX: number;
  armholeX: number;
  backNeckX: number;
  sleeve: {
    attachX: number;
    attachY: number;
    farX: number;
    upperHalf: number;
    wristHalf: number;
  };
  derived: SidewaysCardiganSummaryDerivedInches;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function positive(n: number, fallback: number): number {
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function derivedSidewaysSummaryInches(
  measurements: SidewaysCardiganEditMeasurementInput,
): SidewaysCardiganSummaryDerivedInches {
  const armholeDepthInches =
    computeDropShoulderArmholeDepthInches(measurements.finishedUpperArmInches) ??
    measurements.finishedUpperArmInches / 2;
  const neck = positive(measurements.neckOpeningWidthInches, 1);
  const bust = positive(measurements.finishedBustInches, neck * 3 + 4);
  const remaining = bust - 3 * neck;
  return {
    armholeDepthInches,
    halfNeckOpeningInches: neck / 2,
    shoulderSectionInches: remaining > 0 ? remaining / 4 : 0.25,
  };
}

function visual(inches: number, pxPerInch: number, minPx: number): number {
  return Math.max(minPx, positive(inches, 1) * pxPerInch);
}

function buildFrame(
  measurements: SidewaysCardiganEditMeasurementInput,
  garmentStyle: SidewaysCardiganGarmentStyle,
): SidewaysCardiganEditMeasurementFrame {
  const derived = derivedSidewaysSummaryInches(measurements);
  const bust = positive(measurements.finishedBustInches, 40);
  const length = positive(measurements.finishedLengthInches, 22);
  const neck = positive(measurements.neckOpeningWidthInches, 7);
  const vDepth = positive(measurements.vNeckDepthInches, 6);
  const armhole = positive(derived.armholeDepthInches, 6);
  const backNeck = clamp(
    positive(measurements.backNeckDepthInches ?? 1, 1),
    0.5,
    Math.max(0.75, length * 0.35),
  );
  const sleeveLen = positive(measurements.sleeveLengthInches, 16);
  const upperFlat = positive(measurements.finishedUpperArmInches, 12) / 2;
  const wristFlat = Math.min(upperFlat * 0.95, positive(measurements.wristInches, 7) / 2);
  const shoulder = positive(derived.shoulderSectionInches, 2);

  const contentW = 320;
  const contentH = 540;
  const pxPerInch = Math.min(
    contentW / Math.max(length + sleeveLen * 0.85, 1),
    contentH / Math.max(bust, 1),
  );

  const isPullover = garmentStyle === "pullover";
  let bodyW = visual(length, pxPerInch, MIN_BODY_W);
  let vCut = visual(vDepth, pxPerInch, MIN_V_CUT);
  let armholeCut = visual(armhole, pxPerInch, MIN_ARMHOLE);
  const backNeckCut = visual(backNeck, pxPerInch, 16);
  vCut = Math.min(vCut, bodyW * 0.72);
  armholeCut = Math.min(armholeCut, bodyW * (isPullover ? 0.55 : 0.2));

  let vH = visual(neck, pxPerInch, MIN_SECTION);
  let shoulderH = visual(shoulder, pxPerInch, MIN_SECTION);
  const sectionsH = 3 * vH + 4 * shoulderH;
  if (sectionsH > contentH) {
    const k = contentH / sectionsH;
    vH *= k;
    shoulderH *= k;
  }

  const hemX = PAD.left;
  const neckX = hemX + bodyW;
  const topY = PAD.top;
  // Cardigan knits CF → front → armhole → back → armhole → front → CF.
  // Pullover starts at an underarm, knits the closed V in the front, then the
  // opposite armhole and back, and grafts at the original underarm.
  const firstVEndY = isPullover ? topY + shoulderH + vH : topY + vH;
  const firstArmholeY = isPullover ? topY + shoulderH : firstVEndY + shoulderH;
  const pulloverSecondVEndY = firstVEndY + vH;
  const secondArmholeY = isPullover
    ? pulloverSecondVEndY + shoulderH
    : firstArmholeY + shoulderH + vH + shoulderH;
  const backNeckStartY = isPullover
    ? secondArmholeY + shoulderH
    : firstArmholeY + shoulderH;
  const backNeckEndY = backNeckStartY + vH;
  const resolvedSecondVStartY = isPullover ? pulloverSecondVEndY : secondArmholeY + shoulderH;
  const bottomY = isPullover ? backNeckEndY + shoulderH : resolvedSecondVStartY + vH;

  const sleeveLenPx = visual(sleeveLen, pxPerInch, MIN_SLEEVE_L);
  const upperHalf = visual(upperFlat, pxPerInch, MIN_SLEEVE_W);
  const wristHalf = visual(wristFlat, pxPerInch, 14);
  const attachY = isPullover ? secondArmholeY : firstArmholeY;

  return {
    garmentStyle,
    hemX,
    neckX,
    bodyW,
    topY,
    bottomY,
    firstVEndY,
    firstArmholeY,
    backNeckStartY,
    backNeckEndY,
    secondArmholeY,
    secondVStartY: resolvedSecondVStartY,
    vCutX: neckX - vCut,
    armholeX: neckX - armholeCut,
    backNeckX: neckX - Math.min(backNeckCut, bodyW * 0.28),
    sleeve: {
      attachX: neckX,
      attachY,
      farX: neckX + sleeveLenPx,
      upperHalf,
      wristHalf,
    },
    derived,
  };
}

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

function derivedLabel(x: number, y: number, text: string, role: string): string {
  return `<text data-role="${role}" x="${fmtNum(x)}" y="${fmtNum(y)}" text-anchor="middle" font-family="${DS_FONT}" font-size="11" fill="${DS_MUTED}">${text}</text>`;
}

function cardiganBodyPath(frame: SidewaysCardiganEditMeasurementFrame): string {
  const {
    hemX,
    neckX,
    vCutX,
    backNeckX,
    topY,
    firstVEndY,
    backNeckStartY,
    backNeckEndY,
    secondVStartY,
    bottomY,
  } = frame;
  return [
    `M ${fmtNum(hemX)} ${fmtNum(topY)}`,
    `L ${fmtNum(vCutX)} ${fmtNum(topY)}`,
    `L ${fmtNum(neckX)} ${fmtNum(firstVEndY)}`,
    `L ${fmtNum(neckX)} ${fmtNum(backNeckStartY)}`,
    `L ${fmtNum(backNeckX)} ${fmtNum(backNeckStartY)}`,
    `L ${fmtNum(backNeckX)} ${fmtNum(backNeckEndY)}`,
    `L ${fmtNum(neckX)} ${fmtNum(backNeckEndY)}`,
    `L ${fmtNum(neckX)} ${fmtNum(secondVStartY)}`,
    `L ${fmtNum(vCutX)} ${fmtNum(bottomY)}`,
    `L ${fmtNum(hemX)} ${fmtNum(bottomY)}`,
    "Z",
  ].join(" ");
}

function pulloverBodyPath(frame: SidewaysCardiganEditMeasurementFrame): string {
  const {
    hemX,
    neckX,
    vCutX,
    armholeX,
    backNeckX,
    topY,
    firstVEndY,
    firstArmholeY,
    backNeckStartY,
    backNeckEndY,
    secondArmholeY,
    secondVStartY,
    bottomY,
  } = frame;
  return [
    `M ${fmtNum(hemX)} ${fmtNum(topY)}`,
    `L ${fmtNum(neckX)} ${fmtNum(topY)}`,
    `L ${fmtNum(neckX)} ${fmtNum(firstArmholeY)}`,
    `L ${fmtNum(vCutX)} ${fmtNum(firstVEndY)}`,
    `L ${fmtNum(neckX)} ${fmtNum(secondVStartY)}`,
    `L ${fmtNum(neckX)} ${fmtNum(secondArmholeY)}`,
    `L ${fmtNum(armholeX)} ${fmtNum(secondArmholeY)}`,
    `L ${fmtNum(neckX)} ${fmtNum(secondArmholeY)}`,
    `L ${fmtNum(neckX)} ${fmtNum(backNeckStartY)}`,
    `L ${fmtNum(backNeckX)} ${fmtNum(backNeckStartY)}`,
    `L ${fmtNum(backNeckX)} ${fmtNum(backNeckEndY)}`,
    `L ${fmtNum(neckX)} ${fmtNum(backNeckEndY)}`,
    `L ${fmtNum(neckX)} ${fmtNum(bottomY)}`,
    `L ${fmtNum(hemX)} ${fmtNum(bottomY)}`,
    "Z",
  ].join(" ");
}

function sleevePath(frame: SidewaysCardiganEditMeasurementFrame): string {
  const { attachX, attachY, farX, upperHalf, wristHalf } = frame.sleeve;
  return [
    `M ${fmtNum(attachX)} ${fmtNum(attachY - upperHalf)}`,
    `L ${fmtNum(farX)} ${fmtNum(attachY - wristHalf)}`,
    `L ${fmtNum(farX)} ${fmtNum(attachY + wristHalf)}`,
    `L ${fmtNum(attachX)} ${fmtNum(attachY + upperHalf)}`,
    "Z",
  ].join(" ");
}

function drawCardiganMarkers(frame: SidewaysCardiganEditMeasurementFrame): string {
  return [
    `<line data-role="center-front-start" x1="${fmtNum(frame.hemX)}" y1="${fmtNum(frame.topY)}" x2="${fmtNum(frame.vCutX)}" y2="${fmtNum(frame.topY)}" fill="none" stroke="${DS_STROKE}" stroke-width="2"/>`,
    `<line data-role="center-front-end" x1="${fmtNum(frame.hemX)}" y1="${fmtNum(frame.bottomY)}" x2="${fmtNum(frame.vCutX)}" y2="${fmtNum(frame.bottomY)}" fill="none" stroke="${DS_STROKE}" stroke-width="2"/>`,
    `<line data-role="v-neck" data-side="first" x1="${fmtNum(frame.vCutX)}" y1="${fmtNum(frame.topY)}" x2="${fmtNum(frame.neckX)}" y2="${fmtNum(frame.firstVEndY)}" fill="none" stroke="${DS_STROKE}" stroke-width="1.6"/>`,
    `<line data-role="v-neck" data-side="second" x1="${fmtNum(frame.neckX)}" y1="${fmtNum(frame.secondVStartY)}" x2="${fmtNum(frame.vCutX)}" y2="${fmtNum(frame.bottomY)}" fill="none" stroke="${DS_STROKE}" stroke-width="1.6"/>`,
    `<line data-role="first-front" data-join="first-armhole" x1="${fmtNum(frame.hemX)}" y1="${fmtNum(frame.firstArmholeY)}" x2="${fmtNum(frame.neckX)}" y2="${fmtNum(frame.firstArmholeY)}" fill="none" stroke="${DS_STROKE}" stroke-width="1.4"/>`,
    `<line data-role="back-panel" data-join="second-armhole" x1="${fmtNum(frame.hemX)}" y1="${fmtNum(frame.secondArmholeY)}" x2="${fmtNum(frame.neckX)}" y2="${fmtNum(frame.secondArmholeY)}" fill="none" stroke="${DS_STROKE}" stroke-width="1.4"/>`,
    `<line data-role="second-front" x1="${fmtNum(frame.hemX)}" y1="${fmtNum(frame.secondArmholeY)}" x2="${fmtNum(frame.hemX)}" y2="${fmtNum(frame.bottomY)}" fill="none" stroke="${DS_STROKE}" stroke-width="1.4"/>`,
  ].join("");
}

function drawPulloverMarkers(frame: SidewaysCardiganEditMeasurementFrame): string {
  const midX = (frame.hemX + frame.neckX) / 2;
  return [
    `<line data-role="underarm-start" data-scrap-on="true" x1="${fmtNum(frame.hemX)}" y1="${fmtNum(frame.topY)}" x2="${fmtNum(frame.neckX)}" y2="${fmtNum(frame.topY)}" fill="none" stroke="${DS_STROKE}" stroke-width="2" stroke-dasharray="6 4"/>`,
    `<line data-role="graft-join" data-scrap-off="true" x1="${fmtNum(frame.hemX)}" y1="${fmtNum(frame.bottomY)}" x2="${fmtNum(frame.neckX)}" y2="${fmtNum(frame.bottomY)}" fill="none" stroke="${DS_STROKE}" stroke-width="2" stroke-dasharray="6 4"/>`,
    `<polyline data-role="v-neck" data-closed-front="true" points="${fmtNum(frame.neckX)},${fmtNum(frame.firstArmholeY)} ${fmtNum(frame.vCutX)},${fmtNum(frame.firstVEndY)} ${fmtNum(frame.neckX)},${fmtNum(frame.secondVStartY)}" fill="none" stroke="${DS_STROKE}" stroke-width="1.6"/>`,
    `<text data-role="underarm-start-label" x="${fmtNum(midX)}" y="${fmtNum(frame.topY - 10)}" text-anchor="middle" font-family="${DS_FONT}" font-size="11" fill="${DS_MUTED}">Start at underarm · scrap on / graft</text>`,
  ].join("");
}

function drawArmholeAndBack(frame: SidewaysCardiganEditMeasurementFrame): string {
  const first = frame.garmentStyle === "cardigan";
  const parts = [
    `<line data-role="armhole-slit" data-side="${first ? "first" : "opposite"}" x1="${fmtNum(frame.armholeX)}" y1="${fmtNum(first ? frame.firstArmholeY : frame.secondArmholeY)}" x2="${fmtNum(frame.neckX)}" y2="${fmtNum(first ? frame.firstArmholeY : frame.secondArmholeY)}" fill="none" stroke="${DS_STROKE}" stroke-width="1.8"/>`,
  ];
  if (first) {
    parts.push(
      `<line data-role="armhole-slit" data-side="second" x1="${fmtNum(frame.armholeX)}" y1="${fmtNum(frame.secondArmholeY)}" x2="${fmtNum(frame.neckX)}" y2="${fmtNum(frame.secondArmholeY)}" fill="none" stroke="${DS_STROKE}" stroke-width="1.8"/>`,
    );
  } else {
    parts.push(
      `<rect data-role="back-neck" x="${fmtNum(frame.backNeckX)}" y="${fmtNum(frame.backNeckStartY)}" width="${fmtNum(frame.neckX - frame.backNeckX)}" height="${fmtNum(frame.backNeckEndY - frame.backNeckStartY)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.2"/>`,
    );
  }
  return parts.join("");
}

function drawPulloverDimensions(frame: SidewaysCardiganEditMeasurementFrame): string {
  const bustX = frame.hemX - 36;
  const lengthY = frame.bottomY + 28;
  const vDepthY = (frame.firstVEndY + frame.secondVStartY) / 2;
  const halfNeckY = (frame.topY + frame.firstVEndY) / 2;
  const shoulderMidY = (frame.firstVEndY + frame.firstArmholeY) / 2;
  const armholeY = frame.secondArmholeY;
  return [
    vDim(bustX, frame.topY, frame.bottomY, "dim-finished-bust"),
    hDim(frame.hemX, frame.neckX, lengthY, "dim-finished-back-length"),
    vDim(frame.neckX + 18, frame.topY, frame.firstVEndY, "dim-neck-opening"),
    hDim(frame.vCutX, frame.neckX, vDepthY, "dim-vneck-depth"),
    hDim(frame.armholeX, frame.neckX, armholeY - 16, "dim-armhole-depth"),
    vDim(frame.hemX + 22, frame.firstVEndY, frame.firstArmholeY, "dim-shoulder-section"),
    vDim(frame.neckX + 18, frame.topY, halfNeckY, "dim-half-neck-opening"),
    derivedLabel((frame.armholeX + frame.neckX) / 2, armholeY - 22, "Armhole depth", SIDEWAYS_SUMMARY_DERIVED_ROLES.armholeDepth),
    derivedLabel(frame.hemX + 22, shoulderMidY - 8, "Shoulder", SIDEWAYS_SUMMARY_DERIVED_ROLES.shoulderSection),
    derivedLabel(frame.neckX + 48, (frame.topY + halfNeckY) / 2, "½ neck opening", SIDEWAYS_SUMMARY_DERIVED_ROLES.halfNeckOpening),
  ].join("");
}

function drawCardiganDimensions(frame: SidewaysCardiganEditMeasurementFrame): string {
  const bustX = Math.max(18, frame.hemX - 48);
  const midBackY = (frame.firstArmholeY + frame.secondArmholeY) / 2;
  const neckDimX = frame.neckX + 40;
  const shoulderDimX = frame.neckX + 40;
  const halfNeckMidY = (frame.secondVStartY + frame.bottomY) / 2;
  const shoulderMidY = (frame.secondArmholeY + frame.secondVStartY) / 2;
  return [
    vDim(bustX, frame.topY, frame.bottomY, "dim-finished-bust"),
    hDim(frame.hemX, frame.neckX, midBackY, "dim-finished-back-length"),
    vDim(neckDimX, frame.backNeckStartY, frame.backNeckEndY, "dim-neck-opening"),
    hDim(frame.vCutX, frame.neckX, frame.bottomY + 32, "dim-vneck-depth"),
    hDim(frame.armholeX, frame.neckX, frame.secondArmholeY - 14, "dim-armhole-depth"),
    vDim(shoulderDimX, frame.secondArmholeY, frame.secondVStartY, "dim-shoulder-section"),
    vDim(neckDimX, frame.secondVStartY, frame.bottomY, "dim-half-neck-opening"),
    derivedLabel((frame.armholeX + frame.neckX) / 2, frame.secondArmholeY - 22, "Armhole depth", SIDEWAYS_SUMMARY_DERIVED_ROLES.armholeDepth),
    derivedLabel(shoulderDimX + 52, shoulderMidY, "Shoulder", SIDEWAYS_SUMMARY_DERIVED_ROLES.shoulderSection),
    derivedLabel(neckDimX + 52, halfNeckMidY, "½ neck opening", SIDEWAYS_SUMMARY_DERIVED_ROLES.halfNeckOpening),
  ].join("");
}

function drawDimensions(frame: SidewaysCardiganEditMeasurementFrame): string {
  return frame.garmentStyle === "pullover"
    ? drawPulloverDimensions(frame)
    : drawCardiganDimensions(frame);
}

function drawPulloverTargets(frame: SidewaysCardiganEditMeasurementFrame): string {
  const t = SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS;
  const armholeY = frame.secondArmholeY;
  return [
    `<g data-role="measurement-targets">`,
    targetCircle(t.finishedBust, frame.hemX - 36, (frame.topY + frame.bottomY) / 2),
    targetCircle(t.finishedLength, (frame.hemX + frame.neckX) / 2, frame.bottomY + 28),
    targetCircle(t.neckOpeningWidth, frame.neckX + 18, (frame.topY + frame.firstVEndY) / 2),
    targetCircle(t.vNeckDepth, (frame.vCutX + frame.neckX) / 2, frame.firstVEndY),
    targetCircle(t.armholeDepth, (frame.armholeX + frame.neckX) / 2, armholeY - 16),
    `</g>`,
  ].join("");
}

function drawCardiganTargets(frame: SidewaysCardiganEditMeasurementFrame): string {
  const t = SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS;
  const bustX = Math.max(18, frame.hemX - 48);
  const midBackY = (frame.firstArmholeY + frame.secondArmholeY) / 2;
  return [
    `<g data-role="measurement-targets">`,
    targetCircle(t.finishedBust, bustX, (frame.topY + frame.bottomY) / 2),
    targetCircle(t.finishedLength, (frame.hemX + frame.neckX) / 2, midBackY),
    targetCircle(t.neckOpeningWidth, frame.neckX + 40, (frame.backNeckStartY + frame.backNeckEndY) / 2),
    targetCircle(t.vNeckDepth, (frame.vCutX + frame.neckX) / 2, frame.bottomY + 32),
    targetCircle(t.armholeDepth, (frame.armholeX + frame.neckX) / 2, frame.secondArmholeY - 14),
    `</g>`,
  ].join("");
}

function drawTargets(frame: SidewaysCardiganEditMeasurementFrame): string {
  return frame.garmentStyle === "pullover"
    ? drawPulloverTargets(frame)
    : drawCardiganTargets(frame);
}

function viewBoxFor(frame: SidewaysCardiganEditMeasurementFrame): { width: number; height: number } {
  if (frame.garmentStyle === "pullover") {
    const maxX = frame.sleeve.farX + 40;
    const maxY = frame.bottomY + 48;
    return {
      width: Math.ceil(maxX + PAD.right * 0.35),
      height: Math.ceil(maxY + PAD.bottom * 0.35),
    };
  }
  const maxX = frame.neckX + 110;
  const maxY = frame.bottomY + 86;
  return {
    width: Math.ceil(Math.max(maxX, PAD.left + frame.bodyW + PAD.right)),
    height: Math.ceil(maxY),
  };
}

export function buildSidewaysCardiganEditMeasurementFrame(
  input: SidewaysCardiganEditMeasurementDiagramInput,
): SidewaysCardiganEditMeasurementFrame {
  return buildFrame(input.measurements, input.garmentStyle);
}

const DS_SLEEVE_PAD_TOP = 64;
const DS_SLEEVE_PAD_BOTTOM = 68;
const DS_SLEEVE_PAD_LEFT = 84;
const DS_SLEEVE_PAD_RIGHT = 78;
const DS_SLEEVE_REF_LENGTH_IN = 22;
const DS_SLEEVE_REF_FLAT_WIDTH_IN = 9;
const DS_SLEEVE_CONTENT_FILL = 0.78;
const DS_SLEEVE_DIM = {
  upperArm: 20,
  cuffCirc: 24,
  sleeveLength: 32,
} as const;

function buildSidewaysSleeveFrame(
  measurements: SidewaysCardiganEditMeasurementInput,
): DropShoulderSleeveDiagramFrame {
  const lengthIn = Math.max(1, measurements.sleeveLengthInches);
  const upperFlatIn = Math.max(0.5, measurements.finishedUpperArmInches / 2);
  const cuffFlatIn = Math.max(0.4, measurements.wristInches / 2);
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
    cuffDepthPx: 0,
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

function drawSidewaysSleeveTargets(frame: DropShoulderSleeveDiagramFrame): string {
  const t = SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS;
  const lengthX = Math.min(frame.wristLeft, frame.upperLeft) - DS_SLEEVE_DIM.sleeveLength;
  return [
    `<g data-role="measurement-targets">`,
    targetCircle(t.upperArm, frame.midX, frame.upperArmY - DS_SLEEVE_DIM.upperArm),
    targetCircle(t.sleeveLength, lengthX, (frame.top + frame.bottom) / 2),
    targetCircle(t.wrist, frame.midX, frame.wristY + DS_SLEEVE_DIM.cuffCirc),
    `</g>`,
  ].join("");
}

function drawSidewaysSleeveDimensions(frame: DropShoulderSleeveDiagramFrame): string {
  const lengthX = Math.min(frame.wristLeft, frame.upperLeft) - DS_SLEEVE_DIM.sleeveLength;
  return [
    hDim(frame.upperLeft, frame.upperRight, frame.upperArmY - DS_SLEEVE_DIM.upperArm, "dim-upper-arm"),
    hDim(frame.wristLeft, frame.wristRight, frame.wristY + DS_SLEEVE_DIM.cuffCirc, "dim-wrist"),
    vDim(lengthX, frame.top, frame.bottom, "dim-sleeve-length"),
  ].join("");
}

export function buildSidewaysCardiganEditSleeveMeasurementDiagramSvg(
  input: SidewaysCardiganEditMeasurementDiagramInput,
): string {
  const unit = input.displayUnit === "cm" ? "cm" : "in";
  const frame = buildSidewaysSleeveFrame(input.measurements);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DS_VB_W} ${DS_VB_H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Sideways sweater sleeve measurement diagram" focusable="false" class="express-mbp-art" data-sideways-edit-diagram="${input.garmentStyle === "pullover" ? "pullover" : "cardigan"}" data-sideways-edit-piece="sleeve" data-sleeve-cap="false" data-display-unit="${unit}">`,
    `<path data-role="sleeve-outline" data-sleeve-cap="false" d="${dropShoulderSleeveBodyPath(frame)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    drawSleeveCuffJoin(frame),
    drawSidewaysSleeveDimensions(frame),
    drawSidewaysSleeveTargets(frame),
    `</svg>`,
  ].join("");
}

export function buildSidewaysCardiganEditBodyMeasurementDiagramSvg(
  input: SidewaysCardiganEditMeasurementDiagramInput,
): string {
  const garmentStyle = input.garmentStyle === "pullover" ? "pullover" : "cardigan";
  const frame = buildFrame(input.measurements, garmentStyle);
  const { width, height } = viewBoxFor(frame);
  const unit = input.displayUnit === "cm" ? "cm" : "in";
  const start = garmentStyle === "pullover" ? "underarm" : "center-front";
  const bodyD = garmentStyle === "pullover" ? pulloverBodyPath(frame) : cardiganBodyPath(frame);
  const aria =
    garmentStyle === "pullover"
      ? "Sideways pullover measurement diagram starting at the underarm"
      : "Sideways cardigan measurement diagram starting at center front";
  const sleeve =
    garmentStyle === "pullover"
      ? `<path data-role="sleeve-outline" d="${sleevePath(frame)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`
      : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmtNum(width)} ${fmtNum(height)}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${aria}" focusable="false" class="express-mbp-art" data-sideways-edit-diagram="${garmentStyle}" data-sideways-edit-piece="body" data-sideways-start="${start}" data-cardigan-structure="${garmentStyle === "cardigan" ? "front-back-front" : "underarm-graft"}" data-display-unit="${unit}">`,
    `<path data-role="body-outline" data-garment-style="${garmentStyle}" d="${bodyD}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    sleeve,
    drawArmholeAndBack(frame),
    garmentStyle === "pullover" ? drawPulloverMarkers(frame) : drawCardiganMarkers(frame),
    drawDimensions(frame),
    drawTargets(frame),
    `</svg>`,
  ].join("");
}

export function buildSidewaysCardiganEditMeasurementDiagramSvg(
  input: SidewaysCardiganEditMeasurementDiagramInput,
  piece: DropShoulderEditPreviewTab = "body",
): string {
  return piece === "sleeve"
    ? buildSidewaysCardiganEditSleeveMeasurementDiagramSvg(input)
    : buildSidewaysCardiganEditBodyMeasurementDiagramSvg(input);
}
