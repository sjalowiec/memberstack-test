/**
 * Finished-shape diagram for the Circle Calculator.
 * Measurement lines, caps, and labels use the tool square diagram's style.
 * The caller supplies the calculated labels. This file does not size the circle.
 */

import { DS_FILL, DS_STROKE, escapeXml, fmtNum } from "../patterns/dropShoulderPatternDiagramSvgShared";
import type { CircleDiagramContent } from "./circleCalculator";
import {
  TOOL_DIAGRAM_FONT,
  TOOL_DIAGRAM_TEXT,
  toolDiagramScale,
  toolExtensionLine,
  toolLabelBlock,
  toolLabelBlockTop,
  toolMeasureLine,
  type ToolLabelLine,
} from "./toolDiagramStyle";

const RADIUS = 100;
/** Wide layout: room for the widest side labels, such as "Approx 100 cm" and "Center to corner". */
const WIDE_LEFT_GUTTER = 185;
const WIDE_RIGHT_GUTTER = 170;
/** Narrow layout: room for the side measurement lines only. Their labels go below the shape. */
const NARROW_GUTTER = 40;
const TOP_EDGE_Y = 108;
const BOTTOM_MARGIN = 18;
/** Gap between the shape and a measurement line beside it. */
const MEASURE_OFFSET = 16;
const LABEL_GAP = 8;

type Point = [number, number];

function polygon(points: Point[], fill: string, stroke = "", width = 0): string {
  const coords = points.map((point) => `${fmtNum(point[0])},${fmtNum(point[1])}`).join(" ");
  const strokeAttr = stroke
    ? ` stroke="${stroke}" stroke-width="${fmtNum(width)}" stroke-linejoin="miter"`
    : "";
  return `<polygon points="${coords}" fill="${fill}"${strokeAttr}/>`;
}

function add(a: Point, b: Point): Point {
  return [a[0] + b[0], a[1] + b[1]];
}

function scale(a: Point, factor: number): Point {
  return [a[0] * factor, a[1] * factor];
}

function length(a: Point): number {
  return Math.hypot(a[0], a[1]);
}

function unit(a: Point): Point {
  const span = length(a) || 1;
  return [a[0] / span, a[1] / span];
}

function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

const SWIRL_TURN = 1.05;
const SWIRL_CONTROL = 0.82;
const SWIRL_END_TURN = 0.55;
const SWIRL_END = 0.06;

function swirl(vertex: Point, center: Point): { control: Point; end: Point } {
  const angle = Math.atan2(vertex[1] - center[1], vertex[0] - center[0]);
  const radius = Math.hypot(vertex[0] - center[0], vertex[1] - center[1]);
  const at = (turn: number, factor: number): Point => [
    center[0] + radius * factor * Math.cos(angle + turn),
    center[1] + radius * factor * Math.sin(angle + turn),
  ];
  return { control: at(SWIRL_TURN, SWIRL_CONTROL), end: at(SWIRL_END_TURN, SWIRL_END) };
}

function curveCommand(from: Point, control: Point, to: Point): string {
  return `M ${fmtNum(from[0])} ${fmtNum(from[1])} Q ${fmtNum(control[0])} ${fmtNum(control[1])} ${fmtNum(to[0])} ${fmtNum(to[1])}`;
}

function directionArrow(tail: Point, tip: Point): string {
  const direction = unit([tip[0] - tail[0], tip[1] - tail[1]]);
  const side: Point = [-direction[1], direction[0]];
  const head = 9;
  const wing = 4.5;
  const base = add(tip, scale(direction, -head));
  const left = add(base, scale(side, wing));
  const right = add(base, scale(side, -wing));
  return [
    `<line data-knitting-arrow="1" x1="${fmtNum(tail[0])}" y1="${fmtNum(tail[1])}" x2="${fmtNum(base[0])}" y2="${fmtNum(base[1])}" stroke="${DS_STROKE}" stroke-width="1.6" fill="none"/>`,
    `<polygon points="${fmtNum(tip[0])},${fmtNum(tip[1])} ${fmtNum(left[0])},${fmtNum(left[1])} ${fmtNum(right[0])},${fmtNum(right[1])}" fill="${DS_STROKE}"/>`,
  ].join("");
}

/** Rough label width for choosing a narrow layout. Overestimates Arial so labels never collide. */
function estimatedWidth(lines: ToolLabelLine[], font: number, noteFont: number): number {
  return Math.max(
    0,
    ...lines.map((line) =>
      line.kind === "count"
        ? (String(line.count).length + 1 + line.word.length) * font * 0.6 +
          (line.note ? (line.note.length + 1) * noteFont * 0.55 : 0)
        : line.text.length * font * 0.62,
    ),
  );
}

/**
 * `wide` puts the height and diameter labels beside the shape (desktop and print).
 * `narrow` keeps the shape large on a phone and moves those labels below it.
 */
export function circleWedgeDiagramSvg(content: CircleDiagramContent, layout: "wide" | "narrow" = "wide"): string {
  const narrow = layout === "narrow";
  const wedges = content.wedges;
  const style = toolDiagramScale(RADIUS * 2);
  const apothem = RADIUS * Math.cos(Math.PI / wedges);
  const leftGutter = narrow ? NARROW_GUTTER : WIDE_LEFT_GUTTER;
  const rightGutter = narrow ? NARROW_GUTTER : WIDE_RIGHT_GUTTER;
  const center: Point = [leftGutter + RADIUS, TOP_EDGE_Y + apothem];
  const viewWidth = leftGutter + RADIUS * 2 + rightGutter;
  const shapeBottom = center[1] + apothem;
  const vertex = (index: number): Point => {
    const angle = -Math.PI / 2 + Math.PI / wedges + (index * 2 * Math.PI) / wedges;
    return [center[0] + RADIUS * Math.cos(angle), center[1] + RADIUS * Math.sin(angle)];
  };
  const points = Array.from({ length: wedges }, (_, index) => vertex(index));
  const minX = Math.min(...points.map((point) => point[0]));
  const maxX = Math.max(...points.map((point) => point[0]));
  const shadedStart = points[wedges - 1];
  const shadedEnd = points[0];
  const outerMid = midpoint(shadedStart, shadedEnd);
  const edge: Point = [shadedEnd[0] - shadedStart[0], shadedEnd[1] - shadedStart[1]];

  const shadedStartArm = swirl(shadedStart, center);
  const shadedEndArm = swirl(shadedEnd, center);
  const shape = content.shortRow
    ? [
        `<path data-shaded-section="1" d="M ${fmtNum(shadedStart[0])} ${fmtNum(shadedStart[1])} Q ${fmtNum(shadedStartArm.control[0])} ${fmtNum(shadedStartArm.control[1])} ${fmtNum(shadedStartArm.end[0])} ${fmtNum(shadedStartArm.end[1])} L ${fmtNum(shadedEndArm.end[0])} ${fmtNum(shadedEndArm.end[1])} Q ${fmtNum(shadedEndArm.control[0])} ${fmtNum(shadedEndArm.control[1])} ${fmtNum(shadedEnd[0])} ${fmtNum(shadedEnd[1])} Z" fill="${DS_FILL}" stroke="none"/>`,
        `<g data-pinwheel="1" data-sections="${wedges}">${points
          .map((point) => {
            const arm = swirl(point, center);
            return `<path d="${curveCommand(point, arm.control, arm.end)}" stroke="${DS_STROKE}" stroke-width="1.5" fill="none"/>`;
          })
          .join("")}</g>`,
      ].join("")
    : [
        points
          .map((point, index) => polygon([center, point, points[(index + 1) % wedges]], index === wedges - 1 ? DS_FILL : "#ffffff"))
          .join(""),
        points
          .map(
            (point) =>
              `<line data-spoke="1" x1="${fmtNum(center[0])}" y1="${fmtNum(center[1])}" x2="${fmtNum(point[0])}" y2="${fmtNum(point[1])}" stroke="${DS_STROKE}" stroke-width="1" fill="none"/>`,
          )
          .join(""),
      ].join("");

  // Width of the top edge: line just above it, labels stacked directly above the line.
  const topLineY = TOP_EDGE_Y - 10;
  const topLabels: ToolLabelLine[] = content.wedge
    ? [
        { kind: "caption", text: "Outer edge" },
        { kind: "count", count: content.wedge.outerStitches, word: "Stitches", note: content.wedge.seamingNote },
        { kind: "measure", text: content.wedge.outerEdgeLabel },
      ]
    : content.shortRow
      ? [
          { kind: "caption", text: "Rows per section" },
          { kind: "count", count: content.shortRow.rows, word: "Rows" },
          { kind: "measure", text: content.shortRow.rowMeasure },
        ]
      : [];
  const topLabelBaseline = topLineY - style.cap - 5 - (topLabels.length - 1) * style.lineHeight;
  const topGroup = `<g ${content.wedge ? 'data-outer-edge="1"' : 'data-section-rows="1"'} data-edge-dx="${fmtNum(edge[0])}" data-edge-dy="${fmtNum(edge[1])}" data-line-y="${fmtNum(topLineY)}" data-label-bottom="${fmtNum(topLabelBaseline + (topLabels.length - 1) * style.lineHeight)}">${toolMeasureLine(
    [shadedStart[0], topLineY],
    [shadedEnd[0], topLineY],
    style,
  )}${toolLabelBlock(topLabels, center[0], topLabelBaseline, "middle", style)}</g>`;

  // Height: outside the left side, from the top edge to the inner edge (wedges) or center (short rows).
  const innerMid = content.wedge
    ? add(center, scale([outerMid[0] - center[0], outerMid[1] - center[1]], content.wedge.innerEdgeRatio))
    : center;
  const heightX = minX - MEASURE_OFFSET;
  const heightMiddle = (TOP_EDGE_Y + innerMid[1]) / 2;
  const sideLabels: ToolLabelLine[] = content.wedge
    ? [
        { kind: "caption", text: "Wedge height" },
        { kind: "count", count: content.wedge.rows, word: "Rows" },
        { kind: "measure", text: content.wedge.heightLabel },
      ]
    : content.shortRow
      ? [
          { kind: "caption", text: "Center to corner" },
          { kind: "count", count: content.shortRow.stitches, word: "Stitches" },
          { kind: "measure", text: content.shortRow.stitchMeasure },
        ]
      : [];
  // Short rows: the cast-on runs from the center to the leftmost corner (the upper one if two tie).
  const corner = points.reduce((best, point) =>
    point[0] < best[0] - 1e-6 || (Math.abs(point[0] - best[0]) <= 1e-6 && point[1] < best[1]) ? point : best,
  );
  const diameterLabels: ToolLabelLine[] = [
    { kind: "caption", text: content.overallCaption },
    { kind: "measure", text: content.diameterLabel },
  ];
  const dimensionX = maxX + MEASURE_OFFSET;
  const labelInset = 8;
  const belowBaseline = shapeBottom + style.cap + 6 + style.font;
  const sideBySide =
    estimatedWidth(sideLabels, style.font, style.noteFont) +
      estimatedWidth(diameterLabels, style.font, style.noteFont) +
      2 * labelInset +
      style.font <=
    viewWidth;
  const sidePlacement = narrow
    ? { x: labelInset, y: belowBaseline, anchor: "start" as const }
    : content.shortRow
      ? {
          x: corner[0] - LABEL_GAP - style.cap,
          y: toolLabelBlockTop(corner[1], sideLabels.length, style),
          anchor: "end" as const,
        }
      : {
          x: heightX - LABEL_GAP - style.cap,
          y: toolLabelBlockTop(heightMiddle, sideLabels.length, style),
          anchor: "end" as const,
        };
  const diameterPlacement = narrow
    ? {
        x: viewWidth - labelInset,
        y: sideBySide ? belowBaseline : belowBaseline + sideLabels.length * style.lineHeight + style.font * 0.6,
        anchor: "end" as const,
      }
    : {
        x: dimensionX + LABEL_GAP + style.cap,
        y: toolLabelBlockTop(center[1], diameterLabels.length, style),
        anchor: "start" as const,
      };
  const lastBaseline = narrow
    ? Math.max(
        sidePlacement.y + (sideLabels.length - 1) * style.lineHeight,
        diameterPlacement.y + (diameterLabels.length - 1) * style.lineHeight,
      )
    : shapeBottom;
  const viewHeight = lastBaseline + BOTTOM_MARGIN;
  const heightAttrs = `data-dx="0" data-dy="${fmtNum(innerMid[1] - TOP_EDGE_Y)}" data-line-x="${fmtNum(heightX)}" data-outer-x="${fmtNum(outerMid[0])}" data-outer-y="${fmtNum(outerMid[1])}" data-inner-x="${fmtNum(innerMid[0])}" data-inner-y="${fmtNum(innerMid[1])}" data-center-x="${fmtNum(center[0])}" data-center-y="${fmtNum(center[1])}"`;
  const innerEdge = content.wedge
    ? `<line x1="${fmtNum(innerMid[0] - (edge[0] * content.wedge.innerEdgeRatio) / 2)}" y1="${fmtNum(innerMid[1])}" x2="${fmtNum(innerMid[0] + (edge[0] * content.wedge.innerEdgeRatio) / 2)}" y2="${fmtNum(innerMid[1])}" stroke="${DS_STROKE}" stroke-width="1.5" fill="none"/>`
    : "";
  const heightGroup = content.wedge
    ? `<g data-wedge-height="1" ${heightAttrs}>${innerEdge}${toolExtensionLine(
        [shadedStart[0], TOP_EDGE_Y],
        [heightX - style.cap, TOP_EDGE_Y],
        style,
      )}${toolExtensionLine([minX, innerMid[1]], [heightX - style.cap, innerMid[1]], style)}${toolMeasureLine(
        [heightX, TOP_EDGE_Y],
        [heightX, innerMid[1]],
        style,
      )}${toolLabelBlock(sideLabels, sidePlacement.x, sidePlacement.y, sidePlacement.anchor, style)}</g>`
    : `<g data-center-to-corner="1" data-from-x="${fmtNum(center[0])}" data-from-y="${fmtNum(center[1])}" data-to-x="${fmtNum(corner[0])}" data-to-y="${fmtNum(corner[1])}">${toolMeasureLine(
        center,
        corner,
        style,
      )}${toolLabelBlock(sideLabels, sidePlacement.x, sidePlacement.y, sidePlacement.anchor, style)}</g>`;

  const arrow = content.wedge ? directionMarkup(content.wedge.direction, center, outerMid) : "";

  // Diameter: outside the right side, between the top and bottom flat edges.
  const oppositeIndex = (wedges - 1 + wedges / 2) % wedges;
  const bottomRight = points[(oppositeIndex + 1) % wedges];
  const bottomLeft = points[oppositeIndex];
  const top = outerMid;
  const bottom = midpoint(bottomLeft, bottomRight);
  const diameterGroup = [
    `<g data-diameter="opposite-flat-edges" data-across-x1="${fmtNum(dimensionX)}" data-across-y1="${fmtNum(top[1])}" data-across-x2="${fmtNum(dimensionX)}" data-across-y2="${fmtNum(bottom[1])}" data-top-edge-y1="${fmtNum(shadedStart[1])}" data-top-edge-y2="${fmtNum(shadedEnd[1])}">`,
    toolExtensionLine(shadedEnd, [dimensionX + style.cap, top[1]], style),
    toolExtensionLine(bottomRight, [dimensionX + style.cap, bottom[1]], style),
    toolMeasureLine([dimensionX, top[1]], [dimensionX, bottom[1]], style),
    toolLabelBlock(diameterLabels, diameterPlacement.x, diameterPlacement.y, diameterPlacement.anchor, style),
    `</g>`,
  ].join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmtNum(viewWidth)} ${fmtNum(viewHeight)}" width="100%" role="img" data-layout="${layout}" aria-label="${escapeXml(ariaLabel(content))}">`,
    `<text x="16" y="${fmtNum(style.font + 4)}" text-anchor="start" fill="${TOOL_DIAGRAM_TEXT}" font-family="${TOOL_DIAGRAM_FONT}" font-size="${fmtNum(style.font)}" font-weight="700">${escapeXml(content.title)}</text>`,
    shape,
    polygon(points, "none", TOOL_DIAGRAM_TEXT, style.outline),
    arrow,
    topGroup,
    heightGroup,
    diameterGroup,
    `</svg>`,
  ].join("");
}

function directionMarkup(direction: "increase" | "decrease", center: Point, outerMid: Point): string {
  const towardOuter = unit([outerMid[0] - center[0], outerMid[1] - center[1]]);
  const span = length([outerMid[0] - center[0], outerMid[1] - center[1]]);
  const inner = add(center, scale(towardOuter, span * 0.38));
  const outer = add(center, scale(towardOuter, span * 0.72));
  const tail = direction === "increase" ? inner : outer;
  const tip = direction === "increase" ? outer : inner;
  return [
    `<g data-knitting-direction="${direction}" data-arrow-toward="${direction === "increase" ? "outer" : "center"}" data-tail-x="${fmtNum(tail[0])}" data-tail-y="${fmtNum(tail[1])}" data-tip-x="${fmtNum(tip[0])}" data-tip-y="${fmtNum(tip[1])}">`,
    directionArrow(tail, tip),
    `</g>`,
  ].join("");
}

function ariaLabel(content: CircleDiagramContent): string {
  const overall = `${content.title}. ${content.overallCaption} ${content.diameterLabel}.`;
  if (content.shortRow) {
    return `${overall} Rows per section ${content.shortRow.rows} rows, ${content.shortRow.rowMeasure}. Center to corner ${content.shortRow.stitches} stitches, ${content.shortRow.stitchMeasure}.`;
  }
  if (!content.wedge) return overall;
  const way = content.wedge.direction === "increase" ? "from the center to the outer edge" : "from the outer edge to the center";
  return `${overall} Outer edge ${content.wedge.outerStitches} stitches ${content.wedge.seamingNote}, ${content.wedge.outerEdgeLabel}. Wedge height ${content.wedge.rows} rows, ${content.wedge.heightLabel}. The arrow shows knitting ${way}.`;
}
