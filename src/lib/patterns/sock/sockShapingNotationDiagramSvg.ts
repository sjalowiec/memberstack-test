/**
 * Basic Socks Shaping Notation SVG.
 * Same canonical socks-summary.svg geometry and overlay anchors as Stitches & Rows.
 * KIN tokens: coN, boN, Nr, rcNNN, ±Ns-Mr-Kx, and remaining-stitch labels.
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
  SOCK_CANONICAL_SVG_HREF,
  escapeSockSvgText,
  sockCanonicalDiagramFrame,
  sockCanonicalFlipVertical,
  sockCanonicalGeometryMarkup,
  sockCanonicalLabelPoint,
  sockCanonicalReadingDirectionArrowMarkup,
  sockCanonicalStacked,
  sockCanonicalText,
} from "./sockCanonicalDiagram";

const MUTED = "#4b5563";

function magicFormulaLines(calc: BasicSockCalc): string[] {
  return calc.legShapingSchedule.steps.map((step) =>
    formatShapingSegment(step.sts, step.rows, step.times),
  );
}

function remainingStitchLabel(stitches: number): string {
  const n = Math.max(0, Math.round(stitches));
  return n === 1 ? "1 st" : `${n} sts`;
}

/** Local RC where heel/toe short-row shaping begins. */
function shortRowStartRc(
  calc: BasicSockCalc,
  part: "heel" | "toe",
): number {
  if (part === "toe") {
    return calc.constructionDirection === "cuff-to-toe" ? calc.straightFootRows : 0;
  }
  return calc.constructionDirection === "cuff-to-toe"
    ? calc.legRows
    : calc.straightFootRows;
}

/**
 * One heel/toe callout: start RC, then increase / remaining / decrease.
 * Does not include hold-half notation.
 */
function shortRowNotationLines(
  calc: BasicSockCalc,
  part: "heel" | "toe",
): string[] {
  const shaping = calc[part];
  return [
    formatRcNotation(shortRowStartRc(calc, part)),
    `+${formatShapingSegment(1, 1, shaping.shortRowOutSteps)}`,
    remainingStitchLabel(shaping.remainingStitches),
    `-${formatShapingSegment(1, 1, shaping.shortRowInSteps)}`,
  ];
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

  const heelAngle = point("heelWork", mirror, flipVertical);
  const heelShape = point("heelCenter", mirror, flipVertical);
  const toeAngle = point("toeWork", mirror, flipVertical);
  const toeShape = point("toeCenter", mirror, flipVertical);
  labels.push(
    sockCanonicalText({
      id: "heel-rc",
      x: heelAngle.x,
      y: heelAngle.y,
      text: notation.heel[0] ?? "",
      size: 10,
    }),
  );
  labels.push(
    sockCanonicalStacked({
      id: "heel-shape",
      x: heelShape.x,
      y: heelShape.y,
      lines: notation.heel.slice(1),
      size: 10,
    }),
  );
  labels.push(
    sockCanonicalText({
      id: "toe-rc",
      x: toeAngle.x,
      y: toeAngle.y,
      text: notation.toe[0] ?? "",
      size: 10,
    }),
  );
  labels.push(
    sockCanonicalStacked({
      id: "toe-shape",
      x: toeShape.x,
      y: toeShape.y,
      lines: notation.toe.slice(1),
      size: 10,
    }),
  );

  const measureLeg = point("measureLeg", mirror, flipVertical);
  labels.push(
    sockCanonicalStacked({
      id: "measureLeg",
      x: measureLeg.x,
      y: measureLeg.y,
      lines: notation.leg,
      size: 11,
      anchor: "start",
    }),
  );
  for (const [id, line] of [
    ["measureAnkle", notation.ankle],
    ["measureHeel", formatBodyRowsNotation(calc.heel.shortRowInSteps)],
    ["measureFoot", notation.foot],
    ["measureToe", formatBodyRowsNotation(calc.toe.shortRowInSteps)],
  ] as const) {
    const at = point(id, mirror, flipVertical);
    labels.push(sockCanonicalText({ id, x: at.x, y: at.y, text: line, size: 11, anchor: "start" }));
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
    `width="100%" height="auto">` +
    sockCanonicalGeometryMarkup({ mirror, flipVertical }) +
    sockCanonicalReadingDirectionArrowMarkup() +
    `<g data-sock-diagram-labels data-sock-text-unmirrored="true">` +
    labels.join("") +
    `</g>` +
    `</svg>`
  );
}
