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

/**
 * Row-based shaping notation. Every field is required.
 * A zero span is stored as `0`; it is not drawn as `0r`.
 * Sections that are not row intervals must use {@link NotRowBasedShapingNotation}.
 */
export type ShapingNotationSegment = {
  stitches: number;
  intervalRows: number;
  times: number;
};

export type RowBasedShapingNotation = {
  kind: "row-based";
  rowsBefore: number;
  segments: readonly ShapingNotationSegment[];
  rowsAfter: number;
  totalRows: number;
};

export type NotRowBasedShapingNotation = {
  kind: "not-row-based";
  /** Why this mark has no row interval. */
  reason: string;
  label: string;
};

export type ShapingNotationModel = RowBasedShapingNotation | NotRowBasedShapingNotation;

export function rowBasedShapingNotation(input: {
  rowsBefore: number;
  segments: readonly ShapingNotationSegment[];
  rowsAfter: number;
  totalRows: number;
}): RowBasedShapingNotation {
  const rowsBefore = Math.round(input.rowsBefore);
  const rowsAfter = Math.round(input.rowsAfter);
  const totalRows = Math.round(input.totalRows);
  if (![rowsBefore, rowsAfter, totalRows].every((n) => Number.isFinite(n) && n >= 0)) {
    throw new Error("Row-based shaping notation requires non-negative rows before, after, and total.");
  }
  if (input.segments.some((segment) => !(segment.intervalRows > 0) || !(segment.times > 0))) {
    throw new Error("Row-based shaping notation requires an interval and a repeat count for each operation.");
  }
  return {
    kind: "row-based",
    rowsBefore,
    segments: input.segments,
    rowsAfter,
    totalRows,
  };
}

/** Compact knitting-order text. Zero spans stay in the model and are omitted from the drawing. */
export function formatRowBasedShapingNotation(section: RowBasedShapingNotation): string {
  const parts: string[] = [];
  if (section.rowsBefore > 0) parts.push(`${section.rowsBefore}r`);
  for (const segment of section.segments) {
    parts.push(formatShapingSegment(segment.stitches, segment.intervalRows, segment.times));
  }
  if (section.rowsAfter > 0) parts.push(`${section.rowsAfter}r`);
  return parts.join(" ");
}
