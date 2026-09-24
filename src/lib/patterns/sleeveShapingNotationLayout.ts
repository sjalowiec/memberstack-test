/**
 * Shared sleeve Shaping Notation annotation layout.
 * RC leaders come from the shaping-notation Lego. Edge labels sit outside the
 * outline. Symmetrical shaping is drawn once, marked as both edges.
 */

import {
  dropShoulderSleeveSideXAtY,
  type DropShoulderSleeveDiagramFrame,
} from "./dropShoulderSleeveDiagramSvgShared";
import { DS_VB_H, DS_VB_W } from "./dropShoulderPatternDiagramSvgShared";
import {
  placeShapingNotationRcLandmarks,
  renderShapingNotationRcLeaders,
  type ShapingNotationRcLeaderLandmark,
} from "./legoBlocks/shapingNotationRcLeaders";
import {
  formatShapingNotationRcLabel,
  sleeveRcLandmarkY,
  sleeveShapingRcLandmarks,
} from "./shapingNotationRcLandmarks";
import type { DropShoulderSleeveShapingChartInput } from "./dropShoulderSleeveShapingChart";

const SHAPING_TOKEN = /^\d+s-\d+r-\d+x$/;
const ROW_SPAN_TOKEN = /^(\d+)r$/;

export type SleeveNotationLabel = {
  role: string;
  text: string;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  extra: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function yAlongBody(
  frame: DropShoulderSleeveDiagramFrame,
  direction: "cuff-up" | "top-down",
  t: number,
): number {
  const startY = direction === "top-down" ? frame.upperArmY : frame.cuffJoinY;
  const endY = direction === "top-down" ? frame.cuffJoinY : frame.upperArmY;
  return startY + (endY - startY) * clamp(t, 0, 1);
}

function outsideEdgeY(
  frame: DropShoulderSleeveDiagramFrame,
  edge: "wrist" | "upper-arm",
): number {
  const y = edge === "upper-arm" ? frame.upperArmY : frame.wristY;
  const outward = edge === "wrist" ? (frame.direction === "top-down" ? -1 : 1) : frame.direction === "top-down" ? 1 : -1;
  return y + outward * 22;
}

function rightLabelX(frame: DropShoulderSleeveDiagramFrame, y: number, text: string, fontSize: number): number {
  const outline = dropShoulderSleeveSideXAtY(frame, y, "right");
  const width = Math.max(fontSize, text.length * fontSize * 0.56);
  const preferred = outline + 10;
  const maxX = DS_VB_W - 8 - width;
  return Math.max(outline + 4, Math.min(preferred, maxX));
}

/**
 * Place cuff, cast-on, bind-off, row spans, and one both-edge shaping label.
 * `workingTokens` stay in knitting order (`6r`, `1s-6r-4x`, `9r`).
 */
export function layoutSleeveShapingNotationLabels(args: {
  frame: DropShoulderSleeveDiagramFrame;
  direction: "cuff-up" | "top-down";
  sleeveBodyRows: number;
  cuffLabel: string;
  castOnLabel: string;
  bindOffLabel: string;
  workingTokens: readonly string[];
  fontSize: number;
  castOnRole?: string;
  bindOffRole?: string;
}): SleeveNotationLabel[] {
  const { frame, direction } = args;
  const fontSize = args.fontSize;
  const castOnEdge = direction === "top-down" ? "upper-arm" : "wrist";
  const bindOffEdge = direction === "top-down" ? "wrist" : "upper-arm";
  const labels: SleeveNotationLabel[] = [];

  if (args.castOnLabel) {
    labels.push({
      role: args.castOnRole ?? "cast-on",
      text: args.castOnLabel,
      x: frame.midX,
      y: outsideEdgeY(frame, castOnEdge),
      anchor: "middle",
      extra: ` data-knit-edge="start" data-notation="${args.castOnLabel}"`,
    });
  }
  if (args.bindOffLabel) {
    labels.push({
      role: args.bindOffRole ?? "bind-off",
      text: args.bindOffLabel,
      x: frame.midX,
      y: outsideEdgeY(frame, bindOffEdge),
      anchor: "middle",
      extra: ` data-knit-edge="end" data-notation="${args.bindOffLabel}"`,
    });
  }
  if (args.cuffLabel) {
    const y = (frame.wristY + frame.cuffJoinY) / 2;
    labels.push({
      role: "cuff",
      text: args.cuffLabel,
      x: rightLabelX(frame, y, args.cuffLabel, fontSize),
      y,
      anchor: "start",
      extra: ` data-notation="${args.cuffLabel}"`,
    });
  }

  const firstShape = args.workingTokens.findIndex((token) => SHAPING_TOKEN.test(token));
  const lastShape = args.workingTokens.length - 1 - [...args.workingTokens].reverse().findIndex((token) => SHAPING_TOKEN.test(token));
  const before = firstShape === -1 ? [] : args.workingTokens.slice(0, firstShape).filter((token) => ROW_SPAN_TOKEN.test(token));
  const shaping = args.workingTokens.filter((token) => SHAPING_TOKEN.test(token));
  const after =
    firstShape === -1 ? args.workingTokens.filter((token) => ROW_SPAN_TOKEN.test(token)) : args.workingTokens.slice(lastShape + 1).filter((token) => ROW_SPAN_TOKEN.test(token));
  const rowsOf = (tokens: readonly string[]) =>
    tokens.reduce((sum, token) => sum + Number(ROW_SPAN_TOKEN.exec(token)?.[1] ?? 0), 0);
  const bodyRows = Math.max(1, args.sleeveBodyRows);
  const beforeRows = rowsOf(before);
  const afterRows = rowsOf(after);
  const shapingRows = Math.max(0, args.sleeveBodyRows - beforeRows - afterRows);

  const placeSpan = (tokens: readonly string[], t: number, span: "leading" | "trailing", orderStart: number) => {
    tokens.forEach((token, index) => {
      const y = yAlongBody(frame, direction, t) + (index - (tokens.length - 1) / 2) * (fontSize + 2);
      labels.push({
        role: "row-span",
        text: token,
        x: rightLabelX(frame, y, token, fontSize),
        y,
        anchor: "start",
        extra: ` data-span="${span}" data-notation="${token}" data-knit-order="${orderStart + index}"`,
      });
    });
  };

  placeSpan(before, beforeRows / 2 / bodyRows, "leading", 0);
  if (shaping.length > 0) {
    const t = (beforeRows + shapingRows / 2) / bodyRows;
    const midY = yAlongBody(frame, direction, Number.isFinite(t) ? t : 0.5);
    shaping.forEach((token, index) => {
      const y = midY + (index - (shaping.length - 1) / 2) * (fontSize + 2);
      labels.push({
        role: "sleeve-shaping",
        text: token,
        x: rightLabelX(frame, y, token, fontSize),
        y,
        anchor: "start",
        extra:
          ` data-both-edges="true" data-edge-scope="both" data-notation="${token}" data-knit-order="${before.length + index}"`,
      });
    });
  }
  placeSpan(after, (args.sleeveBodyRows - afterRows / 2) / bodyRows, "trailing", before.length + shaping.length);

  return labels;
}

export function renderSleeveShapingRcLandmarks(args: {
  frame: DropShoulderSleeveDiagramFrame;
  input: DropShoulderSleeveShapingChartInput;
  fontSize: number;
  fill: string;
  font: string;
  escape: (text: string) => string;
  formatNumber: (n: number) => string;
  obstacles?: { x: number; y: number; w: number; h: number }[];
}): string {
  const landmarks = sleeveShapingRcLandmarks(args.input);
  const marks: ShapingNotationRcLeaderLandmark[] = landmarks.map((landmark) => {
    const actionY = sleeveRcLandmarkY({
      direction: args.input.direction === "top-down" ? "top-down" : "cuff-up",
      landmark,
      wristY: args.frame.wristY,
      upperArmY: args.frame.upperArmY,
      cuffJoinY: args.frame.cuffJoinY,
      cuffRows: args.input.cuffRows,
      sleeveBodyRows: args.input.sleeveBodyRows,
    });
    return {
      id: landmark.label,
      kind: landmark.label,
      text: formatShapingNotationRcLabel(landmark.rowCounter),
      actionY,
      outlineX: dropShoulderSleeveSideXAtY(args.frame, actionY, "left"),
      priority: landmark.priority,
      rowCounter: landmark.rowCounter,
    };
  });
  const placed = placeShapingNotationRcLandmarks({
    landmarks: marks,
    side: "left",
    fontSize: args.fontSize,
    bounds: { minX: 4, minY: 8, maxX: DS_VB_W - 4, maxY: DS_VB_H - 8 },
    obstacles: args.obstacles,
    labelGap: 36,
  });
  return renderShapingNotationRcLeaders({
    placed,
    fill: args.fill,
    font: args.font,
    escape: args.escape,
    formatNumber: args.formatNumber,
  });
}
