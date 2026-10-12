/**
 * Set-in sleeve diagrams from the cuff-up sleeve piece and the calculated cap.
 *
 * Stitches & Rows uses the Drop Shoulder dimension-line presentation.
 * Shaping Notation places the same cuff-up schedule from the wrist upward.
 * Widths, row spans, and notation text come from those results. This module
 * does not size the sleeve or change the written instructions.
 *
 * The outline uses one scale for width and height, taken from the finished
 * inches: cuff depth, cuff-to-upper-arm body (sleeve length minus cuff), and
 * sleeve-cap height. Labels sit outside that shape.
 */

import type { DropShoulderSleevePieceNumbers } from "../dropShoulderSleevePieceNumbers";
import {
  dropShoulderSleeveBodyRowSpans,
  dropShoulderSleeveShapingRcSequence,
} from "../dropShoulderSleeveShapingChart";
import {
  dropShoulderSleeveShapingPlan,
  dropShoulderSleeveShapingVerb,
  formatDropShoulderSleeveShapingNotation,
} from "../dropShoulderSleeveShaping";
import type { DropShoulderSleeveDiagramFrame } from "../dropShoulderSleeveDiagramSvgShared";
import {
  DS_ARROW,
  DS_BODY_MAX_W,
  DS_FILL,
  DS_FONT,
  DS_FS_TITLE,
  DS_FW_TITLE,
  DS_MUTED,
  DS_PAD_BOTTOM,
  DS_PAD_LEFT,
  DS_PAD_TOP,
  DS_STROKE,
  DS_VB_W,
  endCap,
  escapeXml,
  fmtNum,
  textFont,
  wrapGeneratedDiagramSvg,
} from "../dropShoulderPatternDiagramSvgShared";
import {
  DS_FS_NOTATION,
  DS_FS_RC,
  dropShoulderNotationFontFace,
} from "../dropShoulderShapingNotationDiagramShared";

/** Same-side notation needs this much baseline room. Extra columns sit outside the sleeve. */
const NOTATION_GAP = DS_FS_NOTATION + 7;
import {
  placeShapingNotationRcLandmarks,
  renderShapingNotationRcLeaders,
  type PlacedShapingNotationRcLeader,
  type ShapingNotationRcLeaderBox,
  type ShapingNotationRcLeaderLandmark,
} from "../legoBlocks/shapingNotationRcLeaders";
import {
  formatPatternDiagramMeasurement,
  formatStitchesRowsDiagramLabel,
  stitchesRowsLabelMarkup,
} from "../patternStitchesRowsDiagramLabel";
import type { MeasurementDisplayUnit } from "../patternMeasurementDisplayUnit";
import { formatShapingSegment } from "../shapingNotationCompress";
import { formatShapingNotationRcLabel } from "../shapingNotationRcLandmarks";
import {
  layoutSleeveShapingNotationLabels,
  type SleeveNotationLabel,
} from "../sleeveShapingNotationLayout";
import type { SetInSleeveCapSuccess, SleeveCapPhase } from "./sleeveCapMath";

export type SetInSleeveCapNotationEvent = {
  text: string;
  kind: SleeveCapPhase["kind"];
  /** each-edge: one label on the left and one on the right. both-edges: one shared label. */
  placement: "each-edge" | "both-edges" | "right" | "center";
  rowCenter: number;
};

export type SetInSleeveDiagramModel = {
  unit: MeasurementDisplayUnit;
  wristStitches: number;
  upperArmStitches: number;
  topStitches: number;
  cuffRows: number;
  sleeveBodyRows: number;
  capRows: number;
  capHeightInches: number;
  upperArmInches: number;
  /** Finished inches that set the outline. Body length excludes the cuff. */
  wristInches: number;
  topWidthInches: number;
  cuffDepthInches: number;
  sleeveBodyInches: number;
  wristWidthLabel: string;
  upperArmWidthLabel: string;
  topWidthLabel: string;
  cuffDepthLabel: string;
  sleeveBodyLengthLabel: string;
  capHeightLabel: string;
  shapingDirection: "increase" | "decrease";
  bodyShapingNotation: string;
  bodyShapingSteps: { stitches: number; rows: number; times: number }[];
  rowsBeforeShaping: number;
  rowsAfterShaping: number;
  capNotationLines: string[];
  capEvents: SetInSleeveCapNotationEvent[];
  /** Sleeve-body row counter readings for the cuff-up increases or decreases. */
  bodyShapingRcs: number[];
  /** Rows from the start of the cap to each width change, including the start. */
  capMarks: { rowsFromCapStart: number; stitches: number }[];
};

const LABEL_COUNT = 17;
const LABEL_MEASURE = 14;

function bindOffToken(stitches: number): string {
  const n = Math.max(0, Math.round(stitches));
  return n > 0 ? `bo${n}` : "";
}

function rowToken(rows: number): string {
  const n = Math.max(0, Math.round(rows));
  return n > 0 ? `${n}r` : "";
}

function storedInches(n: number | undefined): number | undefined {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
}

function sleeveBodyLengthInches(
  sleeveLengthInches: number | undefined,
  cuffDepthInches: number | undefined,
): number | undefined {
  const length = storedInches(sleeveLengthInches);
  const cuff = storedInches(cuffDepthInches);
  if (length === undefined || cuff === undefined) return undefined;
  const body = length - cuff;
  return body > 0 ? body : undefined;
}

/**
 * Cap notation in the order the cuff-up sleeve is knitted.
 * The first event is the underarm bind-off. The last is the top bind-off.
 */
export function setInSleeveCapNotationEvents(cap: SetInSleeveCapSuccess): SetInSleeveCapNotationEvent[] {
  const events: SetInSleeveCapNotationEvent[] = [];
  let rows = 0;
  for (const phase of cap.phases) {
    if (phase.kind === "underarm-bind-off" || phase.kind === "stair-step-bind-off") {
      const text = bindOffToken(phase.stitchesEachSide);
      if (text) {
        events.push({
          text,
          kind: phase.kind,
          placement: "each-edge",
          rowCenter: rows + phase.rows / 2,
        });
      }
      rows += phase.rows;
      continue;
    }
    if (phase.kind === "decrease-zone") {
      const phaseStart = rows;
      let cursor = phaseStart;
      for (const step of phase.steps) {
        if (step.stitchesEachSide <= 0 || step.everyRows <= 0 || step.times <= 0) continue;
        const stepRows = step.everyRows * step.times;
        events.push({
          text: formatShapingSegment(step.stitchesEachSide, step.everyRows, step.times),
          kind: phase.kind,
          placement: "both-edges",
          rowCenter: cursor + stepRows / 2,
        });
        cursor += stepRows;
      }
      rows = phaseStart + phase.rows;
      continue;
    }
    if (phase.kind === "upper-slope") {
      const phaseStart = rows;
      let cursor = phaseStart;
      for (const step of phase.steps) {
        const text = bindOffToken(step.stitchesEachSide);
        if (text) {
          events.push({
            text,
            kind: phase.kind,
            placement: "each-edge",
            rowCenter: cursor + step.rows / 2,
          });
        }
        cursor += step.rows;
      }
      const plain = rowToken(phase.plainRows);
      if (plain) {
        events.push({
          text: plain,
          kind: phase.kind,
          placement: "right",
          rowCenter: cursor + phase.plainRows / 2,
        });
      }
      rows = phaseStart + phase.rows;
      continue;
    }
    const text = bindOffToken(phase.stitches);
    if (text) {
      events.push({
        text,
        kind: phase.kind,
        placement: "center",
        rowCenter: rows,
      });
    }
  }
  return events;
}

export function setInSleeveCapNotationLines(cap: SetInSleeveCapSuccess): string[] {
  return setInSleeveCapNotationEvents(cap).map((event) => event.text);
}

/**
 * Cap outline in knitting order. Bind-offs step in at the current row, then
 * rise. Decrease zones slope across their stored steps. The last point is the
 * final top width.
 */
export function setInSleeveCapOutlineMarks(
  cap: SetInSleeveCapSuccess,
): { rowsFromCapStart: number; stitches: number }[] {
  const marks = [{ rowsFromCapStart: 0, stitches: cap.sleeve.upperArmStitches }];
  let rows = 0;
  let stitches = cap.sleeve.upperArmStitches;
  const inset = (nextStitches: number) => {
    if (nextStitches === stitches) return;
    stitches = nextStitches;
    marks.push({ rowsFromCapStart: rows, stitches });
  };
  const rise = (nextRows: number) => {
    if (nextRows === rows) return;
    rows = nextRows;
    marks.push({ rowsFromCapStart: rows, stitches });
  };
  const slope = (nextRows: number, nextStitches: number) => {
    if (nextRows === rows && nextStitches === stitches) return;
    rows = nextRows;
    stitches = nextStitches;
    marks.push({ rowsFromCapStart: rows, stitches });
  };
  for (const phase of cap.phases) {
    if (phase.kind === "top-bind-off") {
      inset(phase.stitches);
      continue;
    }
    if (phase.kind === "underarm-bind-off" || phase.kind === "stair-step-bind-off") {
      inset(phase.stitchesAfter);
      rise(rows + phase.rows);
      continue;
    }
    if (phase.kind === "decrease-zone") {
      const steps = subdividedPhase(phase, stitches);
      const stepRows = steps.reduce((sum, step) => sum + step.rows, 0);
      const endStitches = steps.length > 0 ? steps[steps.length - 1]!.stitches : stitches;
      if (steps.length > 0 && stepRows === phase.rows && endStitches === phase.stitchesAfter) {
        for (const step of steps) slope(rows + step.rows, step.stitches);
        continue;
      }
      slope(rows + phase.rows, phase.stitchesAfter);
      continue;
    }
    const steps = subdividedPhase(phase, stitches);
    const stepRows = steps.reduce((sum, step) => sum + step.rows, 0);
    const endStitches = steps.length > 0 ? steps[steps.length - 1]!.stitches : stitches;
    if (steps.length > 0 && stepRows === phase.rows && endStitches === phase.stitchesAfter) {
      for (const step of phase.steps) {
        inset(stitches - 2 * step.stitchesEachSide);
        rise(rows + step.rows);
      }
      rise(rows + phase.plainRows);
      continue;
    }
    slope(rows + phase.rows, phase.stitchesAfter);
  }
  return marks;
}

function subdividedPhase(
  phase: Exclude<SleeveCapPhase, { kind: "top-bind-off" }>,
  stitches: number,
): { rows: number; stitches: number }[] {
  if (phase.kind === "underarm-bind-off" || phase.kind === "stair-step-bind-off") {
    return [{ rows: phase.rows, stitches: phase.stitchesAfter }];
  }
  if (phase.kind === "decrease-zone") {
    const steps: { rows: number; stitches: number }[] = [];
    let cursor = stitches;
    for (const step of phase.steps) {
      cursor -= 2 * step.stitchesEachSide * step.times;
      steps.push({ rows: step.everyRows * step.times, stitches: cursor });
    }
    return steps;
  }
  const steps: { rows: number; stitches: number }[] = [];
  let cursor = stitches;
  for (const step of phase.steps) {
    cursor -= 2 * step.stitchesEachSide;
    steps.push({ rows: step.rows, stitches: cursor });
  }
  if (phase.plainRows > 0) steps.push({ rows: phase.plainRows, stitches: cursor });
  return steps;
}

export function buildSetInSleeveDiagramModel(input: {
  sleevePiece: DropShoulderSleevePieceNumbers | null | undefined;
  sleeveCap: SetInSleeveCapSuccess | null | undefined;
  unit?: MeasurementDisplayUnit;
  wristInches?: number;
  cuffDepthInches?: number;
  sleeveLengthInches?: number;
}): SetInSleeveDiagramModel | null {
  const piece = input.sleevePiece;
  const cap = input.sleeveCap;
  if (!piece || !cap) return null;
  if (piece.wristSts <= 0 || piece.topSts <= 0 || piece.cuffRows < 0 || piece.sleeveBodyRows <= 0) {
    return null;
  }
  const unit: MeasurementDisplayUnit = input.unit === "cm" ? "cm" : "in";
  const plan = dropShoulderSleeveShapingPlan({
    topSts: piece.topSts,
    wristSts: piece.wristSts,
    sleeveBodyRows: piece.sleeveBodyRows,
  });
  const chartInput = {
    topSts: piece.topSts,
    wristSts: piece.wristSts,
    cuffRows: piece.cuffRows,
    sleeveBodyRows: piece.sleeveBodyRows,
    sleeveTotalRows: piece.sleeveTotalRows,
    direction: "cuff-up" as const,
  };
  const spans = dropShoulderSleeveBodyRowSpans(chartInput);
  const steps = plan.steps
    .filter((step) => step.times > 0 && step.rows > 0)
    .map((step) => ({ stitches: step.sts, rows: step.rows, times: step.times }));
  const upperArmInches = storedInches(cap.sleeve.finishedUpperArmInches) ?? 1;
  const capHeightInches = storedInches(cap.totals.capHeightInches) ?? 1;
  const stitchesPerInch = piece.topSts / upperArmInches;
  const rowsPerInch = cap.totals.capRows / capHeightInches;
  const wristInches = storedInches(input.wristInches) ?? piece.wristSts / stitchesPerInch;
  const cuffDepthInches =
    storedInches(input.cuffDepthInches) ?? (rowsPerInch > 0 ? piece.cuffRows / rowsPerInch : 0);
  const bodyInches =
    sleeveBodyLengthInches(input.sleeveLengthInches, cuffDepthInches) ??
    (rowsPerInch > 0 ? piece.sleeveBodyRows / rowsPerInch : 1);
  const topWidthInches =
    storedInches(cap.totals.finalWidthInches) ?? cap.totals.finalStitches / stitchesPerInch;
  return {
    unit,
    wristStitches: piece.wristSts,
    upperArmStitches: piece.topSts,
    topStitches: cap.totals.finalStitches,
    cuffRows: piece.cuffRows,
    sleeveBodyRows: piece.sleeveBodyRows,
    capRows: cap.totals.capRows,
    capHeightInches,
    upperArmInches,
    wristInches,
    topWidthInches,
    cuffDepthInches,
    sleeveBodyInches: bodyInches,
    wristWidthLabel: formatStitchesRowsDiagramLabel(
      piece.wristSts,
      "sts",
      formatPatternDiagramMeasurement(wristInches, unit),
    ),
    upperArmWidthLabel: formatStitchesRowsDiagramLabel(
      piece.topSts,
      "sts",
      formatPatternDiagramMeasurement(cap.sleeve.finishedUpperArmInches, unit),
    ),
    topWidthLabel: formatStitchesRowsDiagramLabel(
      cap.totals.finalStitches,
      "sts",
      formatPatternDiagramMeasurement(cap.totals.finalWidthInches, unit),
    ),
    cuffDepthLabel: formatStitchesRowsDiagramLabel(
      piece.cuffRows,
      "rows",
      formatPatternDiagramMeasurement(cuffDepthInches, unit),
    ),
    sleeveBodyLengthLabel: formatStitchesRowsDiagramLabel(
      piece.sleeveBodyRows,
      "rows",
      formatPatternDiagramMeasurement(bodyInches, unit),
    ),
    capHeightLabel: formatStitchesRowsDiagramLabel(
      cap.totals.capRows,
      "rows",
      formatPatternDiagramMeasurement(cap.totals.capHeightInches, unit),
    ),
    shapingDirection: dropShoulderSleeveShapingVerb("cuff-up", piece.topSts, piece.wristSts),
    bodyShapingNotation: formatDropShoulderSleeveShapingNotation(plan.steps),
    bodyShapingSteps: steps,
    rowsBeforeShaping: spans.rowsBeforeShaping,
    rowsAfterShaping: spans.rowsAfterShaping,
    capNotationLines: setInSleeveCapNotationLines(cap),
    capEvents: setInSleeveCapNotationEvents(cap),
    bodyShapingRcs: dropShoulderSleeveShapingRcSequence(chartInput),
    capMarks: setInSleeveCapOutlineMarks(cap),
  };
}

type Pt = { x: number; y: number };

type SleeveFrame = {
  canvasHeight: number;
  midX: number;
  wristY: number;
  cuffJoinY: number;
  capStartY: number;
  capTopY: number;
  wristLeft: number;
  wristRight: number;
  upperLeft: number;
  upperRight: number;
  topLeft: number;
  topRight: number;
  /** Cap edge from the underarm upward, including bind-off steps and decrease slopes. */
  capEdge: { y: number; left: number; right: number }[];
};

/**
 * One pixel scale for every finished inch. The upper arm fills the drawing
 * column; cuff, body, and cap then take their own inch heights. Sleeve length
 * is the cuff plus the body, so the cuff is not added again.
 */
function sleeveScale(model: SetInSleeveDiagramModel, padTop = DS_PAD_TOP): {
  pxPerInch: number;
  cuffH: number;
  bodyH: number;
  capH: number;
  height: number;
} {
  const pxPerInch = DS_BODY_MAX_W / Math.max(model.upperArmInches, 0.25);
  const cuffH = Math.max(0, model.cuffDepthInches) * pxPerInch;
  const bodyH = Math.max(model.sleeveBodyInches, 0.25) * pxPerInch;
  const capH = Math.max(model.capHeightInches, 0.25) * pxPerInch;
  const height = Math.ceil(padTop + capH + bodyH + cuffH + DS_PAD_BOTTOM);
  return { pxPerInch, cuffH, bodyH, capH, height };
}

/** Width between the upper arm and the top of the cap, in finished inches. */
function widthInchesForStitches(model: SetInSleeveDiagramModel, stitches: number): number {
  const span = model.upperArmStitches - model.topStitches;
  if (Math.abs(span) < 0.001) return model.topWidthInches;
  const t = (model.upperArmStitches - stitches) / span;
  const clamped = Math.max(0, Math.min(1, t));
  return model.upperArmInches + (model.topWidthInches - model.upperArmInches) * clamped;
}

function buildSleeveFrame(model: SetInSleeveDiagramModel, padTop = DS_PAD_TOP): SleeveFrame {
  const midX = DS_PAD_LEFT + DS_BODY_MAX_W / 2;
  const scale = sleeveScale(model, padTop);
  const { cuffH, bodyH, capH, pxPerInch } = scale;
  const wristY = scale.height - DS_PAD_BOTTOM;
  const wristW = model.wristInches * pxPerInch;
  const upperW = model.upperArmInches * pxPerInch;
  const topW = model.topWidthInches * pxPerInch;
  const capStartY = wristY - cuffH - bodyH;
  const capTopY = capStartY - capH;
  const capRows = Math.max(1, model.capRows);
  const capEdge = model.capMarks.map((mark) => {
    const rowsUp = Math.max(0, Math.min(capRows, mark.rowsFromCapStart));
    const width = widthInchesForStitches(model, mark.stitches) * pxPerInch;
    return {
      y: capStartY - (rowsUp / capRows) * capH,
      left: midX - width / 2,
      right: midX + width / 2,
    };
  });
  return {
    midX,
    wristY,
    cuffJoinY: wristY - cuffH,
    capStartY,
    capTopY,
    wristLeft: midX - wristW / 2,
    wristRight: midX + wristW / 2,
    upperLeft: midX - upperW / 2,
    upperRight: midX + upperW / 2,
    topLeft: midX - topW / 2,
    topRight: midX + topW / 2,
    capEdge,
    canvasHeight: scale.height,
  };
}

/** Cuff, tapered body, and the calculated cap. No shaping tokens. */
function sleeveOutlinePath(frame: SleeveFrame): string {
  const edge = frame.capEdge.length > 0 ? frame.capEdge : [{
    y: frame.capStartY,
    left: frame.upperLeft,
    right: frame.upperRight,
  }, {
    y: frame.capTopY,
    left: frame.topLeft,
    right: frame.topRight,
  }];
  const pts: Pt[] = [
    { x: frame.wristLeft, y: frame.wristY },
    { x: frame.wristRight, y: frame.wristY },
    { x: frame.wristRight, y: frame.cuffJoinY },
    ...edge.map((point) => ({ x: point.right, y: point.y })),
    ...[...edge].reverse().map((point) => ({ x: point.left, y: point.y })),
    { x: frame.wristLeft, y: frame.cuffJoinY },
  ];
  return `${pts
    .map((point, index) => `${index === 0 ? "M" : "L"} ${fmtNum(point.x)} ${fmtNum(point.y)}`)
    .join(" ")} Z`;
}

function sideX(frame: SleeveFrame, y: number, side: "left" | "right"): number {
  const pick = (left: number, right: number) => (side === "left" ? left : right);
  const cuffTop = Math.min(frame.wristY, frame.cuffJoinY);
  const cuffBottom = Math.max(frame.wristY, frame.cuffJoinY);
  if (y >= cuffTop - 0.01 && y <= cuffBottom + 0.01) return pick(frame.wristLeft, frame.wristRight);
  if (y <= frame.cuffJoinY + 0.01 && y >= frame.capStartY - 0.01) {
    const span = frame.cuffJoinY - frame.capStartY || 1;
    const t = Math.max(0, Math.min(1, (frame.cuffJoinY - y) / span));
    return pick(
      frame.wristLeft + (frame.upperLeft - frame.wristLeft) * t,
      frame.wristRight + (frame.upperRight - frame.wristRight) * t,
    );
  }
  return capEdgeX(frame, y, side);
}

function capEdgeX(frame: SleeveFrame, y: number, side: "left" | "right"): number {
  const edge = frame.capEdge;
  if (edge.length === 0) return side === "left" ? frame.topLeft : frame.topRight;
  const xOf = (point: { left: number; right: number }) => (side === "left" ? point.left : point.right);
  const outermost = (a: number, b: number) => (side === "right" ? Math.max(a, b) : Math.min(a, b));
  if (y >= edge[0]!.y) return xOf(edge[0]!);
  const last = edge[edge.length - 1]!;
  if (y <= last.y) return xOf(last);
  for (let index = 0; index < edge.length - 1; index += 1) {
    const start = edge[index]!;
    const end = edge[index + 1]!;
    const high = Math.max(start.y, end.y);
    const low = Math.min(start.y, end.y);
    if (y > high + 0.01 || y < low - 0.01) continue;
    if (Math.abs(start.y - end.y) < 0.01) return outermost(xOf(start), xOf(end));
    const t = (high - y) / (high - low);
    const highPoint = start.y >= end.y ? start : end;
    const lowPoint = start.y >= end.y ? end : start;
    return xOf(highPoint) + (xOf(lowPoint) - xOf(highPoint)) * t;
  }
  return xOf(last);
}

function bodyNotationFrame(frame: SleeveFrame): DropShoulderSleeveDiagramFrame {
  return {
    direction: "cuff-up",
    midX: frame.midX,
    top: frame.capTopY,
    bottom: frame.wristY,
    cuffJoinY: frame.cuffJoinY,
    wristY: frame.wristY,
    upperArmY: frame.capStartY,
    wristLeft: frame.wristLeft,
    wristRight: frame.wristRight,
    upperLeft: frame.upperLeft,
    upperRight: frame.upperRight,
    cuffJoinLeft: frame.wristLeft,
    cuffJoinRight: frame.wristRight,
  };
}

function countMeasure(
  label: string,
  x: number,
  y: number,
  anchor: "start" | "middle" | "end",
  extra = "",
  transform?: string,
): string {
  return stitchesRowsLabelMarkup({
    label,
    x,
    y,
    anchor,
    fill: DS_MUTED,
    countSize: LABEL_COUNT,
    measureSize: LABEL_MEASURE,
    fontFamily: DS_FONT,
    extra,
    transform,
    fmt: fmtNum,
  });
}

function horizontalWidth(
  left: number,
  right: number,
  y: number,
  labelY: number,
  label: string,
  role: string,
): string {
  if (!label) return "";
  return [
    `<g class="set-in-sleeve-diagram__${role}" data-${role}="true">`,
    `<line x1="${fmtNum(left)}" y1="${fmtNum(y)}" x2="${fmtNum(right)}" y2="${fmtNum(y)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>`,
    endCap(left, y, false),
    endCap(right, y, false),
    countMeasure(label, (left + right) / 2, labelY, "middle"),
    `</g>`,
  ].join("");
}

function verticalLength(
  x: number,
  y1: number,
  y2: number,
  label: string,
  role: string,
  labelSide: "left" | "right",
): string {
  if (!label) return "";
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  const midY = (top + bottom) / 2;
  const height = bottom - top;
  const dir = labelSide === "right" ? 1 : -1;
  const labelX = x + dir * 12;
  const horizontal = height < 78;
  const labelMarkup = horizontal
    ? countMeasure(label, x + dir * 8, midY + 4, labelSide === "right" ? "start" : "end")
    : countMeasure(label, 0, 0, "middle", "", `translate(${fmtNum(labelX)} ${fmtNum(midY)}) rotate(-90)`);
  return [
    `<g class="set-in-sleeve-diagram__${role}" data-${role}="true">`,
    `<line x1="${fmtNum(x)}" y1="${fmtNum(top)}" x2="${fmtNum(x)}" y2="${fmtNum(bottom)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>`,
    endCap(x, top, true),
    endCap(x, bottom, true),
    labelMarkup,
    `</g>`,
  ].join("");
}

function drawOverview(frame: SleeveFrame): string {
  const bodyH = frame.cuffJoinY - frame.capStartY;
  const titleY = bodyH >= 70 ? frame.capStartY + bodyH * 0.58 : (frame.cuffJoinY + frame.wristY) / 2;
  return [
    `<path class="ds-sleeve-diagram__body" data-role="sleeve-outline" d="${sleeveOutlinePath(frame)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.75" stroke-linejoin="round"/>`,
    `<line data-role="cuff-join" x1="${fmtNum(frame.wristLeft)}" y1="${fmtNum(frame.cuffJoinY)}" x2="${fmtNum(frame.wristRight)}" y2="${fmtNum(frame.cuffJoinY)}" stroke="${DS_STROKE}" stroke-width="1.1" fill="none"/>`,
    `<line data-role="cap-start" x1="${fmtNum(frame.upperLeft)}" y1="${fmtNum(frame.capStartY)}" x2="${fmtNum(frame.upperRight)}" y2="${fmtNum(frame.capStartY)}" stroke="${DS_STROKE}" stroke-width="1.1" fill="none"/>`,
    `<text data-role="sleeve-piece-label" x="${fmtNum(frame.midX)}" y="${fmtNum(titleY)}" text-anchor="middle" dominant-baseline="middle" fill="${DS_STROKE}" ${textFont(DS_FS_TITLE, DS_FW_TITLE)}>SLEEVE</text>`,
  ].join("");
}

function drawStitchesRowsDimensions(frame: SleeveFrame, model: SetInSleeveDiagramModel): string {
  const wristLineY = frame.wristY + 20;
  const topLineY = frame.capTopY - 18;
  const bodyH = frame.cuffJoinY - frame.capStartY;
  const upperLineY = frame.capStartY + Math.min(22, Math.max(8, bodyH * 0.18));
  const lengthX = frame.upperRight + 18;
  return [
    horizontalWidth(frame.wristLeft, frame.wristRight, wristLineY, wristLineY + 16, model.wristWidthLabel, "wrist-width"),
    horizontalWidth(frame.topLeft, frame.topRight, topLineY, topLineY - 22, model.topWidthLabel, "cap-top-width"),
    `<g class="set-in-sleeve-diagram__upper-arm-width" data-upper-arm-width="true">`,
    `<line x1="${fmtNum(frame.upperLeft)}" y1="${fmtNum(frame.capStartY)}" x2="${fmtNum(frame.upperLeft)}" y2="${fmtNum(upperLineY)}" stroke="${DS_ARROW}" stroke-width="1" opacity="0.7" fill="none"/>`,
    `<line x1="${fmtNum(frame.upperRight)}" y1="${fmtNum(frame.capStartY)}" x2="${fmtNum(frame.upperRight)}" y2="${fmtNum(upperLineY)}" stroke="${DS_ARROW}" stroke-width="1" opacity="0.7" fill="none"/>`,
    `<line x1="${fmtNum(frame.upperLeft)}" y1="${fmtNum(upperLineY)}" x2="${fmtNum(frame.upperRight)}" y2="${fmtNum(upperLineY)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>`,
    endCap(frame.upperLeft, upperLineY, false),
    endCap(frame.upperRight, upperLineY, false),
    countMeasure(model.upperArmWidthLabel, frame.midX, upperLineY + 16, "middle"),
    `</g>`,
    verticalLength(lengthX, frame.capTopY, frame.capStartY, model.capHeightLabel, "cap-height", "right"),
    verticalLength(lengthX, frame.capStartY, frame.cuffJoinY, model.sleeveBodyLengthLabel, "sleeve-body-length", "right"),
    verticalLength(lengthX, frame.cuffJoinY, frame.wristY, model.cuffDepthLabel, "cuff-depth", "right"),
  ].join("");
}

function sectionRcMarks(
  model: SetInSleeveDiagramModel,
  frame: SleeveFrame,
  includeShaping: boolean,
): ShapingNotationRcLeaderLandmark[] {
  const marks: ShapingNotationRcLeaderLandmark[] = [
    {
      id: "cast-on",
      kind: "cast-on",
      text: formatShapingNotationRcLabel(0),
      actionY: frame.wristY,
      outlineX: sideX(frame, frame.wristY, "left"),
      priority: 0,
      rowCounter: 0,
    },
  ];
  if (model.cuffRows > 0) {
    marks.push({
      id: "cuff-reset",
      kind: "cuff-reset",
      text: `↺ ${formatShapingNotationRcLabel(0)}`,
      actionY: frame.cuffJoinY,
      outlineX: sideX(frame, frame.cuffJoinY, "left"),
      priority: 1,
      rowCounter: 0,
    });
  }
  if (includeShaping) {
    let index = 0;
    model.bodyShapingSteps.forEach((step, stepIndex) => {
      const rc = model.bodyShapingRcs[index];
      index += step.times;
      if (rc === undefined || rc <= 0 || rc >= model.sleeveBodyRows) return;
      marks.push({
        id: stepIndex === 0 ? "first-shaping" : `schedule-${stepIndex}`,
        kind: stepIndex === 0 ? "first-shaping" : "schedule-change",
        text: formatShapingNotationRcLabel(rc),
        actionY: bodyRcY(frame, rc, model.sleeveBodyRows),
        outlineX: sideX(frame, bodyRcY(frame, rc, model.sleeveBodyRows), "left"),
        priority: 2,
        rowCounter: rc,
      });
    });
    const first = model.bodyShapingRcs[0];
    const last = model.bodyShapingRcs[model.bodyShapingRcs.length - 1];
    if (last !== undefined && first !== undefined && last !== first && last > 0 && last < model.sleeveBodyRows) {
      marks.push({
        id: "final-shaping",
        kind: "final-shaping",
        text: formatShapingNotationRcLabel(last),
        actionY: bodyRcY(frame, last, model.sleeveBodyRows),
        outlineX: sideX(frame, bodyRcY(frame, last, model.sleeveBodyRows), "left"),
        priority: 2,
        rowCounter: last,
      });
    }
  }
  marks.push({
    id: "cap-start",
    kind: "cap-start",
    text: formatShapingNotationRcLabel(model.sleeveBodyRows),
    actionY: frame.capStartY,
    outlineX: sideX(frame, frame.capStartY, "left"),
    priority: 0,
    rowCounter: model.sleeveBodyRows,
  });
  const capEnd = model.sleeveBodyRows + model.capRows;
  marks.push({
    id: "cap-end",
    kind: "cap-end",
    text: formatShapingNotationRcLabel(capEnd),
    actionY: frame.capTopY,
    outlineX: sideX(frame, frame.capTopY, "left"),
    priority: 0,
    rowCounter: capEnd,
  });
  return dedupeRcMarks(marks);
}

function bodyRcY(frame: SleeveFrame, rc: number, bodyRows: number): number {
  const t = bodyRows > 0 ? Math.max(0, Math.min(1, rc / bodyRows)) : 0;
  return frame.cuffJoinY + (frame.capStartY - frame.cuffJoinY) * t;
}

function dedupeRcMarks(marks: ShapingNotationRcLeaderLandmark[]): ShapingNotationRcLeaderLandmark[] {
  const kept: ShapingNotationRcLeaderLandmark[] = [];
  for (const mark of marks) {
    const clash = kept.find(
      (other) =>
        other.rowCounter === mark.rowCounter && Math.abs(other.actionY - mark.actionY) < 8,
    );
    if (!clash) {
      kept.push(mark);
      continue;
    }
    if (mark.priority < clash.priority) {
      kept[kept.indexOf(clash)] = mark;
    }
  }
  return kept;
}

function separateCloseRcLabels(placed: PlacedShapingNotationRcLeader[]): void {
  const sorted = [...placed].sort((a, b) => a.labelY - b.labelY || a.priority - b.priority);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const label = sorted[index]!;
    if (Math.abs(label.labelX - previous.labelX) > 48) continue;
    if (label.labelY - previous.labelY >= 22) continue;
    label.labelY = previous.labelY + 22;
    label.stacked = true;
  }
}

function drawRcLandmarks(
  model: SetInSleeveDiagramModel,
  frame: SleeveFrame,
  includeShaping: boolean,
  obstacles: ShapingNotationRcLeaderBox[],
): string {
  const placed = placeShapingNotationRcLandmarks({
    landmarks: sectionRcMarks(model, frame, includeShaping),
    side: "left",
    fontSize: DS_FS_RC,
    bounds: { minX: 4, minY: 14, maxX: DS_VB_W - 4, maxY: frame.canvasHeight - 10 },
    obstacles,
    labelGap: 28,
  });
  separateCloseRcLabels(placed);
  return renderShapingNotationRcLeaders({
    placed,
    fill: DS_MUTED,
    font: DS_FONT,
    escape: escapeXml,
    formatNumber: fmtNum,
  });
}

function notationText(label: SleeveNotationLabel): string {
  if (!label.text) return "";
  return (
    `<text data-role="${escapeXml(label.role)}" x="${fmtNum(label.x)}" y="${fmtNum(label.y)}"` +
    ` text-anchor="${label.anchor}" fill="${DS_MUTED}" ${textFont(DS_FS_NOTATION)}${label.extra}>${escapeXml(label.text)}</text>`
  );
}

function outsideLabel(
  frame: SleeveFrame,
  y: number,
  text: string,
  side: "left" | "right",
): { x: number; anchor: "start" | "end" } {
  const outline = sideX(frame, y, side);
  const width = Math.max(DS_FS_NOTATION, text.length * DS_FS_NOTATION * 0.56);
  if (side === "right") {
    const preferred = outline + 10;
    const maxX = DS_VB_W - 8 - width;
    return { x: Math.max(outline + 4, Math.min(preferred, maxX)), anchor: "start" };
  }
  const preferred = outline - 10;
  const minX = 8 + width;
  return { x: Math.min(outline - 4, Math.max(preferred, minX)), anchor: "end" };
}

/**
 * Keep tokens in knitting order beside the sleeve. A token stays on its row
 * when there is room. Crowded cap tokens step upward, outside the outline,
 * instead of stretching the sleeve.
 */
function notationOrder(label: SleeveNotationLabel): string {
  return `${label.role}:${label.extra.match(/data-knit-order="(\d+)"/)?.[1] ?? ""}`;
}

function stackSide(list: SleeveNotationLabel[]): void {
  list.sort((a, b) => b.y - a.y);
  let cursor = list[0]?.y ?? 0;
  for (let index = 1; index < list.length; index += 1) {
    const label = list[index]!;
    label.y = Math.min(label.y, cursor - NOTATION_GAP);
    cursor = label.y;
  }
}

function stackNotationBaselines(labels: SleeveNotationLabel[]): void {
  const right = labels.filter((label) => label.anchor === "start");
  const left = labels.filter((label) => label.anchor === "end");
  stackSide(right);
  const rightY = new Map<string, number>();
  for (const label of right) {
    const order = notationOrder(label);
    if (order) rightY.set(order, label.y);
  }
  for (const label of left) {
    const match = rightY.get(notationOrder(label));
    if (match !== undefined) label.y = match;
  }
  const unmatched = left.filter((label) => !rightY.has(notationOrder(label)));
  stackSide(unmatched);
  const sideTop = Math.min(
    ...labels.filter((label) => label.anchor !== "middle").map((label) => label.y),
  );
  for (const label of labels) {
    if (label.role !== "cap-bind-off") continue;
    label.y = Math.min(label.y, sideTop - NOTATION_GAP);
  }
}

function capNotationLabels(model: SetInSleeveDiagramModel, frame: SleeveFrame): SleeveNotationLabel[] {
  const sideEvents = model.capEvents
    .map((event, order) => ({ event, order }))
    .filter((item) => item.event.placement !== "center");
  const placed = sideEvents.map((item) => {
    const span = Math.max(1, model.capRows);
    const t = Math.max(0, Math.min(1, item.event.rowCenter / span));
    return {
      ...item,
      y: frame.capStartY - t * (frame.capStartY - frame.capTopY),
    };
  });
  const labels: SleeveNotationLabel[] = [];
  for (const item of placed) {
    const { event, order, y } = item;
    const scope = event.placement === "both-edges" ? "both" : event.placement === "right" ? "right" : "each";
    const sides: ("left" | "right")[] =
      event.placement === "each-edge" ? ["left", "right"] : ["right"];
    for (const side of sides) {
      const at = outsideLabel(frame, y, event.text, side);
      const both = event.placement === "both-edges" ? ` data-both-edges="true"` : "";
      labels.push({
        role: event.kind === "upper-slope" && event.text.endsWith("r") ? "cap-row-span" : "cap-shaping",
        text: event.text,
        x: at.x,
        y,
        anchor: at.anchor,
        extra:
          ` data-kind="${event.kind}" data-notation="${escapeXml(event.text)}" data-knit-order="${order}"` +
          ` data-side="${side}" data-edge-scope="${scope}"${both}`,
      });
    }
  }
  for (const [index, event] of model.capEvents.entries()) {
    if (event.placement !== "center") continue;
    labels.push({
      role: "cap-bind-off",
      text: event.text,
      x: frame.midX,
      y: Math.max(16, frame.capTopY - 22),
      anchor: "middle",
      extra:
        ` data-kind="${event.kind}" data-notation="${escapeXml(event.text)}" data-knit-order="${index}"` +
        ` data-side="center" data-knit-edge="end" data-edge-scope="all"`,
    });
  }
  return labels;
}

function bodyNotationLabels(model: SetInSleeveDiagramModel, frame: SleeveFrame): SleeveNotationLabel[] {
  const shaping = model.bodyShapingSteps.map((step) =>
    formatShapingSegment(step.stitches, step.rows, step.times),
  );
  const workingTokens = [
    model.rowsBeforeShaping > 0 ? `${model.rowsBeforeShaping}r` : "",
    ...shaping,
    model.rowsAfterShaping > 0 ? `${model.rowsAfterShaping}r` : "",
  ].filter((token) => token.length > 0);
  const labels = layoutSleeveShapingNotationLabels({
    frame: bodyNotationFrame(frame),
    direction: "cuff-up",
    sleeveBodyRows: model.sleeveBodyRows,
    cuffLabel: model.cuffRows > 0 ? `${model.cuffRows}r` : "",
    castOnLabel: `co${model.wristStitches} sts`,
    bindOffLabel: "",
    workingTokens,
    fontSize: DS_FS_NOTATION,
  });
  return labels.map((label) => {
    if (label.y >= frame.capStartY - 8 && label.y < frame.cuffJoinY) {
      return { ...label, y: Math.max(label.y, frame.capStartY + 16) };
    }
    return label;
  });
}

function leftNotationObstacles(labels: readonly SleeveNotationLabel[]): ShapingNotationRcLeaderBox[] {
  return labels
    .filter((label) => label.anchor === "end")
    .map((label) => {
      const width = Math.max(DS_FS_NOTATION, label.text.length * DS_FS_NOTATION * 0.56);
      return { x: label.x - width, y: label.y - DS_FS_NOTATION, w: width, h: DS_FS_NOTATION + 4 };
    });
}

function notationLabelsFor(model: SetInSleeveDiagramModel, frame: SleeveFrame): SleeveNotationLabel[] {
  const labels = [...bodyNotationLabels(model, frame), ...capNotationLabels(model, frame)];
  stackNotationBaselines(labels);
  return labels;
}

function frameForSleeve(model: SetInSleeveDiagramModel): SleeveFrame {
  const probe = buildSleeveFrame(model);
  const labels = notationLabelsFor(model, probe);
  const top = Math.min(...labels.map((label) => label.y));
  const overflow = Math.max(0, 18 - top);
  return overflow > 0 ? buildSleeveFrame(model, DS_PAD_TOP + overflow) : probe;
}

function drawSleeveSvg(model: SetInSleeveDiagramModel, mode: "sts-rows" | "shaping-notation"): string {
  const frame = frameForSleeve(model);
  const notationLabels = mode === "shaping-notation" ? notationLabelsFor(model, frame) : [];
  const parts = [
    mode === "shaping-notation" ? dropShoulderNotationFontFace() : "",
    drawOverview(frame),
    mode === "sts-rows" ? drawStitchesRowsDimensions(frame, model) : notationLabels.map(notationText).join(""),
    drawRcLandmarks(model, frame, mode === "shaping-notation", leftNotationObstacles(notationLabels)),
  ];
  const title =
    mode === "sts-rows" ? "Set-In Sleeve - Stitches & Rows" : "Set-In Sleeve - Shaping Notation";
  return wrapGeneratedDiagramSvg({
    ariaLabel: title,
    className: "sleeveless-piece-split__diagram-inline set-in-sleeve-diagram",
    dataAttrs: {
      "data-set-in-sleeve-diagram": mode,
      "data-supported": "true",
      "data-display-unit": model.unit,
      "data-sleeve-direction": "cuff-up",
      "data-sleeve-shaping-direction": model.shapingDirection,
      "data-wrist-stitches": model.wristStitches,
      "data-upper-arm-stitches": model.upperArmStitches,
      "data-top-stitches": model.topStitches,
      "data-cuff-rows": model.cuffRows,
      "data-sleeve-body-rows": model.sleeveBodyRows,
      "data-cap-rows": model.capRows,
      "data-body-shaping": model.bodyShapingNotation,
      "data-cap-notation": model.capNotationLines.join(" "),
      "data-body-shaping-rcs": model.bodyShapingRcs.join(","),
      "data-cap-mark-stitches": model.capMarks.map((mark) => mark.stitches).join(","),
      "data-wrist-y": fmtNum(frame.wristY),
      "data-cuff-join-y": fmtNum(frame.cuffJoinY),
      "data-cap-start-y": fmtNum(frame.capStartY),
      "data-cap-top-y": fmtNum(frame.capTopY),
      "data-cuff-depth-inches": fmtNum(model.cuffDepthInches),
      "data-sleeve-body-inches": fmtNum(model.sleeveBodyInches),
      "data-cap-height-inches": fmtNum(model.capHeightInches),
      "data-wrist-inches": fmtNum(model.wristInches),
      "data-upper-arm-inches": fmtNum(model.upperArmInches),
      "data-top-width-inches": fmtNum(model.topWidthInches),
    },
    title,
    viewBoxHeight: frame.canvasHeight,
    body: parts.join(""),
  });
}

export function buildSetInSleeveStitchesRowsSvg(model: SetInSleeveDiagramModel): string {
  return drawSleeveSvg(model, "sts-rows");
}

export function buildSetInSleeveShapingNotationSvg(model: SetInSleeveDiagramModel): string {
  return drawSleeveSvg(model, "shaping-notation");
}

export function tryBuildSetInSleeveStitchesRowsSvg(input: {
  sleevePiece: DropShoulderSleevePieceNumbers | null | undefined;
  sleeveCap: SetInSleeveCapSuccess | null | undefined;
  unit?: MeasurementDisplayUnit;
  wristInches?: number;
  cuffDepthInches?: number;
  sleeveLengthInches?: number;
}): string | null {
  const model = buildSetInSleeveDiagramModel(input);
  if (!model) return null;
  const svg = buildSetInSleeveStitchesRowsSvg(model);
  return svg.includes('data-supported="true"') ? svg : null;
}

export function tryBuildSetInSleeveShapingNotationSvg(input: {
  sleevePiece: DropShoulderSleevePieceNumbers | null | undefined;
  sleeveCap: SetInSleeveCapSuccess | null | undefined;
  unit?: MeasurementDisplayUnit;
  wristInches?: number;
  cuffDepthInches?: number;
  sleeveLengthInches?: number;
}): string | null {
  const model = buildSetInSleeveDiagramModel(input);
  if (!model) return null;
  const svg = buildSetInSleeveShapingNotationSvg(model);
  return svg.includes('data-supported="true"') ? svg : null;
}
