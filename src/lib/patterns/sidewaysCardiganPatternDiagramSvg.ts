/**
 * Sideways V-Neck finished-pattern Stitches & Rows schematic.
 *
 * Reuses the Summary/Edit silhouette ({@link buildSidewaysCardiganEditMeasurementFrame}).
 * The finished-pattern view mirrors that silhouette vertically so the knitter reads
 * the piece from the bottom (cast-on) to the top (bind-off). Label type uses the
 * shared Drop Shoulder / Sleeveless sizes, scaled to this viewBox so on-screen
 * text matches those diagrams. The silhouette itself is not scaled.
 * Labels are stitch/row counts from the workspace calc — not a second math path.
 */

import {
  DS_ARROW,
  DS_FILL,
  DS_FS_MEASURE,
  DS_FS_TITLE,
  DS_FW_TITLE,
  DS_MUTED,
  DS_STROKE,
  DS_VB_W,
  endCap,
  escapeXml,
  fmtNum,
  textFont,
} from "./dropShoulderPatternDiagramSvgShared";
import { DS_FS_NOTATION, DS_NOTATION_GAP } from "./dropShoulderShapingNotationDiagramShared";
import type { SidewaysCardiganBodyCalc, SidewaysCardiganBodyCalcInput } from "./sidewaysCardiganBodyCalc";
import {
  parseSidewaysCardiganGarmentStyle,
  parseSidewaysCardiganSleeveDirection,
  type SidewaysCardiganGarmentStyle,
  type SidewaysCardiganSleeveDirection,
} from "./sidewaysCardiganConstructionIdentity";
import {
  buildSidewaysCardiganEditMeasurementFrame,
  cardiganBodyPath,
  cardiganDimLayout,
  drawArmholeAndBack,
  drawCardiganMarkers,
  drawPulloverMarkers,
  pulloverBodyPath,
  sleevePath,
  viewBoxFor,
  type SidewaysCardiganEditMeasurementDiagramInput,
  type SidewaysCardiganEditMeasurementFrame,
} from "./sidewaysCardiganEditMeasurementDiagramSvg";
import type { SidewaysCardiganSleeveCalc } from "./sidewaysCardiganSleeveCalc";

export type SidewaysCardiganPatternDiagramModel = {
  garmentStyle: SidewaysCardiganGarmentStyle;
  sleeveDirection: SidewaysCardiganSleeveDirection;
  calc: SidewaysCardiganBodyCalc;
  measurements: SidewaysCardiganEditMeasurementDiagramInput["measurements"];
  sleeveCalc: SidewaysCardiganSleeveCalc | null;
  castOnStitches: number;
  /**
   * V-neck slope actions from the body instruction model.
   * When both arrays are present, shaping notation formats these sequences
   * and does not rebuild the slope.
   */
  vNeckIncreaseSequence?: readonly number[];
  vNeckDecreaseSequence?: readonly number[];
};

export function sidewaysCardiganCastOnStitches(
  calc: Pick<SidewaysCardiganBodyCalc, "garmentLengthStitches" | "vNeckDepthStitches">,
  garmentStyle: SidewaysCardiganGarmentStyle,
): number {
  if (garmentStyle === "cardigan") {
    return Math.max(0, calc.garmentLengthStitches - calc.vNeckDepthStitches);
  }
  return calc.garmentLengthStitches;
}

export function buildSidewaysCardiganPatternDiagramModel(args: {
  garmentStyle: SidewaysCardiganGarmentStyle | string;
  sleeveDirection?: SidewaysCardiganSleeveDirection | string;
  calc: SidewaysCardiganBodyCalc;
  input: SidewaysCardiganBodyCalcInput;
  sleeveCalc?: SidewaysCardiganSleeveCalc | null;
  sleeveLengthInches?: number;
  wristInches?: number;
  vNeckIncreaseSequence?: readonly number[];
  vNeckDecreaseSequence?: readonly number[];
}): SidewaysCardiganPatternDiagramModel {
  const garmentStyle = parseSidewaysCardiganGarmentStyle(args.garmentStyle) ?? "cardigan";
  const sleeveDirection = parseSidewaysCardiganSleeveDirection(args.sleeveDirection) ?? "cuff-up";
  const sleeveCalc = args.sleeveCalc ?? null;
  return {
    garmentStyle,
    sleeveDirection,
    calc: args.calc,
    sleeveCalc,
    castOnStitches: sidewaysCardiganCastOnStitches(args.calc, garmentStyle),
    measurements: {
      finishedBustInches: args.calc.bust.actualFinishedBustInches,
      finishedLengthInches: args.input.garmentLengthInches,
      neckOpeningWidthInches: args.input.neckOpeningWidthInches,
      vNeckDepthInches: args.input.vNeckDepthInches,
      finishedUpperArmInches: args.input.finishedUpperArmInches,
      sleeveLengthInches:
        sleeveCalc?.finished.sleeveLengthInches ?? args.sleeveLengthInches ?? 16,
      wristInches: sleeveCalc?.finished.wristInches ?? args.wristInches ?? 7,
    ...(args.calc.backNeckDepthInches > 0
      ? { backNeckDepthInches: args.calc.backNeckDepthInches }
      : {}),
    },
    ...(args.vNeckIncreaseSequence !== undefined
      ? { vNeckIncreaseSequence: args.vNeckIncreaseSequence }
      : {}),
    ...(args.vNeckDecreaseSequence !== undefined
      ? { vNeckDecreaseSequence: args.vNeckDecreaseSequence }
      : {}),
  };
}

/**
 * Closed cast-on (cardigan) or side-seam cast-on (pullover), and the final bind-off.
 * Both are the full garment-length stitch count in the body instructions.
 */
export function sidewaysDiagramEdgeStitchCount(
  calc: Pick<SidewaysCardiganBodyCalc, "garmentLengthStitches">,
): number {
  return Math.max(0, Math.round(calc.garmentLengthStitches));
}

export type SidewaysPatternDiagramType = {
  /** Width the sizes were resolved against. Vertical padding is not included. */
  viewBoxWidth: number;
  stitch: number;
  row: number;
  piece: number;
  pieceWeight: number;
  notation: number;
  notationGap: number;
};

/**
 * Shared finished-pattern type (stitch/notation 17, row/measure 14, piece title 13,
 * notation gap 18 on the 430-wide Drop Shoulder viewBox), scaled so a Sideways SVG
 * at `width: 100%` matches that on-screen size. Does not scale the silhouette.
 */
export function sidewaysPatternDiagramTypography(viewBoxWidth: number): SidewaysPatternDiagramType {
  const width = viewBoxWidth > 0 ? viewBoxWidth : DS_VB_W;
  const scale = width / DS_VB_W;
  const px = (canonical: number) => Math.max(1, Math.round(canonical * scale));
  return {
    viewBoxWidth: width,
    stitch: px(DS_FS_NOTATION),
    row: px(DS_FS_MEASURE),
    piece: px(DS_FS_TITLE),
    pieceWeight: DS_FW_TITLE,
    notation: px(DS_FS_NOTATION),
    notationGap: px(DS_NOTATION_GAP),
  };
}

/** Knitting-sequence Y (small = cast-on) drawn with cast-on at the bottom. */
export function sidewaysKnitVisualY(
  frame: Pick<SidewaysCardiganEditMeasurementFrame, "topY" | "bottomY">,
  y: number,
): number {
  return frame.topY + frame.bottomY - y;
}

export type SidewaysPatternDiagramCanvas = {
  x: number;
  y: number;
  width: number;
  height: number;
  type: SidewaysPatternDiagramType;
};

/** Same canvas for both finished-pattern SVGs so the silhouette scale matches. */
export function sidewaysPatternDiagramCanvas(
  frame: SidewaysCardiganEditMeasurementFrame,
): SidewaysPatternDiagramCanvas {
  const base = viewBoxFor(frame);
  // Neck-edge notation grows to the right of the silhouette. Include that gutter
  // in the width before resolving type, so on-screen size still matches the
  // shared 430-wide diagrams.
  const rightPad = Math.round(base.width * 0.1);
  const type = sidewaysPatternDiagramTypography(base.width + rightPad);
  const topPad = Math.ceil(type.notation * 3.2);
  const bottomPad = Math.ceil(type.stitch * 5.6);
  return {
    x: base.x,
    y: -topPad,
    width: base.width + rightPad,
    height: base.height + topPad + bottomPad,
    type,
  };
}

function stsLabel(n: number): string {
  const count = Math.max(0, Math.round(n));
  return `${count} sts`;
}

function rowsLabel(n: number): string {
  const count = Math.max(0, Math.round(n));
  return `${count} rows`;
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

function pieceLineGap(type: SidewaysPatternDiagramType): number {
  return Math.round(type.piece * 0.35 + type.row * 1.15);
}

function countLabel(
  x: number,
  y: number,
  title: string,
  value: string,
  role: string,
  type: SidewaysPatternDiagramType,
  anchor: "start" | "middle" | "end" = "start",
): string {
  const gap = pieceLineGap(type);
  const titleY = y - gap / 2;
  return `<text data-role="${role}" x="${fmtNum(x)}" y="${fmtNum(titleY)}" text-anchor="${anchor}" fill="${DS_STROKE}" ${textFont(type.piece, type.pieceWeight)}><tspan x="${fmtNum(x)}" dy="0">${escapeXml(title)}</tspan><tspan x="${fmtNum(x)}" dy="${gap}" font-size="${type.row}" font-weight="400" fill="${DS_MUTED}">${escapeXml(value)}</tspan></text>`;
}

function measureLabel(
  x: number,
  y: number,
  text: string,
  role: string,
  size: number,
  anchor: "start" | "middle" | "end" = "middle",
  extra = "",
): string {
  if (!text) return "";
  return `<text data-role="${role}"${extra} x="${fmtNum(x)}" y="${fmtNum(y)}" text-anchor="${anchor}" fill="${DS_MUTED}" ${textFont(size)}>${escapeXml(text)}</text>`;
}

function drawCardiganStsRows(
  frame: SidewaysCardiganEditMeasurementFrame,
  model: SidewaysCardiganPatternDiagramModel,
  type: SidewaysPatternDiagramType,
): string {
  const y = (value: number) => sidewaysKnitVisualY(frame, value);
  const { calc } = model;
  const layout = cardiganDimLayout(frame);
  const { bustX, sectionDimX, neckDimX, sectionLabelX, neckLabelX } = layout;
  const edge = sidewaysDiagramEdgeStitchCount(calc);
  const edgeX = (frame.hemX + frame.vCutX) / 2;
  const midX = (frame.hemX + frame.neckX) / 2;
  const startEdge = y(frame.topY);
  const endEdge = y(frame.bottomY);
  const castOnY = startEdge + type.notationGap;
  const lengthLineY = castOnY + type.stitch * 1.45;
  const lengthLabelY = lengthLineY + type.stitch * 1.05;
  const bindOffY = endEdge - type.notationGap;
  const vDepthY = y(frame.bottomY + type.notationGap);
  const armholeDimY = y(frame.firstArmholeY - type.row);
  const labelClear = Math.round(type.stitch * 0.85);
  return [
    vDim(bustX, frame.topY, frame.bottomY, "dim-finished-bust"),
    hDim(frame.hemX, frame.neckX, lengthLineY, "dim-finished-back-length"),
    vDim(neckDimX, y(frame.backNeckStartY), y(frame.backNeckEndY), "dim-neck-opening"),
    hDim(frame.vCutX, frame.neckX, vDepthY, "dim-vneck-depth"),
    hDim(frame.armholeX, frame.neckX, armholeDimY, "dim-armhole-depth"),
    vDim(neckDimX, y(frame.secondArmholeY), y(frame.secondVStartY), "dim-shoulder-section"),
    vDim(neckDimX, y(frame.secondVStartY), y(frame.bottomY), "dim-half-neck-opening"),
    vDim(sectionDimX, y(layout.firstFront.top), y(layout.firstFront.bot), "dim-front-section", ` data-side="first"`),
    vDim(sectionDimX, y(layout.back.top), y(layout.back.bot), "dim-back-section"),
    vDim(sectionDimX, y(layout.secondFront.top), y(layout.secondFront.bot), "dim-front-section", ` data-side="second"`),
    countLabel(sectionLabelX, y((frame.topY + frame.firstArmholeY) / 2), "Front", rowsLabel(calc.frontRows), "front-rows", type, "start"),
    countLabel(sectionLabelX, y((frame.firstArmholeY + frame.secondArmholeY) / 2), "Back", rowsLabel(calc.backRows), "back-rows", type),
    countLabel(sectionLabelX, y((frame.secondArmholeY + frame.bottomY) / 2), "Front", rowsLabel(calc.frontRows), "front-rows", type, "start"),
    countLabel(neckLabelX, y((frame.secondArmholeY + frame.secondVStartY) / 2) + type.row * 0.65, "Shoulder", rowsLabel(calc.shoulders.firstFrontRows), "shoulder-rows", type),
    countLabel(neckLabelX, y((frame.secondVStartY + frame.bottomY) / 2), "½ neck", rowsLabel(calc.halfNeckRows), "half-neck-rows", type),
    measureLabel(midX, lengthLabelY, stsLabel(calc.garmentLengthStitches), "length-sts", type.stitch),
    measureLabel((frame.vCutX + frame.neckX) / 2, vDepthY - labelClear, stsLabel(calc.vNeckDepthStitches), "vneck-sts", type.stitch),
    measureLabel((frame.armholeX + frame.neckX) / 2, armholeDimY + labelClear, stsLabel(calc.armholeDepthStitches), "armhole-sts", type.stitch),
    measureLabel(
      (frame.backNeckX + frame.neckX) / 2,
      y(frame.backNeckStartY) + labelClear,
      stsLabel(calc.backNeckDepthStitches),
      "back-neck-sts",
      type.stitch,
    ),
    measureLabel(
      neckDimX + type.row,
      y((frame.backNeckStartY + frame.backNeckEndY) / 2),
      rowsLabel(calc.backNeckOpeningRows),
      "neck-opening-rows",
      type.row,
      "start",
    ),
    measureLabel(bustX - type.row, (frame.topY + frame.bottomY) / 2, rowsLabel(calc.bust.actualTotalBustRows), "bust-rows", type.row, "end"),
    measureLabel(edgeX, castOnY, `CO ${stsLabel(edge)}`, "cast-on-sts", type.stitch, "middle", ` data-knit-edge="start" data-sts="${edge}"`),
    measureLabel(edgeX, bindOffY, `BO ${stsLabel(edge)}`, "bind-off-sts", type.stitch, "middle", ` data-knit-edge="end" data-sts="${edge}"`),
  ].join("");
}

function drawPulloverStsRows(
  frame: SidewaysCardiganEditMeasurementFrame,
  model: SidewaysCardiganPatternDiagramModel,
  type: SidewaysPatternDiagramType,
): string {
  const y = (value: number) => sidewaysKnitVisualY(frame, value);
  const { calc, sleeveCalc } = model;
  const bustX = frame.hemX - 36;
  const sectionDimX = frame.hemX + 18;
  const edge = sidewaysDiagramEdgeStitchCount(calc);
  const midX = (frame.hemX + frame.neckX) / 2;
  const startEdge = y(frame.topY);
  const endEdge = y(frame.bottomY);
  const castOnY = startEdge + type.notationGap;
  const startNoteY = castOnY + type.row * 2.05;
  const lengthLineY = startNoteY + type.stitch * 1.15;
  const lengthLabelY = lengthLineY + type.stitch * 1.05;
  const bindOffY = endEdge - type.notationGap;
  const vDepthY = y((frame.firstVEndY + frame.secondVStartY) / 2);
  const armholeY = y(frame.secondArmholeY);
  const labelClear = Math.round(type.stitch * 0.85);
  const wristY = y(frame.sleeve.attachY);
  const sleeve = sleeveCalc
    ? [
        measureLabel(
          frame.sleeve.farX + type.row,
          wristY + type.stitch * 0.2,
          stsLabel(sleeveCalc.wristSts),
          "sleeve-wrist-sts",
          type.stitch,
          "start",
        ),
        measureLabel(
          (frame.sleeve.attachX + frame.sleeve.farX) / 2,
          y(frame.sleeve.attachY - frame.sleeve.upperHalf - type.row),
          stsLabel(sleeveCalc.topSts),
          "sleeve-top-sts",
          type.stitch,
        ),
        measureLabel(
          (frame.sleeve.attachX + frame.sleeve.farX) / 2,
          y(frame.sleeve.attachY + frame.sleeve.upperHalf + type.row),
          rowsLabel(sleeveCalc.sleeveBodyRows),
          "sleeve-body-rows",
          type.row,
        ),
        ...(sleeveCalc.cuffRows > 0
          ? [
              measureLabel(
                frame.sleeve.farX + type.row,
                wristY - type.stitch * 1.95,
                rowsLabel(sleeveCalc.cuffRows),
                "sleeve-cuff-rows",
                type.row,
                "start",
              ),
            ]
          : []),
      ]
    : [];
  return [
    vDim(bustX, frame.topY, frame.bottomY, "dim-finished-bust"),
    hDim(frame.hemX, frame.neckX, lengthLineY, "dim-finished-back-length"),
    vDim(frame.neckX + type.row, y(frame.firstArmholeY), y(frame.secondVStartY), "dim-neck-opening"),
    hDim(frame.vCutX, frame.neckX, vDepthY, "dim-vneck-depth"),
    hDim(frame.armholeX, frame.neckX, armholeY + labelClear, "dim-armhole-depth"),
    vDim(sectionDimX, y(frame.topY), y(frame.firstArmholeY), "dim-shoulder-section"),
    vDim(frame.neckX + type.row, y(frame.firstArmholeY), y(frame.firstVEndY), "dim-half-neck-opening"),
    vDim(sectionDimX, y(frame.topY), y(frame.firstVEndY), "dim-front-section", ` data-side="first"`),
    vDim(sectionDimX, y(frame.firstVEndY), y(frame.secondArmholeY), "dim-front-section", ` data-side="second"`),
    vDim(sectionDimX, y(frame.secondArmholeY), y(frame.bottomY), "dim-back-section"),
    countLabel(frame.hemX - type.row * 0.45, y((frame.topY + frame.firstVEndY) / 2), "Front", rowsLabel(calc.frontRows), "front-rows", type, "end"),
    countLabel(sectionDimX + type.row, y((frame.firstVEndY + frame.secondArmholeY) / 2), "Front", rowsLabel(calc.frontRows), "front-rows", type),
    countLabel(midX, y((frame.secondArmholeY + frame.bottomY) / 2), "Back", rowsLabel(calc.backRows), "back-rows", type, "middle"),
    countLabel(frame.neckX + type.row * 0.45, y((frame.topY + frame.firstArmholeY) / 2), "Shoulder", rowsLabel(calc.shoulders.firstFrontRows), "shoulder-rows", type),
    countLabel(frame.vCutX - type.row * 0.35, y((frame.firstArmholeY + frame.firstVEndY) / 2) + type.row * 0.5, "½ neck", rowsLabel(calc.halfNeckRows), "half-neck-rows", type, "end"),
    measureLabel(midX, lengthLabelY, stsLabel(calc.garmentLengthStitches), "length-sts", type.stitch),
    measureLabel((frame.vCutX + frame.neckX) / 2 + type.row * 0.55, vDepthY + labelClear, stsLabel(calc.vNeckDepthStitches), "vneck-sts", type.stitch),
    measureLabel(frame.armholeX - type.row * 0.2, armholeY - type.row * 0.85, stsLabel(calc.armholeDepthStitches), "armhole-sts", type.stitch, "end"),
    measureLabel(
      (frame.backNeckX + frame.neckX) / 2,
      y(frame.backNeckStartY) + labelClear,
      stsLabel(calc.backNeckDepthStitches),
      "back-neck-sts",
      type.stitch,
    ),
    measureLabel(
      frame.neckX + type.row * 0.85,
      y(frame.secondVStartY) - type.row * 1.35,
      rowsLabel(calc.backNeckOpeningRows),
      "neck-opening-rows",
      type.row,
      "end",
    ),
    measureLabel(Math.max(bustX, type.row * 5.4), (frame.topY + frame.bottomY) / 2, rowsLabel(calc.bust.actualTotalBustRows), "bust-rows", type.row, "end"),
    measureLabel(midX, castOnY, `CO ${stsLabel(edge)}`, "cast-on-sts", type.stitch, "middle", ` data-knit-edge="start" data-sts="${edge}"`),
    measureLabel(
      midX,
      startNoteY,
      "Start at underarm · scrap on / graft",
      "underarm-start-label",
      type.row,
    ),
    measureLabel(midX, bindOffY, `BO ${stsLabel(edge)}`, "bind-off-sts", type.stitch, "middle", ` data-knit-edge="end" data-sts="${edge}"`),
    ...sleeve,
  ].join("");
}

function silhouetteMarkup(frame: SidewaysCardiganEditMeasurementFrame): string {
  const garmentStyle = frame.garmentStyle;
  const bodyD = garmentStyle === "pullover" ? pulloverBodyPath(frame) : cardiganBodyPath(frame);
  const sleeve =
    garmentStyle === "pullover"
      ? `<path data-role="sleeve-outline" d="${sleevePath(frame)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`
      : "";
  const markers =
    garmentStyle === "pullover"
      ? drawPulloverMarkers(frame, { includeStartLabel: false })
      : drawCardiganMarkers(frame);
  const pivot = frame.topY + frame.bottomY;
  return `<g data-knit-flip="vertical" transform="translate(0 ${fmtNum(pivot)}) scale(1 -1)">${[
    `<path data-role="body-outline" data-garment-style="${garmentStyle}" d="${bodyD}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    sleeve,
    drawArmholeAndBack(frame),
    markers,
  ].join("")}</g>`;
}

function svgDataAttrs(model: SidewaysCardiganPatternDiagramModel, mode: "sts-rows" | "shaping-notation"): string {
  const { calc, sleeveCalc } = model;
  const start = model.garmentStyle === "pullover" ? "underarm" : "center-front";
  const structure = model.garmentStyle === "cardigan" ? "front-back-front" : "underarm-graft";
  const sleeveBits = sleeveCalc
    ? ` data-sleeve-calculated="true" data-wrist-sts="${sleeveCalc.wristSts}" data-top-sts="${sleeveCalc.topSts}" data-sleeve-body-rows="${sleeveCalc.sleeveBodyRows}" data-cuff-rows="${sleeveCalc.cuffRows}" data-sleeve-direction="${sleeveCalc.direction}"`
    : ` data-sleeve-calculated="false" data-sleeve-direction="${escapeXml(model.sleeveDirection)}"`;
  return (
    ` data-sideways-pattern-diagram="${mode}"` +
    ` data-sideways-edit-diagram="${model.garmentStyle}"` +
    ` data-garment-style="${model.garmentStyle}"` +
    ` data-sideways-start="${start}"` +
    ` data-cardigan-structure="${structure}"` +
    ` data-knit-direction="bottom-up"` +
    ` data-cast-on-sts="${sidewaysDiagramEdgeStitchCount(calc)}"` +
    ` data-bind-off-sts="${sidewaysDiagramEdgeStitchCount(calc)}"` +
    ` data-starting-front-sts="${model.castOnStitches}"` +
    ` data-length-sts="${calc.garmentLengthStitches}"` +
    ` data-vneck-sts="${calc.vNeckDepthStitches}"` +
    ` data-armhole-sts="${calc.armholeDepthStitches}"` +
    ` data-back-neck-sts="${calc.backNeckDepthStitches}"` +
    ` data-neck-opening-rows="${calc.backNeckOpeningRows}"` +
    ` data-front-rows="${calc.frontRows}"` +
    ` data-back-rows="${calc.backRows}"` +
    ` data-shoulder-rows="${calc.shoulders.firstFrontRows}"` +
    ` data-half-neck-rows="${calc.halfNeckRows}"` +
    ` data-bust-rows="${calc.bust.actualTotalBustRows}"` +
    sleeveBits
  );
}

export function buildSidewaysCardiganPatternDiagramFrame(
  model: SidewaysCardiganPatternDiagramModel,
): SidewaysCardiganEditMeasurementFrame {
  return buildSidewaysCardiganEditMeasurementFrame({
    measurements: model.measurements,
    garmentStyle: model.garmentStyle,
  });
}

export function buildSidewaysCardiganPatternDiagramSvg(
  model: SidewaysCardiganPatternDiagramModel,
): string {
  const frame = buildSidewaysCardiganPatternDiagramFrame(model);
  const canvas = sidewaysPatternDiagramCanvas(frame);
  const aria =
    model.garmentStyle === "pullover"
      ? "Sideways pullover stitches and rows diagram knitted upward from the underarm"
      : "Sideways cardigan stitches and rows diagram knitted upward from center front";
  const labels =
    model.garmentStyle === "pullover"
      ? drawPulloverStsRows(frame, model, canvas.type)
      : drawCardiganStsRows(frame, model, canvas.type);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmtNum(canvas.x)} ${fmtNum(canvas.y)} ${fmtNum(canvas.width)} ${fmtNum(canvas.height)}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${aria}" focusable="false" class="express-mbp-art sleeveless-piece-split__diagram-inline"${svgDataAttrs(model, "sts-rows")}>`,
    silhouetteMarkup(frame),
    labels,
    `</svg>`,
  ].join("");
}

export function buildSidewaysCardiganPatternSilhouetteMarkup(
  model: SidewaysCardiganPatternDiagramModel,
): string {
  return silhouetteMarkup(buildSidewaysCardiganPatternDiagramFrame(model));
}

export { svgDataAttrs as sidewaysCardiganPatternDiagramDataAttrs };
