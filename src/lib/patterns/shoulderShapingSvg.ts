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
const LABEL_FILL = "#334155";
const FONT_ZONE = 10;
const FONT_DELTA = 10;
const FONT_NOTE = 10;

/** Gap from step to delta label (px) */
const LABEL_GAP = 16;
/** ~width of one character at FONT_DELTA for bounding estimates */
const CHAR_W_EST = 6.4;
/** Minimum margin from viewBox edge to any ink */
const VIEW_MARGIN = 12;
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
  centerNeckLabel: string | null;
  centerNeckStitches: number | null;
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

function centerBindOffStitches(first: RowEntry): number | null {
  const n = first.events
    .filter((e) => e.kind === "bindOff" && e.side === "center" && e.edge === "center")
    .reduce((s, e) => s + e.amount, 0);
  return n > 0 ? n : null;
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

  const centerN = centerBindOffStitches(first);
  const centerNeckLabel =
    centerN !== null && centerN > 0 ? `Center neck: ${centerN} sts` : null;

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
    centerNeckLabel,
    centerNeckStitches: centerN,
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
  const cn = parseCenterNeckStitches(first.centerNeck);
  const centerNeckLabel = cn !== null && cn > 0 ? `Center neck: ${cn} sts` : null;

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
    centerNeckLabel,
    centerNeckStitches: cn !== null && cn > 0 ? cn : null,
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

/** X offset from chart origin (shoulder-side edge of cropped chart = 0) to stitch position */
function chartRelX(
  stitchX: number,
  side: ShoulderShapingSvgSide,
  spanStitches: number,
  grid: number
): number {
  if (side === "right") {
    return (spanStitches - stitchX) * grid;
  }
  return stitchX * grid;
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

/**
 * Returns an HTML string containing one inline <svg> (no image assets).
 * `options.piece` is ignored (API compatibility).
 */
export function renderShoulderShapingSvg(
  chart: NeckShoulderShapingChart,
  side: ShoulderShapingSvgSide,
  _options?: ShoulderShapingSvgOptions
): string {
  void _options;
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
    centerNeckLabel,
    centerNeckStitches,
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

  for (const sl of shoulderLabels) {
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
    const r0 = marker.x;
    const w = approxTextWidthPx(deltaStr(sl.amount));
    if (side === "right") {
      const tx = r0 - LABEL_GAP;
      inkMinX = Math.min(inkMinX, tx - w);
    } else {
      const tx = r0 + LABEL_GAP;
      inkMaxX = Math.max(inkMaxX, tx + w);
    }
  }

  for (const nl of neckLabels) {
    const k = rowNums.findIndex((r) => r === nl.row);
    if (k <= 0) continue;
    const r0 = chartRelX(inner[k - 1], side, chartSpanStitches, GRID);
    const r1 = chartRelX(inner[k], side, chartSpanStitches, GRID);
    const w = approxTextWidthPx(deltaStr(nl.amount));
    if (side === "right") {
      const tx = Math.max(r0, r1) + LABEL_GAP;
      inkMaxX = Math.max(inkMaxX, tx + w);
    } else {
      const tx = Math.min(r0, r1) - LABEL_GAP;
      inkMinX = Math.min(inkMinX, tx - w);
    }
  }

  /* Center neck tick + label from neck edge */
  if (centerNeckLabel && centerNeckStitches != null && centerNeckStitches > 0) {
    const xe = chartWidthPx;
    inkMaxX = Math.max(inkMaxX, xe + 10 + approxTextWidthPx(centerNeckLabel));
    inkMinX = Math.min(inkMinX, xe - 2);
  }

  const padX = VIEW_MARGIN - inkMinX;
  const padXRight = inkMaxX + VIEW_MARGIN - chartWidthPx;

  const chartHeightPx = (maxRow - minRow) * GRID;
  const padY = 32;
  const padYBottom = centerNeckLabel ? 36 : 20;

  const gx0 = padX;
  const gx1 = padX + chartWidthPx;
  const gy0 = padY;
  const gy1 = padY + chartHeightPx;

  const svgW = padX + chartWidthPx + padXRight;
  const svgH = padY + chartHeightPx + padYBottom;

  const outerD = "";
  const innerD = buildStairPathD(inner, rowNums, side, chartSpanStitches, GRID, padX, minRow, maxRow, padY);

  const gridLines: string[] = [];
  for (let x = gx0; x <= gx1; x += GRID) {
    const major = (x - gx0) % (GRID * 5) === 0;
    gridLines.push(
      `<line x1="${x}" y1="${gy0}" x2="${x}" y2="${gy1}" stroke="${GRID_STROKE}" stroke-width="${
        major ? GRID_LINE_MAJOR : GRID_LINE_MINOR
      }" />`
    );
  }
  for (let y = gy0; y <= gy1; y += GRID) {
    const major = (y - gy0) % (GRID * 5) === 0;
    gridLines.push(
      `<line x1="${gx0}" y1="${y}" x2="${gx1}" y2="${y}" stroke="${GRID_STROKE}" stroke-width="${
        major ? GRID_LINE_MAJOR : GRID_LINE_MINOR
      }" />`
    );
  }

  const yAt = (row: number) => rowToY(row, minRow, maxRow, GRID, padY);

  const deltaLabels: string[] = [];
  const shoulderOut = (x: number) => (side === "right" ? x - LABEL_GAP : x + LABEL_GAP);
  const shoulderAnchor = side === "right" ? "end" : "start";
  const shoulderMarks: string[] = [];

  for (const sl of shoulderLabels) {
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
    const tx = shoulderOut(marker.x);
    deltaLabels.push(
      `<text x="${tx}" y="${marker.yMid + 4}" font-size="${FONT_DELTA}" fill="${LABEL_FILL}" text-anchor="${shoulderAnchor}" dominant-baseline="middle" font-family="system-ui,sans-serif">${escapeXml(
        deltaStr(sl.amount)
      )}</text>`
    );
  }

  const neckOut = (x0: number, x1: number) =>
    side === "right" ? Math.max(x0, x1) + LABEL_GAP : Math.min(x0, x1) - LABEL_GAP;
  const neckAnchor = side === "right" ? "start" : "end";

  for (const nl of neckLabels) {
    const k = rowNums.findIndex((r) => r === nl.row);
    if (k <= 0) continue;
    const y = yAt(nl.row);
    const x0 = toSvgX(inner[k - 1], side, chartSpanStitches, GRID, padX);
    const x1 = toSvgX(inner[k], side, chartSpanStitches, GRID, padX);
    const tx = neckOut(x0, x1);
    deltaLabels.push(
      `<text x="${tx}" y="${y + 4}" font-size="${FONT_DELTA}" fill="${LABEL_FILL}" text-anchor="${neckAnchor}" dominant-baseline="middle" font-family="system-ui,sans-serif">${escapeXml(
        deltaStr(nl.amount)
      )}</text>`
    );
  }

  let centerMark = "";
  if (centerNeckStitches != null && centerNeckStitches > 0 && centerNeckLabel) {
    const yb = yAt(minRow);
    const xe = side === "right" ? gx1 : gx0;
    const centerLabelPad = 10;
    centerMark = `
  <g class="ns-shoulder-svg__center">
    <line x1="${xe}" y1="${yb - 6}" x2="${xe}" y2="${yb + 6}" stroke="${LINE_STROKE}" stroke-width="${LINE_WIDTH}" stroke-linecap="square" />
    <text x="${xe + centerLabelPad}" y="${yb + 3}" font-size="${FONT_NOTE}" fill="${LABEL_FILL}" font-family="system-ui,sans-serif" text-anchor="start">${escapeXml(centerNeckLabel)}</text>
  </g>`;
  }

  const zoneLabelY = padY - 6;
  const titles =
    `<text x="${gx0}" y="${zoneLabelY}" font-size="${FONT_ZONE}" fill="${LABEL_FILL}" font-family="system-ui,sans-serif" font-weight="600">${escapeXml(
      "Shoulder bind-offs"
    )}</text>` +
    `<text x="${gx1}" y="${zoneLabelY}" font-size="${FONT_ZONE}" fill="${LABEL_FILL}" font-family="system-ui,sans-serif" font-weight="600" text-anchor="end">${escapeXml(
      "Neckline shaping"
    )}</text>`;

  const svgStyle = `max-width:1100px;width:100%;height:auto;display:block`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" style="${escapeXml(
    svgStyle
  )}" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMinYMin meet" role="img" aria-label="Neck and shoulder shaping diagram">
  <title>Neck and shoulder shaping diagram</title>
  <rect x="0" y="0" width="${svgW}" height="${svgH}" fill="#ffffff"/>
  ${gridLines.join("\n  ")}
  ${outerD ? `<path d="${outerD}" fill="none" stroke="${LINE_STROKE}" stroke-width="${LINE_WIDTH}" stroke-linecap="square" stroke-linejoin="miter" />` : ""}
  <path d="${innerD}" fill="none" stroke="${LINE_STROKE}" stroke-width="${LINE_WIDTH}" stroke-linecap="square" stroke-linejoin="miter" />
  <g class="ns-shoulder-svg__shoulder-marks">${shoulderMarks.join("\n  ")}</g>
  <g class="ns-shoulder-svg__delta-labels">${deltaLabels.join("\n  ")}</g>
  ${centerMark}
  ${titles}
</svg>`;
}
