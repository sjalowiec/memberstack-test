/**
 * Programmatic shaping-notation hat diagram SVG.
 *
 * Built from the same `HatPatternCalc` used by written instructions and the
 * Stitches & Rows diagram. Not a measurement diagram: no arrows, dimension
 * lines, or finished-size callouts. Construction references are cast-on and
 * row-counter labels beside horizontal section lines, plus crown shaping notation.
 */

import { formatShapingSegment } from "../shapingNotationCompress";
import {
  applyHatCrownCastOnAdjustment,
  buildFourWedgeCrownSetup,
  buildFourWedgeDecreaseSchedule,
  gatheredCrownRemainingStitches,
  hatBrimDisplayLabel,
  resolveHatBrimType,
  type HatBrimType,
  type HatPatternCalc,
} from "./hatMath";
import type {
  HatPatternDiagramFormatters,
  HatPatternDiagramUnit,
} from "./hatPatternDiagramSvg";

/** Stable canvas — do not stretch via CSS to match the Stitches & Rows viewBox. */
const VB_W = 400;
const VB_H = 480;

const STROKE = "#1a1a1a";
const FILL = "#f4f6f1";
const MUTED = "#4b5563";
const FONT = "Poppins, system-ui, Arial, sans-serif";

const FS_SECTION = 18;
const FS_NOTATION = 16;
const FS_SMALL = 14;
const FS_CONSTRUCTION = 13;
const FW_SECTION = 600;
/** Vertical gap between stacked crown notation lines (baseline to baseline). */
const CROWN_NOTATION_GAP = 22;

/** Left gutter reserved so CO/RC labels stay inside the viewBox. */
const LABEL_GUTTER = 72;
const HAT_RIGHT_PAD = 24;
const HAT_LEFT = 108;
const HAT_RIGHT = 312;
const HAT_TOP = 64;
const HAT_BOTTOM = 400;

function escapeXml(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const r = Math.round(n * 100) / 100;
  return String(r);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function textFont(size: number, weight?: number): string {
  const w = weight != null ? ` font-weight="${weight}"` : "";
  return `font-family="${FONT}" font-size="${size}"${w}`;
}

/** User-facing cast-on construction label from finalized calc (e.g. "CO 84 sts"). */
export function formatHatShapingCastOnLabel(stitches: number): string {
  const n = Math.max(0, Math.round(stitches));
  return n > 0 ? `CO ${n} sts` : "";
}

/** User-facing RC construction label (e.g. "RC 60"). Section meaning comes from the diagram. */
export function formatHatShapingRcLabel(rc: number): string {
  const n = Math.max(0, Math.floor(rc));
  return `RC ${n}`;
}

type CrownKind = "gathered" | "wedge" | "spiral";

type ShapingFrame = {
  brimTop: number;
  bodyTop: number;
  crownTop: number;
  hatBottom: number;
  hatLeft: number;
  hatRight: number;
  hatMidX: number;
  hatWidth: number;
  brimVisual: number;
  bodyVisual: number;
  crownVisual: number;
  crownKind: CrownKind;
  brimType: HatBrimType;
};

type ShapingLabels = {
  title: string;
  castOn: string;
  brimEndRc: string;
  crownBeginRc: string;
  brimLabel: string;
  crownLines: string[];
  remaining: string;
};

function resolveCrownKind(crown: string): CrownKind {
  if (crown === "wedge-4" || crown === "wedge-4-decrease") return "wedge";
  if (crown === "spiral") return "spiral";
  return "gathered";
}

function buildShapingLabels(calc: HatPatternCalc): ShapingLabels {
  const crownKind = resolveCrownKind(calc.crown);
  const brimType = resolveHatBrimType(calc.brimType);
  const patternCastOn = applyHatCrownCastOnAdjustment(calc.castOnSts, calc.crown);
  const castOn = formatHatShapingCastOnLabel(patternCastOn);
  const brimEndRc = formatHatShapingRcLabel(calc.brimRows);
  const crownBeginRow = calc.brimRows + calc.bodyRows;
  const crownBeginRc = formatHatShapingRcLabel(crownBeginRow);

  const fourWedge =
    calc.fourWedgeCrownSetup ??
    buildFourWedgeCrownSetup({
      castOnSts: calc.castOnSts,
      crown: calc.crown,
      brimRows: calc.brimRows,
      bodyRows: calc.bodyRows,
    });

  const crownLines: string[] = [];
  let remaining = "";
  let title = "Hat shaping notation diagram";

  if (crownKind === "gathered") {
    title = "Gathered hat shaping notation diagram";
    const remainingStitches = gatheredCrownRemainingStitches(patternCastOn);
    const crownRows = Math.max(0, Math.floor(calc.crownRowCount));
    // Post-transfer count · crown rows · gather (never show cast-on in the crown).
    crownLines.push(`${remainingStitches} sts`);
    crownLines.push(`Knit ${crownRows} rows`);
    crownLines.push("Gather");
  } else if (crownKind === "wedge" && fourWedge) {
    title = "Four-gore hat shaping notation diagram";
    const schedule = buildFourWedgeDecreaseSchedule(
      fourWedge.wedgeStitchCount,
      calc.crownRowCount,
    );
    crownLines.push(`4× ${fourWedge.wedgeStitchCount} sts`);
    if (schedule.decreaseCount > 0) {
      crownLines.push(
        `${formatShapingSegment(1, schedule.rowFrequency, schedule.decreaseCount)} ea edge`,
      );
    }
    remaining = `${schedule.remainingStitchesTotal} sts`;
  } else if (crownKind === "spiral") {
    title = "Swirl-top hat shaping notation diagram";
    const spiral = calc.crownPlan.spiral;
    if (spiral) {
      crownLines.push(`${spiral.decreasePoints} pts`);
      if (spiral.gradual > 0) {
        crownLines.push(
          formatShapingSegment(spiral.decreasePoints, 2, spiral.gradual),
        );
      }
      if (spiral.rapid > 0) {
        crownLines.push(
          formatShapingSegment(spiral.decreasePoints, 1, spiral.rapid),
        );
      }
      remaining = `${spiral.targetStitches} sts`;
    }
  }

  return {
    title,
    castOn,
    brimEndRc,
    crownBeginRc,
    brimLabel: hatBrimDisplayLabel(brimType),
    crownLines,
    remaining,
  };
}

function buildShapingFrame(calc: HatPatternCalc): ShapingFrame {
  const crownKind = resolveCrownKind(calc.crown);
  const brimType = resolveHatBrimType(calc.brimType);
  const usable = HAT_BOTTOM - HAT_TOP;
  const brimIn = Math.max(0.25, calc.brimDepth || 0.25);
  const bodyIn = Math.max(0.25, calc.bodyHeightInches || 0.25);
  const crownIn =
    crownKind === "gathered"
      ? Math.max(0.85, calc.crownHeightInches || 0.85)
      : Math.max(0.5, calc.crownHeightInches || 0.5);

  const rawTotal = brimIn + bodyIn + crownIn;
  let brimVisual = (brimIn / rawTotal) * usable;
  let bodyVisual = (bodyIn / rawTotal) * usable;
  let crownVisual = (crownIn / rawTotal) * usable;

  brimVisual = clamp(brimVisual, 40, 120);
  bodyVisual = clamp(bodyVisual, 56, 180);
  // Gathered needs room for Crown heading + 3 notation lines without overlap.
  crownVisual = clamp(
    crownVisual,
    crownKind === "gathered" ? 100 : crownKind === "spiral" ? 88 : 72,
    150,
  );

  let sum = brimVisual + bodyVisual + crownVisual;
  if (sum > usable) {
    const scale = usable / sum;
    brimVisual *= scale;
    bodyVisual *= scale;
    crownVisual *= scale;
  } else if (sum < usable * 0.85) {
    bodyVisual += usable * 0.85 - sum;
  }

  const hatBottom = HAT_BOTTOM;
  const brimTop = hatBottom - brimVisual;
  const bodyTop = brimTop - bodyVisual;
  const crownTop = bodyTop - crownVisual;

  const REF_CIRC_INCHES = 20.5;
  const circ = Number(calc.targetWidth);
  const widthScale =
    circ > 0 && Number.isFinite(circ) ? clamp(circ / REF_CIRC_INCHES, 0.55, 1.35) : 1;
  const maxHatWidth = VB_W - LABEL_GUTTER - HAT_RIGHT_PAD;
  const hatWidth = Math.min((HAT_RIGHT - HAT_LEFT) * widthScale, maxHatWidth);
  const hatMidX = LABEL_GUTTER + hatWidth / 2 + (maxHatWidth - hatWidth) / 2;
  const hatLeft = hatMidX - hatWidth / 2;
  const hatRight = hatMidX + hatWidth / 2;

  return {
    brimTop,
    bodyTop,
    crownTop,
    hatBottom,
    hatLeft,
    hatRight,
    hatMidX,
    hatWidth,
    brimVisual,
    bodyVisual,
    crownVisual,
    crownKind,
    brimType,
  };
}

/** Stack crown shaping lines with fixed baseline spacing; returns SVG text nodes. */
function drawNotationStack(
  lines: string[],
  midX: number,
  firstBaselineY: number,
  gap = CROWN_NOTATION_GAP,
  fontSize = FS_NOTATION,
): string {
  return lines
    .map((line, i) => {
      const y = firstBaselineY + i * gap;
      return `<text x="${fmtNum(midX)}" y="${fmtNum(y)}" text-anchor="middle" fill="${MUTED}" ${textFont(fontSize)}>${escapeXml(line)}</text>`;
    })
    .join("");
}

function drawBrim(frame: ShapingFrame, labels: ShapingLabels): string {
  const { hatLeft, hatRight, brimTop, hatBottom, brimType, hatWidth, hatMidX } = frame;
  const parts: string[] = [
    `<rect class="hat-shaping-diagram__brim" data-brim-style="${brimType}" x="${fmtNum(hatLeft)}" y="${fmtNum(brimTop)}" width="${fmtNum(hatWidth)}" height="${fmtNum(hatBottom - brimTop)}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
  ];

  if (brimType === "folded") {
    const foldY = brimTop + (hatBottom - brimTop) / 2;
    parts.push(
      `<line class="hat-shaping-diagram__brim-fold" x1="${fmtNum(hatLeft)}" y1="${fmtNum(foldY)}" x2="${fmtNum(hatRight)}" y2="${fmtNum(foldY)}" stroke="${STROKE}" stroke-width="1.2" stroke-dasharray="5 4" fill="none"/>`,
    );
    parts.push(
      `<text x="${fmtNum(hatMidX)}" y="${fmtNum(foldY - 9)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_SMALL)}>fold</text>`,
    );
  } else if (brimType === "rolled") {
    const curlY = hatBottom - 7;
    parts.push(
      `<path class="hat-shaping-diagram__brim-roll" d="M ${fmtNum(hatLeft + 10)} ${fmtNum(curlY)} Q ${fmtNum(hatMidX)} ${fmtNum(curlY + 9)} ${fmtNum(hatRight - 10)} ${fmtNum(curlY)}" fill="none" stroke="${STROKE}" stroke-width="1.1" opacity="0.55"/>`,
    );
  }

  const midY = (brimTop + hatBottom) / 2 + (brimType === "folded" ? 10 : 0);
  parts.push(
    `<text x="${fmtNum(hatMidX)}" y="${fmtNum(midY)}" text-anchor="middle" dominant-baseline="middle" fill="${STROKE}" ${textFont(FS_SECTION, FW_SECTION)}>${escapeXml(labels.brimLabel)}</text>`,
  );
  return parts.join("");
}

function drawBody(frame: ShapingFrame): string {
  const { hatLeft, bodyTop, brimTop, hatMidX, hatWidth } = frame;
  const midY = (bodyTop + brimTop) / 2;
  return [
    `<rect class="hat-shaping-diagram__body" x="${fmtNum(hatLeft)}" y="${fmtNum(bodyTop)}" width="${fmtNum(hatWidth)}" height="${fmtNum(brimTop - bodyTop)}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
    `<text x="${fmtNum(hatMidX)}" y="${fmtNum(midY)}" text-anchor="middle" dominant-baseline="middle" fill="${STROKE}" ${textFont(FS_SECTION, FW_SECTION)}>Body</text>`,
  ].join("");
}

function drawGatheredCrown(frame: ShapingFrame, labels: ShapingLabels): string {
  const { hatLeft, hatRight, crownTop, bodyTop, hatMidX } = frame;
  const tipY = crownTop + 8;
  const midY = crownTop + (bodyTop - crownTop) * 0.4;
  const path = [
    `M ${fmtNum(hatLeft)} ${fmtNum(bodyTop)}`,
    `L ${fmtNum(hatRight)} ${fmtNum(bodyTop)}`,
    `Q ${fmtNum(hatRight - 16)} ${fmtNum(midY)} ${fmtNum(hatMidX + 24)} ${fmtNum(tipY + 8)}`,
    `Q ${fmtNum(hatMidX)} ${fmtNum(tipY - 2)} ${fmtNum(hatMidX - 24)} ${fmtNum(tipY + 8)}`,
    `Q ${fmtNum(hatLeft + 16)} ${fmtNum(midY)} ${fmtNum(hatLeft)} ${fmtNum(bodyTop)}`,
    "Z",
  ].join(" ");

  const headingY = Math.max(22, crownTop - 10);
  const stackCount = labels.crownLines.length;
  const stackHeight = stackCount > 0 ? (stackCount - 1) * CROWN_NOTATION_GAP : 0;
  // Center the notation stack in the lower 2/3 of the crown, clear of the heading.
  const stackTopMin = headingY + FS_SECTION + 10;
  const stackBottomMax = bodyTop - 14;
  const available = Math.max(stackHeight, stackBottomMax - stackTopMin);
  const firstBaseline = clamp(
    stackTopMin + (available - stackHeight) / 2,
    stackTopMin,
    Math.max(stackTopMin, stackBottomMax - stackHeight),
  );

  return [
    `<g class="hat-shaping-diagram__crown hat-shaping-diagram__crown--gathered" data-crown-style="gathered">`,
    `<path d="${path}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
    `<text x="${fmtNum(hatMidX)}" y="${fmtNum(headingY)}" text-anchor="middle" fill="${STROKE}" ${textFont(FS_SECTION, FW_SECTION)}>Crown</text>`,
    drawNotationStack(labels.crownLines, hatMidX, firstBaseline),
    `</g>`,
  ].join("");
}

function drawFourGoreCrown(frame: ShapingFrame, labels: ShapingLabels): string {
  const { hatLeft, hatRight, crownTop, bodyTop, hatMidX, hatWidth } = frame;
  const tipY = crownTop + 8;
  const valleyY = bodyTop - 4;
  const peaks = 4;
  const pts: string[] = [`${fmtNum(hatLeft)},${fmtNum(bodyTop)}`];
  for (let i = 0; i < peaks; i += 1) {
    const left = hatLeft + (hatWidth * i) / peaks;
    const right = hatLeft + (hatWidth * (i + 1)) / peaks;
    const mid = (left + right) / 2;
    pts.push(`${fmtNum(mid)},${fmtNum(tipY)}`);
    pts.push(`${fmtNum(right)},${fmtNum(i === peaks - 1 ? bodyTop : valleyY)}`);
  }

  const goreLabels = [1, 2, 3, 4]
    .map((n) => {
      const left = hatLeft + (hatWidth * (n - 1)) / peaks;
      const right = hatLeft + (hatWidth * n) / peaks;
      const x = (left + right) / 2;
      return `<text x="${fmtNum(x)}" y="${fmtNum(tipY + (bodyTop - tipY) * 0.55)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_SMALL)}>#${n}</text>`;
    })
    .join("");

  const stackCount = labels.crownLines.length;
  const stackHeight = stackCount > 0 ? (stackCount - 1) * CROWN_NOTATION_GAP : 0;
  // Keep notation above the peaks but fully inside the viewBox.
  const firstBaseline = Math.max(
    20,
    crownTop - 14 - stackHeight,
  );

  const remainingY = bodyTop + 18;

  return [
    `<g class="hat-shaping-diagram__crown hat-shaping-diagram__crown--four-gore" data-crown-style="wedge-4-decrease">`,
    `<polyline points="${pts.join(" ")}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
    `<line class="hat-shaping-diagram__crown-start" x1="${fmtNum(hatLeft)}" y1="${fmtNum(bodyTop)}" x2="${fmtNum(hatRight)}" y2="${fmtNum(bodyTop)}" stroke="${STROKE}" stroke-width="1.25" stroke-dasharray="6 4" fill="none"/>`,
    goreLabels,
    drawNotationStack(labels.crownLines, hatMidX, firstBaseline),
    labels.remaining
      ? `<text x="${fmtNum(hatMidX)}" y="${fmtNum(remainingY)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_SMALL)}>→ ${escapeXml(labels.remaining)}</text>`
      : "",
    `</g>`,
  ].join("");
}

function drawSwirlCrown(frame: ShapingFrame, labels: ShapingLabels): string {
  const { hatLeft, hatRight, crownTop, bodyTop, hatMidX, hatWidth } = frame;
  const tipY = crownTop + 10;
  const outline = [
    `M ${fmtNum(hatLeft)} ${fmtNum(bodyTop)}`,
    `L ${fmtNum(hatRight)} ${fmtNum(bodyTop)}`,
    `Q ${fmtNum(hatRight - 10)} ${fmtNum((bodyTop + tipY) / 2)} ${fmtNum(hatMidX + 10)} ${fmtNum(tipY)}`,
    `Q ${fmtNum(hatMidX)} ${fmtNum(tipY - 4)} ${fmtNum(hatMidX - 10)} ${fmtNum(tipY)}`,
    `Q ${fmtNum(hatLeft + 10)} ${fmtNum((bodyTop + tipY) / 2)} ${fmtNum(hatLeft)} ${fmtNum(bodyTop)}`,
    "Z",
  ].join(" ");

  const swirlLines = Array.from({ length: 6 }, (_, i) => {
    const t = (i + 0.5) / 6;
    const x0 = hatLeft + hatWidth * t;
    const sweep = ((i % 2 === 0 ? 1 : -1) * hatWidth) / 10;
    const cx = clamp(x0 + sweep, hatLeft + 8, hatRight - 8);
    return `<path d="M ${fmtNum(x0)} ${fmtNum(bodyTop)} Q ${fmtNum(cx)} ${fmtNum((bodyTop + tipY) / 2)} ${fmtNum(hatMidX)} ${fmtNum(tipY)}" fill="none" stroke="${STROKE}" stroke-width="1" opacity="0.65"/>`;
  }).join("");

  const headingY = Math.max(22, crownTop - 8);
  const stackLines = labels.remaining
    ? [...labels.crownLines, `→ ${labels.remaining}`]
    : labels.crownLines;
  const stackHeight = stackLines.length > 0 ? (stackLines.length - 1) * CROWN_NOTATION_GAP : 0;
  const stackTopMin = headingY + FS_SECTION + 8;
  const stackBottomMax = bodyTop - 12;
  const available = Math.max(stackHeight, stackBottomMax - stackTopMin);
  const firstBaseline = clamp(
    stackTopMin + (available - stackHeight) / 2,
    stackTopMin,
    Math.max(stackTopMin, stackBottomMax - stackHeight),
  );

  return [
    `<g class="hat-shaping-diagram__crown hat-shaping-diagram__crown--swirl" data-crown-style="spiral">`,
    `<path d="${outline}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
    swirlLines,
    `<line class="hat-shaping-diagram__crown-start" x1="${fmtNum(hatLeft)}" y1="${fmtNum(bodyTop)}" x2="${fmtNum(hatRight)}" y2="${fmtNum(bodyTop)}" stroke="${STROKE}" stroke-width="1.25" stroke-dasharray="6 4" fill="none"/>`,
    `<text x="${fmtNum(hatMidX)}" y="${fmtNum(headingY)}" text-anchor="middle" fill="${STROKE}" ${textFont(FS_SECTION, FW_SECTION)}>Crown · Swirl</text>`,
    drawNotationStack(stackLines, hatMidX, firstBaseline),
    `</g>`,
  ].join("");
}

function drawCrown(frame: ShapingFrame, labels: ShapingLabels): string {
  if (frame.crownKind === "wedge") return drawFourGoreCrown(frame, labels);
  if (frame.crownKind === "spiral") return drawSwirlCrown(frame, labels);
  return drawGatheredCrown(frame, labels);
}

/**
 * Cast-on + section RC labels beside horizontal construction lines (no arrows/dimensions).
 * Short "RC n" labels sit in the left gutter so they stay inside the viewBox when scaled.
 */
function drawConstructionLabels(frame: ShapingFrame, labels: ShapingLabels): string {
  const labelX = Math.max(8, frame.hatLeft - 10);
  const parts: string[] = [
    `<g class="hat-shaping-diagram__construction-labels" data-hat-shaping-construction-labels="true">`,
  ];

  if (labels.castOn) {
    parts.push(
      `<text class="hat-shaping-diagram__cast-on" x="${fmtNum(labelX)}" y="${fmtNum(frame.hatBottom)}" text-anchor="end" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_CONSTRUCTION)}>${escapeXml(labels.castOn)}</text>`,
    );
  }
  if (labels.brimEndRc) {
    parts.push(
      `<text class="hat-shaping-diagram__brim-body-rc" x="${fmtNum(labelX)}" y="${fmtNum(frame.brimTop)}" text-anchor="end" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_CONSTRUCTION)}>${escapeXml(labels.brimEndRc)}</text>`,
    );
  }
  if (labels.crownBeginRc) {
    parts.push(
      `<text class="hat-shaping-diagram__crown-begin-rc" x="${fmtNum(labelX)}" y="${fmtNum(frame.bodyTop)}" text-anchor="end" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_CONSTRUCTION)}>${escapeXml(labels.crownBeginRc)}</text>`,
    );
  }

  parts.push(`</g>`);
  return parts.join("");
}

/**
 * Build a responsive shaping-notation SVG from the finalized hat calc.
 * Crown shaping tokens reuse shared formatters (`Ns-Mr-Kx`).
 */
export function buildHatShapingNotationDiagramSvg(
  calc: HatPatternCalc,
  _unit: HatPatternDiagramUnit,
  _formatters: HatPatternDiagramFormatters,
): string {
  const frame = buildShapingFrame(calc);
  const labels = buildShapingLabels(calc);
  const crownAttr =
    frame.crownKind === "wedge"
      ? "wedge-4-decrease"
      : frame.crownKind === "spiral"
        ? "spiral"
        : "gathered";

  const body = [
    drawBrim(frame, labels),
    drawBody(frame),
    drawCrown(frame, labels),
    drawConstructionLabels(frame, labels),
  ].join("");

  const safeBody = body
    .replace(/\bNaN\b/g, "0")
    .replace(/\bInfinity\b/g, "0")
    .replace(/\bundefined\b/g, "");

  const desc = `Shaping-notation schematic for a hat with ${labels.brimLabel.toLowerCase()} and ${crownAttr} crown. ${labels.castOn}. ${labels.brimEndRc}. ${labels.crownBeginRc}.`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="hat-shaping-notation-diagram-svg" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-labelledby="hat-shaping-diagram-title" data-hat-shaping-diagram="true" data-crown="${crownAttr}" data-brim="${frame.brimType}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet">`,
    `<title id="hat-shaping-diagram-title">${escapeXml(labels.title)}</title>`,
    `<desc>${escapeXml(desc)}</desc>`,
    `<style type="text/css"><![CDATA[text{font-family:${FONT}}]]></style>`,
    `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#fff"/>`,
    safeBody,
    `</svg>`,
  ].join("");
}

/** Exported for tests — stable viewBox dimensions. */
export const HAT_SHAPING_NOTATION_VIEWBOX = { width: VB_W, height: VB_H } as const;
