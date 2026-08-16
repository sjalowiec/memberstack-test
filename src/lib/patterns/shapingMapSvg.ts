/**
 * PROTOTYPE - dynamic "Shaping Map" SVG for neckline / shoulder shaping.
 *
 * This recreates the look of the old Knit It Now neckline/shoulder chart:
 *   - light square grid
 *   - stronger (lavender) guide lines every 10 stitches / rows
 *   - a black stepped shaping path that reads as ONE continuous neckline/shoulder edge
 *   - small step labels showing bind-off / decrease counts (e.g. -6, -5, -1, -4)
 *   - row numbers down the right side
 *   - a "Bind off N center stitches" label at the lower neck (under the final neck step)
 *
 * IMPORTANT: This renderer is intentionally isolated and driven ENTIRELY by a small
 * normalized data structure ({@link ShapingMapData}). It does NOT parse written
 * instruction text. The {@link SAMPLE_SHAPING_MAP_DATA} below is hardcoded sample
 * data only - later it will be replaced by real shaping data derived from the
 * pattern math (shoulder bind-off schedule + neckline decrease schedule).
 *
 * Nothing here mutates existing pattern math, written instructions, Japanese
 * diagrams, or the checklist. It only produces an SVG string that a page can embed.
 */

/** One shaping action on a path: bind off / decrease `stitches`, then work `rows` rows. */
export type ShapingMapStep = {
  /** Stitches bound off / decreased at this step (positive count). */
  stitches: number;
  /** Rows worked straight after this step, before the next one (vertical run). */
  rows: number;
  /** Optional display label for the step, e.g. "-6". Defaults to `-{stitches}`. Pass "" to hide. */
  label?: string;
};

/** A single stepped shaping path (e.g. the shoulder edge, or the neck edge). */
export type ShapingMapPath = {
  id: string;
  label: string;
  /** Starting stitch column (grid X, in stitches from the left edge). */
  startX: number;
  /** Starting row number (machine row / RC). */
  startRow: number;
  steps: ShapingMapStep[];
  /**
   * Which edge this path shapes. Determines the horizontal step direction:
   * a "left" edge steps inward to the right (+X), a "right" edge steps inward
   * to the left (-X). Optional; defaults to "left".
   */
  edge?: "left" | "right";
  /**
   * Vertical tracing direction between steps. "up" increases the row number
   * (default), "down" decreases it. Using "down" lets a neck path continue
   * downward from where the shoulder path ended, so the two read as one edge.
   */
  rowDirection?: "up" | "down";
};

/** Normalized input for {@link renderShapingMapSvg}. */
export type ShapingMapData = {
  title?: string;
  /** Lowest row number shown (bottom of the map). */
  rowMin: number;
  /** Highest row number shown (top of the map). */
  rowMax: number;
  /**
   * Optional center bind-off callout (`Bind off N center stitches`). Drawn as a flat
   * bind-off segment that continues from the END of the last path (so it connects to
   * the neck shaping), with the label placed just below it.
   */
  centerStitches?: number;
  paths: ShapingMapPath[];
  /**
   * Optional edge callouts placed by the actual meaning of the rendered profile
   * (NOT by fixed page position):
   *   - `shoulder`: the outer / armhole edge (top of the shoulder path).
   *   - `neck`: the neckline / center-front edge (associated with the center stitches).
   * Text is always rendered upright; if a page mirrors the map, it must not flip these labels.
   */
  edgeLabels?: {
    shoulder?: string;
    neck?: string;
  };
};

/** Options for the renderer (kept tiny for the prototype). */
export type RenderShapingMapOptions = {
  /** Pixels per stitch / per row in the SVG coordinate space. */
  cell?: number;
  /** Label every Nth row on the right side (default 2). */
  rowNumberInterval?: number;
  /** Draw a stronger guide line every N stitches / rows (default 10). */
  majorEvery?: number;
  /** Shade the fabric region under the shaping edge so it reads as one area (default true). */
  showFabricFill?: boolean;
  /**
   * Presentation-layer horizontal mirror. Flips ONLY the drawn geometry (fabric fill +
   * shaping path) and the x-position of the callouts; it does NOT change the shaping data,
   * row numbers, or step amounts. Text is always emitted upright (never transform-flipped):
   * label x-positions and text-anchors are recomputed so nothing renders backward.
   *
   * Used to orient the map to the shoulder currently being worked:
   *   - First Shoulder: mirrored, so the neckline shaping sits on the visual side users
   *     associate with the first checklist's initial Left carriage row.
   *   - Second Shoulder: unmirrored (the opposite orientation), same schedule.
   */
  mirror?: boolean;
};

const DEFAULT_CELL = 14;
const PAD_LEFT = 18;
/** Top margin above the grid — keeps the top shoulder bind-off label from hugging the SVG edge. */
export const SHAPING_MAP_PAD_TOP_PX = 32;
const PAD_RIGHT = 72; // room for enlarged right-side row numbers
const PAD_BOTTOM = 46; // room for the center bind-off label
const MIN_SIDE_MARGIN = 8;
/** Keep in sync with `.shaping-map-step-label` in shaping-map.css */
export const SHAPING_MAP_STEP_LABEL_FONT_PX = 20;
/**
 * Horizontal gap (px) between the black outline and a step label.
 * Labels sit to the visual left of the outline so they never sit on the stroke.
 */
export const SHAPING_MAP_STEP_LABEL_OUTLINE_OFFSET_PX = 18;
/**
 * Extra upward offset (px) for the centered final shoulder bind-off label so it sits
 * clearly above the horizontal shoulder line (SVG y decreases upward).
 */
export const SHAPING_MAP_SHOULDER_LABEL_ABOVE_LINE_PX = 14;
/** Keep in sync with `.shaping-map-row-number` in shaping-map.css */
export const SHAPING_MAP_ROW_NUMBER_FONT_PX = SHAPING_MAP_STEP_LABEL_FONT_PX;
/** Keep in sync with `.shaping-map-center-label` in shaping-map.css */
export const SHAPING_MAP_CENTER_LABEL_FONT_PX = 12;
/** Extra left reserve beyond measured center-label width (scales with digit count). */
const CENTER_LABEL_MARGIN_PAD_PX = 16;
/** Vertical offset of the center bind-off label below its row line (smaller = closer to the outline). */
const CENTER_LABEL_BELOW_ROW_PX = 12;
// Extra breathing room reserved only when the optional edge callouts are present, so
// "Armhole Edge" sits in a clear band above the top step and "Neck Edge" sits clearly
// below the center bind-off label. Sized for the larger edge-label font.
const EDGE_LABEL_TOP_GAP = 26;
/** Space from the center bind-off baseline down to the "Neck Edge" callout. */
const EDGE_LABEL_BOTTOM_GAP = 40;

function escapeXml(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Shared center bind-off callout used by every pattern adapter that supplies `centerStitches`. */
export function formatCenterStitchesLabel(centerStitches: number): string {
  const n = Math.max(0, Math.floor(centerStitches));
  return n === 1 ? "Bind off 1 center stitch" : `Bind off ${n} center stitches`;
}

/** Rough width estimate for upright sans-serif labels (avoids clipping without a DOM measure). */
function estimateTextWidthPx(text: string, fontSizePx: number): number {
  return Math.max(0, text.length) * fontSizePx * 0.62;
}

/**
 * Pixel y for a step label: vertically centered on the grid row where the action occurs.
 * Keep in sync with `dominant-baseline: central` on `.shaping-map-step-label`.
 */
export function stepLabelCenterY(
  row: number,
  yPx: (row: number) => number,
): number {
  return yPx(row);
}

/**
 * Pixel x for a step label (pre-layout-shift, post-mirror): sits to the visual left of
 * the outline with a consistent gap. Pass both ends of the horizontal segment in
 * data-space pixels; the visual-left end is chosen after `fx` so mirror stays correct.
 */
export function stepLabelDrawX(
  segX0Px: number,
  segX1Px: number,
  fx: (px: number) => number,
): number {
  const visualLeftOutlineX = Math.min(fx(segX0Px), fx(segX1Px));
  return visualLeftOutlineX - SHAPING_MAP_STEP_LABEL_OUTLINE_OFFSET_PX;
}

function textLeftExtent(
  x: number,
  anchor: "start" | "middle" | "end",
  widthPx: number,
): number {
  if (anchor === "start") return x;
  if (anchor === "end") return x - widthPx;
  return x - widthPx / 2;
}

type StepLabelGeometry = {
  segX0: number;
  segX1: number;
  row: number;
  text: string;
  /**
   * When true, the label is centered on its horizontal segment (`text-anchor="middle"`)
   * and lifted above the stroke. Used for every labeled step on the shoulder path.
   * Neck-edge step labels stay left of the outline.
   */
  centerOnSegment: boolean;
};

type PathGeometry = {
  /** Absolute grid points (stitch X, row) tracing the stepped path. */
  points: { x: number; row: number }[];
  /**
   * One entry per step, for placing the count label beside the horizontal run.
   * `segX0` / `segX1` are the stitch-space ends of that run; the renderer picks the
   * visual-left end after mirroring so labels stay clear of the outline (unless
   * `centerOnSegment` is set).
   */
  labels: StepLabelGeometry[];
  /** Final point of the path (where a center segment can attach). */
  endX: number;
  endRow: number;
  /** Horizontal step direction of this path (+1 / -1). */
  dir: number;
  maxX: number;
  maxRow: number;
  minRow: number;
};

/**
 * Trace a path in grid (stitch, row) space. Each step binds off horizontally
 * (inward, per {@link ShapingMapPath.edge}) then works `rows` rows in the path's
 * {@link ShapingMapPath.rowDirection}.
 */
function tracePath(path: ShapingMapPath): PathGeometry {
  const dir = path.edge === "right" ? -1 : 1;
  const rowSign = path.rowDirection === "down" ? -1 : 1;
  let x = path.startX;
  let row = path.startRow;
  const points: PathGeometry["points"] = [{ x, row }];
  const labels: PathGeometry["labels"] = [];
  let maxX = x;
  let maxRow = row;
  let minRow = row;

  const centerShoulderLabels = path.id === "shoulder";

  for (const step of path.steps) {
    const nx = x + dir * step.stitches;
    if (step.stitches !== 0) {
      const text = step.label ?? `-${step.stitches}`;
      if (text) {
        labels.push({
          segX0: x,
          segX1: nx,
          row,
          text,
          // Every shoulder bind-off sits centered above its segment; neck stays left-of-outline.
          centerOnSegment: centerShoulderLabels,
        });
      }
    }
    x = nx;
    points.push({ x, row });
    row += rowSign * step.rows;
    if (step.rows !== 0) points.push({ x, row });
    maxX = Math.max(maxX, x);
    maxRow = Math.max(maxRow, row);
    minRow = Math.min(minRow, row);
  }

  return { points, labels, endX: x, endRow: row, dir, maxX, maxRow, minRow };
}

/** Midpoint of a horizontal step segment in stitch space. */
export function stepLabelSegmentMidX(segX0: number, segX1: number): number {
  return (segX0 + segX1) / 2;
}

/**
 * PROTOTYPE renderer. Returns an SVG string (no external state, safe for server or
 * client innerHTML). Uses CSS classes rather than inline styles where practical so
 * the look is controlled by `shaping-map.css`.
 */
export function renderShapingMapSvg(
  data: ShapingMapData,
  options: RenderShapingMapOptions = {},
): string {
  const cell = options.cell ?? DEFAULT_CELL;
  const rowNumberInterval = Math.max(1, options.rowNumberInterval ?? 2);
  const majorEvery = Math.max(1, options.majorEvery ?? 10);
  const showFabricFill = options.showFabricFill !== false;
  const mirror = options.mirror === true;

  const traced = data.paths.map(tracePath);

  // Center bind-off segment continues from the last path's end, in that path's
  // horizontal direction, so the neck shaping and the center stitches connect.
  const lastPath = traced.length > 0 ? traced[traced.length - 1]! : undefined;
  const centerStitches =
    typeof data.centerStitches === "number" && data.centerStitches > 0
      ? data.centerStitches
      : 0;
  const centerSeg =
    lastPath && centerStitches > 0
      ? {
          x1: lastPath.endX,
          x2: lastPath.endX + lastPath.dir * centerStitches,
          row: lastPath.endRow,
        }
      : undefined;

  const allMaxX = Math.max(
    ...traced.map((t) => t.maxX),
    centerSeg ? Math.max(centerSeg.x1, centerSeg.x2) : 0,
    0,
  );
  const rowMax = Math.max(data.rowMax, ...traced.map((t) => t.maxRow));
  const rowMin = Math.min(data.rowMin, ...traced.map((t) => t.minRow));
  const gridStitches = Math.max(1, Math.ceil(allMaxX));
  const gridRows = Math.max(1, rowMax - rowMin);

  const shoulderEdgeLabel = data.edgeLabels?.shoulder?.trim() ?? "";
  const neckEdgeLabel = data.edgeLabels?.neck?.trim() ?? "";
  const padTop = SHAPING_MAP_PAD_TOP_PX + (shoulderEdgeLabel ? EDGE_LABEL_TOP_GAP : 0);
  const padBottom = PAD_BOTTOM + (neckEdgeLabel ? EDGE_LABEL_BOTTOM_GAP : 0);

  const centerLabelText = centerStitches > 0 ? formatCenterStitchesLabel(centerStitches) : "";
  const centerLabelWidthPx = centerLabelText
    ? estimateTextWidthPx(centerLabelText, SHAPING_MAP_CENTER_LABEL_FONT_PX)
    : 0;

  // Base layout width: grid plus the standard right margin that holds the row-number column.
  const baseWidth = PAD_LEFT + gridStitches * cell + PAD_RIGHT;
  // In the mirrored branch (the corrected first-shoulder orientation, where the shoulder steps
  // inward toward the neckline as RC increases and therefore renders on the RIGHT), the reflected
  // geometry + bind-off labels land in the right margin, on top of the row numbers. Reserve extra
  // right-side space and shift ONLY the row-number column clear of that geometry. The unmirrored
  // orientation is untouched ? its row-number placement is already correct.
  const mirroredRowNumberShift = mirror ? PAD_RIGHT - PAD_LEFT : 0;
  const height = padTop + gridRows * cell + padBottom;

  const fmt = (n: number): string => (Math.round(n * 100) / 100).toString();
  const xPx = (stitch: number): number => PAD_LEFT + stitch * cell;
  const yPx = (row: number): number => padTop + (rowMax - row) * cell;

  const gridTop = yPx(rowMax);
  const gridBottom = yPx(rowMin);
  const gridLeft = xPx(0);
  const gridRight = xPx(gridStitches);

  const fx = (px: number): number => (mirror ? baseWidth - px : px);
  const flipAnchor = (anchor: "start" | "middle" | "end"): "start" | "middle" | "end" =>
    !mirror ? anchor : anchor === "start" ? "end" : anchor === "end" ? "start" : "middle";

  const neckSideX = centerSeg ? xPx(Math.max(centerSeg.x1, centerSeg.x2)) : gridRight;
  const centerLabelBaseY = centerSeg
    ? yPx(centerSeg.row) + CENTER_LABEL_BELOW_ROW_PX
    : gridBottom + 26;
  const neckAnchor = flipAnchor("end");

  let minContentX = gridLeft;
  for (const t of traced) {
    for (const lbl of t.labels) {
      if (!lbl.text.trim()) continue;
      const stepWidth = estimateTextWidthPx(lbl.text, SHAPING_MAP_STEP_LABEL_FONT_PX);
      if (lbl.centerOnSegment) {
        const midX = fx(xPx(stepLabelSegmentMidX(lbl.segX0, lbl.segX1)));
        minContentX = Math.min(minContentX, textLeftExtent(midX, "middle", stepWidth));
      } else {
        const stepX = stepLabelDrawX(xPx(lbl.segX0), xPx(lbl.segX1), fx);
        // Left-of-outline labels use text-anchor="end".
        minContentX = Math.min(minContentX, textLeftExtent(stepX, "end", stepWidth));
      }
    }
  }
  if (centerLabelText) {
    minContentX = Math.min(
      minContentX,
      textLeftExtent(fx(neckSideX), neckAnchor, centerLabelWidthPx),
    );
  }
  if (shoulderEdgeLabel) {
    const shoulderWidth = estimateTextWidthPx(shoulderEdgeLabel, 13);
    minContentX = Math.min(
      minContentX,
      textLeftExtent(fx(gridLeft), flipAnchor("start"), shoulderWidth),
    );
  }
  if (neckEdgeLabel) {
    const neckWidth = estimateTextWidthPx(neckEdgeLabel, 13);
    minContentX = Math.min(
      minContentX,
      textLeftExtent(fx(neckSideX), neckAnchor, neckWidth),
    );
  }

  // Expand the viewBox so every callout (especially long center bind-off labels) stays
  // inside x >= MIN_SIDE_MARGIN. Uses measured left extents — not CSS overflow hacks.
  const leftOverflow = MIN_SIDE_MARGIN - minContentX;
  const layoutOffsetX =
    leftOverflow > 0 ? leftOverflow + CENTER_LABEL_MARGIN_PAD_PX : 0;
  const shiftX = (px: number): number => px + layoutOffsetX;
  const width = baseWidth + mirroredRowNumberShift + layoutOffsetX;
  const drawX = (px: number): number => shiftX(fx(px));

  const parts: string[] = [];

  parts.push(
    `<rect class="shaping-map-bg" x="0" y="0" width="${fmt(width)}" height="${fmt(height)}" />`,
  );

  if (showFabricFill && traced.length > 0) {
    const edgePts: { x: number; row: number }[] = [];
    for (const t of traced) edgePts.push(...t.points);
    if (centerSeg) edgePts.push({ x: centerSeg.x2, row: centerSeg.row });
    const first = edgePts[0]!;
    const last = edgePts[edgePts.length - 1]!;
    const poly = [
      ...edgePts.map((p) => `${fmt(drawX(xPx(p.x)))},${fmt(yPx(p.row))}`),
      `${fmt(drawX(xPx(last.x)))},${fmt(gridBottom)}`,
      `${fmt(drawX(xPx(first.x)))},${fmt(gridBottom)}`,
    ].join(" ");
    parts.push(`<polygon class="shaping-map-fabric" points="${poly}" />`);
  }

  const gridMinor: string[] = [];
  const gridMajor: string[] = [];
  for (let s = 0; s <= gridStitches; s++) {
    const gx = drawX(xPx(s));
    const line = `<line x1="${fmt(gx)}" y1="${fmt(gridTop)}" x2="${fmt(gx)}" y2="${fmt(gridBottom)}" />`;
    (s % majorEvery === 0 ? gridMajor : gridMinor).push(line);
  }
  for (let r = rowMin; r <= rowMax; r++) {
    const gy = yPx(r);
    const line = `<line x1="${fmt(drawX(gridLeft))}" y1="${fmt(gy)}" x2="${fmt(drawX(gridRight))}" y2="${fmt(gy)}" />`;
    (r % majorEvery === 0 ? gridMajor : gridMinor).push(line);
  }
  parts.push(`<g class="shaping-map-grid-minor">${gridMinor.join("")}</g>`);
  parts.push(`<g class="shaping-map-grid-major">${gridMajor.join("")}</g>`);

  const rowNumbers: string[] = [];
  const rowNumX = shiftX(gridRight + 8 + mirroredRowNumberShift);
  for (let r = rowMin; r <= rowMax; r++) {
    if (r % rowNumberInterval !== 0) continue;
    // y = grid row line; dominant-baseline="central" keeps the glyph centered on that line.
    rowNumbers.push(
      `<text class="shaping-map-row-number" x="${fmt(rowNumX)}" y="${fmt(yPx(r))}" dominant-baseline="central">${r}</text>`,
    );
  }
  parts.push(`<g>${rowNumbers.join("")}</g>`);

  const edgePoints: { x: number; row: number }[] = [];
  for (const t of traced) {
    for (const p of t.points) {
      const prev = edgePoints[edgePoints.length - 1];
      if (prev && prev.x === p.x && prev.row === p.row) continue;
      edgePoints.push(p);
    }
  }
  if (centerSeg) edgePoints.push({ x: centerSeg.x2, row: centerSeg.row });
  if (edgePoints.length > 1) {
    const pts = edgePoints.map((p) => `${fmt(drawX(xPx(p.x)))},${fmt(yPx(p.row))}`).join(" ");
    parts.push(`<polyline class="shaping-map-path" points="${pts}" />`);
  }

  for (const t of traced) {
    for (const lbl of t.labels) {
      if (!lbl.text.trim()) continue;
      if (lbl.centerOnSegment) {
        // Shoulder bind-off: centered over its horizontal segment, lifted above the stroke.
        const stepX = drawX(xPx(stepLabelSegmentMidX(lbl.segX0, lbl.segX1)));
        const labelY =
          stepLabelCenterY(lbl.row, yPx) - SHAPING_MAP_SHOULDER_LABEL_ABOVE_LINE_PX;
        parts.push(
          `<text class="shaping-map-step-label shaping-map-step-label--centered" x="${fmt(stepX)}" y="${fmt(labelY)}" text-anchor="middle" dominant-baseline="central">${escapeXml(lbl.text)}</text>`,
        );
      } else {
        const stepX = shiftX(stepLabelDrawX(xPx(lbl.segX0), xPx(lbl.segX1), fx));
        const labelY = stepLabelCenterY(lbl.row, yPx);
        parts.push(
          `<text class="shaping-map-step-label" x="${fmt(stepX)}" y="${fmt(labelY)}" text-anchor="end" dominant-baseline="central">${escapeXml(lbl.text)}</text>`,
        );
      }
    }
  }

  if (centerLabelText) {
    parts.push(
      `<text class="shaping-map-center-label" x="${fmt(drawX(neckSideX))}" y="${fmt(centerLabelBaseY)}" text-anchor="${neckAnchor}">${escapeXml(centerLabelText)}</text>`,
    );
  }

  if (shoulderEdgeLabel) {
    const shoulderEdgeY = EDGE_LABEL_TOP_GAP - 8;
    parts.push(
      `<text class="shaping-map-edge-label" x="${fmt(drawX(gridLeft))}" y="${fmt(shoulderEdgeY)}" text-anchor="${flipAnchor("start")}">${escapeXml(shoulderEdgeLabel)}</text>`,
    );
  }
  if (neckEdgeLabel) {
    const neckEdgeY =
      (centerStitches > 0 ? centerLabelBaseY : gridBottom + 16) + EDGE_LABEL_BOTTOM_GAP - 6;
    parts.push(
      `<text class="shaping-map-edge-label" x="${fmt(drawX(neckSideX))}" y="${fmt(neckEdgeY)}" text-anchor="${neckAnchor}">${escapeXml(neckEdgeLabel)}</text>`,
    );
  }

  const titleAttr = data.title
    ? ` aria-label="${escapeXml(data.title)}"`
    : ` aria-label="Shaping map"`;

  return (
    `<svg class="shaping-map__svg" viewBox="0 0 ${fmt(width)} ${fmt(height)}" ` +
    `preserveAspectRatio="xMidYMid meet" role="img"${titleAttr} xmlns="http://www.w3.org/2000/svg">` +
    parts.join("") +
    `</svg>`
  );
}

/**
 * PROTOTYPE sample data - hardcoded, NOT derived from instruction text.
 *
 * Laid out as ONE continuous neckline/shoulder edge for a single shoulder, read
 * top-left (armhole) down to lower-right (center front):
 *   - shoulder bind-offs (-6 x3) step down/right from the armhole corner at the top,
 *   - the neck edge (-1 x4, then -5) continues DOWN from where the shoulder ended,
 *   - the 18 center stitches finish as a flat bind-off at the lower right.
 * Row window is kept compact (232-250) so the shape fills the available area.
 *
 * Replace this with real shaping data once the renderer is wired to pattern math:
 * the shoulder path anchors at the armhole/top, and the neck path's start is simply
 * the shoulder path's end so the two stay connected.
 */
export const SAMPLE_SHAPING_MAP_DATA: ShapingMapData = {
  title: "Neckline & shoulder shaping map (sample)",
  rowMin: 232,
  rowMax: 250,
  centerStitches: 18,
  paths: [
    {
      id: "shoulder",
      label: "Shoulder",
      edge: "left",
      rowDirection: "down",
      startX: 0,
      startRow: 250,
      steps: [
        { stitches: 6, rows: 2, label: "-6" },
        { stitches: 6, rows: 2, label: "-6" },
        { stitches: 6, rows: 2, label: "-6" },
      ],
    },
    {
      // Continues directly from the shoulder end (18, 244) so the edge stays connected.
      id: "neck",
      label: "Neck",
      edge: "left",
      rowDirection: "down",
      startX: 18,
      startRow: 244,
      steps: [
        { stitches: 1, rows: 2, label: "-1" },
        { stitches: 1, rows: 2, label: "-1" },
        { stitches: 1, rows: 2, label: "-1" },
        { stitches: 1, rows: 2, label: "-1" },
        { stitches: 5, rows: 2, label: "-5" },
      ],
    },
  ],
};
