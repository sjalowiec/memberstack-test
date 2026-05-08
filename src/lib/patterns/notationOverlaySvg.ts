import type { NeckShoulderShapingChart, NeckShoulderShapingChartRow } from "./neckShoulderShapingChart";

type DiagramSide = "left" | "right";
type EdgeKind = "neck" | "shoulder";

type EdgePoint = {
  row: number;
  amount: number;
};

type NotationRun = {
  stitches: number;
  rows: number;
  times: number;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseDecreaseCell(cell: string): number {
  const text = String(cell ?? "").trim();
  if (!text || text === "-") return 0;
  const normalized = text.replace(/[^\d-]/g, "");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.abs(Math.trunc(n)));
}

function edgeDecreaseForRow(row: NeckShoulderShapingChartRow, side: DiagramSide, edge: EdgeKind): number {
  if (side === "right") {
    return edge === "neck" ? parseDecreaseCell(row.rightNeck) : parseDecreaseCell(row.rightSide);
  }
  return edge === "neck" ? parseDecreaseCell(row.leftNeck) : parseDecreaseCell(row.leftSide);
}

function collectEdgePoints(rows: readonly NeckShoulderShapingChartRow[], side: DiagramSide, edge: EdgeKind): EdgePoint[] {
  return [...rows]
    .sort((a, b) => a.row - b.row)
    .map((row) => ({
      row: row.row,
      amount: edgeDecreaseForRow(row, side, edge),
    }))
    .filter((item) => item.amount > 0);
}

function compressPointsToRuns(points: readonly EdgePoint[]): NotationRun[] {
  const out: NotationRun[] = [];
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
  return out;
}

function notationLinesForEdge(chart: NeckShoulderShapingChart, side: DiagramSide, edge: EdgeKind): string[] {
  const points = collectEdgePoints(chart.rows, side, edge);
  return compressPointsToRuns(points).map((r) => `${r.stitches}s-${r.rows}r-${r.times}x`);
}

function notationStackHtml(lines: readonly string[], stackKindClass: "shoulder" | "neck"): string {
  return `<div class="ns-notation-overlay__stack ns-notation-overlay__stack--${stackKindClass}" aria-hidden="true">${lines
    .map((line) => `<span class="ns-notation-overlay__label">${escapeHtml(line)}</span>`)
    .join("")}</div>`;
}

export function renderNotationOverlayDiagram(chart: NeckShoulderShapingChart, side: DiagramSide): string {
  const shoulderLines = notationLinesForEdge(chart, side, "shoulder");
  const neckLines = notationLinesForEdge(chart, side, "neck");
  const mirrored = side === "left";
  const imageClass = mirrored ? "ns-notation-overlay__image ns-notation-overlay__image--mirrored" : "ns-notation-overlay__image";
  const rootClass = mirrored ? "ns-notation-overlay ns-notation-overlay--mirrored" : "ns-notation-overlay";

  /**
   * Eager image load: the same overlay is rendered for back AND front in the sleeveless
   * print page. The back overlay sits near the top of the document (loads on first paint),
   * but the front overlay is pages further down. With `loading="lazy"` the front image
   * frequently stays unloaded when the print page is captured/scrolled, so only the
   * absolutely-positioned notation labels were visible. Eager loading is a tiny cost
   * (this SVG is well under 1 KB) and guarantees both pieces show the underlying outline.
   */
  return `<div class="${rootClass}">
  <div class="ns-notation-overlay__image-wrap">
    <img class="${imageClass}" src="/images/patterns/shoulder-front-icon.svg" alt="Neckline and shoulder shaping reference" loading="eager" decoding="async" />
  </div>
  ${shoulderLines.length ? notationStackHtml(shoulderLines, "shoulder") : ""}
  ${neckLines.length ? notationStackHtml(neckLines, "neck") : ""}
</div>`;
}
