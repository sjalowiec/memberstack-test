/**
 * Approximate stitch pickup along a vertical knitted edge (bands, front edges, etc.).
 * Default follows the common machine-knitting convention: pick up 2 stitches per 3 rows.
 */

export type PickupStitchesPerRowsRatio = {
  stitches: number;
  rows: number;
};

/** Common band/front-edge pickup rule of thumb (2 sts per 3 rows). */
export const MACHINE_KNITTING_PICKUP_2_PER_3_ROWS: PickupStitchesPerRowsRatio = {
  stitches: 2,
  rows: 3,
};

/**
 * Converts a row count along an edge to an approximate number of stitches to pick up.
 * Rounds to the nearest whole stitch; returns at least 1 when `rowCount` is positive.
 */
export function approximatePickupStitchesFromRows(
  rowCount: number,
  ratio: PickupStitchesPerRowsRatio = MACHINE_KNITTING_PICKUP_2_PER_3_ROWS,
): number {
  const rows = Math.max(0, Math.floor(Number(rowCount)));
  if (rows === 0) return 0;
  const stitches = Math.max(0, Math.floor(Number(ratio.stitches)));
  const perRows = Math.max(1, Math.floor(Number(ratio.rows)));
  return Math.max(1, Math.round((rows * stitches) / perRows));
}
