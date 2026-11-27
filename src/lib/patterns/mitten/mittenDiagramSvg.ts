/**
 * Upright slotted-mitten diagram.
 * Half-circumference is used only to draw the flat view.
 * Labels show builder circumferences and the calculated lengths.
 * Thumb length is web to tip. Gore length is not drawn onto the thumb.
 */

import type { MittenSlotEdge } from "./mittenInstructions";
import { formatMittenLengthInches, mittenPhysicalLengths, type MittenCalc } from "./mittenMath";
import { DESKTOP_MEASUREMENT_OVERLAY_MIN_STAGE_PX } from "../patternSummaryMeasurementOverlay";
import { DS_FONT, DS_FS_MEASURE, DS_FS_SMALL } from "../dropShoulderPatternDiagramSvgShared";
import {
  castOnEdgeDiagramLabel,
  formatKnittedDiagramMeasurement,
  formatPatternDiagramMeasurement,
  formatStitchesRowsDiagramLabel,
  stitchesRowsLabelMarkup,
} from "../legoBlocks/stitchesRowsDiagramLabel";

const FONT = DS_FONT;
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
/**
 * Drop-shoulder measure type is 14px on a 430-unit canvas. The mitten canvas is a
 * little wider because of the thumb, so 16px lands at the same size in the sidebar.
 */
const PATTERN_FS = DS_FS_MEASURE + 2;
const PATTERN_FS_SM = DS_FS_SMALL + 2;
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

/**
 * Thumb lengths still use thousandths until that part of the schematic is reviewed.
 * Hand sections use {@link formatKnittedDiagramMeasurement} instead.
 */
export function formatMittenDiagramLength(inches: number): string {
  return formatMittenLengthInches(inches);
}

/** Knitted section length in the shared one-decimal schematic format. */
function schematicKnittedLength(inches: number): string {
  return formatKnittedDiagramMeasurement(inches, "in");
}

/**
 * Count on the first line, measurement on the second, same anchor.
 * Matches the sweater schematic label block.
 */
function diagramCountMeasure(label: string, x: number, y: number, extra = ""): string {
  return stitchesRowsLabelMarkup({
    label,
    x,
    y,
    anchor: "middle",
    fill: DIM,
    countSize: PATTERN_FS,
    measureSize: PATTERN_FS_SM,
    fontFamily: FONT,
    extra,
    fmt: f,
  });
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function f(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 100) / 100);
}

function text(
  x: number,
  y: number,
  content: string,
  anchor: "start" | "middle" | "end",
  size = PATTERN_FS,
): string {
  return `<text x="${f(x)}" y="${f(y)}" font-family="${FONT}" font-size="${size}" fill="${DIM}" text-anchor="${anchor}">${escapeXml(content)}</text>`;
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

function textWidth(content: string, size: number): number {
  return Math.max(size, content.length * size * 0.56);
}

function horizontalTextBox(
  x: number,
  y: number,
  content: string,
  anchor: "start" | "middle" | "end",
  size: number,
): InkBox {
  const w = textWidth(content, size);
  const left = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
  return { x: left, y: y - size * 0.85, w, h: size * 1.15 };
}

/** Ink for a count line and the smaller measurement line under it. */
function countMeasureInk(x: number, y: number, label: string): InkBox {
  const [count = "", measure = ""] = label.split("\n");
  const gap = Math.round(PATTERN_FS * 0.95);
  const countBox = horizontalTextBox(x, y, count, "middle", PATTERN_FS);
  if (!measure) return countBox;
  const measureBox = horizontalTextBox(x, y + gap, measure, "middle", PATTERN_FS_SM);
  const left = Math.min(countBox.x, measureBox.x);
  const top = Math.min(countBox.y, measureBox.y);
  const right = Math.max(countBox.x + countBox.w, measureBox.x + measureBox.w);
  const bottom = Math.max(countBox.y + countBox.h, measureBox.y + measureBox.h);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Vertical label, matching the drop-shoulder side measurements. */
function rotatedTextBox(x: number, y: number, content: string, size: number): InkBox {
  const h = textWidth(content, size);
  return { x: x - size * 0.7, y: y - h / 2, w: size * 1.4, h };
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

function rotatedText(x: number, y: number, content: string, size = PATTERN_FS): string {
  return `<text x="0" y="0" transform="translate(${f(x)} ${f(y)}) rotate(-90)" font-family="${FONT}" font-size="${size}" fill="${DIM}" text-anchor="middle">${escapeXml(content)}</text>`;
}

/** Push vertical labels apart. Longer names stay at the same type size. */
function spreadRotatedColumn(labels: { text: string; y: number }[]): void {
  const ordered = [...labels].sort((a, b) => a.y - b.y);
  for (let index = 1; index < ordered.length; index++) {
    const prev = ordered[index - 1];
    const curr = ordered[index];
    if (!prev || !curr) continue;
    const minGap = textWidth(prev.text, PATTERN_FS) / 2 + textWidth(curr.text, PATTERN_FS) / 2 + 8;
    if (curr.y < prev.y + minGap) curr.y = prev.y + minGap;
  }
}

/**
 * Thumb circumference sits beside the thumb opening, inward of the length label.
 * The length column moves outward only when that is what keeps the two apart.
 */
function placeThumbSideLabels(input: {
  baseX: number;
  baseY: number;
  sign: number;
  thumbW: number;
  thumbLen: number;
  thumbColumnX: number;
  thumbLenCenter: number;
  circLabel: string;
  circValue: string;
}): {
  lengthX: number;
  lengthNameY: number;
  lengthValueY: number;
  circX: number;
  circNameY: number;
  circValueY: number;
} {
  const angleRad = (THUMB_ANGLE * Math.PI) / 180;
  const boxHalf = (size: number) => size * 0.7;
  const lengthBox = Math.max(boxHalf(PATTERN_FS), boxHalf(PATTERN_FS_SM));
  const circBox = Math.max(boxHalf(PATTERN_FS), boxHalf(PATTERN_FS_SM));
  const openingOuter = input.thumbW * 0.78;
  let lengthOffset = Math.abs(input.thumbColumnX - input.baseX);
  const circValueHalf = textWidth(input.circValue, PATTERN_FS) / 2;
  const circNameHalf = textWidth(input.circLabel, PATTERN_FS_SM) / 2;
  // The length arrow ends just below the thumb web. Keep the circumference
  // value under that arrow, beside the opening, with the name directly below it.
  const lengthArrowBottom = input.baseY + (input.thumbW / 2 + 14) * Math.sin(angleRad);
  const circValueY = lengthArrowBottom + 10 + circValueHalf;
  const circNameY = circValueY + circValueHalf + 12 + circNameHalf;
  let circOffset = openingOuter + circBox + 8;
  if (lengthOffset < circOffset + circBox + 12 + lengthBox) {
    lengthOffset = circOffset + circBox + 12 + lengthBox;
  }
  const lengthNameY = input.thumbLenCenter - 48;
  const lengthValueY = input.thumbLenCenter + 48;
  return {
    lengthX: input.baseX + input.sign * lengthOffset,
    lengthNameY,
    lengthValueY,
    circX: input.baseX + input.sign * circOffset,
    circNameY,
    circValueY,
  };
}

/** One upright mitten. The second mitten mirrors the thumb side. */
export function buildMittenDiagramSvg(
  calc: MittenCalc,
  slotEdge: MittenSlotEdge,
  mode: MittenDiagramMode = "pattern",
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
  const tipY = baseY - Math.cos(angleRad) * thumbLen;
  const edge = slotRight ? handLeft : handRight;
  const outward = slotRight ? -1 : 1;
  const fingertipX = edge + outward * 16;
  const sectionX = edge + outward * 34;
  const totalX = edge + outward * 54;
  const nearLabelX = edge + outward * 72;
  const farLabelX = edge + outward * 108;
  const len = formatMittenDiagramLength;
  const circ = formatMittenDiagramInches;
  const sectionLabels = [
    { text: `Fingertip ${schematicKnittedLength(m.fingertipDepthIn)}`, y: (yTip + yDomeBase) / 2, x: nearLabelX },
    { text: `Above thumb ${schematicKnittedLength(m.slotToFingertipIn)}`, y: (yDomeBase + ySlot) / 2, x: farLabelX },
    { text: `Below thumb ${schematicKnittedLength(m.hand1LengthIn)}`, y: (ySlot + yCuffTop) / 2, x: nearLabelX },
    { text: `Cuff ${schematicKnittedLength(m.cuffLengthIn)}`, y: (yCuffTop + yBottom) / 2, x: farLabelX },
  ];
  const totalText = `Total ${schematicKnittedLength(m.totalLengthIn)}`;
  const totalLabel = { text: totalText, y: (yTip + yBottom) / 2, x: farLabelX };
  spreadRotatedColumn(sectionLabels.filter((label) => label.x === nearLabelX));
  spreadRotatedColumn([...sectionLabels.filter((label) => label.x === farLabelX), totalLabel]);
  const totalLabelX = farLabelX;
  const totalLabelY = totalLabel.y;
  const handCirc = "Hand circumference";
  const handLabel = formatStitchesRowsDiagramLabel(
    calc.handSts,
    "sts",
    formatPatternDiagramMeasurement(m.handCircumferenceIn, "in"),
  );
  const castOnLabel = castOnEdgeDiagramLabel(calc.cuffSts, calc.stitchGaugePerInch, "in");
  const castOnLineY = yBottom + 22;
  const castOnLabelY = castOnLineY + 16;
  /** Keep the inch baseline where it already sits, and place the stitch count above it. */
  const handMeasureY = ySlot - HAND_OVAL_RY - 14;
  const handCountY = handMeasureY - Math.round(PATTERN_FS * 0.95);
  const handCaptionY = handCountY - 24;
  const thumbCirc = "Thumb circumference";
  const thumbIn = `${circ(m.thumbCircumferenceIn)} in`;
  const thumbLength = "Thumb length";
  const thumbInLen = `${len(m.thumbLengthIn)} in`;
  const thumbDimLocalX = sign * (thumbW / 2 + 14);
  const thumbTipX = baseX + sign * (Math.sin(angleRad) * thumbLen + (thumbW / 2) * Math.cos(angleRad));
  const thumbLenCenter = (tipY + baseY) / 2;
  const thumbSide = placeThumbSideLabels({
    baseX,
    baseY,
    sign,
    thumbW,
    thumbLen,
    thumbColumnX: thumbTipX + sign * 22,
    thumbLenCenter,
    circLabel: thumbCirc,
    circValue: thumbIn,
  });

  const ink: InkBox[] = [
    { x: cuffLeft, y: yTip, w: cuffW, h: yBottom - yTip },
    { x: handLeft, y: yTip, w: handW, h: ySlot - yTip },
    { x: Math.min(baseX, thumbTipX) - thumbW / 2, y: Math.min(tipY, baseY), w: Math.abs(thumbTipX - baseX) + thumbW, h: Math.abs(baseY - tipY) + THUMB_OVAL_RY },
    { x: Math.min(fingertipX, sectionX, totalX) - 6, y: yTip, w: 12, h: yBottom - yTip },
    horizontalTextBox(handMid, handCaptionY, handCirc, "middle", PATTERN_FS_SM),
    countMeasureInk(handMid, handCountY, handLabel),
    { x: cuffLeft, y: castOnLineY - 6, w: cuffW, h: 12 },
    countMeasureInk(handMid, castOnLabelY, castOnLabel),
    rotatedTextBox(totalLabelX, totalLabelY, totalText, PATTERN_FS),
    rotatedTextBox(thumbSide.lengthX, thumbSide.lengthNameY, thumbLength, PATTERN_FS_SM),
    rotatedTextBox(thumbSide.lengthX, thumbSide.lengthValueY, thumbInLen, PATTERN_FS),
    rotatedTextBox(thumbSide.circX, thumbSide.circNameY, thumbCirc, PATTERN_FS_SM),
    rotatedTextBox(thumbSide.circX, thumbSide.circValueY, thumbIn, PATTERN_FS),
    ...sectionLabels.map((label) => rotatedTextBox(label.x, label.y, label.text, PATTERN_FS)),
  ];
  const view = fitViewBox(ink);

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
  const sectionMarkup = sectionLabels
    .map((label) => rotatedText(label.x, label.y, label.text))
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(view.minX)} ${f(view.minY)} ${f(view.w)} ${f(view.h)}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" data-diagram="mitten-sketch" data-slot-edge="${slotEdge}" data-hand-mid-x="${f(handMid)}" data-thumb-base-x="${f(baseX)}" data-hand-width-px="${f(handW)}" data-cuff-width-px="${f(cuffW)}" data-cuff-length-px="${f(cuffH)}" data-hand1-px="${f(hand1H)}" data-hand2-px="${f(hand2H)}" data-total-height-px="${f(yBottom - yTip)}" data-fingertip-depth-px="${f(tipH)}" data-fingertip-depth-rows="${calc.fingertip.shortRowDepthRows}" data-dome-top="${f(yTip)}" data-y-bottom="${f(yBottom)}" data-thumb-width-px="${f(thumbW)}" data-thumb-length-px="${f(thumbLen)}">
  <title>${construction}, ${slotEdge}-edge thumb</title>
  <rect x="${f(view.minX)}" y="${f(view.minY)}" width="${f(view.w)}" height="${f(view.h)}" fill="#fff"/>
  <path data-mitten-outline="hand" d="${body}" fill="none" stroke="${STROKE}" stroke-width="2" stroke-linejoin="round"/>
  <ellipse data-opening="hand" cx="${f(handMid)}" cy="${f(ySlot)}" rx="${f(handW * 0.42)}" ry="${HAND_OVAL_RY}" fill="none" stroke="${STROKE}" stroke-width="1.75"/>
  <g data-label="hand-circumference">
    ${text(handMid, handCaptionY, handCirc, "middle", PATTERN_FS_SM)}
    ${diagramCountMeasure(handLabel, handMid, handCountY)}
  </g>
  <g data-label="cast-on" data-cast-on-width="true" data-cast-on-y="${f(castOnLineY)}">
    ${hMeasure(cuffLeft, cuffRight, castOnLineY, "cast-on")}
    ${diagramCountMeasure(castOnLabel, handMid, castOnLabelY, ` data-cast-on-width-label="true"`)}
  </g>
  <g data-mitten-outline="thumb" transform="translate(${f(baseX)} ${f(baseY)}) rotate(${f(angle)})">
    <path d="${thumbOutline}" fill="none" stroke="${STROKE}" stroke-width="2" stroke-linejoin="round"/>
    ${thumbDim}
  </g>
  <ellipse data-opening="thumb" cx="${f(baseX)}" cy="${f(baseY)}" rx="${f(thumbW * 0.78)}" ry="${THUMB_OVAL_RY}" fill="none" stroke="${STROKE}" stroke-width="1.75"/>
  <g data-label="thumb-circumference">
    ${rotatedText(thumbSide.circX, thumbSide.circNameY, thumbCirc, PATTERN_FS_SM)}
    ${rotatedText(thumbSide.circX, thumbSide.circValueY, thumbIn, PATTERN_FS)}
  </g>
  <g data-label="thumb-length">
    ${rotatedText(thumbSide.lengthX, thumbSide.lengthNameY, thumbLength, PATTERN_FS_SM)}
    ${rotatedText(thumbSide.lengthX, thumbSide.lengthValueY, thumbInLen, PATTERN_FS)}
  </g>
  ${vMeasure(fingertipX, yTip, yDomeBase, "fingertip")}
  ${vMeasure(sectionX, ySlot, yTip, "hand-2")}
  ${vMeasure(sectionX, yCuffTop, ySlot, "hand-1")}
  ${vMeasure(sectionX, yBottom, yCuffTop, "cuff")}
  ${vMeasure(totalX, yTip, yBottom, "total")}
  ${sectionMarkup}
  ${rotatedText(totalLabelX, totalLabelY, totalText)}
</svg>`;
}

export function mittenDiagramFigureHtml(calc: MittenCalc, slotEdge: MittenSlotEdge): string {
  return (
    `<figure class="mitten-diagrams" data-mitten-diagrams="${slotEdge}">` +
    buildMittenDiagramSvg(calc, slotEdge) +
    `</figure>`
  );
}
