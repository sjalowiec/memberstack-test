/**
 * Data-driven inline SVG for one shoulder from neckline / shoulder shaping chart rows.
 * Coordinates snap to GRID: 1 stitch = GRID px horizontally, 1 machine row = GRID px vertically.
 *
 * Visual layout: shoulder (outer) on the left, neck opening (inner) on the right; increasing machine
 * row toward the top of the SVG. Green fill = live stitches on the needles; background = removed /
 * neck opening.
 */

import type { NeckShoulderShapingChartRow } from "./neckShoulderShapingChart";

export const SHOULDER_SHAPING_SVG_GRID = 10;

/** Chart heading green #52682d at readable opacity */
const FABRIC_FILL = "rgba(82, 104, 45, 0.16)";
const OUTLINE_STROKE = "#1f2937";
const LABEL_SHOULDER_NECK = "#52682d";

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

function sortRows(rows: NeckShoulderShapingChartRow[]): NeckShoulderShapingChartRow[] {
  return [...rows].sort((a, b) => a.row - b.row);
}

function computeStates(
  sorted: NeckShoulderShapingChartRow[],
  side: ShoulderShapingSvgSide
): {
  inner: number[];
  outer: number[];
  startWidth: number;
  minRow: number;
  maxRow: number;
  shoulderLabels: { row: number; amount: number }[];
  neckLabels: { row: number; amount: number }[];
  centerNeckLabel: string | null;
} {
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
  sorted: NeckShoulderShapingChartRow[],
  side: ShoulderShapingSvgSide,
  startWidth: number,
  grid: number,
  padX: number,
  minRow: number,
  maxRow: number,
  padY: number
): Pt[] {
  const pts: Pt[] = [];
  const n = sorted.length;
  for (let k = 0; k < n; k++) {
    const y = rowToY(sorted[k].row, minRow, maxRow, grid, padY);
    const x = toSvgX(stitchVals[k], side, startWidth, grid, padX);
    if (k === 0) {
      pts.push({ x, y });
    }
    if (k < n - 1) {
      const yNext = rowToY(sorted[k + 1].row, minRow, maxRow, grid, padY);
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
  chartRows: NeckShoulderShapingChartRow[],
  side: ShoulderShapingSvgSide
): string {
  const GRID = SHOULDER_SHAPING_SVG_GRID;
  const sorted = sortRows(chartRows);
  if (sorted.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" aria-hidden="true"></svg>`;
  }

  const { inner, outer, startWidth, minRow, maxRow, shoulderLabels, neckLabels, centerNeckLabel } =
    computeStates(sorted, side);

  const chartHeightPx = (maxRow - minRow) * GRID;
  const chartWidthPx = startWidth * GRID;

  const padX = 64;
  const padY = 52;
  const padXRight = 96;
  const padYBottom = 56;

  const svgW = padX + chartWidthPx + padXRight;
  const svgH = padY + chartHeightPx + padYBottom;

  const gx0 = padX;
  const gx1 = padX + chartWidthPx;
  const gy0 = padY;
  const gy1 = padY + chartHeightPx;

  const outerPts = buildStairPath(
    outer,
    sorted,
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
    sorted,
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
    const k = sorted.findIndex((r) => r.row === sl.row);
    if (k <= 0) continue;
    const y = yAt(sl.row);
    const x0 = toSvgX(outer[k - 1], side, startWidth, GRID, padX);
    const x1 = toSvgX(outer[k], side, startWidth, GRID, padX);
    const ly = y + 5;
    const tx = shoulderOut(x0, x1);
    labels.push(
      `<text x="${tx}" y="${ly}" font-size="12" fill="#374151" text-anchor="${shoulderAnchor}" dominant-baseline="middle" font-family="system-ui,sans-serif">${escapeXml(
        `-${sl.amount}`
      )}</text>`
    );
  }

  const neckOut = (x0: number, x1: number) =>
    side === "right" ? Math.max(x0, x1) + 16 : Math.min(x0, x1) - 16;
  const neckAnchor = side === "right" ? "start" : "end";

  for (const nl of neckLabels) {
    const k = sorted.findIndex((r) => r.row === nl.row);
    if (k <= 0) continue;
    const y = yAt(nl.row);
    const x0 = toSvgX(inner[k - 1], side, startWidth, GRID, padX);
    const x1 = toSvgX(inner[k], side, startWidth, GRID, padX);
    const tx = neckOut(x0, x1);
    labels.push(
      `<text x="${tx}" y="${y + 5}" font-size="12" fill="#7c3aed" text-anchor="${neckAnchor}" dominant-baseline="middle" font-family="system-ui,sans-serif">${escapeXml(
        `-${nl.amount}`
      )}</text>`
    );
  }

  if (centerNeckLabel) {
    const neckEdgeX = toSvgX(inner[0], side, startWidth, GRID, padX);
    const lx =
      side === "right"
        ? neckEdgeX + 28
        : neckEdgeX - 28;
    const ly = padY + chartHeightPx * 0.28;
    labels.push(
      `<text x="${lx}" y="${ly}" font-size="11" fill="#1f2937" text-anchor="${
        side === "right" ? "start" : "end"
      }" dominant-baseline="middle" font-family="system-ui,sans-serif" font-weight="600">${escapeXml(
        centerNeckLabel
      )}</text>`
    );
  }

  labels.push(
    `<text x="${padX + chartWidthPx / 2}" y="${svgH - 14}" font-size="11" fill="#6b7280" text-anchor="middle" font-family="system-ui,sans-serif">Rows →</text>`
  );
  labels.push(
    `<text x="14" y="${padY + chartHeightPx / 2}" font-size="11" fill="#6b7280" text-anchor="middle" font-family="system-ui,sans-serif" transform="rotate(-90 14 ${padY + chartHeightPx / 2})">Stitches →</text>`
  );

  const shoulderTagX = side === "right" ? padX + 8 : gx1 - 8;
  const shoulderTagAnchor = side === "right" ? "start" : "end";
  labels.push(
    `<text x="${shoulderTagX}" y="${padY + 18}" font-size="12" fill="${LABEL_SHOULDER_NECK}" font-weight="600" font-family="system-ui,sans-serif" text-anchor="${shoulderTagAnchor}">${escapeXml(
      "shoulder"
    )}</text>`
  );

  const neckTagX = side === "right" ? gx1 - 6 : padX + 6;
  const neckTagAnchor = side === "right" ? "end" : "start";
  labels.push(
    `<text x="${neckTagX}" y="${padY + chartHeightPx * 0.38}" font-size="12" fill="${LABEL_SHOULDER_NECK}" font-weight="600" font-family="system-ui,sans-serif" text-anchor="${neckTagAnchor}">${escapeXml(
      "neck opening"
    )}</text>`
  );

  const svgStyle = `max-width:1100px;width:100%;height:auto;display:block`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" style="${escapeXml(
    svgStyle
  )}" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Shoulder shaping preview (${side} shoulder)">
  <title>Shoulder shaping preview — ${side} shoulder</title>
  <rect x="0" y="0" width="${svgW}" height="${svgH}" fill="#ffffff"/>
  ${gridMinor.join("\n  ")}
  ${gridMajor.join("\n  ")}
  <path d="${outlinePath}" fill="${FABRIC_FILL}" stroke="${OUTLINE_STROKE}" stroke-width="2" />
  ${labels.join("\n  ")}
</svg>`;
}
