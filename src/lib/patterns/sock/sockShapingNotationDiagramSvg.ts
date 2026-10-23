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
import { formatShapingSegment } from "../shapingNotationCompress";
import type { BasicSockCalc } from "./sockMath";
import {
  SOCK_CANONICAL_SVG_HREF,
  SOCK_STS_ROWS_PAD_RIGHT,
  escapeSockSvgText,
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
  sockDiagramRcLabelMarkup,
  sockDiagramRcMilestones,
  sockDiagramSectionLabels,
  sockDiagramShowsSplitAnkle,
  sockFinishedDiagramTypography,
  type SockDiagramFamily,
  type SockDiagramRcMilestone,
} from "./sockPatternDiagramSvg";
import type { SidewaysPatternDiagramType } from "../legoBlocks/patternDiagramTypography";

const MUTED = "#4b5563";

/**
 * Center a notation stack inside the section, using the shared line gap.
 * `direction` is +1 toward larger Y and -1 toward smaller Y.
 */
function notationStackCenter(
  sectionY: number,
  lineCount: number,
  type: SidewaysPatternDiagramType,
  direction = 1,
): number {
  const span = Math.max(0, lineCount - 1) * type.notationGap;
  const first = sectionY + direction * (type.piece / 2 + type.notationGap);
  return first + (direction * span) / 2;
}

function notationStackEnd(
  center: number,
  lineCount: number,
  type: SidewaysPatternDiagramType,
  direction: number,
  edge: "inner" | "outer",
): number {
  const span = Math.max(0, lineCount - 1) * type.notationGap;
  const first = center - (direction * span) / 2;
  const last = center + (direction * span) / 2;
  return edge === "outer" ? last : first;
}

/** Push an edge label outward when a notation stack would land on it. */
function clearEdgeLabel(
  anchorY: number,
  stackY: number,
  type: SidewaysPatternDiagramType,
  outward: "down" | "up",
): number {
  const gap = type.notation * 0.6 + type.notationGap * 0.5;
  if (outward === "down") return Math.max(anchorY, stackY + gap);
  return Math.min(anchorY, stackY - gap);
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
  const directionX = point("direction", mirror, false).x;
  const castOnAnchor = flipVertical ? "castOnCuff" : "castOnToe";
  const finishAnchor = flipVertical ? "castOnToe" : "castOnCuff";
  const castOn = point(castOnAnchor, mirror, flipVertical);
  const finish = point(finishAnchor, mirror, flipVertical);
  const finishText = flipVertical
    ? "waste yarn"
    : formatBindOffNotation(calc.legStitches);

  labels.push(
    sockCanonicalText({
      id: "direction",
      x: directionX,
      y: -18,
      text: calc.constructionDirection === "cuff-to-toe" ? "Cuff to Toe" : "Toe Up",
      size: type.piece,
      fill: MUTED,
      weight: String(type.pieceWeight),
    }),
  );
  labels.push(
    sockCanonicalText({
      id: castOnAnchor,
      x: castOn.x,
      y: castOn.y,
      text: notation.castOn,
      size: type.notation,
      weight: "700",
    }),
  );
  labels.push(
    sockCanonicalText({
      id: "finish",
      x: finish.x,
      y: finish.y,
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

  const sectionAt = (id: "sectionHeel" | "sectionToe" | "sectionLeg" | "sectionAnkle" | "sectionFoot") =>
    sections.find((section) => section.id === id)?.y ?? point(id, mirror, flipVertical).y;
  const interior = (sectionId: "sectionHeel" | "sectionToe", centerId: "heelCenter" | "toeCenter") =>
    Math.sign(point(centerId, mirror, flipVertical).y - sectionAt(sectionId)) || 1;
  const toeDir = interior("sectionToe", "toeCenter");
  const heelDir = interior("sectionHeel", "heelCenter");
  const toeStackY = notationStackCenter(sectionAt("sectionToe"), notation.toe.length, type, toeDir);
  const castOnNearToe = Math.abs(castOn.y - toeStackY) <= Math.abs(finish.y - toeStackY);
  const toeAnchorY = castOnNearToe ? castOn.y : finish.y;
  const toeOutward = toeAnchorY >= toeStackY ? "down" : "up";
  const toeEdge = notation.toe.length
    ? notationStackEnd(toeStackY, notation.toe.length, type, toeDir, "outer")
    : toeAnchorY;
  const clearedToeY = clearEdgeLabel(toeAnchorY, toeEdge, type, toeOutward);
  const castOnY = castOnNearToe ? clearedToeY : castOn.y;
  const finishY = castOnNearToe ? finish.y : clearedToeY;
  const directionY =
    Math.min(castOnY, finishY) - (type.notation + type.piece) / 2 - type.notationGap * 0.65;
  labels[0] = sockCanonicalText({
    id: "direction",
    x: directionX,
    y: directionY,
    text: calc.constructionDirection === "cuff-to-toe" ? "Cuff to Toe" : "Toe Up",
    size: type.piece,
    fill: MUTED,
    weight: String(type.pieceWeight),
  });
  labels[1] = sockCanonicalText({
    id: castOnAnchor,
    x: castOn.x,
    y: castOnY,
    text: notation.castOn,
    size: type.notation,
    weight: "700",
  });
  labels[2] = sockCanonicalText({
    id: "finish",
    x: finish.x,
    y: finishY,
    text: finishText,
    size: type.notation,
    fill: MUTED,
  });
  labels.push(
    sockCanonicalStacked({
      id: "heel-shape",
      x: point("heelCenter", mirror, flipVertical).x,
      y: notationStackCenter(sectionAt("sectionHeel"), notation.heel.length, type, heelDir),
      lines: notation.heel,
      size: type.notation,
      lineGap: type.notationGap,
    }),
  );
  labels.push(
    sockCanonicalStacked({
      id: "toe-shape",
      x: point("toeCenter", mirror, flipVertical).x,
      y: toeStackY,
      lines: notation.toe,
      size: type.notation,
      lineGap: type.notationGap,
    }),
  );

  if (showsAnkle && calc.legShapingSchedule.knitOrder.direction !== "none") {
    const legAt = point("sectionLeg", mirror, flipVertical);
    const legToward = sections.some((section) => section.id === "sectionAnkle")
      ? sectionAt("sectionAnkle")
      : sectionAt("sectionHeel");
    const legDir = Math.sign(legToward - legAt.y) || 1;
    labels.push(
      sockCanonicalStacked({
        id: "leg-shape",
        x: legAt.x,
        y: notationStackCenter(legAt.y, notation.leg.length, type, legDir),
        lines: notation.leg,
        size: type.notation,
        lineGap: type.notationGap,
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
    `<g data-sock-diagram-labels data-sock-text-unmirrored="true">` +
    labels.join("") +
    `</g>` +
    `</svg>`
  );
}
