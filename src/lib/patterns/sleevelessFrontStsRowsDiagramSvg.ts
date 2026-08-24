/**
 * Generated Stitches & Rows SVG for Sleeveless Front.
 * Pullover: straight or A-line. Cardigan: straight or A-line left Front.
 *
 * Consumes {@link SleevelessFrontStsRowsDiagramModel} only — no pattern math,
 * no Japanese notation, no Illustrator geometry.
 */

import {
  cardiganRoundNecklineCubic,
  cardiganRoundNecklineCubicD,
  cardiganRoundNecklineCurveD,
} from "./sleevelessFrontCardiganRoundNeckCurve";
import {
  buildSleevelessFrontGarmentFrame,
  isSleevelessFrontCardiganModel,
  SLEEVELESS_FRONT_GARMENT_VB_H,
  SLEEVELESS_FRONT_GARMENT_VB_W,
  sleevelessFrontArmholePoints,
  sleevelessFrontArmholeSilhouetteCommands,
  sleevelessFrontBodySidePoints,
  sleevelessFrontGarmentFmtNum,
  sleevelessFrontPolylineD,
  sleevelessFrontYAtRc,
  usesSleevelessFrontAlineBodySilhouette,
  type SleevelessFrontGarmentFrame,
  type SleevelessFrontGarmentPt,
  type SleevelessFrontGarmentYBand,
} from "./sleevelessFrontGarmentGeometry";
import {
  buildSleevelessFrontStsRowsDiagramModel,
  isSleevelessFrontStsRowsVNeckline,
  type SleevelessFrontStsRowsDiagramModel,
} from "./sleevelessFrontStsRowsDiagramModel";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";

const VB_W = SLEEVELESS_FRONT_GARMENT_VB_W;
const VB_H = SLEEVELESS_FRONT_GARMENT_VB_H;

export {
  SLEEVELESS_FRONT_STS_ROWS_VIEWBOX,
  SLEEVELESS_FRONT_STS_ROWS_VISUAL,
} from "./sleevelessFrontGarmentGeometry";

const STROKE = "#1a1a1a";
const FILL = "#f4f6f1";
const MUTED = "#4b5563";
const ARROW = "#52682d";
const FONT = "Poppins, system-ui, Arial, sans-serif";
const FS_STITCH = 17;
const FS_SECONDARY = 14;
const LINE_GAP = 18;

type YBand = SleevelessFrontGarmentYBand;
type Pt = SleevelessFrontGarmentPt;
type Frame = SleevelessFrontGarmentFrame;

function escapeXml(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const fmtNum = sleevelessFrontGarmentFmtNum;
const polylineD = sleevelessFrontPolylineD;
const yAtRc = sleevelessFrontYAtRc;
const isCardiganFrontModel = isSleevelessFrontCardiganModel;

function textFont(size: number, weight?: number): string {
  const w = weight != null ? ` font-weight="${weight}"` : "";
  return `font-family="${FONT}" font-size="${size}"${w}`;
}

function isSupportedModel(model: SleevelessFrontStsRowsDiagramModel): boolean {
  if (model.piece !== "front") return false;
  if (model.neckline.style !== "v-neck" && model.neckline.style !== "round") return false;
  if (isCardiganFrontModel(model)) {
    if (model.bodyShape === "straight") return model.bodyShaping.direction === "straight";
    return model.bodyShape === "aline";
  }
  if (model.garmentStyle !== "pullover") return false;
  if (model.bodyShape === "straight") return model.bodyShaping.direction === "straight";
  return model.bodyShape === "aline";
}

const usesAlineBodySilhouette = usesSleevelessFrontAlineBodySilhouette;
const buildFrame = buildSleevelessFrontGarmentFrame;

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
  options?: { labelX?: number; labelAnchor?: "middle" | "start" | "end" },
): string {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const midX = options?.labelX ?? (left + right) / 2;
  const anchor = options?.labelAnchor ?? "middle";
  return [
    `<g data-role="${role}" data-measure="${measure}">`,
    `<line x1="${fmtNum(left)}" y1="${fmtNum(y)}" x2="${fmtNum(right)}" y2="${fmtNum(y)}" stroke="${ARROW}" stroke-width="1.5" fill="none"/>`,
    arrowHead(left, y, "left"),
    arrowHead(right, y, "right"),
    measurementTexts(lines, midX, labelY, role, measure, anchor),
    `</g>`,
  ].join("");
}

function roundNecklineCurveD(frame: Frame): string {
  return [
    `M ${fmtNum(frame.neckLeft)} ${fmtNum(frame.neckCornerY)}`,
    `C ${fmtNum(frame.neckLeft)} ${fmtNum(frame.neckStartY)} ${fmtNum(frame.cx)} ${fmtNum(frame.neckStartY)} ${fmtNum(frame.cx)} ${fmtNum(frame.neckStartY)}`,
    `C ${fmtNum(frame.cx)} ${fmtNum(frame.neckStartY)} ${fmtNum(frame.neckRight)} ${fmtNum(frame.neckStartY)} ${fmtNum(frame.neckRight)} ${fmtNum(frame.neckCornerY)}`,
  ].join(" ");
}

function cardiganRoundCubicD(frame: Frame): string {
  return cardiganRoundNecklineCubicD(cardiganRoundNecklineCubic(frame), fmtNum);
}

function cardiganRoundCurveD(frame: Frame): string {
  return cardiganRoundNecklineCurveD(frame, fmtNum);
}

const bodySidePoints = sleevelessFrontBodySidePoints;

function drawCardiganSilhouette(
  frame: Frame,
  neckStyle: "v-neck" | "round",
  tapered: boolean,
): string {
  const leftBody: Pt[] = [
    { x: frame.left, y: frame.bottomY },
    { x: frame.left, y: frame.neckStartY },
  ];
  const rightBody = bodySidePoints(frame, "right", tapered);
  const rightArmhole = sleevelessFrontArmholePoints(frame, "right");
  const rightShoulder: Pt[] = [
    { x: frame.afterRight, y: frame.shoulderY },
    { x: frame.neckRight, y: frame.neckCornerY },
  ];
  const vNeckline: Pt[] = [
    { x: frame.neckLeft, y: frame.neckStartY },
    { x: frame.neckRight, y: frame.neckCornerY },
  ];
  const necklineD = neckStyle === "round" ? cardiganRoundCurveD(frame) : polylineD(vNeckline);
  const neckOpening =
    neckStyle === "round"
      ? [cardiganRoundCubicD(frame)]
      : [`L ${fmtNum(frame.neckRight)} ${fmtNum(frame.neckCornerY)}`];
  const rightDown = [...rightBody].reverse();
  const rightClose =
    rightDown[0] &&
    Math.abs(rightDown[0].x - frame.right) < 0.05 &&
    Math.abs(rightDown[0].y - frame.armholeStartY) < 0.05
      ? rightDown.slice(1)
      : rightDown;
  const silhouette = [
    `M ${fmtNum(frame.left)} ${fmtNum(frame.bottomY)}`,
    `L ${fmtNum(frame.left)} ${fmtNum(frame.neckStartY)}`,
    ...neckOpening,
    ...sleevelessFrontArmholeSilhouetteCommands(frame, "right"),
    `L ${fmtNum(frame.right)} ${fmtNum(frame.armholeStartY)}`,
    ...rightClose.map((p) => `L ${fmtNum(p.x)} ${fmtNum(p.y)}`),
    "Z",
  ].join(" ");

  return [
    `<path data-role="body-outline" class="sleeveless-front-sts-rows__body" d="${silhouette}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    `<path data-role="center-front-edge" d="${polylineD(leftBody)}" fill="none" stroke="none"/>`,
    `<path data-role="left-body-path" d="${polylineD(leftBody)}" fill="none" stroke="none"/>`,
    `<path data-role="right-body-path" d="${polylineD(rightBody)}" fill="none" stroke="none"/>`,
    `<path data-role="armhole-outline" data-side="right" d="${polylineD(rightArmhole)}" fill="none" stroke="none"/>`,
    `<path data-role="neckline-outline"${neckStyle === "round" ? ' data-contour="one-sided-scoop"' : ""} d="${necklineD}" fill="none" stroke="none"/>`,
    `<path data-role="shoulder-outline" data-side="right" data-contour="slope" d="${polylineD(rightShoulder)}" fill="none" stroke="none"/>`,
  ].join("");
}

function drawSilhouette(frame: Frame, neckStyle: "v-neck" | "round", tapered: boolean): string {
  const leftBody = bodySidePoints(frame, "left", tapered);
  const rightBody = bodySidePoints(frame, "right", tapered);
  const leftShoulder: Pt[] = [
    { x: frame.afterLeft, y: frame.shoulderY },
    { x: frame.neckLeft, y: frame.neckCornerY },
  ];
  const rightShoulder: Pt[] = [
    { x: frame.afterRight, y: frame.shoulderY },
    { x: frame.neckRight, y: frame.neckCornerY },
  ];
  const leftArmhole = sleevelessFrontArmholePoints(frame, "left");
  const rightArmhole = sleevelessFrontArmholePoints(frame, "right");
  const vNeckline: Pt[] = [
    { x: frame.neckLeft, y: frame.neckCornerY },
    { x: frame.cx, y: frame.neckStartY },
    { x: frame.neckRight, y: frame.neckCornerY },
  ];
  const necklineD = neckStyle === "round" ? roundNecklineCurveD(frame) : polylineD(vNeckline);
  const neckOpening =
    neckStyle === "round"
      ? [
          `L ${fmtNum(frame.neckLeft)} ${fmtNum(frame.neckCornerY)}`,
          `C ${fmtNum(frame.neckLeft)} ${fmtNum(frame.neckStartY)} ${fmtNum(frame.cx)} ${fmtNum(frame.neckStartY)} ${fmtNum(frame.cx)} ${fmtNum(frame.neckStartY)}`,
          `C ${fmtNum(frame.cx)} ${fmtNum(frame.neckStartY)} ${fmtNum(frame.neckRight)} ${fmtNum(frame.neckStartY)} ${fmtNum(frame.neckRight)} ${fmtNum(frame.neckCornerY)}`,
        ]
      : [
          `L ${fmtNum(frame.neckLeft)} ${fmtNum(frame.neckCornerY)}`,
          `L ${fmtNum(frame.cx)} ${fmtNum(frame.neckStartY)}`,
          `L ${fmtNum(frame.neckRight)} ${fmtNum(frame.neckCornerY)}`,
        ];

  const upperBody = [
    ...sleevelessFrontArmholeSilhouetteCommands(frame, "left"),
    ...neckOpening,
    ...sleevelessFrontArmholeSilhouetteCommands(frame, "right"),
  ];
  const silhouette = tapered
    ? [
        polylineD(leftBody),
        ...upperBody,
        ...[...rightBody].reverse().map((p) => `L ${fmtNum(p.x)} ${fmtNum(p.y)}`),
        "Z",
      ].join(" ")
    : [
        `M ${fmtNum(frame.left)} ${fmtNum(frame.bottomY)}`,
        `L ${fmtNum(frame.left)} ${fmtNum(frame.armholeStartY)}`,
        ...upperBody,
        `L ${fmtNum(frame.right)} ${fmtNum(frame.armholeStartY)}`,
        `L ${fmtNum(frame.right)} ${fmtNum(frame.bottomY)}`,
        "Z",
      ].join(" ");

  return [
    `<path data-role="body-outline" class="sleeveless-front-sts-rows__body" d="${silhouette}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    `<path data-role="left-body-path" d="${polylineD(leftBody)}" fill="none" stroke="none"/>`,
    `<path data-role="right-body-path" d="${polylineD(rightBody)}" fill="none" stroke="none"/>`,
    `<path data-role="armhole-outline" data-side="left" d="${polylineD(leftArmhole)}" fill="none" stroke="none"/>`,
    `<path data-role="armhole-outline" data-side="right" d="${polylineD(rightArmhole)}" fill="none" stroke="none"/>`,
    `<path data-role="neckline-outline" d="${necklineD}" fill="none" stroke="none"/>`,
    `<path data-role="shoulder-outline" data-side="left" data-contour="slope" d="${polylineD(leftShoulder)}" fill="none" stroke="none"/>`,
    `<path data-role="shoulder-outline" data-side="right" data-contour="slope" d="${polylineD(rightShoulder)}" fill="none" stroke="none"/>`,
  ].join("");
}

function drawMeasurements(model: SleevelessFrontStsRowsDiagramModel, frame: Frame): string {
  const rpi = model.rows.rowsPerInch;
  const spi = model.widths.stitchesPerInch;
  // Total-length line stays close to the body. Labels stay in the wide left
  // gutter so the larger type remains readable and does not sit on the line.
  const totalArrowX = Math.max(40, frame.left - 24);
  const hemArrowX = Math.max(totalArrowX + 12, frame.left - 10);
  const leftGutterLabelX = 34;
  const hemLineGap = 22;
  const rightArrowX = Math.min(VB_W - 28, frame.right + 22);
  const rightLabelX = Math.min(VB_W - 12, rightArrowX + 22);
  const cardigan = isCardiganFrontModel(model);
  const cardiganV = cardigan && model.neckline.style === "v-neck";
  const cardiganRound = cardigan && model.neckline.style === "round";
  const neckDepthX = cardiganV
    ? Math.max(totalArrowX + 12, frame.left - 14)
    : cardiganRound
      ? Math.max(totalArrowX + 10, frame.left - 16)
      : Math.min(frame.cx - 22, frame.neckLeft - 12);
  const neckDepthLabelX = cardiganV || cardiganRound ? leftGutterLabelX : neckDepthX - 20;
  const neckDepthLabelY = cardiganV
    ? Math.max(52, Math.min((frame.neckCornerY + frame.neckStartY) / 2, frame.shoulderTopY + 36))
    : cardiganRound
      ? (frame.neckCornerY + frame.neckStartY) / 2
      : undefined;
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

  parts.push(
    verticalArrow(
      neckDepthX,
      frame.neckCornerY,
      frame.neckStartY,
      neckDepthLabelX,
      "length-measurement",
      "neck-depth",
      [
        { text: `${model.neckline.depthRows} rows`, extra: ` data-rows="${fmtNum(model.neckline.depthRows)}"` },
        { text: inchesFromRows(model.neckline.depthRows, rpi) },
      ].filter((line) => line.text),
      "middle",
      neckDepthLabelY != null ? { labelY: neckDepthLabelY } : undefined,
    ),
  );

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

  const neckArrowY = cardiganV
    ? frame.shoulderTopY - 12
    : cardiganRound
      ? frame.shoulderTopY - 10
      : Math.min(frame.neckCornerY + 14, frame.neckStartY - 24);
  const neckLabelY = cardiganV
    ? neckArrowY - 20
    : cardiganRound
      ? neckArrowY - 20
      : Math.min(frame.shoulderTopY - 22, neckArrowY - 26);
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

/**
 * Render a Stitches & Rows SVG from the canonical Front diagram model.
 * Callers must pass a supported model; use {@link tryBuildSleevelessFrontStsRowsDiagramSvg}
 * when the model may be null / out of scope.
 */
export function buildSleevelessFrontStsRowsDiagramSvg(
  model: SleevelessFrontStsRowsDiagramModel,
): string {
  const { frame, bands } = buildFrame(model);
  const bindOffEvent = model.armhole.events.find((ev) => ev.kind === "bindOff" && ev.side === "right");
  const decreaseEvents = model.armhole.events.filter((ev) => ev.kind === "decrease" && ev.side === "right");
  const firstDecreaseY =
    decreaseEvents.length > 0 ? yAtRc(decreaseEvents[0]!.garmentRc, bands) : frame.lastArmholeY;

  const cardigan = isCardiganFrontModel(model);
  const parts = [
    cardigan
      ? drawCardiganSilhouette(frame, model.neckline.style, usesAlineBodySilhouette(model))
      : drawSilhouette(frame, model.neckline.style, usesAlineBodySilhouette(model)),
    drawMeasurements(model, frame),
  ];
  if (model.neckline.style === "v-neck") {
    const vX = cardigan ? frame.neckLeft : frame.cx;
    parts.push(
      `<g data-role="v-point" data-x="${fmtNum(vX)}" data-y="${fmtNum(frame.neckStartY)}"></g>`,
    );
  }
  const divideRc = isSleevelessFrontStsRowsVNeckline(model.neckline)
    ? model.neckline.divideGarmentRc
    : model.neckline.startGarmentRc;
  const neckDecreaseCount = isSleevelessFrontStsRowsVNeckline(model.neckline)
    ? model.neckline.innerDecreasePoints.length
    : 0;
  const roundAttrs =
    model.neckline.style === "round"
      ? ` data-round-strategy="${escapeXml(model.neckline.strategy)}" data-center-held="${model.neckline.centerHeld ? "true" : "false"}" data-center-bind-off-sts="${fmtNum(model.neckline.centerBindOffStitches)}"`
      : "";

  const safeBody = parts
    .join("")
    .replace(/\bNaN\b/g, "0")
    .replace(/\bInfinity\b/g, "0")
    .replace(/\bundefined\b/g, "");

  const title = cardigan
    ? model.neckline.style === "round"
      ? "Sleeveless cardigan round-neck left Front stitches and rows"
      : "Sleeveless cardigan V-neck left Front stitches and rows"
    : model.neckline.style === "round"
      ? "Sleeveless pullover round-neck Front stitches and rows"
      : "Sleeveless pullover V-neck Front stitches and rows";
  const desc = `${model.widths.hemStitches} sts cast on. ${model.rows.expectedGarmentRows} rows. Neck ${model.widths.necklineStitches} sts, ${model.neckline.depthRows} rows deep.`;
  const cardiganAttrs = cardigan
    ? ` data-front-piece="leftFront" data-front-band-included="false" data-front-band-treatment="${escapeXml(model.frontBand?.treatment ?? "")}" data-cf-x="${fmtNum(frame.left)}" data-neckline-construction="${escapeXml(model.neckline.construction)}" data-shaping-edge="${model.bodyShaping.edgeScope === "sideSeamOnly" ? "side-seam" : "both-sides"}"`
    : ` data-front-piece="fullFront" data-neckline-construction="${escapeXml(model.neckline.construction)}"`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="sleeveless-front-sts-rows-svg" viewBox="0 0 ${VB_W} ${VB_H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="sleeveless-front-sts-rows-title" data-sleeveless-front-sts-rows-generated="true" data-supported="true" data-piece="${escapeXml(model.piece)}" data-garment-style="${escapeXml(model.garmentStyle)}"${cardiganAttrs} data-body-shape="${escapeXml(model.bodyShape)}" data-neckline-style="${escapeXml(model.neckline.style)}" data-hem-sts="${fmtNum(model.widths.hemStitches)}" data-bust-sts="${fmtNum(model.widths.bustStitches)}" data-after-armhole-sts="${fmtNum(model.widths.stitchesAfterArmhole)}" data-neck-sts="${fmtNum(model.widths.necklineStitches)}" data-shoulder-sts="${fmtNum(model.widths.shoulderStitchesPerSide)}" data-hem-width="${fmtNum(frame.hemWidth)}" data-bust-width="${fmtNum(frame.bodyWidth)}" data-after-armhole-width="${fmtNum(frame.afterWidth)}" data-true-after-width="${fmtNum(frame.trueAfterWidth)}" data-upper-scale="${fmtNum(frame.upperScale)}" data-neck-width="${fmtNum(frame.neckWidth)}" data-shoulder-side-width="${fmtNum(frame.shoulderSideWidth)}" data-px-per-stitch="${fmtNum(frame.pxPerStitch)}" data-cx="${fmtNum(frame.cx)}" data-hem-left="${fmtNum(frame.hemLeft)}" data-hem-right="${fmtNum(frame.hemRight)}" data-bust-left="${fmtNum(frame.left)}" data-bust-right="${fmtNum(frame.right)}" data-after-left="${fmtNum(frame.afterLeft)}" data-after-right="${fmtNum(frame.afterRight)}" data-bo-left="${fmtNum(frame.boLeft)}" data-bo-right="${fmtNum(frame.boRight)}" data-neck-left="${fmtNum(frame.neckLeft)}" data-neck-right="${fmtNum(frame.neckRight)}" data-bottom-y="${fmtNum(frame.bottomY)}" data-hem-y="${fmtNum(frame.hemY)}" data-shape-start-y="${fmtNum(frame.shapeStartY)}" data-shape-end-y="${fmtNum(frame.shapeEndY)}" data-shape-start-rc="${fmtNum(model.bodyShaping.startRc)}" data-shape-end-rc="${fmtNum(model.bodyShaping.endRc)}" data-body-shaping-direction="${escapeXml(model.bodyShaping.direction)}" data-armhole-start-y="${fmtNum(frame.armholeStartY)}" data-last-armhole-y="${fmtNum(frame.lastArmholeY)}" data-first-decrease-y="${fmtNum(firstDecreaseY)}" data-neck-start-y="${fmtNum(frame.neckStartY)}" data-shoulder-y="${fmtNum(frame.shoulderY)}" data-neck-corner-y="${fmtNum(frame.neckCornerY)}" data-shoulder-top-y="${fmtNum(frame.shoulderTopY)}" data-visual-hem-h="${fmtNum(frame.visualHemH)}" data-visual-body-h="${fmtNum(frame.visualBodyH)}" data-visual-armhole-h="${fmtNum(frame.visualArmholeH)}" data-visual-shoulder-h="${fmtNum(frame.visualShoulderH)}" data-visual-neck-h="${fmtNum(frame.visualNeckH)}" data-visual-garment-h="${fmtNum(frame.visualGarmentH)}" data-armhole-start-rc="${fmtNum(model.armhole.startGarmentRc)}" data-last-armhole-rc="${fmtNum(model.armhole.lastGarmentRc)}" data-neck-start-rc="${fmtNum(model.neckline.startGarmentRc)}" data-divide-rc="${fmtNum(divideRc)}" data-shoulder-start-rc="${fmtNum(model.shoulder.startGarmentRc)}" data-hem-rows="${fmtNum(model.rows.hemRows)}" data-body-length-rows="${fmtNum(model.rows.rowsFromCastOnToArmholeStart)}" data-side-seam-rows="${fmtNum(model.rows.sideSeamRowsAboveHem)}" data-armhole-rows="${fmtNum(model.rows.armholeRows)}" data-neck-depth-rows="${fmtNum(model.neckline.depthRows)}" data-total-rows="${fmtNum(model.rows.expectedGarmentRows)}" data-bind-off-sts="${fmtNum(model.armhole.bindOffStsEachSide)}" data-decrease-sts="${fmtNum(model.armhole.decreaseStsEachSide)}" data-shoulder-contour="slope" data-shoulder-point-count="${model.shoulder.points.length}" data-neck-decrease-count="${neckDecreaseCount}" data-bind-off-rc="${fmtNum(bindOffEvent?.garmentRc ?? model.armhole.startGarmentRc)}"${roundAttrs}>`,
    `<title id="sleeveless-front-sts-rows-title">${title}</title>`,
    `<desc>${escapeXml(desc)}</desc>`,
    `<style type="text/css"><![CDATA[text{font-family:${FONT}}]]></style>`,
    `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#fff"/>`,
    safeBody,
    `</svg>`,
  ].join("");
}

/** Supported markup, or `null` so hydration can keep the Illustrator SVG. */
export function tryBuildSleevelessFrontStsRowsDiagramSvg(
  model: SleevelessFrontStsRowsDiagramModel | null | undefined,
): string | null {
  if (!model || !isSupportedModel(model)) return null;
  const svg = buildSleevelessFrontStsRowsDiagramSvg(model);
  if (!svg.includes('data-sleeveless-front-sts-rows-generated="true"')) return null;
  if (!svg.includes('data-supported="true"')) return null;
  return svg;
}

/**
 * Live Stitches & Rows cutover: pullover (straight or A-line) and cardigan
 * (straight or A-line) Front. Builds the model and attempts
 * {@link tryBuildSleevelessFrontStsRowsDiagramSvg}. Returns `null` so
 * screen/print hydration keep the Illustrator SVG.
 */
export function tryBuildLiveSleevelessFrontStsRowsDiagramSvg(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): string | null {
  return tryBuildSleevelessFrontStsRowsDiagramSvg(
    buildSleevelessFrontStsRowsDiagramModel(result, patternData),
  );
}
