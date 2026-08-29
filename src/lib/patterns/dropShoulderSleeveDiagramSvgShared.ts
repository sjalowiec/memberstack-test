/**
 * Shared Drop Shoulder sleeve schematic primitives.
 * Stitches & Rows and Shaping Notation use the same silhouette.
 * Does not compute pattern math.
 */

import type { DropShoulderSleeveDirection } from "./dropShoulderSleeveConstruction";
import type { DropShoulderSleeveStitchesRowsModel } from "./dropShoulderSleeveDiagramModel";
import {
  DS_ARROW,
  DS_BODY_MAX_H,
  DS_BODY_MAX_W,
  DS_FS_SMALL,
  DS_MIN_SECTION,
  DS_MUTED,
  DS_PAD_BOTTOM,
  DS_PAD_TOP,
  DS_VB_W,
  DS_VB_H,
  endCap,
  escapeXml,
  fmtNum,
  textFont,
} from "./dropShoulderPatternDiagramSvgShared";

export type DropShoulderSleeveDiagramFrame = {
  direction: DropShoulderSleeveDirection;
  midX: number;
  top: number;
  bottom: number;
  cuffJoinY: number;
  wristY: number;
  upperArmY: number;
  wristLeft: number;
  wristRight: number;
  upperLeft: number;
  upperRight: number;
  cuffJoinLeft: number;
  cuffJoinRight: number;
};

function scaleSleeveBands(cuffRows: number, bodyRows: number): { cuffH: number; bodyH: number } {
  const cuff = Math.max(0, cuffRows);
  const body = Math.max(0, bodyRows);
  const total = Math.max(1, cuff + body);
  const raw = (rows: number) => (rows / total) * DS_BODY_MAX_H;
  let cuffH = Math.max(cuff > 0 ? DS_MIN_SECTION : 0, raw(cuff));
  let bodyH = Math.max(body > 0 ? DS_MIN_SECTION * 1.4 : DS_MIN_SECTION, raw(body));
  const sum = cuffH + bodyH;
  if (sum > DS_BODY_MAX_H && sum > 0) {
    const k = DS_BODY_MAX_H / sum;
    cuffH *= k;
    bodyH *= k;
  }
  return { cuffH, bodyH };
}

function widthForStitches(stitches: number, maxStitches: number): number {
  const minW = DS_BODY_MAX_W * 0.32;
  const maxW = DS_BODY_MAX_W;
  if (!(maxStitches > 0)) return maxW;
  const t = Math.max(0, Math.min(1, stitches / maxStitches));
  return minW + (maxW - minW) * t;
}

export function buildDropShoulderSleeveFrame(
  model: DropShoulderSleeveStitchesRowsModel,
): DropShoulderSleeveDiagramFrame {
  const midX = DS_VB_W / 2;
  const top = DS_PAD_TOP;
  const bottom = DS_VB_H - DS_PAD_BOTTOM;
  const { cuffH } = scaleSleeveBands(model.cuffRows, model.sleeveBodyRows);
  const maxSts = Math.max(model.wristStitches, model.topStitches);
  const wristW = widthForStitches(model.wristStitches, maxSts);
  const topW = widthForStitches(model.topStitches, maxSts);
  const wristLeft = midX - wristW / 2;
  const wristRight = midX + wristW / 2;
  const upperLeft = midX - topW / 2;
  const upperRight = midX + topW / 2;
  const isTopDown = model.direction === "top-down";
  const cuffJoinY = isTopDown ? top + cuffH : bottom - cuffH;
  return {
    direction: isTopDown ? "top-down" : "cuff-up",
    midX,
    top,
    bottom,
    cuffJoinY,
    wristY: isTopDown ? top : bottom,
    upperArmY: isTopDown ? bottom : top,
    wristLeft,
    wristRight,
    upperLeft,
    upperRight,
    cuffJoinLeft: wristLeft,
    cuffJoinRight: wristRight,
  };
}

/** Trapezoid (or rectangle) with a rectangular cuff at the wrist end. No sleeve cap. */
export function dropShoulderSleeveBodyPath(frame: DropShoulderSleeveDiagramFrame): string {
  if (frame.direction === "top-down") {
    return [
      `M ${fmtNum(frame.wristLeft)} ${fmtNum(frame.top)}`,
      `L ${fmtNum(frame.wristRight)} ${fmtNum(frame.top)}`,
      `L ${fmtNum(frame.wristRight)} ${fmtNum(frame.cuffJoinY)}`,
      `L ${fmtNum(frame.upperRight)} ${fmtNum(frame.bottom)}`,
      `L ${fmtNum(frame.upperLeft)} ${fmtNum(frame.bottom)}`,
      `L ${fmtNum(frame.wristLeft)} ${fmtNum(frame.cuffJoinY)}`,
      "Z",
    ].join(" ");
  }
  return [
    `M ${fmtNum(frame.wristLeft)} ${fmtNum(frame.bottom)}`,
    `L ${fmtNum(frame.wristRight)} ${fmtNum(frame.bottom)}`,
    `L ${fmtNum(frame.wristRight)} ${fmtNum(frame.cuffJoinY)}`,
    `L ${fmtNum(frame.upperRight)} ${fmtNum(frame.top)}`,
    `L ${fmtNum(frame.upperLeft)} ${fmtNum(frame.top)}`,
    `L ${fmtNum(frame.wristLeft)} ${fmtNum(frame.cuffJoinY)}`,
    "Z",
  ].join(" ");
}

export function drawSleeveCuffJoin(frame: DropShoulderSleeveDiagramFrame): string {
  return (
    `<line data-sleeve-cuff-join="true" x1="${fmtNum(frame.cuffJoinLeft)}" y1="${fmtNum(frame.cuffJoinY)}"` +
    ` x2="${fmtNum(frame.cuffJoinRight)}" y2="${fmtNum(frame.cuffJoinY)}" stroke="#1a1a1a" stroke-width="1.1" fill="none"/>`
  );
}

function horizontalWidthDim(
  left: number,
  right: number,
  y: number,
  labelY: number,
  label: string,
  role: string,
): string {
  if (!label) return "";
  const labelX = (left + right) / 2;
  return [
    `<g class="ds-sleeve-diagram__${role}" data-${role}="true">`,
    `<line x1="${fmtNum(left)}" y1="${fmtNum(y)}" x2="${fmtNum(right)}" y2="${fmtNum(y)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>`,
    endCap(left, y, false),
    endCap(right, y, false),
    `<text x="${fmtNum(labelX)}" y="${fmtNum(labelY)}" text-anchor="middle" fill="${DS_MUTED}" ${textFont(DS_FS_SMALL)}>${escapeXml(label)}</text>`,
    `</g>`,
  ].join("");
}

export function drawSleeveWristWidth(
  frame: DropShoulderSleeveDiagramFrame,
  label: string,
): string {
  const outside = frame.direction === "top-down" ? frame.wristY - 16 : frame.wristY + 22;
  const labelY = frame.direction === "top-down" ? outside - 6 : outside + 16;
  return horizontalWidthDim(
    frame.wristLeft,
    frame.wristRight,
    outside,
    labelY,
    label,
    "wrist-width",
  );
}

export function drawSleeveUpperArmWidth(
  frame: DropShoulderSleeveDiagramFrame,
  label: string,
): string {
  const outside = frame.direction === "top-down" ? frame.upperArmY + 22 : frame.upperArmY - 16;
  const labelY = frame.direction === "top-down" ? outside + 16 : outside - 6;
  return horizontalWidthDim(
    frame.upperLeft,
    frame.upperRight,
    outside,
    labelY,
    label,
    "upper-arm-width",
  );
}

function verticalDim(
  x: number,
  y1: number,
  y2: number,
  labelX: number,
  label: string,
  role: string,
): string {
  if (!label) return "";
  const midY = (y1 + y2) / 2;
  return [
    `<g class="ds-sleeve-diagram__${role}" data-${role}="true">`,
    `<line x1="${fmtNum(x)}" y1="${fmtNum(y1)}" x2="${fmtNum(x)}" y2="${fmtNum(y2)}" stroke="${DS_ARROW}" stroke-width="1.4" fill="none"/>`,
    endCap(x, y1, true),
    endCap(x, y2, true),
    `<text transform="translate(${fmtNum(labelX)} ${fmtNum(midY)}) rotate(-90)" text-anchor="middle" fill="${DS_MUTED}" ${textFont(DS_FS_SMALL)}>${escapeXml(label)}</text>`,
    `</g>`,
  ].join("");
}

export function drawSleeveCuffDepth(
  frame: DropShoulderSleeveDiagramFrame,
  label: string,
): string {
  const y1 = Math.min(frame.wristY, frame.cuffJoinY);
  const y2 = Math.max(frame.wristY, frame.cuffJoinY);
  const x = frame.wristRight + 18;
  return verticalDim(x, y1, y2, x + 12, label, "cuff-depth");
}

export function drawSleeveBodyLength(
  frame: DropShoulderSleeveDiagramFrame,
  label: string,
): string {
  const y1 = Math.min(frame.cuffJoinY, frame.upperArmY);
  const y2 = Math.max(frame.cuffJoinY, frame.upperArmY);
  const bodyLeft = Math.min(frame.wristLeft, frame.upperLeft);
  const x = bodyLeft - 18;
  return verticalDim(x, y1, y2, x - 12, label, "sleeve-body-length");
}

export function drawSleeveTotalLength(
  frame: DropShoulderSleeveDiagramFrame,
  label: string,
): string {
  const y1 = frame.top;
  const y2 = frame.bottom;
  const bodyLeft = Math.min(frame.wristLeft, frame.upperLeft);
  const x = bodyLeft - 40;
  return verticalDim(x, y1, y2, x - 12, label, "sleeve-total-length");
}
