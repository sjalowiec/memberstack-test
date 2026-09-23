/**
 * Sideways V-Neck finished-pattern Stitches & Rows schematic.
 *
 * Reuses the Summary/Edit silhouette ({@link buildSidewaysCardiganEditMeasurementFrame}).
 * Labels are stitch/row counts from the workspace calc — not a second math path.
 */

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

function countLabel(
  x: number,
  y: number,
  title: string,
  value: string,
  role: string,
  anchor: "start" | "middle" | "end" = "start",
): string {
  return `<text data-role="${role}" x="${fmtNum(x)}" y="${fmtNum(y)}" text-anchor="${anchor}" font-family="${DS_FONT}" font-size="11" fill="${DS_MUTED}"><tspan x="${fmtNum(x)}" dy="0">${escapeXml(title)}</tspan><tspan x="${fmtNum(x)}" dy="13">${escapeXml(value)}</tspan></text>`;
}

function singleLabel(
  x: number,
  y: number,
  text: string,
  role: string,
  anchor: "start" | "middle" | "end" = "middle",
): string {
  return `<text data-role="${role}" x="${fmtNum(x)}" y="${fmtNum(y)}" text-anchor="${anchor}" font-family="${DS_FONT}" font-size="12" fill="${DS_STROKE}">${escapeXml(text)}</text>`;
}

function drawCardiganStsRows(
  frame: SidewaysCardiganEditMeasurementFrame,
  model: SidewaysCardiganPatternDiagramModel,
): string {
  const { calc } = model;
  const layout = cardiganDimLayout(frame);
  const { bustX, sectionDimX, neckDimX, lengthY, sectionLabelX, neckLabelX } = layout;
  const firstFrontMidY = (frame.topY + frame.firstArmholeY) / 2;
  const backMidY = (frame.firstArmholeY + frame.secondArmholeY) / 2;
  const secondFrontMidY = (frame.secondArmholeY + frame.bottomY) / 2;
  const halfNeckMidY = (frame.secondVStartY + frame.bottomY) / 2;
  const shoulderMidY = (frame.secondArmholeY + frame.secondVStartY) / 2;
  const armholeDimY = frame.firstArmholeY - 16;
  const vDepthY = frame.bottomY + 32;
  const midX = (frame.hemX + frame.neckX) / 2;
  return [
    vDim(bustX, frame.topY, frame.bottomY, "dim-finished-bust"),
    hDim(frame.hemX, frame.neckX, lengthY, "dim-finished-back-length"),
    vDim(neckDimX, frame.backNeckStartY, frame.backNeckEndY, "dim-neck-opening"),
    hDim(frame.vCutX, frame.neckX, vDepthY, "dim-vneck-depth"),
    hDim(frame.armholeX, frame.neckX, armholeDimY, "dim-armhole-depth"),
    vDim(neckDimX, frame.secondArmholeY, frame.secondVStartY, "dim-shoulder-section"),
    vDim(neckDimX, frame.secondVStartY, frame.bottomY, "dim-half-neck-opening"),
    vDim(sectionDimX, layout.firstFront.top, layout.firstFront.bot, "dim-front-section", ` data-side="first"`),
    vDim(sectionDimX, layout.back.top, layout.back.bot, "dim-back-section"),
    vDim(sectionDimX, layout.secondFront.top, layout.secondFront.bot, "dim-front-section", ` data-side="second"`),
    countLabel(sectionLabelX, firstFrontMidY - 4, "Front", rowsLabel(calc.frontRows), "front-rows"),
    countLabel(sectionLabelX, backMidY - 4, "Back", rowsLabel(calc.backRows), "back-rows"),
    countLabel(sectionLabelX, secondFrontMidY - 4, "Front", rowsLabel(calc.frontRows), "front-rows"),
    countLabel(neckLabelX, shoulderMidY - 4, "Shoulder", rowsLabel(calc.shoulders.firstFrontRows), "shoulder-rows"),
    countLabel(neckLabelX, halfNeckMidY - 4, "½ neck", rowsLabel(calc.halfNeckRows), "half-neck-rows"),
    singleLabel(midX, lengthY + 16, stsLabel(calc.garmentLengthStitches), "length-sts"),
    singleLabel((frame.vCutX + frame.neckX) / 2, vDepthY + 16, stsLabel(calc.vNeckDepthStitches), "vneck-sts"),
    singleLabel((frame.armholeX + frame.neckX) / 2, armholeDimY - 8, stsLabel(calc.armholeDepthStitches), "armhole-sts"),
    singleLabel(
      (frame.backNeckX + frame.neckX) / 2,
      frame.backNeckStartY - 8,
      stsLabel(calc.backNeckDepthStitches),
      "back-neck-sts",
    ),
    singleLabel(
      neckDimX + 8,
      (frame.backNeckStartY + frame.backNeckEndY) / 2,
      rowsLabel(calc.backNeckOpeningRows),
      "neck-opening-rows",
      "start",
    ),
    singleLabel(bustX - 8, (frame.topY + frame.bottomY) / 2, rowsLabel(calc.bust.actualTotalBustRows), "bust-rows", "end"),
    singleLabel(midX, frame.topY - 12, `CO ${stsLabel(model.castOnStitches)}`, "cast-on-sts"),
  ].join("");
}

function drawPulloverStsRows(
  frame: SidewaysCardiganEditMeasurementFrame,
  model: SidewaysCardiganPatternDiagramModel,
): string {
  const { calc, sleeveCalc } = model;
  const bustX = frame.hemX - 36;
  const sectionDimX = frame.hemX + 18;
  const lengthY = frame.bottomY + 28;
  const vDepthY = (frame.firstVEndY + frame.secondVStartY) / 2;
  const firstFrontMidY = (frame.topY + frame.firstVEndY) / 2;
  const secondFrontMidY = (frame.firstVEndY + frame.secondArmholeY) / 2;
  const backMidY = (frame.secondArmholeY + frame.bottomY) / 2;
  const shoulderMidY = (frame.topY + frame.firstArmholeY) / 2;
  const halfNeckMidY = (frame.firstArmholeY + frame.firstVEndY) / 2;
  const armholeY = frame.secondArmholeY;
  const midX = (frame.hemX + frame.neckX) / 2;
  const sleeve = sleeveCalc
    ? [
        singleLabel(
          frame.sleeve.farX + 10,
          frame.sleeve.attachY,
          stsLabel(sleeveCalc.wristSts),
          "sleeve-wrist-sts",
          "start",
        ),
        singleLabel(
          (frame.sleeve.attachX + frame.sleeve.farX) / 2,
          frame.sleeve.attachY - frame.sleeve.upperHalf - 10,
          stsLabel(sleeveCalc.topSts),
          "sleeve-top-sts",
        ),
        singleLabel(
          (frame.sleeve.attachX + frame.sleeve.farX) / 2,
          frame.sleeve.attachY + frame.sleeve.upperHalf + 16,
          rowsLabel(sleeveCalc.sleeveBodyRows),
          "sleeve-body-rows",
        ),
        ...(sleeveCalc.cuffRows > 0
          ? [
              singleLabel(
                frame.sleeve.farX + 10,
                frame.sleeve.attachY + 16,
                rowsLabel(sleeveCalc.cuffRows),
                "sleeve-cuff-rows",
                "start",
              ),
            ]
          : []),
      ]
    : [];
  return [
    vDim(bustX, frame.topY, frame.bottomY, "dim-finished-bust"),
    hDim(frame.hemX, frame.neckX, lengthY, "dim-finished-back-length"),
    vDim(frame.neckX + 18, frame.firstArmholeY, frame.secondVStartY, "dim-neck-opening"),
    hDim(frame.vCutX, frame.neckX, vDepthY, "dim-vneck-depth"),
    hDim(frame.armholeX, frame.neckX, armholeY - 16, "dim-armhole-depth"),
    vDim(sectionDimX, frame.topY, frame.firstArmholeY, "dim-shoulder-section"),
    vDim(frame.neckX + 18, frame.firstArmholeY, frame.firstVEndY, "dim-half-neck-opening"),
    vDim(sectionDimX, frame.topY, frame.firstVEndY, "dim-front-section", ` data-side="first"`),
    vDim(sectionDimX, frame.firstVEndY, frame.secondArmholeY, "dim-front-section", ` data-side="second"`),
    vDim(sectionDimX, frame.secondArmholeY, frame.bottomY, "dim-back-section"),
    countLabel(sectionDimX + 10, firstFrontMidY - 4, "Front", rowsLabel(calc.frontRows), "front-rows"),
    countLabel(sectionDimX + 10, secondFrontMidY - 4, "Front", rowsLabel(calc.frontRows), "front-rows"),
    countLabel(midX, backMidY - 4, "Back", rowsLabel(calc.backRows), "back-rows", "middle"),
    countLabel(frame.hemX + 32, shoulderMidY - 4, "Shoulder", rowsLabel(calc.shoulders.firstFrontRows), "shoulder-rows"),
    countLabel(frame.neckX + 48, halfNeckMidY - 4, "½ neck", rowsLabel(calc.halfNeckRows), "half-neck-rows"),
    singleLabel(midX, lengthY + 16, stsLabel(calc.garmentLengthStitches), "length-sts"),
    singleLabel((frame.vCutX + frame.neckX) / 2, vDepthY + 14, stsLabel(calc.vNeckDepthStitches), "vneck-sts"),
    singleLabel((frame.armholeX + frame.neckX) / 2, armholeY - 22, stsLabel(calc.armholeDepthStitches), "armhole-sts"),
    singleLabel(
      (frame.backNeckX + frame.neckX) / 2,
      frame.backNeckStartY - 8,
      stsLabel(calc.backNeckDepthStitches),
      "back-neck-sts",
    ),
    singleLabel(
      frame.neckX + 28,
      (frame.firstArmholeY + frame.secondVStartY) / 2,
      rowsLabel(calc.backNeckOpeningRows),
      "neck-opening-rows",
      "start",
    ),
    singleLabel(bustX - 8, (frame.topY + frame.bottomY) / 2, rowsLabel(calc.bust.actualTotalBustRows), "bust-rows", "end"),
    singleLabel(midX, frame.topY - 22, `CO ${stsLabel(model.castOnStitches)}`, "cast-on-sts"),
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
  return [
    `<path data-role="body-outline" data-garment-style="${garmentStyle}" d="${bodyD}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    sleeve,
    drawArmholeAndBack(frame),
    garmentStyle === "pullover" ? drawPulloverMarkers(frame) : drawCardiganMarkers(frame),
  ].join("");
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
    ` data-cast-on-sts="${model.castOnStitches}"` +
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
  const { x: vbX, width, height } = viewBoxFor(frame);
  const aria =
    model.garmentStyle === "pullover"
      ? "Sideways pullover stitches and rows diagram starting at the underarm"
      : "Sideways cardigan stitches and rows diagram starting at center front";
  const labels =
    model.garmentStyle === "pullover"
      ? drawPulloverStsRows(frame, model)
      : drawCardiganStsRows(frame, model);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmtNum(vbX)} 0 ${fmtNum(width)} ${fmtNum(height)}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${aria}" focusable="false" class="express-mbp-art sleeveless-piece-split__diagram-inline"${svgDataAttrs(model, "sts-rows")}>`,
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
