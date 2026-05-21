import type { NeckShoulderShapingChart, NeckShoulderShapingChartRow } from "./neckShoulderShapingChart";
import type { RowEntry } from "./shapingTimeline";
import {
  compressStitchDecreasePointsToNotationLines,
  type StitchDecreasePoint,
} from "./shapingNotationCompress";

type DiagramSide = "left" | "right";
type EdgeKind = "neck" | "shoulder";

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

function collectEdgePoints(rows: readonly NeckShoulderShapingChartRow[], side: DiagramSide, edge: EdgeKind): StitchDecreasePoint[] {
  return [...rows]
    .sort((a, b) => a.row - b.row)
    .map((row) => ({
      row: row.row,
      amount: edgeDecreaseForRow(row, side, edge),
    }))
    .filter((item) => item.amount > 0);
}

function sortTimelineByRow(timeline: readonly RowEntry[]): RowEntry[] {
  return [...timeline].sort((a, b) => a.row - b.row);
}

/** Inner-neck machine decreases only (excludes bind-off / other inner events) for V-neck diagram copy. */
function innerNeckDecreaseAmountForSide(entry: RowEntry, side: DiagramSide): number {
  const lr: "left" | "right" = side === "left" ? "left" : "right";
  let n = 0;
  for (const e of entry.events) {
    if (e.side !== lr || e.edge !== "inner") continue;
    if (e.kind !== "decrease" || e.amount <= 0) continue;
    n += e.amount;
  }
  return n;
}

export function collectInnerNeckDecreasePointsFromTimeline(
  timeline: readonly RowEntry[],
  side: DiagramSide,
): StitchDecreasePoint[] {
  return sortTimelineByRow(timeline)
    .map((entry) => ({
      row: entry.row,
      amount: innerNeckDecreaseAmountForSide(entry, side),
    }))
    .filter((p) => p.amount > 0);
}

/** V-neck (and tests): inner-edge decrease plan from live timeline rows. */
export function innerNeckDecreaseNotationLinesFromTimeline(
  timeline: readonly RowEntry[],
  side: DiagramSide,
): string[] {
  return compressStitchDecreasePointsToNotationLines(collectInnerNeckDecreasePointsFromTimeline(timeline, side));
}

/** Same neck-edge grouped lines as {@link renderNotationOverlayDiagram} (round-neck: chart cells). */
export function neckEdgeNotationLinesFromNeckShoulderChart(
  chart: NeckShoulderShapingChart,
  side: DiagramSide,
  overlayOpts?: NotationOverlayDiagramOptions,
): string[] {
  return notationLinesForEdge(chart, side, "neck", overlayOpts);
}

/** Same shoulder-edge grouped lines as {@link renderNotationOverlayDiagram} (chart cells). */
export function shoulderEdgeNotationLinesFromNeckShoulderChart(
  chart: NeckShoulderShapingChart,
  side: DiagramSide,
  overlayOpts?: NotationOverlayDiagramOptions,
): string[] {
  return notationLinesForEdge(chart, side, "shoulder", overlayOpts);
}

function notationLinesForEdge(
  chart: NeckShoulderShapingChart,
  side: DiagramSide,
  edge: EdgeKind,
  overlayOpts?: NotationOverlayDiagramOptions,
): string[] {
  if (
    edge === "neck" &&
    overlayOpts?.innerNeckNotationFromTimeline === true &&
    chart.timeline &&
    chart.timeline.length > 0
  ) {
    const pts = collectInnerNeckDecreasePointsFromTimeline(chart.timeline, side);
    return compressStitchDecreasePointsToNotationLines(pts);
  }
  const points = collectEdgePoints(chart.rows, side, edge);
  return compressStitchDecreasePointsToNotationLines(points);
}

function notationStackHtml(lines: readonly string[], stackKindClass: "shoulder" | "neck"): string {
  return `<div class="ns-notation-overlay__stack ns-notation-overlay__stack--${stackKindClass}" aria-hidden="true">${lines
    .map((line) => `<span class="ns-notation-overlay__label">${escapeHtml(line)}</span>`)
    .join("")}</div>`;
}

export type NotationOverlayDiagramOptions = {
  /** Underlay silhouette (round vs V front); defaults to round shoulder reference icon. */
  outlineImageSrc?: string;
  /**
   * When true with a populated `chart.timeline`, inner-neck notation is derived from timeline
   * inner-edge **decrease** events only (V-neck front). Round-neck charts keep the default chart-cell path.
   */
  innerNeckNotationFromTimeline?: boolean;
};

const DEFAULT_NOTATION_OUTLINE_SRC = "/images/patterns/shoulder-round-icon.svg";

const MACHINE_ORIENTATION_CAPTION = "As viewed on the machine";

export function renderNotationOverlayDiagram(
  chart: NeckShoulderShapingChart,
  side: DiagramSide,
  options?: NotationOverlayDiagramOptions,
): string {
  const shoulderLines = notationLinesForEdge(chart, side, "shoulder", options);
  const neckLines = notationLinesForEdge(chart, side, "neck", options);
  const mirrored = side === "left";
  const imageClass = mirrored ? "ns-notation-overlay__image ns-notation-overlay__image--mirrored" : "ns-notation-overlay__image";
  const rootClass = mirrored ? "ns-notation-overlay ns-notation-overlay--mirrored" : "ns-notation-overlay";
  const outlineSrc = options?.outlineImageSrc ?? DEFAULT_NOTATION_OUTLINE_SRC;

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
    <img class="${imageClass}" src="${escapeHtml(outlineSrc)}" alt="Neckline and shoulder shaping reference" loading="eager" decoding="async" />
  </div>
  ${shoulderLines.length ? notationStackHtml(shoulderLines, "shoulder") : ""}
  ${neckLines.length ? notationStackHtml(neckLines, "neck") : ""}
  <p class="ns-notation-overlay__machine-orientation">${escapeHtml(MACHINE_ORIENTATION_CAPTION)}</p>
</div>`;
}
