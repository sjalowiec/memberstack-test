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
  type SockDiagramFamily,
  type SockDiagramRcMilestone,
} from "./sockPatternDiagramSvg";

const MUTED = "#4b5563";
const LEG_SHAPE_OFFSET = 18;

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
      size: 11,
      fill: MUTED,
      weight: "600",
    }),
  );
  labels.push(
    sockCanonicalText({
      id: castOnAnchor,
      x: castOn.x,
      y: castOn.y,
      text: notation.castOn,
      size: 13,
      weight: "700",
    }),
  );
  labels.push(
    sockCanonicalText({
      id: "finish",
      x: finish.x,
      y: finish.y,
      text: finishText,
      size: 11,
      fill: MUTED,
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

  const heelShape = point("heelCenter", mirror, flipVertical);
  const toeShape = point("toeCenter", mirror, flipVertical);
  labels.push(
    sockCanonicalStacked({
      id: "heel-shape",
      x: heelShape.x,
      y: heelShape.y,
      lines: notation.heel,
      size: 10,
    }),
  );
  labels.push(
    sockCanonicalStacked({
      id: "toe-shape",
      x: toeShape.x,
      y: toeShape.y,
      lines: notation.toe,
      size: 10,
    }),
  );

  if (showsAnkle && calc.legShapingSchedule.knitOrder.direction !== "none") {
    const legAt = point("sectionLeg", mirror, flipVertical);
    labels.push(
      sockCanonicalStacked({
        id: "leg-shape",
        x: legAt.x,
        y: legAt.y + LEG_SHAPE_OFFSET,
        lines: notation.leg,
        size: 10,
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
