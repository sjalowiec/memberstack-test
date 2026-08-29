/**
 * Generated Drop Shoulder sleeve — Stitches & Rows schematic.
 *
 * Geometry is scaled from existing sleeve stitch/row counts.
 * No sleeve-cap shaping: a tapered or straight piece between wrist and upper arm.
 */

import {
  buildDropShoulderSleeveStitchesRowsModel,
  type DropShoulderSleeveStitchesRowsModel,
} from "./dropShoulderSleeveDiagramModel";
import type { DropShoulderDiagramUnit } from "./dropShoulderPatternDiagramModel";
import type { DropShoulderSleeveDirection } from "./dropShoulderSleeveConstruction";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import {
  DS_FILL,
  DS_FS_TITLE,
  DS_FW_TITLE,
  DS_STROKE,
  fmtNum,
  textFont,
  wrapGeneratedDiagramSvg,
} from "./dropShoulderPatternDiagramSvgShared";
import {
  buildDropShoulderSleeveFrame,
  dropShoulderSleeveBodyPath,
  drawSleeveBodyLength,
  drawSleeveCuffDepth,
  drawSleeveCuffJoin,
  drawSleeveTotalLength,
  drawSleeveUpperArmWidth,
  drawSleeveWristWidth,
  type DropShoulderSleeveDiagramFrame,
} from "./dropShoulderSleeveDiagramSvgShared";

function drawSleevePieceLabel(frame: DropShoulderSleeveDiagramFrame): string {
  const bodyTop = Math.min(frame.cuffJoinY, frame.upperArmY);
  const bodyBottom = Math.max(frame.cuffJoinY, frame.upperArmY);
  const y = bodyTop + (bodyBottom - bodyTop) * 0.55;
  return `<text data-role="sleeve-piece-label" x="${fmtNum(frame.midX)}" y="${fmtNum(y)}" text-anchor="middle" dominant-baseline="middle" fill="${DS_STROKE}" ${textFont(DS_FS_TITLE, DS_FW_TITLE)}>SLEEVE</text>`;
}

export function buildDropShoulderSleeveStitchesRowsSvg(
  model: DropShoulderSleeveStitchesRowsModel,
): string {
  const frame = buildDropShoulderSleeveFrame(model);
  const body = [
    `<path class="ds-sleeve-diagram__body" d="${dropShoulderSleeveBodyPath(frame)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.75"/>`,
    drawSleeveCuffJoin(frame),
    drawSleevePieceLabel(frame),
    drawSleeveWristWidth(frame, model.wristWidthLabel),
    drawSleeveUpperArmWidth(frame, model.topWidthLabel),
    drawSleeveCuffDepth(frame, model.cuffDepthLabel),
    drawSleeveBodyLength(frame, model.sleeveBodyLengthLabel),
    drawSleeveTotalLength(frame, model.sleeveTotalLengthLabel),
  ].join("");

  return wrapGeneratedDiagramSvg({
    ariaLabel: "Generated drop shoulder sleeve schematic",
    className: "sleeveless-piece-split__diagram-inline ds-sleeve-diagram ds-sleeve-diagram--generated",
    dataAttrs: {
      "data-ds-sleeve-diagram": "sts-rows",
      "data-ds-sleeve-sts-rows-generated": "true",
      "data-supported": "true",
      "data-sleeve-direction": model.direction,
      "data-wrist-stitches": model.wristStitches,
      "data-top-stitches": model.topStitches,
      "data-cuff-rows": model.cuffRows,
      "data-sleeve-body-rows": model.sleeveBodyRows,
      "data-sleeve-total-rows": model.sleeveTotalRows,
      "data-wrist-y": fmtNum(frame.wristY),
      "data-upper-arm-y": fmtNum(frame.upperArmY),
      "data-cuff-join-y": fmtNum(frame.cuffJoinY),
    },
    title: "Drop Shoulder Sleeve - Stitches & Rows",
    body,
  });
}

export function tryBuildDropShoulderSleeveStitchesRowsSvg(
  model: DropShoulderSleeveStitchesRowsModel | null | undefined,
): string | null {
  if (!model) return null;
  const svg = buildDropShoulderSleeveStitchesRowsSvg(model);
  if (!svg.includes('data-ds-sleeve-sts-rows-generated="true"')) return null;
  if (!svg.includes('data-supported="true"')) return null;
  return svg;
}

export function tryBuildLiveDropShoulderSleeveStsRowsDiagramSvg(
  result: Pick<SleevelessBackPatternResult, "debug" | "isDropShoulder"> | null | undefined,
  direction: DropShoulderSleeveDirection = "cuff-up",
  unit: DropShoulderDiagramUnit = "in",
): string | null {
  return tryBuildDropShoulderSleeveStitchesRowsSvg(
    buildDropShoulderSleeveStitchesRowsModel(result, direction, unit),
  );
}
