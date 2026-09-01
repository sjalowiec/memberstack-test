/**
 * Canonical Basic Socks Pattern diagram geometry and overlay anchors.
 *
 * Visual source of truth: public/images/patterns/socks/socks-summary.svg
 * Loads that SVG as-is. Sock 2 is a horizontal mirror. Cuff-to-Toe is a
 * vertical flip so knitting order reads bottom-up (cuff at the bottom).
 * Toe-Up keeps the file orientation (toe at the bottom). Does not generate
 * sock construction paths, scale the outline from measurements, or recalculate math.
 */
import canonicalSvgRaw from "../../../../public/images/patterns/socks/socks-summary.svg?raw";
import { formatSockMeasurementDisplay } from "./sockBuilderUnits";
import type { BasicSockCalc } from "./sockMath";
import type { SockNeedleHalf } from "./sockInstructionModel";

export const SOCK_CANONICAL_SVG_HREF = "/images/patterns/socks/socks-summary.svg";
export const SOCK_CANONICAL_POLYGON_POINTS =
  "276 472 148 472 180 448 148 424 12 424 12 264 148 264 180 240 148 216 12 216 12 8 276 8 276 216 244 240 276 264 276 424 244 448 276 472";

export const SOCK_CANONICAL_VB_W = 284;
export const SOCK_CANONICAL_VB_H = 480;
const PAD_LEFT = 18;
const PAD_RIGHT = 72;
const PAD_TOP = 22;
const PAD_BOTTOM = 18;

/** Extra right gutter so Stitches & Rows RC milestone labels are not clipped. */
export const SOCK_STS_ROWS_PAD_RIGHT = 136;

/** Screen-left X for the shared bottom→top reading arrow (viewBox space, not mirrored). */
const READING_ARROW_X = -8;
const READING_ARROW_INSET = 16;
const READING_ARROW_HEAD = 5;
const READING_ARROW_STROKE = "#6b7280";

export function sockCanonicalViewBox(padRight?: number): string {
  const right = padRight ?? PAD_RIGHT;
  return `${-PAD_LEFT} ${-PAD_TOP} ${SOCK_CANONICAL_VB_W + PAD_LEFT + right} ${SOCK_CANONICAL_VB_H + PAD_TOP + PAD_BOTTOM}`;
}

export const SOCK_CANONICAL_VIEWBOX = sockCanonicalViewBox();

/**
 * Bottom→top reading arrow in viewBox space.
 * Same direction for Cuff-to-Toe and Toe-Up; not flipped with sock geometry.
 */
export function sockCanonicalReadingDirectionArrowMarkup(): string {
  const x = READING_ARROW_X;
  const top = READING_ARROW_INSET;
  const bot = SOCK_CANONICAL_VB_H - READING_ARROW_INSET;
  const s = READING_ARROW_HEAD;
  return (
    `<g data-sock-reading-direction="bottom-to-top">` +
    `<line x1="${fmtSockSvg(x)}" y1="${fmtSockSvg(bot)}" x2="${fmtSockSvg(x)}" y2="${fmtSockSvg(top)}" ` +
    `stroke="${READING_ARROW_STROKE}" stroke-width="1.2" fill="none"/>` +
    `<polygon points="${fmtSockSvg(x)},${fmtSockSvg(top)} ${fmtSockSvg(x - s)},${fmtSockSvg(top + s * 1.6)} ${fmtSockSvg(x + s)},${fmtSockSvg(top + s * 1.6)}" fill="${READING_ARROW_STROKE}"/>` +
    `</g>`
  );
}

/**
 * Overlay anchors in canonical viewBox units (see #sock-canonical-anchors).
 * Hourglass values sit inside the shaping diamonds (cx 212), not in the hold pocket.
 * Right-side measure anchors stay on screen-right and are not mirrored.
 */
export const SOCK_CANONICAL_ANCHORS = {
  cuff: { x: 144, y: 26 },
  tube: { x: 144, y: 186 },
  sectionLeg: { x: 144, y: 90 },
  sectionAnkle: { x: 144, y: 200 },
  sectionHeel: { x: 212, y: 224 },
  sectionFoot: { x: 144, y: 344 },
  sectionToe: { x: 212, y: 432 },
  heelWork: { x: 212, y: 236 },
  heelCenter: { x: 212, y: 250 },
  toeWork: { x: 212, y: 444 },
  toeCenter: { x: 212, y: 458 },
  measureLeg: { x: 286, y: 90 },
  measureAnkle: { x: 286, y: 200 },
  measureHeel: { x: 286, y: 240 },
  measureFoot: { x: 286, y: 344 },
  measureToe: { x: 286, y: 448 },
  castOnCuff: { x: 144, y: -6 },
  castOnToe: { x: 144, y: 492 },
  direction: { x: 144, y: -8 },
} as const;

const FIXED_RIGHT_MEASURE_IDS = new Set<SockCanonicalAnchorId>([
  "measureLeg",
  "measureAnkle",
  "measureHeel",
  "measureFoot",
  "measureToe",
]);

export type SockCanonicalAnchorId = keyof typeof SOCK_CANONICAL_ANCHORS;

export type SockCanonicalDiagramFrame = {
  viewBox: string;
  viewBoxWidth: number;
  viewBoxHeight: number;
  mirror: boolean;
  flipVertical: boolean;
  workHalf: SockNeedleHalf;
  geometrySrc: typeof SOCK_CANONICAL_SVG_HREF;
  geometryKey: "socks-summary";
};

export function sockCanonicalFlipVertical(
  constructionDirection: BasicSockCalc["constructionDirection"],
): boolean {
  return constructionDirection === "cuff-to-toe";
}

export function sockCanonicalMapY(y: number, flipVertical: boolean): number {
  return flipVertical ? SOCK_CANONICAL_VB_H - y : y;
}

export function sockCanonicalInnerMarkup(raw: string = canonicalSvgRaw): string {
  return String(raw ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/<\?xml[^?]*\?>\s*/i, "")
    .replace(/^<svg\b[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();
}

export function sockCanonicalGeometryMarkup(options?: {
  mirror?: boolean;
  flipVertical?: boolean;
}): string {
  const inner = sockCanonicalInnerMarkup();
  const mirror = options?.mirror === true;
  const flipVertical = options?.flipVertical === true;
  const sx = mirror ? -1 : 1;
  const sy = flipVertical ? -1 : 1;
  const tx = mirror ? SOCK_CANONICAL_VB_W : 0;
  const ty = flipVertical ? SOCK_CANONICAL_VB_H : 0;
  const transform =
    mirror || flipVertical ? ` transform="translate(${tx},${ty}) scale(${sx},${sy})"` : "";
  return (
    `<g data-sock-canonical-geometry data-sock-mirror="${mirror ? "true" : "false"}" ` +
    `data-sock-flip-vertical="${flipVertical ? "true" : "false"}"${transform}>` +
    inner +
    `</g>`
  );
}

export function sockCanonicalDiagramFrame(options?: {
  mirror?: boolean;
  flipVertical?: boolean;
  padRight?: number;
}): SockCanonicalDiagramFrame {
  const mirror = options?.mirror === true;
  const flipVertical = options?.flipVertical === true;
  return {
    viewBox: sockCanonicalViewBox(options?.padRight),
    viewBoxWidth: SOCK_CANONICAL_VB_W,
    viewBoxHeight: SOCK_CANONICAL_VB_H,
    mirror,
    flipVertical,
    workHalf: mirror ? "left" : "right",
    geometrySrc: SOCK_CANONICAL_SVG_HREF,
    geometryKey: "socks-summary",
  };
}

export function sockCanonicalLabelPoint(
  id: SockCanonicalAnchorId,
  mirror: boolean,
  flipVertical = false,
): { x: number; y: number } {
  const anchor = SOCK_CANONICAL_ANCHORS[id];
  const x = !mirror || FIXED_RIGHT_MEASURE_IDS.has(id) ? anchor.x : SOCK_CANONICAL_VB_W - anchor.x;
  return { x, y: sockCanonicalMapY(anchor.y, flipVertical) };
}

export function sockCanonicalTextAnchor(
  anchor: "start" | "middle" | "end",
  mirror: boolean,
): "start" | "middle" | "end" {
  if (!mirror || anchor === "middle") return anchor;
  return anchor === "start" ? "end" : "start";
}

const FONT = "Poppins, system-ui, Arial, sans-serif";
const STROKE = "#1a1a1a";

export function sockCanonicalText(options: {
  id: string;
  x: number;
  y: number;
  text: string;
  size?: number;
  weight?: string;
  anchor?: "start" | "middle" | "end";
  fill?: string;
}): string {
  const text = String(options.text ?? "");
  if (!text) return "";
  const size = options.size ?? 11;
  const weight = options.weight ?? "600";
  const anchor = options.anchor ?? "middle";
  const fill = options.fill ?? STROKE;
  return (
    `<text data-sock-label="${escapeSockSvgText(options.id)}" x="${fmtSockSvg(options.x)}" y="${fmtSockSvg(options.y)}" ` +
    `text-anchor="${anchor}" dominant-baseline="middle" fill="${fill}" font-family="${FONT}" font-size="${size}" font-weight="${weight}">` +
    `${escapeSockSvgText(text)}</text>`
  );
}

export function sockCanonicalStacked(options: {
  id: string;
  x: number;
  y: number;
  lines: string[];
  size?: number;
  weight?: string;
  anchor?: "start" | "middle" | "end";
  fill?: string;
}): string {
  const size = options.size ?? 11;
  const usable = options.lines.filter((line) => line.length > 0);
  if (!usable.length) return "";
  const startY = options.y - ((usable.length - 1) * (size + 2)) / 2;
  return usable
    .map((line, index) =>
      sockCanonicalText({
        ...options,
        id: usable.length === 1 ? options.id : `${options.id}-${index}`,
        y: startY + index * (size + 2),
        text: line,
        size,
      }),
    )
    .join("");
}

function stitchLabel(n: number): string {
  const sts = Math.max(0, Math.round(n));
  return sts === 1 ? "1 st" : `${sts} sts`;
}

function inchLabel(inches: number): string {
  const n = formatSockMeasurementDisplay(inches, "inches");
  return n ? `${n}"` : "";
}

/** Calc fields used as diagram labels only — never to rebuild the outline. */
export function sockCanonicalCalcLabelFields(calc: BasicSockCalc): {
  cuffStitches: number;
  tubeStitches: number;
  upperLegRows: number;
  ankleRows: number;
  footRows: number;
  heelWorkingStitches: number;
  heelHeldStitches: number;
  heelRemainingStitches: number;
  heelShortRow: number;
  toeWorkingStitches: number;
  toeHeldStitches: number;
  toeRemainingStitches: number;
  toeShortRow: number;
  upperLegInches: number;
  ankleInches: number;
  heelInches: number;
  footInches: number;
  toeInches: number;
  cuffStsLabel: string;
  tubeStsLabel: string;
  heelWorkLabel: string;
  heelCenterLabel: string;
  toeWorkLabel: string;
  toeCenterLabel: string;
  measureLeg: string[];
  measureAnkle: string[];
  measureHeel: string[];
  measureFoot: string[];
  measureToe: string[];
} {
  const upperLegInches = Math.max(0, calc.legLengthInches - calc.ankleStraightLengthInches);
  const upperLegRows = Math.max(0, calc.legShapingRowsAvailable);
  const ankleRows = Math.max(0, calc.ankleStraightRows);
  const footRows = Math.max(0, calc.straightFootRows);
  const heelShortRow = calc.heel.shortRowKnittingRows;
  const toeShortRow = calc.toe.shortRowKnittingRows;
  return {
    cuffStitches: calc.legStitches,
    tubeStitches: calc.totalSockStitches,
    upperLegRows,
    ankleRows,
    footRows,
    heelWorkingStitches: calc.heel.workingStitches,
    heelHeldStitches: calc.heel.heldStitches,
    heelRemainingStitches: calc.heel.remainingStitches,
    heelShortRow,
    toeWorkingStitches: calc.toe.workingStitches,
    toeHeldStitches: calc.toe.heldStitches,
    toeRemainingStitches: calc.toe.remainingStitches,
    toeShortRow,
    upperLegInches,
    ankleInches: calc.ankleStraightLengthInches,
    heelInches: calc.heelDepthInches,
    footInches: calc.straightFootLengthInches,
    toeInches: calc.toeDepthInches,
    cuffStsLabel: stitchLabel(calc.legStitches),
    tubeStsLabel: stitchLabel(calc.totalSockStitches),
    heelWorkLabel: stitchLabel(calc.heel.workingStitches),
    heelCenterLabel: stitchLabel(calc.heel.remainingStitches),
    toeWorkLabel: stitchLabel(calc.toe.workingStitches),
    toeCenterLabel: stitchLabel(calc.toe.remainingStitches),
    measureLeg: [inchLabel(upperLegInches)],
    measureAnkle: [inchLabel(calc.ankleStraightLengthInches)],
    measureHeel: [inchLabel(calc.heelDepthInches)],
    measureFoot: [inchLabel(calc.straightFootLengthInches)],
    measureToe: [inchLabel(calc.toeDepthInches)],
  };
}

export function escapeSockSvgText(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmtSockSvg(n: number): string {
  return String(Math.round(n * 10) / 10);
}
