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
 * ViewBox sized from the garment silhouette so it occupies the same share of a
 * full-width panel as a Drop Shoulder body. Outer labels do not enlarge it.
 * Vertical padding is room for labels; it does not change the on-screen
 * garment size, which is set by viewBox width.
 */
export function garmentFirstPatternDiagramViewBox(silhouette: DiagramRect, margin = 12): DiagramRect {
  const sw = Math.max(1, silhouette.width);
  const sh = Math.max(1, silhouette.height);
  const width = Math.max(
    sw / PATTERN_DIAGRAM_REFERENCE_WIDTH_SHARE,
    sh / PATTERN_DIAGRAM_REFERENCE_PANEL_HEIGHT_SHARE,
  );
  const padX = (width - sw) / 2;
  const pad = Math.max(0, margin);
  const topPad = Math.max(pad, (DS_BODY_MAX_H > 0 ? (70 / DS_BODY_MAX_H) * sh : pad));
  const bottomPad = Math.max(pad, (DS_BODY_MAX_H > 0 ? (72 / DS_BODY_MAX_H) * sh : pad));
  return {
    x: silhouette.x - padX,
    y: silhouette.y - topPad,
    width,
    height: sh + topPad + bottomPad,
  };
}

/** @deprecated Labels must not define the viewBox. Use {@link garmentFirstPatternDiagramViewBox}. */
export function fitPatternDiagramViewBox(content: DiagramRect, margin = 12): DiagramRect {
  return garmentFirstPatternDiagramViewBox(content, margin);
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

/** Move later labels down until counted text no longer shares a box. Width stays put. */
export function separateOverlappingDiagramLabels(svg: string, gap = 6): string {
  type Box = { start: number; end: number; y: number; left: number; right: number; top: number; bottom: number };
  const boxes: Box[] = [];
  const re = /<text\b([^>]*?)\sy="([^"]+)"([^>]*)>([\s\S]*?)<\/text>/g;
  for (const match of svg.matchAll(re)) {
    const attrs = `${match[1] ?? ""} y="${match[2]}" ${match[3] ?? ""}`;
    if (/\btransform=/.test(attrs) || /\bdata-role="jp-/.test(attrs) || /\bdata-stack-order=/.test(attrs) || /\bdata-notation=/.test(attrs)) continue;
    const anchor = attr(attrs, "text-anchor") || "start";
    const baseSize = Number(attr(attrs, "font-size")) || 16;
    const baseX = Number(attr(attrs, "x"));
    let y = Number(match[2]);
    const inner = match[4] ?? "";
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
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const line of lines) {
      const width = Math.max(8, line.text.length * line.size * 0.55);
      const lineLeft = anchor === "end" ? line.x - width : anchor === "middle" ? line.x - width / 2 : line.x;
      left = Math.min(left, lineLeft);
      right = Math.max(right, lineLeft + width);
      top = Math.min(top, line.y - line.size * 0.85);
      bottom = Math.max(bottom, line.y + line.size * 0.25);
    }
    if (!Number.isFinite(left)) continue;
    boxes.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      y: Number(match[2]),
      left,
      right,
      top,
      bottom,
    });
  }
  const shifts = new Map<number, number>();
  for (let pass = 0; pass < 8; pass += 1) {
    let moved = false;
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlapX = a.left < b.right - 2 && a.right > b.left + 2;
        const overlapY = a.top < b.bottom - 2 && a.bottom > b.top + 2;
        if (!overlapX || !overlapY) continue;
        const lower = a.top <= b.top ? b : a;
        const upper = lower === a ? b : a;
        const delta = upper.bottom - lower.top + gap;
        lower.y += delta;
        lower.top += delta;
        lower.bottom += delta;
        shifts.set(lower.start, (shifts.get(lower.start) ?? 0) + delta);
        moved = true;
      }
    }
    if (!moved) break;
  }
  if (shifts.size === 0) return svg;
  let out = "";
  let cursor = 0;
  const ordered = [...boxes].sort((a, b) => a.start - b.start);
  for (const box of ordered) {
    const shift = shifts.get(box.start) ?? 0;
    out += svg.slice(cursor, box.start);
    const chunk = svg.slice(box.start, box.end);
    out += shift
      ? chunk.replace(/y="([^"]+)"/, (_all, y: string) => `y="${trimNum(Number(y) + shift)}"`)
      : chunk;
    cursor = box.end;
  }
  out += svg.slice(cursor);
  return out;
}

export function withFittedPatternDiagramViewBox(svg: string, silhouette: DiagramRect, margin = 12): string {
  const separated = separateOverlappingDiagramLabels(svg);
  const viewBox = garmentFirstPatternDiagramViewBox(silhouette, margin);
  const ink = diagramMarkupBounds(separated);
  const pad = Math.max(0, margin);
  if (ink) {
    const top = Math.min(viewBox.y, ink.y - pad);
    const bottom = Math.max(viewBox.y + viewBox.height, ink.y + ink.height + pad);
    viewBox.y = top;
    viewBox.height = bottom - top;
  }
  const value = `${trimNum(viewBox.x)} ${trimNum(viewBox.y)} ${trimNum(viewBox.width)} ${trimNum(viewBox.height)}`;
  return separated.replace(/viewBox="[^"]+"/, `viewBox="${value}"`);
}

function trimNum(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}
