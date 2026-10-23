/**
 * Basic Socks Stitches & Rows SVG.
 * Canonical construction from socks-summary.svg; labels from {@link BasicSockCalc} only.
 * Dimension lines follow Drop Shoulder Stitches & Rows (thin stroke + perpendicular end caps).
 */

import { DS_FONT } from "../dropShoulderPatternDiagramSvgShared";
import { sidewaysPatternDiagramTypography } from "../legoBlocks/patternDiagramTypography";
import {
  formatPatternDiagramMeasurement,
  formatStitchesRowsDiagramLabel,
  stitchesRowsLabelMarkup,
} from "../legoBlocks/stitchesRowsDiagramLabel";
import { formatShapingNotationRcLabel } from "../shapingNotationRcLandmarks";
import type { BasicSockCalc } from "./sockMath";
import {
  SOCK_CANONICAL_ANCHORS,
  SOCK_CANONICAL_SVG_HREF,
  SOCK_CANONICAL_VB_W,
  SOCK_STS_ROWS_PAD_RIGHT,
  sockDiagramCanvasWidth,
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

/** Basic Socks keeps the ankle band. Christmas Stocking is one Leg in both directions. */
export type SockDiagramFamily = "socks" | "christmas-stocking";

export type SockDiagramBuildOptions = {
  mode?: SockPatternDiagramMode;
  mirror?: boolean;
  family?: SockDiagramFamily;
};

/** Outline extrema from socks-summary.svg polygon — overlay placement only. */
export const OUTLINE = {
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
const V_DIM_X = OUTLINE.right + DIM_GAP;
/** Approximate em width used to keep the row counter clear of the measurement. */
const SOCK_LABEL_EM = 0.6;
/**
 * Poppins glyph box around a middle-baseline label, as a fraction of font size.
 * Measured in the finished-pattern sidebar (ink above the anchor, ink below it).
 */
const GLYPH_ABOVE = 0.85;
const GLYPH_BELOW = 0.53;
/** Clear space between a label and the next label or dimension line. */
const LABEL_CLEAR = 8;

export function sockGlyphAbove(size: number): number {
  return size * GLYPH_ABOVE;
}

export function sockGlyphBelow(size: number): number {
  return size * GLYPH_BELOW;
}

/** Center-to-center step that keeps middle-baseline lines from touching. */
export function sockDiagramStackStep(size: number): number {
  return Math.ceil(sockGlyphAbove(size) + sockGlyphBelow(size) + LABEL_CLEAR);
}

/**
 * Both sock diagrams share one viewBox, so they share one resolved type.
 * Sizes come from the sweater diagram scale, not from local font-size numbers.
 */
export function sockFinishedDiagramTypography() {
  return sidewaysPatternDiagramTypography(sockDiagramCanvasWidth(SOCK_STS_ROWS_PAD_RIGHT));
}

const SOCK_DIAGRAM_TYPE = sockFinishedDiagramTypography();
const MEASURE_LABEL_X = V_DIM_X + DIM_LABEL_GAP;

function sockLabelWidth(text: string, size: number): number {
  return Math.ceil(text.length * size * SOCK_LABEL_EM);
}

/** Right of the two-line measurement so the counter stays on its boundary row. */
export const SOCK_DIAGRAM_RC_X =
  MEASURE_LABEL_X + sockLabelWidth("0000 rows", SOCK_DIAGRAM_TYPE.stitch) + 8;

export type SockDiagramRcMilestoneId =
  | "rc-leg"
  | "rc-ankle"
  | "rc-heel"
  | "rc-foot"
  | "rc-toe"
  | "rc-bind-off";

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
 * Basic Socks keeps the ankle band. A Christmas Stocking is one Leg in both
 * directions: the sock ankle rows are already inside the finished leg length.
 */
export function sockDiagramShowsSplitAnkle(
  _calc: BasicSockCalc,
  family: SockDiagramFamily = "socks",
): boolean {
  return family !== "christmas-stocking";
}

/**
 * Row-counter labels at the boundaries the written instructions mark.
 * Cuff-down starts the leg at 000. The ankle continues that counter, so the
 * dashed boundary shows the leg ending RC. The heel starts at the full leg
 * count. The foot restarts at 000, and the toe stops at the foot ending RC.
 * Toe-up socks reset at the toe, the foot, and the ankle. After the ankle rows
 * the counter reads that ankle total at the leg boundary. The leg then resets
 * and is knit to its own ending RC, labeled on the top bind-off edge.
 * A toe-up stocking resets once after the heel and knits the finished leg on
 * that counter, so the bind-off edge reads the full leg total.
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
      marks.push({ id: "rc-ankle", rc: 0, canonicalY: OUTLINE.heelTop });
      if (calc.legShapingRowsAvailable > 0) {
        marks.push({
          id: "rc-leg",
          rc: calc.ankleStraightRows,
          canonicalY: OUTLINE.ankleY,
        });
      }
    } else {
      marks.push({ id: "rc-leg", rc: 0, canonicalY: OUTLINE.heelTop });
    }
    marks.push({
      id: "rc-bind-off",
      rc: showsAnkle
        ? calc.legShapingRowsAvailable > 0
          ? calc.legShapingRowsAvailable
          : calc.ankleStraightRows
        : calc.legRows,
      canonicalY: OUTLINE.top,
    });
    return marks;
  }
  const marks: SockDiagramRcMilestone[] = [
    { id: "rc-leg", rc: 0, canonicalY: OUTLINE.top },
  ];
  if (showsAnkle && calc.ankleStraightRows > 0 && calc.legShapingRowsAvailable > 0) {
    marks.push({
      id: "rc-ankle",
      rc: calc.legShapingRowsAvailable,
      canonicalY: OUTLINE.ankleY,
    });
  }
  marks.push(
    { id: "rc-heel", rc: calc.legRows, canonicalY: OUTLINE.heelTop },
    { id: "rc-foot", rc: 0, canonicalY: OUTLINE.heelBottom },
    { id: "rc-toe", rc: calc.straightFootRows, canonicalY: OUTLINE.toeTop },
  );
  return marks;
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

/**
 * Section titles stay inside the outline.
 * Heel and Toe sit in the open center of the diamond, off the width lines.
 * Sole and Instep sits toward the toe so the foot side of the heel can hold
 * the heel stitch counts and the shaping stack.
 */
function sectionNameCanonicalY(id: SockCanonicalAnchorId, showsAnkle: boolean): number {
  if (id === "sectionLeg" && !showsAnkle) return (OUTLINE.top + OUTLINE.heelTop) / 2;
  if (id === "sectionHeel") return (OUTLINE.heelTop + OUTLINE.heelBottom) / 2;
  if (id === "sectionToe") return (OUTLINE.toeTop + OUTLINE.toeBottom) / 2;
  if (id === "sectionFoot") return OUTLINE.toeTop - 18;
  return SOCK_CANONICAL_ANCHORS[id].y;
}

export function sockDiagramSectionLabels(args: {
  showsAnkle: boolean;
  mirror: boolean;
  flipVertical: boolean;
}): Array<{ id: SockCanonicalAnchorId; name: string; x: number; y: number }> {
  return SECTION_NAMES.filter(([id]) => args.showsAnkle || id !== "sectionAnkle").map(([id, name]) => {
    const at = sockCanonicalLabelPoint(id, args.mirror, args.flipVertical);
    const y = sockCanonicalMapY(sectionNameCanonicalY(id, args.showsAnkle), args.flipVertical);
    return { id, name, x: at.x, y };
  });
}

export function sockDiagramRcLabelMarkup(milestone: SockDiagramRcMilestone, y: number): string {
  return sockCanonicalText({
    id: milestone.id,
    x: SOCK_DIAGRAM_RC_X,
    y,
    text: formatShapingNotationRcLabel(milestone.rc),
    size: SOCK_DIAGRAM_TYPE.rc,
    anchor: "start",
    fill: DIM_MUTED,
  });
}

function measureAnchorY(midY: number): number {
  const gap = Math.round(SOCK_DIAGRAM_TYPE.stitch * 0.95);
  return midY - gap / 2;
}

function measureBlock(anchorY: number): { top: number; bottom: number } {
  const gap = Math.round(SOCK_DIAGRAM_TYPE.stitch * 0.95);
  return {
    top: anchorY - SOCK_DIAGRAM_TYPE.stitch * 1.1,
    bottom: anchorY + gap + SOCK_DIAGRAM_TYPE.row * 0.27,
  };
}

/**
 * Short sections (ankle, heel, toe) are shorter than a two-line measurement.
 * Keep each block on its span when it fits, and walk the rest down the column
 * so the shared sweater label does not cover its neighbor.
 */
function spreadMeasureAnchors(
  spans: ReadonlyArray<{ id: string; midY: number }>,
): Map<string, number> {
  const ordered = [...spans].sort((a, b) => a.midY - b.midY);
  const placed = new Map<string, number>();
  let previousBottom = Number.NEGATIVE_INFINITY;
  for (const span of ordered) {
    let anchor = measureAnchorY(span.midY);
    let block = measureBlock(anchor);
    if (block.top < previousBottom + LABEL_CLEAR) {
      anchor += previousBottom + LABEL_CLEAR - block.top;
      block = measureBlock(anchor);
    }
    placed.set(span.id, anchor);
    previousBottom = block.bottom;
  }
  return placed;
}

function sockSectionMeasureMarkup(span: SockDiagramMeasureSpan, x: number, anchorY: number): string {
  const measurement =
    span.inches > 0 ? formatPatternDiagramMeasurement(span.inches, "in") : "";
  const label = formatStitchesRowsDiagramLabel(span.rows, "rows", measurement);
  return stitchesRowsLabelMarkup({
    label,
    x,
    y: label.includes("\n") ? anchorY : anchorY + Math.round(SOCK_DIAGRAM_TYPE.stitch * 0.95) / 2,
    anchor: "start",
    fill: DIM_MUTED,
    countSize: SOCK_DIAGRAM_TYPE.stitch,
    measureSize: SOCK_DIAGRAM_TYPE.row,
    fontFamily: DS_FONT,
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
  const stitch = SOCK_DIAGRAM_TYPE.stitch;
  const notation = SOCK_DIAGRAM_TYPE.notation;
  const cuffLine = OUTLINE.top - 6;
  const cuffStsY = cuffLine - LABEL_CLEAR - sockGlyphBelow(stitch);
  const cuffEdgeY = cuffStsY - sockGlyphAbove(stitch) - LABEL_CLEAR - sockGlyphBelow(notation);
  const heelLine = OUTLINE.heelBottom + 4;
  const heelCountY = heelLine + LABEL_CLEAR + sockGlyphAbove(stitch);
  const heelCenterY =
    heelCountY + sockGlyphBelow(stitch) + LABEL_CLEAR + sockGlyphAbove(stitch);
  const toeLine = OUTLINE.toeBottom + 4;
  const toeCountY = toeLine + LABEL_CLEAR + sockGlyphAbove(stitch);
  const toeCenterY = toeCountY + sockGlyphBelow(stitch) + LABEL_CLEAR + sockGlyphAbove(stitch);
  const toeEdgeY = toeCenterY + sockGlyphBelow(stitch) + LABEL_CLEAR + sockGlyphAbove(notation);
  const workStsX = outlineX(OUTLINE.right - 46, mirror);

  dims.push(sockHDim("cuff-width", left, right, yAt(cuffLine)));
  dims.push(sockHDim("heel-held-width", left, split, yAt(heelLine)));
  dims.push(sockHDim("heel-work-width", split, right, yAt(heelLine)));
  dims.push(sockHDim("toe-held-width", left, split, yAt(toeLine)));
  dims.push(sockHDim("toe-work-width", split, right, yAt(toeLine)));
  const measures = sockDiagramMeasureSpans(calc, family);
  for (const span of measures) {
    dims.push(sockVDim(span.dim, V_DIM_X, yAt(span.y1), yAt(span.y2)));
  }

  labels.push(
    sockCanonicalText({
      id: "cuff",
      x: cuffMidX,
      y: yAt(cuffStsY),
      text: fields.cuffStsLabel,
      size: stitch,
      fill: DIM_MUTED,
    }),
  );
  if (fields.cuffStitches !== fields.tubeStitches) {
    const tube = point("tube", mirror, flipVertical);
    const ankleTop = sectionNameCanonicalY("sectionAnkle", true) - sockGlyphAbove(SOCK_DIAGRAM_TYPE.piece);
    const tubeY = showsAnkle
      ? ankleTop - LABEL_CLEAR - sockGlyphBelow(stitch)
      : SOCK_CANONICAL_ANCHORS.tube.y;
    labels.push(
      sockCanonicalText({
        id: "tube",
        x: tube.x,
        y: yAt(tubeY),
        text: fields.tubeStsLabel,
        size: stitch,
      }),
    );
  }

  const castOnAtCuff = flipVertical;
  labels.push(
    sockCanonicalText({
      id: "cast-on",
      x: cuffMidX,
      y: yAt(castOnAtCuff ? cuffEdgeY : toeEdgeY),
      text: "cast on",
      size: notation,
      fill: DIM_MUTED,
    }),
  );
  labels.push(
    sockCanonicalText({
      id: "finish",
      x: cuffMidX,
      y: yAt(castOnAtCuff ? toeEdgeY : cuffEdgeY),
      text: flipVertical ? "waste yarn" : "bind off",
      size: notation,
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
        size: SOCK_DIAGRAM_TYPE.piece,
        weight: String(SOCK_DIAGRAM_TYPE.pieceWeight),
      }),
    );
  }

  const heelCenter = point("heelCenter", mirror, flipVertical);
  const toeCenter = point("toeCenter", mirror, flipVertical);
  labels.push(
    sockCanonicalText({
      id: "heel-center",
      x: heelCenter.x,
      y: yAt(heelCenterY),
      text: fields.heelCenterLabel,
      size: stitch,
    }),
  );
  labels.push(
    sockCanonicalText({
      id: "heel-work",
      x: workStsX,
      y: yAt(heelCountY),
      text: fields.heelWorkLabel,
      size: stitch,
      fill: DIM_MUTED,
    }),
  );
  labels.push(
    sockCanonicalText({
      id: "toe-center",
      x: toeCenter.x,
      y: yAt(toeCenterY),
      text: fields.toeCenterLabel,
      size: stitch,
    }),
  );
  labels.push(
    sockCanonicalText({
      id: "toe-work",
      x: workStsX,
      y: yAt(toeCountY),
      text: fields.toeWorkLabel,
      size: stitch,
      fill: DIM_MUTED,
    }),
  );

  labels.push(
    sockCanonicalText({
      id: "heel-held",
      x: heldMidX,
      y: yAt(heelCountY),
      text: stitchCountLabel(fields.heelHeldStitches),
      size: stitch,
      fill: DIM_MUTED,
    }),
  );
  labels.push(
    sockCanonicalText({
      id: "toe-held",
      x: heldMidX,
      y: yAt(toeCountY),
      text: stitchCountLabel(fields.toeHeldStitches),
      size: stitch,
      fill: DIM_MUTED,
    }),
  );

  const measureAnchors = spreadMeasureAnchors(
    measures.map((span) => ({
      id: span.id,
      midY: (yAt(span.y1) + yAt(span.y2)) / 2,
    })),
  );
  for (const span of measures) {
    const midY = (yAt(span.y1) + yAt(span.y2)) / 2;
    const anchorY = measureAnchors.get(span.id) ?? measureAnchorY(midY);
    const gap = Math.round(stitch * 0.95);
    if (Math.abs(anchorY - measureAnchorY(midY)) > 1) {
      dims.push(
        `<line data-sock-label-leader="${span.id}" x1="${fmtSockSvg(V_DIM_X)}" y1="${fmtSockSvg(midY)}" x2="${fmtSockSvg(MEASURE_LABEL_X - 4)}" y2="${fmtSockSvg(anchorY + gap / 2)}" stroke="${DIM_STROKE}" stroke-width="1" fill="none"/>`,
      );
    }
    labels.push(sockSectionMeasureMarkup(span, MEASURE_LABEL_X, anchorY));
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
    sockCanonicalGeometryMarkup({ mirror, flipVertical, omitAnkleBoundary: !showsAnkle }) +
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
