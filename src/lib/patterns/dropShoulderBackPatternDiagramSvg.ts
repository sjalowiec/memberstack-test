/**
 * Generated Drop Shoulder Back — Stitches & Rows schematic.
 *
 * Geometry is scaled from the adapter model (existing stitch/row counts).
 * Neckline depth is drawn inside the armhole span; it is never stacked on top.
 */

import {
  buildDropShoulderBackStitchesRowsModel,
  type DropShoulderBackStitchesRowsModel,
  type DropShoulderDiagramUnit,
} from "./dropShoulderPatternDiagramModel";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import {
  DS_FILL,
  DS_FS_MEASURE,
  DS_FS_TITLE,
  DS_FW_TITLE,
  DS_STROKE,
  buildFullWidthFrame,
  drawArmholeDepth,
  drawArmholeMarker,
  drawBodyLength,
  drawBodyWidth,
  drawHemDepth,
  drawHemWidth,
  drawNecklineDepthDim,
  drawNecklineWidthDim,
  dropShoulderPulloverRoundBodyPath,
  escapeXml,
  fmtNum,
  textFont,
  wrapGeneratedDiagramSvg,
  type DropShoulderDiagramFrame,
} from "./dropShoulderPatternDiagramSvgShared";

function drawShoulderStitches(frame: DropShoulderDiagramFrame, model: DropShoulderBackStitchesRowsModel): string {
  if (!model.shoulderStitchesLabel) return "";
  const y = frame.top + 16;
  const leftX = (frame.left + frame.neckLeftX) / 2;
  const rightX = (frame.right + frame.neckRightX) / 2;
  const label = escapeXml(model.shoulderStitchesLabel);
  return [
    `<g class="ds-back-diagram__shoulder-sts">`,
    `<text x="${fmtNum(leftX)}" y="${fmtNum(y)}" text-anchor="middle" fill="${DS_STROKE}" ${textFont(DS_FS_MEASURE)}>${label}</text>`,
    `<text x="${fmtNum(rightX)}" y="${fmtNum(y)}" text-anchor="middle" fill="${DS_STROKE}" ${textFont(DS_FS_MEASURE)}>${label}</text>`,
    `</g>`,
  ].join("");
}

/**
 * Build the Back Stitches & Rows SVG from an adapter model.
 */
export function buildDropShoulderBackStitchesRowsSvg(
  model: DropShoulderBackStitchesRowsModel,
): string {
  const frame = buildFullWidthFrame(model);
  const body = [
    `<path class="ds-back-diagram__body" d="${dropShoulderPulloverRoundBodyPath(frame)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.75"/>`,
    drawArmholeMarker(frame, "both"),
    `<text x="${fmtNum(frame.midX)}" y="${fmtNum(frame.armholeMarkerY + (frame.hemTopY - frame.armholeMarkerY) * 0.62)}" text-anchor="middle" dominant-baseline="middle" fill="${DS_STROKE}" ${textFont(DS_FS_TITLE, DS_FW_TITLE)}>BACK</text>`,
    drawShoulderStitches(frame, model),
    drawArmholeDepth(frame, model.armholeDepthLabel, "right"),
    drawBodyLength(frame, model.bodyLengthLabel, "left"),
    drawHemDepth(frame, model.hemDepthLabel),
    drawBodyWidth(frame, model.bodyWidthLabel),
    `<g class="ds-back-diagram__neckline-dims">`,
    drawNecklineWidthDim(frame, model.necklineWidthLabel),
    drawNecklineDepthDim(frame, model.necklineDepthLabel),
    `</g>`,
    drawHemWidth(frame, model.hemStitchesLabel, model.hemStitches, model.bodyWidthStitches),
  ].join("");

  return wrapGeneratedDiagramSvg({
    ariaLabel: "Generated drop shoulder back schematic",
    className: "sleeveless-piece-split__diagram-inline ds-back-diagram ds-back-diagram--generated",
    dataAttrs: {
      "data-ds-back-diagram": "sts-rows",
      "data-ds-back-sts-rows-generated": "true",
      "data-supported": "true",
      "data-armhole-rows": model.armholeRows,
      "data-neckline-rows-inside-armhole": model.necklineRowsInsideArmhole,
      "data-armhole-even-rows": model.armholeEvenRows,
      "data-hem-stitches": model.hemStitches,
      "data-body-width-stitches": model.bodyWidthStitches,
      "data-neckline-stitches": model.necklineStitches,
      "data-shoulder-stitches": model.shoulderStitchesEach,
      "data-hem-rows": model.hemRows,
      "data-body-rows": model.bodyRowsToArmhole,
    },
    title: "Drop Shoulder Back - Stitches & Rows",
    body,
  });
}

/** Supported live markup, or `null` so hydration keeps the Illustrator SVG. */
export function tryBuildDropShoulderBackStitchesRowsSvg(
  model: DropShoulderBackStitchesRowsModel | null | undefined,
): string | null {
  if (!model) return null;
  const svg = buildDropShoulderBackStitchesRowsSvg(model);
  if (!svg.includes('data-ds-back-sts-rows-generated="true"')) return null;
  if (!svg.includes('data-supported="true"')) return null;
  return svg;
}

/**
 * Live Back Stitches & Rows: straight, A-line, or shaped (narrower hem).
 * Missing models return `null` so hydration keeps the Illustrator SVG.
 */
export function tryBuildLiveDropShoulderBackStsRowsDiagramSvg(
  result: Pick<SleevelessBackPatternResult, "debug"> | null | undefined,
  _patternData?: unknown,
  unit: DropShoulderDiagramUnit = "in",
): string | null {
  return tryBuildDropShoulderBackStitchesRowsSvg(
    buildDropShoulderBackStitchesRowsModel(result, unit),
  );
}
