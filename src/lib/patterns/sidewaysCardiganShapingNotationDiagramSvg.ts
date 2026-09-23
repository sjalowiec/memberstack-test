/**
 * Sideways V-Neck finished-pattern Shaping Notation schematic.
 *
 * Same silhouette and bottom-up orientation as Stitches & Rows. V-neck tokens
 * format the body instruction slope sequences (increase, and that sequence
 * reversed for the decrease) and stack upward along the neck edge. Sleeve tokens
 * format the saved sleeve calc's shaping plan. This file does not run a second
 * slope or sleeve formula.
 */

import {
  DS_MUTED,
  escapeXml,
  fmtNum,
  textFont,
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
import type { SidewaysCardiganEditMeasurementFrame } from "./sidewaysCardiganEditMeasurementDiagramSvg";
import {
  buildSidewaysCardiganPatternDiagramFrame,
  buildSidewaysCardiganPatternSilhouetteMarkup,
  sidewaysCardiganPatternDiagramDataAttrs,
  sidewaysDiagramEdgeStitchCount,
  sidewaysKnitVisualY,
  sidewaysPatternDiagramCanvas,
  type SidewaysCardiganPatternDiagramModel,
  type SidewaysPatternDiagramType,
} from "./sidewaysCardiganPatternDiagramSvg";

function textAt(
  x: number,
  y: number,
  text: string,
  role: string,
  type: SidewaysPatternDiagramType,
  anchor: "start" | "middle" | "end" = "middle",
  extra = "",
): string {
  if (!text) return "";
  return `<text data-role="${role}" data-notation="${escapeXml(text)}"${extra} x="${fmtNum(x)}" y="${fmtNum(y)}" text-anchor="${anchor}" fill="${DS_MUTED}" ${textFont(type.notation)}>${escapeXml(text)}</text>`;
}

/** First knitting action sits on the lower baseline; later lines step upward. */
/** Baseline pitch so stacked notation does not touch at the shared diagram size. */
export function sidewaysNotationLinePitch(type: SidewaysPatternDiagramType): number {
  return Math.max(type.notationGap, Math.round(type.notation * 1.4));
}

function stackBottomUp(
  x: number,
  centerY: number,
  lines: readonly string[],
  role: string,
  type: SidewaysPatternDiagramType,
  anchor: "start" | "middle" | "end" = "start",
  extraAttrs = "",
): string {
  if (!lines.length) return "";
  const gap = sidewaysNotationLinePitch(type);
  const firstY = centerY + ((lines.length - 1) * gap) / 2;
  return lines
    .map((line, i) =>
      textAt(x, firstY - i * gap, line, role, type, anchor, ` data-stack-order="${i}"${extraAttrs}`),
    )
    .join("");
}

function openingPair(
  x: number,
  openingY: number,
  bindOff: string,
  castOn: string,
  role: string,
  side: string,
  type: SidewaysPatternDiagramType,
): string {
  const half = sidewaysNotationLinePitch(type) / 2;
  return [
    textAt(
      x,
      openingY + half,
      bindOff,
      role,
      type,
      "middle",
      ` data-side="${side}" data-opening-step="bind-off" data-stack-order="0"`,
    ),
    textAt(
      x,
      openingY - half,
      castOn,
      role,
      type,
      "middle",
      ` data-side="${side}" data-opening-step="cast-on" data-stack-order="1"`,
    ),
  ].join("");
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

function stackSpan(centerY: number, count: number, gap: number): { top: number; bottom: number } {
  if (count <= 0) return { top: centerY, bottom: centerY };
  const half = ((count - 1) * gap) / 2;
  return { top: centerY - half, bottom: centerY + half };
}

/**
 * Keep the later V stack above the earlier one.
 * Extra space is taken from the earlier section so the later stack stays on its
 * own portion of the piece (and off a sleeve attached above it).
 */
function separateBottomUpStacks(
  lowerCenter: number,
  lowerCount: number,
  upperCenter: number,
  upperCount: number,
  gap: number,
): { lower: number; upper: number } {
  const lower = stackSpan(lowerCenter, lowerCount, gap);
  const upper = stackSpan(upperCenter, upperCount, gap);
  const deficit = upper.bottom + gap - lower.top;
  if (deficit <= 0) return { lower: lowerCenter, upper: upperCenter };
  return { lower: lowerCenter + deficit, upper: upperCenter };
}

function vNeckCenterY(
  frame: SidewaysCardiganEditMeasurementFrame,
  which: "first" | "second",
): number {
  if (frame.garmentStyle === "pullover") {
    return which === "first"
      ? (frame.firstArmholeY + frame.firstVEndY) / 2
      : (frame.firstVEndY + frame.secondVStartY) / 2;
  }
  return which === "first"
    ? (frame.topY + frame.firstVEndY) / 2
    : (frame.secondVStartY + frame.bottomY) / 2;
}

export function buildSidewaysCardiganShapingNotationDiagramSvg(
  model: SidewaysCardiganPatternDiagramModel,
): string {
  const frame = buildSidewaysCardiganPatternDiagramFrame(model);
  const canvas = sidewaysPatternDiagramCanvas(frame);
  const type = canvas.type;
  const y = (value: number) => sidewaysKnitVisualY(frame, value);
  const { increase, decrease } = sidewaysCardiganVNeckNotationLines(model);
  const firstV = model.garmentStyle === "pullover" ? decrease : increase;
  const secondV = model.garmentStyle === "pullover" ? increase : decrease;
  const neckLabelX = frame.neckX + Math.max(12, Math.round(type.notation * 0.45));
  const edgeStitches = sidewaysDiagramEdgeStitchCount(model.calc);
  const edgeX =
    model.garmentStyle === "cardigan"
      ? (frame.hemX + frame.vCutX) / 2
      : (frame.hemX + frame.neckX) / 2;
  const startEdge = y(frame.topY);
  const endEdge = y(frame.bottomY);
  const armholeBo = formatBindOffNotation(model.calc.armholeDepthStitches);
  const armholeCo = formatCastOnNotation(model.calc.armholeDepthStitches);
  const slitX = (frame.armholeX + frame.neckX) / 2;
  const armholeSlits =
    model.garmentStyle === "pullover"
      ? [openingPair(slitX, y(frame.secondArmholeY), armholeBo, armholeCo, "jp-armhole-slit", "knitted", type)]
      : [
          openingPair(slitX, y(frame.firstArmholeY), armholeBo, armholeCo, "jp-armhole-slit", "first", type),
          openingPair(slitX, y(frame.secondArmholeY), armholeBo, armholeCo, "jp-armhole-slit", "second", type),
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
      ? "Sideways pullover shaping notation diagram knitted upward from the underarm"
      : "Sideways cardigan shaping notation diagram knitted upward from center front";
  const hold =
    model.garmentStyle === "cardigan"
      ? textAt(
          edgeX,
          startEdge - type.notationGap,
          formatHoldNotation(model.calc.vNeckDepthStitches),
          "jp-hold",
          type,
          "middle",
          ` data-knit-edge="start"`,
        )
      : "";
  const vStacks = separateBottomUpStacks(
    y(vNeckCenterY(frame, "first")),
    firstV.length,
    y(vNeckCenterY(frame, "second")),
    secondV.length,
    sidewaysNotationLinePitch(type) + Math.round(type.notation * 0.35),
  );
  const backNeckX = frame.backNeckX - Math.max(8, Math.round(type.notation * 0.35));
  const sleeveLabels =
    model.garmentStyle === "pullover" && model.sleeveCalc
      ? [
          textAt(
            (frame.sleeve.attachX + frame.sleeve.farX) / 2,
            y(frame.sleeve.attachY),
            sleeveNotation,
            "jp-sleeve",
            type,
          ),
          textAt(
            frame.sleeve.farX + type.row,
            y(frame.sleeve.attachY + type.row),
            cuffNotation,
            "jp-cuff",
            type,
            "start",
          ),
        ]
      : [];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmtNum(canvas.x)} ${fmtNum(canvas.y)} ${fmtNum(canvas.width)} ${fmtNum(canvas.height)}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${aria}" focusable="false" class="express-mbp-art sleeveless-piece-split__diagram-inline"${sidewaysCardiganPatternDiagramDataAttrs(model, "shaping-notation")}>`,
    buildSidewaysCardiganPatternSilhouetteMarkup(model),
    textAt(
      edgeX,
      startEdge + type.notationGap,
      formatCastOnNotation(edgeStitches),
      "jp-caston",
      type,
      "middle",
      ` data-knit-edge="start" data-sts="${edgeStitches}"`,
    ),
    hold,
    stackBottomUp(neckLabelX, vStacks.lower, firstV, "jp-vneck-first", type, "start", ` data-edge="neck"`),
    stackBottomUp(neckLabelX, vStacks.upper, secondV, "jp-vneck-second", type, "start", ` data-edge="neck"`),
    ...armholeSlits,
    textAt(
      backNeckX,
      y(frame.backNeckStartY) - type.notation * 0.15,
      formatBindOffNotation(model.calc.backNeckDepthStitches),
      "jp-back-neck-bo",
      type,
      "end",
      ` data-opening-step="bind-off" data-stack-order="0"`,
    ),
    textAt(
      backNeckX,
      y(frame.backNeckEndY) + type.notation * 0.15,
      formatCastOnNotation(model.calc.backNeckDepthStitches),
      "jp-back-neck-co",
      type,
      "end",
      ` data-opening-step="cast-on" data-stack-order="1"`,
    ),
    textAt(
      edgeX,
      endEdge - type.notationGap,
      formatBindOffNotation(edgeStitches),
      "jp-final-bo",
      type,
      "middle",
      ` data-knit-edge="end" data-sts="${edgeStitches}"`,
    ),
    ...sleeveLabels,
    `</svg>`,
  ].join("");
}
