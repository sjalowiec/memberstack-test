/**
 * Japanese-style diagram notation segments (`1s-2r-3x`) from ordered stitch-decrease points.
 * Shared by neckline overlay (round + V) and tests.
 */

export type StitchDecreasePoint = {
  row: number;
  amount: number;
};

/** Group consecutive decreases with the same stitch amount and the same row spacing. */
export function compressStitchDecreasePointsToNotationLines(
  points: readonly StitchDecreasePoint[],
): string[] {
  const out: { stitches: number; rows: number; times: number }[] = [];
  let i = 0;
  while (i < points.length) {
    const first = points[i]!;
    const stitches = first.amount;
    let j = i + 1;
    let gap: number | null = null;
    while (j < points.length) {
      const next = points[j]!;
      if (next.amount !== stitches) break;
      const candidateGap = next.row - points[j - 1]!.row;
      if (candidateGap <= 0) break;
      if (gap === null) gap = candidateGap;
      if (candidateGap !== gap) break;
      j += 1;
    }
    const times = j - i;
    let rows = 1;
    if (times > 1) {
      rows = Math.max(1, gap ?? 1);
    } else {
      const prevGap = i > 0 ? first.row - points[i - 1]!.row : 0;
      const nextGap = j < points.length ? points[j]!.row - first.row : 0;
      rows = Math.max(1, prevGap || nextGap || 1);
    }
    out.push({ stitches, rows, times });
    i = j;
  }
  return out.map((r) => `${r.stitches}s-${r.rows}r-${r.times}x`);
}
