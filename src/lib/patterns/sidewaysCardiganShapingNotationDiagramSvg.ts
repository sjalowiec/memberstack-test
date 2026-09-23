/**
 * Sideways V-Neck finished-pattern Shaping Notation schematic.
 *
 * Same silhouette as Stitches & Rows. V-neck tokens format the body instruction
 * slope sequences (increase, and that sequence reversed for the decrease).
 * Sleeve tokens format the saved sleeve calc's shaping plan. This file does
 * not run a second slope or sleeve formula.
 */

import {
  DS_MUTED,
  DS_STROKE,
  escapeXml,
  fmtNum,
} from "./dropShoulderPatternDiagramSvgShared";
import { formatDropShoulderSleeveShapingNotation } from "./dropShoulderSleeveShaping";
import { compressSlopeSequence, slopeJapaneseNotationLines } from "./legoBlocks/slopeShaping";
import { buildSidewaysVNeckSlopeSequence } from "./sidewaysCardiganBodyInstructions";
import {
  formatBindOffNotation,
  formatBodyRowsNotation,
  formatCastOnNotation,
  formatHoldNotation,
} from "./sleevelessBackJapaneseNotation";
import {
  buildSidewaysCardiganPatternDiagramFrame,
  buildSidewaysCardiganPatternSilhouetteMarkup,
  sidewaysCardiganPatternDiagramDataAttrs,
  type SidewaysCardiganPatternDiagramModel,
} from "./sidewaysCardiganPatternDiagramSvg";
import { viewBoxFor } from "./sidewaysCardiganEditMeasurementDiagramSvg";

const FONT = "Poppins, system-ui, Arial, sans-serif";

function textAt(
  x: number,
  y: number,
  text: string,
  role: string,
  anchor: "start" | "middle" | "end" = "middle",
): string {
  if (!text) return "";
  return `<text data-role="${role}" x="${fmtNum(x)}" y="${fmtNum(y)}" text-anchor="${anchor}" font-family="${FONT}" font-size="12" fill="${DS_STROKE}">${escapeXml(text)}</text>`;
}

function stackedLines(
  x: number,
  y: number,
  lines: readonly string[],
  role: string,
  anchor: "start" | "middle" | "end" = "start",
  extraAttrs = "",
): string {
  if (!lines.length) return "";
  const tspans = lines
    .map((line, i) => `<tspan x="${fmtNum(x)}" dy="${i === 0 ? 0 : 16}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<text data-role="${role}"${extraAttrs} x="${fmtNum(x)}" y="${fmtNum(y)}" text-anchor="${anchor}" font-family="${FONT}" font-size="12" fill="${DS_MUTED}">${tspans}</text>`;
}

function signedSlopeLines(sequence: readonly number[], sign: "+" | "-"): string[] {
  const steps = compressSlopeSequence(sequence);
  if (!steps.length) return [];
  return slopeJapaneseNotationLines(steps, 2).map((line) => `${sign}${line}`);
}

export function sidewaysCardiganVNeckNotationLines(
  model: SidewaysCardiganPatternDiagramModel,
): { increase: string[]; decrease: string[] } {
  if (
    model.vNeckIncreaseSequence !== undefined &&
    model.vNeckDecreaseSequence !== undefined
  ) {
    return {
      increase: signedSlopeLines(model.vNeckIncreaseSequence, "+"),
      decrease: signedSlopeLines(model.vNeckDecreaseSequence, "-"),
    };
  }
  const slope = buildSidewaysVNeckSlopeSequence(
    model.calc.vNeckDepthStitches,
    model.calc.halfNeckRows,
  );
  if (!slope.ok) return { increase: [], decrease: [] };
  return {
    increase: signedSlopeLines(slope.sequence, "+"),
    decrease: signedSlopeLines([...slope.sequence].reverse(), "-"),
  };
}

function armholeSlitLines(stitches: number): string[] {
  const bindOff = formatBindOffNotation(stitches);
  const castOn = formatCastOnNotation(stitches);
  return [bindOff, castOn].filter((line) => line.length > 0);
}

export function buildSidewaysCardiganShapingNotationDiagramSvg(
  model: SidewaysCardiganPatternDiagramModel,
): string {
  const frame = buildSidewaysCardiganPatternDiagramFrame(model);
  const { x: vbX, width, height } = viewBoxFor(frame);
  const { increase, decrease } = sidewaysCardiganVNeckNotationLines(model);
  const firstV = model.garmentStyle === "pullover" ? decrease : increase;
  const secondV = model.garmentStyle === "pullover" ? increase : decrease;
  const firstVMidY = (frame.topY + frame.firstVEndY) / 2;
  const secondVMidY = (frame.secondVStartY + frame.bottomY) / 2;
  const slitLines = armholeSlitLines(model.calc.armholeDepthStitches);
  const slitX = (frame.armholeX + frame.neckX) / 2;
  const armholeSlits =
    model.garmentStyle === "pullover"
      ? [
          stackedLines(
            slitX,
            frame.secondArmholeY - 10,
            slitLines,
            "jp-armhole-slit",
            "middle",
            ` data-side="knitted"`,
          ),
        ]
      : [
          stackedLines(
            slitX,
            frame.firstArmholeY - 10,
            slitLines,
            "jp-armhole-slit",
            "middle",
            ` data-side="first"`,
          ),
          stackedLines(
            slitX,
            frame.secondArmholeY - 10,
            slitLines,
            "jp-armhole-slit",
            "middle",
            ` data-side="second"`,
          ),
        ];
  const sleevePlan = model.sleeveCalc?.shapingPlan;
  const sleeveSegments =
    model.sleeveCalc && sleevePlan && !sleevePlan.noShaping
      ? formatDropShoulderSleeveShapingNotation(sleevePlan.steps)
      : "";
  const sleeveNotation = sleeveSegments
    ? `${sleevePlan?.shapingDirection === "decrease" ? "-" : "+"}${sleeveSegments}`
    : model.sleeveCalc
      ? formatBodyRowsNotation(model.sleeveCalc.sleeveBodyRows)
      : "";
  const cuffNotation =
    model.sleeveCalc && model.sleeveCalc.cuffRows > 0
      ? formatBodyRowsNotation(model.sleeveCalc.cuffRows)
      : "";
  const aria =
    model.garmentStyle === "pullover"
      ? "Sideways pullover shaping notation diagram starting at the underarm"
      : "Sideways cardigan shaping notation diagram starting at center front";
  const hold =
    model.garmentStyle === "cardigan"
      ? textAt(
          (frame.vCutX + frame.neckX) / 2,
          frame.topY - 14,
          formatHoldNotation(model.calc.vNeckDepthStitches),
          "jp-hold",
        )
      : "";
  const sleeveLabels =
    model.garmentStyle === "pullover" && model.sleeveCalc
      ? [
          textAt(
            (frame.sleeve.attachX + frame.sleeve.farX) / 2,
            frame.sleeve.attachY - 8,
            sleeveNotation,
            "jp-sleeve",
          ),
          textAt(
            frame.sleeve.farX + 8,
            frame.sleeve.attachY + 14,
            cuffNotation,
            "jp-cuff",
            "start",
          ),
        ]
      : [];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmtNum(vbX)} 0 ${fmtNum(width)} ${fmtNum(height)}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${aria}" focusable="false" class="express-mbp-art sleeveless-piece-split__diagram-inline"${sidewaysCardiganPatternDiagramDataAttrs(model, "shaping-notation")}>`,
    buildSidewaysCardiganPatternSilhouetteMarkup(model),
    textAt(
      (frame.hemX + frame.neckX) / 2,
      frame.topY - 28,
      formatCastOnNotation(model.castOnStitches),
      "jp-caston",
    ),
    hold,
    stackedLines(frame.neckX + 12, firstVMidY, firstV, "jp-vneck-first", "start"),
    stackedLines(frame.neckX + 12, secondVMidY, secondV, "jp-vneck-second", "start"),
    ...armholeSlits,
    textAt(
      frame.backNeckX - 6,
      frame.backNeckStartY + 14,
      formatBindOffNotation(model.calc.backNeckDepthStitches),
      "jp-back-neck-bo",
      "end",
    ),
    textAt(
      frame.backNeckX - 6,
      frame.backNeckEndY - 4,
      formatCastOnNotation(model.calc.backNeckDepthStitches),
      "jp-back-neck-co",
      "end",
    ),
    textAt(
      (frame.hemX + frame.neckX) / 2,
      frame.bottomY + 16,
      formatBindOffNotation(model.calc.garmentLengthStitches),
      "jp-final-bo",
    ),
    ...sleeveLabels,
    `</svg>`,
  ].join("");
}
