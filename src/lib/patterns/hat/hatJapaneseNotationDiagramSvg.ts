/**
 * Programmatic Japanese-notation hat diagram SVG.
 *
 * Built from the same `HatPatternCalc` used by written instructions and the
 * Stitches & Rows diagram. Does not use static hat SVG templates or sweater
 * diagram geometry.
 */

import {
  formatBodyRowsNotation,
  formatCastOnNotation,
} from "../sleevelessBackJapaneseNotation";
import { formatShapingSegment } from "../shapingNotationCompress";
import {
  applyHatCrownCastOnAdjustment,
  buildFourWedgeCrownSetup,
  buildFourWedgeDecreaseSchedule,
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
const VB_H = 520;

const ARROW = "#52682d";
const STROKE = "#1a1a1a";
const FILL = "#f4f6f1";
const MUTED = "#4b5563";
const FONT = "Poppins, system-ui, Arial, sans-serif";

const FS_SECTION = 18;
const FS_NOTATION = 17;
const FS_MEASURE = 15;
const FS_SMALL = 14;
const FW_SECTION = 600;

const HAT_LEFT = 88;
const HAT_RIGHT = 292;
const HAT_TOP = 48;
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

function displayLength(
  inches: number,
  unit: HatPatternDiagramUnit,
  formatters: HatPatternDiagramFormatters,
): string {
  const { convertLength, formatLengthWithUnit } = formatters;
  const value =
    unit === "inches" ? inches : convertLength(inches, "inches", unit);
  return formatLengthWithUnit(value, unit);
}

type CrownKind = "gathered" | "wedge" | "spiral";

type JpFrame = {
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

type JpLabels = {
  title: string;
  castOn: string;
  circumference: string;
  totalLength: string;
  brimRows: string;
  brimDepth: string;
  brimLabel: string;
  bodyRows: string;
  bodyHeight: string;
  crownRows: string;
  crownDepth: string;
  crownStart: string;
  crownLines: string[];
  remaining: string;
};

function resolveCrownKind(crown: string): CrownKind {
  if (crown === "wedge-4" || crown === "wedge-4-decrease") return "wedge";
  if (crown === "spiral") return "spiral";
  return "gathered";
}

function buildJpLabels(
  calc: HatPatternCalc,
  unit: HatPatternDiagramUnit,
  formatters: HatPatternDiagramFormatters,
): JpLabels {
  const crownKind = resolveCrownKind(calc.crown);
  const brimType = resolveHatBrimType(calc.brimType);
  const patternCastOn = applyHatCrownCastOnAdjustment(calc.castOnSts, calc.crown);
  const castOn = formatCastOnNotation(patternCastOn);
  const brimRows = formatBodyRowsNotation(calc.brimRows);
  const bodyRows = formatBodyRowsNotation(calc.bodyRows);
  const crownRows =
    crownKind === "gathered" ? "" : formatBodyRowsNotation(calc.crownRowCount);

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
  let title = "Hat Japanese notation diagram";

  if (crownKind === "gathered") {
    title = "Gathered hat Japanese notation diagram";
    // Schematic labels (not invented symbols): every-other transfer, then gather.
    crownLines.push("EO xfer");
    crownLines.push("gather");
    remaining = `${patternCastOn} sts`;
  } else if (crownKind === "wedge" && fourWedge) {
    title = "Four-gore hat Japanese notation diagram";
    const schedule = buildFourWedgeDecreaseSchedule(
      fourWedge.wedgeStitchCount,
      calc.crownRowCount,
    );
    crownLines.push(`4× ${fourWedge.wedgeStitchCount} sts`);
    if (schedule.decreaseCount > 0) {
      // Per-edge decrease: 1 stitch each edge, shared frequency from instructions.
      crownLines.push(
        `${formatShapingSegment(1, schedule.rowFrequency, schedule.decreaseCount)} ea edge`,
      );
    }
    remaining = `${schedule.remainingStitchesTotal} sts`;
  } else if (crownKind === "spiral") {
    title = "Swirl-top hat Japanese notation diagram";
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

  const crownStartRow = calc.brimRows + calc.bodyRows;
  const crownStart =
    crownKind === "gathered"
      ? ""
      : crownStartRow > 0
        ? `rc${String(crownStartRow).padStart(3, "0")}`
        : "";

  return {
    title,
    castOn,
    circumference: displayLength(calc.targetWidth, unit, formatters),
    totalLength: displayLength(calc.hatHeight, unit, formatters),
    brimRows,
    brimDepth: displayLength(calc.brimDepth, unit, formatters),
    brimLabel: hatBrimDisplayLabel(brimType),
    bodyRows,
    bodyHeight: displayLength(calc.bodyHeightInches, unit, formatters),
    crownRows,
    crownDepth:
      crownKind === "gathered"
        ? ""
        : displayLength(calc.crownHeightInches, unit, formatters),
    crownStart,
    crownLines,
    remaining,
  };
}

function buildJpFrame(calc: HatPatternCalc): JpFrame {
  const crownKind = resolveCrownKind(calc.crown);
  const brimType = resolveHatBrimType(calc.brimType);
  const usable = HAT_BOTTOM - HAT_TOP;
  const brimIn = Math.max(0.25, calc.brimDepth || 0.25);
  const bodyIn = Math.max(0.25, calc.bodyHeightInches || 0.25);
  const crownIn =
    crownKind === "gathered"
      ? Math.max(0.4, Math.min(1.0, brimIn * 0.4))
      : Math.max(0.5, calc.crownHeightInches || 0.5);

  const rawTotal = brimIn + bodyIn + crownIn;
  let brimVisual = (brimIn / rawTotal) * usable;
  let bodyVisual = (bodyIn / rawTotal) * usable;
  let crownVisual = (crownIn / rawTotal) * usable;

  brimVisual = clamp(brimVisual, 40, 120);
  bodyVisual = clamp(bodyVisual, 56, 180);
  crownVisual = clamp(crownVisual, crownKind === "gathered" ? 44 : 64, 140);

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
  const hatWidth = (HAT_RIGHT - HAT_LEFT) * widthScale;
  const hatMidX = (HAT_LEFT + HAT_RIGHT) / 2;
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

function arrowHead(x: number, y: number, dir: "up" | "down" | "left" | "right"): string {
  const s = 4.5;
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

function verticalDim(
  x: number,
  y1: number,
  y2: number,
  lines: string[],
  labelX: number,
): string {
  const top = Math.min(y1, y2);
  const bot = Math.max(y1, y2);
  const midY = (top + bot) / 2;
  const parts = [
    `<line x1="${fmtNum(x)}" y1="${fmtNum(top)}" x2="${fmtNum(x)}" y2="${fmtNum(bot)}" stroke="${ARROW}" stroke-width="1.5" fill="none"/>`,
    arrowHead(x, top, "up"),
    arrowHead(x, bot, "down"),
  ];
  lines.forEach((line, i) => {
    const dy = (i - (lines.length - 1) / 2) * 18;
    parts.push(
      `<text x="${fmtNum(labelX)}" y="${fmtNum(midY + dy)}" text-anchor="middle" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_MEASURE)}>${escapeXml(line)}</text>`,
    );
  });
  return parts.join("");
}

function drawBrim(frame: JpFrame, labels: JpLabels): string {
  const { hatLeft, hatRight, brimTop, hatBottom, brimType, hatWidth, hatMidX } = frame;
  const parts: string[] = [
    `<rect class="hat-jp-diagram__brim" data-brim-style="${brimType}" x="${fmtNum(hatLeft)}" y="${fmtNum(brimTop)}" width="${fmtNum(hatWidth)}" height="${fmtNum(hatBottom - brimTop)}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
  ];

  if (brimType === "folded") {
    const foldY = brimTop + (hatBottom - brimTop) / 2;
    parts.push(
      `<line class="hat-jp-diagram__brim-fold" x1="${fmtNum(hatLeft)}" y1="${fmtNum(foldY)}" x2="${fmtNum(hatRight)}" y2="${fmtNum(foldY)}" stroke="${STROKE}" stroke-width="1.2" stroke-dasharray="5 4" fill="none"/>`,
    );
    parts.push(
      `<text x="${fmtNum(hatMidX)}" y="${fmtNum(foldY - 9)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_SMALL)}>fold</text>`,
    );
  } else if (brimType === "rolled") {
    const curlY = hatBottom - 7;
    parts.push(
      `<path class="hat-jp-diagram__brim-roll" d="M ${fmtNum(hatLeft + 10)} ${fmtNum(curlY)} Q ${fmtNum(hatMidX)} ${fmtNum(curlY + 9)} ${fmtNum(hatRight - 10)} ${fmtNum(curlY)}" fill="none" stroke="${STROKE}" stroke-width="1.1" opacity="0.55"/>`,
    );
  }

  const midY = (brimTop + hatBottom) / 2 + (brimType === "folded" ? 10 : 0);
  parts.push(
    `<text x="${fmtNum(hatMidX)}" y="${fmtNum(midY - 8)}" text-anchor="middle" dominant-baseline="middle" fill="${STROKE}" ${textFont(FS_SECTION, FW_SECTION)}>${escapeXml(labels.brimLabel)}</text>`,
  );
  if (labels.brimRows) {
    parts.push(
      `<text x="${fmtNum(hatMidX)}" y="${fmtNum(midY + 12)}" text-anchor="middle" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(labels.brimRows)}</text>`,
    );
  }
  return parts.join("");
}

function drawBody(frame: JpFrame, labels: JpLabels): string {
  const { hatLeft, bodyTop, brimTop, hatMidX, hatWidth } = frame;
  const midY = (bodyTop + brimTop) / 2;
  return [
    `<rect class="hat-jp-diagram__body" x="${fmtNum(hatLeft)}" y="${fmtNum(bodyTop)}" width="${fmtNum(hatWidth)}" height="${fmtNum(brimTop - bodyTop)}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
    `<text x="${fmtNum(hatMidX)}" y="${fmtNum(midY - 8)}" text-anchor="middle" dominant-baseline="middle" fill="${STROKE}" ${textFont(FS_SECTION, FW_SECTION)}>Body</text>`,
    labels.bodyRows
      ? `<text x="${fmtNum(hatMidX)}" y="${fmtNum(midY + 12)}" text-anchor="middle" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(labels.bodyRows)}</text>`
      : "",
  ].join("");
}

function drawGatheredCrown(frame: JpFrame, labels: JpLabels): string {
  const { hatLeft, hatRight, crownTop, bodyTop, hatMidX, hatWidth } = frame;
  const tipY = crownTop + 6;
  const midY = crownTop + (bodyTop - crownTop) * 0.4;
  const path = [
    `M ${fmtNum(hatLeft)} ${fmtNum(bodyTop)}`,
    `L ${fmtNum(hatRight)} ${fmtNum(bodyTop)}`,
    `Q ${fmtNum(hatRight - 16)} ${fmtNum(midY)} ${fmtNum(hatMidX + 24)} ${fmtNum(tipY + 8)}`,
    `Q ${fmtNum(hatMidX)} ${fmtNum(tipY - 2)} ${fmtNum(hatMidX - 24)} ${fmtNum(tipY + 8)}`,
    `Q ${fmtNum(hatLeft + 16)} ${fmtNum(midY)} ${fmtNum(hatLeft)} ${fmtNum(bodyTop)}`,
    "Z",
  ].join(" ");

  const lines = labels.crownLines
    .map((line, i) => {
      const y = tipY + 22 + i * 18;
      return `<text x="${fmtNum(hatMidX)}" y="${fmtNum(y)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(line)}</text>`;
    })
    .join("");

  return [
    `<g class="hat-jp-diagram__crown hat-jp-diagram__crown--gathered" data-crown-style="gathered">`,
    `<path d="${path}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
    `<text x="${fmtNum(hatMidX)}" y="${fmtNum(Math.max(18, crownTop - 2))}" text-anchor="middle" fill="${STROKE}" ${textFont(FS_SECTION, FW_SECTION)}>Crown</text>`,
    lines,
    labels.remaining
      ? `<text x="${fmtNum(hatMidX)}" y="${fmtNum(bodyTop - 10)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_SMALL)}>${escapeXml(labels.remaining)}</text>`
      : "",
    `</g>`,
  ].join("");
}

function drawFourGoreCrown(frame: JpFrame, labels: JpLabels): string {
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

  const notation = labels.crownLines
    .map((line, i) => {
      // Place primary shaping notation above the crown silhouette to avoid overlap.
      const y = Math.max(16, crownTop - 22 - (labels.crownLines.length - 1 - i) * 16);
      return `<text x="${fmtNum(hatMidX)}" y="${fmtNum(y)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(line)}</text>`;
    })
    .join("");

  return [
    `<g class="hat-jp-diagram__crown hat-jp-diagram__crown--four-gore" data-crown-style="wedge-4-decrease">`,
    `<polyline points="${pts.join(" ")}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
    `<line class="hat-jp-diagram__crown-start" x1="${fmtNum(hatLeft)}" y1="${fmtNum(bodyTop)}" x2="${fmtNum(hatRight)}" y2="${fmtNum(bodyTop)}" stroke="${STROKE}" stroke-width="1.25" stroke-dasharray="6 4" fill="none"/>`,
    goreLabels,
    notation,
    labels.crownRows
      ? `<text x="${fmtNum(hatMidX)}" y="${fmtNum(bodyTop + 16)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_SMALL)}>${escapeXml(labels.crownRows)}</text>`
      : "",
    labels.remaining
      ? `<text x="${fmtNum(hatMidX)}" y="${fmtNum(bodyTop + 34)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_SMALL)}>→ ${escapeXml(labels.remaining)}</text>`
      : "",
    labels.crownStart
      ? `<text x="${fmtNum(hatLeft - 6)}" y="${fmtNum(bodyTop + 4)}" text-anchor="end" fill="${MUTED}" ${textFont(FS_SMALL)}>${escapeXml(labels.crownStart)}</text>`
      : "",
    `</g>`,
  ].join("");
}

function drawSwirlCrown(frame: JpFrame, labels: JpLabels): string {
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

  const notation = labels.crownLines
    .map((line, i) => {
      const y = tipY + 18 + i * 17;
      return `<text x="${fmtNum(hatMidX)}" y="${fmtNum(y)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(line)}</text>`;
    })
    .join("");

  return [
    `<g class="hat-jp-diagram__crown hat-jp-diagram__crown--swirl" data-crown-style="spiral">`,
    `<path d="${outline}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
    swirlLines,
    `<line class="hat-jp-diagram__crown-start" x1="${fmtNum(hatLeft)}" y1="${fmtNum(bodyTop)}" x2="${fmtNum(hatRight)}" y2="${fmtNum(bodyTop)}" stroke="${STROKE}" stroke-width="1.25" stroke-dasharray="6 4" fill="none"/>`,
    `<text x="${fmtNum(hatMidX)}" y="${fmtNum(Math.max(18, crownTop - 4))}" text-anchor="middle" fill="${STROKE}" ${textFont(FS_SECTION, FW_SECTION)}>Crown · Swirl</text>`,
    notation,
    labels.remaining
      ? `<text x="${fmtNum(hatMidX)}" y="${fmtNum(bodyTop - 8)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_SMALL)}>→ ${escapeXml(labels.remaining)}</text>`
      : "",
    labels.crownStart
      ? `<text x="${fmtNum(hatLeft - 6)}" y="${fmtNum(bodyTop + 4)}" text-anchor="end" fill="${MUTED}" ${textFont(FS_SMALL)}>${escapeXml(labels.crownStart)}</text>`
      : "",
    `</g>`,
  ].join("");
}

function drawCrown(frame: JpFrame, labels: JpLabels): string {
  if (frame.crownKind === "wedge") return drawFourGoreCrown(frame, labels);
  if (frame.crownKind === "spiral") return drawSwirlCrown(frame, labels);
  return drawGatheredCrown(frame, labels);
}

function drawMeasurements(frame: JpFrame, labels: JpLabels): string {
  const parts: string[] = [];
  const leftX = 48;
  const rightX = 318;
  const rightLabelX = rightX + 40;

  parts.push(
    verticalDim(leftX, frame.crownTop, frame.hatBottom, [labels.totalLength], 28),
  );
  parts.push(
    `<text x="14" y="${fmtNum((frame.crownTop + frame.hatBottom) / 2)}" text-anchor="middle" transform="rotate(-90 14 ${(frame.crownTop + frame.hatBottom) / 2})" fill="${MUTED}" ${textFont(FS_SMALL)}>Total</text>`,
  );

  parts.push(
    verticalDim(
      rightX,
      frame.brimTop,
      frame.hatBottom,
      [labels.brimRows, labels.brimDepth].filter(Boolean),
      rightLabelX,
    ),
  );
  parts.push(
    verticalDim(
      rightX,
      frame.bodyTop,
      frame.brimTop,
      [labels.bodyRows, labels.bodyHeight].filter(Boolean),
      rightLabelX,
    ),
  );

  if (frame.crownKind !== "gathered") {
    parts.push(
      verticalDim(
        rightX,
        frame.crownTop,
        frame.bodyTop,
        [labels.crownRows, labels.crownDepth].filter(Boolean),
        rightLabelX,
      ),
    );
  }

  const bottomY = frame.hatBottom + 28;
  parts.push(
    `<line x1="${fmtNum(frame.hatLeft)}" y1="${fmtNum(bottomY)}" x2="${fmtNum(frame.hatRight)}" y2="${fmtNum(bottomY)}" stroke="${ARROW}" stroke-width="1.5" fill="none"/>`,
    arrowHead(frame.hatLeft, bottomY, "left"),
    arrowHead(frame.hatRight, bottomY, "right"),
    `<text x="${fmtNum(frame.hatMidX)}" y="${fmtNum(bottomY + 22)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(labels.castOn)}</text>`,
    `<text x="${fmtNum(frame.hatMidX)}" y="${fmtNum(bottomY + 42)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_MEASURE)}>${escapeXml(labels.circumference)}</text>`,
  );

  return parts.join("");
}

/**
 * Build a responsive Japanese-notation SVG from the finalized hat calc.
 * Notation tokens reuse shared formatters (`coN`, `Nr`, `Ns-Mr-Kx`).
 */
export function buildHatJapaneseNotationDiagramSvg(
  calc: HatPatternCalc,
  unit: HatPatternDiagramUnit,
  formatters: HatPatternDiagramFormatters,
): string {
  const frame = buildJpFrame(calc);
  const labels = buildJpLabels(calc, unit, formatters);
  const crownAttr =
    frame.crownKind === "wedge"
      ? "wedge-4-decrease"
      : frame.crownKind === "spiral"
        ? "spiral"
        : "gathered";

  const body = [
    drawBrim(frame, labels),
    drawBody(frame, labels),
    drawCrown(frame, labels),
    drawMeasurements(frame, labels),
  ].join("");

  const safeBody = body
    .replace(/\bNaN\b/g, "0")
    .replace(/\bInfinity\b/g, "0")
    .replace(/\bundefined\b/g, "");

  const desc = `Japanese-notation schematic for a hat with ${labels.brimLabel.toLowerCase()}, body ${labels.bodyRows || "straight section"}, and ${crownAttr} crown. Cast on ${labels.castOn}, finished circumference ${labels.circumference}, total length ${labels.totalLength}.`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="hat-japanese-notation-diagram-svg" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-labelledby="hat-jp-diagram-title" data-hat-japanese-diagram="true" data-crown="${crownAttr}" data-brim="${frame.brimType}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet">`,
    `<title id="hat-jp-diagram-title">${escapeXml(labels.title)}</title>`,
    `<desc>${escapeXml(desc)}</desc>`,
    `<style type="text/css"><![CDATA[text{font-family:${FONT}}]]></style>`,
    `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#fff"/>`,
    safeBody,
    `</svg>`,
  ].join("");
}

/** Exported for tests — stable viewBox dimensions. */
export const HAT_JAPANESE_NOTATION_VIEWBOX = { width: VB_W, height: VB_H } as const;
