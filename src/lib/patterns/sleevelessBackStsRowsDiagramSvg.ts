/**
 * Generated Stitches & Rows SVG for Sleeveless Back (straight or A-line).
 *
 * Consumes {@link SleevelessBackStsRowsDiagramModel} only — no pattern math,
 * no Japanese notation, no Illustrator geometry.
 * Visual system matches the Front Stitches & Rows renderer.
 */

import {
  buildSleevelessBackGarmentFrame,
  sleevelessBackArmholePoints,
  sleevelessBackBodySidePoints,
  sleevelessBackPolylineD,
  sleevelessBackRoundNecklineCurveD,
  sleevelessBackShoulderSegment,
  sleevelessBackSilhouettePathD,
  sleevelessBackYAtRc,
  SLEEVELESS_BACK_GARMENT_VB_H,
  SLEEVELESS_BACK_GARMENT_VB_W,
  SLEEVELESS_BACK_STS_ROWS_VISUAL,
  usesSleevelessBackAlineBodySilhouette,
  type SleevelessBackGarmentFrame,
} from "./sleevelessBackGarmentGeometry";
import {
  buildSleevelessBackStsRowsDiagramModel,
  type SleevelessBackStsRowsDiagramModel,
} from "./sleevelessBackStsRowsDiagramModel";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";

const VB_W = SLEEVELESS_BACK_GARMENT_VB_W;
const VB_H = SLEEVELESS_BACK_GARMENT_VB_H;

const STROKE = "#1a1a1a";
const FILL = "#f4f6f1";
const MUTED = "#4b5563";
const ARROW = "#52682d";
const FONT = "Poppins, system-ui, Arial, sans-serif";
const FS_STITCH = 17;
const FS_SECONDARY = 14;
const LINE_GAP = 18;

export { SLEEVELESS_BACK_STS_ROWS_VISUAL };
export const SLEEVELESS_BACK_STS_ROWS_VIEWBOX = { width: VB_W, height: VB_H } as const;

type Frame = SleevelessBackGarmentFrame;

function escapeXml(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 100) / 100);
}

function textFont(size: number, weight?: number): string {
  const w = weight != null ? ` font-weight="${weight}"` : "";
  return `font-family="${FONT}" font-size="${size}"${w}`;
}

function isSupportedModel(model: SleevelessBackStsRowsDiagramModel): boolean {
  if (model.piece !== "back" || model.neckline.style !== "round") return false;
  if (model.bodyShape === "straight") return model.bodyShaping.direction === "straight";
  return model.bodyShape === "aline";
}

function buildFrame(model: SleevelessBackStsRowsDiagramModel) {
  return buildSleevelessBackGarmentFrame(model);
}

function formatDisplayNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 0.05) return String(rounded);
  return String(Math.round(n * 10) / 10).replace(/\.0$/, "");
}

function inchesFromRows(rows: number, rowsPerInch: number): string {
  if (!(rowsPerInch > 0) || !(rows > 0)) return "";
  return `${formatDisplayNumber(rows / rowsPerInch)} in`;
}

function inchesFromStitches(stitches: number, stitchesPerInch: number): string {
  if (!(stitchesPerInch > 0) || !(stitches > 0)) return "";
  return `${formatDisplayNumber(stitches / stitchesPerInch)} in`;
}

function arrowHead(x: number, y: number, dir: "up" | "down" | "left" | "right"): string {
  const s = 4;
  if (dir === "up") {
    return `<polygon points="${fmtNum(x)},${fmtNum(y)} ${fmtNum(x - s)},${fmtNum(y + s * 1.6)} ${fmtNum(x + s)},${fmtNum(y + s * 1.6)}" fill="${ARROW}"/>`;
  }
  if (dir === "down") {
    return `<polygon points="${fmtNum(x)},${fmtNum(y)} ${fmtNum(x - s)},${fmtNum(y - s * 1.6)} ${fmtNum(x + s)},${fmtNum(y - s * 1.6)}" fill="${ARROW}"/>`;
  }
  if (dir === "left") {
    return `<polygon points="${fmtNum(x)},${fmtNum(y)} ${fmtNum(x + s * 1.6)},${fmtNum(y - s)} ${fmtNum(x + s * 1.6)},${fmtNum(y + s)}" fill="${ARROW}"/>`;
  }
  return `<polygon points="${fmtNum(x)},${fmtNum(y)} ${fmtNum(x - s * 1.6)},${fmtNum(y - s)} ${fmtNum(x - s * 1.6)},${fmtNum(y + s)}" fill="${ARROW}"/>`;
}

function measurementTexts(
  lines: readonly { text: string; extra?: string }[],
  x: number,
  y: number,
  role: string,
  measure: string,
  anchor: "middle" | "start" | "end",
  lineGap = LINE_GAP,
): string {
  return lines
    .map((line, i) => {
      const size = i === 0 ? FS_STITCH : FS_SECONDARY;
      const dy = (i - (lines.length - 1) / 2) * lineGap;
      return `<text data-role="${role}" data-measure="${measure}" x="${fmtNum(x)}" y="${fmtNum(y + dy)}" text-anchor="${anchor}" dominant-baseline="middle" fill="${MUTED}" ${textFont(size)}${line.extra ?? ""}>${escapeXml(line.text)}</text>`;
    })
    .join("");
}

function labelBlockHalfHeight(lineCount: number, lineGap = LINE_GAP): number {
  if (lineCount <= 0) return 0;
  return ((lineCount - 1) / 2) * lineGap + FS_STITCH / 2;
}

function verticalArrow(
  x: number,
  y1: number,
  y2: number,
  labelX: number,
  role: string,
  measure: string,
  lines: readonly { text: string; extra?: string }[],
  anchor: "middle" | "start" | "end" = "middle",
  options?: { lineGap?: number; labelY?: number },
): string {
  const top = Math.min(y1, y2);
  const bot = Math.max(y1, y2);
  const midY = options?.labelY ?? (top + bot) / 2;
  const lineGap = options?.lineGap ?? LINE_GAP;
  return [
    `<g data-role="${role}" data-measure="${measure}">`,
    `<line x1="${fmtNum(x)}" y1="${fmtNum(top)}" x2="${fmtNum(x)}" y2="${fmtNum(bot)}" stroke="${ARROW}" stroke-width="1.5" fill="none"/>`,
    arrowHead(x, top, "up"),
    arrowHead(x, bot, "down"),
    measurementTexts(lines, labelX, midY, role, measure, anchor, lineGap),
    `</g>`,
  ].join("");
}

function horizontalArrow(
  y: number,
  x1: number,
  x2: number,
  labelY: number,
  role: string,
  measure: string,
  lines: readonly { text: string; extra?: string }[],
): string {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const midX = (left + right) / 2;
  return [
    `<g data-role="${role}" data-measure="${measure}">`,
    `<line x1="${fmtNum(left)}" y1="${fmtNum(y)}" x2="${fmtNum(right)}" y2="${fmtNum(y)}" stroke="${ARROW}" stroke-width="1.5" fill="none"/>`,
    arrowHead(left, y, "left"),
    arrowHead(right, y, "right"),
    measurementTexts(lines, midX, labelY, role, measure, "middle"),
    `</g>`,
  ].join("");
}

function drawSilhouette(frame: Frame, tapered: boolean): string {
  const leftBody = sleevelessBackBodySidePoints(frame, "left", tapered);
  const rightBody = sleevelessBackBodySidePoints(frame, "right", tapered);
  const leftShoulder = sleevelessBackShoulderSegment(frame, "left");
  const rightShoulder = sleevelessBackShoulderSegment(frame, "right");
  const leftArmhole = sleevelessBackArmholePoints(frame, "left");
  const rightArmhole = sleevelessBackArmholePoints(frame, "right");
  return [
    `<path data-role="body-outline" class="sleeveless-back-sts-rows__body" d="${sleevelessBackSilhouettePathD(frame, tapered)}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    `<path data-role="left-body-path" d="${sleevelessBackPolylineD(leftBody)}" fill="none" stroke="none"/>`,
    `<path data-role="right-body-path" d="${sleevelessBackPolylineD(rightBody)}" fill="none" stroke="none"/>`,
    `<path data-role="armhole-outline" data-side="left" d="${sleevelessBackPolylineD(leftArmhole)}" fill="none" stroke="none"/>`,
    `<path data-role="armhole-outline" data-side="right" d="${sleevelessBackPolylineD(rightArmhole)}" fill="none" stroke="none"/>`,
    `<path data-role="neckline-outline" d="${sleevelessBackRoundNecklineCurveD(frame)}" fill="none" stroke="none"/>`,
    `<path data-role="shoulder-outline" data-side="left" data-contour="slope" d="${sleevelessBackPolylineD(leftShoulder)}" fill="none" stroke="none"/>`,
    `<path data-role="shoulder-outline" data-side="right" data-contour="slope" d="${sleevelessBackPolylineD(rightShoulder)}" fill="none" stroke="none"/>`,
  ].join("");
}

function drawMeasurements(model: SleevelessBackStsRowsDiagramModel, frame: Frame): string {
  const rpi = model.rows.rowsPerInch;
  const spi = model.widths.stitchesPerInch;
  const totalArrowX = Math.max(40, frame.left - 24);
  const hemArrowX = Math.max(totalArrowX + 12, frame.left - 10);
  const leftGutterLabelX = 34;
  const hemLineGap = 22;
  const rightArrowX = Math.min(VB_W - 28, frame.right + 22);
  const rightLabelX = Math.min(VB_W - 12, rightArrowX + 22);
  const neckDepthX = Math.min(frame.cx - 22, frame.neckLeft - 12);
  const parts: string[] = [];

  const totalLengthLines = [
    { text: `${model.rows.expectedGarmentRows} rows`, extra: ` data-rows="${fmtNum(model.rows.expectedGarmentRows)}"` },
    { text: inchesFromRows(model.rows.expectedGarmentRows, rpi) },
  ].filter((line) => line.text);
  const hemLines = [
    { text: `${model.rows.hemRows} rows`, extra: ` data-rows="${fmtNum(model.rows.hemRows)}"` },
    { text: inchesFromRows(model.rows.hemRows, rpi) },
  ].filter((line) => line.text);
  const totalLabelY = (frame.shoulderTopY + frame.bottomY) / 2;
  const hemBandMidY = (frame.hemY + frame.bottomY) / 2;
  const minLabelSep = 10;
  const totalLabelBottom = totalLabelY + labelBlockHalfHeight(totalLengthLines.length);
  let hemLabelY = hemBandMidY;
  const hemLabelTop = hemLabelY - labelBlockHalfHeight(hemLines.length, hemLineGap);
  if (model.rows.hemRows > 0 && hemLabelTop < totalLabelBottom + minLabelSep) {
    hemLabelY = Math.min(
      VB_H - 16,
      totalLabelBottom + minLabelSep + labelBlockHalfHeight(hemLines.length, hemLineGap),
    );
  }

  parts.push(
    verticalArrow(
      totalArrowX,
      frame.shoulderTopY,
      frame.bottomY,
      leftGutterLabelX,
      "length-measurement",
      "garment-length",
      totalLengthLines,
    ),
  );

  parts.push(
    verticalArrow(
      rightArrowX,
      frame.armholeStartY,
      frame.bottomY,
      rightLabelX,
      "length-measurement",
      "body-length",
      [
        {
          text: `${model.rows.rowsFromCastOnToArmholeStart} rows`,
          extra: ` data-rows="${fmtNum(model.rows.rowsFromCastOnToArmholeStart)}"`,
        },
        { text: inchesFromRows(model.rows.rowsFromCastOnToArmholeStart, rpi) },
      ].filter((line) => line.text),
      "start",
    ),
  );

  if (model.rows.hemRows > 0) {
    parts.push(
      verticalArrow(
        hemArrowX,
        frame.hemY,
        frame.bottomY,
        leftGutterLabelX,
        "length-measurement",
        "hem",
        hemLines,
        "middle",
        { lineGap: hemLineGap, labelY: hemLabelY },
      ),
    );
  }

  parts.push(
    verticalArrow(
      rightArrowX,
      frame.shoulderY,
      frame.armholeStartY,
      rightLabelX,
      "length-measurement",
      "armhole",
      [
        { text: `${model.rows.armholeRows} rows`, extra: ` data-rows="${fmtNum(model.rows.armholeRows)}"` },
        { text: inchesFromRows(model.rows.armholeRows, rpi) },
      ].filter((line) => line.text),
      "start",
    ),
  );

  if (model.neckline.depthRows > 0) {
    parts.push(
      verticalArrow(
        neckDepthX,
        frame.neckCornerY,
        frame.neckStartY,
        neckDepthX - 20,
        "length-measurement",
        "neck-depth",
        [
          { text: `${model.neckline.depthRows} rows`, extra: ` data-rows="${fmtNum(model.neckline.depthRows)}"` },
          { text: inchesFromRows(model.neckline.depthRows, rpi) },
        ].filter((line) => line.text),
      ),
    );
  }

  const bustY = frame.hemY + (frame.armholeStartY - frame.hemY) * 0.42;
  parts.push(
    horizontalArrow(
      bustY,
      frame.left,
      frame.right,
      bustY - 20,
      "width-measurement",
      "bust",
      [
        { text: `${model.widths.bustStitches} sts`, extra: ` data-sts="${fmtNum(model.widths.bustStitches)}"` },
        { text: inchesFromStitches(model.widths.bustStitches, spi) },
      ].filter((line) => line.text),
    ),
  );

  parts.push(
    horizontalArrow(
      Math.min(VB_H - 22, frame.bottomY + 18),
      frame.hemLeft,
      frame.hemRight,
      Math.min(VB_H - 8, frame.bottomY + 34),
      "width-measurement",
      "cast-on",
      [
        { text: `${model.widths.hemStitches} sts`, extra: ` data-sts="${fmtNum(model.widths.hemStitches)}"` },
        { text: inchesFromStitches(model.widths.hemStitches, spi) },
      ].filter((line) => line.text),
    ),
  );

  const neckArrowY = Math.min(frame.neckCornerY + 14, frame.neckStartY - 24);
  const neckLabelY = Math.min(frame.shoulderTopY - 22, neckArrowY - 26);
  parts.push(
    horizontalArrow(
      neckArrowY,
      frame.neckLeft,
      frame.neckRight,
      neckLabelY,
      "width-measurement",
      "neck",
      [
        { text: `${model.widths.necklineStitches} sts`, extra: ` data-sts="${fmtNum(model.widths.necklineStitches)}"` },
        { text: inchesFromStitches(model.widths.necklineStitches, spi) },
      ].filter((line) => line.text),
    ),
  );

  const shoulderArrowY = frame.shoulderY + 16;
  const shoulderMidX = (frame.afterRight + frame.neckRight) / 2;
  const shoulderLabelY = shoulderArrowY + 26;
  parts.push(
    horizontalArrow(
      shoulderArrowY,
      frame.afterRight,
      frame.neckRight,
      shoulderLabelY,
      "width-measurement",
      "shoulder",
      [
        {
          text: `${model.widths.shoulderStitchesPerSide} sts`,
          extra: ` data-sts="${fmtNum(model.widths.shoulderStitchesPerSide)}"`,
        },
        { text: inchesFromStitches(model.widths.shoulderStitchesPerSide, spi) },
      ].filter((line) => line.text),
    ),
  );
  parts.push(
    `<g data-role="shoulder-width-anchor" data-x="${fmtNum(shoulderMidX)}" data-y="${fmtNum(shoulderArrowY)}"></g>`,
  );

  return parts.join("");
}

export function buildSleevelessBackStsRowsDiagramSvg(
  model: SleevelessBackStsRowsDiagramModel,
): string {
  const { frame, bands } = buildFrame(model);
  const bindOffEvent = model.armhole.events.find((ev) => ev.kind === "bindOff" && ev.side === "right");
  const decreaseEvents = model.armhole.events.filter((ev) => ev.kind === "decrease" && ev.side === "right");
  const firstDecreaseY =
    decreaseEvents.length > 0 ? sleevelessBackYAtRc(decreaseEvents[0]!.garmentRc, bands) : frame.lastArmholeY;

  const parts = [drawSilhouette(frame, usesSleevelessBackAlineBodySilhouette(model)), drawMeasurements(model, frame)];
  const safeBody = parts
    .join("")
    .replace(/\bNaN\b/g, "0")
    .replace(/\bInfinity\b/g, "0")
    .replace(/\bundefined\b/g, "");

  const title = "Sleeveless Back stitches and rows";
  const desc = `${model.widths.hemStitches} sts cast on. ${model.rows.expectedGarmentRows} rows. Back neck ${model.widths.necklineStitches} sts, ${model.neckline.depthRows} rows deep.`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="sleeveless-back-sts-rows-svg" viewBox="0 0 ${VB_W} ${VB_H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="sleeveless-back-sts-rows-title" data-sleeveless-back-sts-rows-generated="true" data-supported="true" data-piece="${escapeXml(model.piece)}" data-garment-style="${escapeXml(model.garmentStyle)}" data-body-shape="${escapeXml(model.bodyShape)}" data-neckline-style="${escapeXml(model.neckline.style)}" data-hem-sts="${fmtNum(model.widths.hemStitches)}" data-bust-sts="${fmtNum(model.widths.bustStitches)}" data-after-armhole-sts="${fmtNum(model.widths.stitchesAfterArmhole)}" data-neck-sts="${fmtNum(model.widths.necklineStitches)}" data-shoulder-sts="${fmtNum(model.widths.shoulderStitchesPerSide)}" data-hem-width="${fmtNum(frame.hemWidth)}" data-bust-width="${fmtNum(frame.bodyWidth)}" data-after-armhole-width="${fmtNum(frame.afterWidth)}" data-true-after-width="${fmtNum(frame.trueAfterWidth)}" data-upper-scale="${fmtNum(frame.upperScale)}" data-neck-width="${fmtNum(frame.neckWidth)}" data-shoulder-side-width="${fmtNum(frame.shoulderSideWidth)}" data-px-per-stitch="${fmtNum(frame.pxPerStitch)}" data-cx="${fmtNum(frame.cx)}" data-hem-left="${fmtNum(frame.hemLeft)}" data-hem-right="${fmtNum(frame.hemRight)}" data-bust-left="${fmtNum(frame.left)}" data-bust-right="${fmtNum(frame.right)}" data-after-left="${fmtNum(frame.afterLeft)}" data-after-right="${fmtNum(frame.afterRight)}" data-bo-left="${fmtNum(frame.boLeft)}" data-bo-right="${fmtNum(frame.boRight)}" data-neck-left="${fmtNum(frame.neckLeft)}" data-neck-right="${fmtNum(frame.neckRight)}" data-bottom-y="${fmtNum(frame.bottomY)}" data-hem-y="${fmtNum(frame.hemY)}" data-shape-start-y="${fmtNum(frame.shapeStartY)}" data-shape-end-y="${fmtNum(frame.shapeEndY)}" data-shape-start-rc="${fmtNum(model.bodyShaping.startRc)}" data-shape-end-rc="${fmtNum(model.bodyShaping.endRc)}" data-body-shaping-direction="${escapeXml(model.bodyShaping.direction)}" data-armhole-start-y="${fmtNum(frame.armholeStartY)}" data-last-armhole-y="${fmtNum(frame.lastArmholeY)}" data-last-decrease-rc="${fmtNum(frame.lastDecreaseRc)}" data-first-decrease-y="${fmtNum(firstDecreaseY)}" data-neck-start-y="${fmtNum(frame.neckStartY)}" data-shoulder-y="${fmtNum(frame.shoulderY)}" data-neck-corner-y="${fmtNum(frame.neckCornerY)}" data-shoulder-top-y="${fmtNum(frame.shoulderTopY)}" data-visual-hem-h="${fmtNum(frame.visualHemH)}" data-visual-body-h="${fmtNum(frame.visualBodyH)}" data-visual-armhole-h="${fmtNum(frame.visualArmholeH)}" data-visual-shoulder-h="${fmtNum(frame.visualShoulderH)}" data-visual-neck-h="${fmtNum(frame.visualNeckH)}" data-rc-mapped-neck-h="${fmtNum(frame.rcMappedNeckH)}" data-visual-garment-h="${fmtNum(frame.visualGarmentH)}" data-armhole-start-rc="${fmtNum(model.armhole.startGarmentRc)}" data-last-armhole-rc="${fmtNum(model.armhole.lastGarmentRc)}" data-neck-start-rc="${fmtNum(model.neckline.startGarmentRc)}" data-shoulder-start-rc="${fmtNum(model.shoulder.startGarmentRc)}" data-hem-rows="${fmtNum(model.rows.hemRows)}" data-body-length-rows="${fmtNum(model.rows.rowsFromCastOnToArmholeStart)}" data-side-seam-rows="${fmtNum(model.rows.sideSeamRowsAboveHem)}" data-armhole-rows="${fmtNum(model.rows.armholeRows)}" data-neck-depth-rows="${fmtNum(model.neckline.depthRows)}" data-total-rows="${fmtNum(model.rows.expectedGarmentRows)}" data-bind-off-sts="${fmtNum(model.armhole.bindOffStsEachSide)}" data-decrease-sts="${fmtNum(model.armhole.decreaseStsEachSide)}" data-shoulder-contour="slope" data-shoulder-point-count="${model.shoulder.points.length}" data-round-strategy="${escapeXml(model.neckline.strategy)}" data-center-held="${model.neckline.centerHeld ? "true" : "false"}" data-center-bind-off-sts="${fmtNum(model.neckline.centerBindOffStitches)}" data-bind-off-rc="${fmtNum(bindOffEvent?.garmentRc ?? model.armhole.startGarmentRc)}">`,
    `<title id="sleeveless-back-sts-rows-title">${title}</title>`,
    `<desc>${escapeXml(desc)}</desc>`,
    `<style type="text/css"><![CDATA[text{font-family:${FONT}}]]></style>`,
    `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#fff"/>`,
    safeBody,
    `</svg>`,
  ].join("");
}

export function tryBuildSleevelessBackStsRowsDiagramSvg(
  model: SleevelessBackStsRowsDiagramModel | null | undefined,
): string | null {
  if (!model || !isSupportedModel(model)) return null;
  const svg = buildSleevelessBackStsRowsDiagramSvg(model);
  if (!svg.includes('data-sleeveless-back-sts-rows-generated="true"')) return null;
  if (!svg.includes('data-supported="true"')) return null;
  return svg;
}

export function tryBuildLiveSleevelessBackStsRowsDiagramSvg(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): string | null {
  return tryBuildSleevelessBackStsRowsDiagramSvg(
    buildSleevelessBackStsRowsDiagramModel(result, patternData),
  );
}
