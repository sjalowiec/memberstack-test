/**
 * Data-driven inline SVG for one shoulder from neckline / shoulder shaping chart rows.
 * Coordinates snap to GRID: 1 stitch = GRID px horizontally, 1 machine row = GRID px vertically.
 *
 * Visual layout: shoulder (outer) on the left, neck opening (inner) on the right; increasing machine
 * row toward the top of the SVG. Green fill = live stitches on the needles; background = removed /
 * neck opening.
 *
 * When the chart includes `timeline` ({@link RowEntry} from shapingTimeline), geometry and delta
 * labels come only from row index + edge positions + events — no re-parsing of chart text cells.
 */

import type { NeckShoulderShapingChart, NeckShoulderShapingChartRow } from "./neckShoulderShapingChart";
import type { RowEntry } from "./shapingTimeline";

export const SHOULDER_SHAPING_SVG_GRID = 10;

/** Chart heading green #52682d at readable opacity */
const FABRIC_FILL = "rgba(82, 104, 45, 0.16)";
const OUTLINE_STROKE = "#1f2937";
const LABEL_SHOULDER_NECK = "#52682d";

/** Slightly smaller than prior 12px so dense repeated −1 labels stay readable */
const FONT_DELTA = 10;
const FONT_ZONE = 10;
const FONT_CENTER = 10;
/** Widen view when stitch span is very narrow (high gauge, few shoulder stitches) */
const MIN_CHART_WIDTH_PX = 168;

export type ShoulderShapingSvgSide = "left" | "right";

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

type Pt = { x: number; y: number };

/** Shared output for path + labels (timeline or legacy chart parsing). */
type ShoulderSvgGeometry = {
  rowNums: number[];
  inner: number[];
  outer: number[];
  startWidth: number;
  minRow: number;
  maxRow: number;
  shoulderLabels: { row: number; amount: number }[];
  neckLabels: { row: number; amount: number }[];
  centerNeckLabel: string | null;
  centerNeckStitches: number | null;
};

function sortChartRows(rows: NeckShoulderShapingChartRow[]): NeckShoulderShapingChartRow[] {
  return [...rows].sort((a, b) => a.row - b.row);
}

function sortTimeline(rows: RowEntry[]): RowEntry[] {
  return [...rows].sort((a, b) => a.row - b.row);
}

function sumTimelineDecrease(
  entry: RowEntry,
  side: "left" | "right",
  edge: "outer" | "inner"
): number {
  return entry.events
    .filter((e) => e.kind === "decrease" && e.side === side && e.edge === edge)
    .reduce((s, e) => s + e.amount, 0);
}

/** Inner neckline: stair bind-offs + single decreases (chart uses bindOff + decrease on inner edge). */
function sumTimelineInnerNeck(
  entry: RowEntry,
  side: "left" | "right"
): number {
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

/**
 * Diagram x: 0 at inner (neck), startWidth at outer (shoulder/armhole).
 * Rows map to SVG y via row number only.
 */
function computeStatesFromTimeline(
  sorted: RowEntry[],
  side: ShoulderShapingSvgSide
): ShoulderSvgGeometry {
  const first = sorted[0];
  const startWidth = side === "right" ? first.stitchesR : first.stitchesL;
  const inner0Needle =
    side === "right" ? first.rightInnerEdge : first.leftInnerEdge;

  const rowNums: number[] = [];
  const inner: number[] = [];
  const outer: number[] = [];
  const shoulderLabels: { row: number; amount: number }[] = [];
  const neckLabels: { row: number; amount: number }[] = [];

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

    const shoulderAmt = sumTimelineDecrease(e, side, "outer");
    const neckAmt = sumTimelineInnerNeck(e, side);
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

/** Legacy: derive geometry by summing "-" cells when no shaping timeline is available. */
function computeStatesFromChartCells(
  sorted: NeckShoulderShapingChartRow[],
  side: ShoulderShapingSvgSide
): ShoulderSvgGeometry {
  const rowNums = sorted.map((r) => r.row);
  const startWidth =
    side === "right" ? sorted[0].rightStitchCount : sorted[0].leftStitchCount;
  let innerS = 0;
  let outerS = startWidth;

  const inner: number[] = [];
  const outer: number[] = [];
  const shoulderLabels: { row: number; amount: number }[] = [];
  const neckLabels: { row: number; amount: number }[] = [];

  const first = sorted[0];
  const cn = parseCenterNeckStitches(first.centerNeck);
  const centerNeckLabel =
    cn !== null && cn > 0 ? `Center neck: ${cn} sts` : null;

  for (let k = 0; k < sorted.length; k++) {
    const r = sorted[k];
    const decNeck = parseShapingDecrease(side === "right" ? r.rightNeck : r.leftNeck);
    const decSide = parseShapingDecrease(side === "right" ? r.rightSide : r.leftSide);

    innerS += decNeck;
    outerS -= decSide;

    inner.push(innerS);
    outer.push(outerS);

    if (decSide > 0) {
      shoulderLabels.push({ row: r.row, amount: decSide });
    }
    if (decNeck > 0) {
      neckLabels.push({ row: r.row, amount: decNeck });
    }
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

/** Larger machine row number → smaller SVG y (row progresses upward on screen). */
function rowToY(
  row: number,
  minRow: number,
  maxRow: number,
  grid: number,
  padY: number
): number {
  return padY + (maxRow - row) * grid;
}

/**
 * Map stitch index from neck (0) toward shoulder (startWidth) to SVG x.
 * Right shoulder: shoulder outer edge left, neck inner edge right.
 * Left shoulder: neck left, shoulder right (mirror).
 */
function toSvgX(
  stitchX: number,
  side: ShoulderShapingSvgSide,
  startWidth: number,
  grid: number,
  padX: number
): number {
  if (side === "right") {
    return padX + (startWidth - stitchX) * grid;
  }
  return padX + stitchX * grid;
}

function buildStairPath(
  stitchVals: number[],
  rowNums: readonly number[],
  side: ShoulderShapingSvgSide,
  startWidth: number,
  grid: number,
  padX: number,
  minRow: number,
  maxRow: number,
  padY: number
): Pt[] {
  const pts: Pt[] = [];
  const n = rowNums.length;
  for (let k = 0; k < n; k++) {
    const y = rowToY(rowNums[k], minRow, maxRow, grid, padY);
    const x = toSvgX(stitchVals[k], side, startWidth, grid, padX);
    if (k === 0) {
      pts.push({ x, y });
    }
    if (k < n - 1) {
      const yNext = rowToY(rowNums[k + 1], minRow, maxRow, grid, padY);
      const xHold = toSvgX(stitchVals[k], side, startWidth, grid, padX);
      pts.push({ x: xHold, y: yNext });
      pts.push({
        x: toSvgX(stitchVals[k + 1], side, startWidth, grid, padX),
        y: yNext,
      });
    }
  }
  return pts;
}

function ptsToClosedOutline(outerDown: Pt[], innerDown: Pt[]): string {
  if (outerDown.length === 0 || innerDown.length === 0) return "";
  let d = `M ${outerDown[0].x} ${outerDown[0].y}`;
  for (let i = 1; i < outerDown.length; i++) {
    d += ` L ${outerDown[i].x} ${outerDown[i].y}`;
  }
  const innerUp = innerDown.slice().reverse();
  for (let i = 0; i < innerUp.length; i++) {
    d += ` L ${innerUp[i].x} ${innerUp[i].y}`;
  }
  d += " Z";
  return d;
}

/**
 * Returns an HTML string containing one inline <svg> (no image assets).
 */
export function renderShoulderShapingSvg(
  chart: NeckShoulderShapingChart,
  side: ShoulderShapingSvgSide
): string {
  const GRID = SHOULDER_SHAPING_SVG_GRID;
  const tl = chart.timeline?.length ? sortTimeline(chart.timeline) : null;
  const sortedChart =
    !tl || tl.length === 0 ? sortChartRows(chart.rows) : [];
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

  const chartHeightPx = (maxRow - minRow) * GRID;
  const chartWidthPx = startWidth * GRID;

  const narrowSlack = Math.max(0, MIN_CHART_WIDTH_PX - chartWidthPx);
  const padXBase = 64;
  const padY = 58;
  const centerLabelChars = centerNeckLabel?.length ?? 0;
  /** Display-only length for center-neck dimension line (matches label width, not stitch scale). */
  const CN_DIM_GAP = 16;
  const cnDimWidth =
    centerNeckLabel != null && centerNeckStitches != null
      ? Math.max(72, Math.min(centerLabelChars * 6.5, 200))
      : 0;
  /** Left shoulder only: room for center-neck dim segment drawn left of the grid. */
  const padOffsetLeft =
    side === "left" && cnDimWidth > 0 ? CN_DIM_GAP + cnDimWidth : 0;
  const padX = padXBase + narrowSlack / 2 + padOffsetLeft;
  const padXRight = Math.max(120, 88 + centerLabelChars * 6.4) + narrowSlack / 2;
  /** Room for shoulder + center-neck measurement row and axis caption */
  const padYBottom = 72;

  const svgW = padX + chartWidthPx + padXRight;
  const svgH = padY + chartHeightPx + padYBottom;

  const gx0 = padX;
  const gx1 = padX + chartWidthPx;
  const gy0 = padY;
  const gy1 = padY + chartHeightPx;

  const outerPts = buildStairPath(
    outer,
    rowNums,
    side,
    startWidth,
    GRID,
    padX,
    minRow,
    maxRow,
    padY
  );
  const innerPts = buildStairPath(
    inner,
    rowNums,
    side,
    startWidth,
    GRID,
    padX,
    minRow,
    maxRow,
    padY
  );
  const outlinePath = ptsToClosedOutline(outerPts, innerPts);

  const gridMinor: string[] = [];
  const gridMajor: string[] = [];
  for (let x = gx0; x <= gx1; x += GRID) {
    const isMajor = (x - gx0) % (GRID * 5) === 0;
    const el = `<line x1="${x}" y1="${gy0}" x2="${x}" y2="${gy1}" stroke="${
      isMajor ? "rgba(55,65,81,0.32)" : "rgba(55,65,81,0.1)"
    }" stroke-width="${isMajor ? 1 : 0.5}" />`;
    (isMajor ? gridMajor : gridMinor).push(el);
  }
  for (let y = gy0; y <= gy1; y += GRID) {
    const isMajor = (y - gy0) % (GRID * 5) === 0;
    const el = `<line x1="${gx0}" y1="${y}" x2="${gx1}" y2="${y}" stroke="${
      isMajor ? "rgba(55,65,81,0.32)" : "rgba(55,65,81,0.1)"
    }" stroke-width="${isMajor ? 1 : 0.5}" />`;
    (isMajor ? gridMajor : gridMinor).push(el);
  }

  const yAt = (row: number) => rowToY(row, minRow, maxRow, GRID, padY);

  const labels: string[] = [];

  const shoulderOut = (x0: number, x1: number) =>
    side === "right" ? Math.min(x0, x1) - 16 : Math.max(x0, x1) + 16;
  const shoulderAnchor = side === "right" ? "end" : "start";

  for (const sl of shoulderLabels) {
    const k = rowNums.findIndex((r) => r === sl.row);
    if (k <= 0) continue;
    const y = yAt(sl.row);
    const x0 = toSvgX(outer[k - 1], side, startWidth, GRID, padX);
    const x1 = toSvgX(outer[k], side, startWidth, GRID, padX);
    const ly = y + 4;
    const tx = shoulderOut(x0, x1);
    labels.push(
      `<text x="${tx}" y="${ly}" font-size="${FONT_DELTA}" fill="#374151" text-anchor="${shoulderAnchor}" dominant-baseline="middle" font-family="system-ui,sans-serif">${escapeXml(
        `-${sl.amount}`
      )}</text>`
    );
  }

  const neckOut = (x0: number, x1: number) =>
    side === "right" ? Math.max(x0, x1) + 16 : Math.min(x0, x1) - 16;
  const neckAnchor = side === "right" ? "start" : "end";

  for (const nl of neckLabels) {
    const k = rowNums.findIndex((r) => r === nl.row);
    if (k <= 0) continue;
    const y = yAt(nl.row);
    const x0 = toSvgX(inner[k - 1], side, startWidth, GRID, padX);
    const x1 = toSvgX(inner[k], side, startWidth, GRID, padX);
    const tx = neckOut(x0, x1);
    labels.push(
      `<text x="${tx}" y="${y + 4}" font-size="${FONT_DELTA}" fill="#7c3aed" text-anchor="${neckAnchor}" dominant-baseline="middle" font-family="system-ui,sans-serif">${escapeXml(
        `-${nl.amount}`
      )}</text>`
    );
  }

  /** Bottom measurement row: shoulder span (startWidth) + center neck, same baseline */
  const dimLineY = gy1 + 8;
  const measureBaselineY = dimLineY + 16;
  labels.push(
    `<line x1="${gx0}" y1="${dimLineY}" x2="${gx1}" y2="${dimLineY}" stroke="#9ca3af" stroke-width="1" stroke-linecap="square" />`
  );
  labels.push(
    `<line x1="${gx0}" y1="${dimLineY - 3}" x2="${gx0}" y2="${dimLineY + 3}" stroke="#9ca3af" stroke-width="1" />`
  );
  labels.push(
    `<line x1="${gx1}" y1="${dimLineY - 3}" x2="${gx1}" y2="${dimLineY + 3}" stroke="#9ca3af" stroke-width="1" />`
  );
  if (centerNeckStitches != null && cnDimWidth > 0) {
    if (side === "right") {
      const cnLineStart = gx1 + CN_DIM_GAP;
      const cnLineEnd = cnLineStart + cnDimWidth;
      labels.push(
        `<line x1="${cnLineStart}" y1="${dimLineY}" x2="${cnLineEnd}" y2="${dimLineY}" stroke="#9ca3af" stroke-width="1" stroke-linecap="square" />`
      );
      labels.push(
        `<line x1="${cnLineStart}" y1="${dimLineY - 3}" x2="${cnLineStart}" y2="${dimLineY + 3}" stroke="#9ca3af" stroke-width="1" />`
      );
      labels.push(
        `<line x1="${cnLineEnd}" y1="${dimLineY - 3}" x2="${cnLineEnd}" y2="${dimLineY + 3}" stroke="#9ca3af" stroke-width="1" />`
      );
    } else {
      const cnLineEnd = gx0 - CN_DIM_GAP;
      const cnLineStart = cnLineEnd - cnDimWidth;
      labels.push(
        `<line x1="${cnLineStart}" y1="${dimLineY}" x2="${cnLineEnd}" y2="${dimLineY}" stroke="#9ca3af" stroke-width="1" stroke-linecap="square" />`
      );
      labels.push(
        `<line x1="${cnLineStart}" y1="${dimLineY - 3}" x2="${cnLineStart}" y2="${dimLineY + 3}" stroke="#9ca3af" stroke-width="1" />`
      );
      labels.push(
        `<line x1="${cnLineEnd}" y1="${dimLineY - 3}" x2="${cnLineEnd}" y2="${dimLineY + 3}" stroke="#9ca3af" stroke-width="1" />`
      );
    }
  }
  labels.push(
    `<text x="${(gx0 + gx1) / 2}" y="${measureBaselineY}" font-size="${FONT_CENTER}" fill="#374151" text-anchor="middle" dominant-baseline="alphabetic" font-family="system-ui,sans-serif">${escapeXml(
      `${startWidth} shoulder sts`
    )}</text>`
  );
  if (centerNeckLabel && centerNeckStitches != null && cnDimWidth > 0) {
    const cnLabelMidX =
      side === "right"
        ? gx1 + CN_DIM_GAP + cnDimWidth / 2
        : gx0 - CN_DIM_GAP - cnDimWidth / 2;
    labels.push(
      `<text x="${cnLabelMidX}" y="${measureBaselineY}" font-size="${FONT_CENTER}" fill="#374151" text-anchor="middle" dominant-baseline="alphabetic" font-family="system-ui,sans-serif">${escapeXml(
        centerNeckLabel
      )}</text>`
    );
  }

  /** Zone titles sit above the knitted outline (smaller y than chart top) */
  const zoneLabelY = padY - 10;
  const shoulderTagX = side === "right" ? gx0 + 4 : gx1 - 4;
  const shoulderTagAnchor = side === "right" ? "start" : "end";
  labels.push(
    `<text x="${shoulderTagX}" y="${zoneLabelY}" font-size="${FONT_ZONE}" fill="${LABEL_SHOULDER_NECK}" font-weight="600" font-style="italic" font-family="system-ui,sans-serif" text-anchor="${shoulderTagAnchor}">${escapeXml(
      "shoulder"
    )}</text>`
  );

  const neckTagX = side === "right" ? gx1 - 4 : gx0 + 4;
  const neckTagAnchor = side === "right" ? "end" : "start";
  labels.push(
    `<text x="${neckTagX}" y="${zoneLabelY}" font-size="${FONT_ZONE}" fill="${LABEL_SHOULDER_NECK}" font-weight="600" font-style="italic" font-family="system-ui,sans-serif" text-anchor="${neckTagAnchor}">${escapeXml(
      "neck opening"
    )}</text>`
  );

  const svgStyle = `max-width:1100px;width:100%;height:auto;display:block`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" style="${escapeXml(
    svgStyle
  )}" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Shoulder shaping preview">
  <title>Shoulder shaping preview</title>
  <rect x="0" y="0" width="${svgW}" height="${svgH}" fill="#ffffff"/>
  ${gridMinor.join("\n  ")}
  ${gridMajor.join("\n  ")}
  <path d="${outlinePath}" fill="${FABRIC_FILL}" stroke="${OUTLINE_STROKE}" stroke-width="2" />
  ${labels.join("\n  ")}
</svg>`;
}
