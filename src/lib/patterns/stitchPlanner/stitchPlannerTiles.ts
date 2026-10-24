/**
 * Tile a full-scale planner across US Letter sheets.
 * Pages overlap so the same grid lines can be aligned. The overlap is the only
 * region printed twice. The unique portions abut, so assembly does not drop
 * or insert a stitch column or a row.
 */

export const STITCH_PLANNER_PAPER_WIDTH_IN = 8.5;
export const STITCH_PLANNER_PAPER_HEIGHT_IN = 11;
export const STITCH_PLANNER_PAGE_MARGIN_IN = 0.45;
/** Kept inside the printable area so the browser does not scale the sheet down. */
export const STITCH_PLANNER_PAGE_SLACK_IN = 0.06;
export const STITCH_PLANNER_HEADER_IN = 0.78;
export const STITCH_PLANNER_FOOTER_IN = 0.48;
export const STITCH_PLANNER_MIN_OVERLAP_IN = 0.45;

export type StitchPlannerPageBox = {
  contentWidthIn: number;
  contentHeightIn: number;
  viewWidthIn: number;
  viewHeightIn: number;
};

export type StitchPlannerTile = {
  index: number;
  col: number;
  row: number;
  cols: number;
  rows: number;
  xIn: number;
  yIn: number;
  viewWidthIn: number;
  viewHeightIn: number;
  overlapXIn: number;
  overlapYIn: number;
};

export function stitchPlannerPageBox(): StitchPlannerPageBox {
  const contentWidthIn =
    STITCH_PLANNER_PAPER_WIDTH_IN - 2 * STITCH_PLANNER_PAGE_MARGIN_IN - STITCH_PLANNER_PAGE_SLACK_IN;
  const contentHeightIn =
    STITCH_PLANNER_PAPER_HEIGHT_IN - 2 * STITCH_PLANNER_PAGE_MARGIN_IN - STITCH_PLANNER_PAGE_SLACK_IN;
  return {
    contentWidthIn,
    contentHeightIn,
    viewWidthIn: contentWidthIn,
    viewHeightIn: contentHeightIn - STITCH_PLANNER_HEADER_IN - STITCH_PLANNER_FOOTER_IN,
  };
}

/** Overlap at least `minIn`, on a grid boundary when a cell size is known. */
export function stitchPlannerOverlapInches(minIn: number, cellIn: number, viewIn: number): number {
  const cap = Math.max(cellIn, viewIn * 0.22);
  let overlap = minIn;
  if (cellIn > 0 && cellIn < viewIn * 0.2) {
    overlap = Math.ceil(minIn / cellIn) * cellIn;
  }
  if (overlap >= viewIn * 0.35) overlap = Math.min(minIn, cap);
  return Math.min(overlap, cap);
}

function axisTiles(span: number, view: number, overlap: number): { count: number; step: number; window: number } {
  if (!(span > 0)) return { count: 1, step: 0, window: view };
  if (span <= view + 1e-6) return { count: 1, step: span, window: span };
  const step = view - overlap;
  const count = Math.max(1, Math.ceil((span - overlap) / step - 1e-9));
  return { count, step, window: view };
}

export function tileStitchPlanner(args: {
  drawingWidthIn: number;
  drawingHeightIn: number;
  cellWidthIn: number;
  cellHeightIn: number;
}): { box: StitchPlannerPageBox; tiles: StitchPlannerTile[] } {
  const box = stitchPlannerPageBox();
  const overlapXIn = stitchPlannerOverlapInches(
    STITCH_PLANNER_MIN_OVERLAP_IN,
    args.cellWidthIn,
    box.viewWidthIn,
  );
  const overlapYIn = stitchPlannerOverlapInches(
    STITCH_PLANNER_MIN_OVERLAP_IN,
    args.cellHeightIn,
    box.viewHeightIn,
  );
  const horizontal = axisTiles(args.drawingWidthIn, box.viewWidthIn, overlapXIn);
  const vertical = axisTiles(args.drawingHeightIn, box.viewHeightIn, overlapYIn);
  const tiles: StitchPlannerTile[] = [];
  for (let row = 0; row < vertical.count; row += 1) {
    for (let col = 0; col < horizontal.count; col += 1) {
      tiles.push({
        index: tiles.length,
        col,
        row,
        cols: horizontal.count,
        rows: vertical.count,
        xIn: col * horizontal.step,
        yIn: row * vertical.step,
        viewWidthIn: horizontal.window,
        viewHeightIn: vertical.window,
        overlapXIn: horizontal.count > 1 ? overlapXIn : 0,
        overlapYIn: vertical.count > 1 ? overlapYIn : 0,
      });
    }
  }
  return { box, tiles };
}

export function tilePageLabel(tile: StitchPlannerTile, pageCount: number): string {
  return `Page ${tile.index + 1} of ${pageCount} · column ${tile.col + 1} of ${tile.cols}, row ${tile.row + 1} of ${tile.rows}`;
}
