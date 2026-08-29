/**
 * Programmatic Shaping Notation SVG for Drop Shoulder sleeve.
 *
 * Silhouette matches generated Sleeve Stitches & Rows. Labels come from existing
 * Japanese notation replacements — this module does not recalculate shaping.
 */

import { buildDropShoulderSleeveJapaneseNotationReplacements } from "./sleevelessGarmentDiagramReplacements";
import {
  buildDropShoulderSleeveStitchesRowsModel,
  type DropShoulderSleeveStitchesRowsModel,
} from "./dropShoulderSleeveDiagramModel";
import type { DropShoulderDiagramUnit } from "./dropShoulderPatternDiagramModel";
import type { DropShoulderSleeveDirection } from "./dropShoulderSleeveConstruction";
import { dropShoulderSleeveShapingVerb } from "./dropShoulderSleeveShaping";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import {
  DS_FILL,
  DS_FS_TITLE,
  DS_FW_TITLE,
  DS_MUTED,
  DS_STROKE,
  DS_VB_H,
  escapeXml,
  fmtNum,
  textFont,
  wrapGeneratedDiagramSvg,
} from "./dropShoulderPatternDiagramSvgShared";
import {
  DS_FS_NOTATION,
  dropShoulderNotationFontFace,
} from "./dropShoulderShapingNotationDiagramShared";
import {
  buildDropShoulderSleeveFrame,
  dropShoulderSleeveBodyPath,
  drawSleeveCuffJoin,
  type DropShoulderSleeveDiagramFrame,
} from "./dropShoulderSleeveDiagramSvgShared";

function isDropShoulderResult(
  result: Pick<SleevelessBackPatternResult, "debug" | "isDropShoulder"> | null | undefined,
): result is SleevelessBackPatternResult {
  return Boolean(result && result.isDropShoulder === true);
}

function drawSleevePieceLabel(frame: DropShoulderSleeveDiagramFrame): string {
  const bodyTop = Math.min(frame.cuffJoinY, frame.upperArmY);
  const bodyBottom = Math.max(frame.cuffJoinY, frame.upperArmY);
  const y = bodyTop + (bodyBottom - bodyTop) * 0.55;
  return `<text data-role="sleeve-piece-label" x="${fmtNum(frame.midX)}" y="${fmtNum(y)}" text-anchor="middle" dominant-baseline="middle" fill="${DS_STROKE}" ${textFont(DS_FS_TITLE, DS_FW_TITLE)}>SLEEVE</text>`;
}

function notationText(
  role: string,
  label: string,
  x: number,
  y: number,
  anchor: "middle" | "start" | "end" = "middle",
): string {
  if (!label) return "";
  return (
    `<text data-role="${escapeXml(role)}" data-notation="${escapeXml(label)}" x="${fmtNum(x)}" y="${fmtNum(y)}"` +
    ` text-anchor="${anchor}" fill="${DS_MUTED}" ${textFont(DS_FS_NOTATION)}>${escapeXml(label)}</text>`
  );
}

function drawSleeveNotationLabels(
  frame: DropShoulderSleeveDiagramFrame,
  repl: Record<string, string>,
): string {
  const castOn = repl["jp-caston"] ?? "";
  const cuff = repl["jp-cuff"] ?? "";
  const sleeve = repl["jp-sleeve"] ?? "";
  const capSts = repl["jp-sleeve_cap_sts"] ?? "";
  const cuffMidY = (frame.wristY + frame.cuffJoinY) / 2;
  const bodyTop = Math.min(frame.cuffJoinY, frame.upperArmY);
  const bodyBottom = Math.max(frame.cuffJoinY, frame.upperArmY);
  const shapingY = bodyTop + (bodyBottom - bodyTop) * 0.32;
  const bodyRight = Math.max(frame.wristRight, frame.upperRight);
  const castOnY = Math.min(DS_VB_H - 8, frame.bottom + 16);
  const capY = frame.top - 14;

  return [
    notationText("cast-on", castOn, frame.midX, castOnY),
    notationText("sleeve-cap-sts", capSts, frame.midX, capY),
    notationText("cuff", cuff, frame.midX, cuffMidY + 5),
    notationText("sleeve-shaping", sleeve, bodyRight + 10, shapingY, "start"),
  ].join("");
}

export function buildDropShoulderSleeveShapingNotationSvgFromModel(
  model: DropShoulderSleeveStitchesRowsModel,
  result: SleevelessBackPatternResult,
): string {
  const frame = buildDropShoulderSleeveFrame(model);
  const repl = buildDropShoulderSleeveJapaneseNotationReplacements(result, model.direction);
  const body = [
    dropShoulderNotationFontFace(),
    `<path class="ds-sleeve-diagram__body" d="${dropShoulderSleeveBodyPath(frame)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.75"/>`,
    drawSleeveCuffJoin(frame),
    drawSleevePieceLabel(frame),
    drawSleeveNotationLabels(frame, repl),
  ].join("");

  return wrapGeneratedDiagramSvg({
    ariaLabel: "Generated drop shoulder sleeve shaping notation",
    className:
      "sleeveless-piece-split__diagram-inline ds-sleeve-diagram ds-sleeve-diagram--generated ds-sleeve-diagram--notation",
    dataAttrs: {
      "data-ds-sleeve-diagram": "shaping-notation",
      "data-ds-sleeve-generated-notation": "true",
      "data-supported": "true",
      "data-sleeve-direction": model.direction,
      "data-wrist-stitches": model.wristStitches,
      "data-top-stitches": model.topStitches,
      "data-cuff-rows": model.cuffRows,
      "data-sleeve-body-rows": model.sleeveBodyRows,
      "data-sleeve-total-rows": model.sleeveTotalRows,
      "data-sleeve-shaping-direction": dropShoulderSleeveShapingVerb(
        model.direction,
        model.topStitches,
        model.wristStitches,
      ),
      "data-jp-caston": repl["jp-caston"] ?? "",
      "data-jp-cuff": repl["jp-cuff"] ?? "",
      "data-jp-sleeve": repl["jp-sleeve"] ?? "",
      "data-jp-sleeve-shaping": repl["jp-sleeve-shaping"] ?? "",
      "data-jp-sleeve-cap-sts": repl["jp-sleeve_cap_sts"] ?? "",
    },
    title: "Drop Shoulder Sleeve - Shaping Notation",
    body,
  });
}

export function buildDropShoulderSleeveShapingNotationDiagramSvg(
  result: SleevelessBackPatternResult,
  direction: DropShoulderSleeveDirection = "cuff-up",
  unit: DropShoulderDiagramUnit = "in",
): string {
  const model = buildDropShoulderSleeveStitchesRowsModel(result, direction, unit);
  if (!model) {
    throw new Error("Drop Shoulder sleeve notation requires a Stitches & Rows model");
  }
  return buildDropShoulderSleeveShapingNotationSvgFromModel(model, result);
}

export function tryBuildLiveDropShoulderSleeveNotationSvg(
  result: Pick<SleevelessBackPatternResult, "debug" | "isDropShoulder"> | null | undefined,
  direction: DropShoulderSleeveDirection = "cuff-up",
  unit: DropShoulderDiagramUnit = "in",
): string | null {
  if (!isDropShoulderResult(result)) return null;
  const model = buildDropShoulderSleeveStitchesRowsModel(result, direction, unit);
  if (!model) return null;
  const svg = buildDropShoulderSleeveShapingNotationSvgFromModel(model, result);
  if (!svg.includes('data-ds-sleeve-generated-notation="true"')) return null;
  if (!svg.includes('data-supported="true"')) return null;
  return svg;
}
