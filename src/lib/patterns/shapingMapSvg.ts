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

/**
 * How paths are joined into a chart:
 *   - `single-edge` (default): one continuous profile; the optional center bind-off
 *     continues from the last path. Used by sweater Visual Guides.
 *   - `symmetrical`: left paths + center gap + mirrored right paths, so the chart
 *     reads as a full neckline (both shoulders at once).
 */
export type ShapingMapLayout = "single-edge" | "symmetrical";

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
  /**
   * Override the on-chart center bind-off callout. Unset uses
   * {@link formatCenterStitchesLabel}. Pass `""` to hide the on-chart callout
   * (for example when a compact HTML legend below the chart carries the full text).
   */
  centerLabel?: string;
  /**
   * Chart assembly. Default `single-edge`. Set `symmetrical` when `paths` include
   * both a left half (`edge: "left"`) and a right half (`edge: "right"`).
   */
  layout?: ShapingMapLayout;
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
  /**
   * Lower even-knit rectangle drawn below the shaping grid (Skill Builder practice
   * piece). Omit on sweater Visual Guides.
   */
  practicePiece?: {
    evenRows: number;
    castOnStitches: number;
    /** Live stitches in each shoulder section before neckline shaping. Drawn in the lower rectangle. */
    startingShoulderStitches?: number;
  };
  /**
   * Compact center bind-off callout drawn in the lower rectangle (Skill Builder).
   * Prefer this over {@link centerLabel} when the long sweater wording should stay off the chart.
   */
  centerAnnotation?: {
    bindOff: string;
  };
};

/** Options for the renderer (kept tiny for the prototype). */
export type RenderShapingMapOptions = {
  /** Pixels per stitch (horizontal data unit) in the SVG coordinate space. */
  cell?: number;
  /**
   * Vertical size of one row as a fraction of {@link cell}. Default `1` keeps the
   * existing square grid (sweater Visual Guides). Pass `0.67` for a knitting-
   * proportional chart (rows shorter than stitches). Does not change stitch/row
   * counts or the printed row numbers.
   */
  rowHeightRatio?: number;
  /** Label every Nth row on the right side (default 2). */
  rowNumberInterval?: number;
  /**
   * Pad row-number labels to this many digits (e.g. `3` → `000`). Default `0`
   * leaves numbers unpadded so sweater Visual Guides stay unchanged.
   */
  rowNumberPad?: number;
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
  /**
   * Overrides {@link ShapingMapData.layout}. Use `symmetrical` for a mirrored
   * left/right chart with an optional center bind-off gap.
   */
  layout?: ShapingMapLayout;
  /**
   * Draw an extra even-row grid band above {@link ShapingMapData.rowMax} so the
   * completion RC (e.g. 006) has its own visible row of cells, not only a label
   * on the top boundary line. Skill Builder charts set this; sweater Visual
   * Guides stay on the default (no extra band).
   */
  completionRowBand?: boolean;
};

const DEFAULT_CELL = 14;
/** Square grid (one stitch = one row in pixels). Existing sweater charts use this. */
export const SHAPING_MAP_DEFAULT_ROW_HEIGHT_RATIO = 1;
/** Typical knit fabric: row height ≈ 67% of stitch width. */
export const SHAPING_MAP_KNIT_ROW_HEIGHT_RATIO = 0.67;

/** Pixel height of one chart row for the given stitch size and optional ratio. */
export function shapingMapRowCellPx(cell: number, rowHeightRatio?: number): number {
  const ratio =
    typeof rowHeightRatio === "number" && Number.isFinite(rowHeightRatio) && rowHeightRatio > 0
      ? rowHeightRatio
      : SHAPING_MAP_DEFAULT_ROW_HEIGHT_RATIO;
  return cell * ratio;
}
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
/**
 * Upward offset (px) for left-neck minus labels in a full-neckline chart so the
 * group sits just above each action row (SVG y decreases upward). The initial
 * `-N` sits above the RC 000 opening line instead of on or below it.
 */
export const SHAPING_MAP_SYMMETRICAL_NECK_LABEL_ABOVE_LINE_PX = 12;
/** Keep in sync with `.shaping-map-row-number` in shaping-map.css */
export const SHAPING_MAP_ROW_NUMBER_FONT_PX = SHAPING_MAP_STEP_LABEL_FONT_PX;
/** Keep in sync with `.shaping-map-center-label` in shaping-map.css */
export const SHAPING_MAP_CENTER_LABEL_FONT_PX = 12;
/** Keep in sync with `.shaping-map-annotation` in shaping-map.css */
export const SHAPING_MAP_ANNOTATION_FONT_PX = 18;
/** Extra left reserve beyond measured center-label width (scales with digit count). */
const CENTER_LABEL_MARGIN_PAD_PX = 16;
/** Vertical offset of the center bind-off label below its row line (smaller = closer to the outline). */
const CENTER_LABEL_BELOW_ROW_PX = 12;
/**
 * In a symmetrical full-neckline chart the long center callout sits below the baseline
 * so it cannot collide with the left-side neck-edge minus labels.
 */
export const SHAPING_MAP_SYMMETRICAL_CENTER_LABEL_BELOW_ROW_PX = 40;
/** Extra bottom padding so the below-center callout stays inside the viewBox. */
const SYMMETRICAL_CENTER_PAD_EXTRA_PX = 24;
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

/** Short on-chart center bind-off, e.g. `-6 center sts`. */
export function formatCenterBindOffChartLabel(centerStitches: number): string {
  const n = Math.max(0, Math.floor(centerStitches));
  return `-${n} center sts`;
}

/** Compact chart JP (`2s-2r-1x` → `2-2-1`). Non-segment lines pass through. */
export function formatChartCompactNotation(line: string): string {
  const match = String(line ?? "").trim().match(/^(\d+)s-(\d+)r-(\d+)x$/);
  if (!match) return String(line ?? "").trim();
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** Compact abbreviation key for a full-neckline chart (HTML legend below the SVG). */
export function formatShapingMapCompactLegendItems(centerStitches: number): {
  bindOff: string;
  decrease: string;
  center: string;
} {
  const n = Math.max(0, Math.floor(centerStitches));
  return {
    bindOff: "BO = bind off",
    decrease: "Dec = decrease",
    center: n === 1 ? "Center: bind off 1 stitch" : `Center: bind off ${n} stitches`,
  };
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
  side: "left" | "right" = "left",
  offsetPx: number = SHAPING_MAP_STEP_LABEL_OUTLINE_OFFSET_PX,
): number {
  if (side === "right") {
    const visualRightOutlineX = Math.max(fx(segX0Px), fx(segX1Px));
    return visualRightOutlineX + offsetPx;
  }
  const visualLeftOutlineX = Math.min(fx(segX0Px), fx(segX1Px));
  return visualLeftOutlineX - offsetPx;
}

/**
 * In a full-neckline chart, each neck-edge minus label sits in the center opening,
 * a consistent gap to the right of that step's inner vertical outline.
 */
export const SHAPING_MAP_SYMMETRICAL_NECK_LABEL_OUTLINE_OFFSET_PX = 22;

function resolvedOutlineSide(
  _pathEdge: "left" | "right",
  storedSide: "left" | "right",
  symmetrical: boolean,
): "left" | "right" {
  // Full-neckline: every non-centered label sits to the visual left of its
  // step (beside the edge, not in the center gap or the row-number column).
  if (symmetrical) return "left";
  return storedSide;
}

function isRemainingStitchesLabel(text: string): boolean {
  return /\bsts\b/i.test(text);
}

function isSymmetricalNeckOpeningLabel(label: {
  text: string;
  centerOnSegment: boolean;
}): boolean {
  return !label.centerOnSegment && !isRemainingStitchesLabel(label.text);
}

/** Pixel x for a left-neck minus label: inside the center opening, right of that step's inner vertical. */
export function symmetricalNeckOpeningLabelDrawX(
  segX0Px: number,
  segX1Px: number,
  fx: (px: number) => number,
  offsetPx: number = SHAPING_MAP_SYMMETRICAL_NECK_LABEL_OUTLINE_OFFSET_PX,
): number {
  const innerOutlineX = Math.max(fx(segX0Px), fx(segX1Px));
  return innerOutlineX + offsetPx;
}

function useCenteredStepLabel(
  label: { text: string; centerOnSegment: boolean; row: number },
  symmetrical: boolean,
  rowMax: number,
): boolean {
  if (!label.centerOnSegment) return false;
  if (!symmetrical) return true;
  if (isRemainingStitchesLabel(label.text)) return true;
  // The final outside bind-off sits on the top row; lift it above that line so
  // it does not share a band with the last neck-edge decrease on the row below.
  return label.row === rowMax;
}

function pushUniquePoint(
  points: { x: number; row: number }[],
  point: { x: number; row: number },
): void {
  const prev = points[points.length - 1];
  if (prev && prev.x === point.x && prev.row === point.row) return;
  points.push(point);
}

/**
 * Single-edge: concatenate paths then attach the center stub.
 * Symmetrical: left half + center gap + reversed right half, so the outline
 * reads as a full neckline from the left outside edge to the right outside edge.
 */
function buildOutlinePoints(
  traced: PathGeometry[],
  centerSeg: { x1: number; x2: number; row: number } | undefined,
  layout: ShapingMapLayout,
): { x: number; row: number }[] {
  const points: { x: number; row: number }[] = [];
  if (layout === "symmetrical") {
    const left = traced.filter((t) => t.edge !== "right");
    const right = traced.filter((t) => t.edge === "right");
    for (const t of left) {
      for (const p of t.points) pushUniquePoint(points, p);
    }
    if (centerSeg) {
      pushUniquePoint(points, { x: centerSeg.x1, row: centerSeg.row });
      pushUniquePoint(points, { x: centerSeg.x2, row: centerSeg.row });
    }
    for (const t of [...right].reverse()) {
      for (const p of [...t.points].reverse()) pushUniquePoint(points, p);
    }
    return points;
  }
  for (const t of traced) {
    for (const p of t.points) pushUniquePoint(points, p);
  }
  if (centerSeg) pushUniquePoint(points, { x: centerSeg.x2, row: centerSeg.row });
  return points;
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
   * Neck-edge step labels stay beside the outline (`outlineSide`).
   */
  centerOnSegment: boolean;
  /** Which side of the outline a non-centered neck-edge label sits on. */
  outlineSide: "left" | "right";
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
  edge: "left" | "right";
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

  const centerShoulderLabels = path.id.startsWith("shoulder");
  const edge: "left" | "right" = path.edge === "right" ? "right" : "left";

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
          // Every shoulder bind-off sits centered above its segment; neck stays beside the outline.
          centerOnSegment: centerShoulderLabels,
          outlineSide: centerShoulderLabels ? "left" : edge,
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

  return { points, labels, endX: x, endRow: row, dir, edge, maxX, maxRow, minRow };
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
  const rowCell = shapingMapRowCellPx(cell, options.rowHeightRatio);
  const rowNumberInterval = Math.max(1, options.rowNumberInterval ?? 2);
  const rowNumberPad = Math.max(0, Math.floor(options.rowNumberPad ?? 0));
  const formatRowNumber = (row: number): string => {
    const n = Math.round(row);
    return rowNumberPad > 0 ? String(Math.max(0, n)).padStart(rowNumberPad, "0") : String(n);
  };
  const majorEvery = Math.max(1, options.majorEvery ?? 10);
  const showFabricFill = options.showFabricFill !== false;
  const mirror = options.mirror === true;
  const layout: ShapingMapLayout = options.layout ?? data.layout ?? "single-edge";
  const symmetrical = layout === "symmetrical";

  const traced = data.paths.map(tracePath);

  // Center bind-off segment: single-edge continues from the last path in that
  // path's direction. Symmetrical attaches from the last LEFT path, always +X,
  // so the gap sits between the two halves.
  const centerStitches =
    typeof data.centerStitches === "number" && data.centerStitches > 0
      ? data.centerStitches
      : 0;
  const lastLeft =
    traced.filter((t) => t.edge !== "right").at(-1) ?? traced.at(-1);
  const lastPath = traced.at(-1);
  const centerAnchor = symmetrical ? lastLeft : lastPath;
  const centerSeg =
    centerAnchor && centerStitches > 0
      ? {
          x1: centerAnchor.endX,
          x2:
            centerAnchor.endX +
            (symmetrical ? 1 : centerAnchor.dir) * centerStitches,
          row: centerAnchor.endRow,
        }
      : undefined;

  const allMaxX = Math.max(
    ...traced.map((t) => t.maxX),
    centerSeg ? Math.max(centerSeg.x1, centerSeg.x2) : 0,
    0,
  );
  const rowMax = Math.max(data.rowMax, ...traced.map((t) => t.maxRow));
  const rowMin = Math.min(data.rowMin, ...traced.map((t) => t.minRow));
  const extraRows = options.completionRowBand === true ? rowNumberInterval : 0;
  const gridStitches = Math.max(1, Math.ceil(allMaxX));
  const gridRows = Math.max(1, rowMax + extraRows - rowMin);

  const shoulderEdgeLabel = data.edgeLabels?.shoulder?.trim() ?? "";
  const neckEdgeLabel = data.edgeLabels?.neck?.trim() ?? "";
  const practiceRows = Math.max(0, Math.floor(data.practicePiece?.evenRows ?? 0));
  const practiceCastOn = Math.max(0, Math.floor(data.practicePiece?.castOnStitches ?? 0));
  const startingShoulderStitches = Math.max(
    0,
    Math.floor(data.practicePiece?.startingShoulderStitches ?? 0),
  );
  const hasPractice = practiceRows > 0 && practiceCastOn > 0;
  const padTop = SHAPING_MAP_PAD_TOP_PX + (shoulderEdgeLabel ? EDGE_LABEL_TOP_GAP : 0);
  const dimLeft = hasPractice ? 96 : 0;
  const centerAnnBindOff = data.centerAnnotation?.bindOff?.trim() ?? "";
  const hasCenterAnn = Boolean(centerAnnBindOff);
  const defaultCenterLabel =
    centerStitches > 0 ? formatCenterStitchesLabel(centerStitches) : "";
  const centerLabelText = hasCenterAnn
    ? ""
    : data.centerLabel !== undefined
      ? data.centerLabel
      : defaultCenterLabel;
  const centerLabelWidthPx = centerLabelText
    ? estimateTextWidthPx(centerLabelText, SHAPING_MAP_CENTER_LABEL_FONT_PX)
    : 0;
  const CAST_ON_BAND_PX = 28;
  const practiceHeight = hasPractice ? practiceRows * rowCell : 0;
  const padBottom =
    (hasPractice ? CAST_ON_BAND_PX : PAD_BOTTOM) +
    (neckEdgeLabel ? EDGE_LABEL_BOTTOM_GAP : 0) +
    (symmetrical && centerLabelText ? SYMMETRICAL_CENTER_PAD_EXTRA_PX : 0);

  // Base layout width: grid plus the standard right margin that holds the row-number column.
  const baseWidth = PAD_LEFT + dimLeft + gridStitches * cell + PAD_RIGHT;
  // In the mirrored branch (the corrected first-shoulder orientation, where the shoulder steps
  // inward toward the neckline as RC increases and therefore renders on the RIGHT), the reflected
  // geometry + bind-off labels land in the right margin, on top of the row numbers. Reserve extra
  // right-side space and shift ONLY the row-number column clear of that geometry. The unmirrored
  // orientation is untouched ? its row-number placement is already correct.
  const mirroredRowNumberShift = mirror ? PAD_RIGHT - PAD_LEFT : 0;
  const height = padTop + gridRows * rowCell + practiceHeight + padBottom;

  const fmt = (n: number): string => (Math.round(n * 100) / 100).toString();
  const xPx = (stitch: number): number => PAD_LEFT + dimLeft + stitch * cell;
  const yPx = (row: number): number => padTop + (rowMax + extraRows - row) * rowCell;

  const gridTop = yPx(rowMax + extraRows);
  const labeledTop = yPx(rowMax);
  const gridBottom = yPx(rowMin);
  const gridLeft = xPx(0);
  const gridRight = xPx(gridStitches);

  const fx = (px: number): number => (mirror ? baseWidth - px : px);
  const flipAnchor = (anchor: "start" | "middle" | "end"): "start" | "middle" | "end" =>
    !mirror ? anchor : anchor === "start" ? "end" : anchor === "end" ? "start" : "middle";

  const neckSideX = centerSeg ? xPx(Math.max(centerSeg.x1, centerSeg.x2)) : gridRight;
  const centerMidX = centerSeg ? xPx((centerSeg.x1 + centerSeg.x2) / 2) : neckSideX;
  const centerLabelBelowPx = symmetrical
    ? SHAPING_MAP_SYMMETRICAL_CENTER_LABEL_BELOW_ROW_PX
    : CENTER_LABEL_BELOW_ROW_PX;
  const centerLabelBaseY = centerSeg
    ? yPx(centerSeg.row) + centerLabelBelowPx
    : gridBottom + 26;
  const neckAnchor = flipAnchor("end");
  const centerLabelAnchor = symmetrical ? flipAnchor("middle") : neckAnchor;
  const centerLabelX = symmetrical ? centerMidX : neckSideX;

  let minContentX = gridLeft;
  let maxContentX = gridRight;
  for (const t of traced) {
    for (const lbl of t.labels) {
      if (!lbl.text.trim()) continue;
      const stepWidth = estimateTextWidthPx(lbl.text, SHAPING_MAP_STEP_LABEL_FONT_PX);
      if (useCenteredStepLabel(lbl, symmetrical, rowMax)) {
        const midX = fx(xPx(stepLabelSegmentMidX(lbl.segX0, lbl.segX1)));
        minContentX = Math.min(minContentX, textLeftExtent(midX, "middle", stepWidth));
        maxContentX = Math.max(maxContentX, midX + stepWidth / 2);
      } else if (symmetrical && isSymmetricalNeckOpeningLabel(lbl)) {
        const stepX = symmetricalNeckOpeningLabelDrawX(xPx(lbl.segX0), xPx(lbl.segX1), fx);
        minContentX = Math.min(minContentX, stepX);
        maxContentX = Math.max(maxContentX, stepX + stepWidth);
      } else {
        const side = resolvedOutlineSide(t.edge, lbl.outlineSide, symmetrical);
        const stepX = stepLabelDrawX(
          xPx(lbl.segX0),
          xPx(lbl.segX1),
          fx,
          side,
          SHAPING_MAP_STEP_LABEL_OUTLINE_OFFSET_PX,
        );
        const anchor = side === "right" ? "start" : "end";
        minContentX = Math.min(minContentX, textLeftExtent(stepX, anchor, stepWidth));
        maxContentX = Math.max(
          maxContentX,
          side === "right" ? stepX + stepWidth : stepX,
        );
      }
    }
  }
  if (centerLabelText) {
    minContentX = Math.min(
      minContentX,
      textLeftExtent(fx(centerLabelX), centerLabelAnchor, centerLabelWidthPx),
    );
    const centerDrawnX = fx(centerLabelX);
    maxContentX = Math.max(
      maxContentX,
      centerLabelAnchor === "middle"
        ? centerDrawnX + centerLabelWidthPx / 2
        : centerLabelAnchor === "start"
          ? centerDrawnX + centerLabelWidthPx
          : centerDrawnX,
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
  if (hasPractice) {
    const evenWidth = estimateTextWidthPx(`${practiceRows} R`, 16);
    const rcWidth = estimateTextWidthPx("RC000", 16);
    minContentX = Math.min(
      minContentX,
      textLeftExtent(fx(gridLeft - 24), "end", evenWidth),
      textLeftExtent(fx(gridLeft - 44), "middle", rcWidth),
    );
  }

  // Expand the viewBox so every callout (especially long center bind-off labels) stays
  // inside x >= MIN_SIDE_MARGIN. Uses measured left extents — not CSS overflow hacks.
  const leftOverflow = MIN_SIDE_MARGIN - minContentX;
  const layoutOffsetX =
    leftOverflow > 0 ? leftOverflow + CENTER_LABEL_MARGIN_PAD_PX : 0;
  const shiftX = (px: number): number => px + layoutOffsetX;
  const rightOverflow = maxContentX + MIN_SIDE_MARGIN - (baseWidth + mirroredRowNumberShift);
  const extraRight = symmetrical && rightOverflow > 0 ? rightOverflow : 0;
  const width = baseWidth + mirroredRowNumberShift + layoutOffsetX + extraRight;
  const drawX = (px: number): number => shiftX(fx(px));

  const parts: string[] = [];

  parts.push(
    `<rect class="shaping-map-bg" x="0" y="0" width="${fmt(width)}" height="${fmt(height)}" />`,
  );

  if (showFabricFill && traced.length > 0) {
    const edgePts = buildOutlinePoints(traced, centerSeg, layout);
    const first = edgePts[0]!;
    const last = edgePts[edgePts.length - 1]!;
    const poly = [
      ...edgePts.map((p) => `${fmt(drawX(xPx(p.x)))},${fmt(yPx(p.row))}`),
      `${fmt(drawX(xPx(last.x)))},${fmt(gridBottom)}`,
      `${fmt(drawX(xPx(first.x)))},${fmt(gridBottom)}`,
    ].join(" ");
    parts.push(`<polygon class="shaping-map-fabric" points="${poly}" />`);
  }

  const practiceTop = gridBottom;
  const practiceBottom = gridBottom + practiceHeight;
  if (hasPractice) {
    const px = Math.min(drawX(gridLeft), drawX(gridRight));
    const pw = Math.abs(drawX(gridRight) - drawX(gridLeft));
    parts.push(
      `<rect class="shaping-map-practice" x="${fmt(px)}" y="${fmt(practiceTop)}" width="${fmt(pw)}" height="${fmt(practiceHeight)}" />`,
    );
  }

  const gridMinor: string[] = [];
  const gridMajor: string[] = [];
  for (let s = 0; s <= gridStitches; s++) {
    const gx = drawX(xPx(s));
    const line = `<line x1="${fmt(gx)}" y1="${fmt(gridTop)}" x2="${fmt(gx)}" y2="${fmt(gridBottom)}" />`;
    (s % majorEvery === 0 ? gridMajor : gridMinor).push(line);
  }
  for (let r = rowMin; r <= rowMax + extraRows; r++) {
    const gy = yPx(r);
    const line = `<line x1="${fmt(drawX(gridLeft))}" y1="${fmt(gy)}" x2="${fmt(drawX(gridRight))}" y2="${fmt(gy)}" />`;
    (r % majorEvery === 0 ? gridMajor : gridMinor).push(line);
  }
  parts.push(`<g class="shaping-map-grid-minor">${gridMinor.join("")}</g>`);
  parts.push(`<g class="shaping-map-grid-major">${gridMajor.join("")}</g>`);

  const rowNumbers: string[] = [];
  const rowNumX = shiftX(gridRight + 8 + mirroredRowNumberShift);
  const quietRowNumbers = hasPractice;
  const rowNumberAttrs = quietRowNumbers
    ? ` font-size="13" font-weight="400"`
    : "";
  for (let r = rowMin; r <= rowMax; r++) {
    if (r % rowNumberInterval !== 0) continue;
    // y = grid row line; dominant-baseline="central" keeps the glyph centered on that line.
    rowNumbers.push(
      `<text class="shaping-map-row-number" x="${fmt(rowNumX)}" y="${fmt(yPx(r))}"${rowNumberAttrs} dominant-baseline="central">${formatRowNumber(r)}</text>`,
    );
  }
  parts.push(`<g>${rowNumbers.join("")}</g>`);

  const edgePoints = buildOutlinePoints(traced, centerSeg, layout);
  if (edgePoints.length > 1) {
    const pts = edgePoints.map((p) => `${fmt(drawX(xPx(p.x)))},${fmt(yPx(p.row))}`).join(" ");
    parts.push(`<polyline class="shaping-map-path" points="${pts}" />`);
  }
  if (symmetrical) {
    parts.push(
      `<line class="shaping-map-path" x1="${fmt(drawX(gridLeft))}" y1="${fmt(gridBottom)}" x2="${fmt(drawX(gridRight))}" y2="${fmt(gridBottom)}" />`,
    );
  }

  for (const t of traced) {
    for (const lbl of t.labels) {
      if (!lbl.text.trim()) continue;
      if (useCenteredStepLabel(lbl, symmetrical, rowMax)) {
        // Shoulder bind-off: centered over its horizontal segment, lifted above the stroke.
        const stepX = drawX(xPx(stepLabelSegmentMidX(lbl.segX0, lbl.segX1)));
        const labelY =
          stepLabelCenterY(lbl.row, yPx) - SHAPING_MAP_SHOULDER_LABEL_ABOVE_LINE_PX;
        parts.push(
          `<text class="shaping-map-step-label shaping-map-step-label--centered" x="${fmt(stepX)}" y="${fmt(labelY)}" text-anchor="middle" dominant-baseline="central">${escapeXml(lbl.text)}</text>`,
        );
      } else if (symmetrical && isSymmetricalNeckOpeningLabel(lbl)) {
        const stepX = shiftX(
          symmetricalNeckOpeningLabelDrawX(xPx(lbl.segX0), xPx(lbl.segX1), fx),
        );
        const labelY =
          stepLabelCenterY(lbl.row, yPx) - SHAPING_MAP_SYMMETRICAL_NECK_LABEL_ABOVE_LINE_PX;
        parts.push(
          `<text class="shaping-map-step-label" x="${fmt(stepX)}" y="${fmt(labelY)}" text-anchor="start" dominant-baseline="central">${escapeXml(lbl.text)}</text>`,
        );
      } else {
        const side = resolvedOutlineSide(t.edge, lbl.outlineSide, symmetrical);
        const stepX = shiftX(
          stepLabelDrawX(
            xPx(lbl.segX0),
            xPx(lbl.segX1),
            fx,
            side,
            SHAPING_MAP_STEP_LABEL_OUTLINE_OFFSET_PX,
          ),
        );
        const labelY = stepLabelCenterY(lbl.row, yPx);
        const anchor = side === "right" ? "start" : "end";
        parts.push(
          `<text class="shaping-map-step-label" x="${fmt(stepX)}" y="${fmt(labelY)}" text-anchor="${anchor}" dominant-baseline="central">${escapeXml(lbl.text)}</text>`,
        );
      }
    }
  }

  if (centerLabelText) {
    parts.push(
      `<text class="shaping-map-center-label" x="${fmt(drawX(centerLabelX))}" y="${fmt(centerLabelBaseY)}" text-anchor="${centerLabelAnchor}">${escapeXml(centerLabelText)}</text>`,
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

  if (hasPractice) {
    const evenLabel = `${practiceRows} R`;
    const shapingRows = Math.max(1, rowMax - rowMin);
    const shapingLabel = `${shapingRows} R`;
    const castOnLabel = `Cast on ${practiceCastOn} sts`;
    const tickX = drawX(gridLeft) - 16;
    const practiceMidY = (practiceTop + practiceBottom) / 2;
    const shapingMidY = (labeledTop + gridBottom) / 2;
    parts.push(
      `<g class="shaping-map-dimension shaping-map-dimension--shaping">` +
        `<line x1="${fmt(tickX)}" y1="${fmt(labeledTop)}" x2="${fmt(tickX)}" y2="${fmt(gridBottom)}" />` +
        `<line x1="${fmt(tickX - 5)}" y1="${fmt(labeledTop)}" x2="${fmt(tickX + 5)}" y2="${fmt(labeledTop)}" />` +
        `<line x1="${fmt(tickX - 5)}" y1="${fmt(gridBottom)}" x2="${fmt(tickX + 5)}" y2="${fmt(gridBottom)}" />` +
        `<text class="shaping-map-dimension-label" x="${fmt(tickX - 10)}" y="${fmt(shapingMidY)}" text-anchor="end" dominant-baseline="central">${escapeXml(shapingLabel)}</text>` +
        `</g>`,
    );
    parts.push(
      `<g class="shaping-map-dimension shaping-map-dimension--practice">` +
        `<line x1="${fmt(tickX)}" y1="${fmt(practiceTop)}" x2="${fmt(tickX)}" y2="${fmt(practiceBottom)}" />` +
        `<line x1="${fmt(tickX - 5)}" y1="${fmt(practiceTop)}" x2="${fmt(tickX + 5)}" y2="${fmt(practiceTop)}" />` +
        `<line x1="${fmt(tickX - 5)}" y1="${fmt(practiceBottom)}" x2="${fmt(tickX + 5)}" y2="${fmt(practiceBottom)}" />` +
        `<text class="shaping-map-dimension-label" x="${fmt(tickX - 10)}" y="${fmt(practiceMidY)}" text-anchor="end" dominant-baseline="central">${escapeXml(evenLabel)}</text>` +
        `</g>`,
    );
    const markerX = drawX(gridLeft) - 44;
    const dashY = gridBottom;
    const dashHalf = 9;
    parts.push(
      `<g class="shaping-map-rc-reset" aria-label="RC000 after RC${practiceRows}">` +
        `<text class="shaping-map-rc-reset-label" x="${fmt(markerX)}" y="${fmt(dashY - 16)}" text-anchor="middle" dominant-baseline="central">RC000</text>` +
        `<line class="shaping-map-rc-reset-dash" x1="${fmt(markerX - dashHalf)}" y1="${fmt(dashY)}" x2="${fmt(markerX + dashHalf)}" y2="${fmt(dashY)}" />` +
        `<text class="shaping-map-rc-reset-label" x="${fmt(markerX)}" y="${fmt(dashY + 16)}" text-anchor="middle" dominant-baseline="central">RC${practiceRows}</text>` +
        `</g>`,
    );
    const sectionY = gridBottom + 18;
    if (startingShoulderStitches > 0 && centerSeg) {
      const leftInner = Math.min(centerSeg.x1, centerSeg.x2);
      const rightInner = Math.max(centerSeg.x1, centerSeg.x2);
      const leftMidX = drawX(xPx(leftInner / 2));
      const rightMidX = drawX(xPx((rightInner + gridStitches) / 2));
      const shoulderLabel = `${startingShoulderStitches} sts`;
      parts.push(
        `<text class="shaping-map-annotation" x="${fmt(leftMidX)}" y="${fmt(sectionY)}" text-anchor="middle">${escapeXml(shoulderLabel)}</text>`,
        `<text class="shaping-map-annotation" x="${fmt(rightMidX)}" y="${fmt(sectionY)}" text-anchor="middle">${escapeXml(shoulderLabel)}</text>`,
      );
    }
    const castOnX = (drawX(gridLeft) + drawX(gridRight)) / 2;
    parts.push(
      `<text class="shaping-map-annotation" x="${fmt(castOnX)}" y="${fmt(practiceBottom + 18)}" text-anchor="middle">${escapeXml(castOnLabel)}</text>`,
    );
  }

  if (centerAnnBindOff) {
    parts.push(
      `<text class="shaping-map-annotation" x="${fmt(drawX(centerMidX))}" y="${fmt(gridBottom + 36)}" text-anchor="middle">${escapeXml(centerAnnBindOff)}</text>`,
    );
  }

  const titleAttr = data.title
    ? ` aria-label="${escapeXml(data.title)}"`
    : ` aria-label="Shaping map"`;
  const svgClass = hasPractice ? "shaping-map__svg shaping-map__svg--practice" : "shaping-map__svg";

  return (
    `<svg class="${svgClass}" viewBox="0 0 ${fmt(width)} ${fmt(height)}" ` +
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
