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
  DS_FONT,
  DS_MUTED,
  escapeXml,
  fmtNum,
  textFont,
} from "./dropShoulderPatternDiagramSvgShared";
import {
  formatShapingNotationRcLabel,
  shapingNotationRcText,
  sidewaysGarmentRcLandmarks,
  spreadRcLabelYs,
  type ShapingNotationRcLandmark,
} from "./shapingNotationRcLandmarks";
import {
  SHAPING_NOTATION_RC_DASH,
  SHAPING_NOTATION_RC_GUIDE,
  SHAPING_NOTATION_RC_GUIDE_WIDTH,
} from "./legoBlocks/shapingNotationRcLeaders";
import {
  dropShoulderSleeveBodyRowSpans,
  formatDropShoulderSleeveWorkingNotation,
} from "./dropShoulderSleeveShapingChart";
import { compressSlopeSequence } from "./legoBlocks/slopeShaping";
import { withFittedPatternDiagramViewBox } from "./legoBlocks/patternDiagramFit";
import {
  formatRowBasedShapingNotation,
  rowBasedShapingNotation,
  type RowBasedShapingNotation,
} from "./shapingNotationCompress";
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
  sidewaysSilhouetteDiagramRect,
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

const ARMHOLE_SLIT_NOT_ROW_BASED =
  "Armhole slit is a stitch bind-off and cast-on, not a row interval.";

/** Even-row spans around the same every-other-row actions the written V-neck uses. */
export function sidewaysVNeckRowBasedNotation(
  sequence: readonly number[],
  totalRows: number,
  rowsBefore: number,
): RowBasedShapingNotation {
  const steps = compressSlopeSequence(sequence);
  const lastAction =
    sequence.length === 0 ? rowsBefore : rowsBefore + (sequence.length - 1) * 2;
  return rowBasedShapingNotation({
    rowsBefore,
    segments: steps.map((step) => ({
      stitches: step.stitches,
      intervalRows: 2,
      times: step.times,
    })),
    rowsAfter: Math.max(0, totalRows - lastAction),
    totalRows,
  });
}

function signedSectionLines(section: RowBasedShapingNotation, sign: "+" | "-"): string[] {
  const text = formatRowBasedShapingNotation(section);
  if (!text) return [];
  return text.split(" ").map((part) => {
    const shaped = /^\d+s-/.test(part);
    return shaped ? `${sign}${part}` : part;
  });
}

export function sidewaysCardiganVNeckNotationLines(
  model: SidewaysCardiganPatternDiagramModel,
): { increase: string[]; decrease: string[] } {
  const totalRows = model.calc.halfNeckRows;
  const fromSequence = (sequence: readonly number[] | undefined, sign: "+" | "-", rowsBefore: number) =>
    sequence && sequence.length > 0
      ? signedSectionLines(sidewaysVNeckRowBasedNotation(sequence, totalRows, rowsBefore), sign)
      : null;
  if (model.vNeckIncreaseSequence !== undefined && model.vNeckDecreaseSequence !== undefined) {
    return {
      increase: fromSequence(model.vNeckIncreaseSequence, "+", 2) ?? [],
      decrease: fromSequence(model.vNeckDecreaseSequence, "-", 0) ?? [],
    };
  }
  const slope = buildSidewaysVNeckSlopeSequence(
    model.calc.vNeckDepthStitches,
    model.calc.halfNeckRows,
  );
  if (!slope.ok) return { increase: [], decrease: [] };
  return {
    increase: signedSectionLines(sidewaysVNeckRowBasedNotation(slope.sequence, totalRows, 2), "+"),
    decrease: signedSectionLines(
      sidewaysVNeckRowBasedNotation([...slope.sequence].reverse(), totalRows, 0),
      "-",
    ),
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

function sidewaysRcKnitY(
  frame: SidewaysCardiganEditMeasurementFrame,
  landmark: ShapingNotationRcLandmark,
): number {
  const t = landmark.sectionPosition ?? landmark.position;
  const pullover = frame.garmentStyle === "pullover";
  const lerp = (a: number, b: number) => a + (b - a) * t;
  switch (landmark.anchor) {
    case "cast-on":
      return frame.topY;
    case "bind-off":
      return frame.bottomY;
    case "v1":
      return pullover
        ? lerp(frame.firstArmholeY, frame.firstVEndY)
        : lerp(frame.topY, frame.firstVEndY);
    case "v2":
      return pullover
        ? lerp(frame.firstVEndY, frame.secondVStartY)
        : lerp(frame.secondVStartY, frame.bottomY);
    case "armhole-1":
      return frame.firstArmholeY;
    case "armhole-2":
      return frame.secondArmholeY;
    case "neck-1":
      return frame.backNeckStartY;
    case "neck-2":
      return frame.backNeckEndY;
    default:
      return frame.topY + (frame.bottomY - frame.topY) * landmark.position;
  }
}

/** Visual point where a sideways RC meets the left body edge. */
export function sidewaysShapingRcVisualPoint(
  frame: SidewaysCardiganEditMeasurementFrame,
  landmark: ShapingNotationRcLandmark,
): { x: number; y: number } {
  return {
    x: frame.hemX,
    y: sidewaysKnitVisualY(frame, sidewaysRcKnitY(frame, landmark)),
  };
}

type PulloverRcLabel = {
  kind: string;
  text: string;
  rowCounter: number;
  actionY: number;
  outlineX: number;
  width: number;
  labelX: number;
  labelY: number;
};

/**
 * Close Pullover RC labels share a column and paint on top of each other.
 * Park a crowded label in the outer left lane on its row, and set its partner
 * in the inner lane just clear of that leader. Leaders stay on the calculated
 * row and still end on the body edge.
 */
function layoutPulloverRcLabels(
  landmarks: readonly ShapingNotationRcLandmark[],
  frame: SidewaysCardiganEditMeasurementFrame,
  fontSize: number,
  minX: number,
): PulloverRcLabel[] {
  const charW = fontSize * 0.55;
  const items: PulloverRcLabel[] = landmarks.map((landmark) => {
    const point = sidewaysShapingRcVisualPoint(frame, landmark);
    const text = formatShapingNotationRcLabel(landmark.rowCounter);
    return {
      kind: landmark.label,
      text,
      rowCounter: landmark.rowCounter,
      actionY: point.y,
      outlineX: point.x,
      width: Math.max(fontSize, text.length * charW),
      labelX: point.x,
      labelY: point.y,
    };
  });
  const labelWidth = Math.max(fontSize, ...items.map((item) => item.width));
  let gutter = Math.max(4, Math.round(fontSize * 0.35));
  let bodyGap = Math.max(4, Math.round(fontSize * 0.3));
  const laneFits = (gap: number, laneGutter: number, lane: number) =>
    frame.hemX - gap - lane * (labelWidth + laneGutter) - labelWidth >= minX;
  while (!laneFits(bodyGap, gutter, 1) && (bodyGap > 4 || gutter > 4)) {
    if (gutter > 4) gutter -= 1;
    else bodyGap -= 1;
  }
  const maxLane = laneFits(bodyGap, gutter, 1) ? 1 : 0;
  const lanePitch = labelWidth + gutter;
  const boxOf = (item: PulloverRcLabel) => ({
    left: item.labelX - item.width,
    right: item.labelX,
    top: item.labelY - fontSize * 0.85,
    bottom: item.labelY + fontSize * 0.25,
  });
  const boxesOverlap = (item: PulloverRcLabel, other: PulloverRcLabel) => {
    const a = boxOf(item);
    const b = boxOf(other);
    return a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2;
  };
  const leaderHitsLabel = (item: PulloverRcLabel, other: PulloverRcLabel) => {
    const box = boxOf(other);
    return (
      item.actionY > box.top &&
      item.actionY < box.bottom &&
      box.left < item.outlineX - 1 &&
      box.right > item.labelX + 1
    );
  };
  const placed: PulloverRcLabel[] = [];
  const ordered = [...items].sort((a, b) => a.actionY - b.actionY || a.rowCounter - b.rowCounter);
  const clearAt = (item: PulloverRcLabel) =>
    item.labelX - item.width >= minX &&
    !placed.some((other) => boxesOverlap(item, other) || leaderHitsLabel(item, other) || leaderHitsLabel(other, item));
  for (const item of ordered) {
    const crowded =
      maxLane > 0 &&
      ordered.some(
        (other) =>
          other !== item &&
          !placed.includes(other) &&
          Math.abs(other.actionY - item.actionY) < fontSize,
      );
    const laneOrder = crowded ? [maxLane, 0] : [0, maxLane];
    let best: { labelX: number; labelY: number } | null = null;
    const maxShift = fontSize * 4;
    for (let shift = 0; shift <= maxShift && !best; shift += 1) {
      const dirs = shift === 0 ? [0] : [1, -1];
      for (const dir of dirs) {
        for (const lane of laneOrder) {
          item.labelX = frame.hemX - bodyGap - lane * lanePitch;
          item.labelY = item.actionY + dir * shift;
          if (!clearAt(item)) continue;
          best = { labelX: item.labelX, labelY: item.labelY };
          break;
        }
        if (best) break;
      }
    }
    if (best) {
      item.labelX = best.labelX;
      item.labelY = best.labelY;
    } else {
      item.labelX = frame.hemX - bodyGap;
      item.labelY = item.actionY;
    }
    placed.push(item);
  }
  return placed;
}

function drawPulloverShapingRcLeaders(
  landmarks: readonly ShapingNotationRcLandmark[],
  frame: SidewaysCardiganEditMeasurementFrame,
  type: SidewaysPatternDiagramType,
  canvas: { x: number; y: number; width: number; height: number },
): string {
  const fontSize = Math.max(12, type.row);
  const placed = layoutPulloverRcLabels(landmarks, frame, fontSize, canvas.x + 2);
  return [...placed]
    .sort((a, b) => a.rowCounter - b.rowCounter)
    .map((mark) => {
      const shifted = Math.abs(mark.labelY - mark.actionY) > 0.5;
      const stem = shifted
        ? `<line data-role="rc-leader-stem" data-rc-label="${escapeXml(mark.kind)}" ` +
          `data-row-counter="${mark.rowCounter}" ` +
          `x1="${fmtNum(mark.labelX)}" y1="${fmtNum(mark.labelY)}" ` +
          `x2="${fmtNum(mark.labelX)}" y2="${fmtNum(mark.actionY)}" ` +
          `stroke="${SHAPING_NOTATION_RC_GUIDE}" stroke-width="${SHAPING_NOTATION_RC_GUIDE_WIDTH}" ` +
          `stroke-dasharray="${SHAPING_NOTATION_RC_DASH}" fill="none"/>`
        : "";
      const line =
        `<line data-role="rc-leader" data-rc-label="${escapeXml(mark.kind)}" ` +
        `data-row-counter="${mark.rowCounter}" data-action-y="${fmtNum(mark.actionY)}" ` +
        `data-outline-x="${fmtNum(mark.outlineX)}" ` +
        `x1="${fmtNum(shifted ? mark.labelX : mark.labelX + 3)}" y1="${fmtNum(mark.actionY)}" ` +
        `x2="${fmtNum(mark.outlineX)}" y2="${fmtNum(mark.actionY)}" ` +
        `stroke="${SHAPING_NOTATION_RC_GUIDE}" stroke-width="${SHAPING_NOTATION_RC_GUIDE_WIDTH}" ` +
        `stroke-dasharray="${SHAPING_NOTATION_RC_DASH}" fill="none"/>`;
      const text =
        `<text data-role="rc-landmark" data-stack-order="rc" data-rc-label="${escapeXml(mark.kind)}" ` +
        `data-rc="${escapeXml(mark.text)}" data-row-counter="${mark.rowCounter}" ` +
        `x="${fmtNum(mark.labelX)}" y="${fmtNum(mark.labelY)}" ` +
        `text-anchor="end" dominant-baseline="middle" fill="${DS_MUTED}" ` +
        `font-family="${DS_FONT}" font-size="${fontSize}">${escapeXml(mark.text)}</text>`;
      return stem + line + text;
    })
    .join("");
}

function drawSidewaysGarmentRcLandmarks(
  model: SidewaysCardiganPatternDiagramModel,
  frame: SidewaysCardiganEditMeasurementFrame,
  type: SidewaysPatternDiagramType,
  labelX: number,
  canvas: { x: number; y: number; width: number; height: number },
): string {
  const slope = buildSidewaysVNeckSlopeSequence(
    model.calc.vNeckDepthStitches,
    model.calc.halfNeckRows,
  );
  const increase =
    model.vNeckIncreaseSequence ??
    (slope.ok ? slope.sequence : []);
  const decrease =
    model.vNeckDecreaseSequence ??
    (slope.ok ? [...slope.sequence].reverse() : []);
  if (increase.length === 0 && decrease.length === 0) return "";
  const landmarks = sidewaysGarmentRcLandmarks({
    garmentStyle: model.garmentStyle,
    calc: model.calc,
    increaseSequence: increase,
    decreaseSequence: decrease,
  });
  if (model.garmentStyle === "pullover") {
    return drawPulloverShapingRcLeaders(landmarks, frame, type, canvas);
  }
  const visual = landmarks.map((landmark) =>
    sidewaysKnitVisualY(frame, sidewaysRcKnitY(frame, landmark)),
  );
  const order = visual.map((y, index) => ({ y, index })).sort((a, b) => a.y - b.y);
  const spread = spreadRcLabelYs(order.map((item) => item.y), Math.round(type.row * 1.15));
  const ys = visual.slice();
  order.forEach((item, spreadIndex) => {
    ys[item.index] = spread[spreadIndex]!;
  });
  return landmarks
    .map((landmark, index) =>
      shapingNotationRcText({
        landmark,
        x: labelX,
        y: Math.min(canvas.y + canvas.height - type.row, Math.max(canvas.y + type.row, ys[index]!)),
        size: type.row,
        anchor: "end",
        fill: DS_MUTED,
        font: DS_FONT,
        escape: escapeXml,
        formatNumber: fmtNum,
      }),
    )
    .join("");
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
  const sleeveChart = model.sleeveCalc
    ? {
        topSts: model.sleeveCalc.topSts,
        wristSts: model.sleeveCalc.wristSts,
        cuffRows: model.sleeveCalc.cuffRows,
        sleeveBodyRows: model.sleeveCalc.sleeveBodyRows,
        sleeveTotalRows: model.sleeveCalc.sleeveTotalRows,
        direction: model.sleeveCalc.direction,
      }
    : null;
  const sleeveSpans = sleeveChart ? dropShoulderSleeveBodyRowSpans(sleeveChart) : null;
  const sleeveWorking =
    sleeveChart && sleevePlan && !sleevePlan.noShaping
      ? formatDropShoulderSleeveWorkingNotation(sleeveChart, { includeRowSpans: true })
      : "";
  const sleeveNotation = sleeveWorking
    ? sleeveWorking
        .split(" ")
        .map((part) => (/^\d+s-/.test(part) ? `${sleevePlan?.shapingDirection === "decrease" ? "-" : "+"}${part}` : part))
        .join(" ")
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
  const clampY = (y: number) => {
    const min = canvas.y + type.notation;
    const max = canvas.y + canvas.height - type.notation;
    return Math.min(max, Math.max(min, y));
  };
  const hold =
    model.garmentStyle === "cardigan"
      ? textAt(
          edgeX,
          clampY(startEdge - type.notationGap),
          formatHoldNotation(model.calc.vNeckDepthStitches),
          "jp-hold",
          type,
          "middle",
          ` data-knit-edge="start"`,
        )
      : "";
  const notationPitch = sidewaysNotationLinePitch(type) + Math.round(type.notation * 0.35);
  const vStacks = separateBottomUpStacks(
    y(vNeckCenterY(frame, "first")),
    firstV.length,
    y(vNeckCenterY(frame, "second")),
    secondV.length,
    notationPitch,
  );
  if (model.garmentStyle === "pullover" && model.sleeveCalc) {
    const sleeveY = y(frame.sleeve.attachY);
    const firstSpan = stackSpan(vStacks.lower, firstV.length, notationPitch);
    const secondSpan = stackSpan(vStacks.upper, secondV.length, notationPitch);
    const overlapsSleeve =
      sleeveY <= Math.max(firstSpan.bottom, secondSpan.bottom) &&
      sleeveY >= Math.min(firstSpan.top, secondSpan.top) - notationPitch;
    if (overlapsSleeve) {
      const shift = sleeveY + notationPitch - Math.min(firstSpan.top, secondSpan.top);
      vStacks.lower += shift;
      vStacks.upper += shift;
    }
  }
  const backNeckX = frame.backNeckX - Math.max(8, Math.round(type.notation * 0.35));
  const sleeveLabels =
    model.garmentStyle === "pullover" && model.sleeveCalc
      ? [
          ...sleeveNotation.split(" ").filter(Boolean).map((part, index) =>
            textAt(
              frame.sleeve.farX + type.row * 0.35,
              y(frame.sleeve.attachY) - index * sidewaysNotationLinePitch(type),
              part,
              "jp-sleeve",
              type,
              "start",
              ` data-stack-order="${index}"${
                sleeveSpans
                  ? ` data-rows-before="${sleeveSpans.rowsBeforeShaping}" data-rows-after="${sleeveSpans.rowsAfterShaping}"`
                  : ""
              }`,
            ),
          ),
          textAt(
            frame.sleeve.farX + type.row * 0.35,
            stackSpan(vStacks.lower, firstV.length, notationPitch).bottom + sidewaysNotationLinePitch(type),
            cuffNotation,
            "jp-cuff",
            type,
            "start",
          ),
        ]
      : [];
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmtNum(canvas.x)} ${fmtNum(canvas.y)} ${fmtNum(canvas.width)} ${fmtNum(canvas.height)}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${aria}" focusable="false" class="express-mbp-art sleeveless-piece-split__diagram-inline" data-not-row-based-reason="${escapeXml(ARMHOLE_SLIT_NOT_ROW_BASED)}" data-vneck-rows="${model.calc.halfNeckRows}"${sidewaysCardiganPatternDiagramDataAttrs(model, "shaping-notation")}>`,
    buildSidewaysCardiganPatternSilhouetteMarkup(model, type.note),
    textAt(
      edgeX,
      clampY(startEdge + type.notationGap),
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
      clampY(endEdge - type.notationGap),
      formatBindOffNotation(edgeStitches),
      "jp-final-bo",
      type,
      "middle",
      ` data-knit-edge="end" data-sts="${edgeStitches}"`,
    ),
    ...sleeveLabels,
    drawSidewaysGarmentRcLandmarks(model, frame, type, Math.max(canvas.x + type.row * 4, frame.hemX - 8), canvas),
    `</svg>`,
  ].join("");
  return withFittedPatternDiagramViewBox(svg, sidewaysSilhouetteDiagramRect(frame));
}
