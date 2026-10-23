/**
 * Basic Socks Shaping Notation SVG.
 * Same canonical socks-summary.svg geometry and overlay anchors as Stitches & Rows.
 * KIN tokens: coN, boN, Nr, ±Ns-Mr-Kx, and remaining-stitch labels.
 * RC labels use the sweater row-counter format and the same boundaries as Stitches & Rows.
 */

import {
  formatBodyRowsNotation,
  formatBindOffNotation,
  formatCastOnNotation,
} from "../sleevelessBackJapaneseNotation";
import { DS_FONT } from "../dropShoulderPatternDiagramSvgShared";
import { renderShapingNotationRcLeaders } from "../legoBlocks/shapingNotationRcLeaders";
import type { PlacedShapingNotationRcLeader } from "../legoBlocks/shapingNotationRcLeaders";
import { formatShapingNotationRcLabel } from "../shapingNotationRcLandmarks";
import { formatShapingSegment } from "../shapingNotationCompress";
import type { BasicSockCalc } from "./sockMath";
import {
  SOCK_CANONICAL_POLYGON_POINTS,
  SOCK_CANONICAL_SVG_HREF,
  SOCK_CANONICAL_VB_W,
  SOCK_STS_ROWS_PAD_RIGHT,
  escapeSockSvgText,
  fmtSockSvg,
  sockCanonicalDiagramFrame,
  sockCanonicalFlipVertical,
  sockCanonicalGeometryMarkup,
  sockCanonicalLabelPoint,
  sockCanonicalMapY,
  sockCanonicalReadingDirectionArrowMarkup,
  sockCanonicalStacked,
  sockCanonicalText,
} from "./sockCanonicalDiagram";
import {
  SOCK_DIAGRAM_RC_X,
  sockDiagramRcLabelMarkup,
  sockDiagramRcMilestones,
  sockDiagramSectionLabels,
  sockDiagramShowsSplitAnkle,
  OUTLINE,
  sockDiagramStackStep,
  sockFinishedDiagramTypography,
  sockGlyphAbove,
  sockGlyphBelow,
  type SockDiagramFamily,
  type SockDiagramRcMilestone,
} from "./sockPatternDiagramSvg";
import type { SidewaysPatternDiagramType } from "../legoBlocks/patternDiagramTypography";

const MUTED = "#4b5563";

/**
 * Center a notation stack inside the section, using the shared line gap.
 * `direction` is +1 toward larger Y and -1 toward smaller Y.
 */
const STACK_CLEAR = 8;

function stackStep(type: SidewaysPatternDiagramType): number {
  return sockDiagramStackStep(type.notation);
}

/** Center of a stack whose first line sits `clear` past `edge` in `direction`. */
function notationStackCenter(
  edge: number,
  lineCount: number,
  type: SidewaysPatternDiagramType,
  direction = 1,
): number {
  const step = stackStep(type);
  const first =
    direction > 0
      ? edge + STACK_CLEAR + sockGlyphAbove(type.notation)
      : edge - STACK_CLEAR - sockGlyphBelow(type.notation);
  return first + (direction * Math.max(0, lineCount - 1) * step) / 2;
}

function notationStackEnd(
  center: number,
  lineCount: number,
  type: SidewaysPatternDiagramType,
  direction: number,
  edge: "inner" | "outer",
): number {
  const span = Math.max(0, lineCount - 1) * stackStep(type);
  const first = center - (direction * span) / 2;
  const last = center + (direction * span) / 2;
  return edge === "outer" ? last : first;
}

/** Next middle-baseline label beyond the outer line of a stack. */
function labelBeyondStack(
  stackOuterY: number,
  stackDirection: number,
  type: SidewaysPatternDiagramType,
  labelSize: number,
): number {
  if (stackDirection > 0) {
    return stackOuterY + sockGlyphBelow(type.notation) + STACK_CLEAR + sockGlyphAbove(labelSize);
  }
  return stackOuterY - sockGlyphAbove(type.notation) - STACK_CLEAR - sockGlyphBelow(labelSize);
}

function magicFormulaLines(calc: BasicSockCalc): string[] {
  return calc.legShapingSchedule.steps.map((step) =>
    formatShapingSegment(step.sts, step.rows, step.times),
  );
}

function remainingStitchLabel(stitches: number): string {
  const n = Math.max(0, Math.round(stitches));
  return n === 1 ? "1 st" : `${n} sts`;
}

/**
 * Heel/toe callout: increase / remaining / decrease only.
 * RC milestones live on the right, not inside the shaping stacks.
 */
function shortRowNotationLines(
  calc: BasicSockCalc,
  part: "heel" | "toe",
): string[] {
  const shaping = calc[part];
  return [
    `+${formatShapingSegment(1, 1, shaping.shortRowOutSteps)}`,
    remainingStitchLabel(shaping.remainingStitches),
    `-${formatShapingSegment(1, 1, shaping.shortRowInSteps)}`,
  ];
}

/** Same construction RC boundaries as Stitches & Rows. */
export function sockShapingNotationRcMilestones(
  calc: BasicSockCalc,
  options?: { family?: SockDiagramFamily },
): SockDiagramRcMilestone[] {
  return sockDiagramRcMilestones(calc, options);
}

function point(
  id: Parameters<typeof sockCanonicalLabelPoint>[0],
  mirror: boolean,
  flipVertical: boolean,
): { x: number; y: number } {
  return sockCanonicalLabelPoint(id, mirror, flipVertical);
}

/**
 * Dotted leader from the silhouette edge at the instruction boundary to the
 * existing RC label. Positions stay on the boundary; only the shared sweater
 * leader stroke is added.
 */
/** Screen-right silhouette X at a canonical boundary, after Sock 2's mirror. */
export function sockShapingRcOutlineX(canonicalY: number, mirror: boolean): number {
  const values = SOCK_CANONICAL_POLYGON_POINTS.trim().split(/\s+/).map(Number);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < values.length; i += 2) {
    points.push({ x: values[i]!, y: values[i + 1]! });
  }
  const hits: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (canonicalY < Math.min(a.y, b.y) || canonicalY > Math.max(a.y, b.y)) continue;
    if (a.y === b.y) {
      hits.push(a.x, b.x);
      continue;
    }
    const t = (canonicalY - a.y) / (b.y - a.y);
    hits.push(a.x + t * (b.x - a.x));
  }
  const edge = mirror ? Math.min(...hits) : Math.max(...hits);
  return mirror ? SOCK_CANONICAL_VB_W - edge : edge;
}

function sockShapingRcLeaderMarkup(
  milestones: readonly SockDiagramRcMilestone[],
  mirror: boolean,
  flipVertical: boolean,
): string {
  const fontSize = sockFinishedDiagramTypography().rc;
  const placed: PlacedShapingNotationRcLeader[] = milestones.map((milestone, index) => {
    const y = sockCanonicalMapY(milestone.canonicalY, flipVertical);
    const outlineX = sockShapingRcOutlineX(milestone.canonicalY, mirror);
    return {
      id: milestone.id,
      kind: milestone.id,
      text: formatShapingNotationRcLabel(milestone.rc),
      actionY: y,
      outlineX,
      labelX: SOCK_DIAGRAM_RC_X,
      labelY: y,
      anchor: "start",
      leaderX1: SOCK_DIAGRAM_RC_X - 3,
      leaderY: y,
      leaderX2: outlineX,
      fontSize,
      stacked: false,
      priority: index,
      rowCounter: milestone.rc,
    };
  });
  return renderShapingNotationRcLeaders({
    placed,
    fill: MUTED,
    font: DS_FONT,
    escape: escapeSockSvgText,
    formatNumber: fmtSockSvg,
  }).replace(/<text\b[^>]*>[\s\S]*?<\/text>/g, "");
}

export function buildSockShapingNotationLines(
  calc: BasicSockCalc,
  options?: { family?: SockDiagramFamily },
): {
  castOn: string;
  leg: string[];
  ankle: string;
  heel: string[];
  foot: string;
  toe: string[];
  order: BasicSockCalc["constructionDirection"];
} {
  const knitStart =
    calc.constructionDirection === "cuff-to-toe" ? calc.legStitches : calc.totalSockStitches;
  const combinedLeg = !sockDiagramShowsSplitAnkle(calc, options?.family ?? "socks");
  const leg = combinedLeg
    ? [formatBodyRowsNotation(calc.legRows)]
    : calc.legShapingSchedule.knitOrder.direction === "none"
      ? [formatBodyRowsNotation(calc.legShapingRowsAvailable)]
      : magicFormulaLines(calc);
  return {
    castOn: formatCastOnNotation(knitStart),
    leg: leg.filter(Boolean),
    ankle: combinedLeg ? "" : formatBodyRowsNotation(calc.ankleStraightRows),
    heel: shortRowNotationLines(calc, "heel"),
    foot: formatBodyRowsNotation(calc.straightFootRows),
    toe: shortRowNotationLines(calc, "toe"),
    order: calc.constructionDirection,
  };
}

export function buildSockShapingNotationDiagramSvg(
  calc: BasicSockCalc,
  options?: { mirror?: boolean; family?: SockDiagramFamily },
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
  const notation = buildSockShapingNotationLines(calc, { family });
  const type = sockFinishedDiagramTypography();
  const labels: string[] = [];
  const yAt = (canonicalY: number) => sockCanonicalMapY(canonicalY, flipVertical);
  const directionX = point("direction", mirror, false).x;
  const castOnAnchor = flipVertical ? "castOnCuff" : "castOnToe";
  const finishText = flipVertical ? "waste yarn" : formatBindOffNotation(calc.legStitches);
  const step = stackStep(type);
  const heelStackY = notationStackCenter(OUTLINE.heelBottom, notation.heel.length, type, 1);
  const toeStackY = notationStackCenter(OUTLINE.toeBottom, notation.toe.length, type, 1);
  const cuffEdgeY = OUTLINE.top - STACK_CLEAR - sockGlyphBelow(type.notation);
  const toeOuter = notation.toe.length
    ? notationStackEnd(toeStackY, notation.toe.length, type, 1, "outer")
    : OUTLINE.toeBottom;
  const toeEdgeY = labelBeyondStack(toeOuter, 1, type, type.notation);
  const castOnY = yAt(flipVertical ? cuffEdgeY : toeEdgeY);
  const finishY = yAt(flipVertical ? toeEdgeY : cuffEdgeY);
  const upperEdge = Math.min(castOnY, finishY);
  const directionY =
    upperEdge - sockGlyphAbove(type.notation) - STACK_CLEAR - sockGlyphBelow(type.piece);

  labels.push(
    sockCanonicalText({
      id: "direction",
      x: directionX,
      y: directionY,
      text: calc.constructionDirection === "cuff-to-toe" ? "Cuff to Toe" : "Toe Up",
      size: type.piece,
      fill: MUTED,
      weight: String(type.pieceWeight),
    }),
  );
  labels.push(
    sockCanonicalText({
      id: castOnAnchor,
      x: directionX,
      y: castOnY,
      text: notation.castOn,
      size: type.notation,
      weight: "700",
    }),
  );
  labels.push(
    sockCanonicalText({
      id: "finish",
      x: directionX,
      y: finishY,
      text: finishText,
      size: type.notation,
      fill: MUTED,
    }),
  );

  const sections = sockDiagramSectionLabels({ showsAnkle, mirror, flipVertical });
  for (const section of sections) {
    labels.push(
      sockCanonicalText({
        id: section.id,
        x: section.x,
        y: section.y,
        text: section.name,
        size: type.piece,
        weight: String(type.pieceWeight),
      }),
    );
  }

  labels.push(
    sockCanonicalStacked({
      id: "heel-shape",
      x: point("heelCenter", mirror, flipVertical).x,
      y: yAt(heelStackY),
      lines: notation.heel,
      size: type.notation,
      lineGap: step,
    }),
  );
  labels.push(
    sockCanonicalStacked({
      id: "toe-shape",
      x: point("toeCenter", mirror, flipVertical).x,
      y: yAt(toeStackY),
      lines: notation.toe,
      size: type.notation,
      lineGap: step,
    }),
  );

  if (showsAnkle && calc.legShapingSchedule.knitOrder.direction !== "none") {
    const legNameY = OUTLINE.ankleY > 0 ? 90 : (OUTLINE.top + OUTLINE.heelTop) / 2;
    const legCenter = notationStackCenter(
      legNameY + sockGlyphBelow(type.piece),
      notation.leg.length,
      type,
      1,
    );
    labels.push(
      sockCanonicalStacked({
        id: "leg-shape",
        x: point("sectionLeg", mirror, flipVertical).x,
        y: yAt(legCenter),
        lines: notation.leg,
        size: type.notation,
        lineGap: step,
      }),
    );
  }

  const rcMilestones = sockShapingNotationRcMilestones(calc, { family });
  for (const milestone of rcMilestones) {
    labels.push(
      sockDiagramRcLabelMarkup(milestone, sockCanonicalMapY(milestone.canonicalY, flipVertical)),
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${frame.viewBox}" ` +
    `role="img" aria-label="Basic Socks shaping notation" ` +
    `data-sock-diagram-mode="shaping-notation" data-sock-layout="canonical" ` +
    `data-sock-geometry-src="${escapeSockSvgText(SOCK_CANONICAL_SVG_HREF)}" ` +
    `data-sock-geometry-key="${frame.geometryKey}" ` +
    `data-sock-work-half="${frame.workHalf}" ` +
    `data-sock-of-pair="${mirror ? "2" : "1"}" ` +
    `data-sock-knit-order="${calc.constructionDirection}" ` +
    `data-sock-diagram-family="${family}" ` +
    `data-sock-flip-vertical="${flipVertical ? "true" : "false"}" ` +
    `data-sock-reading-direction="bottom-to-top" ` +
    `data-sock-notation-order="${calc.constructionDirection}" ` +
    `data-sock-notation-leg-direction="${calc.legShapingSchedule.knitOrder.direction}" ` +
    `data-sock-cast-on="${escapeSockSvgText(notation.castOn)}" ` +
    `data-sock-notation-leg="${escapeSockSvgText(notation.leg.join("|"))}" ` +
    `data-sock-notation-ankle="${escapeSockSvgText(notation.ankle)}" ` +
    `data-sock-notation-heel="${escapeSockSvgText(notation.heel.join("|"))}" ` +
    `data-sock-notation-foot="${escapeSockSvgText(notation.foot)}" ` +
    `data-sock-notation-toe="${escapeSockSvgText(notation.toe.join("|"))}" ` +
    rcMilestones.map((milestone) => `data-sock-${milestone.id}="${milestone.rc}"`).join(" ") +
    ` ` +
    `width="100%" height="auto">` +
    sockCanonicalGeometryMarkup({ mirror, flipVertical }) +
    sockCanonicalReadingDirectionArrowMarkup() +
    `<g data-sock-diagram-rc-leaders>` +
    sockShapingRcLeaderMarkup(rcMilestones, mirror, flipVertical) +
    `</g>` +
    `<g data-sock-diagram-labels data-sock-text-unmirrored="true">` +
    labels.join("") +
    `</g>` +
    `</svg>`
  );
}
