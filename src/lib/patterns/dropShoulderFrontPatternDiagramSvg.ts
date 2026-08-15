/**
 * Generated Drop Shoulder Front — Stitches & Rows schematic.
 *
 * Geometry is scaled from the adapter model (existing stitch/row counts).
 * Front neck depth is drawn inside the armhole span. Neckline/garment layout
 * comes from existing generator style flags, not new pattern math.
 */

import type { DropShoulderFrontStitchesRowsModel } from "./dropShoulderPatternDiagramModel";
import {
  DS_FILL,
  DS_FS_MEASURE,
  DS_FS_SMALL,
  DS_FS_TITLE,
  DS_FW_TITLE,
  DS_MUTED,
  DS_STROKE,
  buildCardiganLeftFrame,
  buildFullWidthFrame,
  drawArmholeDepth,
  drawArmholeMarker,
  drawBodyLength,
  drawBodyWidth,
  drawHemDepth,
  drawHemWidth,
  drawNecklineDepthDim,
  drawNecklineWidthDim,
  escapeXml,
  fmtNum,
  textFont,
  wrapGeneratedDiagramSvg,
  type DropShoulderDiagramFrame,
} from "./dropShoulderPatternDiagramSvgShared";

function pulloverRoundPath(frame: DropShoulderDiagramFrame): string {
  const neckCtrlY = frame.top + (frame.neckBottomY - frame.top) * 1.15;
  return [
    `M ${fmtNum(frame.hemLeft)} ${fmtNum(frame.bottom)}`,
    `L ${fmtNum(frame.left)} ${fmtNum(frame.top)}`,
    `L ${fmtNum(frame.neckLeftX)} ${fmtNum(frame.top)}`,
    `Q ${fmtNum(frame.midX)} ${fmtNum(neckCtrlY)} ${fmtNum(frame.neckRightX)} ${fmtNum(frame.top)}`,
    `L ${fmtNum(frame.right)} ${fmtNum(frame.top)}`,
    `L ${fmtNum(frame.hemRight)} ${fmtNum(frame.bottom)}`,
    "Z",
  ].join(" ");
}

function pulloverVPath(frame: DropShoulderDiagramFrame): string {
  return [
    `M ${fmtNum(frame.hemLeft)} ${fmtNum(frame.bottom)}`,
    `L ${fmtNum(frame.left)} ${fmtNum(frame.top)}`,
    `L ${fmtNum(frame.neckLeftX)} ${fmtNum(frame.top)}`,
    `L ${fmtNum(frame.midX)} ${fmtNum(frame.neckBottomY)}`,
    `L ${fmtNum(frame.neckRightX)} ${fmtNum(frame.top)}`,
    `L ${fmtNum(frame.right)} ${fmtNum(frame.top)}`,
    `L ${fmtNum(frame.hemRight)} ${fmtNum(frame.bottom)}`,
    "Z",
  ].join(" ");
}

function cardiganRoundPath(frame: DropShoulderDiagramFrame): string {
  const neckCtrlX = frame.neckLeftX + (frame.neckRightX - frame.neckLeftX) * 0.55;
  const neckCtrlY = frame.top + (frame.neckBottomY - frame.top) * 1.05;
  return [
    `M ${fmtNum(frame.hemLeft)} ${fmtNum(frame.bottom)}`,
    `L ${fmtNum(frame.left)} ${fmtNum(frame.top)}`,
    `L ${fmtNum(frame.neckLeftX)} ${fmtNum(frame.top)}`,
    `Q ${fmtNum(neckCtrlX)} ${fmtNum(neckCtrlY)} ${fmtNum(frame.right)} ${fmtNum(frame.neckBottomY)}`,
    `L ${fmtNum(frame.hemRight)} ${fmtNum(frame.bottom)}`,
    "Z",
  ].join(" ");
}

function cardiganVPath(frame: DropShoulderDiagramFrame): string {
  return [
    `M ${fmtNum(frame.hemLeft)} ${fmtNum(frame.bottom)}`,
    `L ${fmtNum(frame.left)} ${fmtNum(frame.top)}`,
    `L ${fmtNum(frame.neckLeftX)} ${fmtNum(frame.top)}`,
    `L ${fmtNum(frame.right)} ${fmtNum(frame.neckBottomY)}`,
    `L ${fmtNum(frame.hemRight)} ${fmtNum(frame.bottom)}`,
    "Z",
  ].join(" ");
}

function frontBodyPath(
  frame: DropShoulderDiagramFrame,
  model: DropShoulderFrontStitchesRowsModel,
): string {
  if (model.garment === "cardigan") {
    return model.neckline === "v" ? cardiganVPath(frame) : cardiganRoundPath(frame);
  }
  return model.neckline === "v" ? pulloverVPath(frame) : pulloverRoundPath(frame);
}

function drawShoulderStitches(
  frame: DropShoulderDiagramFrame,
  model: DropShoulderFrontStitchesRowsModel,
): string {
  if (!model.shoulderStitchesLabel) return "";
  const y = frame.top + 16;
  const label = escapeXml(model.shoulderStitchesLabel);
  if (model.garment === "cardigan") {
    const x = (frame.left + frame.neckLeftX) / 2;
    return [
      `<g class="ds-front-diagram__shoulder-sts">`,
      `<text x="${fmtNum(x)}" y="${fmtNum(y)}" text-anchor="middle" fill="${DS_STROKE}" ${textFont(DS_FS_MEASURE)}>${label}</text>`,
      `</g>`,
    ].join("");
  }
  const leftX = (frame.left + frame.neckLeftX) / 2;
  const rightX = (frame.right + frame.neckRightX) / 2;
  return [
    `<g class="ds-front-diagram__shoulder-sts">`,
    `<text x="${fmtNum(leftX)}" y="${fmtNum(y)}" text-anchor="middle" fill="${DS_STROKE}" ${textFont(DS_FS_MEASURE)}>${label}</text>`,
    `<text x="${fmtNum(rightX)}" y="${fmtNum(y)}" text-anchor="middle" fill="${DS_STROKE}" ${textFont(DS_FS_MEASURE)}>${label}</text>`,
    `</g>`,
  ].join("");
}

function drawPieceLabel(frame: DropShoulderDiagramFrame, model: DropShoulderFrontStitchesRowsModel): string {
  const y = frame.armholeMarkerY + (frame.hemTopY - frame.armholeMarkerY) * 0.62;
  const label = model.garment === "cardigan" ? "LEFT FRONT" : "FRONT";
  const parts = [
    `<text x="${fmtNum(frame.midX)}" y="${fmtNum(y)}" text-anchor="middle" dominant-baseline="middle" fill="${DS_STROKE}" ${textFont(DS_FS_TITLE, DS_FW_TITLE)}>${label}</text>`,
  ];
  if (model.garment === "cardigan") {
    parts.push(
      `<text x="${fmtNum(frame.right + 10)}" y="${fmtNum((frame.neckBottomY + frame.hemTopY) / 2)}" text-anchor="start" fill="${DS_MUTED}" ${textFont(DS_FS_SMALL)}>CF</text>`,
    );
  }
  return parts.join("");
}

function drawFrontNecklineDims(
  frame: DropShoulderDiagramFrame,
  model: DropShoulderFrontStitchesRowsModel,
): string {
  const depthX =
    model.garment === "cardigan"
      ? (frame.neckLeftX + frame.neckRightX) / 2
      : frame.neckLeftX + 10;
  return [
    `<g class="ds-front-diagram__neckline-dims">`,
    drawNecklineWidthDim(frame, model.necklineWidthLabel),
    drawNecklineDepthDim(frame, model.necklineDepthLabel, depthX),
    `</g>`,
  ].join("");
}

/**
 * Build the Front Stitches & Rows SVG from an adapter model.
 */
export function buildDropShoulderFrontStitchesRowsSvg(
  model: DropShoulderFrontStitchesRowsModel,
): string {
  const maxNeckRatio = model.neckline === "v" ? 0.92 : 0.85;
  const frame =
    model.garment === "cardigan"
      ? buildCardiganLeftFrame(model, model.shoulderStitchesEach, maxNeckRatio)
      : buildFullWidthFrame(model, maxNeckRatio);
  const armholeSide = model.garment === "cardigan" ? "left" : "right";
  const markerSides = model.garment === "cardigan" ? "left" : "both";
  const body = [
    `<path class="ds-front-diagram__body" d="${frontBodyPath(frame, model)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.75"/>`,
    drawArmholeMarker(frame, markerSides),
    drawPieceLabel(frame, model),
    drawShoulderStitches(frame, model),
    drawArmholeDepth(frame, model.armholeDepthLabel, armholeSide),
    drawBodyLength(frame, model.bodyLengthLabel, model.garment === "cardigan" ? "right" : "left"),
    drawHemDepth(frame, model.hemDepthLabel),
    drawBodyWidth(frame, model.bodyWidthLabel),
    drawFrontNecklineDims(frame, model),
    drawHemWidth(frame, model.hemStitchesLabel, model.hemStitches, model.bodyWidthStitches),
  ].join("");

  return wrapGeneratedDiagramSvg({
    ariaLabel: "Generated drop shoulder front schematic",
    className: "sleeveless-piece-split__diagram-inline ds-front-diagram ds-front-diagram--generated",
    dataAttrs: {
      "data-ds-front-diagram": "sts-rows",
      "data-neckline": model.neckline,
      "data-garment": model.garment,
      "data-body-shape": model.bodyShape,
      "data-armhole-rows": model.armholeRows,
      "data-neckline-rows-inside-armhole": model.necklineRowsInsideArmhole,
      "data-armhole-even-rows": model.armholeEvenRows,
      "data-front-neck-depth-rows": model.frontNeckDepthRows,
      "data-hem-stitches": model.hemStitches,
      "data-body-width-stitches": model.bodyWidthStitches,
      "data-neckline-stitches": model.necklineStitches,
      "data-shoulder-stitches": model.shoulderStitchesEach,
    },
    title: "Drop Shoulder Front - Stitches & Rows (generated preview)",
    body,
  });
}
