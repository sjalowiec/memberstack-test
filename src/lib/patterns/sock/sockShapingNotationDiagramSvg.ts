/**
 * Basic Socks Shaping Notation SVG.
 * Same canonical socks-summary.svg geometry and overlay anchors as Stitches & Rows.
 * KIN tokens: coN, boN, Nr, rcNNN, ±Ns-Mr-Kx, and remaining-stitch labels.
 * Right-side labels are the four construction RC milestones only (no section Nr).
 */

import {
  formatBodyRowsNotation,
  formatBindOffNotation,
  formatCastOnNotation,
  formatRcNotation,
} from "../sleevelessBackJapaneseNotation";
import { formatShapingSegment } from "../shapingNotationCompress";
import type { BasicSockCalc } from "./sockMath";
import {
  SOCK_CANONICAL_ANCHORS,
  SOCK_CANONICAL_SVG_HREF,
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
  sockDiagramRcMilestones,
  type SockDiagramRcMilestone,
} from "./sockPatternDiagramSvg";

const MUTED = "#4b5563";
const RC_X = SOCK_CANONICAL_ANCHORS.measureLeg.x;
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

/**
 * Same four construction RC values as Stitches & Rows.
 * Toe-Up places the post-toe RC 0 at the ankle / heel transition instead of
 * the toe top, matching the four Japanese-diagram milestones.
 */
export function sockShapingNotationRcMilestones(
  calc: BasicSockCalc,
): SockDiagramRcMilestone[] {
  const milestones = sockDiagramRcMilestones(calc);
  if (calc.constructionDirection !== "toe-up") return milestones;
  const ankleHeelY = sockDiagramRcMilestones({
    ...calc,
    constructionDirection: "cuff-to-toe",
  }).find((milestone) => milestone.id === "rc-after-first")!.canonicalY;
  return milestones.map((milestone) =>
    milestone.id === "rc-after-first"
      ? { ...milestone, canonicalY: ankleHeelY }
      : milestone,
  );
}

function point(
  id: Parameters<typeof sockCanonicalLabelPoint>[0],
  mirror: boolean,
  flipVertical: boolean,
): { x: number; y: number } {
  return sockCanonicalLabelPoint(id, mirror, flipVertical);
}

export function buildSockShapingNotationLines(calc: BasicSockCalc): {
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
  const leg =
    calc.legShapingSchedule.knitOrder.direction === "none"
      ? [formatBodyRowsNotation(calc.legShapingRowsAvailable)]
      : magicFormulaLines(calc);
  return {
    castOn: formatCastOnNotation(knitStart),
    leg: leg.filter(Boolean),
    ankle: formatBodyRowsNotation(calc.ankleStraightRows),
    heel: shortRowNotationLines(calc, "heel"),
    foot: formatBodyRowsNotation(calc.straightFootRows),
    toe: shortRowNotationLines(calc, "toe"),
    order: calc.constructionDirection,
  };
}

export function buildSockShapingNotationDiagramSvg(
  calc: BasicSockCalc,
  options?: { mirror?: boolean },
): string {
  const mirror = options?.mirror === true;
  const flipVertical = sockCanonicalFlipVertical(calc.constructionDirection);
  const frame = sockCanonicalDiagramFrame({ mirror, flipVertical });
  const notation = buildSockShapingNotationLines(calc);
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

  if (calc.legShapingSchedule.knitOrder.direction !== "none") {
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

  const rcMilestones = sockShapingNotationRcMilestones(calc);
  for (const milestone of rcMilestones) {
    labels.push(
      sockCanonicalText({
        id: milestone.id,
        x: RC_X,
        y: sockCanonicalMapY(milestone.canonicalY, flipVertical),
        text: formatRcNotation(milestone.rc),
        size: 11,
        anchor: "start",
        fill: MUTED,
      }),
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
    `data-sock-rc-start="${rcMilestones[0]!.rc}" ` +
    `data-sock-rc-after-first="${rcMilestones[1]!.rc}" ` +
    `data-sock-rc-after-second="${rcMilestones[2]!.rc}" ` +
    `data-sock-rc-finish="${rcMilestones[3]!.rc}" ` +
    `width="100%" height="auto">` +
    sockCanonicalGeometryMarkup({ mirror, flipVertical }) +
    sockCanonicalReadingDirectionArrowMarkup() +
    `<g data-sock-diagram-labels data-sock-text-unmirrored="true">` +
    labels.join("") +
    `</g>` +
    `</svg>`
  );
}
