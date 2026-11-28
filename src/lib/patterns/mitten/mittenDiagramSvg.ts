/**
 * Upright mitten diagram.
 * Half-circumference is used only to draw the flat view.
 * Stitches & Rows labels use the shared sweater label block and the drop-shoulder
 * dimension lines. Thumb length is web to tip. Gore length is not drawn onto the thumb.
 */

import type { MittenSlotEdge } from "./mittenInstructions";
import { formatMittenLengthInches, mittenPhysicalLengths, type MittenCalc } from "./mittenMath";
import { DESKTOP_MEASUREMENT_OVERLAY_MIN_STAGE_PX } from "../patternSummaryMeasurementOverlay";
import type { MeasurementDisplayUnit } from "../patternMeasurementDisplayUnit";
import {
  DS_ARROW,
  DS_FONT,
  DS_MUTED,
  endCap,
  fmtNum,
} from "../dropShoulderPatternDiagramSvgShared";
import {
  castOnEdgeDiagramLabel,
  formatKnittedCountMeasurement,
  formatKnittedDiagramMeasurement,
  formatPatternDiagramMeasurement,
  formatStitchesRowsDiagramLabel,
  stitchesRowsLabelMarkup,
} from "../legoBlocks/stitchesRowsDiagramLabel";

const STROKE = "#1a1a1a";
const DIM = "#52682d";
/** Summary/Edit keeps this hand width so the measurement lanes stay put. */
const HAND_PX = 150;
/**
 * Finished-pattern hand width. The viewBox is cropped to the drawing and labels,
 * so this width fills the sidebar the way the drop-shoulder body fills its 430-unit canvas.
 */
const PATTERN_HAND_PX = 200;
const PATTERN_PAD = 18;
/** Illustrative gaps. Not garment measurements. */
const THUMB_GAP = 16;
const THUMB_ANGLE = 22;
const HAND_OVAL_RY = 11;
const THUMB_OVAL_RY = 8;

export type MittenDiagramMeasurements = {
  cuffWidthIn: number;
  handWidthIn: number;
  cuffDisplayIn: number;
  handDisplayIn: number;
  cuffLengthIn: number;
  hand1LengthIn: number;
  straightLengthIn: number;
  setupRowIn: number;
  fingertipDepthIn: number;
  /** From the thumb slot through the setup row and fingertip shaping. */
  slotToFingertipIn: number;
  slotWidthIn: number;
  thumbKnittedWidthIn: number;
  thumbFinishedCircumferenceIn: number;
  thumbDisplayIn: number;
  thumbLengthIn: number;
  totalLengthIn: number;
  handCircumferenceIn: number;
  thumbCircumferenceIn: number;
};

export function mittenDiagramMeasurements(calc: MittenCalc): MittenDiagramMeasurements {
  const stitch = calc.stitchGaugePerInch;
  const lengths = mittenPhysicalLengths(calc);
  const cuffWidthIn = calc.cuffSts / stitch;
  const handWidthIn = calc.handSts / stitch;
  const thumbKnittedWidthIn = calc.thumbSts / stitch;
  const thumbFinishedCircumferenceIn = (calc.thumbSts - 2) / stitch;
  return {
    cuffWidthIn,
    handWidthIn,
    cuffDisplayIn: cuffWidthIn / 2,
    handDisplayIn: handWidthIn / 2,
    cuffLengthIn: lengths.cuffLengthIn,
    hand1LengthIn: lengths.hand1LengthIn,
    straightLengthIn: lengths.straightLengthIn,
    setupRowIn: lengths.setupRowIn,
    fingertipDepthIn: lengths.fingertipDepthIn,
    slotToFingertipIn: lengths.hand2LengthIn,
    slotWidthIn: calc.slotSts / stitch,
    thumbKnittedWidthIn,
    thumbFinishedCircumferenceIn,
    thumbDisplayIn: thumbFinishedCircumferenceIn / 2,
    thumbLengthIn: calc.thumbRows / calc.rowGaugePerInch,
    totalLengthIn: lengths.totalLengthIn,
    handCircumferenceIn: calc.measurements.handCircumferenceInches,
    thumbCircumferenceIn: calc.measurements.thumbCircumferenceInches,
  };
}

export function formatMittenDiagramInches(inches: number): string {
  if (!Number.isFinite(inches)) return "";
  return String(Math.round(inches * 100) / 100);
}

/** Kept for the written pattern's length list. The schematic uses the shared label block. */
export function formatMittenDiagramLength(inches: number): string {
  return formatMittenLengthInches(inches);
}

/** Drop-shoulder Stitches & Rows type: count 17, measurement 14. */
const STS_COUNT = 17;
const STS_MEASURE = 14;
const STS_GAP = Math.round(STS_COUNT * 0.95);
/**
 * Rendered Poppins boxes. The count rises about one em above its baseline, and
 * the measurement drops a few pixels below its baseline. Both lines stay this
 * far off the dimension line, the same step on every indicator.
 */
const COUNT_ABOVE = STS_COUNT + 2;
const MEASURE_DESCENT = 4;
const LABEL_CLEAR = 8;

function f(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 100) / 100);
}

function vMeasure(x: number, yTop: number, yBottom: number, name: string, id?: string): string {
  const s = 5;
  const idAttr = id ? ` id="${id}"` : "";
  return (
    `<g${idAttr} data-dimension="${name}" fill="none" stroke="${DIM}" stroke-width="1.35">` +
    `<line x1="${f(x)}" y1="${f(yTop)}" x2="${f(x)}" y2="${f(yBottom)}"/>` +
    `<polyline points="${f(x - s)},${f(yTop + s)} ${f(x)},${f(yTop)} ${f(x + s)},${f(yTop + s)}"/>` +
    `<polyline points="${f(x - s)},${f(yBottom - s)} ${f(x)},${f(yBottom)} ${f(x + s)},${f(yBottom - s)}"/>` +
    `</g>`
  );
}

/** Clockwise SVG rotation of a local point. */
function rotateLocal(x: number, y: number, degrees: number): { x: number; y: number } {
  const a = (degrees * Math.PI) / 180;
  return {
    x: x * Math.cos(a) - y * Math.sin(a),
    y: x * Math.sin(a) + y * Math.cos(a),
  };
}

function spreadCenters(desired: number[], gap: number): number[] {
  const items = desired.map((y, index) => ({ y, index })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const item = items[i];
    if (!prev || !item) continue;
    if (item.y < prev.y + gap) item.y = prev.y + gap;
  }
  const placed = [...desired];
  for (const item of items) placed[item.index] = item.y;
  return placed;
}

export type MittenDiagramMode = "pattern" | "summary";

export const MITTEN_SUMMARY_TARGETS = {
  cuffCircumference: "target_mitten_cuff_circ",
  cuffLength: "target_mitten_cuff_length",
  handCircumference: "target_mitten_hand_circ",
  handLength: "target_mitten_hand_length",
  hand2Length: "target_mitten_hand2",
  thumbLength: "target_mitten_thumb_length",
  thumbCircumference: "target_mitten_thumb_circ",
} as const;

/**
 * Screen-pixel footprint of one Summary/Edit chip at the desktop overlay threshold.
 * Lanes in the summary viewBox are solved from this footprint so the seven controls
 * fit beside the drawing when the stage is just wide enough for on-diagram chips.
 * The mitten page uses 0.5rem of stage padding on every side; 16px matches that at a 16px root.
 */
export const MITTEN_SUMMARY_CHIP = {
  minStagePx: DESKTOP_MEASUREMENT_OVERLAY_MIN_STAGE_PX,
  stagePaddingPx: 16,
  chipWidthPx: 136,
  chipHeightPx: 72,
  chipGapPx: 12,
  anchorGapPx: 10,
  outerPadPx: 8,
} as const;

/** Pixels per viewBox unit when the desktop stage is at its narrowest. */
export function mittenSummaryMinPxPerUnit(viewBoxWidth: number): number {
  const svgPx = MITTEN_SUMMARY_CHIP.minStagePx - MITTEN_SUMMARY_CHIP.stagePaddingPx;
  return svgPx / viewBoxWidth;
}

function hMeasure(x1: number, x2: number, y: number, name: string): string {
  const s = 5;
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  return (
    `<g data-dimension="${name}" fill="none" stroke="${DIM}" stroke-width="1.35">` +
    `<line x1="${f(left)}" y1="${f(y)}" x2="${f(right)}" y2="${f(y)}"/>` +
    `<polyline points="${f(left + s)},${f(y - s)} ${f(left)},${f(y)} ${f(left + s)},${f(y + s)}"/>` +
    `<polyline points="${f(right - s)},${f(y - s)} ${f(right)},${f(y)} ${f(right - s)},${f(y + s)}"/>` +
    `</g>`
  );
}

function summaryAnchor(id: string, x: number, y: number): string {
  return `<circle id="${id}" data-summary-anchor="" cx="${f(x)}" cy="${f(y)}" r="1" fill="none"/>`;
}

function summaryLeader(x1: number, y1: number, x2: number, y2: number): string {
  return `<line data-leader="true" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${DIM}" stroke-width="1"/>`;
}

/**
 * Summary/Edit diagram. Same mitten scale as the printed sketch.
 * ViewBox width is solved so chip lanes and the drawing share the stage
 * at the desktop overlay minimum, without stretching the mitten.
 * Edit chips are placed for a right-edge thumb: lengths on the left, thumb on the right.
 */
function buildMittenSummaryDiagramSvg(calc: MittenCalc, slotEdge: MittenSlotEdge): string {
  const m = mittenDiagramMeasurements(calc);
  const scale = HAND_PX / m.handDisplayIn;
  const slotRight = slotEdge === "right";
  const sign = slotRight ? 1 : -1;
  const angle = sign * THUMB_ANGLE;
  const angleRad = (THUMB_ANGLE * Math.PI) / 180;
  const handW = m.handDisplayIn * scale;
  const cuffW = m.cuffDisplayIn * scale;
  const tipH = m.fingertipDepthIn * scale;
  const setupH = m.setupRowIn * scale;
  const straightH = m.straightLengthIn * scale;
  const hand1H = m.hand1LengthIn * scale;
  const cuffH = m.cuffLengthIn * scale;
  const thumbW = m.thumbDisplayIn * scale;
  const thumbLen = m.thumbLengthIn * scale;

  const localDimX = thumbW / 2 + 14;
  const dimBaseX = localDimX * Math.cos(angleRad);
  const dimTipX = localDimX * Math.cos(angleRad) + thumbLen * Math.sin(angleRad);
  const thumbOuter = THUMB_GAP + thumbW / 2 + Math.max(dimBaseX, dimTipX, thumbW / 2);
  const lengthInset = 66;
  const thumbLaneGap = 12;
  const fixed = lengthInset + handW + thumbOuter + thumbLaneGap;
  const chromePx =
    2 *
    (MITTEN_SUMMARY_CHIP.outerPadPx +
      MITTEN_SUMMARY_CHIP.anchorGapPx +
      MITTEN_SUMMARY_CHIP.chipWidthPx);
  const minSvgPx = MITTEN_SUMMARY_CHIP.minStagePx - MITTEN_SUMMARY_CHIP.stagePaddingPx;
  const vbW = (fixed * minSvgPx) / (minSvgPx - chromePx);
  const pxPerVb = minSvgPx / vbW;
  const toVb = (px: number) => px / pxPerVb;
  const sideLane = toVb(
    MITTEN_SUMMARY_CHIP.outerPadPx + MITTEN_SUMMARY_CHIP.anchorGapPx + MITTEN_SUMMARY_CHIP.chipWidthPx,
  );
  const chipH = toVb(MITTEN_SUMMARY_CHIP.chipHeightPx);
  const stackGap = chipH + toVb(MITTEN_SUMMARY_CHIP.chipGapPx);
  const endLane = toVb(
    MITTEN_SUMMARY_CHIP.outerPadPx + MITTEN_SUMMARY_CHIP.anchorGapPx + MITTEN_SUMMARY_CHIP.chipHeightPx,
  );

  const handLeft = slotRight ? sideLane + lengthInset : sideLane + thumbOuter + thumbLaneGap;
  const handRight = handLeft + handW;
  const handMid = (handLeft + handRight) / 2;
  const cuffLeft = handLeft + (handW - cuffW) / 2;
  const cuffRight = cuffLeft + cuffW;
  const yTip = endLane + 10;
  const yDomeBase = yTip + tipH;
  const ySlot = yDomeBase + straightH + setupH;
  const yCuffTop = ySlot + hand1H;
  const yBottom = yCuffTop + cuffH;
  const vbH = yBottom + 10 + endLane;

  const lengthAnchorX = slotRight ? handLeft - lengthInset : handRight + lengthInset;
  const handLineX = slotRight ? handLeft - 52 : handRight + 52;
  const segmentLineX = slotRight ? handLeft - 26 : handRight + 26;
  const thumbAnchorX = slotRight
    ? handRight + thumbOuter + thumbLaneGap
    : handLeft - thumbOuter - thumbLaneGap;

  const baseX = (slotRight ? handRight : handLeft) + sign * (THUMB_GAP + thumbW / 2);
  const baseY = ySlot + Math.min(18, thumbW * 0.28);
  const cap = Math.min(thumbW / 2, thumbLen * 0.42);
  const straight = Math.max(0, thumbLen - cap);
  const thumbOutline =
    `M ${f(-thumbW / 2)} 0 L ${f(-thumbW / 2)} ${f(-straight)} ` +
    `A ${f(thumbW / 2)} ${f(cap)} 0 0 1 ${f(thumbW / 2)} ${f(-straight)} ` +
    `L ${f(thumbW / 2)} 0`;
  const thumbDimLocalX = sign * (thumbW / 2 + 14);
  const thumbMid = rotateLocal(thumbDimLocalX, -thumbLen / 2, angle);
  const thumbDimX = baseX + thumbMid.x;
  const thumbDimY = baseY + thumbMid.y;

  const [hand2Y, handY, cuffY] = spreadCenters(
    [(yTip + ySlot) / 2, (yTip + yCuffTop) / 2, (yCuffTop + yBottom) / 2],
    stackGap,
  );
  const [thumbLenY, thumbCircY] = spreadCenters(
    [thumbDimY, baseY + THUMB_OVAL_RY + 16],
    stackGap,
  );

  const handCircY = yTip - 10;
  const cuffCircY = yBottom + 10;
  const body =
    `M ${f(cuffLeft)} ${f(yBottom)} L ${f(cuffRight)} ${f(yBottom)} ` +
    `L ${f(cuffRight)} ${f(yCuffTop)} L ${f(handRight)} ${f(yCuffTop)} ` +
    `L ${f(handRight)} ${f(yDomeBase)} ` +
    `A ${f(handW / 2)} ${f(tipH)} 0 0 0 ${f(handLeft)} ${f(yDomeBase)} ` +
    `L ${f(handLeft)} ${f(yCuffTop)} L ${f(cuffLeft)} ${f(yCuffTop)} Z`;
  const thumbDim =
    `<g data-dimension="thumb-length" fill="none" stroke="${DIM}" stroke-width="1.35">` +
    `<line x1="${f(thumbDimLocalX)}" y1="0" x2="${f(thumbDimLocalX)}" y2="${f(-thumbLen)}"/>` +
    `<polyline points="${f(thumbDimLocalX - 5)},-5 ${f(thumbDimLocalX)},0 ${f(thumbDimLocalX + 5)},-5"/>` +
    `<polyline points="${f(thumbDimLocalX - 5)},${f(-thumbLen + 5)} ${f(thumbDimLocalX)},${f(-thumbLen)} ${f(thumbDimLocalX + 5)},${f(-thumbLen + 5)}"/>` +
    `</g>`;
  const construction = calc.thumbStyle === "gored" ? "Gored mitten" : "Slotted mitten";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(vbW)} ${f(vbH)}" width="100%" role="img" data-diagram="mitten-sketch" data-diagram-mode="summary" data-slot-edge="${slotEdge}" data-hand-mid-x="${f(handMid)}" data-thumb-base-x="${f(baseX)}" data-hand-width-px="${f(handW)}" data-cuff-width-px="${f(cuffW)}" data-cuff-length-px="${f(cuffH)}" data-hand1-px="${f(hand1H)}" data-hand2-px="${f(straightH + setupH + tipH)}" data-total-height-px="${f(yBottom - yTip)}" data-fingertip-depth-px="${f(tipH)}" data-fingertip-depth-rows="${calc.fingertip.shortRowDepthRows}" data-dome-top="${f(yTip)}" data-y-tip="${f(yTip)}" data-y-slot="${f(ySlot)}" data-y-cuff-top="${f(yCuffTop)}" data-y-bottom="${f(yBottom)}" data-thumb-width-px="${f(thumbW)}" data-thumb-length-px="${f(thumbLen)}">
  <title>${construction}, ${slotEdge}-edge thumb</title>
  <rect x="0" y="0" width="${f(vbW)}" height="${f(vbH)}" fill="#fff"/>
  <path data-mitten-outline="hand" d="${body}" fill="none" stroke="${STROKE}" stroke-width="2" stroke-linejoin="round"/>
  <ellipse data-opening="hand" cx="${f(handMid)}" cy="${f(ySlot)}" rx="${f(handW * 0.42)}" ry="${HAND_OVAL_RY}" fill="none" stroke="${STROKE}" stroke-width="1.75"/>
  <g data-mitten-outline="thumb" transform="translate(${f(baseX)} ${f(baseY)}) rotate(${f(angle)})">
    <path d="${thumbOutline}" fill="none" stroke="${STROKE}" stroke-width="2" stroke-linejoin="round"/>
    ${thumbDim}
  </g>
  <ellipse data-opening="thumb" cx="${f(baseX)}" cy="${f(baseY)}" rx="${f(thumbW * 0.78)}" ry="${THUMB_OVAL_RY}" fill="none" stroke="${STROKE}" stroke-width="1.75"/>
  ${hMeasure(handLeft, handRight, handCircY, "hand-circ")}
  ${summaryAnchor(MITTEN_SUMMARY_TARGETS.handCircumference, handMid, handCircY)}
  ${vMeasure(segmentLineX, yTip, ySlot, "hand-2")}
  ${summaryLeader(lengthAnchorX, hand2Y ?? handCircY, segmentLineX, hand2Y ?? handCircY)}
  ${summaryAnchor(MITTEN_SUMMARY_TARGETS.hand2Length, lengthAnchorX, hand2Y ?? 0)}
  ${vMeasure(handLineX, yTip, yCuffTop, "hand-length")}
  ${summaryLeader(lengthAnchorX, handY ?? handCircY, handLineX, handY ?? handCircY)}
  ${summaryAnchor(MITTEN_SUMMARY_TARGETS.handLength, lengthAnchorX, handY ?? 0)}
  ${vMeasure(segmentLineX, yCuffTop, yBottom, "cuff")}
  ${summaryLeader(lengthAnchorX, cuffY ?? cuffCircY, segmentLineX, cuffY ?? cuffCircY)}
  ${summaryAnchor(MITTEN_SUMMARY_TARGETS.cuffLength, lengthAnchorX, cuffY ?? 0)}
  ${hMeasure(cuffLeft, cuffRight, cuffCircY, "cuff-circ")}
  ${summaryAnchor(MITTEN_SUMMARY_TARGETS.cuffCircumference, (cuffLeft + cuffRight) / 2, cuffCircY)}
  ${summaryLeader(thumbAnchorX, thumbLenY ?? thumbDimY, thumbDimX, thumbDimY)}
  ${summaryAnchor(MITTEN_SUMMARY_TARGETS.thumbLength, thumbAnchorX, thumbLenY ?? thumbDimY)}
  ${hMeasure(baseX - sign * thumbW * 0.2, baseX + sign * (thumbW * 0.78), baseY, "thumb-circ")}
  ${summaryLeader(thumbAnchorX, thumbCircY ?? baseY, baseX + sign * (thumbW * 0.78), baseY)}
  ${summaryAnchor(MITTEN_SUMMARY_TARGETS.thumbCircumference, thumbAnchorX, thumbCircY ?? baseY)}
</svg>`;
}

export type MittenPatternSketchFrame = {
  handLeft: number;
  handRight: number;
  handMid: number;
  cuffLeft: number;
  cuffRight: number;
  yTip: number;
  yDomeBase: number;
  ySlot: number;
  yCuffTop: number;
  yBottom: number;
  tipH: number;
  handW: number;
  cuffW: number;
  hand1H: number;
  straightH: number;
  setupH: number;
  cuffH: number;
  hand2H: number;
  thumbW: number;
  thumbLen: number;
  baseX: number;
  baseY: number;
  sign: number;
  angle: number;
  slotRight: boolean;
};

/**
 * Finished-pattern mitten, scaled like the drop-shoulder body and placed near the
 * labels. Summary/Edit uses its own frame so the measurement lanes stay put.
 */
export function mittenPatternSketchFrame(
  calc: MittenCalc,
  slotEdge: MittenSlotEdge,
): MittenPatternSketchFrame {
  const m = mittenDiagramMeasurements(calc);
  const scale = PATTERN_HAND_PX / m.handDisplayIn;
  const slotRight = slotEdge === "right";
  const sign = slotRight ? 1 : -1;
  const angle = sign * THUMB_ANGLE;
  const handW = m.handDisplayIn * scale;
  const cuffW = m.cuffDisplayIn * scale;
  const tipH = m.fingertipDepthIn * scale;
  const setupH = m.setupRowIn * scale;
  const straightH = m.straightLengthIn * scale;
  const hand1H = m.hand1LengthIn * scale;
  const cuffH = m.cuffLengthIn * scale;
  const thumbW = m.thumbDisplayIn * scale;
  const thumbLen = m.thumbLengthIn * scale;
  const angleRad = (THUMB_ANGLE * Math.PI) / 180;
  const thumbReach = Math.sin(angleRad) * thumbLen + (thumbW / 2) * Math.cos(angleRad);
  const lengthSide = PATTERN_PAD + 104;
  const thumbSide = PATTERN_PAD + THUMB_GAP + thumbW / 2 + thumbReach + 48;
  const handLeft = slotRight ? lengthSide : thumbSide;
  const handRight = handLeft + handW;
  const yTip = PATTERN_PAD + 4;
  const yDomeBase = yTip + tipH;
  const ySlot = yDomeBase + straightH + setupH;
  const yCuffTop = ySlot + hand1H;
  const yBottom = yCuffTop + cuffH;
  const baseX = (slotRight ? handRight : handLeft) + sign * (THUMB_GAP + thumbW / 2);
  const baseY = ySlot + Math.min(18, thumbW * 0.28);
  const cuffLeft = handLeft + (handW - cuffW) / 2;
  return {
    handLeft,
    handRight,
    handMid: (handLeft + handRight) / 2,
    cuffLeft,
    cuffRight: cuffLeft + cuffW,
    yTip,
    yDomeBase,
    ySlot,
    yCuffTop,
    yBottom,
    tipH,
    handW,
    cuffW,
    hand1H,
    straightH,
    setupH,
    cuffH,
    hand2H: straightH + setupH + tipH,
    thumbW,
    thumbLen,
    baseX,
    baseY,
    sign,
    angle,
    slotRight,
  };
}

type InkBox = { x: number; y: number; w: number; h: number };

function lineWidth(content: string, size: number): number {
  return Math.max(size, content.length * size * 0.56);
}

function fitViewBox(boxes: InkBox[], pad = PATTERN_PAD): { minX: number; minY: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  }
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  return { minX, minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function boxesOverlap(a: InkBox, b: InkBox, gap = 8): boolean {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
}

/** Two-line sweater label. A rotated label reads along a vertical dimension. */
function stsRowsLabel(
  label: string,
  x: number,
  y: number,
  anchor: "start" | "middle" | "end",
  role: string,
  transform?: string,
  extra = "",
): string {
  return stitchesRowsLabelMarkup({
    label,
    x: transform ? 0 : x,
    y: transform ? 0 : y,
    anchor,
    fill: DS_MUTED,
    countSize: STS_COUNT,
    measureSize: STS_MEASURE,
    fontFamily: DS_FONT,
    transform,
    extra: ` data-dimension-label="${role}"${extra}`,
    fmt: fmtNum,
  });
}

/**
 * Distance from a point on the dimension line to the count baseline.
 * The measurement stays one label step from the count, and the nearer line of
 * text stays LABEL_CLEAR off the dimension line. `away` is a unit vector
 * pointing to the side that holds the label.
 */
function labelAnchor(
  x: number,
  y: number,
  rotationDeg: number,
  awayX: number,
  awayY: number,
): { x: number; y: number } {
  const radians = (rotationDeg * Math.PI) / 180;
  const shiftX = -Math.sin(radians);
  const shiftY = Math.cos(radians);
  const toward = shiftX * awayX + shiftY * awayY;
  const distance =
    toward >= 0
      ? LABEL_CLEAR + toward * COUNT_ABOVE
      : LABEL_CLEAR + MEASURE_DESCENT - toward * STS_GAP;
  return { x: x + awayX * distance, y: y + awayY * distance };
}

function labelInk(label: string, x: number, y: number, rotationDeg: number): InkBox {
  const [count = "", measure = ""] = label.split("\n");
  const along = Math.max(lineWidth(count, STS_COUNT), measure ? lineWidth(measure, STS_MEASURE) : 0);
  const radians = (rotationDeg * Math.PI) / 180;
  const ux = Math.cos(radians);
  const uy = Math.sin(radians);
  const vx = -Math.sin(radians);
  const vy = Math.cos(radians);
  const half = along / 2;
  const forward = measure ? STS_GAP + 3 : 2;
  const corners = [
    [-half, -COUNT_ABOVE],
    [half, -COUNT_ABOVE],
    [half, forward],
    [-half, forward],
  ].map(([alongOffset, crossOffset]) => ({
    x: x + (alongOffset ?? 0) * ux + (crossOffset ?? 0) * vx,
    y: y + (alongOffset ?? 0) * uy + (crossOffset ?? 0) * vy,
  }));
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function horizontalDimension(
  left: number,
  right: number,
  y: number,
  labelY: number,
  label: string,
  role: string,
): { markup: string; boxes: InkBox[] } {
  const mid = (left + right) / 2;
  const castOn = role === "cast-on";
  return {
    markup:
      `<g data-dimension="${role}"${castOn ? ` data-cast-on-width="true" data-cast-on-y="${fmtNum(y)}"` : ""}>` +
      `<line x1="${fmtNum(left)}" y1="${fmtNum(y)}" x2="${fmtNum(right)}" y2="${fmtNum(y)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>` +
      endCap(left, y, false) +
      endCap(right, y, false) +
      stsRowsLabel(label, mid, labelY, "middle", role, undefined, castOn ? ` data-cast-on-width-label="true"` : "") +
      `</g>`,
    boxes: [
      { x: Math.min(left, right), y: y - 4, w: Math.abs(right - left), h: 8 },
      labelInk(label, mid, labelY, 0),
    ],
  };
}

type VerticalSection = { role: string; y1: number; y2: number; label: string };

/**
 * Drop-shoulder vertical dimensions. A short span keeps its label horizontal
 * beside the line. Each label stays centered on its span and steps outward
 * until it clears the labels already placed.
 */
function verticalDimensions(
  sections: readonly VerticalSection[],
  edge: number,
  outward: number,
  occupied: readonly InkBox[],
): { markup: string; boxes: InkBox[] } {
  const placed: InkBox[] = [];
  const parts: string[] = [];
  for (const section of sections) {
    const top = Math.min(section.y1, section.y2);
    const bottom = Math.max(section.y1, section.y2);
    const mid = (top + bottom) / 2;
    const height = bottom - top;
    const along = Math.max(
      lineWidth(section.label.split("\n")[0] ?? "", STS_COUNT),
      lineWidth(section.label.split("\n")[1] ?? "", STS_MEASURE),
    );
    const horizontal = height < along + 8;
    const anchor = outward > 0 ? "start" : "end";
    const rotation = horizontal ? 0 : -90;
    let markup = "";
    let box: InkBox = { x: edge, y: top, w: 1, h: height };
    let lineX = edge;
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const offset = (section.role === "total" ? 40 : 18) + attempt * 16;
      lineX = edge + outward * offset;
      const anchorPoint = labelAnchor(lineX, mid, rotation, outward, 0);
      box = labelInk(section.label, anchorPoint.x, anchorPoint.y, rotation);
      if (horizontal) {
        markup =
          `<g data-dimension="${section.role}">` +
          `<line x1="${fmtNum(lineX)}" y1="${fmtNum(top)}" x2="${fmtNum(lineX)}" y2="${fmtNum(bottom)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>` +
          endCap(lineX, top, true) +
          endCap(lineX, bottom, true) +
          stsRowsLabel(section.label, anchorPoint.x, anchorPoint.y, anchor, section.role) +
          `</g>`;
      } else {
        markup =
          `<g data-dimension="${section.role}">` +
          `<line x1="${fmtNum(lineX)}" y1="${fmtNum(top)}" x2="${fmtNum(lineX)}" y2="${fmtNum(bottom)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>` +
          endCap(lineX, top, true) +
          endCap(lineX, bottom, true) +
          stsRowsLabel(
            section.label,
            anchorPoint.x,
            anchorPoint.y,
            "middle",
            section.role,
            `translate(${fmtNum(anchorPoint.x)} ${fmtNum(anchorPoint.y)}) rotate(-90)`,
          ) +
          `</g>`;
      }
      const lineBox = { x: lineX - 3, y: top + 1, w: 6, h: Math.max(1, height - 2) };
      const hits = [...occupied, ...placed].some((other) => boxesOverlap(box, other) || boxesOverlap(lineBox, other, 2));
      if (!hits) break;
    }
    parts.push(markup);
    placed.push(box, { x: lineX - 3, y: top, w: 6, h: height });
  }
  return { markup: parts.join(""), boxes: placed };
}

function calculatedRowsLabel(rows: number, rowsPerInch: number, unit: MeasurementDisplayUnit): string {
  return formatStitchesRowsDiagramLabel(rows, "rows", formatKnittedCountMeasurement(rows, rowsPerInch, unit));
}

/** Same filled dot the sweater place-marker uses. No caption. */
export const MITTEN_STITCH_MARKER_FILL = "#c62828";
const STITCH_MARKER_R = 8;

/** Inline copy of the diagram dot, sized with the instruction line. */
export function mittenStitchMarkerInlineHtml(): string {
  return (
    `<span class="stitch-marker-symbol" data-stitch-marker="inline" aria-hidden="true">` +
    `<svg viewBox="0 0 16 16" width="0.8em" height="0.8em" focusable="false" aria-hidden="true">` +
    `<circle cx="8" cy="8" r="7" fill="${MITTEN_STITCH_MARKER_FILL}"/></svg></span>`
  );
}

export type MittenStitchMarker = { id: string; x: number; y: number };

/**
 * Stitch-marker dots from the written instructions.
 * Slotted: the thumb opening on the slot edge.
 * Gored: lower and upper markers on each hand edge, markerRows apart.
 */
export function mittenStitchMarkerPositions(
  calc: MittenCalc,
  frame: MittenPatternSketchFrame,
): MittenStitchMarker[] {
  if (!calc.gore) {
    const edge = frame.slotRight ? "right" : "left";
    return [
      {
        id: `slot-${edge}`,
        x: frame.slotRight ? frame.handRight : frame.handLeft,
        y: frame.ySlot,
      },
    ];
  }
  const upperInStraight = Math.min(calc.gore.markerRows, calc.straightRows);
  const intoHand1 = calc.gore.markerRows - upperInStraight;
  const lowerAt = calc.hand1Rows - intoHand1;
  const lowerY =
    frame.yCuffTop - (calc.hand1Rows > 0 ? (lowerAt / calc.hand1Rows) * frame.hand1H : 0);
  const upperY =
    frame.ySlot - (calc.straightRows > 0 ? (upperInStraight / calc.straightRows) * frame.straightH : 0);
  return (["left", "right"] as const).flatMap((edge) => {
    const x = edge === "left" ? frame.handLeft : frame.handRight;
    return [
      { id: `lower-${edge}`, x, y: lowerY },
      { id: `upper-${edge}`, x, y: upperY },
    ];
  });
}

export function mittenStitchMarkerMarkup(calc: MittenCalc, frame: MittenPatternSketchFrame): string {
  const circles = mittenStitchMarkerPositions(calc, frame).map(
    (mark) =>
      `<circle data-thumb-marker="${mark.id}" cx="${fmtNum(mark.x)}" cy="${fmtNum(mark.y)}" r="${STITCH_MARKER_R}" fill="${MITTEN_STITCH_MARKER_FILL}"/>`,
  );
  return circles.length ? `<g data-thumb-markers="true">${circles.join("")}</g>` : "";
}

/** One upright mitten. The second mitten mirrors the thumb side. Online and print share this drawing. */
export function buildMittenDiagramSvg(
  calc: MittenCalc,
  slotEdge: MittenSlotEdge,
  mode: MittenDiagramMode = "pattern",
  unit: MeasurementDisplayUnit = "in",
): string {
  if (mode === "summary") return buildMittenSummaryDiagramSvg(calc, slotEdge);
  const m = mittenDiagramMeasurements(calc);
  const frame = mittenPatternSketchFrame(calc, slotEdge);
  const {
    handLeft,
    handRight,
    handMid,
    cuffLeft,
    cuffRight,
    yTip,
    yDomeBase,
    ySlot,
    yCuffTop,
    yBottom,
    tipH,
    handW,
    cuffW,
    cuffH,
    hand1H,
    hand2H,
    thumbW,
    thumbLen,
    baseX,
    baseY,
    sign,
    angle,
    slotRight,
  } = frame;
  const cap = Math.min(thumbW / 2, thumbLen * 0.42);
  const straight = Math.max(0, thumbLen - cap);
  const thumbOutline =
    `M ${f(-thumbW / 2)} 0 L ${f(-thumbW / 2)} ${f(-straight)} ` +
    `A ${f(thumbW / 2)} ${f(cap)} 0 0 1 ${f(thumbW / 2)} ${f(-straight)} ` +
    `L ${f(thumbW / 2)} 0`;

  const angleRad = (THUMB_ANGLE * Math.PI) / 180;
  const rowsPerInch = calc.rowGaugePerInch;
  const fingertipRows = calc.fingertip.shortRowDepthRows;
  const aboveRows = calc.straightRows + 1;
  const totalRows = calc.cuffRows + calc.hand1Rows + aboveRows + fingertipRows;
  const castOnLabel = castOnEdgeDiagramLabel(calc.cuffSts, calc.stitchGaugePerInch, unit);
  const handLabel = formatStitchesRowsDiagramLabel(
    calc.handSts,
    "sts",
    formatPatternDiagramMeasurement(m.handCircumferenceIn, unit),
  );
  const thumbWidthLabel = formatStitchesRowsDiagramLabel(
    calc.thumbSts,
    "sts",
    formatPatternDiagramMeasurement(m.thumbCircumferenceIn, unit),
  );
  const thumbLengthLabel = formatStitchesRowsDiagramLabel(
    calc.thumbRows,
    "rows",
    formatKnittedDiagramMeasurement(calc.measurements.thumbLengthInches, unit),
  );
  const castOnLineY = yBottom + 22;
  const castOnAnchor = labelAnchor((cuffLeft + cuffRight) / 2, castOnLineY, 0, 0, 1);
  const castOn = horizontalDimension(cuffLeft, cuffRight, castOnLineY, castOnAnchor.y, castOnLabel, "cast-on");
  const handLineY = yDomeBase + Math.max(36, (ySlot - yDomeBase) * 0.42);
  const handAnchor = labelAnchor(handMid, handLineY, 0, 0, -1);
  const handWidth = horizontalDimension(handLeft, handRight, handLineY, handAnchor.y, handLabel, "hand-width");
  const edge = slotRight ? handLeft : handRight;
  const outward = slotRight ? -1 : 1;
  const vertical = verticalDimensions(
    [
      {
        role: "fingertip",
        y1: yTip,
        y2: yDomeBase,
        label: calculatedRowsLabel(fingertipRows, rowsPerInch, unit),
      },
      {
        role: "above-thumb",
        y1: yDomeBase,
        y2: ySlot,
        label: calculatedRowsLabel(aboveRows, rowsPerInch, unit),
      },
      {
        role: "below-thumb",
        y1: ySlot,
        y2: yCuffTop,
        label: calculatedRowsLabel(calc.hand1Rows, rowsPerInch, unit),
      },
      {
        role: "cuff",
        y1: yCuffTop,
        y2: yBottom,
        label: formatStitchesRowsDiagramLabel(
          calc.cuffRows,
          "rows",
          formatPatternDiagramMeasurement(calc.measurements.cuffLengthInches, unit),
        ),
      },
      {
        role: "total",
        y1: yTip,
        y2: yBottom,
        label: calculatedRowsLabel(totalRows, rowsPerInch, unit),
      },
    ],
    edge,
    outward,
    [...castOn.boxes, ...handWidth.boxes],
  );

  const dirX = sign * Math.sin(angleRad);
  const dirY = -Math.cos(angleRad);
  const outX = sign * Math.cos(angleRad);
  const outY = Math.sin(angleRad);
  const widthCenterX = baseX + dirX * thumbLen * 0.42;
  const widthCenterY = baseY + dirY * thumbLen * 0.42;
  const half = thumbW / 2;
  const widthA = { x: widthCenterX - outX * half, y: widthCenterY - outY * half };
  const widthB = { x: widthCenterX + outX * half, y: widthCenterY + outY * half };
  const widthAlongX = outX < 0 ? -outX : outX;
  const widthAlongY = outX < 0 ? -outY : outY;
  const widthRotation = (Math.atan2(widthAlongY, widthAlongX) * 180) / Math.PI;
  const widthAnchor = labelAnchor((widthA.x + widthB.x) / 2, (widthA.y + widthB.y) / 2, widthRotation, dirX, dirY);
  const thumbTipX = baseX + dirX * thumbLen;
  const tipY = baseY + dirY * thumbLen;
  const thumbWidthInk = labelInk(thumbWidthLabel, widthAnchor.x, widthAnchor.y, widthRotation);
  const thumbBlocked = [...vertical.boxes, ...handWidth.boxes, ...castOn.boxes, thumbWidthInk];
  const lengthRotation = -90 + sign * THUMB_ANGLE;
  let lengthBase = { x: baseX, y: baseY };
  let lengthTip = { x: thumbTipX, y: tipY };
  let lengthAnchor = { x: baseX, y: baseY };
  let thumbLengthInk = labelInk(thumbLengthLabel, baseX, baseY, lengthRotation);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const lengthOffset = half + 18 + attempt * 16;
    lengthBase = { x: baseX + outX * lengthOffset, y: baseY + outY * lengthOffset };
    lengthTip = { x: lengthBase.x + dirX * thumbLen, y: lengthBase.y + dirY * thumbLen };
    lengthAnchor = labelAnchor(
      (lengthBase.x + lengthTip.x) / 2,
      (lengthBase.y + lengthTip.y) / 2,
      lengthRotation,
      outX,
      outY,
    );
    thumbLengthInk = labelInk(thumbLengthLabel, lengthAnchor.x, lengthAnchor.y, lengthRotation);
    const samples = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      x: lengthBase.x + (lengthTip.x - lengthBase.x) * t - 4,
      y: lengthBase.y + (lengthTip.y - lengthBase.y) * t - 4,
      w: 8,
      h: 8,
    }));
    const hits = thumbBlocked.some(
      (other) => boxesOverlap(thumbLengthInk, other) || samples.some((sample) => boxesOverlap(sample, other, 2)),
    );
    if (!hits) break;
  }
  const ink: InkBox[] = [
    { x: Math.min(cuffLeft, handLeft), y: yTip, w: Math.max(cuffRight, handRight) - Math.min(cuffLeft, handLeft), h: yBottom - yTip },
    {
      x: Math.min(baseX, thumbTipX) - thumbW,
      y: Math.min(tipY, baseY) - 8,
      w: Math.abs(thumbTipX - baseX) + thumbW * 2,
      h: Math.abs(baseY - tipY) + thumbW,
    },
    ...castOn.boxes,
    ...handWidth.boxes,
    ...vertical.boxes,
    thumbWidthInk,
    thumbLengthInk,
    { x: Math.min(lengthBase.x, lengthTip.x) - 6, y: Math.min(lengthBase.y, lengthTip.y), w: Math.abs(lengthTip.x - lengthBase.x) + 12, h: Math.abs(lengthTip.y - lengthBase.y) },
  ];
  const view = fitViewBox(ink);
  const body =
    `M ${f(cuffLeft)} ${f(yBottom)} L ${f(cuffRight)} ${f(yBottom)} ` +
    `L ${f(cuffRight)} ${f(yCuffTop)} L ${f(handRight)} ${f(yCuffTop)} ` +
    `L ${f(handRight)} ${f(yDomeBase)} ` +
    `A ${f(handW / 2)} ${f(tipH)} 0 0 0 ${f(handLeft)} ${f(yDomeBase)} ` +
    `L ${f(handLeft)} ${f(yCuffTop)} L ${f(cuffLeft)} ${f(yCuffTop)} Z`;
  const construction = calc.thumbStyle === "gored" ? "Gored mitten" : "Slotted mitten";
  const thumbWidthDim =
    `<g data-dimension="thumb-width">` +
    `<line x1="${fmtNum(widthA.x)}" y1="${fmtNum(widthA.y)}" x2="${fmtNum(widthB.x)}" y2="${fmtNum(widthB.y)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>` +
    endCap(widthA.x, widthA.y, false) +
    endCap(widthB.x, widthB.y, false) +
    stsRowsLabel(
      thumbWidthLabel,
      widthAnchor.x,
      widthAnchor.y,
      "middle",
      "thumb-width",
      `translate(${fmtNum(widthAnchor.x)} ${fmtNum(widthAnchor.y)}) rotate(${fmtNum(widthRotation)})`,
    ) +
    `</g>`;
  const thumbLengthDim =
    `<g data-dimension="thumb-length">` +
    `<line x1="${fmtNum(lengthBase.x)}" y1="${fmtNum(lengthBase.y)}" x2="${fmtNum(lengthTip.x)}" y2="${fmtNum(lengthTip.y)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>` +
    endCap(lengthBase.x, lengthBase.y, true) +
    endCap(lengthTip.x, lengthTip.y, true) +
    stsRowsLabel(
      thumbLengthLabel,
      lengthAnchor.x,
      lengthAnchor.y,
      "middle",
      "thumb-length",
      `translate(${fmtNum(lengthAnchor.x)} ${fmtNum(lengthAnchor.y)}) rotate(${fmtNum(lengthRotation)})`,
    ) +
    `</g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(view.minX)} ${f(view.minY)} ${f(view.w)} ${f(view.h)}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" data-diagram="mitten-sketch" data-slot-edge="${slotEdge}" data-diagram-unit="${unit}" data-hand-mid-x="${f(handMid)}" data-thumb-base-x="${f(baseX)}" data-hand-width-px="${f(handW)}" data-cuff-width-px="${f(cuffW)}" data-cuff-length-px="${f(cuffH)}" data-hand1-px="${f(hand1H)}" data-hand2-px="${f(hand2H)}" data-total-height-px="${f(yBottom - yTip)}" data-fingertip-depth-px="${f(tipH)}" data-fingertip-depth-rows="${fingertipRows}" data-dome-top="${f(yTip)}" data-y-bottom="${f(yBottom)}" data-thumb-width-px="${f(thumbW)}" data-thumb-length-px="${f(thumbLen)}">
  <title>${construction}, ${slotEdge}-edge thumb</title>
  <rect x="${f(view.minX)}" y="${f(view.minY)}" width="${f(view.w)}" height="${f(view.h)}" fill="#fff"/>
  <path data-mitten-outline="hand" d="${body}" fill="none" stroke="${STROKE}" stroke-width="2" stroke-linejoin="round"/>
  <ellipse data-opening="hand" cx="${f(handMid)}" cy="${f(ySlot)}" rx="${f(handW * 0.42)}" ry="${HAND_OVAL_RY}" fill="none" stroke="${STROKE}" stroke-width="1.75"/>
  ${handWidth.markup}
  ${castOn.markup}
  <g data-mitten-outline="thumb" transform="translate(${f(baseX)} ${f(baseY)}) rotate(${f(angle)})">
    <path d="${thumbOutline}" fill="none" stroke="${STROKE}" stroke-width="2" stroke-linejoin="round"/>
  </g>
  <ellipse data-opening="thumb" cx="${f(baseX)}" cy="${f(baseY)}" rx="${f(thumbW * 0.78)}" ry="${THUMB_OVAL_RY}" fill="none" stroke="${STROKE}" stroke-width="1.75"/>
  ${thumbWidthDim}
  ${thumbLengthDim}
  ${vertical.markup}
  ${mittenStitchMarkerMarkup(calc, frame)}
</svg>`;
}

export function mittenDiagramFigureHtml(
  calc: MittenCalc,
  slotEdge: MittenSlotEdge,
  unit: MeasurementDisplayUnit = "in",
): string {
  return (
    `<figure class="mitten-diagrams" data-mitten-diagrams="${slotEdge}">` +
    buildMittenDiagramSvg(calc, slotEdge, "pattern", unit) +
    `</figure>`
  );
}
