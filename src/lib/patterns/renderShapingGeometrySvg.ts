import type { ShapingGeometry, ShapingGeometryPoint } from "./buildShapingGeometry";

const SHOW_POINT_MARKERS = false;
const SHOW_FRAME_LABEL = false;
/** Shoulder shaping (bind-offs / outer edge): green */
const SHOULDER_SHAPING_COLOR = "#52682d";
/** Neckline shaping (inner edge): terracotta */
const NECKLINE_SHAPING_COLOR = "#c2614e";
const FABRIC_FILL = "#f3f0ea";
const FABRIC_FILL_OPACITY = 0.5;
/** ~+30% vs prior 12.5px for print/readability */
const SHAPING_LABEL_FONT_SIZE = 16.25;
/** Line spacing for stacked notation (Japanese-style vertical blocks). */
const NOTATION_LINE_HEIGHT = SHAPING_LABEL_FONT_SIZE * 1.22;
/** Subtle zone titles (Shoulder / Neckline). */
const ZONE_HEADING_FONT_SIZE = 11.75;
const ZONE_HEADING_GAP_Y = 6;
/** Bottom of shoulder notation stack stays this far above the shoulder outline (outside pale fill). */
const SHOULDER_NOTATION_CLEARANCE_Y = 17;
/** Horizontal inset: neck labels sit just into the neck opening from the stair-steps. */
const NECK_NOTATION_INSET_X = 8;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stitchAmountFromPoint(point: ShapingGeometryPoint): number {
  const fromField = Number.isFinite(point.stitchCount) ? (point.stitchCount as number) : 0;
  if (fromField > 0) return fromField;
  const source = String(point.label ?? "").trim();
  if (source.length > 0) {
    const amountMatch = source.match(/\b(\d+)\b/);
    return amountMatch ? Number(amountMatch[1]) : 0;
  }
  return 0;
}

type NotationRun = {
  stitches: number;
  rows: number;
  times: number;
  anySimultaneous: boolean;
};

/**
 * Compress consecutive shaping points on one edge into `stitches-rows-times` runs
 * (e.g. 1s-2r-7x ⇒ 1 st every 2 rows, 7 times).
 */
function compressEdgePointsToNotation(sortedPoints: ShapingGeometryPoint[]): NotationRun[] {
  const sorted = [...sortedPoints].sort((a, b) => {
    const dr = a.row - b.row;
    if (dr !== 0) return dr;
    return stitchAmountFromPoint(a) - stitchAmountFromPoint(b);
  });
  const runs: NotationRun[] = [];
  let i = 0;
  while (i < sorted.length) {
    const stitches = stitchAmountFromPoint(sorted[i]);
    if (stitches <= 0) {
      i += 1;
      continue;
    }

    let anySim = !!sorted[i].isSimultaneous;
    let j = i + 1;
    let interval: number | null = null;

    while (j < sorted.length) {
      const sj = stitchAmountFromPoint(sorted[j]);
      if (sj !== stitches) break;
      const gap = sorted[j].row - sorted[j - 1]!.row;
      if (gap <= 0) break;
      if (interval === null) interval = gap;
      else if (gap !== interval) break;
      if (sorted[j].isSimultaneous) anySim = true;
      j += 1;
    }

    const times = j - i;
    let rows: number;
    if (times >= 2) {
      rows = Math.max(1, interval ?? 1);
    } else {
      const rowBefore = i > 0 ? sorted[i].row - sorted[i - 1]!.row : 0;
      const rowAfter = j < sorted.length ? sorted[j]!.row - sorted[i].row : 0;
      if (rowBefore > 0) rows = rowBefore;
      else if (rowAfter > 0) rows = rowAfter;
      else rows = 1;
      rows = Math.max(1, rows);
    }

    runs.push({ stitches, rows, times, anySimultaneous: anySim });
    i = j;
  }
  return runs;
}

function notationRunsToLines(runs: NotationRun[]): string[] {
  return runs.map((r) => `${r.stitches}s-${r.rows}r-${r.times}x`);
}

function renderStackedNotationText(options: {
  lines: string[];
  x: number;
  yFirstBaseline: number;
  anchor: "middle" | "start" | "end";
  fill: string;
  fontWeight: "500" | "600";
}): string {
  const { lines, x, yFirstBaseline, anchor, fill, fontWeight } = options;
  if (lines.length === 0) return "";

  const tspans = lines
    .map((line, idx) => {
      if (idx === 0) {
        return `<tspan x="${x}">${escapeXml(line)}</tspan>`;
      }
      return `<tspan x="${x}" dy="${NOTATION_LINE_HEIGHT}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<text y="${yFirstBaseline}" text-anchor="${anchor}" dominant-baseline="middle" font-size="${SHAPING_LABEL_FONT_SIZE}" font-weight="${fontWeight}" fill="${fill}" font-family="system-ui,sans-serif">${tspans}</text>`;
}

function renderZoneHeadingText(options: {
  text: string;
  x: number;
  y: number;
  anchor: "middle" | "start" | "end";
  fill: string;
}): string {
  const { text, x, y, anchor, fill } = options;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" font-size="${ZONE_HEADING_FONT_SIZE}" font-weight="500" fill="${fill}" opacity="0.72" font-family="system-ui,sans-serif">${escapeXml(
    text
  )}</text>`;
}

function buildStairStepPath(
  points: Array<{ row: number; stitchPosition?: number }>,
  toX: (stitchPosition: number) => number,
  toY: (row: number) => number
): string {
  if (points.length === 0) return "";

  const first = points[0];
  const firstX = toX(first.stitchPosition as number);
  const firstY = toY(first.row);
  const commands: string[] = [`M ${firstX} ${firstY}`];

  for (let i = 1; i < points.length; i += 1) {
    const curr = points[i];
    const currX = toX(curr.stitchPosition as number);
    const currY = toY(curr.row);
    // Each segment is rendered as a stair step: horizontal first, then vertical.
    commands.push(`H ${currX}`);
    commands.push(`V ${currY}`);
  }

  return commands.join(" ");
}

function getEdgePoints(
  geometry: ShapingGeometry,
  edgeName: "neck" | "shoulder",
  side: "left" | "right"
): ShapingGeometryPoint[] {
  const edgeId = `${edgeName}:${side}`;
  const edge = geometry.edges.find((item) => String(item.id).toLowerCase() === edgeId);
  if (!edge) return [];
  return edge.points
    .filter((p) => Number.isFinite(p.stitchPosition))
    .sort((a, b) => a.row - b.row);
}

function maxShoulderNotationLineCount(geometry: ShapingGeometry): number {
  let maxLines = 0;
  for (const side of ["left", "right"] as const) {
    const pts = getEdgePoints(geometry, "shoulder", side);
    const lines = notationRunsToLines(compressEdgePointsToNotation(pts));
    maxLines = Math.max(maxLines, lines.length);
  }
  return maxLines;
}

/**
 * Top-of-viewBox padding: only enough space for shoulder zone heading + stacked notation
 * above the shoulder outline (avoids a fixed oversized blank band).
 */
function topPaddingForShoulderNotation(maxNotationLines: number): number {
  if (maxNotationLines <= 0) return 10;
  const marginAboveHeading = 4;
  const headingBand = ZONE_HEADING_GAP_Y + ZONE_HEADING_FONT_SIZE * 1.05;
  const notationBand =
    (maxNotationLines - 1) * NOTATION_LINE_HEIGHT + SHAPING_LABEL_FONT_SIZE * 0.65;
  return Math.ceil(
    marginAboveHeading +
      SHOULDER_NOTATION_CLEARANCE_Y +
      notationBand +
      headingBand
  );
}

/**
 * Proof-of-concept shaping geometry preview.
 * Uses row as Y and stitchPosition as X, skipping points without stitchPosition.
 */
export function renderShapingGeometrySvg(geometry: ShapingGeometry): string {
  const allPoints = geometry.points.filter(
    (p) => Number.isFinite(p.row) && Number.isFinite(p.stitchPosition)
  );
  if (allPoints.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" aria-hidden="true"></svg>`;
  }

  // Geometry extents represent active shaping points only.
  const geometryMinX = Math.min(...allPoints.map((p) => p.stitchPosition as number));
  const geometryMaxX = Math.max(...allPoints.map((p) => p.stitchPosition as number));
  const minRow = Number.isFinite(geometry.minRow) ? geometry.minRow : Math.min(...allPoints.map((p) => p.row));
  const maxRow = Number.isFinite(geometry.maxRow) ? geometry.maxRow : Math.max(...allPoints.map((p) => p.row));

  const shoulderAnchorPoints = geometry.edges
    .filter((edge) => String(edge.id).toLowerCase().includes("shoulder"))
    .flatMap((edge) => edge.points)
    .filter((p) => Number.isFinite(p.stitchPosition));
  const layoutAnchorPoints = shoulderAnchorPoints.length >= 2 ? shoulderAnchorPoints : allPoints;
  const rawLayoutMinX = Math.min(...layoutAnchorPoints.map((p) => p.stitchPosition as number));
  const rawLayoutMaxX = Math.max(...layoutAnchorPoints.map((p) => p.stitchPosition as number));

  // Layout extents intentionally form a stable content frame independent of
  // neck shaping depth/width so front/back pieces remain visually comparable.
  const layoutCenterX = (rawLayoutMinX + rawLayoutMaxX) / 2;
  const geometryHalfSpanX = Math.max(
    Math.abs(geometryMinX - layoutCenterX),
    Math.abs(geometryMaxX - layoutCenterX)
  );
  const layoutHalfSpanX = Math.max(
    Math.abs(rawLayoutMinX - layoutCenterX),
    Math.abs(rawLayoutMaxX - layoutCenterX),
    geometryHalfSpanX
  );
  const layoutMinX = layoutCenterX - layoutHalfSpanX;
  const layoutMaxX = layoutCenterX + layoutHalfSpanX;

  const gridX = 8;
  const gridY = 10;
  const sidePad = 28;
  const topPad = topPaddingForShoulderNotation(maxShoulderNotationLineCount(geometry));
  const bottomPad = 24;
  const spanX = Math.max(1, layoutMaxX - layoutMinX);
  const spanY = Math.max(1, maxRow - minRow);
  const width = sidePad * 2 + spanX * gridX;
  const height = topPad + bottomPad + spanY * gridY;
  const innerHeight = Math.max(1, height - topPad - bottomPad);

  const toX = (stitchPosition: number): number => sidePad + (stitchPosition - layoutMinX) * gridX;

  // Visual normalization only (renderer layer):
  // We preserve true row values and relationships for shaping math, but map rows
  // into minimum visual zones so deep/shallow shaping remains readable in preview.
  const shoulderRows = geometry.edges
    .filter((e) => String(e.id).toLowerCase().includes("shoulder"))
    .flatMap((e) => e.points.map((p) => p.row))
    .filter((row) => Number.isFinite(row));
  const neckRows = geometry.edges
    .filter((e) => String(e.id).toLowerCase().includes("neck"))
    .flatMap((e) => e.points.map((p) => p.row))
    .filter((row) => Number.isFinite(row));

  const shoulderBaseRow = shoulderRows.length > 0 ? Math.min(...shoulderRows) : maxRow;
  const neckBaseRow = neckRows.length > 0 ? Math.min(...neckRows) : shoulderBaseRow;
  const clampedShoulderBaseRow = Math.max(minRow, Math.min(maxRow, shoulderBaseRow));
  const clampedNeckBaseRow = Math.max(minRow, Math.min(clampedShoulderBaseRow, neckBaseRow));

  const shoulderSpanRows = Math.max(0, maxRow - clampedShoulderBaseRow);
  const neckSpanRows = Math.max(0, clampedShoulderBaseRow - clampedNeckBaseRow);
  const bodySpanRows = Math.max(0, clampedNeckBaseRow - minRow);
  const totalSpanRows = shoulderSpanRows + neckSpanRows + bodySpanRows;

  // Minimum zone allocations to keep schematic context present in all plans.
  const minShoulderPx = innerHeight * 0.16;
  const minNeckPx = innerHeight * 0.28;
  const minBodyPx = innerHeight * 0.24;
  const minTotalPx = minShoulderPx + minNeckPx + minBodyPx;
  const distributablePx = Math.max(0, innerHeight - minTotalPx);

  const shoulderWeight =
    totalSpanRows > 0 ? shoulderSpanRows / totalSpanRows : 1 / 3;
  const neckWeight =
    totalSpanRows > 0 ? neckSpanRows / totalSpanRows : 1 / 3;
  const bodyWeight =
    totalSpanRows > 0 ? bodySpanRows / totalSpanRows : 1 / 3;

  const shoulderZonePx = minShoulderPx + distributablePx * shoulderWeight;
  const neckZonePx = minNeckPx + distributablePx * neckWeight;
  const bodyZonePx = minBodyPx + distributablePx * bodyWeight;

  const shoulderZoneTopY = topPad;
  const shoulderZoneBottomY = shoulderZoneTopY + shoulderZonePx;
  const neckZoneBottomY = shoulderZoneBottomY + neckZonePx;
  const bodyZoneBottomY = topPad + innerHeight;

  const mapWithinZone = (
    row: number,
    zoneTopRow: number,
    zoneBottomRow: number,
    zoneTopY: number,
    zoneBottomY: number
  ): number => {
    const zoneSpanRows = Math.max(0, zoneTopRow - zoneBottomRow);
    if (zoneSpanRows === 0) return zoneBottomY;
    const t = (zoneTopRow - row) / zoneSpanRows;
    const clampedT = Math.max(0, Math.min(1, t));
    return zoneTopY + (zoneBottomY - zoneTopY) * clampedT;
  };

  const toY = (row: number): number => {
    const clampedRow = Math.max(minRow, Math.min(maxRow, row));
    if (clampedRow >= clampedShoulderBaseRow) {
      return mapWithinZone(
        clampedRow,
        maxRow,
        clampedShoulderBaseRow,
        shoulderZoneTopY,
        shoulderZoneBottomY
      );
    }
    if (clampedRow >= clampedNeckBaseRow) {
      return mapWithinZone(
        clampedRow,
        clampedShoulderBaseRow,
        clampedNeckBaseRow,
        shoulderZoneBottomY,
        neckZoneBottomY
      );
    }
    return mapWithinZone(
      clampedRow,
      clampedNeckBaseRow,
      minRow,
      neckZoneBottomY,
      bodyZoneBottomY
    );
  };

  const frameLines: string[] = [];
  const frameLabels: string[] = [];
  const fabricFills: string[] = [];
  const lines: string[] = [];
  const points: string[] = [];
  const labels: string[] = [];
  const neckBottomX = new Map<"left" | "right", number>();
  const fabricBottomY = height - 6;

  // Approximate visual frame for dev preview only.
  // This is intentionally lightweight context (body/armhole/side reference)
  // inferred from shaping bounds, not authoritative garment-edge geometry.
  const canInferFrame =
    Number.isFinite(layoutMinX) &&
    Number.isFinite(layoutMaxX) &&
    layoutMaxX > layoutMinX &&
    Number.isFinite(minRow) &&
    Number.isFinite(maxRow);
  if (canInferFrame && SHOW_FRAME_LABEL) {
    // Keep optional hook for development annotation without drawing a visual frame.
    frameLabels.push("");
  }

  for (const side of ["left", "right"] as const) {
    const neckPts = getEdgePoints(geometry, "neck", side);
    const shoulderPts = getEdgePoints(geometry, "shoulder", side);

    // Assumption for preview mode:
    // - Neck points are drawn bottom->top (row ascending),
    // - Shoulder points are drawn top->bottom (row descending),
    // so the shoulder segment visually continues outward from the neckline.
    const shoulderFromTop = [...shoulderPts].sort((a, b) => b.row - a.row);
    const connectedOutlinePts = [...neckPts, ...shoulderFromTop];
    if (connectedOutlinePts.length > 0) {
      const outlinePath = buildStairStepPath(connectedOutlinePts, toX, toY);
      const firstPt = connectedOutlinePts[0];
      const lastPt = connectedOutlinePts[connectedOutlinePts.length - 1];
      const startX = toX(firstPt.stitchPosition as number);
      neckBottomX.set(side, startX);
      const endX = toX(lastPt.stitchPosition as number);
      const endY = toY(lastPt.row);
      const boundaryX = side === "left" ? sidePad : width - sidePad;
      const baselineY = toY(minRow);
      const fabricPath = `${outlinePath} L ${boundaryX} ${endY} L ${boundaryX} ${fabricBottomY} L ${startX} ${fabricBottomY} L ${startX} ${baselineY} Z`;
      fabricFills.push(
        `<path class="kbm-shaping-svg__fabric-fill" d="${fabricPath}" fill="${FABRIC_FILL}" fill-opacity="${FABRIC_FILL_OPACITY}" stroke="none" />`
      );
      // Neck vs shoulder strokes: split polylines by shaping type (junction included on shoulder chain when both exist).
      if (neckPts.length > 0) {
        const neckPath = buildStairStepPath(neckPts, toX, toY);
        lines.push(
          `<path class="kbm-shaping-svg__neck-edge" d="${neckPath}" fill="none" stroke="${NECKLINE_SHAPING_COLOR}" stroke-width="1.8" />`
        );
      }
      if (shoulderFromTop.length > 0) {
        const shoulderDrawPts =
          neckPts.length > 0 ? [neckPts[neckPts.length - 1]!, ...shoulderFromTop] : shoulderFromTop;
        const shoulderPath = buildStairStepPath(shoulderDrawPts, toX, toY);
        lines.push(
          `<path class="kbm-shaping-svg__shoulder-edge" d="${shoulderPath}" fill="none" stroke="${SHOULDER_SHAPING_COLOR}" stroke-width="1.8" />`
        );
      }
    }
  }

  const leftBottomX = neckBottomX.get("left");
  const rightBottomX = neckBottomX.get("right");
  if (Number.isFinite(leftBottomX) && Number.isFinite(rightBottomX)) {
    const topY = toY(minRow);
    fabricFills.push(
      `<path class="kbm-shaping-svg__fabric-fill" d="M ${leftBottomX as number} ${topY} L ${rightBottomX as number} ${topY} L ${
        rightBottomX as number
      } ${fabricBottomY} L ${leftBottomX as number} ${fabricBottomY} Z" fill="${FABRIC_FILL}" fill-opacity="${FABRIC_FILL_OPACITY}" stroke="none" />`
    );
  }

  if (SHOW_POINT_MARKERS) {
    for (const p of geometry.points) {
      if (!Number.isFinite(p.stitchPosition)) continue;
      const stroke =
        p.edge === "neck"
          ? NECKLINE_SHAPING_COLOR
          : p.edge === "shoulder"
            ? SHOULDER_SHAPING_COLOR
            : "#334155";
      const x = toX(p.stitchPosition as number);
      const y = toY(p.row);
      points.push(`<circle cx="${x}" cy="${y}" r="2.2" fill="${stroke}" />`);
    }
  }

  for (const side of ["left", "right"] as const) {
    const shoulderPts = getEdgePoints(geometry, "shoulder", side);
    const shoulderRuns = compressEdgePointsToNotation(shoulderPts);
    const shoulderLines = notationRunsToLines(shoulderRuns);
    if (shoulderLines.length > 0) {
      const xs = shoulderPts.map((p) => toX(p.stitchPosition as number));
      const ys = shoulderPts.map((p) => toY(p.row));
      // Horizontally center on the shoulder stair-step span; vertically keep the stack above the outline.
      const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
      const topShoulderOutlineY = Math.min(...ys);
      const stackBottomBaseline = topShoulderOutlineY - SHOULDER_NOTATION_CLEARANCE_Y;
      const yFirstBaseline =
        stackBottomBaseline - (shoulderLines.length - 1) * NOTATION_LINE_HEIGHT;
      const yHeading =
        yFirstBaseline - ZONE_HEADING_GAP_Y - ZONE_HEADING_FONT_SIZE * 0.95;
      const fontWeight = shoulderRuns.some((r) => r.anySimultaneous) ? "600" : "500";
      labels.push(
        renderZoneHeadingText({
          text: "Shoulder",
          x: centerX,
          y: yHeading,
          anchor: "middle",
          fill: SHOULDER_SHAPING_COLOR,
        })
      );
      labels.push(
        renderStackedNotationText({
          lines: shoulderLines,
          x: centerX,
          yFirstBaseline,
          anchor: "middle",
          fill: SHOULDER_SHAPING_COLOR,
          fontWeight,
        })
      );
    }

    const neckPts = getEdgePoints(geometry, "neck", side);
    const neckRuns = compressEdgePointsToNotation(neckPts);
    const neckLines = notationRunsToLines(neckRuns);
    if (neckLines.length > 0) {
      const xs = neckPts.map((p) => toX(p.stitchPosition as number));
      const ys = neckPts.map((p) => toY(p.row));
      // Left neck: label just inside the neck opening (to the right of the left neck stairs).
      // Right neck: just inside the opening (to the left of the right neck stairs).
      const labelX =
        side === "left" ? Math.max(...xs) + NECK_NOTATION_INSET_X : Math.min(...xs) - NECK_NOTATION_INSET_X;
      const textAnchor: "start" | "end" = side === "left" ? "start" : "end";
      const neckMidY = (Math.min(...ys) + Math.max(...ys)) / 2;
      const yFirstBaseline =
        neckMidY - ((neckLines.length - 1) * NOTATION_LINE_HEIGHT) / 2;
      const yHeading =
        yFirstBaseline - ZONE_HEADING_GAP_Y - ZONE_HEADING_FONT_SIZE * 0.95;
      const fontWeight = neckRuns.some((r) => r.anySimultaneous) ? "600" : "500";
      labels.push(
        renderZoneHeadingText({
          text: "Neckline",
          x: labelX,
          y: yHeading,
          anchor: textAnchor,
          fill: NECKLINE_SHAPING_COLOR,
        })
      );
      labels.push(
        renderStackedNotationText({
          lines: neckLines,
          x: labelX,
          yFirstBaseline,
          anchor: textAnchor,
          fill: NECKLINE_SHAPING_COLOR,
          fontWeight,
        })
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMinYMin meet" role="img" aria-label="Temporary shaping geometry preview">
  <rect class="kbm-shaping-svg__diagram-bg" x="0" y="0" width="${width}" height="${height}" fill="#ffffff" stroke="none" />
  ${frameLines.join("\n  ")}
  ${frameLabels.join("\n  ")}
  ${fabricFills.join("\n  ")}
  ${lines.join("\n  ")}
  ${points.join("\n  ")}
  ${labels.join("\n  ")}
</svg>`;
}
