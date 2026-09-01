/**
 * Basic Socks Stitches & Rows SVG.
 * Canonical construction from socks-summary.svg; labels from {@link BasicSockCalc} only.
 * Dimension lines follow Drop Shoulder Stitches & Rows (thin stroke + perpendicular end caps).
 */

import type { BasicSockCalc } from "./sockMath";
import {
  SOCK_CANONICAL_SVG_HREF,
  SOCK_CANONICAL_VB_W,
  SOCK_STS_ROWS_PAD_RIGHT,
  escapeSockSvgText,
  fmtSockSvg,
  sockCanonicalCalcLabelFields,
  sockCanonicalDiagramFrame,
  sockCanonicalFlipVertical,
  sockCanonicalGeometryMarkup,
  sockCanonicalLabelPoint,
  sockCanonicalMapY,
  sockCanonicalReadingDirectionArrowMarkup,
  sockCanonicalStacked,
  sockCanonicalText,
} from "./sockCanonicalDiagram";

export type SockPatternDiagramMode = "pattern";

/** Outline extrema from socks-summary.svg polygon — overlay placement only. */
const OUTLINE = {
  left: 12,
  right: 276,
  top: 8,
  bottom: 472,
  split: 148,
  ankleY: 184,
  heelTop: 216,
  heelMid: 240,
  heelBottom: 264,
  toeTop: 424,
  toeMid: 448,
  toeBottom: 472,
} as const;

/** Match Drop Shoulder Stitches & Rows dimension styling. */
const DIM_STROKE = "#52682d";
const DIM_MUTED = "#4b5563";
const DIM_SW = 1.4;
const DIM_CAP = 7;
const DIM_CAP_T = 1.4;
const DIM_GAP = 18;
const DIM_LABEL_GAP = 10;
const DIM_ABOVE = 8;
const CUFF_DIM_Y = OUTLINE.top - 14;
const V_DIM_X = OUTLINE.right + DIM_GAP;
const WORK_STS_INSET = 28;

export type SockDiagramRcMilestoneId =
  | "rc-start"
  | "rc-after-first"
  | "rc-after-second"
  | "rc-finish";

export type SockDiagramRcMilestone = {
  id: SockDiagramRcMilestoneId;
  rc: number;
  canonicalY: number;
};

function formatSockDiagramRc(rc: number): string {
  const n = Math.max(0, Math.floor(rc));
  return `RC: ${String(n).padStart(3, "0")}`;
}

/**
 * Stitches & Rows RC labels at construction milestones (not per-section row counts).
 * Values are the pattern's local row-counter at that boundary.
 */
export function sockDiagramRcMilestones(calc: BasicSockCalc): SockDiagramRcMilestone[] {
  if (calc.constructionDirection === "toe-up") {
    const finishRc =
      calc.legShapingRowsAvailable > 0 ? calc.legShapingRowsAvailable : calc.ankleStraightRows;
    return [
      { id: "rc-start", rc: 0, canonicalY: OUTLINE.toeBottom },
      { id: "rc-after-first", rc: 0, canonicalY: OUTLINE.toeTop },
      { id: "rc-after-second", rc: calc.straightFootRows, canonicalY: OUTLINE.heelBottom },
      { id: "rc-finish", rc: finishRc, canonicalY: OUTLINE.top },
    ];
  }
  return [
    { id: "rc-start", rc: 0, canonicalY: OUTLINE.top },
    { id: "rc-after-first", rc: calc.legRows, canonicalY: OUTLINE.heelTop },
    { id: "rc-after-second", rc: 0, canonicalY: OUTLINE.heelBottom },
    { id: "rc-finish", rc: calc.straightFootRows, canonicalY: OUTLINE.toeBottom },
  ];
}

function point(
  id: Parameters<typeof sockCanonicalLabelPoint>[0],
  mirror: boolean,
  flipVertical: boolean,
): { x: number; y: number } {
  return sockCanonicalLabelPoint(id, mirror, flipVertical);
}

function outlineX(x: number, mirror: boolean): number {
  return mirror ? SOCK_CANONICAL_VB_W - x : x;
}

function stitchCountLabel(n: number): string {
  const sts = Math.max(0, Math.round(n));
  return sts === 1 ? "1 st" : `${sts} sts`;
}

function sockDimEndCap(x: number, y: number, verticalLine: boolean): string {
  if (verticalLine) {
    return (
      `<rect data-sock-end-cap="true" x="${fmtSockSvg(x - DIM_CAP / 2)}" y="${fmtSockSvg(y - DIM_CAP_T / 2)}" ` +
      `width="${DIM_CAP}" height="${DIM_CAP_T}" fill="${DIM_STROKE}"/>`
    );
  }
  return (
    `<rect data-sock-end-cap="true" x="${fmtSockSvg(x - DIM_CAP_T / 2)}" y="${fmtSockSvg(y - DIM_CAP / 2)}" ` +
    `width="${DIM_CAP_T}" height="${DIM_CAP}" fill="${DIM_STROKE}"/>`
  );
}

function sockHDim(role: string, x1: number, x2: number, y: number): string {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  return [
    `<g data-sock-dim="${escapeSockSvgText(role)}" data-sock-dim-axis="h" data-end-cap="true">`,
    `<line x1="${fmtSockSvg(left)}" y1="${fmtSockSvg(y)}" x2="${fmtSockSvg(right)}" y2="${fmtSockSvg(y)}" ` +
      `stroke="${DIM_STROKE}" stroke-width="${DIM_SW}" fill="none"/>`,
    sockDimEndCap(left, y, false),
    sockDimEndCap(right, y, false),
    `</g>`,
  ].join("");
}

function sockVDim(role: string, x: number, y1: number, y2: number): string {
  const top = Math.min(y1, y2);
  const bot = Math.max(y1, y2);
  return [
    `<g data-sock-dim="${escapeSockSvgText(role)}" data-sock-dim-axis="v" data-end-cap="true">`,
    `<line x1="${fmtSockSvg(x)}" y1="${fmtSockSvg(top)}" x2="${fmtSockSvg(x)}" y2="${fmtSockSvg(bot)}" ` +
      `stroke="${DIM_STROKE}" stroke-width="${DIM_SW}" fill="none"/>`,
    sockDimEndCap(x, top, true),
    sockDimEndCap(x, bot, true),
    `</g>`,
  ].join("");
}

export function buildSockPatternDiagramSvg(
  calc: BasicSockCalc,
  options?: { mode?: SockPatternDiagramMode; mirror?: boolean },
): string {
  const mirror = options?.mirror === true;
  const flipVertical = sockCanonicalFlipVertical(calc.constructionDirection);
  const frame = sockCanonicalDiagramFrame({
    mirror,
    flipVertical,
    padRight: SOCK_STS_ROWS_PAD_RIGHT,
  });
  const fields = sockCanonicalCalcLabelFields(calc);
  const left = outlineX(OUTLINE.left, mirror);
  const right = outlineX(OUTLINE.right, mirror);
  const split = outlineX(OUTLINE.split, mirror);
  const cuffMidX = (left + right) / 2;
  const heldMidX = (left + split) / 2;
  const yAt = (canonicalY: number) => sockCanonicalMapY(canonicalY, flipVertical);
  const labels: string[] = [];
  const dims: string[] = [];

  dims.push(sockHDim("cuff-width", left, right, yAt(CUFF_DIM_Y)));
  dims.push(sockHDim("heel-held-width", left, split, yAt(OUTLINE.heelMid)));
  dims.push(sockHDim("heel-work-width", split, right, yAt(OUTLINE.heelMid)));
  dims.push(sockHDim("toe-held-width", left, split, yAt(OUTLINE.toeMid)));
  dims.push(sockHDim("toe-work-width", split, right, yAt(OUTLINE.toeMid)));
  dims.push(sockVDim("leg-length", V_DIM_X, yAt(OUTLINE.top), yAt(OUTLINE.ankleY)));
  dims.push(sockVDim("ankle-length", V_DIM_X, yAt(OUTLINE.ankleY), yAt(OUTLINE.heelTop)));
  dims.push(sockVDim("heel-length", V_DIM_X, yAt(OUTLINE.heelTop), yAt(OUTLINE.heelBottom)));
  dims.push(sockVDim("foot-length", V_DIM_X, yAt(OUTLINE.heelBottom), yAt(OUTLINE.toeTop)));
  dims.push(sockVDim("toe-length", V_DIM_X, yAt(OUTLINE.toeTop), yAt(OUTLINE.toeBottom)));

  labels.push(
    sockCanonicalText({
      id: "cuff",
      x: cuffMidX,
      y: yAt(CUFF_DIM_Y - DIM_ABOVE),
      text: fields.cuffStsLabel,
      size: 12,
      fill: DIM_MUTED,
    }),
  );
  if (fields.cuffStitches !== fields.tubeStitches) {
    const tube = point("tube", mirror, flipVertical);
    labels.push(
      sockCanonicalText({
        id: "tube",
        x: tube.x,
        y: tube.y,
        text: fields.tubeStsLabel,
        size: 12,
      }),
    );
  }

  const startEdge = flipVertical ? "castOnCuff" : "castOnToe";
  const finishEdge = flipVertical ? "castOnToe" : "castOnCuff";
  const castOn = point(startEdge, mirror, flipVertical);
  const finish = point(finishEdge, mirror, flipVertical);
  labels.push(
    sockCanonicalText({
      id: "cast-on",
      x: castOn.x,
      y: castOn.y,
      text: "cast on",
      size: 11,
      fill: DIM_MUTED,
    }),
  );
  labels.push(
    sockCanonicalText({
      id: "finish",
      x: finish.x,
      y: finish.y,
      text: flipVertical ? "waste yarn" : "bind off",
      size: 11,
      fill: DIM_MUTED,
    }),
  );

  for (const [id, name] of [
    ["sectionLeg", "Leg"],
    ["sectionAnkle", "Ankle"],
    ["sectionHeel", "Heel"],
    ["sectionFoot", "Sole and Instep"],
    ["sectionToe", "Toe"],
  ] as const) {
    const at = point(id, mirror, flipVertical);
    labels.push(sockCanonicalText({ id, x: at.x, y: at.y, text: name, size: 12 }));
  }

  const heelCenter = point("heelCenter", mirror, flipVertical);
  const toeCenter = point("toeCenter", mirror, flipVertical);
  const workStsX = outlineX(OUTLINE.right - WORK_STS_INSET, mirror);
  labels.push(
    sockCanonicalText({
      id: "heel-center",
      x: heelCenter.x,
      y: heelCenter.y,
      text: fields.heelCenterLabel,
      size: 11,
    }),
  );
  labels.push(
    sockCanonicalText({
      id: "heel-work",
      x: workStsX,
      y: yAt(OUTLINE.heelMid - DIM_ABOVE),
      text: fields.heelWorkLabel,
      size: 11,
      fill: DIM_MUTED,
    }),
  );
  labels.push(
    sockCanonicalText({
      id: "toe-center",
      x: toeCenter.x,
      y: toeCenter.y,
      text: fields.toeCenterLabel,
      size: 11,
    }),
  );
  labels.push(
    sockCanonicalText({
      id: "toe-work",
      x: workStsX,
      y: yAt(OUTLINE.toeMid - DIM_ABOVE),
      text: fields.toeWorkLabel,
      size: 11,
      fill: DIM_MUTED,
    }),
  );

  labels.push(
    sockCanonicalText({
      id: "heel-held",
      x: heldMidX,
      y: yAt(OUTLINE.heelMid - DIM_ABOVE),
      text: stitchCountLabel(fields.heelHeldStitches),
      size: 12,
      fill: DIM_MUTED,
    }),
  );
  labels.push(
    sockCanonicalText({
      id: "toe-held",
      x: heldMidX,
      y: yAt(OUTLINE.toeMid - DIM_ABOVE),
      text: stitchCountLabel(fields.toeHeldStitches),
      size: 12,
      fill: DIM_MUTED,
    }),
  );

  const measureX = V_DIM_X + DIM_LABEL_GAP;
  for (const [id, lines, y1, y2] of [
    ["measureLeg", fields.measureLeg, OUTLINE.top, OUTLINE.ankleY],
    ["measureAnkle", fields.measureAnkle, OUTLINE.ankleY, OUTLINE.heelTop],
    ["measureHeel", fields.measureHeel, OUTLINE.heelTop, OUTLINE.heelBottom],
    ["measureFoot", fields.measureFoot, OUTLINE.heelBottom, OUTLINE.toeTop],
    ["measureToe", fields.measureToe, OUTLINE.toeTop, OUTLINE.toeBottom],
  ] as const) {
    labels.push(
      sockCanonicalStacked({
        id,
        x: measureX,
        y: (yAt(y1) + yAt(y2)) / 2,
        lines: [...lines],
        size: 11,
        anchor: "start",
        fill: DIM_MUTED,
      }),
    );
  }

  const rcMilestones = sockDiagramRcMilestones(calc);
  for (const milestone of rcMilestones) {
    labels.push(
      sockCanonicalText({
        id: milestone.id,
        x: measureX,
        y: yAt(milestone.canonicalY),
        text: formatSockDiagramRc(milestone.rc),
        size: 11,
        anchor: "start",
        fill: DIM_MUTED,
      }),
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${frame.viewBox}" ` +
    `role="img" aria-label="Basic Socks stitches and rows" ` +
    `data-sock-diagram-mode="pattern" data-sock-layout="canonical" ` +
    `data-sock-geometry-src="${escapeSockSvgText(SOCK_CANONICAL_SVG_HREF)}" ` +
    `data-sock-geometry-key="${frame.geometryKey}" ` +
    `data-sock-work-half="${frame.workHalf}" ` +
    `data-sock-of-pair="${mirror ? "2" : "1"}" ` +
    `data-sock-knit-order="${calc.constructionDirection}" ` +
    `data-sock-flip-vertical="${flipVertical ? "true" : "false"}" ` +
    `data-sock-reading-direction="bottom-to-top" ` +
    `data-sock-rc-start="${rcMilestones[0]!.rc}" ` +
    `data-sock-rc-after-first="${rcMilestones[1]!.rc}" ` +
    `data-sock-rc-after-second="${rcMilestones[2]!.rc}" ` +
    `data-sock-rc-finish="${rcMilestones[3]!.rc}" ` +
    `data-sock-cuff-sts="${fields.cuffStitches}" data-sock-tube-sts="${fields.tubeStitches}" ` +
    `data-sock-leg-rows="${fields.upperLegRows}" data-sock-ankle-rows="${fields.ankleRows}" ` +
    `data-sock-foot-rows="${fields.footRows}" data-sock-heel-short-row="${fields.heelShortRow}" ` +
    `data-sock-toe-short-row="${fields.toeShortRow}" ` +
    `data-sock-heel-work="${fields.heelWorkingStitches}" data-sock-heel-hold="${fields.heelHeldStitches}" ` +
    `data-sock-heel-center="${fields.heelRemainingStitches}" ` +
    `data-sock-toe-work="${fields.toeWorkingStitches}" data-sock-toe-hold="${fields.toeHeldStitches}" ` +
    `data-sock-toe-center="${fields.toeRemainingStitches}" ` +
    `data-sock-leg-in="${fields.upperLegInches}" ` +
    `data-sock-ankle-in="${fields.ankleInches}" ` +
    `data-sock-heel-in="${fields.heelInches}" ` +
    `data-sock-foot-in="${fields.footInches}" ` +
    `data-sock-toe-in="${fields.toeInches}" ` +
    `width="100%" height="auto">` +
    sockCanonicalGeometryMarkup({ mirror, flipVertical }) +
    sockCanonicalReadingDirectionArrowMarkup() +
    `<g data-sock-diagram-dims>` +
    dims.join("") +
    `</g>` +
    `<g data-sock-diagram-labels data-sock-text-unmirrored="true">` +
    labels.join("") +
    `</g>` +
    `</svg>`
  );
}
