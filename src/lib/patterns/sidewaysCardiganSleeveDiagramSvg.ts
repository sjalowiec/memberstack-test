/**
 * Sideways V-Neck sleeve diagrams (Stitches & Rows and Shaping Notation).
 *
 * Geometry, colors, and dimension arrows come from the Drop Shoulder sleeve
 * schematic. The silhouette stays cuff-at-bottom / upper-arm-at-top for both
 * knitting directions. Cast-on, bind-off, and shaping labels follow the
 * calculated cuff-up or top-down sequence. This module does not recalculate
 * stitches, rows, or shaping.
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
  DS_FS_MEASURE,
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
  dropShoulderNotationFontFace,
} from "./dropShoulderShapingNotationDiagramShared";
import { formatDropShoulderSleeveShapingNotation } from "./dropShoulderSleeveShaping";
import { dropShoulderSleeveShapingRcSequence } from "./dropShoulderSleeveShapingChart";
import { SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS } from "./sidewaysCardiganConstructionIdentity";
import type { SidewaysCardiganSleeveCalc } from "./sidewaysCardiganSleeveCalc";
import {
  formatInchesWithUnit,
  formatRowsCount,
  formatStitchesCount,
} from "./sidewaysCardiganDisplayFormat";
import {
  formatBindOffNotation,
  formatBodyRowsNotation,
  formatCastOnNotation,
} from "./sleevelessBackJapaneseNotation";

export type SidewaysCardiganSleeveDiagramArgs = {
  calc: SidewaysCardiganSleeveCalc;
  stitchesPerInch: number;
  rowsPerInch: number;
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
): string {
  if (!label) return "";
  const fontSize = Math.max(MIN_READABLE_FONT, size);
  return (
    `<text data-role="${escapeXml(role)}" x="${fmtNum(x)}" y="${fmtNum(y)}"` +
    ` text-anchor="${anchor}" fill="${DS_STROKE}" ${textFont(fontSize)}${extra}>${escapeXml(label)}</text>`
  );
}

function measurementLabel(name: string, stitches: number, inches: number): string {
  return `${name} · ${formatStitchesCount(stitches)} / ${formatInchesWithUnit(inches)}`;
}

function sleeveLengthLabel(calc: SidewaysCardiganSleeveCalc): string {
  return `Sleeve length · ${formatRowsCount(calc.sleeveTotalRows)} / ${formatInchesWithUnit(calc.finished.sleeveLengthInches)}`;
}

function shapingNotation(calc: SidewaysCardiganSleeveCalc): string {
  return (
    formatDropShoulderSleeveShapingNotation(calc.shapingPlan.steps) ||
    formatBodyRowsNotation(calc.sleeveBodyRows)
  );
}

function castOnStitches(calc: SidewaysCardiganSleeveCalc): number {
  return calc.direction === "top-down" ? calc.topSts : calc.wristSts;
}

function bindOffStitches(calc: SidewaysCardiganSleeveCalc): number {
  return calc.direction === "top-down" ? calc.wristSts : calc.topSts;
}

function travelLabel(calc: SidewaysCardiganSleeveCalc): string {
  return calc.direction === "top-down" ? "Knit downward" : "Knit upward";
}

function shapingVerbLabel(calc: SidewaysCardiganSleeveCalc): string {
  if (calc.shapingPlan.noShaping || calc.shapingPerSide <= 0) return "Knit even";
  return calc.shapingPlan.shapingDirection === "decrease"
    ? "Decrease both edges"
    : "Increase both edges";
}

/**
 * Cuff-up frame for both directions so the finished sleeve stays upright.
 * Drop Shoulder's own top-down schematic flips the artwork; Sideways does not.
 */
function uprightSleeveModel(
  args: SidewaysCardiganSleeveDiagramArgs,
): DropShoulderSleeveStitchesRowsModel | null {
  const { calc } = args;
  if (!(args.stitchesPerInch > 0) || !(args.rowsPerInch > 0)) return null;
  return buildDropShoulderSleeveStitchesRowsModel(
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
    "cuff-up",
    "in",
  );
}

function uprightSleeveFrame(args: SidewaysCardiganSleeveDiagramArgs): {
  frame: DropShoulderSleeveDiagramFrame;
  model: DropShoulderSleeveStitchesRowsModel;
} | null {
  const model = uprightSleeveModel(args);
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
  const notation = shapingNotation(calc);
  const chartInput = {
    topSts: calc.topSts,
    wristSts: calc.wristSts,
    cuffRows: calc.cuffRows,
    sleeveBodyRows: calc.sleeveBodyRows,
    sleeveTotalRows: calc.sleeveTotalRows,
    direction: calc.direction,
  };
  return {
    "data-supported": "true",
    "data-sleeve-direction": calc.direction,
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
    "data-shaping-rows": dropShoulderSleeveShapingRcSequence(chartInput).join(","),
  };
}

function edgeLabelY(frame: DropShoulderSleeveDiagramFrame, edge: "upper-arm" | "wrist"): number {
  if (edge === "upper-arm") return frame.upperArmY + 28;
  return Math.max(frame.cuffJoinY + 16, frame.wristY - 22);
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
  const upright = uprightSleeveFrame(args);
  if (!upright) return null;
  const { frame, model } = upright;
  const { calc } = args;
  const directionLabel = SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS[calc.direction];
  const castOnEdge = calc.direction === "top-down" ? "upper-arm" : "wrist";
  const bindOffEdge = calc.direction === "top-down" ? "wrist" : "upper-arm";
  const castOnY = edgeLabelY(frame, castOnEdge);
  const bindOffY = edgeLabelY(frame, bindOffEdge);
  const bodyTop = Math.min(frame.cuffJoinY, frame.upperArmY);
  const bodyBottom = Math.max(frame.cuffJoinY, frame.upperArmY);
  const midY = bodyTop + (bodyBottom - bodyTop) * 0.42;
  const notation = shapingNotation(calc);

  const body = [
    silhouette(frame),
    diagramText("sleeve-piece-label", "SLEEVE", frame.midX, midY - 36, DS_FS_TITLE, "middle", ` font-weight="${DS_FW_TITLE}"`),
    diagramText("sleeve-direction", directionLabel, frame.midX, midY - 16, DS_FS_MEASURE),
    diagramText("sleeve-travel", travelLabel(calc), frame.midX, midY + 4, DS_FS_MEASURE),
    diagramText("sleeve-shaping-verb", shapingVerbLabel(calc), frame.midX, midY + 24, DS_FS_MEASURE),
    diagramText("sleeve-shaping", notation, frame.midX, midY + 46, DS_FS_NOTATION),
    diagramText(
      "cast-on",
      `Cast on ${formatStitchesCount(castOnStitches(calc))}`,
      frame.midX,
      castOnY,
      DS_FS_MEASURE,
      "middle",
      ` data-knit-edge="start"`,
    ),
    diagramText(
      "bind-off",
      `Bind off ${formatStitchesCount(bindOffStitches(calc))}`,
      frame.midX,
      bindOffY,
      DS_FS_MEASURE,
      "middle",
      ` data-knit-edge="end"`,
    ),
    drawSleeveWristWidth(
      frame,
      measurementLabel("Wrist/Cuff", calc.wristSts, calc.finished.wristInches),
    ),
    drawSleeveUpperArmWidth(
      frame,
      measurementLabel("Upper arm", calc.topSts, calc.finished.upperArmInches),
    ),
    drawSleeveTotalLength(frame, sleeveLengthLabel(calc)),
    drawSleeveCuffDepth(frame, model.cuffDepthLabel),
  ].join("");

  return wrapGeneratedDiagramSvg({
    ariaLabel: `Sideways sleeve stitches and rows, ${directionLabel}`,
    className: "sleeveless-piece-split__diagram-inline ds-sleeve-diagram ds-sleeve-diagram--generated",
    dataAttrs: {
      ...sharedDataAttrs(args, frame),
      "data-sideways-sleeve-diagram": "sts-rows",
      "data-sideways-sleeve-sts-rows-generated": "true",
      "data-cast-on-y": fmtNum(castOnY),
      "data-bind-off-y": fmtNum(bindOffY),
    },
    title: `Sideways Sleeve - Stitches & Rows - ${directionLabel}`,
    body,
  });
}

export function buildSidewaysCardiganSleeveShapingNotationSvg(
  args: SidewaysCardiganSleeveDiagramArgs,
): string | null {
  const upright = uprightSleeveFrame(args);
  if (!upright) return null;
  const { frame } = upright;
  const { calc } = args;
  const directionLabel = SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS[calc.direction];
  const castOnEdge = calc.direction === "top-down" ? "upper-arm" : "wrist";
  const bindOffEdge = calc.direction === "top-down" ? "wrist" : "upper-arm";
  const castOnY = edgeLabelY(frame, castOnEdge);
  const bindOffY = edgeLabelY(frame, bindOffEdge);
  const notation = shapingNotation(calc);
  const bodyTop = Math.min(frame.cuffJoinY, frame.upperArmY);
  const bodyBottom = Math.max(frame.cuffJoinY, frame.upperArmY);
  const shapingY = bodyTop + (bodyBottom - bodyTop) * 0.45;
  const cuffMidY = (frame.wristY + frame.cuffJoinY) / 2;
  const castOn = `${formatCastOnNotation(castOnStitches(calc))} sts`;
  const bindOff = formatBindOffNotation(bindOffStitches(calc));
  const cuff = formatBodyRowsNotation(calc.cuffRows);

  const body = [
    dropShoulderNotationFontFace(),
    silhouette(frame),
    diagramText("sleeve-piece-label", "SLEEVE", frame.midX, shapingY - 28, DS_FS_TITLE, "middle", ` font-weight="${DS_FW_TITLE}"`),
    diagramText("sleeve-direction", directionLabel, frame.midX, shapingY - 8, DS_FS_MEASURE),
    diagramText("sleeve-shaping-verb", shapingVerbLabel(calc), frame.midX, shapingY + 14, DS_FS_MEASURE),
    diagramText(
      "cast-on",
      castOn,
      frame.midX,
      castOnY,
      DS_FS_NOTATION,
      "middle",
      ` data-knit-edge="start" data-notation="${escapeXml(castOn)}"`,
    ),
    diagramText(
      "bind-off",
      bindOff,
      frame.midX,
      bindOffY,
      DS_FS_NOTATION,
      "middle",
      ` data-knit-edge="end" data-notation="${escapeXml(bindOff)}"`,
    ),
    diagramText(
      "cuff",
      cuff,
      frame.wristRight + 12,
      cuffMidY,
      DS_FS_NOTATION,
      "start",
    ),
    diagramText(
      "sleeve-shaping-left",
      notation,
      Math.min(frame.wristLeft, frame.upperLeft) - 8,
      shapingY,
      DS_FS_NOTATION,
      "end",
      ` data-notation="${escapeXml(notation)}"`,
    ),
    diagramText(
      "sleeve-shaping-right",
      notation,
      Math.max(frame.wristRight, frame.upperRight) + 8,
      shapingY,
      DS_FS_NOTATION,
      "start",
      ` data-notation="${escapeXml(notation)}"`,
    ),
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
