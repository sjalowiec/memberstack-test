/**
 * Basic Socks Stitches & Rows SVG.
 * Canonical construction from socks-summary.svg; labels from {@link BasicSockCalc} only.
 * Dimension lines follow Drop Shoulder Stitches & Rows (thin stroke + perpendicular end caps).
 */

import {
  formatPatternDiagramMeasurement,
  formatStitchesRowsDiagramLabel,
  stitchesRowsLabelMarkup,
} from "../legoBlocks/stitchesRowsDiagramLabel";
import { formatShapingNotationRcLabel } from "../shapingNotationRcLandmarks";
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
  sockCanonicalText,
  type SockCanonicalAnchorId,
} from "./sockCanonicalDiagram";

export type SockPatternDiagramMode = "pattern";

/** Basic Socks keeps the ankle band. Cuff-down Christmas Stocking uses one Leg. */
export type SockDiagramFamily = "socks" | "christmas-stocking";

export type SockDiagramBuildOptions = {
  mode?: SockPatternDiagramMode;
  mirror?: boolean;
  family?: SockDiagramFamily;
};

const DIAGRAM_FONT = "Poppins, system-ui, Arial, sans-serif";
const MEASURE_COUNT_SIZE = 13;
const MEASURE_SIZE = 11;

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
/** Right of the two-line measurement so the counter stays on its boundary row. */
export const SOCK_DIAGRAM_RC_X = V_DIM_X + DIM_LABEL_GAP + 72;

export type SockDiagramRcMilestoneId = "rc-leg" | "rc-ankle" | "rc-heel" | "rc-foot" | "rc-toe";

export type SockDiagramRcMilestone = {
  id: SockDiagramRcMilestoneId;
  rc: number;
  canonicalY: number;
};

type SockDiagramMeasureSpan = {
  id: "measureLeg" | "measureAnkle" | "measureHeel" | "measureFoot" | "measureToe";
  dim: "leg-length" | "ankle-length" | "heel-length" | "foot-length" | "toe-length";
  y1: number;
  y2: number;
  rows: number;
  inches: number;
};

/**
 * Cuff-down Christmas Stocking writes one Leg from the top edge to the heel.
 * Basic Socks, and toe-up stockings, keep the ankle band.
 */
export function sockDiagramShowsSplitAnkle(
  calc: BasicSockCalc,
  family: SockDiagramFamily = "socks",
): boolean {
  return !(family === "christmas-stocking" && calc.constructionDirection === "cuff-to-toe");
}

/**
 * Row-counter labels at the boundaries the written instructions mark.
 * Cuff-down continues through the ankle and stops at the heel on the full leg
 * count, restarts the foot at 000, and stops the toe at the foot ending RC.
 * Toe-up resets at the toe and the foot, stops the heel at the foot ending RC,
 * then shows 000 at the ankle and resets again at the leg.
 */
export function sockDiagramRcMilestones(
  calc: BasicSockCalc,
  options?: { family?: SockDiagramFamily },
): SockDiagramRcMilestone[] {
  const showsAnkle = sockDiagramShowsSplitAnkle(calc, options?.family ?? "socks");
  if (calc.constructionDirection === "toe-up") {
    const marks: SockDiagramRcMilestone[] = [
      { id: "rc-toe", rc: 0, canonicalY: OUTLINE.toeBottom },
      { id: "rc-foot", rc: 0, canonicalY: OUTLINE.toeTop },
      { id: "rc-heel", rc: calc.straightFootRows, canonicalY: OUTLINE.heelBottom },
    ];
    if (showsAnkle && calc.ankleStraightRows > 0) {
      marks.push(
        { id: "rc-ankle", rc: 0, canonicalY: OUTLINE.heelTop },
        { id: "rc-leg", rc: 0, canonicalY: OUTLINE.ankleY },
      );
    } else {
      marks.push({ id: "rc-leg", rc: 0, canonicalY: OUTLINE.heelTop });
    }
    return marks;
  }
  return [
    { id: "rc-leg", rc: 0, canonicalY: OUTLINE.top },
    { id: "rc-heel", rc: calc.legRows, canonicalY: OUTLINE.heelTop },
    { id: "rc-foot", rc: 0, canonicalY: OUTLINE.heelBottom },
    { id: "rc-toe", rc: calc.straightFootRows, canonicalY: OUTLINE.toeTop },
  ];
}

export function sockDiagramMeasureSpans(
  calc: BasicSockCalc,
  family: SockDiagramFamily = "socks",
): SockDiagramMeasureSpan[] {
  const showsAnkle = sockDiagramShowsSplitAnkle(calc, family);
  const spans: SockDiagramMeasureSpan[] = [];
  if (showsAnkle) {
    spans.push({
      id: "measureLeg",
      dim: "leg-length",
      y1: OUTLINE.top,
      y2: OUTLINE.ankleY,
      rows: Math.max(0, calc.legShapingRowsAvailable),
      inches: Math.max(0, calc.legLengthInches - calc.ankleStraightLengthInches),
    });
    spans.push({
      id: "measureAnkle",
      dim: "ankle-length",
      y1: OUTLINE.ankleY,
      y2: OUTLINE.heelTop,
      rows: Math.max(0, calc.ankleStraightRows),
      inches: calc.ankleStraightLengthInches,
    });
  } else {
    spans.push({
      id: "measureLeg",
      dim: "leg-length",
      y1: OUTLINE.top,
      y2: OUTLINE.heelTop,
      rows: calc.legRows,
      inches: calc.legLengthInches,
    });
  }
  spans.push(
    {
      id: "measureHeel",
      dim: "heel-length",
      y1: OUTLINE.heelTop,
      y2: OUTLINE.heelBottom,
      rows: calc.heel.shortRowDepthRows,
      inches: calc.heelDepthInches,
    },
    {
      id: "measureFoot",
      dim: "foot-length",
      y1: OUTLINE.heelBottom,
      y2: OUTLINE.toeTop,
      rows: Math.max(0, calc.straightFootRows),
      inches: calc.straightFootLengthInches,
    },
    {
      id: "measureToe",
      dim: "toe-length",
      y1: OUTLINE.toeTop,
      y2: OUTLINE.toeBottom,
      rows: calc.toe.shortRowDepthRows,
      inches: calc.toeDepthInches,
    },
  );
  return spans;
}

const SECTION_NAMES = [
  ["sectionLeg", "Leg"],
  ["sectionAnkle", "Ankle"],
  ["sectionHeel", "Heel"],
  ["sectionFoot", "Sole and Instep"],
  ["sectionToe", "Toe"],
] as const satisfies ReadonlyArray<readonly [SockCanonicalAnchorId, string]>;

export function sockDiagramSectionLabels(args: {
  showsAnkle: boolean;
  mirror: boolean;
  flipVertical: boolean;
}): Array<{ id: SockCanonicalAnchorId; name: string; x: number; y: number }> {
  return SECTION_NAMES.filter(([id]) => args.showsAnkle || id !== "sectionAnkle").map(([id, name]) => {
    const at = sockCanonicalLabelPoint(id, args.mirror, args.flipVertical);
    const y =
      id === "sectionLeg" && !args.showsAnkle
        ? sockCanonicalMapY((OUTLINE.top + OUTLINE.heelTop) / 2, args.flipVertical)
        : at.y;
    return { id, name, x: at.x, y };
  });
}

export function sockDiagramRcLabelMarkup(milestone: SockDiagramRcMilestone, y: number): string {
  return sockCanonicalText({
    id: milestone.id,
    x: SOCK_DIAGRAM_RC_X,
    y,
    text: formatShapingNotationRcLabel(milestone.rc),
    size: 12,
    anchor: "start",
    fill: DIM_MUTED,
  });
}

function sockSectionMeasureMarkup(span: SockDiagramMeasureSpan, x: number, midY: number): string {
  const measurement =
    span.inches > 0 ? formatPatternDiagramMeasurement(span.inches, "in") : "";
  const label = formatStitchesRowsDiagramLabel(span.rows, "rows", measurement);
  const gap = Math.round(MEASURE_COUNT_SIZE * 0.95);
  return stitchesRowsLabelMarkup({
    label,
    x,
    y: label.includes("\n") ? midY - gap / 2 : midY,
    anchor: "start",
    fill: DIM_MUTED,
    countSize: MEASURE_COUNT_SIZE,
    measureSize: MEASURE_SIZE,
    fontFamily: DIAGRAM_FONT,
    extra: ` data-sock-label="${span.id}"`,
    fmt: fmtSockSvg,
  });
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
  options?: SockDiagramBuildOptions,
): string {
  const mirror = options?.mirror === true;
  const family = options?.family ?? "socks";
  const showsAnkle = sockDiagramShowsSplitAnkle(calc, family);
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
  const measures = sockDiagramMeasureSpans(calc, family);
  for (const span of measures) {
    dims.push(sockVDim(span.dim, V_DIM_X, yAt(span.y1), yAt(span.y2)));
  }

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

  for (const section of sockDiagramSectionLabels({ showsAnkle, mirror, flipVertical })) {
    labels.push(
      sockCanonicalText({
        id: section.id,
        x: section.x,
        y: section.y,
        text: section.name,
        size: 12,
      }),
    );
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
  for (const span of measures) {
    labels.push(sockSectionMeasureMarkup(span, measureX, (yAt(span.y1) + yAt(span.y2)) / 2));
  }

  const rcMilestones = sockDiagramRcMilestones(calc, { family });
  for (const milestone of rcMilestones) {
    labels.push(sockDiagramRcLabelMarkup(milestone, yAt(milestone.canonicalY)));
  }
  const legMeasure = measures.find((span) => span.id === "measureLeg");
  const ankleMeasure = measures.find((span) => span.id === "measureAnkle");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${frame.viewBox}" ` +
    `role="img" aria-label="Basic Socks stitches and rows" ` +
    `data-sock-diagram-mode="pattern" data-sock-layout="canonical" ` +
    `data-sock-geometry-src="${escapeSockSvgText(SOCK_CANONICAL_SVG_HREF)}" ` +
    `data-sock-geometry-key="${frame.geometryKey}" ` +
    `data-sock-work-half="${frame.workHalf}" ` +
    `data-sock-of-pair="${mirror ? "2" : "1"}" ` +
    `data-sock-knit-order="${calc.constructionDirection}" ` +
    `data-sock-diagram-family="${family}" ` +
    `data-sock-flip-vertical="${flipVertical ? "true" : "false"}" ` +
    `data-sock-reading-direction="bottom-to-top" ` +
    rcMilestones.map((milestone) => `data-sock-${milestone.id}="${milestone.rc}"`).join(" ") +
    ` ` +
    `data-sock-cuff-sts="${fields.cuffStitches}" data-sock-tube-sts="${fields.tubeStitches}" ` +
    `data-sock-leg-rows="${legMeasure?.rows ?? 0}" data-sock-ankle-rows="${ankleMeasure?.rows ?? 0}" ` +
    `data-sock-foot-rows="${fields.footRows}" data-sock-heel-short-row="${fields.heelShortRow}" ` +
    `data-sock-toe-short-row="${fields.toeShortRow}" ` +
    `data-sock-heel-work="${fields.heelWorkingStitches}" data-sock-heel-hold="${fields.heelHeldStitches}" ` +
    `data-sock-heel-center="${fields.heelRemainingStitches}" ` +
    `data-sock-toe-work="${fields.toeWorkingStitches}" data-sock-toe-hold="${fields.toeHeldStitches}" ` +
    `data-sock-toe-center="${fields.toeRemainingStitches}" ` +
    `data-sock-leg-in="${legMeasure?.inches ?? 0}" ` +
    `data-sock-ankle-in="${ankleMeasure?.inches ?? 0}" ` +
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
