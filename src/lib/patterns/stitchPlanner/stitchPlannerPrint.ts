/**
 * Full-scale stitch planner printout.
 *
 * Pattern pages already print with the browser print dialog. That dialog can
 * hold US Letter at actual size, but the pattern sheet itself scales drawings
 * to the screen. The planner opens its own letter-size sheets, one cell per
 * calculated stitch and row, and tiles them with overlap instead of shrinking.
 */

import type { BasicSockCalc } from "../sock/sockMath";
import {
  stitchPlannerSectionGridLines,
  type StitchPlannerMeta,
  type StitchPlannerModel,
  type StitchPlannerSection,
  buildStitchPlannerModel,
} from "./stitchPlannerModel";
import {
  STITCH_PLANNER_FOOTER_IN,
  STITCH_PLANNER_HEADER_IN,
  STITCH_PLANNER_PAGE_MARGIN_IN,
  tilePageLabel,
  tileStitchPlanner,
  type StitchPlannerTile,
} from "./stitchPlannerTiles";

const FINE = "#a3a3a3";
const FIFTH = "#4a4a4a";
const INK = "#111111";
const FINE_W = 0.005;
const FIFTH_W = 0.01;
const OUTLINE_W = 0.016;

function escapeHtml(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(value: number): string {
  const rounded = Math.round(value * 10000) / 10000;
  return String(rounded);
}

function svgText(options: {
  x: number;
  y: number;
  text: string;
  size: number;
  anchor?: "start" | "middle" | "end";
  weight?: string;
}): string {
  const text = options.text.trim();
  if (!text) return "";
  return (
    `<text x="${fmt(options.x)}" y="${fmt(options.y)}" text-anchor="${options.anchor ?? "middle"}" ` +
    `dominant-baseline="middle" fill="${INK}" font-family="Arial, Helvetica, sans-serif" ` +
    `font-size="${fmt(options.size)}" font-weight="${options.weight ?? "400"}">` +
    `${escapeHtml(text)}</text>`
  );
}

function labelStep(cellIn: number): number {
  let step = 5;
  while (step * cellIn < 0.28 && step < 40) step += 5;
  return step;
}

function rectPath(x: number, y: number, width: number, height: number): string {
  return `M ${fmt(x)} ${fmt(y)} H ${fmt(x + width)} V ${fmt(y + height)} H ${fmt(x)} Z`;
}

function shortRowPaths(section: StitchPlannerSection, cellWidthIn: number, soleOnRight: boolean): string {
  const y = section.yIn;
  const height = section.heightIn;
  const midY = y + height / 2;
  const heldW = section.heldStitches * cellWidthIn;
  const workW = section.workingStitches * cellWidthIn;
  const inset = ((section.workingStitches - section.remainingStitches) * cellWidthIn) / 2;
  const stroke = `fill="#fff" stroke="${INK}" stroke-width="${OUTLINE_W}" stroke-linejoin="miter"`;
  if (soleOnRight) {
    const split = section.xIn + heldW;
    const outer = split + workW;
    const held = rectPath(section.xIn, y, heldW, height);
    const working =
      `M ${fmt(split)} ${fmt(y)} H ${fmt(outer)} L ${fmt(outer - inset)} ${fmt(midY)} ` +
      `L ${fmt(outer)} ${fmt(y + height)} H ${fmt(split)} L ${fmt(split + inset)} ${fmt(midY)} Z`;
    return `<path ${stroke} d="${held}"/>` + `<path ${stroke} d="${working}"/>`;
  }
  const split = section.xIn + workW;
  const held = rectPath(split, y, heldW, height);
  const working =
    `M ${fmt(split)} ${fmt(y)} H ${fmt(section.xIn)} L ${fmt(section.xIn + inset)} ${fmt(midY)} ` +
    `L ${fmt(section.xIn)} ${fmt(y + height)} H ${fmt(split)} L ${fmt(split - inset)} ${fmt(midY)} Z`;
  return `<path ${stroke} d="${held}"/>` + `<path ${stroke} d="${working}"/>`;
}

function gridPaths(section: StitchPlannerSection, cellWidthIn: number, cellHeightIn: number): string {
  const lines = stitchPlannerSectionGridLines(section, cellWidthIn, cellHeightIn);
  const path = (weight: "fine" | "fifth" | "outline", stroke: string, width: number) => {
    const d = lines
      .filter((line) => line.weight === weight)
      .map((line) => `M ${fmt(line.x1)} ${fmt(line.y1)} L ${fmt(line.x2)} ${fmt(line.y2)}`)
      .join(" ");
    if (!d) return "";
    return (
      `<path data-grid="${weight}" data-section="${section.id}" d="${d}" fill="none" ` +
      `stroke="${stroke}" stroke-width="${width}" stroke-linecap="square"/>`
    );
  };
  return (
    `<g data-planner-part="${section.id}-grid">` +
    path("fine", FINE, FINE_W) +
    path("fifth", FIFTH, FIFTH_W) +
    path("outline", INK, OUTLINE_W) +
    `</g>`
  );
}

function rowNumberLabels(section: StitchPlannerSection, cellHeightIn: number): string {
  if (section.kind !== "grid") return "";
  const chosen: Array<{ rc: number; y: number; keep: boolean }> = [];
  section.rcTopToBottom.forEach((rc, index) => {
    const last = index === section.rcTopToBottom.length - 1;
    if (rc === 1 && section.rcOriginEdge) return;
    if (rc % 5 !== 0 && !last) return;
    chosen.push({
      rc,
      y: section.yIn + (index + 0.5) * cellHeightIn,
      keep: last || rc % 5 === 0,
    });
  });
  const kept: typeof chosen = [];
  for (const label of chosen) {
    const previous = kept[kept.length - 1];
    if (previous && label.y - previous.y < 0.14) {
      if (label.keep && !previous.keep) kept[kept.length - 1] = label;
      else if (label.keep && previous.keep && label.rc > previous.rc) kept[kept.length - 1] = label;
      continue;
    }
    kept.push(label);
  }
  return kept
    .map((label) =>
      svgText({
        x: 0.84,
        y: label.y,
        text: String(label.rc),
        size: 0.072,
        anchor: "end",
      }),
    )
    .join("");
}

function originLabel(section: StitchPlannerSection): string {
  if (section.rcOriginEdge == null) return "";
  const y =
    section.rcOriginEdge === "bottom" ? section.yIn + section.heightIn : section.yIn;
  return svgText({ x: 0.84, y, text: "000", size: 0.068, anchor: "end" });
}

function stitchNumberLabels(
  section: StitchPlannerSection,
  cellWidthIn: number,
  edge: "top" | "bottom",
  y: number,
): string {
  const count =
    edge === "top"
      ? section.stitchesTopToBottom[0]
      : section.stitchesTopToBottom[section.stitchesTopToBottom.length - 1];
  if (!count) return "";
  const inset = (section.columns - count) / 2;
  const step = labelStep(cellWidthIn);
  const labels: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const stable = inset + index;
    const number = stable + 1;
    const isEnd = index === 0 || index === count - 1;
    if (!isEnd && number % step !== 0) continue;
    labels.push(
      svgText({
        x: section.xIn + (stable + 0.5) * cellWidthIn,
        y,
        text: String(number),
        size: 0.068,
      }),
    );
  }
  return labels.join("");
}

function sectionLabels(model: StitchPlannerModel): string {
  const parts: string[] = [];
  const cuff = [...model.sections].reverse().find((section) => section.kind === "grid");
  for (const section of model.sections) {
    parts.push(
      svgText({
        x: 0.04,
        y: section.yIn + Math.min(0.12, section.heightIn / 2),
        text: section.title,
        size: 0.1,
        anchor: "start",
        weight: "700",
      }),
    );
    if (section.kind === "plain" && section.heightIn >= 0.42) {
      parts.push(
        svgText({
          x: 0.04,
          y: section.yIn + Math.min(0.26, section.heightIn * 0.72),
          text: "short rows",
          size: 0.07,
          anchor: "start",
        }),
      );
    }
    if (section.kind === "grid") {
      parts.push(rowNumberLabels(section, model.cellHeightIn));
      parts.push(originLabel(section));
      const topCount = section.stitchesTopToBottom[0] ?? 0;
      const bottomCount = section.stitchesTopToBottom[section.stitchesTopToBottom.length - 1] ?? 0;
      if (topCount > 0 && topCount !== bottomCount && section.heightIn >= 0.7) {
        parts.push(
          svgText({
            x: 0.04,
            y: section.yIn + 0.28,
            text: `${topCount} sts at heel end`,
            size: 0.062,
            anchor: "start",
          }),
        );
        parts.push(
          svgText({
            x: 0.04,
            y: section.yIn + section.heightIn - 0.16,
            text: `${bottomCount} sts at cuff`,
            size: 0.062,
            anchor: "start",
          }),
        );
      }
    }
  }
  if (cuff) {
    parts.push(
      stitchNumberLabels(
        cuff,
        model.cellWidthIn,
        "bottom",
        cuff.yIn + cuff.heightIn + 0.12,
      ),
    );
    parts.push(
      svgText({
        x: 0.04,
        y: cuff.yIn + cuff.heightIn + 0.12,
        text: "Cuff",
        size: 0.08,
        anchor: "start",
        weight: "700",
      }),
    );
  }
  for (const id of ["heel", "toe"] as const) {
    const plain = model.sections.find((item) => item.id === id);
    if (!plain || plain.heightIn < 0.7) continue;
    const y = plain.yIn + plain.heightIn * 0.62;
    const instepOnLeft = model.soleOnRight;
    parts.push(
      svgText({
        x: plain.xIn - 0.06,
        y,
        text: instepOnLeft ? "Instep" : "Sole",
        size: 0.075,
        anchor: "end",
        weight: "700",
      }),
    );
    parts.push(
      svgText({
        x: plain.xIn + plain.widthIn + 0.06,
        y,
        text: instepOnLeft ? "Sole" : "Instep",
        size: 0.075,
        anchor: "start",
        weight: "700",
      }),
    );
  }
  const foot = model.sections.find((section) => section.id === "foot");
  if (foot) {
    parts.push(
      stitchNumberLabels(foot, model.cellWidthIn, "top", foot.yIn - 0.1),
    );
  }
  if (model.divider && foot) {
    const split = model.divider.xIn;
    const instepCenter = model.soleOnRight
      ? (foot.xIn + split) / 2
      : (split + foot.xIn + foot.widthIn) / 2;
    const soleCenter = model.soleOnRight
      ? (split + foot.xIn + foot.widthIn) / 2
      : (foot.xIn + split) / 2;
    const labelY = model.footLabelBand.yIn + 0.14;
    parts.push(svgText({ x: instepCenter, y: labelY, text: "Instep", size: 0.11, weight: "700" }));
    parts.push(svgText({ x: soleCenter, y: labelY, text: "Sole", size: 0.11, weight: "700" }));
  }
  parts.push(
    svgText({
      x: model.axisXIn,
      y: model.cuffBand.yIn + 0.34,
      text: "Cuff edging is included in the leg total.",
      size: 0.078,
      anchor: "start",
    }),
  );
  parts.push(
    svgText({
      x: model.axisXIn,
      y: model.cuffBand.yIn + 0.48,
      text: "Do not add extra rows.",
      size: 0.078,
      anchor: "start",
      weight: "700",
    }),
  );
  return parts.join("");
}

function drawingMarkup(model: StitchPlannerModel): string {
  const parts: string[] = [];
  for (const section of model.sections) {
    if (section.kind === "plain") {
      parts.push(
        `<g data-planner-part="${section.id}-outline">` +
          shortRowPaths(section, model.cellWidthIn, model.soleOnRight) +
          `</g>`,
      );
    } else {
      parts.push(gridPaths(section, model.cellWidthIn, model.cellHeightIn));
    }
  }
  if (model.divider) {
    parts.push(
      `<path data-planner-part="sole-instep-divider" d="M ${fmt(model.divider.xIn)} ${fmt(model.divider.y1In)} V ${fmt(model.divider.y2In)}" fill="none" stroke="${INK}" stroke-width="0.012"/>`,
    );
  }
  parts.push(`<g data-planner-part="labels">${sectionLabels(model)}</g>`);
  return `<g data-planner-drawing="true">${parts.join("")}</g>`;
}

function alignmentMarks(tile: StitchPlannerTile, drawingWidthIn: number, drawingHeightIn: number): string {
  const arm = 0.09;
  const crosses: string[] = [];
  const add = (x: number, y: number) => {
    if (x < tile.xIn || x > tile.xIn + tile.viewWidthIn) return;
    if (y < tile.yIn || y > tile.yIn + tile.viewHeightIn) return;
    if (x < 0 || y < 0 || x > drawingWidthIn || y > drawingHeightIn) return;
    crosses.push(
      `<path data-align="true" d="M ${fmt(x - arm)} ${fmt(y)} H ${fmt(x + arm)} M ${fmt(x)} ${fmt(y - arm)} V ${fmt(y + arm)}" fill="none" stroke="${INK}" stroke-width="0.014"/>`,
    );
  };
  const yTop = tile.yIn + Math.min(0.32, tile.viewHeightIn * 0.12);
  const yBottom = tile.yIn + tile.viewHeightIn - Math.min(0.32, tile.viewHeightIn * 0.12);
  if (tile.col > 0 && tile.overlapXIn > 0) {
    const x = tile.xIn + tile.overlapXIn / 2;
    add(x, yTop);
    add(x, yBottom);
  }
  if (tile.col < tile.cols - 1 && tile.overlapXIn > 0) {
    const x = tile.xIn + tile.viewWidthIn - tile.overlapXIn / 2;
    add(x, yTop);
    add(x, yBottom);
  }
  const xLeft = tile.xIn + Math.min(0.32, tile.viewWidthIn * 0.08);
  const xRight = tile.xIn + tile.viewWidthIn - Math.min(0.32, tile.viewWidthIn * 0.08);
  if (tile.row > 0 && tile.overlapYIn > 0) {
    const y = tile.yIn + tile.overlapYIn / 2;
    add(xLeft, y);
    add(xRight, y);
  }
  if (tile.row < tile.rows - 1 && tile.overlapYIn > 0) {
    const y = tile.yIn + tile.viewHeightIn - tile.overlapYIn / 2;
    add(xLeft, y);
    add(xRight, y);
  }
  return crosses.join("");
}

function pageSvg(model: StitchPlannerModel, tile: StitchPlannerTile, drawing: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${fmt(tile.viewWidthIn)}in" height="${fmt(tile.viewHeightIn)}in" ` +
    `viewBox="${fmt(tile.xIn)} ${fmt(tile.yIn)} ${fmt(tile.viewWidthIn)} ${fmt(tile.viewHeightIn)}" ` +
    `data-tile-index="${tile.index}" data-tile-col="${tile.col}" data-tile-row="${tile.row}" ` +
    `data-tile-x="${fmt(tile.xIn)}" data-tile-y="${fmt(tile.yIn)}" ` +
    `data-tile-w="${fmt(tile.viewWidthIn)}" data-tile-h="${fmt(tile.viewHeightIn)}">` +
    `<rect x="${fmt(tile.xIn)}" y="${fmt(tile.yIn)}" width="${fmt(tile.viewWidthIn)}" height="${fmt(tile.viewHeightIn)}" fill="#fff"/>` +
    drawing +
    alignmentMarks(tile, model.drawingWidthIn, model.drawingHeightIn) +
    `</svg>`
  );
}

function headerLines(model: StitchPlannerModel, tile: StitchPlannerTile, pageCount: number): string[] {
  const sock =
    model.meta.family === "socks" ? (model.meta.sock === 2 ? "Sock 2" : "Sock 1") : "";
  const side = model.soleOnRight
    ? "Instep on the left, sole on the right"
    : "Instep on the right, sole on the left";
  const identity = ["Stitch Planner", model.meta.patternName, sock, tilePageLabel(tile, pageCount)]
    .filter(Boolean)
    .join(" · ");
  const facts = [model.meta.sizeLabel, model.meta.constructionLabel, model.meta.gaugeLabel, side]
    .filter((part) => part.trim().length > 0)
    .join(" · ");
  const project = model.meta.projectName.trim() ? `Project: ${model.meta.projectName.trim()}` : "";
  return [identity, facts, project].filter(Boolean);
}

function pageHtml(model: StitchPlannerModel, tile: StitchPlannerTile, pageCount: number, drawing: string): string {
  const lines = headerLines(model, tile, pageCount);
  const unitNote = model.meta.displayUnit === "cm" ? " (2.54 cm)" : "";
  return (
    `<section class="planner-page">` +
    `<header class="planner-page__header">` +
    lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("") +
    `</header>` +
    `<div class="planner-page__canvas">${pageSvg(model, tile, drawing)}</div>` +
    `<footer class="planner-page__footer">` +
    `<svg class="scale-check" width="1in" height="0.18in" viewBox="0 0 1 0.18" aria-hidden="true" data-scale-check-in="1">` +
    `<line x1="0" y1="0.1" x2="1" y2="0.1" stroke="#111" stroke-width="0.025"/>` +
    `<line x1="0" y1="0.02" x2="0" y2="0.16" stroke="#111" stroke-width="0.02"/>` +
    `<line x1="1" y1="0.02" x2="1" y2="0.16" stroke="#111" stroke-width="0.02"/>` +
    `</svg>` +
    `<p>This line is 1 inch${escapeHtml(unitNote)}. Print at Actual Size / 100%. Do not use Fit to page. ` +
    `Overlap the + marks. Do not leave a gap or skip a row.</p>` +
    `</footer>` +
    `</section>`
  );
}

export function buildStitchPlannerPrintHtml(model: StitchPlannerModel): string {
  const tiled = tileStitchPlanner({
    drawingWidthIn: model.drawingWidthIn,
    drawingHeightIn: model.drawingHeightIn,
    cellWidthIn: model.cellWidthIn,
    cellHeightIn: model.cellHeightIn,
  });
  const drawing = drawingMarkup(model);
  const foot = model.sections.find((section) => section.id === "foot");
  const leg = model.sections.find((section) => section.id === "leg");
  const ankle = model.sections.find((section) => section.id === "ankle");
  const legRows = (leg?.rows ?? 0) + (ankle?.rows ?? 0);
  const title = ["Stitch Planner", model.meta.patternName, model.meta.projectName]
    .filter((part) => part.trim().length > 0)
    .join(" — ");
  const { contentWidthIn, contentHeightIn } = tiled.box;
  const pages = tiled.tiles
    .map((tile) => pageHtml(model, tile, tiled.tiles.length, drawing))
    .join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: letter; margin: ${fmt(STITCH_PLANNER_PAGE_MARGIN_IN)}in; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #111; }
    body { font-family: Arial, Helvetica, sans-serif; }
    .screen-help {
      max-width: 40rem;
      margin: 0.6rem auto;
      padding: 0.6rem 0.8rem;
      font-size: 0.95rem;
      line-height: 1.4;
    }
    .screen-help button {
      font: inherit;
      font-weight: 700;
      margin-top: 0.4rem;
      padding: 0.35rem 0.8rem;
    }
    .planner-page {
      width: ${fmt(contentWidthIn)}in;
      height: ${fmt(contentHeightIn)}in;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #fff;
      break-after: page;
      page-break-after: always;
    }
    .planner-page:last-child { break-after: auto; page-break-after: auto; }
    .planner-page__header {
      height: ${fmt(STITCH_PLANNER_HEADER_IN)}in;
      overflow: hidden;
      padding: 0 0.02in;
    }
    .planner-page__header p {
      margin: 0;
      font-size: 8.5pt;
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .planner-page__header p:first-child { font-weight: 700; font-size: 10pt; }
    .planner-page__canvas { flex: 1 1 auto; min-height: 0; overflow: hidden; }
    .planner-page__canvas svg { display: block; }
    .planner-page__footer {
      height: ${fmt(STITCH_PLANNER_FOOTER_IN)}in;
      display: flex;
      align-items: center;
      gap: 0.12in;
      overflow: hidden;
    }
    .planner-page__footer p { margin: 0; font-size: 8pt; line-height: 1.25; }
    .scale-check { flex: 0 0 auto; }
    @media screen {
      body { background: #e5e7eb; }
      .planner-page {
        margin: 0.35in auto;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
      }
    }
    @media print {
      .screen-help { display: none !important; }
      body { background: #fff; }
      .planner-page { margin: 0; box-shadow: none; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body
  data-stitch-planner="true"
  data-family="${escapeHtml(model.meta.family)}"
  data-cell-width-in="${fmt(model.cellWidthIn)}"
  data-cell-height-in="${fmt(model.cellHeightIn)}"
  data-foot-columns="${foot?.columns ?? 0}"
  data-foot-rows="${foot?.rows ?? 0}"
  data-leg-rows="${leg?.rows ?? 0}"
  data-ankle-rows="${ankle?.rows ?? 0}"
  data-counted-leg-rows="${legRows}"
  data-added-rows="0"
  data-pages="${tiled.tiles.length}"
  data-sole-side="${model.soleOnRight ? "right" : "left"}"
  data-drawing-width-in="${fmt(model.drawingWidthIn)}"
  data-drawing-height-in="${fmt(model.drawingHeightIn)}"
>
  <div class="screen-help">
    <p><strong>Print at Actual Size / 100%.</strong> Turn off Fit to page and Shrink to fit. The grid is drawn at your gauge. Check that the scale line measures 1 inch.</p>
    <button type="button" onclick="window.print()">Print</button>
  </div>
  ${pages}
</body>
</html>`;
}

export function stitchPlannerProjectName(name: string, genericNames: readonly string[]): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const generic = genericNames.some((entry) => entry.toLowerCase() === trimmed.toLowerCase());
  return generic ? "" : trimmed;
}

export function setStitchPlannerActionVisible(root: ParentNode, visible: boolean): void {
  const button = root.querySelector("[data-stitch-planner-print]");
  if (!(button instanceof HTMLElement)) return;
  button.hidden = !visible;
  button.style.display = visible ? "inline-flex" : "none";
}

function writePrintDocument(html: string): void {
  const opened = window.open("", "knit-it-now-stitch-planner");
  if (opened) {
    opened.document.open();
    opened.document.write(html);
    opened.document.close();
    window.setTimeout(() => {
      opened.focus();
      opened.print();
    }, 300);
    return;
  }
  const frame = document.createElement("iframe");
  frame.title = "Stitch Planner";
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const printWindow = frame.contentWindow;
  if (!doc || !printWindow) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 300);
}

export function printStitchPlanner(calc: BasicSockCalc, meta: StitchPlannerMeta): void {
  writePrintDocument(buildStitchPlannerPrintHtml(buildStitchPlannerModel(calc, meta)));
}
