/**
 * Heel & Toe Shaping Map.
 *
 * Draws the short-row needle actions already written in the instruction
 * steps. It does not apply the one-third rule or any other sizing formula.
 * Heel and toe share one map only when those actions are the same.
 *
 * Carriage-pass numbers on the map are local. They are not the pattern row
 * counter.
 */

import type {
  SockInstructionDocument,
  SockInstructionSection,
  SockNeedleHalf,
} from "./sock/sockInstructionModel";

export const HEEL_TOE_SHAPING_MAP_TITLE = "Heel & Toe Shaping Map";

/** Square cells, same proportion as the neckline shaping map. */
const CELL = 18;
const MAJOR_EVERY = 10;
const PASS_NUMBER_INTERVAL = 2;
const ROW_NUMBER_FONT = 20;
const CENTER_LABEL_FONT = 12;
const EDGE_LABEL_FONT = 13;
const LABEL_EM = 0.62;

export type HeelToeShapingMapPass = {
  /** 1-based carriage pass within this map. */
  pass: number;
  action: "hold" | "return";
  /** Edge where this pass places a needle into hold or returns one to work. */
  side: SockNeedleHalf;
  inWorkStitches: number;
  /** Inclusive left stitch still in work after this pass. */
  inWorkLeft: number;
  /** Exclusive right edge after this pass. */
  inWorkRight: number;
};

export type HeelToeShapingMapModel = {
  title: typeof HEEL_TOE_SHAPING_MAP_TITLE;
  sock: SockInstructionDocument["sock"];
  constructionDirection: SockInstructionDocument["constructionDirection"];
  carriageStartSide: SockNeedleHalf;
  workingStitches: number;
  remainingStitches: number;
  passes: HeelToeShapingMapPass[];
};

export type HeelToeShapingMapResult =
  | { ok: true; map: HeelToeShapingMapModel }
  | { ok: false; reasons: string[] };

type ShortRowActions = {
  inRows: number;
  outRows: number;
  workingStitches: number;
  remainingStitches: number;
  endWorkingStitches: number;
  carriageStartSide: SockNeedleHalf;
};

function opposite(side: SockNeedleHalf): SockNeedleHalf {
  return side === "right" ? "left" : "right";
}

function estimateTextWidthPx(text: string, fontSizePx: number): number {
  return Math.max(0, text.length) * fontSizePx * LABEL_EM;
}

function escapeXml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

function readShortRowActions(section: SockInstructionSection): ShortRowActions | string {
  const inn = section.steps.find((step) => step.type === "short-row-in");
  const out = section.steps.find((step) => step.type === "short-row-out");
  if (!inn || inn.type !== "short-row-in") return `${section.title} has no short-row narrowing step.`;
  if (!out || out.type !== "short-row-out") return `${section.title} has no short-row widening step.`;
  if (!section.orientation) return `${section.title} has no carriage side.`;
  const ensure = section.steps.find((step) => step.type === "ensure-carriage");
  if (ensure && ensure.type === "ensure-carriage" && ensure.side !== section.orientation.carriageStartSide) {
    return `${section.title} carriage check does not match its starting side.`;
  }
  if (inn.needleRelative !== "carriage-side" || inn.everyRow !== true) {
    return `${section.title} narrowing is not one carriage-side needle every row.`;
  }
  if (out.needleRelative !== "opposite-carriage" || out.everyRow !== true) {
    return `${section.title} widening is not one opposite-carriage needle every row.`;
  }
  if (out.remainingStitches !== inn.remainingStitches) {
    return `${section.title} widening does not start from the same center stitches.`;
  }
  if (out.endWorkingStitches !== inn.startWorkingStitches) {
    return `${section.title} does not return to its starting working stitches.`;
  }
  return {
    inRows: inn.rows,
    outRows: out.rows,
    workingStitches: inn.startWorkingStitches,
    remainingStitches: inn.remainingStitches,
    endWorkingStitches: out.endWorkingStitches,
    carriageStartSide: section.orientation.carriageStartSide,
  };
}

/**
 * Replay the written actions: each narrowing row puts one carriage-side needle
 * into hold and knits across; each widening row returns one needle opposite
 * the carriage and knits across.
 */
export function replayShortRowActions(actions: ShortRowActions): HeelToeShapingMapPass[] | string {
  const { workingStitches, inRows, outRows, carriageStartSide, remainingStitches, endWorkingStitches } =
    actions;
  if (!(workingStitches >= 3) || !(inRows >= 1) || !(outRows >= 1)) {
    return "Short-row actions do not describe a narrowing and widening sequence.";
  }
  let left = 0;
  let right = workingStitches;
  let carriage = carriageStartSide;
  const passes: HeelToeShapingMapPass[] = [];

  for (let i = 0; i < inRows; i++) {
    const side = carriage;
    if (side === "right") right -= 1;
    else left += 1;
    if (right - left < 1) return "Narrowing runs out of stitches still in work.";
    passes.push({
      pass: passes.length + 1,
      action: "hold",
      side,
      inWorkLeft: left,
      inWorkRight: right,
      inWorkStitches: right - left,
    });
    carriage = opposite(carriage);
  }
  if (passes[passes.length - 1]?.inWorkStitches !== remainingStitches) {
    return `Narrowing ends at ${passes[passes.length - 1]?.inWorkStitches ?? 0} stitches, not the written ${remainingStitches} center stitches.`;
  }

  for (let i = 0; i < outRows; i++) {
    const side = opposite(carriage);
    if (side === "right") right += 1;
    else left -= 1;
    if (left < 0 || right > workingStitches) return "Widening returns a needle outside the working stitches.";
    passes.push({
      pass: passes.length + 1,
      action: "return",
      side,
      inWorkLeft: left,
      inWorkRight: right,
      inWorkStitches: right - left,
    });
    carriage = opposite(carriage);
  }
  if (passes[passes.length - 1]?.inWorkStitches !== endWorkingStitches) {
    return `Widening ends at ${passes[passes.length - 1]?.inWorkStitches ?? 0} stitches, not the written ${endWorkingStitches} working stitches.`;
  }
  return passes;
}

function sameActions(a: ShortRowActions, b: ShortRowActions): boolean {
  return (
    a.inRows === b.inRows &&
    a.outRows === b.outRows &&
    a.workingStitches === b.workingStitches &&
    a.remainingStitches === b.remainingStitches &&
    a.endWorkingStitches === b.endWorkingStitches &&
    a.carriageStartSide === b.carriageStartSide
  );
}

function firstShortRowSection(doc: SockInstructionDocument): SockInstructionSection | undefined {
  return doc.sections.find((section) => section.steps.some((step) => step.type === "short-row-in"));
}

export function buildHeelToeShapingMap(doc: SockInstructionDocument): HeelToeShapingMapResult {
  const heel = doc.sections.find((section) => section.id === "heel");
  const toe = doc.sections.find((section) => section.id === "toe");
  const shown = firstShortRowSection(doc);
  if (!heel || !toe || !shown || (shown.id !== "heel" && shown.id !== "toe")) {
    return { ok: false, reasons: ["Heel and toe are not both in this pattern, so one shared map is not drawn."] };
  }
  const heelActions = readShortRowActions(heel);
  const toeActions = readShortRowActions(toe);
  const reasons: string[] = [];
  if (typeof heelActions === "string") reasons.push(heelActions);
  if (typeof toeActions === "string") reasons.push(toeActions);
  if (typeof heelActions === "string" || typeof toeActions === "string") {
    return { ok: false, reasons };
  }
  if (!sameActions(heelActions, toeActions)) {
    return {
      ok: false,
      reasons: ["Heel and toe short-row actions differ, so they do not share one shaping map."],
    };
  }
  const shownActions = shown.id === "heel" ? heelActions : toeActions;
  const passes = replayShortRowActions(shownActions);
  if (typeof passes === "string") return { ok: false, reasons: [passes] };
  return {
    ok: true,
    map: {
      title: HEEL_TOE_SHAPING_MAP_TITLE,
      sock: doc.sock,
      constructionDirection: doc.constructionDirection,
      carriageStartSide: shownActions.carriageStartSide,
      workingStitches: shownActions.workingStitches,
      remainingStitches: shownActions.remainingStitches,
      passes,
    },
  };
}

function stitchLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

type Point = { x: number; row: number };

function traceEdge(map: HeelToeShapingMapModel, side: SockNeedleHalf): Point[] {
  const points: Point[] = [];
  let x = side === "left" ? 0 : map.workingStitches;
  let row = 0;
  points.push({ x, row });
  for (const pass of map.passes) {
    if (pass.side === side) {
      const next = side === "left" ? pass.inWorkLeft : pass.inWorkRight;
      if (next !== x) {
        x = next;
        points.push({ x, row });
      }
    }
    row += 1;
    points.push({ x, row });
  }
  return points;
}

/**
 * How the map's carriage passes relate to the pattern's one-way finished depth.
 * Does not change either number. Empty `disagreements` means the map matches
 * the written in and out actions and the stored knitting-row total, and the
 * finished depth remains the one-way row count.
 */
export function describeHeelToeDepthAlignment(args: {
  mapPasses: number;
  holdPasses: number;
  returnPasses: number;
  instructionInRows: number;
  instructionOutRows: number;
  depthRows: number;
  knittingRows: number;
  depthInches: number;
  rowGaugePerInch: number;
}): { disagreements: string[]; relationship: string } {
  const disagreements: string[] = [];
  if (args.mapPasses !== args.instructionInRows + args.instructionOutRows) {
    disagreements.push(
      `Map has ${args.mapPasses} carriage passes; written narrowing plus widening is ${args.instructionInRows + args.instructionOutRows}.`,
    );
  }
  if (args.holdPasses !== args.instructionInRows || args.returnPasses !== args.instructionOutRows) {
    disagreements.push(
      `Map shows ${args.holdPasses} needles placed into hold and ${args.returnPasses} returned; written actions are ${args.instructionInRows} and ${args.instructionOutRows}.`,
    );
  }
  if (args.mapPasses !== args.knittingRows) {
    disagreements.push(
      `Map carriage passes (${args.mapPasses}) do not match calculated knitting rows (${args.knittingRows}).`,
    );
  }
  if (args.knittingRows !== args.depthRows * 2) {
    disagreements.push(
      `Calculated knitting rows (${args.knittingRows}) are not twice the one-way finished depth (${args.depthRows}).`,
    );
  }
  const inchesFromDepth = args.rowGaugePerInch > 0 ? args.depthRows / args.rowGaugePerInch : Number.NaN;
  if (!(Math.abs(inchesFromDepth - args.depthInches) < 1e-6)) {
    disagreements.push(
      `Finished depth ${args.depthInches} inches does not equal one-way depth rows divided by row gauge (${inchesFromDepth}).`,
    );
  }
  const relationship =
    `This map has ${args.mapPasses} carriage passes (${args.holdPasses} into hold, then ${args.returnPasses} returned to work). ` +
    `Finished depth stays ${args.depthRows} rows, ${args.depthInches} inches: one narrowing direction, not the pass total.`;
  return { disagreements, relationship };
}

export function renderHeelToeShapingMapSvg(map: HeelToeShapingMapModel): string {
  const working = map.workingStitches;
  const passCount = map.passes.length;
  const rightEdge = traceEdge(map, "right");
  const leftEdge = traceEdge(map, "left");
  const outline = [leftEdge[0]!, ...rightEdge, ...leftEdge.slice().reverse().slice(0, -1)];

  const narrow = map.passes.find((pass) => pass.inWorkStitches === map.remainingStitches);
  const centerText = `${stitchLabel(map.remainingStitches, "center stitch remains", "center stitches remain")}`;
  const workingText = stitchLabel(map.workingStitches, "working stitch", "working stitches");
  const carriageText = map.carriageStartSide === "right" ? "Carriage right" : "Carriage left";
  // Upward knitting direction. These numbers are carriage passes for this map,
  // not the pattern row counter. Cuff-to-toe and cuff-down stop the counter
  // before shaping. The second short-row section stops at the foot reading.
  // Only a toe-up toe resets to 000 immediately before these passes.
  const orderText = "Knitting order";
  const centerWidth = estimateTextWidthPx(centerText, CENTER_LABEL_FONT);
  const orderWidth = estimateTextWidthPx(orderText, EDGE_LABEL_FONT);
  const maxPassLabel = estimateTextWidthPx(String(passCount), ROW_NUMBER_FONT);
  const stepOutside = 16 + estimateTextWidthPx("+1", 20);

  const padTop = 36;
  const padBottom = 74;
  const leftGutter = Math.max(centerWidth + 28, stepOutside + 12, 56);
  const rightGutter = Math.max(stepOutside + 8 + maxPassLabel + 16, orderWidth + 20);
  const width = leftGutter + working * CELL + rightGutter;
  const height = padTop + passCount * CELL + padBottom;
  const gridLeft = leftGutter;
  const gridRight = leftGutter + working * CELL;
  const gridTop = padTop;
  const gridBottom = padTop + passCount * CELL;

  const xPx = (stitch: number) => gridLeft + stitch * CELL;
  const yPx = (row: number) => gridBottom - row * CELL;

  const parts: string[] = [];
  parts.push(`<rect class="shaping-map-bg" x="0" y="0" width="${fmt(width)}" height="${fmt(height)}" />`);

  const poly = outline.map((point) => `${fmt(xPx(point.x))},${fmt(yPx(point.row))}`).join(" ");
  parts.push(`<polygon class="shaping-map-fabric" points="${poly}" />`);

  const minor: string[] = [];
  const major: string[] = [];
  for (let stitch = 0; stitch <= working; stitch++) {
    const line = `<line x1="${fmt(xPx(stitch))}" y1="${fmt(gridTop)}" x2="${fmt(xPx(stitch))}" y2="${fmt(gridBottom)}" />`;
    (stitch % MAJOR_EVERY === 0 ? major : minor).push(line);
  }
  for (let row = 0; row <= passCount; row++) {
    const line = `<line x1="${fmt(gridLeft)}" y1="${fmt(yPx(row))}" x2="${fmt(gridRight)}" y2="${fmt(yPx(row))}" />`;
    (row % MAJOR_EVERY === 0 ? major : minor).push(line);
  }
  parts.push(`<g class="shaping-map-grid-minor" data-heel-toe-grid="minor">${minor.join("")}</g>`);
  parts.push(`<g class="shaping-map-grid-major" data-heel-toe-grid="major">${major.join("")}</g>`);

  const rowNumbers: string[] = [];
  const rowNumX = gridRight + stepOutside + 8;
  for (let row = PASS_NUMBER_INTERVAL; row <= passCount; row += PASS_NUMBER_INTERVAL) {
    rowNumbers.push(
      `<text class="shaping-map-row-number" data-pass="${row}" x="${fmt(rowNumX)}" y="${fmt(yPx(row))}" dominant-baseline="central">${row}</text>`,
    );
  }
  parts.push(`<g>${rowNumbers.join("")}</g>`);

  parts.push(`<polyline class="shaping-map-path" points="${poly}" />`);

  for (const pass of map.passes) {
    const row = pass.pass - 1;
    const outward = pass.side === "right" ? 1 : -1;
    const edgeX = pass.side === "right" ? pass.inWorkRight : pass.inWorkLeft;
    const labelX = xPx(edgeX) + outward * 16;
    const anchor = pass.side === "right" ? "start" : "end";
    const text = pass.action === "hold" ? "-1" : "+1";
    const extraClass = pass.action === "return" ? " shaping-map-step-label--return" : "";
    // Sit in the carriage-pass cell, above the step line, so the first label
    // stays clear of the working-stitch caption.
    const labelY = (yPx(row) + yPx(row + 1)) / 2;
    parts.push(
      `<text class="shaping-map-step-label${extraClass}" data-shaping-action="${pass.action}" data-pass="${pass.pass}" data-side="${pass.side}" x="${fmt(labelX)}" y="${fmt(labelY)}" text-anchor="${anchor}" dominant-baseline="central">${text}</text>`,
    );
  }

  if (narrow) {
    const bandMid = (yPx(narrow.pass - 1) + yPx(narrow.pass)) / 2;
    parts.push(
      `<text class="shaping-map-center-label" data-center-stitches="${map.remainingStitches}" x="8" y="${fmt(bandMid)}" text-anchor="start" dominant-baseline="central">${escapeXml(centerText)}</text>`,
    );
  }

  const workingY = gridBottom + 34;
  parts.push(
    `<text class="shaping-map-annotation" data-working-stitches="${working}" x="${fmt((gridLeft + gridRight) / 2)}" y="${fmt(workingY)}" text-anchor="middle">${escapeXml(workingText)}</text>`,
  );

  const carriageX = map.carriageStartSide === "right" ? gridRight : gridLeft;
  const carriageAnchor = map.carriageStartSide === "right" ? "end" : "start";
  parts.push(
    `<text class="shaping-map-edge-label" data-carriage-start="${map.carriageStartSide}" x="${fmt(carriageX)}" y="${fmt(workingY + 22)}" text-anchor="${carriageAnchor}">${escapeXml(carriageText)}</text>`,
  );
  parts.push(
    `<text class="shaping-map-edge-label" data-knitting-order="up" x="${fmt(width - 8)}" y="16" text-anchor="end">${escapeXml(orderText)}</text>`,
  );

  const holdCount = map.passes.filter((pass) => pass.action === "hold").length;
  const returnCount = map.passes.filter((pass) => pass.action === "return").length;
  return (
    `<svg class="shaping-map__svg shaping-map__svg--heel-toe" width="${fmt(width)}" height="${fmt(height)}" ` +
    `style="min-width:${fmt(width)}px" ` +
    `viewBox="0 0 ${fmt(width)} ${fmt(height)}" preserveAspectRatio="xMidYMid meet" role="img" ` +
    `aria-label="${escapeXml(map.title)}" data-heel-toe-shaping-map-svg="true" ` +
    `data-carriage-start="${map.carriageStartSide}" data-working-stitches="${working}" ` +
    `data-center-stitches="${map.remainingStitches}" data-grid-columns="${working}" ` +
    `data-grid-rows="${passCount}" data-hold-passes="${holdCount}" data-return-passes="${returnCount}" ` +
    `xmlns="http://www.w3.org/2000/svg">` +
    parts.join("") +
    `</svg>`
  );
}

export function renderHeelToeShapingMapHtml(map: HeelToeShapingMapModel): string {
  const svg = renderHeelToeShapingMapSvg(map);
  const note =
    "Read from the bottom upward. Each grid row is one carriage pass. Numbers on the right count those passes for this map only. -1 places a needle into hold. +1 returns a needle to work.";
  return (
    `<div class="shaping-map" data-heel-toe-shaping-map data-sock="${map.sock}" ` +
    `data-construction="${map.constructionDirection}" data-carriage-start="${map.carriageStartSide}">` +
    `<h5 class="shaping-map__title">${escapeXml(map.title)}</h5>` +
    `<p class="shaping-map__note">${escapeXml(note)}</p>` +
    `<div class="shaping-map__scroll">${svg}</div>` +
    `</div>`
  );
}

/** One shared map when heel and toe match; otherwise nothing is drawn. */
export function heelToeShapingMapHtmlForDocument(doc: SockInstructionDocument): string {
  const built = buildHeelToeShapingMap(doc);
  return built.ok ? renderHeelToeShapingMapHtml(built.map) : "";
}
