/**
 * Measurement styling for tool shape diagrams.
 * Values match the square diagram in src/components/tools/diagram-rectangle.svg, scaled to the
 * width of the shape being drawn. Keep the two in step.
 */

import { escapeXml, fmtNum } from "../patterns/dropShoulderPatternDiagramSvgShared";

export const TOOL_DIAGRAM_TEXT = "#2f3a2f";
export const TOOL_DIAGRAM_LINE = "#738c52";
export const TOOL_DIAGRAM_FONT = "Arial, Helvetica, sans-serif";

/** Square outline width in diagram-rectangle.svg; every size below is relative to it. */
const SQUARE_SHAPE_WIDTH = 641.55;

export type ToolDiagramScale = {
  font: number;
  noteFont: number;
  lineHeight: number;
  line: number;
  cap: number;
  outline: number;
};

export function toolDiagramScale(shapeWidth: number): ToolDiagramScale {
  const k = shapeWidth / SQUARE_SHAPE_WIDTH;
  return {
    font: 55 * k,
    noteFont: 40 * k,
    lineHeight: 68 * k,
    line: 6 * k,
    cap: 16.8 * k,
    outline: 7.74 * k,
  };
}

type Point = [number, number];

/** Measurement line with the square diagram's filled caps, tips pointing inward. */
export function toolMeasureLine(from: Point, to: Point, scale: ToolDiagramScale): string {
  const span = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  const along: Point = [(to[0] - from[0]) / span, (to[1] - from[1]) / span];
  const side: Point = [-along[1], along[0]];
  const cap = (base: Point, inward: Point) => {
    const tip: Point = [base[0] + inward[0] * scale.cap, base[1] + inward[1] * scale.cap];
    const left: Point = [base[0] + side[0] * scale.cap, base[1] + side[1] * scale.cap];
    const right: Point = [base[0] - side[0] * scale.cap, base[1] - side[1] * scale.cap];
    return `<polygon data-measure-cap="1" points="${[left, right, tip].map((p) => `${fmtNum(p[0])},${fmtNum(p[1])}`).join(" ")}" fill="${TOOL_DIAGRAM_LINE}"/>`;
  };
  return [
    `<line x1="${fmtNum(from[0])}" y1="${fmtNum(from[1])}" x2="${fmtNum(to[0])}" y2="${fmtNum(to[1])}" stroke="${TOOL_DIAGRAM_LINE}" stroke-width="${fmtNum(scale.line)}" fill="none"/>`,
    cap(from, along),
    cap(to, [-along[0], -along[1]]),
  ].join("");
}

/** Faint extension from the shape to a measurement line. */
export function toolExtensionLine(from: Point, to: Point, scale: ToolDiagramScale): string {
  return `<line x1="${fmtNum(from[0])}" y1="${fmtNum(from[1])}" x2="${fmtNum(to[0])}" y2="${fmtNum(to[1])}" stroke="${TOOL_DIAGRAM_LINE}" stroke-width="${fmtNum(scale.line * 0.5)}" opacity="0.6" fill="none"/>`;
}

/**
 * One label line. `caption` and `measure` are bold, like "Cast On" and "20 in".
 * `count` is a bold number followed by a regular word, like "80 Stitches"; `note` follows in smaller type.
 */
export type ToolLabelLine =
  | { kind: "caption"; text: string }
  | { kind: "measure"; text: string }
  | { kind: "count"; count: string | number; word: string; note?: string };

export function toolLabelBlock(
  lines: ToolLabelLine[],
  x: number,
  firstBaseline: number,
  anchor: "start" | "middle" | "end",
  scale: ToolDiagramScale,
): string {
  return lines
    .map((line, index) => {
      const y = firstBaseline + index * scale.lineHeight;
      const open = `<text x="${fmtNum(x)}" y="${fmtNum(y)}" text-anchor="${anchor}" fill="${TOOL_DIAGRAM_TEXT}" font-family="${TOOL_DIAGRAM_FONT}" font-size="${fmtNum(scale.font)}"`;
      if (line.kind === "count") {
        const note = line.note
          ? `<tspan font-size="${fmtNum(scale.noteFont)}"> ${escapeXml(line.note)}</tspan>`
          : "";
        return `${open}><tspan font-weight="700">${escapeXml(String(line.count))}</tspan> ${escapeXml(line.word)}${note}</text>`;
      }
      return `${open} font-weight="700">${escapeXml(line.text)}</text>`;
    })
    .join("");
}

/** Baseline of the first line so a block of `count` lines is centered on `middle`. */
export function toolLabelBlockTop(middle: number, count: number, scale: ToolDiagramScale): number {
  return middle - ((count - 1) * scale.lineHeight) / 2 + scale.font * 0.35;
}
