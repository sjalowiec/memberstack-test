/**
 * Japanese-style diagram notation segments (`1s-2r-3x`) from ordered stitch-decrease points.
 * Shared by neckline overlay (round + V), slope tool, and tests.
 *
 * Token order is always stitches → rows (interval) → times: `Ns-Mr-Kx`.
 */

export type StitchDecreasePoint = {
  row: number;
  amount: number;
};

/** Shaping segment token, e.g. `3s-2r-1x` (not `bo12`, `hold18`, etc.). */
const SHAPING_SEGMENT_PATTERN = /^(\d+)s-(\d+)r-(\d+)x$/;

/**
 * Format one Japanese shaping segment.
 * Order: stitches (`s`), rows between actions (`r`), times (`x`).
 */
export function formatShapingSegment(stitches: number, rows: number, times: number): string {
  const s = Math.max(1, Math.round(stitches));
  const r = Math.max(1, Math.round(rows));
  const t = Math.max(1, Math.round(times));
  return `${s}s-${r}r-${t}x`;
}

/**
 * Merge consecutive identical shaping segments by summing repeat counts.
 * Non-shaping lines (`bo…`, `hold…`, etc.) pass through unchanged and break runs.
 */
export function consolidateConsecutiveJapaneseNotationLines(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const match = line.match(SHAPING_SEGMENT_PATTERN);
    if (!match) {
      out.push(line);
      continue;
    }
    const [, stitches, rows, times] = match;
    const prev = out[out.length - 1];
    const prevMatch = prev?.match(SHAPING_SEGMENT_PATTERN);
    if (prevMatch && prevMatch[1] === stitches && prevMatch[2] === rows) {
      const mergedTimes = Number(prevMatch[3]) + Number(times);
      out[out.length - 1] = `${stitches}s-${rows}r-${mergedTimes}x`;
    } else {
      out.push(line);
    }
  }
  return out;
}

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
  return consolidateConsecutiveJapaneseNotationLines(
    out.map((r) => `${r.stitches}s-${r.rows}r-${r.times}x`),
  );
}
