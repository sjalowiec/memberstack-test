/**
 * Programmatic Shaping Notation SVG for Drop Shoulder Front.
 *
 * Garment geometry is the generated Drop Shoulder Front Stitches & Rows silhouette
 * (pullover/cardigan × round/V × straight/A-line/shaped). Japanese notation is an
 * annotation layer on that garment — not Sleeveless armhole or shoulder geometry.
 */

import {
  buildDropShoulderFrontJapaneseNotationReplacements,
  isDropShoulderBodyJapaneseNotationSupported,
} from "./dropShoulderBodyJapaneseNotation";
import {
  buildDropShoulderFrontStitchesRowsModel,
  type DropShoulderDiagramUnit,
  type DropShoulderFrontStitchesRowsModel,
} from "./dropShoulderPatternDiagramModel";
import {
  DS_FILL,
  DS_FS_SMALL,
  DS_FS_TITLE,
  DS_FW_TITLE,
  DS_MUTED,
  DS_STROKE,
  buildDropShoulderFrontCardiganLeftFrame,
  buildDropShoulderFrontFullWidthFrame,
  drawArmholeMarker,
  dropShoulderFrontBodyPath,
  dropShoulderFrontNeckNotationAnchor,
  dropShoulderFrontNecklineDeepestY,
  fmtNum,
  textFont,
  wrapGeneratedDiagramSvg,
  type DropShoulderDiagramFrame,
} from "./dropShoulderPatternDiagramSvgShared";
import {
  drawDropShoulderBodyRowsNotation,
  drawDropShoulderBodyShapingNotation,
  drawDropShoulderCastOnNotation,
  drawDropShoulderNeckNotation,
  drawDropShoulderNotationRcGutter,
  dropShoulderNotationFontFace,
  dropShoulderNotationLabelsFromReplacements,
} from "./dropShoulderShapingNotationDiagramShared";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";

function isDropShoulderResult(
  result: Pick<SleevelessBackPatternResult, "debug" | "isDropShoulder"> | null | undefined,
): result is SleevelessBackPatternResult {
  return Boolean(result && result.isDropShoulder === true);
}

function frontFrame(model: DropShoulderFrontStitchesRowsModel): DropShoulderDiagramFrame {
  return model.garment === "cardigan"
    ? buildDropShoulderFrontCardiganLeftFrame(model, model.shoulderStitchesEach)
    : buildDropShoulderFrontFullWidthFrame(model);
}

function drawFrontPieceLabel(
  frame: DropShoulderDiagramFrame,
  model: DropShoulderFrontStitchesRowsModel,
): string {
  const y = Math.max(frame.armholeMarkerY, frame.neckBottomY) +
    (frame.hemTopY - Math.max(frame.armholeMarkerY, frame.neckBottomY)) * 0.5;
  const label = model.garment === "cardigan" ? "LEFT FRONT" : "FRONT";
  const parts = [
    `<text x="${fmtNum(frame.midX)}" y="${fmtNum(y)}" text-anchor="middle" dominant-baseline="middle" fill="${DS_STROKE}" ${textFont(DS_FS_TITLE, DS_FW_TITLE)}>${label}</text>`,
  ];
  if (model.garment === "cardigan") {
    parts.push(
      `<text data-role="center-front" x="${fmtNum(frame.right + 10)}" y="${fmtNum((frame.neckBottomY + frame.hemTopY) / 2)}" text-anchor="start" fill="${DS_MUTED}" ${textFont(DS_FS_SMALL)}>CF</text>`,
    );
  }
  return parts.join("");
}

export function buildDropShoulderFrontShapingNotationDiagramSvg(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
  generatorPatternData?: unknown,
  unit: DropShoulderDiagramUnit = "in",
): string {
  const model = buildDropShoulderFrontStitchesRowsModel(result, patternData, unit);
  if (!model) {
    throw new Error("Drop Shoulder Front notation requires a Stitches & Rows model");
  }
  return buildDropShoulderFrontShapingNotationSvgFromModel(
    model,
    result,
    patternData,
    generatorPatternData,
  );
}

export function buildDropShoulderFrontShapingNotationSvgFromModel(
  model: DropShoulderFrontStitchesRowsModel,
  result: SleevelessBackPatternResult,
  patternData?: unknown,
  generatorPatternData?: unknown,
): string {
  const frame = frontFrame(model);
  const labels = dropShoulderNotationLabelsFromReplacements(
    buildDropShoulderFrontJapaneseNotationReplacements(result, patternData, generatorPatternData),
  );
  const hasReset = Boolean(labels.rcReset);
  const markerSides = model.garment === "cardigan" ? "left" : "both";
  const bodyShapingSide = model.garment === "cardigan" ? "left" : "right";
  const neckAnchor = model.garment === "cardigan" ? "cf" : "center";
  const deepestY = dropShoulderFrontNecklineDeepestY(frame, model.garment, model.neckline);
  const notationPt = dropShoulderFrontNeckNotationAnchor(frame, model.garment, model.neckline);

  const body = [
    dropShoulderNotationFontFace(),
    `<path class="ds-front-diagram__body" d="${dropShoulderFrontBodyPath(frame, model.garment, model.neckline)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.75"/>`,
    drawArmholeMarker(frame, markerSides),
    drawFrontPieceLabel(frame, model),
    drawDropShoulderNotationRcGutter(frame, labels, model.hemRows),
    drawDropShoulderNeckNotation(frame, labels, neckAnchor, {
      insideOpening: true,
      deepestY,
      labelX: notationPt.x,
      labelY: notationPt.y,
    }),
    drawDropShoulderBodyShapingNotation(frame, labels, bodyShapingSide),
    drawDropShoulderBodyRowsNotation(frame, labels),
    drawDropShoulderCastOnNotation(frame, labels),
  ].join("");

  return wrapGeneratedDiagramSvg({
    ariaLabel: "Generated drop shoulder front shaping notation",
    className:
      "sleeveless-piece-split__diagram-inline ds-front-diagram ds-front-diagram--generated ds-front-diagram--notation",
    dataAttrs: {
      "data-ds-front-diagram": "shaping-notation",
      "data-ds-front-generated-notation": "true",
      "data-supported": "true",
      "data-neckline": model.neckline,
      "data-garment": model.garment,
      "data-body-shape": model.bodyShape,
      "data-armhole-rows": model.armholeRows,
      "data-front-neck-depth-rows": model.frontNeckDepthRows,
      "data-neck-begins-before-armhole": model.frontNeckDepthRows > model.armholeRows ? "true" : "false",
      "data-neck-bottom-y": fmtNum(frame.neckBottomY),
      "data-armhole-marker-y": fmtNum(frame.armholeMarkerY),
      "data-neckline-rows-inside-armhole": model.necklineRowsInsideArmhole,
      "data-hem-stitches": model.hemStitches,
      "data-body-width-stitches": model.bodyWidthStitches,
      "data-cast-on": labels.castOn,
      "data-body-rows": labels.bodyRows,
      "data-body-shaping": labels.bodyShaping,
      "data-armhole-bo": "",
      "data-armhole-shaping": "",
      "data-shoulder-shaping": "",
      "data-neck-bo": labels.neckBo,
      "data-neck-shaping": labels.neckShaping,
      "data-rc-armhole-marker": labels.rcArmholeMarker,
      "data-rc-neck-start": labels.rcNeckStart,
      "data-rc-reset": labels.rcReset,
      "data-reset": hasReset ? "true" : "false",
      "data-neck-working-order": "bottom-up",
      "data-neck-anchor": neckAnchor,
      "data-center-front": model.garment === "cardigan" ? "true" : "false",
      "data-neck-notation-placement": "inside-opening",
      "data-neck-notation-x": fmtNum(notationPt.x),
      "data-neck-notation-y": fmtNum(notationPt.y),
      "data-neck-notation-deepest-y": fmtNum(deepestY),
      "data-neck-rc-continuous": hasReset ? "false" : "true",
    },
    title: "Drop Shoulder Front - Shaping Notation",
    body,
  });
}

export function shouldUseGeneratedDropShoulderFrontNotation(
  result: Pick<SleevelessBackPatternResult, "debug" | "isDropShoulder"> | null | undefined,
  patternData?: unknown,
  unit: DropShoulderDiagramUnit = "in",
): boolean {
  if (!isDropShoulderResult(result)) return false;
  if (!isDropShoulderBodyJapaneseNotationSupported(result)) return false;
  return buildDropShoulderFrontStitchesRowsModel(result, patternData, unit) != null;
}

/**
 * Supported live markup for the Front Shaping Notation tab, or `null`
 * so hydration keeps the Illustrator SVG.
 */
export function tryBuildLiveDropShoulderFrontNotationSvg(
  result: Pick<SleevelessBackPatternResult, "debug" | "isDropShoulder"> | null | undefined,
  patternData?: unknown,
  generatorPatternData?: unknown,
  unit: DropShoulderDiagramUnit = "in",
): string | null {
  try {
    if (!shouldUseGeneratedDropShoulderFrontNotation(result, patternData, unit)) return null;
    const svg = buildDropShoulderFrontShapingNotationDiagramSvg(
      result as SleevelessBackPatternResult,
      patternData,
      generatorPatternData,
      unit,
    );
    if (!svg.includes('data-ds-front-generated-notation="true"')) return null;
    if (!svg.includes('data-supported="true"')) return null;
    return svg;
  } catch {
    return null;
  }
}
