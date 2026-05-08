/**
 * Minimal technical SVG for one shoulder from neckline / shoulder shaping chart rows.
 * 1 stitch = GRID px horizontal, 1 machine row = GRID px vertical; outer (shoulder) left, inner (neck) right;
 * increasing row toward the top of the SVG.
 *
 * When the chart includes `timeline` ({@link RowEntry}), geometry uses row edges only — no re-parsing chart cells.
 * Horizontal padding is sized from both the cropped stitch span and delta-label bounds so nothing clips.
 */

import type { NeckShoulderShapingChart, NeckShoulderShapingChartRow } from "./neckShoulderShapingChart";
import type { RowEntry } from "./shapingTimeline";

export const SHOULDER_SHAPING_SVG_GRID = 10;

const LINE_STROKE = "#1e293b";
const LINE_WIDTH = 1.75;
const GRID_STROKE = "rgba(15,23,42,0.07)";
const GRID_LINE_MINOR = 0.45;
const GRID_LINE_MAJOR = 0.65;
/** Match {@link renderShapingGeometrySvg} shoulder / neck label hues */
const SHOULDER_LABEL_FILL = "#52682d";
const NECK_LABEL_FILL = "#c2614e";
const FABRIC_FILL = "#f3f0ea";
const FABRIC_FILL_OPACITY = 0.5;
const FONT_ZONE = 13;
const FONT_DELTA = 17;

const SHOULDER_LABEL_GAP_Y = 25;
const NECK_LABEL_GAP_X = 19;
const NECK_LABEL_GAP_Y = 3;
const EDGE_LABEL_GAP_X = 7;
const MIN_LABEL_CLEARANCE = 11;
/** ~width of one character at FONT_DELTA for bounding estimates */
const CHAR_W_EST = 8.3;
const NECK_LABEL_COLLISION_Y = 16;
const NECK_LABEL_NUDGE_X = 7;
const NECK_LABEL_NUDGE_Y = 5;
const NECK_LABEL_MAX_NUDGES = 8;
const NECK_LABEL_STACK_FALLBACK_Y = 11;
/** Minimum margin from viewBox edge to any ink */
const VIEW_MARGIN = 18;
const LABEL_PAD_TOP = 10;
const LABEL_PAD_BOTTOM = 10;
/** Zone title length estimates (px) for bbox */
const ZONE_TITLE_W_SHOULDER = 118;
const ZONE_TITLE_W_NECK = 108;

export type ShoulderShapingSvgSide = "left" | "right";

/** Accepted for API compatibility; ignored for styling. */
export type ShoulderShapingSvgPiece = "front" | "back";

export type ShoulderShapingSvgOptions = {
  piece?: ShoulderShapingSvgPiece;
};

/** Parse "-6", "-1", "-" / empty → stitch decrease amount (0 if none). */
export function parseShapingDecrease(cell: string): number {
  const t = String(cell ?? "").trim();
  if (!t || t === "-") return 0;
  const m = t.match(/^-(\d+)$/);
  if (m) return parseInt(m[1], 10);
  const n = parseInt(t.replace(/^\+/, ""), 10);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

/** Parse center neck cell like "-40" → 40 for labeling. */
export function parseCenterNeckStitches(cell: string): number | null {
  const t = String(cell ?? "").trim();
  if (!t || t === "-") return null;
  const m = t.match(/^-?(\d+)$/);
  if (m) return parseInt(m[1], 10);
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function approxTextWidthPx(text: string): number {
  return Math.max(CHAR_W_EST * text.length, FONT_DELTA);
}

type LabeledDelta = { row: number; amount: number };

type ShoulderSvgGeometry = {
  rowNums: number[];
  inner: number[];
  outer: number[];
  startWidth: number;
  minRow: number;
  maxRow: number;
  shoulderLabels: LabeledDelta[];
  neckLabels: LabeledDelta[];
};

function sortChartRows(rows: NeckShoulderShapingChartRow[]): NeckShoulderShapingChartRow[] {
  return [...rows].sort((a, b) => a.row - b.row);
}

function sortTimeline(rows: RowEntry[]): RowEntry[] {
  return [...rows].sort((a, b) => a.row - b.row);
}

function sumTimelineOuterEdge(entry: RowEntry, side: "left" | "right"): number {
  return entry.events
    .filter(
      (e) =>
        e.side === side &&
        e.edge === "outer" &&
        e.amount > 0 &&
        (e.kind === "decrease" || e.kind === "bindOff")
    )
    .reduce((s, e) => s + e.amount, 0);
}

function sumTimelineInnerNeck(entry: RowEntry, side: "left" | "right"): number {
  return entry.events
    .filter(
      (e) =>
        e.side === side &&
        e.edge === "inner" &&
        e.amount > 0 &&
        (e.kind === "decrease" || e.kind === "bindOff")
    )
    .reduce((s, e) => s + e.amount, 0);
}

function computeStatesFromTimeline(sorted: RowEntry[], side: ShoulderShapingSvgSide): ShoulderSvgGeometry {
  const sideLR: "left" | "right" = side === "right" ? "right" : "left";
  const first = sorted[0];
  const startWidth = side === "right" ? first.stitchesR : first.stitchesL;
  const inner0Needle = side === "right" ? first.rightInnerEdge : first.leftInnerEdge;

  const rowNums: number[] = [];
  const inner: number[] = [];
  const outer: number[] = [];
  const shoulderLabels: LabeledDelta[] = [];
  const neckLabels: LabeledDelta[] = [];

  for (const e of sorted) {
    rowNums.push(e.row);
    let innerX: number;
    let outerX: number;
    if (side === "right") {
      innerX = e.rightInnerEdge - inner0Needle;
      outerX = e.rightOuterEdge - inner0Needle + 1;
    } else {
      innerX = inner0Needle - e.leftInnerEdge;
      outerX = innerX + e.stitchesL;
    }
    inner.push(innerX);
    outer.push(outerX);

    const shoulderAmt = sumTimelineOuterEdge(e, sideLR);
    const neckAmt = sumTimelineInnerNeck(e, sideLR);
    if (shoulderAmt > 0) shoulderLabels.push({ row: e.row, amount: shoulderAmt });
    if (neckAmt > 0) neckLabels.push({ row: e.row, amount: neckAmt });
  }

  return {
    rowNums,
    inner,
    outer,
    startWidth,
    minRow: sorted[0].row,
    maxRow: sorted[sorted.length - 1].row,
    shoulderLabels,
    neckLabels,
  };
}

function computeStatesFromChartCells(sorted: NeckShoulderShapingChartRow[], side: ShoulderShapingSvgSide): ShoulderSvgGeometry {
  const rowNums = sorted.map((r) => r.row);
  const startWidth = side === "right" ? sorted[0].rightStitchCount : sorted[0].leftStitchCount;
  let innerS = 0;
  let outerS = startWidth;

  const inner: number[] = [];
  const outer: number[] = [];
  const shoulderLabels: LabeledDelta[] = [];
  const neckLabels: LabeledDelta[] = [];

  const first = sorted[0];
  for (let k = 0; k < sorted.length; k++) {
    const r = sorted[k];
    const decNeck = parseShapingDecrease(side === "right" ? r.rightNeck : r.leftNeck);
    const decSide = parseShapingDecrease(side === "right" ? r.rightSide : r.leftSide);

    innerS += decNeck;
    outerS -= decSide;

    inner.push(innerS);
    outer.push(outerS);

    if (decSide > 0) shoulderLabels.push({ row: r.row, amount: decSide });
    if (decNeck > 0) neckLabels.push({ row: r.row, amount: decNeck });
  }

  return {
    inner,
    outer,
    startWidth,
    minRow: sorted[0].row,
    maxRow: sorted[sorted.length - 1].row,
    shoulderLabels,
    neckLabels,
    rowNums,
  };
}

function rowToY(row: number, minRow: number, maxRow: number, grid: number, padY: number): number {
  return padY + (maxRow - row) * grid;
}

function toSvgX(
  stitchX: number,
  side: ShoulderShapingSvgSide,
  spanStitches: number,
  grid: number,
  padX: number
): number {
  if (side === "right") {
    return padX + (spanStitches - stitchX) * grid;
  }
  return padX + stitchX * grid;
}

function buildStairPathD(
  stitchVals: number[],
  rowNums: readonly number[],
  side: ShoulderShapingSvgSide,
  spanStitches: number,
  grid: number,
  padX: number,
  minRow: number,
  maxRow: number,
  padY: number
): string {
  const n = rowNums.length;
  if (n === 0) return "";
  const transitionIdx: number[] = [];
  for (let k = 0; k < n - 1; k++) {
    if (stitchVals[k + 1] !== stitchVals[k]) transitionIdx.push(k);
  }
  if (transitionIdx.length === 0) return "";

  const first = transitionIdx[0];
  const xStart = toSvgX(stitchVals[first], side, spanStitches, grid, padX);
  const yStart = rowToY(rowNums[first], minRow, maxRow, grid, padY);
  const yAfterFirst = rowToY(rowNums[first + 1], minRow, maxRow, grid, padY);
  const xAfterFirst = toSvgX(stitchVals[first + 1], side, spanStitches, grid, padX);

  // Start directly with the first vertical shaping transition (no baseline lead-in).
  let d = `M ${xStart} ${yStart} L ${xStart} ${yAfterFirst} L ${xAfterFirst} ${yAfterFirst}`;
  let currentX = xAfterFirst;
  let currentY = yAfterFirst;

  for (let i = 1; i < transitionIdx.length; i++) {
    const k = transitionIdx[i];
    const y = rowToY(rowNums[k], minRow, maxRow, grid, padY);
    const yNext = rowToY(rowNums[k + 1], minRow, maxRow, grid, padY);
    const x0 = toSvgX(stitchVals[k], side, spanStitches, grid, padX);
    const x1 = toSvgX(stitchVals[k + 1], side, spanStitches, grid, padX);

    // Carry vertically through unchanged rows to the next shaping row.
    if (currentY !== y) d += ` L ${currentX} ${y}`;
    // Draw the shaping stair: vertical row transition, then horizontal stitch shift.
    d += ` L ${x0} ${yNext} L ${x1} ${yNext}`;
    currentX = x1;
    currentY = yNext;
  }

  return d;
}

type ShoulderBindoffMarker = { x: number; yTop: number; yBottom: number; yMid: number };
type StepTransition = {
  row: number;
  fromX: number;
  toX: number;
  yPrev: number;
  yCurr: number;
};

type SvgPoint = { x: number; y: number };

function shoulderBindoffMarkerForRow(
  row: number,
  rowNums: readonly number[],
  outer: readonly number[],
  side: ShoulderShapingSvgSide,
  spanStitches: number,
  grid: number,
  padX: number,
  minRow: number,
  maxRow: number,
  padY: number
): ShoulderBindoffMarker | null {
  const k = rowNums.findIndex((r) => r === row);
  if (k < 0) return null;

  let fromIdx = k > 0 ? k - 1 : k;
  let toIdx = k > 0 ? k : Math.min(k + 1, rowNums.length - 1);
  if (fromIdx === toIdx) return null;

  if (outer[fromIdx] === outer[toIdx]) {
    const altFrom = Math.max(0, k);
    const altTo = Math.min(k + 1, rowNums.length - 1);
    if (altFrom !== altTo && outer[altFrom] !== outer[altTo]) {
      fromIdx = altFrom;
      toIdx = altTo;
    }
  }
  if (outer[fromIdx] === outer[toIdx]) return null;

  const y0 = rowToY(rowNums[fromIdx], minRow, maxRow, grid, padY);
  const y1 = rowToY(rowNums[toIdx], minRow, maxRow, grid, padY);
  const yMid = (y0 + y1) / 2;
  const tickHalf = Math.max(3, Math.round(grid * 0.35));
  const x = toSvgX(outer[fromIdx], side, spanStitches, grid, padX);
  return { x, yTop: yMid - tickHalf, yBottom: yMid + tickHalf, yMid };
}

function buildTransitions(
  rowNums: readonly number[],
  stitchVals: readonly number[],
  side: ShoulderShapingSvgSide,
  spanStitches: number,
  grid: number,
  padX: number,
  minRow: number,
  maxRow: number,
  padY: number
): StepTransition[] {
  const transitions: StepTransition[] = [];
  for (let k = 1; k < rowNums.length; k += 1) {
    if (stitchVals[k] === stitchVals[k - 1]) continue;
    transitions.push({
      row: rowNums[k],
      fromX: toSvgX(stitchVals[k - 1], side, spanStitches, grid, padX),
      toX: toSvgX(stitchVals[k], side, spanStitches, grid, padX),
      yPrev: rowToY(rowNums[k - 1], minRow, maxRow, grid, padY),
      yCurr: rowToY(rowNums[k], minRow, maxRow, grid, padY),
    });
  }
  return transitions;
}

function buildStairPolyline(
  stitchVals: readonly number[],
  rowNums: readonly number[],
  indices: readonly number[],
  side: ShoulderShapingSvgSide,
  spanStitches: number,
  grid: number,
  padX: number,
  minRow: number,
  maxRow: number,
  padY: number
): SvgPoint[] {
  if (indices.length === 0) return [];
  const points: SvgPoint[] = [];
  const firstIdx = indices[0];
  points.push({
    x: toSvgX(stitchVals[firstIdx], side, spanStitches, grid, padX),
    y: rowToY(rowNums[firstIdx], minRow, maxRow, grid, padY),
  });
  for (let i = 1; i < indices.length; i += 1) {
    const prevIdx = indices[i - 1];
    const idx = indices[i];
    const prevX = toSvgX(stitchVals[prevIdx], side, spanStitches, grid, padX);
    const y = rowToY(rowNums[idx], minRow, maxRow, grid, padY);
    const x = toSvgX(stitchVals[idx], side, spanStitches, grid, padX);
    points.push({ x: prevX, y });
    points.push({ x, y });
  }
  return points;
}

function pointsToPath(points: readonly SvgPoint[]): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
}

function buildFabricAreaPath(
  rowNums: readonly number[],
  outer: readonly number[],
  inner: readonly number[],
  side: ShoulderShapingSvgSide,
  spanStitches: number,
  grid: number,
  padX: number,
  minRow: number,
  maxRow: number,
  padY: number
): string {
  if (rowNums.length === 0) return "";
  const forward = rowNums.map((_, i) => i);
  const reverse = [...forward].reverse();
  const outerPoints = buildStairPolyline(
    outer,
    rowNums,
    forward,
    side,
    spanStitches,
    grid,
    padX,
    minRow,
    maxRow,
    padY
  );
  const innerPoints = buildStairPolyline(
    inner,
    rowNums,
    reverse,
    side,
    spanStitches,
    grid,
    padX,
    minRow,
    maxRow,
    padY
  );
  if (outerPoints.length === 0 || innerPoints.length === 0) return "";
  return `${pointsToPath([...outerPoints, ...innerPoints])} Z`;
}

function placeHorizontalLabel(
  segmentStartX: number,
  segmentEndX: number,
  segmentY: number,
  outerDirection: -1 | 1,
  edgeTickX?: number
): { x: number; y: number } {
  const minX = Math.min(segmentStartX, segmentEndX);
  const maxX = Math.max(segmentStartX, segmentEndX);
  const span = maxX - minX;
  const centerX = (segmentStartX + segmentEndX) / 2;
  let x = centerX;
  if (span < MIN_LABEL_CLEARANCE * 2) {
    x += outerDirection * (MIN_LABEL_CLEARANCE - span / 2);
  }
  if (Number.isFinite(edgeTickX) && Math.abs(x - (edgeTickX as number)) < EDGE_LABEL_GAP_X) {
    x += outerDirection * EDGE_LABEL_GAP_X;
  }
  return { x, y: segmentY - SHOULDER_LABEL_GAP_Y };
}

function placeNeckLabel(
  segmentX: number,
  segmentTopY: number,
  segmentBottomY: number,
  interiorDirection: -1 | 1,
  segmentRunX: number,
  amountBoost: number = 0,
  rowBiasY: number = 0
): { x: number; y: number; textAnchor: "start" | "end" } {
  const minY = Math.min(segmentTopY, segmentBottomY);
  const maxY = Math.max(segmentTopY, segmentBottomY);
  const run = Math.abs(segmentRunX - segmentX);
  const outwardBoost = run < MIN_LABEL_CLEARANCE ? MIN_LABEL_CLEARANCE - run : 0;
  const x = segmentX + interiorDirection * (NECK_LABEL_GAP_X + outwardBoost + amountBoost);
  return {
    x,
    y: (minY + maxY) / 2 + NECK_LABEL_GAP_Y + rowBiasY,
    textAnchor: interiorDirection > 0 ? "start" : "end",
  };
}

/**
 * Returns an HTML string containing one inline <svg> (no image assets).
 * `options.piece` is ignored (API compatibility).
 */
export function renderShoulderShapingSvg(
  chart: NeckShoulderShapingChart,
  side: ShoulderShapingSvgSide,
  options?: ShoulderShapingSvgOptions
): string {
  const GRID = SHOULDER_SHAPING_SVG_GRID;
  const tl = chart.timeline?.length ? sortTimeline(chart.timeline) : null;
  const sortedChart = !tl || tl.length === 0 ? sortChartRows(chart.rows) : [];
  const source: ShoulderSvgGeometry | null =
    tl && tl.length > 0
      ? computeStatesFromTimeline(tl, side)
      : sortedChart.length > 0
        ? computeStatesFromChartCells(sortedChart, side)
        : null;

  if (!source) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" aria-hidden="true"></svg>`;
  }

  const {
    rowNums,
    inner,
    outer,
    startWidth,
    minRow,
    maxRow,
    shoulderLabels,
    neckLabels,
  } = source;

  const SHOULDER_CROP_PAD_STITCHES = 1;
  const maxOuterStitch = outer.length ? Math.max(...outer) : startWidth;
  const chartSpanStitches = Math.min(
    startWidth,
    Math.max(1, maxOuterStitch + SHOULDER_CROP_PAD_STITCHES)
  );

  const chartWidthPx = chartSpanStitches * GRID;

  /** Ink bounds in coordinates where cropped chart spans [0, chartWidthPx] on x (shoulder at 0, neck at chartWidthPx). */
  let inkMinX = 0;
  let inkMaxX = chartWidthPx;

  /* Zone titles */
  inkMinX = Math.min(inkMinX, 0);
  inkMaxX = Math.max(inkMaxX, ZONE_TITLE_W_SHOULDER);
  inkMaxX = Math.max(inkMaxX, chartWidthPx);
  inkMinX = Math.min(inkMinX, chartWidthPx - ZONE_TITLE_W_NECK);

  /* Delta labels */
  const deltaStr = (n: number) => `-${n}`;

  const shoulderTransitionsForBounds = buildTransitions(
    rowNums,
    outer,
    side,
    chartSpanStitches,
    GRID,
    0,
    minRow,
    maxRow,
    0
  );
  const shoulderByRowForBounds = new Map<number, StepTransition>(
    shoulderTransitionsForBounds.map((t) => [t.row, t])
  );
  for (const sl of shoulderLabels) {
    const transition = shoulderByRowForBounds.get(sl.row);
    if (!transition) continue;
    const marker = shoulderBindoffMarkerForRow(
      sl.row,
      rowNums,
      outer,
      side,
      chartSpanStitches,
      GRID,
      0,
      minRow,
      maxRow,
      0
    );
    if (!marker) continue;
    const w = approxTextWidthPx(deltaStr(sl.amount));
    const pos = placeHorizontalLabel(transition.fromX, transition.toX, transition.yCurr, -1);
    inkMinX = Math.min(inkMinX, pos.x - w / 2);
    inkMaxX = Math.max(inkMaxX, pos.x + w / 2);
  }

  const neckTransitionsForBounds = buildTransitions(
    rowNums,
    inner,
    side,
    chartSpanStitches,
    GRID,
    0,
    minRow,
    maxRow,
    0
  );
  const neckByRowForBounds = new Map<number, StepTransition>(neckTransitionsForBounds.map((t) => [t.row, t]));
  for (const nl of neckLabels) {
    const transition = neckByRowForBounds.get(nl.row);
    if (!transition) continue;
    const interiorDirection: -1 | 1 = side === "left" ? 1 : -1;
    const w = approxTextWidthPx(deltaStr(nl.amount));
    const pos = placeNeckLabel(
      transition.fromX,
      transition.yPrev,
      transition.yCurr,
      interiorDirection,
      transition.toX,
      nl.amount === 1 ? 2 : 0
    );
    const nudgedX = pos.x + interiorDirection * NECK_LABEL_NUDGE_X;
    inkMinX = Math.min(inkMinX, Math.min(pos.x, nudgedX) - w);
    inkMaxX = Math.max(inkMaxX, Math.max(pos.x, nudgedX) + w);
  }

  const padX = VIEW_MARGIN - inkMinX;
  const padXRight = inkMaxX + VIEW_MARGIN - chartWidthPx;

  const chartHeightPx = (maxRow - minRow) * GRID;
  const padY = 32 + LABEL_PAD_TOP;
  const padYBottom = 20 + LABEL_PAD_BOTTOM;

  const gx0 = padX;
  const gx1 = padX + chartWidthPx;
  const gy0 = padY;
  const gy1 = padY + chartHeightPx;

  const svgW = padX + chartWidthPx + padXRight;
  const svgH = padY + chartHeightPx + padYBottom;

  const fabricAreaD = buildFabricAreaPath(
    rowNums,
    outer,
    inner,
    side,
    chartSpanStitches,
    GRID,
    padX,
    minRow,
    maxRow,
    padY
  );
  const innerD = buildStairPathD(inner, rowNums, side, chartSpanStitches, GRID, padX, minRow, maxRow, padY);

  const gridLines: string[] = [];
  for (let x = gx0 + GRID; x <= gx1 - GRID; x += GRID) {
    const major = (x - gx0) % (GRID * 5) === 0;
    gridLines.push(
      `<line x1="${x}" y1="${gy0}" x2="${x}" y2="${gy1}" stroke="${GRID_STROKE}" stroke-width="${
        major ? GRID_LINE_MAJOR : GRID_LINE_MINOR
      }" />`
    );
  }
  for (let y = gy0 + GRID; y <= gy1 - GRID; y += GRID) {
    const major = (y - gy0) % (GRID * 5) === 0;
    gridLines.push(
      `<line x1="${gx0}" y1="${y}" x2="${gx1}" y2="${y}" stroke="${GRID_STROKE}" stroke-width="${
        major ? GRID_LINE_MAJOR : GRID_LINE_MINOR
      }" />`
    );
  }

  const yAt = (row: number) => rowToY(row, minRow, maxRow, GRID, padY);

  const deltaLabels: string[] = [];
  const shoulderMarks: string[] = [];
  const shoulderTransitions = buildTransitions(
    rowNums,
    outer,
    side,
    chartSpanStitches,
    GRID,
    padX,
    minRow,
    maxRow,
    padY
  );
  const shoulderByRow = new Map<number, StepTransition>(shoulderTransitions.map((t) => [t.row, t]));

  for (const sl of shoulderLabels) {
    const transition = shoulderByRow.get(sl.row);
    if (!transition) continue;
    const marker = shoulderBindoffMarkerForRow(
      sl.row,
      rowNums,
      outer,
      side,
      chartSpanStitches,
      GRID,
      padX,
      minRow,
      maxRow,
      padY
    );
    if (!marker) continue;
    shoulderMarks.push(
      `<line x1="${marker.x}" y1="${marker.yTop}" x2="${marker.x}" y2="${marker.yBottom}" stroke="${LINE_STROKE}" stroke-width="${LINE_WIDTH}" stroke-linecap="square" />`
    );
    const pos = placeHorizontalLabel(
      transition.fromX,
      transition.toX,
      transition.yCurr,
      -1,
      marker.x
    );
    deltaLabels.push(
      `<text x="${pos.x}" y="${pos.y}" font-size="${FONT_DELTA}" fill="${SHOULDER_LABEL_FILL}" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,sans-serif" font-weight="600">${escapeXml(
        deltaStr(sl.amount)
      )}</text>`
    );
  }

  const neckTransitions = buildTransitions(
    rowNums,
    inner,
    side,
    chartSpanStitches,
    GRID,
    padX,
    minRow,
    maxRow,
    padY
  );
  const neckByRow = new Map<number, StepTransition>(neckTransitions.map((t) => [t.row, t]));
  const placedNeckLabels: Array<{ x: number; y: number }> = [];
  for (const nl of neckLabels) {
    const transition = neckByRow.get(nl.row);
    if (!transition) continue;
    const interiorDirection: -1 | 1 = side === "left" ? 1 : -1;
    const rowBiasY = side === "left" ? -2 : 2;
    const pos = placeNeckLabel(
      transition.fromX,
      transition.yPrev,
      transition.yCurr,
      interiorDirection,
      transition.toX,
      nl.amount === 1 ? 2 : 0,
      rowBiasY
    );
    let labelX = pos.x;
    let labelY = pos.y;
    for (let nudge = 0; nudge < NECK_LABEL_MAX_NUDGES; nudge += 1) {
      const collides = placedNeckLabels.some(
        (p) =>
          Math.abs(p.y - labelY) < NECK_LABEL_COLLISION_Y &&
          Math.abs(p.x - labelX) < CHAR_W_EST * 2.5
      );
      if (!collides) break;
      labelX += interiorDirection * NECK_LABEL_NUDGE_X;
      labelY += nudge % 2 === 0 ? -NECK_LABEL_NUDGE_Y : NECK_LABEL_NUDGE_Y;
    }
    let guard = 0;
    while (
      guard < 10 &&
      placedNeckLabels.some(
        (p) =>
          Math.abs(p.y - labelY) < NECK_LABEL_COLLISION_Y &&
          Math.abs(p.x - labelX) < CHAR_W_EST * 2.5
      )
    ) {
      labelY -= NECK_LABEL_STACK_FALLBACK_Y;
      guard += 1;
    }
    guard = 0;
    while (
      guard < 10 &&
      placedNeckLabels.some(
        (p) =>
          Math.abs(p.y - labelY) < NECK_LABEL_COLLISION_Y &&
          Math.abs(p.x - labelX) < CHAR_W_EST * 2.5
      )
    ) {
      labelY += NECK_LABEL_STACK_FALLBACK_Y * 2;
      guard += 1;
    }
    placedNeckLabels.push({ x: labelX, y: labelY });
    deltaLabels.push(
      `<text x="${labelX}" y="${labelY}" font-size="${FONT_DELTA}" fill="${NECK_LABEL_FILL}" text-anchor="${pos.textAnchor}" dominant-baseline="middle" font-family="system-ui,sans-serif" font-weight="600">${escapeXml(
        deltaStr(nl.amount)
      )}</text>`
    );
  }

  // Center bind-off annotation is intentionally omitted to guarantee
  // shaping labels always remain fully visible and unobstructed.
  const centerMark = "";

  const zoneLabelY = padY - 6;
  const titles =
    `<text x="${gx0}" y="${zoneLabelY}" font-size="${FONT_ZONE}" fill="${SHOULDER_LABEL_FILL}" font-family="system-ui,sans-serif" font-weight="600">${escapeXml(
      "Shoulder bind-offs"
    )}</text>` +
    `<text x="${gx1}" y="${zoneLabelY}" font-size="${FONT_ZONE}" fill="${NECK_LABEL_FILL}" font-family="system-ui,sans-serif" font-weight="600" text-anchor="end">${escapeXml(
      "Neckline shaping"
    )}</text>`;

  const svgStyle = `max-width:1100px;width:100%;height:auto;display:block`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" style="${escapeXml(
    svgStyle
  )}" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMinYMin meet" role="img" aria-label="Neck and shoulder shaping diagram">
  <title>Neck and shoulder shaping diagram</title>
  <rect class="kbm-shaping-svg__diagram-bg" x="0" y="0" width="${svgW}" height="${svgH}" fill="#ffffff" stroke="none"/>
  ${fabricAreaD ? `<path class="kbm-shaping-svg__fabric-fill" d="${fabricAreaD}" fill="${FABRIC_FILL}" fill-opacity="${FABRIC_FILL_OPACITY}" stroke="none" />` : ""}
  ${gridLines.join("\n  ")}
  <path d="${innerD}" fill="none" stroke="${LINE_STROKE}" stroke-width="${LINE_WIDTH}" stroke-linecap="square" stroke-linejoin="miter" />
  <g class="ns-shoulder-svg__shoulder-marks">${shoulderMarks.join("\n  ")}</g>
  ${centerMark}
  <g class="ns-shoulder-svg__delta-labels">${deltaLabels.join("\n  ")}</g>
  ${titles}
</svg>`;
}
