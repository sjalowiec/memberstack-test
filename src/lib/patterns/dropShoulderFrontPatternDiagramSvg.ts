/**
 * Generated Drop Shoulder Front — Stitches & Rows schematic.
 *
 * Geometry is scaled from the adapter model (existing stitch/row counts).
 * Front neck depth is drawn from garment rows and may extend below the armhole marker.
 * Neckline/garment layout comes from existing generator style flags, not new pattern math.
 */

import {
  buildDropShoulderFrontStitchesRowsModel,
  type DropShoulderDiagramUnit,
  type DropShoulderFrontStitchesRowsModel,
} from "./dropShoulderPatternDiagramModel";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import {
  DS_FILL,
  DS_FS_MEASURE,
  DS_FS_SMALL,
  DS_FS_TITLE,
  DS_FW_TITLE,
  DS_MUTED,
  DS_STROKE,
  buildDropShoulderFrontCardiganLeftFrame,
  buildDropShoulderFrontFullWidthFrame,
  drawArmholeDepth,
  drawArmholeMarker,
  drawBodyLength,
  drawHemDepth,
  drawHemWidth,
  drawNecklineDepthDim,
  drawNecklineWidthDim,
  dropShoulderFrontBodyPath,
  dropShoulderFrontNecklineDeepestY,
  escapeXml,
  fmtNum,
  textFont,
  wrapGeneratedDiagramSvg,
  type DropShoulderDiagramFrame,
} from "./dropShoulderPatternDiagramSvgShared";

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
  const labelBandTop = Math.max(frame.armholeMarkerY, frame.neckBottomY);
  const y = labelBandTop + (frame.hemTopY - labelBandTop) * 0.5;
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
  const deepestY = dropShoulderFrontNecklineDeepestY(frame, model.garment, model.neckline);
  return [
    `<g class="ds-front-diagram__neckline-dims">`,
    drawNecklineWidthDim(frame, model.necklineWidthLabel),
    drawNecklineDepthDim(frame, model.necklineDepthLabel, depthX, {
      deepestY,
      labelPlacement: "along-line",
    }),
    `</g>`,
  ].join("");
}

/**
 * Build the Front Stitches & Rows SVG from an adapter model.
 */
export function buildDropShoulderFrontStitchesRowsSvg(
  model: DropShoulderFrontStitchesRowsModel,
): string {
  const frame =
    model.garment === "cardigan"
      ? buildDropShoulderFrontCardiganLeftFrame(model, model.shoulderStitchesEach)
      : buildDropShoulderFrontFullWidthFrame(model);
  const armholeSide = model.garment === "cardigan" ? "left" : "right";
  const markerSides = model.garment === "cardigan" ? "left" : "both";
  const body = [
    `<path class="ds-front-diagram__body" d="${dropShoulderFrontBodyPath(frame, model.garment, model.neckline)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.75"/>`,
    drawArmholeMarker(frame, markerSides),
    drawPieceLabel(frame, model),
    drawShoulderStitches(frame, model),
    drawArmholeDepth(frame, model.armholeDepthLabel, armholeSide),
    drawBodyLength(frame, model.bodyLengthLabel, model.garment === "cardigan" ? "right" : "left"),
    drawHemDepth(frame, model.hemDepthLabel),
    drawFrontNecklineDims(frame, model),
    drawHemWidth(frame, model.hemStitchesLabel, model.hemStitches, model.bodyWidthStitches, {
      evenWhenEqual: true,
    }),
  ].join("");

  return wrapGeneratedDiagramSvg({
    ariaLabel: "Generated drop shoulder front schematic",
    className: "sleeveless-piece-split__diagram-inline ds-front-diagram ds-front-diagram--generated",
    dataAttrs: {
      "data-ds-front-diagram": "sts-rows",
      "data-ds-front-sts-rows-generated": "true",
      "data-supported": "true",
      "data-neckline": model.neckline,
      "data-garment": model.garment,
      "data-body-shape": model.bodyShape,
      "data-armhole-rows": model.armholeRows,
      "data-neckline-rows-inside-armhole": model.necklineRowsInsideArmhole,
      "data-armhole-even-rows": model.armholeEvenRows,
      "data-front-neck-depth-rows": model.frontNeckDepthRows,
      "data-neck-begins-before-armhole": model.frontNeckDepthRows > model.armholeRows ? "true" : "false",
      "data-neck-bottom-y": fmtNum(frame.neckBottomY),
      "data-armhole-marker-y": fmtNum(frame.armholeMarkerY),
      "data-hem-stitches": model.hemStitches,
      "data-body-width-stitches": model.bodyWidthStitches,
      "data-neckline-stitches": model.necklineStitches,
      "data-shoulder-stitches": model.shoulderStitchesEach,
    },
    title: "Drop Shoulder Front - Stitches & Rows",
    body,
  });
}

/** Supported live markup, or `null` so hydration keeps the Illustrator SVG. */
export function tryBuildDropShoulderFrontStitchesRowsSvg(
  model: DropShoulderFrontStitchesRowsModel | null | undefined,
): string | null {
  if (!model) return null;
  const svg = buildDropShoulderFrontStitchesRowsSvg(model);
  if (!svg.includes('data-ds-front-sts-rows-generated="true"')) return null;
  if (!svg.includes('data-supported="true"')) return null;
  return svg;
}

/**
 * Live Front Stitches & Rows: pullover/cardigan, round/V, straight, A-line, or shaped
 * (narrower hem). Missing models return `null` so hydration keeps Illustrator.
 */
export function tryBuildLiveDropShoulderFrontStsRowsDiagramSvg(
  result: Pick<SleevelessBackPatternResult, "debug"> | null | undefined,
  patternData?: unknown,
  unit: DropShoulderDiagramUnit = "in",
): string | null {
  return tryBuildDropShoulderFrontStitchesRowsSvg(
    buildDropShoulderFrontStitchesRowsModel(result, patternData, unit),
  );
}
