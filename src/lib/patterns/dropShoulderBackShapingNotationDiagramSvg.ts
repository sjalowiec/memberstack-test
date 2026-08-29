/**
 * Programmatic Shaping Notation SVG for Drop Shoulder Back.
 *
 * Garment geometry is the generated Drop Shoulder Back Stitches & Rows silhouette.
 * Japanese notation is an annotation layer on that garment — not Sleeveless geometry
 * and not a second drawing model.
 */

import {
  buildDropShoulderBackJapaneseNotationReplacements,
  isDropShoulderBodyJapaneseNotationSupported,
} from "./dropShoulderBodyJapaneseNotation";
import { dropShoulderDiagramBodyShapeFromPattern } from "./dropShoulderDiagramSvgResolver";
import {
  buildDropShoulderBackStitchesRowsModel,
  type DropShoulderBackStitchesRowsModel,
  type DropShoulderDiagramUnit,
} from "./dropShoulderPatternDiagramModel";
import {
  DS_FILL,
  DS_FS_TITLE,
  DS_FW_TITLE,
  DS_STROKE,
  buildFullWidthFrame,
  drawArmholeMarker,
  dropShoulderBackNeckNotationAnchor,
  dropShoulderBackNecklineDeepestY,
  dropShoulderPulloverRoundBodyPath,
  fmtNum,
  textFont,
  wrapGeneratedDiagramSvg,
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

function drawBackPieceLabel(frame: ReturnType<typeof buildFullWidthFrame>): string {
  const y = frame.armholeMarkerY + (frame.hemTopY - frame.armholeMarkerY) * 0.62;
  return `<text x="${fmtNum(frame.midX)}" y="${fmtNum(y)}" text-anchor="middle" dominant-baseline="middle" fill="${DS_STROKE}" ${textFont(DS_FS_TITLE, DS_FW_TITLE)}>BACK</text>`;
}

export function buildDropShoulderBackShapingNotationDiagramSvg(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
  generatorPatternData?: unknown,
  unit: DropShoulderDiagramUnit = "in",
): string {
  const model = buildDropShoulderBackStitchesRowsModel(result, unit);
  if (!model) {
    throw new Error("Drop Shoulder Back notation requires a Stitches & Rows model");
  }
  return buildDropShoulderBackShapingNotationSvgFromModel(
    model,
    result,
    patternData,
    generatorPatternData,
  );
}

export function buildDropShoulderBackShapingNotationSvgFromModel(
  model: DropShoulderBackStitchesRowsModel,
  result: SleevelessBackPatternResult,
  patternData?: unknown,
  generatorPatternData?: unknown,
): string {
  const frame = buildFullWidthFrame(model);
  const labels = dropShoulderNotationLabelsFromReplacements(
    buildDropShoulderBackJapaneseNotationReplacements(result, patternData, generatorPatternData),
  );
  const bodyShape = dropShoulderDiagramBodyShapeFromPattern(patternData);
  const hasReset = Boolean(labels.rcReset);
  // Place labels in the Back neck opening. Do not reuse Front's before-armhole RC timing.
  const deepestY = dropShoulderBackNecklineDeepestY(frame);
  const notationPt = dropShoulderBackNeckNotationAnchor(frame);

  const body = [
    dropShoulderNotationFontFace(),
    `<path class="ds-back-diagram__body" d="${dropShoulderPulloverRoundBodyPath(frame)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.75"/>`,
    drawArmholeMarker(frame, "both"),
    drawBackPieceLabel(frame),
    drawDropShoulderNotationRcGutter(frame, labels, model.hemRows),
    drawDropShoulderNeckNotation(frame, labels, "center", {
      insideOpening: true,
      deepestY,
      labelX: notationPt.x,
      labelY: notationPt.y,
    }),
    drawDropShoulderBodyShapingNotation(frame, labels, "right"),
    drawDropShoulderBodyRowsNotation(frame, labels),
    drawDropShoulderCastOnNotation(frame, labels),
  ].join("");

  return wrapGeneratedDiagramSvg({
    ariaLabel: "Generated drop shoulder back shaping notation",
    className:
      "sleeveless-piece-split__diagram-inline ds-back-diagram ds-back-diagram--generated ds-back-diagram--notation",
    dataAttrs: {
      "data-ds-back-diagram": "shaping-notation",
      "data-ds-back-generated-notation": "true",
      "data-supported": "true",
      "data-body-shape": bodyShape,
      "data-armhole-rows": model.armholeRows,
      "data-neck-depth-rows": model.backNeckDepthRows,
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
      "data-neck-anchor": "center",
      "data-neck-notation-placement": "inside-opening",
      "data-neck-notation-x": fmtNum(notationPt.x),
      "data-neck-notation-y": fmtNum(notationPt.y),
      "data-neck-notation-deepest-y": fmtNum(deepestY),
    },
    title: "Drop Shoulder Back - Shaping Notation",
    body,
  });
}

export function shouldUseGeneratedDropShoulderBackNotation(
  result: Pick<SleevelessBackPatternResult, "debug" | "isDropShoulder"> | null | undefined,
  patternData?: unknown,
  unit: DropShoulderDiagramUnit = "in",
): boolean {
  if (!isDropShoulderResult(result)) return false;
  if (!isDropShoulderBodyJapaneseNotationSupported(result)) return false;
  return buildDropShoulderBackStitchesRowsModel(result, unit) != null;
}

/**
 * Supported live markup for the Back Shaping Notation tab, or `null`
 * so hydration keeps the Illustrator SVG.
 */
export function tryBuildLiveDropShoulderBackNotationSvg(
  result: Pick<SleevelessBackPatternResult, "debug" | "isDropShoulder"> | null | undefined,
  patternData?: unknown,
  generatorPatternData?: unknown,
  unit: DropShoulderDiagramUnit = "in",
): string | null {
  try {
    if (!shouldUseGeneratedDropShoulderBackNotation(result, patternData, unit)) return null;
    const svg = buildDropShoulderBackShapingNotationDiagramSvg(
      result as SleevelessBackPatternResult,
      patternData,
      generatorPatternData,
      unit,
    );
    if (!svg.includes('data-ds-back-generated-notation="true"')) return null;
    if (!svg.includes('data-supported="true"')) return null;
    return svg;
  } catch {
    return null;
  }
}
