/**
 * Programmatic hat pattern diagram SVG for the finished /patterns/hat/pattern page.
 *
 * Intentionally separate from `hatDiagram.ts`, which still serves static SVG templates
 * for the original /patterns/hat page. This generator shares one layout frame and
 * crown-specific drawing functions — no manual SVG templates or fetch.
 */

import {
  applyHatCrownCastOnAdjustment,
  buildFourWedgeCrownSetup,
  type HatPatternCalc,
} from "./hatMath";
import { HAT_EDIT_MEASUREMENT_TARGETS } from "./hatPatternEditTargets";

export type HatPatternDiagramFormatters = {
  convertLength: (value: number, from: string, to: string) => number;
  formatLengthWithUnit: (value: number, unit: string) => string;
};

export type HatPatternDiagramUnit = "inches" | "cm";

/** Canvas includes side/bottom gutters for large type; hat geometry stays fixed. */
const VB_W = 430;
const VB_H = 460;
const HAT_LEFT = 96;
const HAT_RIGHT = 296;
const HAT_WIDTH = HAT_RIGHT - HAT_LEFT;
const HAT_TOP = 52;
const HAT_BOTTOM = 340;
const ARROW = "#52682d";
const STROKE = "#1a1a1a";
const FILL = "#f4f6f1";
const MUTED = "#4b5563";
/** Site sans stack (`--font`); embedded on every <text> so print stays consistent. */
const FONT = "Poppins, system-ui, Arial, sans-serif";

/**
 * Typography ≥50% larger than the prior diagram scale (15/14/12/13 → below).
 * Section labels use the same family with slightly heavier weight for hierarchy.
 */
const FS_SECTION = 23; // Body, Brim
const FS_CROWN_TITLE = 21; // Gather, Crown · …
const FS_MEASURE = 21; // row counts + length values
const FS_STITCH = 23; // cast-on primary
const FS_STITCH_SECONDARY = 21; // width under cast-on
const FS_DETAIL = 18; // sts/gore, decrease points
const FS_GORE = 20; // #1–#4
const FS_SMALL = 18; // fold, gather
const FS_SUPPORT = 20; // Total caption
const FW_SECTION = 600; // Body / Brim / crown titles
const LINE_GAP_V = 24; // stacked measurement lines
const LINE_GAP_H = 26; // cast-on / width under hat

/** Shared SVG text attributes — always includes font-family for print fidelity. */
function textFont(size: number, weight?: number): string {
  const w = weight != null ? ` font-weight="${weight}"` : "";
  return `font-family="${FONT}" font-size="${size}"${w}`;
}

type Frame = {
  brimTop: number;
  bodyTop: number;
  crownTop: number;
  hatBottom: number;
  hatLeft: number;
  hatRight: number;
  hatMidX: number;
  brimVisual: number;
  bodyVisual: number;
  crownVisual: number;
  isGathered: boolean;
  isWedge: boolean;
  isSpiral: boolean;
  isFolded: boolean;
};

type Labels = {
  width: string;
  height: string;
  brimDepth: string;
  bodyHeight: string;
  crownDepth: string;
  castOn: string;
  brimRows: string;
  bodyRows: string;
  crownRows: string;
  wedgeSts: string;
  spiralPoints: string;
  spiralTarget: string;
  title: string;
};

function escapeXml(text: string): string {
  // Text-node escaping only (& < >). Inch marks from formatLengthWithUnit use `"`.
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

function buildLabels(
  calc: HatPatternCalc,
  unit: HatPatternDiagramUnit,
  formatters: HatPatternDiagramFormatters,
): Labels {
  const crown = calc.crown;
  const isWedge = crown === "wedge-4" || crown === "wedge-4-decrease";
  const isSpiral = crown === "spiral";
  const isGathered = !isWedge && !isSpiral;

  const patternCastOn = applyHatCrownCastOnAdjustment(calc.castOnSts, crown);
  const fourWedge =
    calc.fourWedgeCrownSetup ??
    buildFourWedgeCrownSetup({
      castOnSts: calc.castOnSts,
      crown,
      brimRows: calc.brimRows,
      bodyRows: calc.bodyRows,
    });

  const wedgeSts =
    isWedge && fourWedge
      ? `${fourWedge.wedgeStitchCount} sts / gore`
      : isWedge
        ? `${Math.round(patternCastOn / 4)} sts / gore`
        : "";

  const spiral = calc.crownPlan.spiral;
  const spiralPoints =
    isSpiral && spiral ? `${spiral.decreasePoints} decrease points` : "";
  const spiralTarget =
    isSpiral && spiral ? `to ${spiral.targetStitches} sts` : "";

  const crownTitle = isGathered
    ? "Gathered hat pattern diagram"
    : isWedge
      ? "Four-gore hat pattern diagram"
      : "Swirl-top hat pattern diagram";

  return {
    width: displayLength(calc.targetWidth, unit, formatters),
    height: displayLength(calc.hatHeight, unit, formatters),
    brimDepth: displayLength(calc.brimDepth, unit, formatters),
    bodyHeight: displayLength(calc.bodyHeightInches, unit, formatters),
    crownDepth: displayLength(calc.crownHeightInches, unit, formatters),
    castOn: `${patternCastOn} sts`,
    brimRows: `${calc.brimRows} rows`,
    bodyRows: `${calc.bodyRows} rows`,
    crownRows: `${calc.crownRowCount} rows`,
    wedgeSts,
    spiralPoints,
    spiralTarget,
    title: crownTitle,
  };
}

/**
 * Allocate visual heights from calculated inches with sensible clamping so
 * extreme custom lengths stay readable. Labels always use true calc values.
 */
function buildFrame(calc: HatPatternCalc): Frame {
  const crown = calc.crown;
  const isWedge = crown === "wedge-4" || crown === "wedge-4-decrease";
  const isSpiral = crown === "spiral";
  const isGathered = !isWedge && !isSpiral;
  const isFolded = calc.brimType === "folded";

  const usable = HAT_BOTTOM - HAT_TOP;
  const brimIn = Math.max(0.25, calc.brimDepth || 0.25);
  const bodyIn = Math.max(0.25, calc.bodyHeightInches || 0.25);
  // Gathered: tiny visual gather zone; shaped crowns use crown height.
  const crownIn = isGathered
    ? Math.max(0.35, Math.min(0.9, brimIn * 0.35))
    : Math.max(0.5, calc.crownHeightInches || 0.5);

  const rawTotal = brimIn + bodyIn + crownIn;
  let brimVisual = (brimIn / rawTotal) * usable;
  let bodyVisual = (bodyIn / rawTotal) * usable;
  let crownVisual = (crownIn / rawTotal) * usable;

  // Clamp sections so labels remain readable.
  brimVisual = clamp(brimVisual, 36, 110);
  bodyVisual = clamp(bodyVisual, 48, 170);
  crownVisual = clamp(crownVisual, isGathered ? 28 : 52, 130);

  let sum = brimVisual + bodyVisual + crownVisual;
  if (sum > usable) {
    const scale = usable / sum;
    brimVisual *= scale;
    bodyVisual *= scale;
    crownVisual *= scale;
    sum = usable;
  } else if (sum < usable * 0.82) {
    // Prefer giving leftover to the body so slouchy reads longer than fitted.
    bodyVisual += usable * 0.82 - sum;
  }

  const hatBottom = HAT_BOTTOM;
  const brimTop = hatBottom - brimVisual;
  const bodyTop = brimTop - bodyVisual;
  const crownTop = bodyTop - crownVisual;

  return {
    brimTop,
    bodyTop,
    crownTop,
    hatBottom,
    hatLeft: HAT_LEFT,
    hatRight: HAT_RIGHT,
    hatMidX: (HAT_LEFT + HAT_RIGHT) / 2,
    brimVisual,
    bodyVisual,
    crownVisual,
    isGathered,
    isWedge,
    isSpiral,
    isFolded,
  };
}

function arrowHead(x: number, y: number, dir: "up" | "down" | "left" | "right"): string {
  const s = 5;
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

function verticalArrow(
  x: number,
  y1: number,
  y2: number,
  labelLines: string[],
  labelX: number,
): string {
  const top = Math.min(y1, y2);
  const bot = Math.max(y1, y2);
  const midY = (top + bot) / 2;
  const parts = [
    `<line x1="${fmtNum(x)}" y1="${fmtNum(top)}" x2="${fmtNum(x)}" y2="${fmtNum(bot)}" stroke="${ARROW}" stroke-width="1.75" fill="none"/>`,
    arrowHead(x, top, "up"),
    arrowHead(x, bot, "down"),
  ];
  labelLines.forEach((line, i) => {
    const dy = (i - (labelLines.length - 1) / 2) * LINE_GAP_V;
    parts.push(
      `<text x="${fmtNum(labelX)}" y="${fmtNum(midY + dy)}" text-anchor="middle" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_MEASURE)}>${escapeXml(line)}</text>`,
    );
  });
  return parts.join("");
}

function horizontalArrow(
  y: number,
  x1: number,
  x2: number,
  labelLines: string[],
  labelY: number,
): string {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const midX = (left + right) / 2;
  const parts = [
    `<line x1="${fmtNum(left)}" y1="${fmtNum(y)}" x2="${fmtNum(right)}" y2="${fmtNum(y)}" stroke="${ARROW}" stroke-width="1.75" fill="none"/>`,
    arrowHead(left, y, "left"),
    arrowHead(right, y, "right"),
  ];
  labelLines.forEach((line, i) => {
    const size = i === 0 ? FS_STITCH : FS_STITCH_SECONDARY;
    parts.push(
      `<text x="${fmtNum(midX)}" y="${fmtNum(labelY + i * LINE_GAP_H)}" text-anchor="middle" dominant-baseline="middle" fill="${MUTED}" ${textFont(size)}>${escapeXml(line)}</text>`,
    );
  });
  return parts.join("");
}

function drawBrim(frame: Frame): string {
  const { hatLeft, hatRight, brimTop, hatBottom, isFolded } = frame;
  const parts: string[] = [
    `<rect class="hat-diagram__brim" data-brim-style="${isFolded ? "folded" : "single"}" x="${fmtNum(hatLeft)}" y="${fmtNum(brimTop)}" width="${fmtNum(HAT_WIDTH)}" height="${fmtNum(hatBottom - brimTop)}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
  ];

  if (isFolded) {
    const foldY = brimTop + (hatBottom - brimTop) / 2;
    parts.push(
      `<line class="hat-diagram__brim-fold" x1="${fmtNum(hatLeft)}" y1="${fmtNum(foldY)}" x2="${fmtNum(hatRight)}" y2="${fmtNum(foldY)}" stroke="${STROKE}" stroke-width="1.25" stroke-dasharray="5 4" fill="none"/>`,
    );
    // Subtle second bottom edge suggesting doubled fabric.
    parts.push(
      `<line class="hat-diagram__brim-double" x1="${fmtNum(hatLeft + 4)}" y1="${fmtNum(hatBottom - 5)}" x2="${fmtNum(hatRight - 4)}" y2="${fmtNum(hatBottom - 5)}" stroke="${STROKE}" stroke-width="1" opacity="0.55" fill="none"/>`,
    );
    parts.push(
      `<text x="${fmtNum(frame.hatMidX)}" y="${fmtNum(foldY - 10)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_SMALL)}>fold</text>`,
    );
  }

  parts.push(
    `<text x="${fmtNum(frame.hatMidX)}" y="${fmtNum((brimTop + hatBottom) / 2 + (isFolded ? 12 : 0))}" text-anchor="middle" dominant-baseline="middle" fill="${STROKE}" ${textFont(FS_SECTION, FW_SECTION)}>Brim</text>`,
  );
  return parts.join("");
}

function drawBody(frame: Frame): string {
  const { hatLeft, bodyTop, brimTop, hatMidX } = frame;
  return [
    `<rect class="hat-diagram__body" x="${fmtNum(hatLeft)}" y="${fmtNum(bodyTop)}" width="${fmtNum(HAT_WIDTH)}" height="${fmtNum(brimTop - bodyTop)}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
    `<text x="${fmtNum(hatMidX)}" y="${fmtNum((bodyTop + brimTop) / 2)}" text-anchor="middle" dominant-baseline="middle" fill="${STROKE}" ${textFont(FS_SECTION, FW_SECTION)}>Body</text>`,
  ].join("");
}

function drawGatheredCrown(frame: Frame): string {
  const { hatLeft, hatRight, crownTop, bodyTop, hatMidX } = frame;
  const midY = crownTop + (bodyTop - crownTop) * 0.35;
  const tipY = crownTop + 4;
  // Soft gather pleats closing to a tip — not a shaped crown.
  const path = [
    `M ${fmtNum(hatLeft)} ${fmtNum(bodyTop)}`,
    `L ${fmtNum(hatRight)} ${fmtNum(bodyTop)}`,
    `Q ${fmtNum(hatRight - 18)} ${fmtNum(midY)} ${fmtNum(hatMidX + 28)} ${fmtNum(tipY + 10)}`,
    `Q ${fmtNum(hatMidX)} ${fmtNum(tipY - 2)} ${fmtNum(hatMidX - 28)} ${fmtNum(tipY + 10)}`,
    `Q ${fmtNum(hatLeft + 18)} ${fmtNum(midY)} ${fmtNum(hatLeft)} ${fmtNum(bodyTop)}`,
    "Z",
  ].join(" ");

  const pleats = [0.25, 0.4, 0.5, 0.6, 0.75]
    .map((t) => {
      const x = hatLeft + HAT_WIDTH * t;
      return `<path d="M ${fmtNum(x)} ${fmtNum(bodyTop)} Q ${fmtNum(hatMidX + (x - hatMidX) * 0.35)} ${fmtNum(midY)} ${fmtNum(hatMidX)} ${fmtNum(tipY + 6)}" fill="none" stroke="${STROKE}" stroke-width="0.9" opacity="0.45"/>`;
    })
    .join("");

  return [
    `<g class="hat-diagram__crown hat-diagram__crown--gathered" data-crown-style="gathered">`,
    `<path d="${path}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
    pleats,
    // Sit above the tip so large type does not sit on the gather pleats.
    `<text x="${fmtNum(hatMidX)}" y="${fmtNum(Math.max(16, crownTop - 2))}" text-anchor="middle" dominant-baseline="middle" fill="${STROKE}" ${textFont(FS_CROWN_TITLE, FW_SECTION)}>Gather</text>`,
    `</g>`,
  ].join("");
}

function drawFourGoreCrown(frame: Frame, labels: Labels): string {
  const { hatLeft, hatRight, crownTop, bodyTop, brimTop, hatMidX } = frame;
  const tipY = crownTop + 6;
  const valleyY = bodyTop - 4;
  // Four shaping repeats as zig-zag peaks (one piece, four decrease sections).
  const peaks = 4;
  const pts: string[] = [`${fmtNum(hatLeft)},${fmtNum(bodyTop)}`];
  for (let i = 0; i < peaks; i += 1) {
    const left = hatLeft + (HAT_WIDTH * i) / peaks;
    const right = hatLeft + (HAT_WIDTH * (i + 1)) / peaks;
    const mid = (left + right) / 2;
    pts.push(`${fmtNum(mid)},${fmtNum(tipY)}`);
    pts.push(`${fmtNum(right)},${fmtNum(i === peaks - 1 ? bodyTop : valleyY)}`);
  }

  // Two-line “Gore / #n” so FS_GORE fits inside each wedge without horizontal squash.
  const goreLabelY = tipY + (bodyTop - tipY) * 0.7;
  const goreLineGap = FS_GORE + 1;
  const sectionLabels = [1, 2, 3, 4]
    .map((n) => {
      const left = hatLeft + (HAT_WIDTH * (n - 1)) / peaks;
      const right = hatLeft + (HAT_WIDTH * n) / peaks;
      const x = (left + right) / 2;
      return (
        `<text x="${fmtNum(x)}" y="${fmtNum(goreLabelY)}" text-anchor="middle" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_GORE)}>` +
        `<tspan x="${fmtNum(x)}" dy="${fmtNum(-goreLineGap / 2)}">Gore</tspan>` +
        `<tspan x="${fmtNum(x)}" dy="${fmtNum(goreLineGap)}">#${n}</tspan>` +
        `</text>`
      );
    })
    .join("");

  const crownTitleY = Math.max(16, crownTop - 4);

  // Stitch count: inside the hat, just below the wedge base — clear of tips, gore labels, and Body.
  const bodyMidY = (bodyTop + brimTop) / 2;
  const stitchBelowWedge = bodyTop + Math.max(34, FS_DETAIL + 16);
  const stitchClearOfBody = bodyMidY - FS_SECTION - 14;
  const wedgeStsY = Math.min(stitchBelowWedge, stitchClearOfBody);

  return [
    `<g class="hat-diagram__crown hat-diagram__crown--four-gore" data-crown-style="wedge-4-decrease">`,
    `<polyline points="${pts.join(" ")}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
    `<line class="hat-diagram__crown-start" x1="${fmtNum(hatLeft)}" y1="${fmtNum(bodyTop)}" x2="${fmtNum(hatRight)}" y2="${fmtNum(bodyTop)}" stroke="${STROKE}" stroke-width="1.25" stroke-dasharray="6 4" fill="none"/>`,
    sectionLabels,
    labels.wedgeSts
      ? `<text x="${fmtNum(hatMidX)}" y="${fmtNum(wedgeStsY)}" text-anchor="middle" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_DETAIL)}>${escapeXml(labels.wedgeSts)}</text>`
      : "",
    `<text x="${fmtNum(hatMidX)}" y="${fmtNum(crownTitleY)}" text-anchor="middle" fill="${STROKE}" ${textFont(FS_CROWN_TITLE, FW_SECTION)}>Crown · 4 gores</text>`,
    `</g>`,
  ].join("");
}

function drawSwirlCrown(frame: Frame, labels: Labels): string {
  const { hatLeft, hatRight, crownTop, bodyTop, hatMidX } = frame;
  const tipY = crownTop + 8;
  // Tapered crown silhouette.
  const outline = [
    `M ${fmtNum(hatLeft)} ${fmtNum(bodyTop)}`,
    `L ${fmtNum(hatRight)} ${fmtNum(bodyTop)}`,
    `Q ${fmtNum(hatRight - 10)} ${fmtNum((bodyTop + tipY) / 2)} ${fmtNum(hatMidX + 10)} ${fmtNum(tipY)}`,
    `Q ${fmtNum(hatMidX)} ${fmtNum(tipY - 4)} ${fmtNum(hatMidX - 10)} ${fmtNum(tipY)}`,
    `Q ${fmtNum(hatLeft + 10)} ${fmtNum((bodyTop + tipY) / 2)} ${fmtNum(hatLeft)} ${fmtNum(bodyTop)}`,
    "Z",
  ].join(" ");

  // Six directional decrease lines (schematic swirl, not stitch paths).
  const swirlLines = Array.from({ length: 6 }, (_, i) => {
    const t = (i + 0.5) / 6;
    const x0 = hatLeft + HAT_WIDTH * t;
    const sweep = ((i % 2 === 0 ? 1 : -1) * HAT_WIDTH) / 10;
    const cx = clamp(x0 + sweep, hatLeft + 8, hatRight - 8);
    return `<path d="M ${fmtNum(x0)} ${fmtNum(bodyTop)} Q ${fmtNum(cx)} ${fmtNum((bodyTop + tipY) / 2)} ${fmtNum(hatMidX)} ${fmtNum(tipY)}" fill="none" stroke="${STROKE}" stroke-width="1.1" opacity="0.7"/>`;
  }).join("");

  return [
    `<g class="hat-diagram__crown hat-diagram__crown--swirl" data-crown-style="spiral">`,
    `<path d="${outline}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
    swirlLines,
    `<line class="hat-diagram__crown-start" x1="${fmtNum(hatLeft)}" y1="${fmtNum(bodyTop)}" x2="${fmtNum(hatRight)}" y2="${fmtNum(bodyTop)}" stroke="${STROKE}" stroke-width="1.25" stroke-dasharray="6 4" fill="none"/>`,
    labels.spiralPoints
      ? `<text x="${fmtNum(hatMidX)}" y="${fmtNum(bodyTop - frame.crownVisual * 0.58)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_DETAIL)}>${escapeXml(labels.spiralPoints)}</text>`
      : "",
    labels.spiralTarget
      ? `<text x="${fmtNum(hatMidX)}" y="${fmtNum(bodyTop - frame.crownVisual * 0.32)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_DETAIL)}>${escapeXml(labels.spiralTarget)}</text>`
      : "",
    `<text x="${fmtNum(hatMidX)}" y="${fmtNum(Math.max(16, crownTop - 4))}" text-anchor="middle" fill="${STROKE}" ${textFont(FS_CROWN_TITLE, FW_SECTION)}>Crown · Swirl</text>`,
    `</g>`,
  ].join("");
}

function drawCrown(frame: Frame, labels: Labels): string {
  if (frame.isWedge) return drawFourGoreCrown(frame, labels);
  if (frame.isSpiral) return drawSwirlCrown(frame, labels);
  return drawGatheredCrown(frame);
}

function drawMeasurements(frame: Frame, labels: Labels): string {
  const parts: string[] = [];
  // Side gutters sized for FS_MEASURE / FS_STITCH so labels stay inside the viewBox.
  const leftX = 54;
  const rightX = 338;
  const rightLabelX = rightX + 44;
  const totalLabelX = 18;
  const heightLabelX = 36;
  const midHeightY = (frame.crownTop + frame.hatBottom) / 2;

  // Total height (left): rotated caption clear of the numeric length.
  parts.push(
    verticalArrow(leftX, frame.crownTop, frame.hatBottom, [labels.height], heightLabelX),
  );
  parts.push(
    `<text x="${fmtNum(totalLabelX)}" y="${fmtNum(midHeightY)}" text-anchor="middle" transform="rotate(-90 ${fmtNum(totalLabelX)} ${fmtNum(midHeightY)})" fill="${MUTED}" ${textFont(FS_SUPPORT)}>Total</text>`,
  );

  // Section heights (right).
  parts.push(
    verticalArrow(
      rightX,
      frame.brimTop,
      frame.hatBottom,
      [labels.brimRows, labels.brimDepth],
      rightLabelX,
    ),
  );
  parts.push(
    verticalArrow(
      rightX,
      frame.bodyTop,
      frame.brimTop,
      [labels.bodyRows, labels.bodyHeight],
      rightLabelX,
    ),
  );

  if (!frame.isGathered) {
    parts.push(
      verticalArrow(
        rightX,
        frame.crownTop,
        frame.bodyTop,
        [labels.crownRows, labels.crownDepth],
        rightLabelX,
      ),
    );
  } else {
    // Gathered: no crown depth — instructions gather the live stitches closed.
    const gatherMidY = (frame.crownTop + frame.bodyTop) / 2;
    parts.push(
      `<text x="${fmtNum(rightX + 8)}" y="${fmtNum(gatherMidY - 12)}" text-anchor="start" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_SMALL)}>gather</text>`,
      `<text x="${fmtNum(rightX + 8)}" y="${fmtNum(gatherMidY + 14)}" text-anchor="start" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_DETAIL)}>${escapeXml(labels.castOn)}</text>`,
    );
  }

  // Cast-on + finished width under brim.
  parts.push(
    horizontalArrow(
      frame.hatBottom + 24,
      frame.hatLeft,
      frame.hatRight,
      [labels.castOn, labels.width],
      frame.hatBottom + 46,
    ),
  );

  return parts.join("");
}

function drawEditTargets(frame: Frame): string {
  const circY = (frame.bodyTop + frame.brimTop) / 2;
  const lengthY = (frame.crownTop + frame.hatBottom) / 2;
  const brimY = (frame.brimTop + frame.hatBottom) / 2;
  return [
    `<g class="hat-diagram__edit-targets" aria-hidden="true">`,
    `<circle id="${HAT_EDIT_MEASUREMENT_TARGETS.circumference}" cx="${fmtNum(frame.hatMidX)}" cy="${fmtNum(circY)}" r="5" fill="#c2614e" fill-opacity="0.35"/>`,
    `<circle id="${HAT_EDIT_MEASUREMENT_TARGETS.length}" cx="${fmtNum(frame.hatLeft - 8)}" cy="${fmtNum(lengthY)}" r="5" fill="#c2614e" fill-opacity="0.35"/>`,
    `<circle id="${HAT_EDIT_MEASUREMENT_TARGETS.brimDepth}" cx="${fmtNum(frame.hatRight + 8)}" cy="${fmtNum(brimY)}" r="5" fill="#c2614e" fill-opacity="0.35"/>`,
    `</g>`,
  ].join("");
}

/**
 * Build a safe, responsive SVG diagram from the same `HatPatternCalc` used for instructions.
 */
export function buildHatPatternDiagramSvg(
  calc: HatPatternCalc,
  unit: HatPatternDiagramUnit,
  formatters: HatPatternDiagramFormatters,
): string {
  const frame = buildFrame(calc);
  const labels = buildLabels(calc, unit, formatters);
  const crownAttr = frame.isWedge
    ? "wedge-4-decrease"
    : frame.isSpiral
      ? "spiral"
      : "gathered";
  const brimAttr = frame.isFolded ? "folded" : "single";

  const body = [
    drawBrim(frame),
    drawBody(frame),
    drawCrown(frame, labels),
    drawMeasurements(frame, labels),
    drawEditTargets(frame),
  ].join("");

  // Sanity: never emit broken numeric tokens.
  const safeBody = body
    .replace(/\bNaN\b/g, "0")
    .replace(/\bInfinity\b/g, "0")
    .replace(/\bundefined\b/g, "");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="hat-pattern-diagram-svg" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-labelledby="hat-diagram-title" data-hat-diagram="true" data-crown="${crownAttr}" data-brim="${brimAttr}" width="100%" height="auto">`,
    `<title id="hat-diagram-title">${escapeXml(labels.title)}</title>`,
    `<desc>Schematic hat diagram with brim, body, and ${escapeXml(crownAttr)} crown. Cast on ${escapeXml(labels.castOn)}, finished width ${escapeXml(labels.width)}, total length ${escapeXml(labels.height)}.</desc>`,
    // Embedded style reinforces print/PDF when CSS variables are unavailable.
    `<style type="text/css"><![CDATA[text{font-family:${FONT}}]]></style>`,
    `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#fff"/>`,
    safeBody,
    `</svg>`,
  ].join("");
}
