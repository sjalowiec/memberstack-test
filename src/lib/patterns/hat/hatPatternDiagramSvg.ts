/**
 * Programmatic hat pattern diagram SVG.
 *
 * Shared generator for:
 * - `/patterns/hat/pattern/` (`mode: "pattern"`) — full construction diagram
 * - `/patterns/hat/summary/` (`mode: "summaryEdit"`) — measurement-only diagram
 *
 * Intentionally separate from `hatDiagram.ts`, which still serves static SVG templates
 * for the original /patterns/hat page.
 */

import {
  applyHatCrownCastOnAdjustment,
  buildFourWedgeCrownSetup,
  resolveHatBrimType,
  type HatBrimType,
  type HatPatternCalc,
} from "./hatMath";
import { HAT_EDIT_MEASUREMENT_TARGETS } from "./hatPatternEditTargets";
import {
  HAT_DIAGRAM_FONT_FAMILY,
  HAT_DIAGRAM_REFERENCE_VIEWBOX_WIDTH,
  HAT_DIAGRAM_SECTION_WEIGHT,
  hatDiagramTypographyForViewBox,
} from "./hatDiagramTypography";
import { HAT_TRANSFER_STEP_ICON_SRC } from "./hatTransferStep";
import {
  SWIRL_CROWN_SECTION_COUNT_FALLBACK,
  buildSwirlCrownGeometry,
} from "./hatSwirlCrownGeometry";

export type HatPatternDiagramFormatters = {
  convertLength: (value: number, from: string, to: string) => number;
  formatLengthWithUnit: (value: number, unit: string) => string;
};

export type HatPatternDiagramUnit = "inches" | "cm";

/**
 * `pattern` — finished-pattern construction diagram (stitches + rows).
 * `summaryEdit` — Summary/Edit measurement diagram (no calculated sts/rows).
 */
export type HatPatternDiagramMode = "pattern" | "summaryEdit";

export const HAT_PATTERN_DIAGRAM_MODE_PATTERN = "pattern" as const;
export const HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT = "summaryEdit" as const;

/** Canvas includes side/bottom gutters for large type; hat geometry stays fixed. */
const VB_W = HAT_DIAGRAM_REFERENCE_VIEWBOX_WIDTH;
const VB_H = 460;
const HAT_LEFT = 96;
const HAT_RIGHT = 296;
const HAT_WIDTH = HAT_RIGHT - HAT_LEFT;
const HAT_TOP = 52;
const HAT_BOTTOM = 340;
/**
 * Extra left viewBox padding in summaryEdit so the Finished hat length chip fits
 * entirely inside the diagram workspace (not the form column).
 */
const SUMMARY_EDIT_LEFT_PAD = 120;
const ARROW = "#52682d";
const STROKE = "#1a1a1a";
const FILL = "#f4f6f1";
const MUTED = "#4b5563";
/** Site sans stack (`--font`); embedded on every <text> so print stays consistent. */
const FONT = HAT_DIAGRAM_FONT_FAMILY;

/** Exported for Summary/Edit layout tests (left gutter for the length chip). */
export const HAT_SUMMARY_EDIT_DIAGRAM_LEFT_PAD = SUMMARY_EDIT_LEFT_PAD;

/**
 * Typography from shared hat diagram tokens (this viewBox is the visual reference).
 * Section labels use the same family with slightly heavier weight for hierarchy.
 */
const TYPE = hatDiagramTypographyForViewBox(VB_W);
const FS_SECTION = TYPE.section; // Body, Brim
const FS_CROWN_TITLE = TYPE.crownTitle; // Gather, Crown · …
const FS_MEASURE = TYPE.measure; // row counts + length values
const FS_STITCH = TYPE.stitch; // cast-on primary
const FS_STITCH_SECONDARY = TYPE.stitchSecondary; // width under cast-on
const FS_DETAIL = TYPE.detail; // sts/gore, swirl section callouts
const FS_GORE = TYPE.gore; // #1–#4
const FS_SMALL = TYPE.small; // fold, gather
const FS_SUPPORT = TYPE.support; // Total caption
const FW_SECTION = HAT_DIAGRAM_SECTION_WEIGHT; // Body / Brim / crown titles
const LINE_GAP_V = 24; // stacked measurement lines
const LINE_GAP_H = 26; // cast-on / width under hat

/** Supporting swirl callout — smaller than Crown · Swirl, still mobile-readable. */
const FS_SWIRL_SUPPORT = FS_SMALL;
/** Transfer icon in the swirl instruction line (~text height, slightly larger). */
const SWIRL_INSTRUCTION_ICON_SIZE = FS_SWIRL_SUPPORT + 4;

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
  hatWidth: number;
  brimVisual: number;
  bodyVisual: number;
  crownVisual: number;
  isGathered: boolean;
  isWedge: boolean;
  isSpiral: boolean;
  brimType: HatBrimType;
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
  /** Calculated swirl sections (`HatSpiralPlan.decreasePoints`); 0 when not spiral. */
  spiralSectionCount: number;
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
  mode: HatPatternDiagramMode,
): Labels {
  const crown = calc.crown;
  const isWedge = crown === "wedge-4" || crown === "wedge-4-decrease";
  const isSpiral = crown === "spiral";
  const isGathered = !isWedge && !isSpiral;
  const summaryEdit = mode === "summaryEdit";

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
    !summaryEdit && isWedge && fourWedge
      ? `${fourWedge.wedgeStitchCount} sts / gore`
      : !summaryEdit && isWedge
        ? `${Math.round(patternCastOn / 4)} sts / gore`
        : "";

  const spiral = calc.crownPlan.spiral;
  const spiralSectionCount = isSpiral && spiral ? spiral.decreasePoints : 0;
  // Diagram-only callout; schedule target stitch total is not shown on this SVG.
  const spiralPoints =
    !summaryEdit && isSpiral && spiral ? `${spiral.decreasePoints} sections` : "";
  const spiralTarget = "";

  const crownTitle = isGathered
    ? summaryEdit
      ? "Gathered hat measurement diagram"
      : "Gathered hat pattern diagram"
    : isWedge
      ? summaryEdit
        ? "Four-gore hat measurement diagram"
        : "Four-gore hat pattern diagram"
      : summaryEdit
        ? "Swirl-top hat measurement diagram"
        : "Swirl-top hat pattern diagram";

  return {
    width: summaryEdit ? "" : displayLength(calc.targetWidth, unit, formatters),
    height: summaryEdit ? "" : displayLength(calc.hatHeight, unit, formatters),
    brimDepth: summaryEdit ? "" : displayLength(calc.brimDepth, unit, formatters),
    bodyHeight: summaryEdit ? "" : displayLength(calc.bodyHeightInches, unit, formatters),
    crownDepth: summaryEdit ? "" : displayLength(calc.crownHeightInches, unit, formatters),
    castOn: summaryEdit ? "" : `${patternCastOn} sts`,
    brimRows: summaryEdit ? "" : `${calc.brimRows} rows`,
    bodyRows: summaryEdit ? "" : `${calc.bodyRows} rows`,
    crownRows: summaryEdit ? "" : `${calc.crownRowCount} rows`,
    wedgeSts,
    spiralPoints,
    spiralTarget,
    spiralSectionCount,
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
  const brimType = resolveHatBrimType(calc.brimType);

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
  // Spiral needs extra crown band for the above-crown callout + transfer icons.
  brimVisual = clamp(brimVisual, 36, 110);
  bodyVisual = clamp(bodyVisual, 48, 170);
  crownVisual = clamp(
    crownVisual,
    isGathered ? 28 : isSpiral ? 78 : 52,
    130,
  );

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

  // Scale silhouette width with finished circumference so Summary/Edit preview
  // (and the finished-pattern diagram) reflect size changes visually.
  const REF_CIRC_INCHES = 20.5;
  const circ = Number(calc.targetWidth);
  const widthScale =
    circ > 0 && Number.isFinite(circ) ? clamp(circ / REF_CIRC_INCHES, 0.55, 1.35) : 1;
  const hatWidth = HAT_WIDTH * widthScale;
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
    isGathered,
    isWedge,
    isSpiral,
    brimType,
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
  const { hatLeft, hatRight, brimTop, hatBottom, brimType, hatWidth } = frame;
  const isFolded = brimType === "folded";
  const parts: string[] = [
    `<rect class="hat-diagram__brim" data-brim-style="${brimType}" x="${fmtNum(hatLeft)}" y="${fmtNum(brimTop)}" width="${fmtNum(hatWidth)}" height="${fmtNum(hatBottom - brimTop)}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
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
  } else if (brimType === "rolled") {
    // Soft curl cue at the lower edge (not a fold / hung hem).
    const curlY = hatBottom - 8;
    parts.push(
      `<path class="hat-diagram__brim-roll" d="M ${fmtNum(hatLeft + 10)} ${fmtNum(curlY)} Q ${fmtNum(frame.hatMidX)} ${fmtNum(curlY + 10)} ${fmtNum(hatRight - 10)} ${fmtNum(curlY)}" fill="none" stroke="${STROKE}" stroke-width="1.1" opacity="0.5"/>`,
    );
  }

  const brimLabel = brimType === "rolled" ? "Rolled Brim" : "Brim";
  parts.push(
    `<text x="${fmtNum(frame.hatMidX)}" y="${fmtNum((brimTop + hatBottom) / 2 + (isFolded ? 12 : 0))}" text-anchor="middle" dominant-baseline="middle" fill="${STROKE}" ${textFont(FS_SECTION, FW_SECTION)}>${brimLabel}</text>`,
  );
  return parts.join("");
}

function drawBody(frame: Frame): string {
  const { hatLeft, bodyTop, brimTop, hatMidX, hatWidth } = frame;
  return [
    `<rect class="hat-diagram__body" x="${fmtNum(hatLeft)}" y="${fmtNum(bodyTop)}" width="${fmtNum(hatWidth)}" height="${fmtNum(brimTop - bodyTop)}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
    `<text x="${fmtNum(hatMidX)}" y="${fmtNum((bodyTop + brimTop) / 2)}" text-anchor="middle" dominant-baseline="middle" fill="${STROKE}" ${textFont(FS_SECTION, FW_SECTION)}>Body</text>`,
  ].join("");
}

function drawGatheredCrown(frame: Frame): string {
  const { hatLeft, hatRight, crownTop, bodyTop, hatMidX, hatWidth } = frame;
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
      const x = hatLeft + hatWidth * t;
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
  const { hatLeft, hatRight, crownTop, bodyTop, brimTop, hatMidX, hatWidth } = frame;
  const tipY = crownTop + 6;
  const valleyY = bodyTop - 4;
  // Four shaping repeats as zig-zag peaks (one piece, four decrease sections).
  const peaks = 4;
  const pts: string[] = [`${fmtNum(hatLeft)},${fmtNum(bodyTop)}`];
  for (let i = 0; i < peaks; i += 1) {
    const left = hatLeft + (hatWidth * i) / peaks;
    const right = hatLeft + (hatWidth * (i + 1)) / peaks;
    const mid = (left + right) / 2;
    pts.push(`${fmtNum(mid)},${fmtNum(tipY)}`);
    pts.push(`${fmtNum(right)},${fmtNum(i === peaks - 1 ? bodyTop : valleyY)}`);
  }

  // Single-line “#n” centered in each wedge.
  const goreLabelY = tipY + (bodyTop - tipY) * 0.7;
  const sectionLabels = [1, 2, 3, 4]
    .map((n) => {
      const left = hatLeft + (hatWidth * (n - 1)) / peaks;
      const right = hatLeft + (hatWidth * n) / peaks;
      const x = (left + right) / 2;
      return (
        `<text x="${fmtNum(x)}" y="${fmtNum(goreLabelY)}" text-anchor="middle" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_GORE)}>#${n}</text>`
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

/**
 * Swirl crown: six one-sided sections that all lean the same way.
 * Leading (left) edge is vertical / non-decrease; trailing (right) edge is the
 * sole decrease edge — that shared rotational direction creates the swirl.
 * Geometry from {@link buildSwirlCrownGeometry}.
 */
function drawSwirlCrown(frame: Frame, labels: Labels): string {
  const { hatLeft, crownTop, bodyTop, hatMidX, hatWidth } = frame;
  const sectionCount =
    labels.spiralSectionCount > 0
      ? labels.spiralSectionCount
      : SWIRL_CROWN_SECTION_COUNT_FALLBACK;
  const hasSectionLabel = Boolean(labels.spiralPoints);

  // Header stack above the crown drawing: title, then section count + instruction.
  const supportGap = FS_SWIRL_SUPPORT + 4;
  const instructionIconSize = SWIRL_INSTRUCTION_ICON_SIZE;
  const headerStackHeight = hasSectionLabel
    ? FS_CROWN_TITLE * 0.55 + 10 + supportGap + Math.max(FS_SWIRL_SUPPORT, instructionIconSize) * 0.55 + 14
    : FS_CROWN_TITLE * 0.55 + 10;
  const crownTitleY = Math.max(14, crownTop - headerStackHeight);
  const labelFirstY = crownTitleY + FS_CROWN_TITLE * 0.55 + 10;
  const labelSecondY = labelFirstY + supportGap;
  const headerBottom = hasSectionLabel
    ? labelSecondY + Math.max(FS_SWIRL_SUPPORT, instructionIconSize) * 0.45
    : crownTitleY + FS_CROWN_TITLE * 0.35;
  const minCrownDrawHeight = 52;
  const tipY = clamp(
    Math.max(crownTop + 6, headerBottom + 12),
    crownTop + 6,
    bodyTop - minCrownDrawHeight,
  );

  const geometry = buildSwirlCrownGeometry({
    hatLeft,
    hatWidth,
    tipY,
    bodyTop,
    sectionCount,
    fmt: fmtNum,
  });

  const sectionGroups = geometry.sections.map(
    (section) =>
      `<g class="hat-diagram__swirl-section" data-section-index="${section.index}" data-decrease-edge="${section.decreaseEdge}" data-non-decrease-edge="${section.nonDecreaseEdge}" data-decrease-x1="${fmtNum(section.left)}" data-decrease-y1="${fmtNum(section.tipY)}" data-decrease-x2="${fmtNum(section.right)}" data-decrease-y2="${fmtNum(section.bodyTop)}" data-non-decrease-x1="${fmtNum(section.left)}" data-non-decrease-y1="${fmtNum(section.tipY)}" data-non-decrease-x2="${fmtNum(section.left)}" data-non-decrease-y2="${fmtNum(section.bodyTop)}"></g>`,
  );

  const headerCallouts: string[] = [];
  if (hasSectionLabel) {
    const instruction = "decrease at one edge";
    // Approximate Poppins advance to center icon + text as one unit.
    const textWidth = instruction.length * FS_SWIRL_SUPPORT * 0.52;
    const iconGap = 6;
    const groupWidth = instructionIconSize + iconGap + textWidth;
    const groupLeft = hatMidX - groupWidth / 2;
    const iconX = groupLeft;
    const iconY = labelSecondY - instructionIconSize / 2;
    const textX = groupLeft + instructionIconSize + iconGap;

    headerCallouts.push(
      `<text class="hat-diagram__swirl-section-label" data-swirl-section-label="${escapeXml(labels.spiralPoints)}" data-swirl-label-placement="above-crown" x="${fmtNum(hatMidX)}" y="${fmtNum(labelFirstY)}" text-anchor="middle" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_SWIRL_SUPPORT)}>${escapeXml(`${geometry.sectionCount} sections`)}</text>`,
      `<g class="hat-diagram__swirl-instruction" data-swirl-instruction="decrease-one-edge">`,
      `<image class="hat-diagram__swirl-instruction-icon" href="${HAT_TRANSFER_STEP_ICON_SRC}" xlink:href="${HAT_TRANSFER_STEP_ICON_SRC}" x="${fmtNum(iconX)}" y="${fmtNum(iconY)}" width="${fmtNum(instructionIconSize)}" height="${fmtNum(instructionIconSize)}" />`,
      `<text class="hat-diagram__swirl-instruction-text" x="${fmtNum(textX)}" y="${fmtNum(labelSecondY)}" text-anchor="start" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_SWIRL_SUPPORT)}>${escapeXml(instruction)}</text>`,
      `</g>`,
    );
  }

  return [
    `<g class="hat-diagram__crown hat-diagram__crown--swirl" data-crown-style="spiral" data-swirl-section-count="${geometry.sectionCount}" data-swirl-decrease-edge="${geometry.decreaseEdge}">`,
    `<text class="hat-diagram__swirl-title" x="${fmtNum(hatMidX)}" y="${fmtNum(crownTitleY)}" text-anchor="middle" fill="${STROKE}" ${textFont(FS_CROWN_TITLE, FW_SECTION)}>Crown · Swirl</text>`,
    ...headerCallouts,
    `<polyline class="hat-diagram__swirl-outline" points="${geometry.outlinePoints}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.75"/>`,
    sectionGroups.join(""),
    `<line class="hat-diagram__crown-start" x1="${fmtNum(hatLeft)}" y1="${fmtNum(bodyTop)}" x2="${fmtNum(frame.hatRight)}" y2="${fmtNum(bodyTop)}" stroke="${STROKE}" stroke-width="1.25" stroke-dasharray="6 4" fill="none"/>`,
    `</g>`,
  ].join("");
}

function drawCrown(frame: Frame, labels: Labels): string {
  if (frame.isWedge) return drawFourGoreCrown(frame, labels);
  if (frame.isSpiral) return drawSwirlCrown(frame, labels);
  return drawGatheredCrown(frame);
}

function drawMeasurements(
  frame: Frame,
  labels: Labels,
  mode: HatPatternDiagramMode,
): string {
  const parts: string[] = [];
  const summaryEdit = mode === "summaryEdit";
  // Side gutters sized for FS_MEASURE / FS_STITCH so labels stay inside the viewBox.
  const leftX = 54;
  const rightX = 338;
  const rightLabelX = rightX + 44;
  const totalLabelX = 18;
  const heightLabelX = 36;
  const midHeightY = (frame.crownTop + frame.hatBottom) / 2;

  // Total height (left). summaryEdit: arrow only — editable chip is the value source.
  // Swirl / Four-Gore: keep the arrow + value, omit the "Total" caption.
  parts.push(
    verticalArrow(
      leftX,
      frame.crownTop,
      frame.hatBottom,
      summaryEdit ? [] : [labels.height],
      heightLabelX,
    ),
  );
  if (!frame.isSpiral && !frame.isWedge) {
    parts.push(
      `<text x="${fmtNum(totalLabelX)}" y="${fmtNum(midHeightY)}" text-anchor="middle" transform="rotate(-90 ${fmtNum(totalLabelX)} ${fmtNum(midHeightY)})" fill="${MUTED}" ${textFont(FS_SUPPORT)}>Total</text>`,
    );
  }

  if (summaryEdit) {
    // Only the three editable-measurement arrows (length / brim / width).
    // No right-side "gather" — crown already shows Gather above the tip.
    parts.push(
      verticalArrow(rightX, frame.brimTop, frame.hatBottom, [], rightLabelX),
    );
    parts.push(
      horizontalArrow(
        frame.hatBottom + 24,
        frame.hatLeft,
        frame.hatRight,
        [],
        frame.hatBottom + 46,
      ),
    );
    return parts.join("");
  }

  // Pattern mode: section heights with stitch/row counts + finished lengths.
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
      `<text x="${fmtNum(rightX + 8)}" y="${fmtNum(gatherMidY)}" text-anchor="start" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_SMALL)}>gather</text>`,
    );
    if (labels.castOn) {
      parts.push(
        `<text x="${fmtNum(rightX + 8)}" y="${fmtNum(gatherMidY + 22)}" text-anchor="start" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_DETAIL)}>${escapeXml(labels.castOn)}</text>`,
      );
    }
  }

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

function drawEditTargets(frame: Frame, mode: HatPatternDiagramMode): string {
  /**
   * Invisible anchors for Summary/Edit measurement chips.
   * Frame-relative so Gathered / Four-Gore / Swirl and all brim types share them.
   *
   * summaryEdit expands the left viewBox gutter; the length target sits in that
   * gutter (chip centered via transform) so it stays inside the diagram workspace.
   */
  const summaryEdit = mode === "summaryEdit";
  const circX = frame.hatMidX;
  // Pattern: below cast-on + width text. summaryEdit: just under the width arrow.
  const circY = Math.min(
    VB_H - 10,
    frame.hatBottom + (summaryEdit ? 48 : 96),
  );
  // summaryEdit: center of the left pad (left of Total / length arrow at 54).
  // pattern: far-left anchor (chips unused on finished pattern).
  const lengthX = summaryEdit
    ? -SUMMARY_EDIT_LEFT_PAD / 2
    : 6;
  const lengthY = (frame.crownTop + frame.hatBottom) / 2;
  // Beside the right brim arrow (rightX=338); chip translates further right.
  const brimX = summaryEdit ? 350 : VB_W - 6;
  const brimY = (frame.brimTop + frame.hatBottom) / 2;
  return [
    `<g class="hat-diagram__edit-targets" aria-hidden="true">`,
    `<circle id="${HAT_EDIT_MEASUREMENT_TARGETS.circumference}" cx="${fmtNum(circX)}" cy="${fmtNum(circY)}" r="5" fill="none"/>`,
    `<circle id="${HAT_EDIT_MEASUREMENT_TARGETS.length}" cx="${fmtNum(lengthX)}" cy="${fmtNum(lengthY)}" r="5" fill="none"/>`,
    `<circle id="${HAT_EDIT_MEASUREMENT_TARGETS.brimDepth}" cx="${fmtNum(brimX)}" cy="${fmtNum(brimY)}" r="5" fill="none"/>`,
    `</g>`,
  ].join("");
}

/**
 * Build a safe, responsive SVG diagram from the same `HatPatternCalc` used for instructions.
 * @param mode `pattern` (default) includes stitch/row counts and finished measurements;
 *   `summaryEdit` keeps silhouette, section labels, and measurement arrows only
 *   (editable chips are the value source — no sts/rows/inch/cm text on the SVG).
 */
export function buildHatPatternDiagramSvg(
  calc: HatPatternCalc,
  unit: HatPatternDiagramUnit,
  formatters: HatPatternDiagramFormatters,
  mode: HatPatternDiagramMode = HAT_PATTERN_DIAGRAM_MODE_PATTERN,
): string {
  const resolvedMode: HatPatternDiagramMode =
    mode === "summaryEdit" ? "summaryEdit" : "pattern";
  const frame = buildFrame(calc);
  const labels = buildLabels(calc, unit, formatters, resolvedMode);
  const crownAttr = frame.isWedge
    ? "wedge-4-decrease"
    : frame.isSpiral
      ? "spiral"
      : "gathered";
  const brimAttr = frame.brimType;

  const body = [
    drawBrim(frame),
    drawBody(frame),
    drawCrown(frame, labels),
    drawMeasurements(frame, labels, resolvedMode),
    drawEditTargets(frame, resolvedMode),
  ].join("");

  // Sanity: never emit broken numeric tokens.
  const safeBody = body
    .replace(/\bNaN\b/g, "0")
    .replace(/\bInfinity\b/g, "0")
    .replace(/\bundefined\b/g, "");

  const desc =
    resolvedMode === "summaryEdit"
      ? `Schematic hat measurement diagram with brim, body, and ${crownAttr} crown. Editable length, circumference, and brim height.`
      : `Schematic hat diagram with brim, body, and ${crownAttr} crown. Cast on ${labels.castOn}, finished width ${labels.width}, total length ${labels.height}.`;

  // summaryEdit: widen the left viewBox so the length chip fits in-diagram white space.
  const vbMinX = resolvedMode === "summaryEdit" ? -SUMMARY_EDIT_LEFT_PAD : 0;
  const vbWidth =
    resolvedMode === "summaryEdit" ? VB_W + SUMMARY_EDIT_LEFT_PAD : VB_W;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="hat-pattern-diagram-svg" viewBox="${vbMinX} 0 ${vbWidth} ${VB_H}" role="img" aria-labelledby="hat-diagram-title" data-hat-diagram="true" data-hat-diagram-mode="${resolvedMode}" data-crown="${crownAttr}" data-brim="${brimAttr}" width="100%" height="auto">`,
    `<title id="hat-diagram-title">${escapeXml(labels.title)}</title>`,
    `<desc>${escapeXml(desc)}</desc>`,
    // Embedded style reinforces print/PDF when CSS variables are unavailable.
    `<style type="text/css"><![CDATA[text{font-family:${FONT}}]]></style>`,
    `<rect x="${vbMinX}" y="0" width="${vbWidth}" height="${VB_H}" fill="#fff"/>`,
    safeBody,
    `</svg>`,
  ].join("");
}
