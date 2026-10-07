/**
 * Sideways V-Neck Summary/Edit measurement diagram.
 *
 * Finished-garment profile sized from inch measurements — not stitch or row counts.
 * Cardigan: unrolled sideways body (fronts above and below the back, V-neck at each
 * center front). Pullover Build/Edit: closed body only, starting at an underarm
 * (scrap-on / graft) with a V-neck. No sleeve is drawn on that body diagram.
 * The finished-pattern pullover still attaches a sleeve from the same frame.
 *
 * Pullover place markers are the exception. They use the first-armhole stitch
 * location from the body calculation so the diagrams match the written instructions.
 */

import {
  buildDiagramTypographyForViewBox,
  type BuildDiagramTypography,
} from "./buildDiagramTypography";
import { computeDropShoulderArmholeDepthInches } from "./dropShoulderArmholeDepth";
import {
  DS_ARROW,
  DS_FILL,
  DS_FONT,
  DS_MUTED,
  DS_STROKE,
  endCap,
  escapeXml,
  fmtNum,
} from "./dropShoulderPatternDiagramSvgShared";
import { sidewaysFractionFromNeckX } from "./sidewaysCardiganBodyCalc";
import { diagramMarkupBounds, separateOverlappingDiagramLabels } from "./legoBlocks/patternDiagramFit";
import {
  dropShoulderSleeveBodyPath,
  drawSleeveCuffJoin,
  offsetDropShoulderSleeveDiagramFrame,
  type DropShoulderSleeveDiagramFrame,
} from "./dropShoulderSleeveDiagramSvgShared";
import {
  SIDEWAYS_SLEEVE_PX_PER_INCH,
  sidewaysProportionalSleeveLocalFrame,
} from "./sidewaysSleeveProportionalGeometry";
import type { DropShoulderEditPreviewTab } from "./dropShoulderEditMeasurementPreview";
import {
  formatMeasurementDisplayFromInches,
  type MeasurementDisplayUnit,
} from "./patternMeasurementDisplayUnit";
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
  neckOpening: "derived-neck-opening",
  frontSection: "derived-front-section",
  backSection: "derived-back-section",
} as const;

const PAD = { top: 56, right: 168, bottom: 118, left: 132 };
const MIN_SLEEVE_L = 48;
const MIN_SLEEVE_W = 22;
/** Cardigan Body dimension lanes — offsets from the garment, not stitch/row math. */
const CARDIGAN_DIM = {
  bustLane: 40,
  sectionLane: 24,
  capSep: 8,
  extGap: 5,
  extStandoff: 2,
  lengthOffset: 64,
  neckLane: 18,
  /**
   * ViewBox space to the left of the outer bust dimension. The Finished bust/chest
   * chip parks to the left of that line (`translate(calc(-100% - 8px), -50%)`).
   */
  bustChipGutter: 168,
} as const;

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
  /**
   * Pullover only. Fraction and stitch count already computed by the body calculation
   * so this drawing does not run a second stitch path.
   */
  placeMarker?: SidewaysFirstArmholePlaceMarker | null;
};

/** Pullover first-armhole side seam, already resolved by the shared body calculation. */
export type SidewaysFirstArmholePlaceMarker = {
  fractionFromNeck: number;
  stitchesFromNeck: number;
};

/**
 * Pullover body diagrams pass false so the body scales from body inches only.
 * The sleeve is a separate piece and is not drawn on the body frame.
 */
export type SidewaysCardiganEditMeasurementFrameOptions = {
  includeAttachedSleeve?: boolean;
  /** Pullover first-armhole side seam. Cardigan frames ignore this. */
  firstArmholePlaceMarker?: SidewaysFirstArmholePlaceMarker | null;
};

export type SidewaysCardiganSummaryDerivedInches = {
  armholeDepthInches: number;
  halfNeckOpeningInches: number;
  shoulderSectionInches: number;
  frontSectionInches: number;
  backSectionInches: number;
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
  /** Null on cardigan, and on a pullover diagram that has no resolved marker yet. */
  firstArmholePlaceMarker: SidewaysFirstArmholePlaceMarker | null;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function positive(n: number, fallback: number): number {
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Inch-level derived display measurements for the Summary/Edit Body SVG.
 *
 * Matches {@link calculateSidewaysCardiganBody} before row rounding:
 *   each front = bust / 4
 *   back = bust / 2 = 2 × front
 *   ½ neck opening = neck / 2
 *   each shoulder = front − ½ neck
 *   armhole slit depth = upper arm / 2 ({@link computeDropShoulderArmholeDepthInches})
 */
export function derivedSidewaysSummaryInches(
  measurements: SidewaysCardiganEditMeasurementInput,
): SidewaysCardiganSummaryDerivedInches {
  const armholeDepthInches =
    computeDropShoulderArmholeDepthInches(measurements.finishedUpperArmInches) ??
    measurements.finishedUpperArmInches / 2;
  const neck = positive(measurements.neckOpeningWidthInches, 1);
  const bust = positive(measurements.finishedBustInches, 40);
  const frontSectionInches = bust / 4;
  const backSectionInches = bust / 2;
  const halfNeckOpeningInches = neck / 2;
  const rawShoulder = frontSectionInches - halfNeckOpeningInches;
  const shoulderSectionInches = rawShoulder > 0 ? rawShoulder : 0.25;
  return {
    armholeDepthInches,
    halfNeckOpeningInches,
    shoulderSectionInches,
    frontSectionInches,
    backSectionInches,
  };
}

function scaled(inches: number, pxPerInch: number): number {
  return Math.max(0.5, positive(inches, 1) * pxPerInch);
}

function buildFrame(
  measurements: SidewaysCardiganEditMeasurementInput,
  garmentStyle: SidewaysCardiganGarmentStyle,
  options?: SidewaysCardiganEditMeasurementFrameOptions,
): SidewaysCardiganEditMeasurementFrame {
  const derived = derivedSidewaysSummaryInches(measurements);
  const bust = positive(measurements.finishedBustInches, 40);
  const length = positive(measurements.finishedLengthInches, 22);
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
  const isPullover = garmentStyle === "pullover";
  // Pullover body diagrams opt out. Cardigan never spends horizontal scale on a sleeve.
  const includeAttachedSleeve = isPullover && options?.includeAttachedSleeve !== false;
  const sleeveBudget = includeAttachedSleeve ? sleeveLen * 0.85 : 0;
  const pxPerInch = Math.min(
    contentW / Math.max(length + sleeveBudget, 1),
    contentH / Math.max(bust, 1),
  );

  const bodyW = scaled(length, pxPerInch);
  const vCut = Math.min(scaled(vDepth, pxPerInch), bodyW * 0.92);
  const armholeCut = Math.min(scaled(armhole, pxPerInch), bodyW * 0.92);
  const backNeckCut = Math.min(scaled(backNeck, pxPerInch), bodyW * 0.92);
  const vH = scaled(derived.halfNeckOpeningInches, pxPerInch);
  const backNeckH = 2 * vH;
  const shoulderH = scaled(shoulder, pxPerInch);

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
    : firstArmholeY + shoulderH + backNeckH + shoulderH;
  const backNeckStartY = isPullover
    ? secondArmholeY + shoulderH
    : firstArmholeY + shoulderH;
  const backNeckEndY = backNeckStartY + backNeckH;
  const resolvedSecondVStartY = isPullover ? pulloverSecondVEndY : secondArmholeY + shoulderH;
  const bottomY = isPullover ? backNeckEndY + shoulderH : resolvedSecondVStartY + vH;

  const sleeveLenPx = includeAttachedSleeve ? Math.max(MIN_SLEEVE_L, scaled(sleeveLen, pxPerInch)) : 0;
  const upperHalf = includeAttachedSleeve ? Math.max(MIN_SLEEVE_W, scaled(upperFlat, pxPerInch)) : 0;
  const wristHalf = includeAttachedSleeve ? Math.max(14, scaled(wristFlat, pxPerInch)) : 0;
  const attachY = isPullover ? secondArmholeY : firstArmholeY;
  const firstArmholePlaceMarker = isPullover ? (options?.firstArmholePlaceMarker ?? null) : null;

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
    backNeckX: neckX - backNeckCut,
    sleeve: {
      attachX: neckX,
      attachY,
      farX: neckX + sleeveLenPx,
      upperHalf,
      wristHalf,
    },
    derived,
    firstArmholePlaceMarker,
  };
}

function hDim(x1: number, x2: number, y: number, role: string, extraAttrs = ""): string {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  return [
    `<g class="ds-edit-dim" data-role="${role}"${extraAttrs} data-end-cap="true">`,
    `<line x1="${fmtNum(left)}" y1="${fmtNum(y)}" x2="${fmtNum(right)}" y2="${fmtNum(y)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>`,
    endCap(left, y, false),
    endCap(right, y, false),
    `</g>`,
  ].join("");
}

function vDim(x: number, y1: number, y2: number, role: string, extraAttrs = ""): string {
  const top = Math.min(y1, y2);
  const bot = Math.max(y1, y2);
  return [
    `<g class="ds-edit-dim" data-role="${role}"${extraAttrs} data-end-cap="true">`,
    `<line x1="${fmtNum(x)}" y1="${fmtNum(top)}" x2="${fmtNum(x)}" y2="${fmtNum(bot)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>`,
    endCap(x, top, true),
    endCap(x, bot, true),
    `</g>`,
  ].join("");
}

function toward(from: number, to: number, dist: number): number {
  const d = to - from;
  if (d === 0) return from;
  return from + Math.sign(d) * dist;
}

function dimExtension(x1: number, y1: number, x2: number, y2: number): string {
  if (![x1, y1, x2, y2].every(Number.isFinite)) return "";
  if (Math.hypot(x2 - x1, y2 - y1) < 2) return "";
  return `<line data-role="dim-extension" x1="${fmtNum(x1)}" y1="${fmtNum(y1)}" x2="${fmtNum(x2)}" y2="${fmtNum(y2)}" stroke="${DS_ARROW}" stroke-width="1" opacity="0.7" fill="none"/>`;
}

/** Witness line from a garment point toward a dimension line, stopping short of the end cap. */
function extTowardDim(
  garmentX: number,
  garmentY: number,
  dimX: number,
  dimY: number,
): string {
  const dx = dimX - garmentX;
  const dy = dimY - garmentY;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  if (horizontal) {
    const startX = toward(garmentX, dimX, CARDIGAN_DIM.extStandoff);
    const endX = toward(dimX, garmentX, CARDIGAN_DIM.extGap);
    return dimExtension(startX, garmentY, endX, garmentY);
  }
  const startY = toward(garmentY, dimY, CARDIGAN_DIM.extStandoff);
  const endY = toward(dimY, garmentY, CARDIGAN_DIM.extGap);
  return dimExtension(garmentX, startY, garmentX, endY);
}

function stackedSectionEnds(
  startY: number,
  endY: number,
  insetStart: boolean,
  insetEnd: boolean,
): { top: number; bot: number } {
  const top = Math.min(startY, endY);
  const bot = Math.max(startY, endY);
  const maxInset = Math.max(0, (bot - top) / 2 - 3);
  const sep = Math.min(CARDIGAN_DIM.capSep, maxInset);
  return {
    top: top + (insetStart ? sep : 0),
    bot: bot - (insetEnd ? sep : 0),
  };
}

export function cardiganDimLayout(frame: SidewaysCardiganEditMeasurementFrame) {
  const bustX = Math.max(18, frame.hemX - CARDIGAN_DIM.bustLane);
  const sectionDimX = frame.hemX - CARDIGAN_DIM.sectionLane;
  const neckDimX = frame.neckX + CARDIGAN_DIM.neckLane;
  return {
    bustX,
    sectionDimX,
    neckDimX,
    lengthY: frame.bottomY + CARDIGAN_DIM.lengthOffset,
    sectionLabelX: sectionDimX + 10,
    neckLabelX: neckDimX + 10,
    firstFront: stackedSectionEnds(frame.topY, frame.firstArmholeY, false, true),
    back: stackedSectionEnds(frame.firstArmholeY, frame.secondArmholeY, true, true),
    secondFront: stackedSectionEnds(frame.secondArmholeY, frame.bottomY, true, false),
  };
}

function targetCircle(id: string, x: number, y: number): string {
  return `<circle id="${id}" cx="${fmtNum(x)}" cy="${fmtNum(y)}" r="2.5" fill="none"/>`;
}

function formatDerivedDisplay(
  inches: number,
  unit: MeasurementDisplayUnit,
): string {
  const n = formatMeasurementDisplayFromInches(inches, unit);
  return unit === "cm" ? `${n} cm` : `${n}"`;
}

function derivedValueLabel(
  x: number,
  y: number,
  title: string,
  inches: number,
  unit: MeasurementDisplayUnit,
  role: string,
  type: BuildDiagramTypography,
  anchor: "start" | "middle" | "end" = "start",
): string {
  const value = formatDerivedDisplay(inches, unit);
  const nameWidth = title.length * type.name * 0.55;
  const valueWidth = value.length * type.value * 0.55;
  let nameX = x;
  let valueX = x;
  if (anchor === "middle") {
    nameX = x - nameWidth / 2;
    valueX = x - valueWidth / 2;
  } else if (anchor === "end") {
    nameX = x - nameWidth;
    valueX = x - valueWidth;
  }
  const dy = type.valueLineGap;
  return `<text data-role="${role}" data-derived-inches="${fmtNum(inches)}" x="${fmtNum(x)}" y="${fmtNum(y)}" text-anchor="start" font-family="${type.fontFamily}" font-size="${type.name}" fill="${DS_MUTED}"><tspan x="${fmtNum(nameX)}" dy="0" data-build-type-role="name" font-size="${type.name}" font-weight="${type.nameWeight}">${escapeXml(title)}</tspan><tspan x="${fmtNum(valueX)}" dy="${fmtNum(dy)}" data-build-type-role="value" font-size="${type.value}" font-weight="${type.valueWeight}" fill="${DS_STROKE}">${escapeXml(value)}</tspan></text>`;
}

export function cardiganBodyPath(frame: SidewaysCardiganEditMeasurementFrame): string {
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

export function pulloverBodyPath(frame: SidewaysCardiganEditMeasurementFrame): string {
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

export function sleevePath(frame: SidewaysCardiganEditMeasurementFrame): string {
  const { attachX, attachY, farX, upperHalf, wristHalf } = frame.sleeve;
  return [
    `M ${fmtNum(attachX)} ${fmtNum(attachY - upperHalf)}`,
    `L ${fmtNum(farX)} ${fmtNum(attachY - wristHalf)}`,
    `L ${fmtNum(farX)} ${fmtNum(attachY + wristHalf)}`,
    `L ${fmtNum(attachX)} ${fmtNum(attachY + upperHalf)}`,
    "Z",
  ].join(" ");
}

export function drawCardiganMarkers(frame: SidewaysCardiganEditMeasurementFrame): string {
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

function pulloverSupportLineGap(type: BuildDiagramTypography): number {
  return type.support + Math.max(4, Math.round(type.support * 0.2));
}

/** Room under the cast-on edge for the two-line start caption, then the length dimension. */
function pulloverCastOnLabelY(bottomY: number, type: BuildDiagramTypography): number {
  return bottomY + 12 + type.support;
}

function pulloverBodyLengthDimY(bottomY: number, type: BuildDiagramTypography): number {
  const lineGap = pulloverSupportLineGap(type);
  const captionBottom = pulloverCastOnLabelY(bottomY, type) + lineGap + type.support * 0.35;
  return captionBottom + 18;
}

export type PulloverFirstArmholeMarkerLayout = {
  x: number;
  castOnY: number;
  bindOffY: number;
  stitchesFromNeck: number;
};

/**
 * Cast-on and bind-off points for the pullover first-armhole side seam.
 * X comes from the fraction already resolved by the body calculation.
 */
export function pulloverFirstArmholeMarkerLayout(
  frame: SidewaysCardiganEditMeasurementFrame,
  castOnAtBottom: boolean,
): PulloverFirstArmholeMarkerLayout | null {
  const marker = frame.firstArmholePlaceMarker;
  if (!marker || !(marker.fractionFromNeck > 0)) return null;
  return {
    x: sidewaysFractionFromNeckX(frame.hemX, frame.neckX, marker.fractionFromNeck),
    castOnY: castOnAtBottom ? frame.bottomY : frame.topY,
    bindOffY: castOnAtBottom ? frame.topY : frame.bottomY,
    stitchesFromNeck: marker.stitchesFromNeck,
  };
}

/** Side-seam place-marker dots. The label stays in the diagram's normal text color. */
const PULLOVER_PLACE_MARKER_DOT = "#c62828";

function drawPulloverSideSeamMarkerGeometry(layout: PulloverFirstArmholeMarkerLayout): string {
  const { x, castOnY, bindOffY, stitchesFromNeck } = layout;
  const dot = (edge: "cast-on" | "bind-off", y: number) =>
    `<g data-role="place-marker" data-edge="${edge}" data-side-seam-join="first-armhole" data-stitches-from-neck="${stitchesFromNeck}" data-x="${fmtNum(x)}" data-y="${fmtNum(y)}">` +
    `<title>Place marker, ${stitchesFromNeck} stitches from the neck edge</title>` +
    `<circle cx="${fmtNum(x)}" cy="${fmtNum(y)}" r="5" fill="${PULLOVER_PLACE_MARKER_DOT}" stroke="#fff" stroke-width="1.4"/>` +
    `</g>`;
  return [dot("cast-on", castOnY), dot("bind-off", bindOffY)].join("");
}

/** Labels sit in the caller's coordinate space so a flipped silhouette can pass visual Y. */
export function drawPulloverSideSeamMarkerLabels(
  layout: PulloverFirstArmholeMarkerLayout | null,
  fontSize = 14,
): string {
  if (!layout) return "";
  const label = (edge: "cast-on" | "bind-off", y: number) => {
    const labelY = edge === "cast-on" ? y - fontSize - 4 : y + fontSize + 4;
    return `<text data-role="side-seam-marker-label" data-edge="${edge}" data-side-seam-join="first-armhole" data-stitches-from-neck="${layout.stitchesFromNeck}" x="${fmtNum(layout.x)}" y="${fmtNum(labelY)}" text-anchor="middle" font-family="${DS_FONT}" font-size="${fontSize}" font-weight="500" fill="${DS_STROKE}">Place marker</text>`;
  };
  return label("cast-on", layout.castOnY) + label("bind-off", layout.bindOffY);
}

export function drawPulloverMarkers(
  frame: SidewaysCardiganEditMeasurementFrame,
  options?: {
    includeStartLabel?: boolean;
    typography?: BuildDiagramTypography;
    /** Build/Edit knits upward, so the cast-on caption and start edge sit on the bottom. */
    castOnAtBottom?: boolean;
  },
): string {
  const includeStartLabel = options?.includeStartLabel !== false;
  const castOnAtBottom = options?.castOnAtBottom === true;
  const midX = (frame.hemX + frame.neckX) / 2;
  const type = includeStartLabel
    ? (options?.typography ?? buildDiagramTypographyForViewBox(viewBoxFor(frame).width))
    : null;
  const startY = castOnAtBottom ? frame.bottomY : frame.topY;
  const graftY = castOnAtBottom ? frame.topY : frame.bottomY;
  const lineGap = type ? pulloverSupportLineGap(type) : 0;
  const labelY =
    type && castOnAtBottom
      ? pulloverCastOnLabelY(frame.bottomY, type)
      : type
        ? frame.topY - 10 - type.support - lineGap
        : 0;
  const markerLayout = pulloverFirstArmholeMarkerLayout(frame, castOnAtBottom);
  return [
    `<line data-role="underarm-start" data-scrap-on="true" x1="${fmtNum(frame.hemX)}" y1="${fmtNum(startY)}" x2="${fmtNum(frame.neckX)}" y2="${fmtNum(startY)}" fill="none" stroke="${DS_STROKE}" stroke-width="2" stroke-dasharray="6 4"/>`,
    `<line data-role="graft-join" data-scrap-off="true" x1="${fmtNum(frame.hemX)}" y1="${fmtNum(graftY)}" x2="${fmtNum(frame.neckX)}" y2="${fmtNum(graftY)}" fill="none" stroke="${DS_STROKE}" stroke-width="2" stroke-dasharray="6 4"/>`,
    `<polyline data-role="v-neck" data-closed-front="true" points="${fmtNum(frame.neckX)},${fmtNum(frame.firstArmholeY)} ${fmtNum(frame.vCutX)},${fmtNum(frame.firstVEndY)} ${fmtNum(frame.neckX)},${fmtNum(frame.secondVStartY)}" fill="none" stroke="${DS_STROKE}" stroke-width="1.6"/>`,
    includeStartLabel && type
      ? `<text data-role="underarm-start-label" data-build-type-role="support" x="${fmtNum(midX)}" y="${fmtNum(labelY)}" text-anchor="middle" font-family="${type.fontFamily}" font-size="${type.support}" font-weight="${type.supportWeight}" fill="${DS_MUTED}"><tspan x="${fmtNum(midX)}" dy="0">Start at underarm</tspan><tspan x="${fmtNum(midX)}" dy="${fmtNum(lineGap)}" data-build-type-role="support">scrap on / graft</tspan></text>`
      : "",
    markerLayout ? drawPulloverSideSeamMarkerGeometry(markerLayout) : "",
  ].join("");
}

export function drawArmholeAndBack(frame: SidewaysCardiganEditMeasurementFrame): string {
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

/**
 * Cardigan back-neck notation: the vertical opening is the full neck width,
 * with witness lines from the notch corners out to that dimension.
 */
function drawBackNeckOpeningNotation(
  frame: SidewaysCardiganEditMeasurementFrame,
  neckDimX: number,
): string {
  return [
    vDim(neckDimX, frame.backNeckStartY, frame.backNeckEndY, "dim-neck-opening"),
    extTowardDim(frame.neckX, frame.backNeckStartY, neckDimX, frame.backNeckStartY),
    extTowardDim(frame.neckX, frame.backNeckEndY, neckDimX, frame.backNeckEndY),
  ].join("");
}

function drawPulloverDimensions(
  frame: SidewaysCardiganEditMeasurementFrame,
  unit: MeasurementDisplayUnit,
  type: BuildDiagramTypography,
): string {
  const derived = frame.derived;
  const { bustX, sectionDimX, neckDimX, sectionLabelX, neckLabelX } = cardiganDimLayout(frame);
  const lengthY = pulloverBodyLengthDimY(frame.bottomY, type);
  const vDepthY = (frame.firstVEndY + frame.secondVStartY) / 2;
  const frontSpan = stackedSectionEnds(frame.topY, frame.secondArmholeY, false, true);
  const backSpan = stackedSectionEnds(frame.secondArmholeY, frame.bottomY, true, false);
  const frontMidY = (frame.topY + frame.secondArmholeY) / 2;
  const backMidY = (frame.secondArmholeY + frame.bottomY) / 2;
  const shoulderMidY = (frame.topY + frame.firstArmholeY) / 2;
  const armholeDimY = frame.secondArmholeY - 16;
  const fullFrontInches = derived.frontSectionInches * 2;
  const neckOpeningInches = derived.halfNeckOpeningInches * 2;
  return [
    vDim(bustX, frame.topY, frame.bottomY, "dim-finished-bust"),
    hDim(frame.hemX, frame.neckX, lengthY, "dim-finished-back-length"),
    drawBackNeckOpeningNotation(frame, neckDimX),
    hDim(frame.vCutX, frame.neckX, vDepthY, "dim-vneck-depth"),
    hDim(
      frame.armholeX,
      frame.neckX,
      armholeDimY,
      "dim-armhole-depth",
      ` data-derived-role="${SIDEWAYS_SUMMARY_DERIVED_ROLES.armholeDepth}"`,
    ),
    vDim(neckDimX, frame.topY, frame.firstArmholeY, "dim-shoulder-section"),
    extTowardDim(frame.neckX, frame.topY, neckDimX, frame.topY),
    extTowardDim(frame.neckX, frame.firstArmholeY, neckDimX, frame.firstArmholeY),
    vDim(sectionDimX, frontSpan.top, frontSpan.bot, "dim-front-section"),
    vDim(sectionDimX, backSpan.top, backSpan.bot, "dim-back-section"),
    extTowardDim(frame.hemX, frame.topY, sectionDimX, frame.topY),
    extTowardDim(frame.hemX, frame.secondArmholeY, sectionDimX, frame.secondArmholeY),
    extTowardDim(frame.hemX, frame.bottomY, sectionDimX, frame.bottomY),
    derivedValueLabel(
      neckLabelX,
      shoulderMidY - 4,
      "Shoulder",
      derived.shoulderSectionInches,
      unit,
      SIDEWAYS_SUMMARY_DERIVED_ROLES.shoulderSection,
      type,
    ),
    derivedValueLabel(
      neckLabelX,
      frame.backNeckEndY + type.name + 6,
      "Neck opening",
      neckOpeningInches,
      unit,
      SIDEWAYS_SUMMARY_DERIVED_ROLES.neckOpening,
      type,
    ),
    derivedValueLabel(
      sectionLabelX,
      frontMidY - 4,
      "Front",
      fullFrontInches,
      unit,
      SIDEWAYS_SUMMARY_DERIVED_ROLES.frontSection,
      type,
    ),
    derivedValueLabel(
      (frame.hemX + frame.neckX) / 2,
      backMidY - 4,
      "Back",
      derived.backSectionInches,
      unit,
      SIDEWAYS_SUMMARY_DERIVED_ROLES.backSection,
      type,
      "middle",
    ),
  ].join("");
}

function drawCardiganDimensions(
  frame: SidewaysCardiganEditMeasurementFrame,
  unit: MeasurementDisplayUnit,
  type: BuildDiagramTypography,
): string {
  const derived = frame.derived;
  const layout = cardiganDimLayout(frame);
  const { bustX, sectionDimX, neckDimX, lengthY, sectionLabelX, neckLabelX } = layout;
  const firstFrontMidY = (frame.topY + frame.firstArmholeY) / 2;
  const backMidY = (frame.firstArmholeY + frame.secondArmholeY) / 2;
  const secondFrontMidY = (frame.secondArmholeY + frame.bottomY) / 2;
  const halfNeckTop = frame.secondVStartY;
  const halfNeckBot = frame.bottomY;
  const halfNeckMidY = (halfNeckTop + halfNeckBot) / 2;
  const shoulderMidY = (frame.secondArmholeY + frame.secondVStartY) / 2;
  const armholeDimY = frame.firstArmholeY - 16;
  const vDepthY = frame.bottomY + 32;
  const outerExtStartX = toward(sectionDimX, bustX, CARDIGAN_DIM.extGap + 2);
  return [
    vDim(bustX, frame.topY, frame.bottomY, "dim-finished-bust"),
    // Finished back length is garmentLengthInches (chart back_neck_to_hem): the
    // full hem-to-neck-edge span. Back-neck depth is bound off from that neck
    // edge, so this line includes the back-neck depth. Drawn below the body so
    // it cannot read as a seam or section boundary.
    hDim(frame.hemX, frame.neckX, lengthY, "dim-finished-back-length"),
    drawBackNeckOpeningNotation(frame, neckDimX),
    hDim(frame.vCutX, frame.neckX, vDepthY, "dim-vneck-depth"),
    hDim(
      frame.armholeX,
      frame.neckX,
      armholeDimY,
      "dim-armhole-depth",
      ` data-derived-role="${SIDEWAYS_SUMMARY_DERIVED_ROLES.armholeDepth}"`,
    ),
    vDim(neckDimX, frame.secondArmholeY, frame.secondVStartY, "dim-shoulder-section"),
    vDim(neckDimX, halfNeckTop, halfNeckBot, "dim-half-neck-opening"),
    vDim(
      sectionDimX,
      layout.firstFront.top,
      layout.firstFront.bot,
      "dim-front-section",
      ` data-side="first"`,
    ),
    vDim(sectionDimX, layout.back.top, layout.back.bot, "dim-back-section"),
    vDim(
      sectionDimX,
      layout.secondFront.top,
      layout.secondFront.bot,
      "dim-front-section",
      ` data-side="second"`,
    ),
    extTowardDim(frame.hemX, frame.topY, sectionDimX, frame.topY),
    extTowardDim(frame.hemX, frame.firstArmholeY, sectionDimX, frame.firstArmholeY),
    extTowardDim(frame.hemX, frame.secondArmholeY, sectionDimX, frame.secondArmholeY),
    extTowardDim(frame.hemX, frame.bottomY, sectionDimX, frame.bottomY),
    dimExtension(
      outerExtStartX,
      frame.topY,
      toward(bustX, sectionDimX, CARDIGAN_DIM.extGap),
      frame.topY,
    ),
    dimExtension(
      outerExtStartX,
      frame.bottomY,
      toward(bustX, sectionDimX, CARDIGAN_DIM.extGap),
      frame.bottomY,
    ),
    extTowardDim(frame.hemX, frame.bottomY, frame.hemX, lengthY),
    extTowardDim(
      frame.neckX,
      vDepthY + CARDIGAN_DIM.extGap + 4,
      frame.neckX,
      lengthY,
    ),
    extTowardDim(frame.neckX, frame.secondArmholeY, neckDimX, frame.secondArmholeY),
    extTowardDim(frame.neckX, frame.secondVStartY, neckDimX, frame.secondVStartY),
    extTowardDim(frame.neckX, frame.bottomY, neckDimX, frame.bottomY),
    extTowardDim(frame.vCutX, frame.bottomY, frame.vCutX, vDepthY),
    extTowardDim(frame.armholeX, frame.firstArmholeY, frame.armholeX, armholeDimY),
    derivedValueLabel(
      neckLabelX,
      shoulderMidY - 4,
      "Shoulder",
      derived.shoulderSectionInches,
      unit,
      SIDEWAYS_SUMMARY_DERIVED_ROLES.shoulderSection,
      type,
    ),
    derivedValueLabel(
      neckLabelX,
      halfNeckMidY - 4,
      "½ neck opening",
      derived.halfNeckOpeningInches,
      unit,
      SIDEWAYS_SUMMARY_DERIVED_ROLES.halfNeckOpening,
      type,
    ),
    derivedValueLabel(
      sectionLabelX,
      firstFrontMidY - 4,
      "Front",
      derived.frontSectionInches,
      unit,
      SIDEWAYS_SUMMARY_DERIVED_ROLES.frontSection,
      type,
    ),
    derivedValueLabel(
      sectionLabelX,
      backMidY - 4,
      "Back",
      derived.backSectionInches,
      unit,
      SIDEWAYS_SUMMARY_DERIVED_ROLES.backSection,
      type,
    ),
    derivedValueLabel(
      sectionLabelX,
      secondFrontMidY - 4,
      "Front",
      derived.frontSectionInches,
      unit,
      SIDEWAYS_SUMMARY_DERIVED_ROLES.frontSection,
      type,
    ),
  ].join("");
}

function drawDimensions(
  frame: SidewaysCardiganEditMeasurementFrame,
  unit: MeasurementDisplayUnit,
  type: BuildDiagramTypography,
): string {
  return frame.garmentStyle === "pullover"
    ? drawPulloverDimensions(frame, unit, type)
    : drawCardiganDimensions(frame, unit, type);
}

function drawPulloverTargets(
  frame: SidewaysCardiganEditMeasurementFrame,
  type: BuildDiagramTypography,
): string {
  const t = SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS;
  const { bustX, neckDimX } = cardiganDimLayout(frame);
  const lengthY = pulloverBodyLengthDimY(frame.bottomY, type);
  const armholeDimY = frame.secondArmholeY - 16;
  return [
    `<g data-role="measurement-targets">`,
    targetCircle(t.finishedBust, bustX, (frame.topY + frame.bottomY) / 2),
    targetCircle(t.finishedLength, (frame.hemX + frame.neckX) / 2, lengthY),
    targetCircle(t.neckOpeningWidth, neckDimX, (frame.backNeckStartY + frame.backNeckEndY) / 2),
    targetCircle(t.vNeckDepth, (frame.vCutX + frame.neckX) / 2, frame.firstVEndY),
    targetCircle(t.armholeDepth, (frame.armholeX + frame.neckX) / 2, armholeDimY),
    `</g>`,
  ].join("");
}

function drawCardiganTargets(frame: SidewaysCardiganEditMeasurementFrame): string {
  const t = SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS;
  const { bustX, neckDimX, lengthY } = cardiganDimLayout(frame);
  const armholeDimY = frame.firstArmholeY - 16;
  return [
    `<g data-role="measurement-targets">`,
    targetCircle(t.finishedBust, bustX, (frame.topY + frame.bottomY) / 2),
    targetCircle(t.finishedLength, (frame.hemX + frame.neckX) / 2, lengthY),
    targetCircle(t.neckOpeningWidth, neckDimX, (frame.backNeckStartY + frame.backNeckEndY) / 2),
    targetCircle(t.vNeckDepth, (frame.vCutX + frame.neckX) / 2, frame.bottomY + 32),
    targetCircle(t.armholeDepth, (frame.armholeX + frame.neckX) / 2, armholeDimY),
    `</g>`,
  ].join("");
}

function drawTargets(
  frame: SidewaysCardiganEditMeasurementFrame,
  type: BuildDiagramTypography,
): string {
  return frame.garmentStyle === "pullover"
    ? drawPulloverTargets(frame, type)
    : drawCardiganTargets(frame);
}

/**
 * Grow the geometry viewBox only when label ink would sit outside it.
 * Font sizes stay resolved against the geometry width. Scaling them up again
 * to the widened canvas would shrink the words back down on screen.
 */
function viewBoxCoveringLabelInk(
  geometry: { x: number; width: number; height: number },
  markup: string,
): { x: number; y: number; width: number; height: number } {
  const base = { x: geometry.x, y: 0, width: geometry.width, height: geometry.height };
  const ink = diagramMarkupBounds(markup);
  if (!ink) return base;
  const margin = 8;
  let minX = base.x;
  let minY = base.y;
  let maxX = base.x + base.width;
  let maxY = base.y + base.height;
  const inkRight = ink.x + ink.width;
  const inkBottom = ink.y + ink.height;
  if (ink.x < minX) minX = ink.x - margin;
  if (ink.y < minY) minY = ink.y - margin;
  if (inkRight > maxX) maxX = inkRight + margin;
  if (inkBottom > maxY) maxY = inkBottom + margin;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function viewBoxFor(frame: SidewaysCardiganEditMeasurementFrame): {
  x: number;
  width: number;
  height: number;
} {
  if (frame.garmentStyle === "pullover" && frame.sleeve.farX > frame.neckX) {
    const maxX = frame.sleeve.farX + 40;
    const maxY = frame.bottomY + 48;
    return {
      x: 0,
      width: Math.ceil(maxX + PAD.right * 0.35),
      height: Math.ceil(maxY + PAD.bottom * 0.35),
    };
  }
  const { bustX } = cardiganDimLayout(frame);
  const minX = Math.min(0, bustX - CARDIGAN_DIM.bustChipGutter);
  const maxX = Math.max(frame.neckX + 168, PAD.left + frame.bodyW + PAD.right);
  const lengthY = frame.bottomY + CARDIGAN_DIM.lengthOffset;
  const maxY = Math.max(frame.bottomY + 86, lengthY + 16);
  return {
    x: minX,
    width: Math.ceil(maxX - minX),
    height: Math.ceil(maxY),
  };
}

export function buildSidewaysCardiganEditMeasurementFrame(
  input: SidewaysCardiganEditMeasurementDiagramInput,
  options?: SidewaysCardiganEditMeasurementFrameOptions,
): SidewaysCardiganEditMeasurementFrame {
  return buildFrame(input.measurements, input.garmentStyle, options);
}

/**
 * Room for the dimension lines. The silhouette itself comes from
 * sidewaysProportionalSleeveLocalFrame so one garment inch matches both axes.
 */
const SIDEWAYS_SLEEVE_DIM = {
  upperArm: 28,
  wrist: 36,
  sleeveLength: 56,
} as const;
/**
 * Room past the dimension lines for HTML measurement chips.
 * Upper arm and wrist chips grow right from the center anchor.
 * The sleeve-length chip is centered on the length line.
 */
const SIDEWAYS_SLEEVE_GUTTER = {
  chipPastCenter: 168,
  chipPastLength: 96,
  top: 48,
  bottom: 64,
  edge: 8,
} as const;

type SidewaysSleeveDiagramLayout = {
  frame: DropShoulderSleeveDiagramFrame;
  viewBox: { x: number; y: number; width: number; height: number };
  pxPerInch: number;
  upperArmInches: number;
  wristInches: number;
  sleeveLengthInches: number;
};

function buildSidewaysSleeveLayout(
  measurements: SidewaysCardiganEditMeasurementInput,
): SidewaysSleeveDiagramLayout {
  const sized = sidewaysProportionalSleeveLocalFrame({
    upperArmInches: measurements.finishedUpperArmInches,
    wristInches: measurements.wristInches,
    sleeveLengthInches: measurements.sleeveLengthInches,
    cuffDepthInches: 0,
    direction: "cuff-up",
  });
  const { upperArmInches, wristInches, sleeveLengthInches, pxPerInch } = sized;
  const local = sized.frame;
  const lengthX =
    Math.min(local.wristLeft, local.upperLeft) - SIDEWAYS_SLEEVE_DIM.sleeveLength;
  const leftInk = lengthX - SIDEWAYS_SLEEVE_GUTTER.chipPastLength - SIDEWAYS_SLEEVE_GUTTER.edge;
  const rightInk =
    Math.max(local.upperRight, local.wristRight, local.midX + SIDEWAYS_SLEEVE_GUTTER.chipPastCenter) +
    SIDEWAYS_SLEEVE_GUTTER.edge;
  const half = Math.max(local.midX - leftInk, rightInk - local.midX);
  const top = SIDEWAYS_SLEEVE_DIM.upperArm + SIDEWAYS_SLEEVE_GUTTER.top;
  const frame = offsetDropShoulderSleeveDiagramFrame(local, half, top);
  const height = frame.wristY + SIDEWAYS_SLEEVE_DIM.wrist + SIDEWAYS_SLEEVE_GUTTER.bottom;
  return {
    frame,
    viewBox: { x: 0, y: 0, width: half * 2, height },
    pxPerInch,
    upperArmInches,
    wristInches,
    sleeveLengthInches,
  };
}

function sleeveLengthDimX(frame: DropShoulderSleeveDiagramFrame): number {
  return Math.min(frame.wristLeft, frame.upperLeft) - SIDEWAYS_SLEEVE_DIM.sleeveLength;
}

function drawSidewaysSleeveTargets(frame: DropShoulderSleeveDiagramFrame): string {
  const t = SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS;
  const lengthX = sleeveLengthDimX(frame);
  return [
    `<g data-role="measurement-targets">`,
    targetCircle(t.upperArm, frame.midX, frame.upperArmY - SIDEWAYS_SLEEVE_DIM.upperArm),
    targetCircle(t.sleeveLength, lengthX, (frame.top + frame.bottom) / 2),
    targetCircle(t.wrist, frame.midX, frame.wristY + SIDEWAYS_SLEEVE_DIM.wrist),
    `</g>`,
  ].join("");
}

function drawSidewaysSleeveLeaders(frame: DropShoulderSleeveDiagramFrame): string {
  const lengthX = sleeveLengthDimX(frame);
  const upperY = frame.upperArmY - SIDEWAYS_SLEEVE_DIM.upperArm;
  const wristY = frame.wristY + SIDEWAYS_SLEEVE_DIM.wrist;
  return [
    extTowardDim(frame.upperLeft, frame.upperArmY, frame.upperLeft, upperY),
    extTowardDim(frame.upperRight, frame.upperArmY, frame.upperRight, upperY),
    extTowardDim(frame.wristLeft, frame.wristY, frame.wristLeft, wristY),
    extTowardDim(frame.wristRight, frame.wristY, frame.wristRight, wristY),
    extTowardDim(frame.upperLeft, frame.top, lengthX, frame.top),
    extTowardDim(frame.wristLeft, frame.bottom, lengthX, frame.bottom),
  ].join("");
}

function drawSidewaysSleeveDimensions(frame: DropShoulderSleeveDiagramFrame): string {
  const lengthX = sleeveLengthDimX(frame);
  return [
    hDim(frame.upperLeft, frame.upperRight, frame.upperArmY - SIDEWAYS_SLEEVE_DIM.upperArm, "dim-upper-arm"),
    hDim(frame.wristLeft, frame.wristRight, frame.wristY + SIDEWAYS_SLEEVE_DIM.wrist, "dim-wrist"),
    vDim(lengthX, frame.top, frame.bottom, "dim-sleeve-length"),
  ].join("");
}

export function buildSidewaysCardiganEditSleeveMeasurementDiagramSvg(
  input: SidewaysCardiganEditMeasurementDiagramInput,
): string {
  const unit = input.displayUnit === "cm" ? "cm" : "in";
  const layout = buildSidewaysSleeveLayout(input.measurements);
  const { frame, viewBox } = layout;
  const style = input.garmentStyle === "pullover" ? "pullover" : "cardigan";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmtNum(viewBox.x)} ${fmtNum(viewBox.y)} ${fmtNum(viewBox.width)} ${fmtNum(viewBox.height)}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Sideways sweater sleeve measurement diagram" focusable="false" class="express-mbp-art" data-sideways-edit-diagram="${style}" data-sideways-edit-piece="sleeve" data-sleeve-cap="false" data-sleeve-geometry="proportional" data-sleeve-px-per-inch="${fmtNum(layout.pxPerInch)}" data-finished-upper-arm-inches="${fmtNum(layout.upperArmInches)}" data-wrist-inches="${fmtNum(layout.wristInches)}" data-sleeve-length-inches="${fmtNum(layout.sleeveLengthInches)}" data-display-unit="${unit}">`,
    `<path data-role="sleeve-outline" data-sleeve-cap="false" d="${dropShoulderSleeveBodyPath(frame)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    drawSleeveCuffJoin(frame),
    drawSidewaysSleeveLeaders(frame),
    drawSidewaysSleeveDimensions(frame),
    drawSidewaysSleeveTargets(frame),
    `</svg>`,
  ].join("");
}

export function buildSidewaysCardiganEditBodyMeasurementDiagramSvg(
  input: SidewaysCardiganEditMeasurementDiagramInput,
): string {
  const garmentStyle = input.garmentStyle === "pullover" ? "pullover" : "cardigan";
  const frame = buildFrame(input.measurements, garmentStyle, {
    includeAttachedSleeve: false,
    firstArmholePlaceMarker: garmentStyle === "pullover" ? (input.placeMarker ?? null) : null,
  });
  const geometry = viewBoxFor(frame);
  const unit = input.displayUnit === "cm" ? "cm" : "in";
  const start = garmentStyle === "pullover" ? "underarm" : "center-front";
  const bodyD = garmentStyle === "pullover" ? pulloverBodyPath(frame) : cardiganBodyPath(frame);
  const aria =
    garmentStyle === "pullover"
      ? "Sideways pullover body measurement diagram starting at the underarm"
      : "Sideways cardigan measurement diagram starting at center front";
  const compose = (type: BuildDiagramTypography) =>
    [
      `<path data-role="body-outline" data-garment-style="${garmentStyle}" d="${bodyD}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
      drawArmholeAndBack(frame),
      garmentStyle === "pullover"
        ? drawPulloverMarkers(frame, { typography: type, castOnAtBottom: true })
        : drawCardiganMarkers(frame),
      garmentStyle === "pullover"
        ? drawPulloverSideSeamMarkerLabels(
            pulloverFirstArmholeMarkerLayout(frame, true),
            type.support,
          )
        : "",
      drawDimensions(frame, unit, type),
      drawTargets(frame, type),
    ].join("");
  // Type is resolved against the drawing width, then the viewBox grows only
  // enough to keep that ink inside. Rescaling to the wider canvas would put
  // the words back at the old, too-small on-screen size.
  const type = buildDiagramTypographyForViewBox(geometry.width);
  const labels = separateOverlappingDiagramLabels(compose(type), 6);
  const box = viewBoxCoveringLabelInk(geometry, labels);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmtNum(box.x)} ${fmtNum(box.y)} ${fmtNum(box.width)} ${fmtNum(box.height)}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${aria}" focusable="false" class="express-mbp-art" data-sideways-edit-diagram="${garmentStyle}" data-sideways-edit-piece="body" data-sideways-start="${start}" data-cardigan-structure="${garmentStyle === "cardigan" ? "front-back-front" : "underarm-graft"}" data-display-unit="${unit}" data-build-diagram-type-width="${fmtNum(type.viewBoxWidth)}">`,
    labels,
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
