/**
 * Sideways V-Neck sleeve diagrams (Stitches & Rows and Shaping Notation).
 *
 * Geometry, colors, and direction come from the Drop Shoulder sleeve frame.
 * Cuff Up keeps the cuff at the bottom. Top Down uses that frame's Top Down
 * orientation, with the upper arm as the starting edge. Labels stay upright.
 * This module does not recalculate stitches, rows, or shaping.
 */

import {
  buildDropShoulderSleeveStitchesRowsModel,
  type DropShoulderSleeveStitchesRowsModel,
} from "./dropShoulderSleeveDiagramModel";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import {
  buildDropShoulderSleeveFrame,
  dropShoulderSleeveBodyPath,
  drawSleeveCuffDepth,
  drawSleeveCuffJoin,
  drawSleeveTotalLength,
  drawSleeveUpperArmWidth,
  drawSleeveWristWidth,
  type DropShoulderSleeveDiagramFrame,
} from "./dropShoulderSleeveDiagramSvgShared";
import {
  DS_FILL,
  DS_FONT,
  DS_FS_MEASURE,
  DS_MUTED,
  DS_FS_SMALL,
  DS_FS_TITLE,
  DS_FW_TITLE,
  DS_STROKE,
  escapeXml,
  fmtNum,
  textFont,
  wrapGeneratedDiagramSvg,
} from "./dropShoulderPatternDiagramSvgShared";
import {
  DS_FS_NOTATION,
  DS_FS_RC,
  dropShoulderNotationFontFace,
} from "./dropShoulderShapingNotationDiagramShared";
import {
  layoutSleeveShapingNotationLabels,
  renderSleeveShapingRcLandmarks,
} from "./sleeveShapingNotationLayout";
import {
  dropShoulderSleeveShapingRcSequence,
  formatDropShoulderSleeveWorkingNotation,
} from "./dropShoulderSleeveShapingChart";
import {
  SIDEWAYS_SLEEVE_CONSTRUCTION_CUFF_UP_LABEL,
  SIDEWAYS_SLEEVE_CONSTRUCTION_TOP_DOWN_LABEL,
} from "./dropShoulderSleeveConstruction";
import type { SidewaysCardiganSleeveCalc } from "./sidewaysCardiganSleeveCalc";
import type { MeasurementDisplayUnit } from "./patternMeasurementDisplayUnit";
import {
  formatPatternDiagramCountLabel,
  formatPatternDiagramMeasurement,
} from "./patternStitchesRowsDiagramLabel";
import {
  formatBindOffNotation,
  formatBodyRowsNotation,
  formatCastOnNotation,
} from "./sleevelessBackJapaneseNotation";

export type SidewaysCardiganSleeveDiagramArgs = {
  calc: SidewaysCardiganSleeveCalc;
  stitchesPerInch: number;
  rowsPerInch: number;
  displayUnit?: MeasurementDisplayUnit;
};

const MIN_READABLE_FONT = DS_FS_SMALL;

function diagramText(
  role: string,
  label: string,
  x: number,
  y: number,
  size: number,
  anchor: "middle" | "start" | "end" = "middle",
  extra = "",
  fill = DS_STROKE,
): string {
  if (!label) return "";
  const fontSize = Math.max(MIN_READABLE_FONT, size);
  return (
    `<text data-role="${escapeXml(role)}" x="${fmtNum(x)}" y="${fmtNum(y)}"` +
    ` text-anchor="${anchor}" fill="${fill}" ${textFont(fontSize)}${extra}>${escapeXml(label)}</text>`
  );
}

function stitchDimensionLabel(
  stitches: number,
  inches: number | undefined,
  unit: MeasurementDisplayUnit,
): string {
  return formatPatternDiagramCountLabel(stitches, "sts", formatPatternDiagramMeasurement(inches, unit));
}

function rowDimensionLabel(
  rows: number,
  inches: number | undefined,
  unit: MeasurementDisplayUnit,
): string {
  return formatPatternDiagramCountLabel(rows, "rows", formatPatternDiagramMeasurement(inches, unit));
}

function directionChoiceLabel(calc: SidewaysCardiganSleeveCalc): string {
  return calc.direction === "top-down"
    ? SIDEWAYS_SLEEVE_CONSTRUCTION_TOP_DOWN_LABEL
    : SIDEWAYS_SLEEVE_CONSTRUCTION_CUFF_UP_LABEL;
}

function castOnStitches(calc: SidewaysCardiganSleeveCalc): number {
  return calc.direction === "top-down" ? calc.topSts : calc.wristSts;
}

function bindOffStitches(calc: SidewaysCardiganSleeveCalc): number {
  return calc.direction === "top-down" ? calc.wristSts : calc.topSts;
}

function chartInput(calc: SidewaysCardiganSleeveCalc) {
  return {
    topSts: calc.topSts,
    wristSts: calc.wristSts,
    cuffRows: calc.cuffRows,
    sleeveBodyRows: calc.sleeveBodyRows,
    sleeveTotalRows: calc.sleeveTotalRows,
    direction: calc.direction,
  };
}

function workingDirectionArrow(
  frame: DropShoulderSleeveDiagramFrame,
  direction: "up" | "down",
): string {
  const x = frame.midX + 28;
  const top = Math.min(frame.cuffJoinY, frame.upperArmY) + 18;
  const bottom = Math.max(frame.cuffJoinY, frame.upperArmY) - 18;
  const headY = direction === "up" ? top : bottom;
  const tailY = direction === "up" ? bottom : top;
  const tip = 7;
  const wing = direction === "up" ? headY + tip : headY - tip;
  return (
    `<g data-role="working-direction" data-knit-direction="${direction}">` +
    `<line x1="${fmtNum(x)}" y1="${fmtNum(tailY)}" x2="${fmtNum(x)}" y2="${fmtNum(headY)}" stroke="${DS_STROKE}" stroke-width="1.6"/>` +
    `<polygon points="${fmtNum(x)},${fmtNum(headY)} ${fmtNum(x - 5)},${fmtNum(wing)} ${fmtNum(x + 5)},${fmtNum(wing)}" fill="${DS_STROKE}"/>` +
    `</g>`
  );
}

function sleeveFrame(args: SidewaysCardiganSleeveDiagramArgs): {
  frame: DropShoulderSleeveDiagramFrame;
  model: DropShoulderSleeveStitchesRowsModel;
} | null {
  const { calc } = args;
  if (!(args.stitchesPerInch > 0) || !(args.rowsPerInch > 0)) return null;
  const model = buildDropShoulderSleeveStitchesRowsModel(
    {
      isDropShoulder: true,
      debug: {
        stitchesPerInch: args.stitchesPerInch,
        rowsPerInch: args.rowsPerInch,
        dropShoulderSleeveWristStitches: calc.wristSts,
        dropShoulderSleeveTopStitches: calc.topSts,
        dropShoulderSleeveCuffRows: calc.cuffRows,
        dropShoulderSleeveBodyRows: calc.sleeveBodyRows,
        dropShoulderSleeveTotalRows: calc.sleeveTotalRows,
      } as SleevelessBackPatternResult["debug"],
    },
    calc.direction,
    "in",
  );
  if (!model) return null;
  return { frame: buildDropShoulderSleeveFrame(model), model };
}

function sharedDataAttrs(
  args: SidewaysCardiganSleeveDiagramArgs,
  frame: DropShoulderSleeveDiagramFrame,
): Record<string, string | number> {
  const { calc } = args;
  const castOn = castOnStitches(calc);
  const bindOff = bindOffStitches(calc);
  const shapingChart = {
    topSts: calc.topSts,
    wristSts: calc.wristSts,
    cuffRows: calc.cuffRows,
    sleeveBodyRows: calc.sleeveBodyRows,
    sleeveTotalRows: calc.sleeveTotalRows,
    direction: calc.direction,
  };
  const notation = formatDropShoulderSleeveWorkingNotation(shapingChart, {
    includeRowSpans: true,
  });
  return {
    "data-supported": "true",
    "data-sleeve-direction": calc.direction,
    "data-sleeve-frame": frame.direction,
    "data-wrist-stitches": calc.wristSts,
    "data-top-stitches": calc.topSts,
    "data-cuff-rows": calc.cuffRows,
    "data-sleeve-body-rows": calc.sleeveBodyRows,
    "data-sleeve-total-rows": calc.sleeveTotalRows,
    "data-upper-arm-inches": calc.finished.upperArmInches,
    "data-wrist-inches": calc.finished.wristInches,
    "data-sleeve-length-inches": calc.finished.sleeveLengthInches,
    "data-wrist-y": fmtNum(frame.wristY),
    "data-upper-arm-y": fmtNum(frame.upperArmY),
    "data-cuff-join-y": fmtNum(frame.cuffJoinY),
    "data-cast-on-stitches": castOn,
    "data-bind-off-stitches": bindOff,
    "data-cast-on-edge": calc.direction === "top-down" ? "upper-arm" : "wrist",
    "data-bind-off-edge": calc.direction === "top-down" ? "wrist" : "upper-arm",
    "data-shaping-direction": calc.shapingPlan.shapingDirection,
    "data-shaping-notation": notation,
    "data-shaping-rows": dropShoulderSleeveShapingRcSequence(shapingChart).join(","),
  };
}

/** Place a label just outside an edge. SVG y grows downward; text is not rotated. */
function edgeLabelY(frame: DropShoulderSleeveDiagramFrame, edge: "upper-arm" | "wrist"): number {
  const y = edge === "upper-arm" ? frame.upperArmY : frame.wristY;
  const towardBody = Math.sign(frame.cuffJoinY - y) || 1;
  return y - towardBody * 22;
}

function silhouette(frame: DropShoulderSleeveDiagramFrame): string {
  return [
    `<path class="ds-sleeve-diagram__body" d="${dropShoulderSleeveBodyPath(frame)}" fill="${DS_FILL}" stroke="${DS_STROKE}" stroke-width="1.75"/>`,
    drawSleeveCuffJoin(frame),
  ].join("");
}

export function buildSidewaysCardiganSleeveStitchesRowsSvg(
  args: SidewaysCardiganSleeveDiagramArgs,
): string | null {
  const oriented = sleeveFrame(args);
  if (!oriented) return null;
  const { frame } = oriented;
  const { calc } = args;
  const unit = args.displayUnit === "cm" ? "cm" : "in";
  const directionLabel = directionChoiceLabel(calc);
  const castOnEdge = calc.direction === "top-down" ? "upper-arm" : "wrist";
  const bindOffEdge = calc.direction === "top-down" ? "wrist" : "upper-arm";
  const castOnY = edgeLabelY(frame, castOnEdge);
  const bindOffY = edgeLabelY(frame, bindOffEdge);
  const bodyTop = Math.min(frame.cuffJoinY, frame.upperArmY);
  const bodyBottom = Math.max(frame.cuffJoinY, frame.upperArmY);
  const labelY = bodyTop + (bodyBottom - bodyTop) * 0.55;
  const knitToward = frame[castOnEdge === "wrist" ? "wristY" : "upperArmY"] >
    frame[bindOffEdge === "wrist" ? "wristY" : "upperArmY"]
    ? "up"
    : "down";

  const body = [
    silhouette(frame),
    diagramText(
      "sleeve-direction",
      directionLabel,
      frame.midX,
      labelY,
      DS_FS_TITLE,
      "middle",
      ` font-weight="${DS_FW_TITLE}"`,
    ),
    workingDirectionArrow(frame, knitToward),
    drawSleeveWristWidth(
      frame,
      stitchDimensionLabel(calc.wristSts, calc.finished.wristInches, unit),
    ),
    drawSleeveUpperArmWidth(
      frame,
      stitchDimensionLabel(calc.topSts, calc.finished.upperArmInches, unit),
    ),
    drawSleeveTotalLength(
      frame,
      rowDimensionLabel(calc.sleeveTotalRows, calc.finished.sleeveLengthInches, unit),
    ),
    drawSleeveCuffDepth(
      frame,
      rowDimensionLabel(calc.cuffRows, calc.finished.cuffDepthInches, unit),
    ),
  ].join("");

  const svg = wrapGeneratedDiagramSvg({
    ariaLabel: `Sideways sleeve stitches and rows, ${directionLabel}`,
    className: "sleeveless-piece-split__diagram-inline ds-sleeve-diagram ds-sleeve-diagram--generated",
    dataAttrs: {
      ...sharedDataAttrs(args, frame),
      "data-sideways-sleeve-diagram": "sts-rows",
      "data-sideways-sleeve-sts-rows-generated": "true",
      "data-cast-on-y": fmtNum(castOnY),
      "data-bind-off-y": fmtNum(bindOffY),
    },
    title: `Sideways sleeve stitches and rows, ${directionLabel}`,
    body,
  });
  return svg.replace(/<title>[\s\S]*?<\/title>/, "");
}

export function buildSidewaysCardiganSleeveShapingNotationSvg(
  args: SidewaysCardiganSleeveDiagramArgs,
): string | null {
  const oriented = sleeveFrame(args);
  if (!oriented) return null;
  const { frame } = oriented;
  const { calc } = args;
  const directionLabel = directionChoiceLabel(calc);
  const castOnEdge = calc.direction === "top-down" ? "upper-arm" : "wrist";
  const bindOffEdge = calc.direction === "top-down" ? "wrist" : "upper-arm";
  const castOnY = edgeLabelY(frame, castOnEdge);
  const bindOffY = edgeLabelY(frame, bindOffEdge);
  const notation = formatDropShoulderSleeveWorkingNotation(chartInput(calc), {
    includeRowSpans: true,
  });
  const castOn = `${formatCastOnNotation(castOnStitches(calc))} sts`;
  const bindOff = formatBindOffNotation(bindOffStitches(calc));
  const cuff = formatBodyRowsNotation(calc.cuffRows);
  const edgeLabels = layoutSleeveShapingNotationLabels({
    frame,
    direction: calc.direction,
    sleeveBodyRows: calc.sleeveBodyRows,
    cuffLabel: cuff,
    castOnLabel: castOn,
    bindOffLabel: bindOff,
    workingTokens: notation.split(" ").filter(Boolean),
    fontSize: DS_FS_NOTATION,
  })
    .map((label) =>
      diagramText(
        label.role,
        label.text,
        label.x,
        label.y,
        DS_FS_NOTATION,
        label.anchor,
        label.extra,
        DS_MUTED,
      ),
    )
    .join("");

  const body = [
    dropShoulderNotationFontFace(),
    silhouette(frame),
    edgeLabels,
    renderSleeveShapingRcLandmarks({
      frame,
      input: chartInput(calc),
      fontSize: DS_FS_RC,
      fill: DS_MUTED,
      font: DS_FONT,
      escape: escapeXml,
      formatNumber: fmtNum,
    }),
  ].join("");

  return wrapGeneratedDiagramSvg({
    ariaLabel: `Sideways sleeve shaping notation, ${directionLabel}`,
    className:
      "sleeveless-piece-split__diagram-inline ds-sleeve-diagram ds-sleeve-diagram--generated ds-sleeve-diagram--notation",
    dataAttrs: {
      ...sharedDataAttrs(args, frame),
      "data-sideways-sleeve-diagram": "shaping-notation",
      "data-sideways-sleeve-notation-generated": "true",
      "data-cast-on-y": fmtNum(castOnY),
      "data-bind-off-y": fmtNum(bindOffY),
      "data-jp-caston": castOn,
      "data-jp-bindoff": bindOff,
      "data-jp-cuff": cuff,
      "data-jp-sleeve": notation,
    },
    title: `Sideways Sleeve - Shaping Notation - ${directionLabel}`,
    body,
  });
}
