import { DS_BODY_MAX_H, DS_BODY_MAX_W, DS_VB_W } from "../dropShoulderPatternDiagramSvgShared";

/**
 * How much of a full-width diagram panel the Drop Shoulder body uses.
 * Finished-pattern diagrams fit to this share when labels allow it.
 * Width share is silhouette width / viewBox width.
 * Panel-height share is silhouette height / viewBox width, because the SVG
 * is width 100% and height follows the viewBox aspect ratio.
 */
export const PATTERN_DIAGRAM_REFERENCE_WIDTH_SHARE = DS_BODY_MAX_W / DS_VB_W;
export const PATTERN_DIAGRAM_REFERENCE_PANEL_HEIGHT_SHARE = DS_BODY_MAX_H / DS_VB_W;

export type DiagramRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function unionDiagramRects(rects: DiagramRect[]): DiagramRect {
  const boxes = rects.filter((rect) => rect.width > 0 && rect.height > 0);
  const first = boxes[0];
  if (!first) return { x: 0, y: 0, width: 1, height: 1 };
  let minX = first.x;
  let minY = first.y;
  let maxX = first.x + first.width;
  let maxY = first.y + first.height;
  for (const rect of boxes.slice(1)) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * ViewBox around the silhouette and its outside labels.
 * Padding is only the margin that keeps strokes and text from clipping.
 * Empty artboard gutters are not added, so the garment keeps a readable
 * share of a width:100% panel without stretching the drawing.
 */
export function fitPatternDiagramViewBox(content: DiagramRect, margin = 12): DiagramRect {
  const pad = Math.max(0, margin);
  return {
    x: content.x - pad,
    y: content.y - pad,
    width: Math.max(1, content.width + pad * 2),
    height: Math.max(1, content.height + pad * 2),
  };
}

export function diagramSilhouetteWidthShare(silhouette: DiagramRect, viewBox: DiagramRect): number {
  return viewBox.width > 0 ? silhouette.width / viewBox.width : 0;
}

export function diagramSilhouettePanelHeightShare(silhouette: DiagramRect, viewBox: DiagramRect): number {
  return viewBox.width > 0 ? silhouette.height / viewBox.width : 0;
}

function attr(source: string, name: string): string {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(source)?.[1] ?? "";
}

/** Estimated ink bounds for labels and dimension lines already in visual coordinates. */
export function diagramMarkupBounds(markup: string): DiagramRect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const match of markup.matchAll(/<line\b([^>]*)\/?>/g)) {
    const attrs = match[1] ?? "";
    grow(Number(attr(attrs, "x1")), Number(attr(attrs, "y1")));
    grow(Number(attr(attrs, "x2")), Number(attr(attrs, "y2")));
  }
  for (const match of markup.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const attrs = match[1] ?? "";
    const inner = match[2] ?? "";
    const anchor = attr(attrs, "text-anchor") || "start";
    const baseSize = Number(attr(attrs, "font-size")) || 16;
    const baseX = Number(attr(attrs, "x"));
    let y = Number(attr(attrs, "y"));
    const tspans = [...inner.matchAll(/<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/g)];
    const lines = tspans.length
      ? tspans.map((span) => {
          const spanAttrs = span[1] ?? "";
          y += Number(attr(spanAttrs, "dy")) || 0;
          return {
            text: (span[2] ?? "").replace(/<[^>]+>/g, "").trim(),
            x: Number(attr(spanAttrs, "x")) || baseX,
            y,
            size: Number(attr(spanAttrs, "font-size")) || baseSize,
          };
        })
      : [{ text: inner.replace(/<[^>]+>/g, "").trim(), x: baseX, y, size: baseSize }];
    for (const line of lines) {
      const width = line.text.length * line.size * 0.55;
      const left = anchor === "end" ? line.x - width : anchor === "middle" ? line.x - width / 2 : line.x;
      grow(left, line.y - line.size * 0.85);
      grow(left + width, line.y + line.size * 0.25);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function withFittedPatternDiagramViewBox(svg: string, silhouette: DiagramRect, margin = 12): string {
  const ink = diagramMarkupBounds(svg);
  const content = unionDiagramRects(ink ? [silhouette, ink] : [silhouette]);
  const viewBox = fitPatternDiagramViewBox(content, margin);
  const value = `${trimNum(viewBox.x)} ${trimNum(viewBox.y)} ${trimNum(viewBox.width)} ${trimNum(viewBox.height)}`;
  return svg.replace(/viewBox="[^"]+"/, `viewBox="${value}"`);
}

function trimNum(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}
