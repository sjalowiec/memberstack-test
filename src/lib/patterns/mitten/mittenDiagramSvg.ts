/**
 * Upright slotted-mitten diagram.
 * Half-circumference is used only to draw the flat view.
 * Labels show builder circumferences and the calculated lengths.
 * Thumb length is web to tip. Gore length is not drawn onto the thumb.
 */

import type { MittenSlotEdge } from "./mittenInstructions";
import { formatMittenLengthInches, mittenPhysicalLengths, type MittenCalc } from "./mittenMath";

const FONT = "Poppins, system-ui, Arial, sans-serif";
const STROKE = "#1a1a1a";
const DIM = "#52682d";
const VB_W = 840;
const HAND_PX = 150;
const FS = 16;
const FS_SM = 14;
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
  /** Hand 2, from the thumb slot through the setup row and fingertip shaping. */
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

/** Calculated lengths. Thousandths are kept when the row gauge needs them. */
export function formatMittenDiagramLength(inches: number): string {
  return formatMittenLengthInches(inches);
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
  size = FS,
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

/** One upright mitten. The second mitten mirrors the thumb side. */
export function buildMittenDiagramSvg(
  calc: MittenCalc,
  slotEdge: MittenSlotEdge,
  mode: MittenDiagramMode = "pattern",
): string {
  const m = mittenDiagramMeasurements(calc);
  const scale = HAND_PX / m.handDisplayIn;
  const slotRight = slotEdge === "right";
  const handW = m.handDisplayIn * scale;
  const cuffW = m.cuffDisplayIn * scale;
  const tipH = m.fingertipDepthIn * scale;
  const setupH = m.setupRowIn * scale;
  const straightH = m.straightLengthIn * scale;
  const hand1H = m.hand1LengthIn * scale;
  const cuffH = m.cuffLengthIn * scale;
  const hand2H = straightH + setupH + tipH;
  const thumbW = m.thumbDisplayIn * scale;
  const thumbLen = m.thumbLengthIn * scale;
  const handLeft = 360;
  const handRight = handLeft + handW;
  const handMid = (handLeft + handRight) / 2;
  const cuffLeft = handLeft + (handW - cuffW) / 2;
  const cuffRight = cuffLeft + cuffW;
  const yTip = 36;
  const yDomeBase = yTip + tipH;
  const ySlot = yDomeBase + straightH + setupH;
  const yCuffTop = ySlot + hand1H;
  const yBottom = yCuffTop + cuffH;

  const sign = slotRight ? 1 : -1;
  const angle = sign * THUMB_ANGLE;
  const baseX = (slotRight ? handRight : handLeft) + sign * (THUMB_GAP + thumbW / 2);
  const baseY = ySlot + Math.min(18, thumbW * 0.28);
  const cap = Math.min(thumbW / 2, thumbLen * 0.42);
  const straight = Math.max(0, thumbLen - cap);
  const thumbOutline =
    `M ${f(-thumbW / 2)} 0 L ${f(-thumbW / 2)} ${f(-straight)} ` +
    `A ${f(thumbW / 2)} ${f(cap)} 0 0 1 ${f(thumbW / 2)} ${f(-straight)} ` +
    `L ${f(thumbW / 2)} 0`;

  const angleRad = (THUMB_ANGLE * Math.PI) / 180;
  const tipReach = Math.sin(angleRad) * thumbLen;
  const outerEdge = baseX + sign * (thumbW / 2 + tipReach);
  const innerSep = outerEdge + sign * 16;
  const outerSep = innerSep + sign * 14;
  const tipY = baseY - Math.cos(angleRad) * thumbLen;

  const labelAnchor = slotRight ? "end" : "start";
  const edge = slotRight ? handLeft : handRight;
  const outward = slotRight ? -1 : 1;
  const fingertipX = edge + outward * 20;
  const sectionX = edge + outward * 58;
  const totalX = edge + outward * 210;
  const sectionLabelX = sectionX + outward * 10;
  const totalLabelX = totalX + outward * 10;

  const [tipLabelY, hand2LabelY, hand1LabelY, cuffLabelY] = spreadCenters(
    [(yTip + yDomeBase) / 2, (yTip + ySlot) / 2, (yCuffTop + ySlot) / 2, (yCuffTop + yBottom) / 2],
    22,
  );
  const totalLabelY = (yTip + yBottom) / 2;

  const thumbDimLocalX = sign * (thumbW / 2 + 14);
  const thumbLabelLocal = rotateLocal(sign * (thumbW / 2 + 28), -thumbLen - 4, angle);
  const thumbLabelX = baseX + thumbLabelLocal.x;
  const thumbLabelY = baseY + thumbLabelLocal.y;
  const thumbLabelAnchor = slotRight ? "start" : "end";

  const len = formatMittenDiagramLength;
  const circ = formatMittenDiagramInches;
  const vbH = yBottom + 28;
  const summary = mode === "summary";
  const label = (
    x: number,
    y: number,
    content: string,
    anchor: "start" | "middle" | "end",
    size = FS,
  ) => (summary ? "" : text(x, y, content, anchor, size));

  const body =
    `M ${f(cuffLeft)} ${f(yBottom)} L ${f(cuffRight)} ${f(yBottom)} ` +
    `L ${f(cuffRight)} ${f(yCuffTop)} L ${f(handRight)} ${f(yCuffTop)} ` +
    `L ${f(handRight)} ${f(yDomeBase)} ` +
    `A ${f(handW / 2)} ${f(tipH)} 0 0 0 ${f(handLeft)} ${f(yDomeBase)} ` +
    `L ${f(handLeft)} ${f(yCuffTop)} L ${f(cuffLeft)} ${f(yCuffTop)} Z`;

  const thumbDim =
    `<g${summary ? ` id="${MITTEN_SUMMARY_TARGETS.thumbLength}"` : ""} data-dimension="thumb-length" fill="none" stroke="${DIM}" stroke-width="1.35">` +
    `<line x1="${f(thumbDimLocalX)}" y1="0" x2="${f(thumbDimLocalX)}" y2="${f(-thumbLen)}"/>` +
    `<polyline points="${f(thumbDimLocalX - 5)},-5 ${f(thumbDimLocalX)},0 ${f(thumbDimLocalX + 5)},-5"/>` +
    `<polyline points="${f(thumbDimLocalX - 5)},${f(-thumbLen + 5)} ${f(thumbDimLocalX)},${f(-thumbLen)} ${f(thumbDimLocalX + 5)},${f(-thumbLen + 5)}"/>` +
    `</g>`;

  const construction = calc.thumbStyle === "gored" ? "Gored mitten" : "Slotted mitten";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${f(vbH)}" width="100%" role="img" data-diagram="mitten-sketch" data-slot-edge="${slotEdge}" data-hand-mid-x="${f(handMid)}" data-thumb-base-x="${f(baseX)}" data-hand-width-px="${f(handW)}" data-cuff-width-px="${f(cuffW)}" data-cuff-length-px="${f(cuffH)}" data-hand1-px="${f(hand1H)}" data-hand2-px="${f(hand2H)}" data-total-height-px="${f(yBottom - yTip)}" data-fingertip-depth-px="${f(tipH)}" data-fingertip-depth-rows="${calc.fingertip.shortRowDepthRows}" data-dome-top="${f(yTip)}" data-thumb-width-px="${f(thumbW)}" data-thumb-length-px="${f(thumbLen)}">
  <title>${construction}, ${slotEdge}-edge thumb</title>
  <rect x="0" y="0" width="${VB_W}" height="${f(vbH)}" fill="#fff"/>
  <path data-mitten-outline="hand" d="${body}" fill="none" stroke="${STROKE}" stroke-width="2" stroke-linejoin="round"/>
  <ellipse${summary ? ` id="${MITTEN_SUMMARY_TARGETS.handCircumference}"` : ""} data-opening="hand" cx="${f(handMid)}" cy="${f(ySlot)}" rx="${f(handW * 0.42)}" ry="${HAND_OVAL_RY}" fill="none" stroke="${STROKE}" stroke-width="1.75"/>
  ${label(handMid, ySlot - HAND_OVAL_RY - 28, "Hand circumference", "middle", FS_SM)}
  ${label(handMid, ySlot - HAND_OVAL_RY - 8, `${circ(m.handCircumferenceIn)} in`, "middle", FS_SM)}
  <g data-mitten-outline="thumb" transform="translate(${f(baseX)} ${f(baseY)}) rotate(${f(angle)})">
    <path d="${thumbOutline}" fill="none" stroke="${STROKE}" stroke-width="2" stroke-linejoin="round"/>
    ${thumbDim}
  </g>
  <ellipse${summary ? ` id="${MITTEN_SUMMARY_TARGETS.thumbCircumference}"` : ""} data-opening="thumb" cx="${f(baseX)}" cy="${f(baseY)}" rx="${f(thumbW * 0.78)}" ry="${THUMB_OVAL_RY}" fill="none" stroke="${STROKE}" stroke-width="1.75"/>
  ${label(baseX + sign * (thumbW * 0.95), baseY + THUMB_OVAL_RY + 16, "Thumb circumference", slotRight ? "start" : "end", FS_SM)}
  ${label(baseX + sign * (thumbW * 0.95), baseY + THUMB_OVAL_RY + 34, `${circ(m.thumbCircumferenceIn)} in`, slotRight ? "start" : "end", FS_SM)}
  <line data-separation="inner" x1="${f(innerSep)}" y1="${f(tipY - 4)}" x2="${f(innerSep)}" y2="${f(baseY + 22)}" stroke="${STROKE}" stroke-width="1.5"/>
  <line data-separation="outer" x1="${f(outerSep)}" y1="${f(yDomeBase)}" x2="${f(outerSep)}" y2="${f(yCuffTop)}" stroke="${STROKE}" stroke-width="1.5"/>
  ${vMeasure(fingertipX, yTip, yDomeBase, "fingertip")}
  ${vMeasure(sectionX, ySlot, yTip, "hand-2", summary ? MITTEN_SUMMARY_TARGETS.hand2Length : undefined)}
  ${vMeasure(sectionX, yCuffTop, ySlot, "hand-1")}
  ${vMeasure(sectionX, yBottom, yCuffTop, "cuff", summary ? MITTEN_SUMMARY_TARGETS.cuffLength : undefined)}
  ${vMeasure(totalX, yTip, yBottom, "total")}
  ${summary ? `<rect id="${MITTEN_SUMMARY_TARGETS.cuffCircumference}" x="${f((cuffLeft + cuffRight) / 2)}" y="${f((yCuffTop + yBottom) / 2)}" width="2" height="2" fill="none"/>` : ""}
  ${summary ? `<rect id="${MITTEN_SUMMARY_TARGETS.handLength}" x="${f(sectionX)}" y="${f((yTip + yCuffTop) / 2)}" width="2" height="2" fill="none"/>` : ""}
  ${label(sectionLabelX, (tipLabelY ?? 0) + 4, `Fingertip ${len(m.fingertipDepthIn)} in`, labelAnchor)}
  ${label(sectionLabelX, (hand2LabelY ?? 0) + 4, `Hand 2 ${len(m.slotToFingertipIn)} in`, labelAnchor)}
  ${label(sectionLabelX, (hand1LabelY ?? 0) + 4, `Hand 1 ${len(m.hand1LengthIn)} in`, labelAnchor)}
  ${label(sectionLabelX, (cuffLabelY ?? 0) + 4, `Cuff ${len(m.cuffLengthIn)} in`, labelAnchor)}
  ${label(totalLabelX, totalLabelY, `Total ${len(m.totalLengthIn)} in`, labelAnchor)}
  ${label(thumbLabelX, thumbLabelY - 8, "Thumb length", thumbLabelAnchor, FS_SM)}
  ${label(thumbLabelX, thumbLabelY + 10, `${len(m.thumbLengthIn)} in`, thumbLabelAnchor, FS_SM)}
</svg>`;
}

export function mittenDiagramFigureHtml(calc: MittenCalc, slotEdge: MittenSlotEdge): string {
  return (
    `<figure class="mitten-diagrams" data-mitten-diagrams="${slotEdge}">` +
    buildMittenDiagramSvg(calc, slotEdge) +
    `</figure>`
  );
}
