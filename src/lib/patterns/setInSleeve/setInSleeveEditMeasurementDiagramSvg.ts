/**
 * Set-In Sleeve Edit Pattern — Sleeve tab diagram.
 *
 * The silhouette is a flat sleeve at one scale. Drawn width is half the
 * circumference, so a 13" upper arm is 6.5" wide. Lengths stay full inches.
 * Cap stitches and rows are converted through their gauges before that scale.
 * Sleeve length is cuff to underarm. The cap is drawn above it.
 * Label gutters sit outside the silhouette. This file does not compute pattern math.
 */

import {
  DS_ARROW,
  DS_FILL,
  DS_STROKE,
  endCap,
  fmtNum,
} from "../dropShoulderPatternDiagramSvgShared";
import {
  drawSleeveCuffJoin,
  type DropShoulderSleeveDiagramFrame,
} from "../dropShoulderSleeveDiagramSvgShared";
import { PATTERN_SUMMARY_MEASUREMENT_TARGETS } from "../patternSummaryMeasurementOverlay";
import { setInSleeveCapOutlineMarks, setInSleeveFlatWidthInches } from "./setInSleeveDiagram";
import type { SetInSleeveCapSuccess } from "./sleeveCapMath";

export const SET_IN_SLEEVE_EDIT_SLEEVE_MEASUREMENT_TARGET_IDS = [
  PATTERN_SUMMARY_MEASUREMENT_TARGETS.upperArm,
  PATTERN_SUMMARY_MEASUREMENT_TARGETS.armLength,
  PATTERN_SUMMARY_MEASUREMENT_TARGETS.cuffCircumference,
  PATTERN_SUMMARY_MEASUREMENT_TARGETS.cuffDepth,
] as const;

/** Finished inch → user unit. The same value is used on both axes. */
const PX_PER_INCH = 20;

/** Dimension lines sit outside the silhouette, in user units, not in inches. */
const DIM = {
  upperArm: 26,
  cuffCirc: 30,
  sleeveLength: 40,
  cuffDepth: 28,
} as const;

/** Extra viewBox room so HTML chips can sit on those lines without resizing the sleeve. */
const CHIP = {
  top: 28,
  bottom: 36,
  left: 78,
  right: 70,
  edge: 10,
} as const;

export type SetInSleeveEditSleeveMeasurementInput = {
  upperArmInches: number;
  cuffCircumferenceInches: number;
  sleeveLengthInches: number;
  /** Finished cuff depth. Drawn inside the sleeve length, not added beyond it. */
  cuffDepthInches: number;
  /**
   * Cap already produced by the pattern generator. Drawn above the underarm.
   * Omitted only when generation did not return a cap.
   */
  cap?: SetInSleeveCapSuccess | null;
};

type CapPoint = { y: number; left: number; right: number };

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

function leader(x1: number, y1: number, x2: number, y2: number): string {
  return `<line data-role="dim-leader" x1="${fmtNum(x1)}" y1="${fmtNum(y1)}" x2="${fmtNum(x2)}" y2="${fmtNum(y2)}" stroke="${DS_ARROW}" stroke-width="1" fill="none"/>`;
}

function targetCircle(id: string, x: number, y: number): string {
  return `<circle id="${id}" cx="${fmtNum(x)}" cy="${fmtNum(y)}" r="2.5" fill="none"/>`;
}

function finishedInches(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Cap edge in finished inches. Stitches become width through the stitch gauge.
 * Rows become height through the row gauge. Those inches then share one scale.
 */
function capEdgeInches(cap: SetInSleeveCapSuccess): { widthInches: number; upInches: number }[] {
  const upperInches = finishedInches(cap.sleeve.finishedUpperArmInches, 1);
  const capInches = finishedInches(cap.totals.capHeightInches, 0.25);
  const stitchesPerInch = cap.sleeve.upperArmStitches / upperInches;
  const rowsPerInch = cap.totals.capRows / capInches;
  return setInSleeveCapOutlineMarks(cap).map((mark) => ({
    widthInches: stitchesPerInch > 0 ? mark.stitches / stitchesPerInch : upperInches,
    upInches: rowsPerInch > 0 ? mark.rowsFromCapStart / rowsPerInch : 0,
  }));
}

function sleeveOutline(frame: DropShoulderSleeveDiagramFrame, edge: CapPoint[]): string {
  const points = [
    { x: frame.wristLeft, y: frame.bottom },
    { x: frame.wristRight, y: frame.bottom },
    { x: frame.wristRight, y: frame.cuffJoinY },
    ...(edge.length > 0
      ? edge.map((point) => ({ x: point.right, y: point.y }))
      : [{ x: frame.upperRight, y: frame.top }]),
    ...(edge.length > 0
      ? [...edge].reverse().map((point) => ({ x: point.left, y: point.y }))
      : [{ x: frame.upperLeft, y: frame.top }]),
    { x: frame.wristLeft, y: frame.cuffJoinY },
  ];
  return `${points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${fmtNum(point.x)} ${fmtNum(point.y)}`)
    .join(" ")} Z`;
}

export function buildSetInSleeveEditSleeveMeasurementDiagramSvg(
  measurements: SetInSleeveEditSleeveMeasurementInput,
): string {
  const cap = measurements.cap?.ok ? measurements.cap : null;
  const upperArmInches = cap
    ? finishedInches(cap.sleeve.finishedUpperArmInches, measurements.upperArmInches)
    : finishedInches(measurements.upperArmInches, 1);
  const wristInches = finishedInches(measurements.cuffCircumferenceInches, 0.5);
  const sleeveLengthInches = finishedInches(measurements.sleeveLengthInches, 1);
  const cuffDepthInches = Math.max(
    0,
    Math.min(measurements.cuffDepthInches, sleeveLengthInches),
  );
  const bodyInches = Math.max(0, sleeveLengthInches - cuffDepthInches);
  const capInches = cap ? Math.max(0, cap.totals.capHeightInches) : 0;
  const edgeInches = cap && capInches > 0 ? capEdgeInches(cap) : [];

  const upperW = setInSleeveFlatWidthInches(upperArmInches) * PX_PER_INCH;
  const wristW = setInSleeveFlatWidthInches(wristInches) * PX_PER_INCH;
  const cuffH = cuffDepthInches * PX_PER_INCH;
  const bodyH = bodyInches * PX_PER_INCH;
  const capH = capInches * PX_PER_INCH;
  const midX = 0;
  const top = 0;
  const bottom = bodyH + cuffH;
  const cuffJoinY = bottom - cuffH;
  const edge: CapPoint[] = edgeInches.map((point) => ({
    y: top - point.upInches * PX_PER_INCH,
    left: midX - (setInSleeveFlatWidthInches(point.widthInches) * PX_PER_INCH) / 2,
    right: midX + (setInSleeveFlatWidthInches(point.widthInches) * PX_PER_INCH) / 2,
  }));
  const capTopY = edge.length > 0 ? edge[edge.length - 1]!.y : top;
  const frame: DropShoulderSleeveDiagramFrame = {
    direction: "cuff-up",
    midX,
    top,
    bottom,
    cuffJoinY,
    wristY: bottom,
    upperArmY: top,
    wristLeft: midX - wristW / 2,
    wristRight: midX + wristW / 2,
    upperLeft: midX - upperW / 2,
    upperRight: midX + upperW / 2,
    cuffJoinLeft: midX - wristW / 2,
    cuffJoinRight: midX + wristW / 2,
  };
  const hasCap = edge.length > 1 && capTopY < frame.top - 0.5;
  const upperDimY = capTopY - DIM.upperArm;
  const lengthX = Math.min(frame.wristLeft, frame.upperLeft) - DIM.sleeveLength;
  const cuffDepthX = frame.wristRight + DIM.cuffDepth;
  const cuffCircY = frame.bottom + DIM.cuffCirc;
  const minX = lengthX - CHIP.left - CHIP.edge;
  const maxX = Math.max(frame.upperRight, cuffDepthX) + CHIP.right + CHIP.edge;
  const minY = upperDimY - CHIP.top - CHIP.edge;
  const maxY = cuffCircY + CHIP.bottom + CHIP.edge;
  const viewWidth = maxX - minX;
  const viewHeight = maxY - minY;
  const t = PATTERN_SUMMARY_MEASUREMENT_TARGETS;
  const cuffMidY = (frame.cuffJoinY + frame.bottom) / 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmtNum(minX)} ${fmtNum(minY)} ${fmtNum(viewWidth)} ${fmtNum(viewHeight)}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Set-in sleeve sleeve measurement diagram" focusable="false" class="express-mbp-art" data-set-in-sleeve-edit-diagram="true" data-set-in-sleeve-edit-piece="sleeve" data-sleeve-geometry="flat" data-sleeve-px-per-inch="${fmtNum(PX_PER_INCH)}" data-finished-upper-arm-inches="${fmtNum(upperArmInches)}" data-wrist-inches="${fmtNum(wristInches)}" data-sleeve-length-inches="${fmtNum(sleeveLengthInches)}" data-cuff-depth-inches="${fmtNum(cuffDepthInches)}" data-cap-height-inches="${fmtNum(capInches)}" data-upper-width="${fmtNum(upperW)}" data-wrist-width="${fmtNum(wristW)}" data-sleeve-length-px="${fmtNum(bottom - top)}" data-cuff-depth-px="${fmtNum(cuffH)}" data-cap-height-px="${fmtNum(frame.top - capTopY)}" data-sleeve-cap="${hasCap ? "true" : "false"}" data-underarm-y="${fmtNum(frame.top)}" data-cap-top-y="${fmtNum(capTopY)}" data-display-unit="in">`,
    `<path data-role="sleeve-outline" data-sleeve-cap="${hasCap ? "true" : "false"}" d="${sleeveOutline(frame, edge)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    hasCap
      ? `<line data-role="underarm" x1="${fmtNum(frame.upperLeft)}" y1="${fmtNum(frame.top)}" x2="${fmtNum(frame.upperRight)}" y2="${fmtNum(frame.top)}" fill="none" stroke="${DS_STROKE}" stroke-width="1.2"/>`
      : "",
    drawSleeveCuffJoin(frame),
    leader(frame.upperLeft, frame.top, frame.upperLeft, upperDimY),
    leader(frame.upperRight, frame.top, frame.upperRight, upperDimY),
    leader(lengthX, frame.top, frame.upperLeft, frame.top),
    leader(lengthX, frame.bottom, Math.min(frame.wristLeft, frame.upperLeft), frame.bottom),
    leader(frame.wristRight, frame.cuffJoinY, cuffDepthX, frame.cuffJoinY),
    leader(frame.wristRight, frame.bottom, cuffDepthX, frame.bottom),
    hDim(frame.upperLeft, frame.upperRight, upperDimY, "dim-upper-arm"),
    hDim(frame.wristLeft, frame.wristRight, cuffCircY, "dim-cuff-circ"),
    vDim(cuffDepthX, frame.cuffJoinY, frame.bottom, "dim-cuff-depth"),
    vDim(lengthX, frame.top, frame.bottom, "dim-sleeve-length"),
    `<g data-role="measurement-targets">`,
    targetCircle(t.upperArm, frame.midX, upperDimY),
    targetCircle(t.armLength, lengthX, (frame.top + frame.bottom) / 2),
    targetCircle(t.cuffCircumference, frame.midX, cuffCircY),
    targetCircle(t.cuffDepth, cuffDepthX, cuffMidY),
    `</g>`,
    `</svg>`,
  ].join("");
}
