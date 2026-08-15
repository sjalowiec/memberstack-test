/**
 * Programmatic shaping-notation hat diagram SVG.
 *
 * Built from the same `HatPatternCalc` used by written instructions and the
 * Stitches & Rows diagram. Not a measurement diagram: no arrows, dimension
 * lines, or finished-size callouts. Construction references are cast-on and
 * row-counter labels beside horizontal section lines, plus crown shaping notation.
 */

import { formatShapingSegment } from "../shapingNotationCompress";
import { hatDiagramTypographyForViewBox } from "./hatDiagramTypography";
import {
  applyHatCrownCastOnAdjustment,
  buildFourWedgeCrownSetup,
  buildFourWedgeDecreaseSchedule,
  gatheredCrownRemainingStitches,
  hatBrimDisplayLabel,
  hatKnittedFinishedCircumferenceInches,
  resolveHatBrimType,
  type HatBrimType,
  type HatFourWedgeDecreaseSchedule,
  type HatPatternCalc,
} from "./hatMath";
import type {
  HatPatternDiagramFormatters,
  HatPatternDiagramUnit,
} from "./hatPatternDiagramSvg";
import { HAT_TRANSFER_STEP_ICON_SRC } from "./hatTransferStep";
import {
  SWIRL_CROWN_SECTION_COUNT_FALLBACK,
  SWIRL_REPRESENTATIVE_SECTION,
  buildSwirlCrownGeometry,
} from "./hatSwirlCrownGeometry";

/** Stable canvas — do not stretch via CSS to match the Stitches & Rows viewBox. */
const VB_W = 400;
const VB_H = 480;

const STROKE = "#1a1a1a";
/** Default soft fill for gathered / swirl crowns. */
const FILL = "#f4f6f1";
/** Four-gore body, brim, and non-representative gores. */
const FILL_WHITE = "#ffffff";
/** Very pale Knit It Now green — representative gore #2 only. */
const FILL_REP_GORE = "#eef3e6";
const MUTED = "#4b5563";
/** Representative gore (1-based) for shared stitch counts + highlight. */
const FOUR_GORE_REPRESENTATIVE = 2;

/**
 * Sizes scaled from Stitches & Rows so labels match visually at width:100%.
 * (Raw numbers differ because this viewBox is 400 vs reference 430.)
 */
const TYPE = hatDiagramTypographyForViewBox(VB_W);
const FONT = TYPE.fontFamily;
const FS_SECTION = TYPE.section; // Body, Single Layer / brim labels
const FS_CROWN_TITLE = TYPE.crownTitle; // Crown, Crown · Swirl
const FS_MEASURE = TYPE.measure; // RC, CO, shaping instruction
const FS_DETAIL = TYPE.detail; // per-gore stitch counts
const FS_GORE = TYPE.gore; // #1–#4
const FS_SMALL = TYPE.small; // fold
const FW_SECTION = TYPE.sectionWeight;
/** Supporting swirl construction cue — smaller than Crown · Swirl. */
const FS_SWIRL_SUPPORT = FS_SMALL;
/** Transfer icon in the swirl instruction line (~text height, slightly larger). */
const SWIRL_INSTRUCTION_ICON_SIZE = FS_SWIRL_SUPPORT + 4;
/** Vertical gap between stacked crown notation lines (baseline to baseline). */
const CROWN_NOTATION_GAP = Math.max(26, FS_MEASURE + 6);

/** Left gutter reserved so CO/RC labels stay inside the viewBox. */
const LABEL_GUTTER = 100;
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

/** Singular/plural stitch count for diagram labels (e.g. "1 st", "21 sts"). */
export function formatHatShapingStitchCountLabel(stitches: number): string {
  const n = Math.max(0, Math.round(stitches));
  return n === 1 ? "1 st" : `${n} sts`;
}

/**
 * Compact four-gore shaping token from the shared decrease schedule
 * (`1s-1r-10x` via {@link formatShapingSegment}). Not a second calc path.
 */
export function formatFourGoreShapingNotationSegment(
  schedule: HatFourWedgeDecreaseSchedule,
): string {
  if (schedule.decreaseCount <= 0) return "";
  return formatShapingSegment(1, schedule.rowFrequency, schedule.decreaseCount);
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
  /** Per-gore starting stitch label below each triangle (four-gore only), e.g. "21 sts". */
  goreStartLabel: string;
  /** Per-gore final stitch label above each tip (four-gore only), e.g. "1 st". */
  goreEndLabel: string;
  /** Calculated swirl sections (`HatSpiralPlan.decreasePoints`); 0 when not spiral. */
  spiralSectionCount: number;
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
  let goreStartLabel = "";
  let goreEndLabel = "";
  let spiralSectionCount = 0;
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
    const schedule = buildFourWedgeDecreaseSchedule(fourWedge.wedgeStitchCount);
    const startSts = Math.max(0, Math.round(fourWedge.wedgeStitchCount));
    goreStartLabel = startSts > 0 ? formatHatShapingStitchCountLabel(startSts) : "";
    goreEndLabel = formatHatShapingStitchCountLabel(schedule.finalWedgeStitchCount);
    const segment = formatFourGoreShapingNotationSegment(schedule);
    if (segment) crownLines.push(segment);
    // Total remaining stays in written instructions — omit from diagram.
    remaining = "";
  } else if (crownKind === "spiral") {
    title = "Swirl-top hat shaping notation diagram";
    const spiral = calc.crownPlan.spiral;
    if (spiral) {
      spiralSectionCount = spiral.decreasePoints;
      // Per-section notation (matches the highlighted representative wedge).
      // Whole-crown totals stay in written instructions.
      const perSectionStitches = 1;
      if (spiral.gradual > 0) {
        crownLines.push(formatShapingSegment(perSectionStitches, 2, spiral.gradual));
      }
      if (spiral.rapid > 0) {
        crownLines.push(formatShapingSegment(perSectionStitches, 1, spiral.rapid));
      }
      const perSectionEnd = Math.max(
        1,
        Math.round(spiral.targetStitches / Math.max(1, spiral.decreasePoints)),
      );
      remaining = formatHatShapingStitchCountLabel(perSectionEnd);
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
    goreStartLabel,
    goreEndLabel,
    spiralSectionCount,
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
  // Spiral needs room for construction cue above one-sided wedges + schedule below.
  crownVisual = clamp(
    crownVisual,
    crownKind === "gathered" ? 118 : crownKind === "spiral" ? 120 : 96,
    160,
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
  const circ = hatKnittedFinishedCircumferenceInches(calc);
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
  fontSize = FS_MEASURE,
): string {
  return lines
    .map((line, i) => {
      const y = firstBaselineY + i * gap;
      return `<text x="${fmtNum(midX)}" y="${fmtNum(y)}" text-anchor="middle" fill="${MUTED}" ${textFont(fontSize)}>${escapeXml(line)}</text>`;
    })
    .join("");
}

function drawBrim(frame: ShapingFrame, labels: ShapingLabels): string {
  const { hatLeft, hatRight, brimTop, hatBottom, brimType, hatWidth, hatMidX, crownKind } = frame;
  const fill = crownKind === "wedge" ? FILL_WHITE : FILL;
  const parts: string[] = [
    `<rect class="hat-shaping-diagram__brim" data-brim-style="${brimType}" x="${fmtNum(hatLeft)}" y="${fmtNum(brimTop)}" width="${fmtNum(hatWidth)}" height="${fmtNum(hatBottom - brimTop)}" fill="${fill}" stroke="${STROKE}" stroke-width="1.75"/>`,
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
  const { hatLeft, bodyTop, brimTop, hatMidX, hatWidth, crownKind } = frame;
  const fill = crownKind === "wedge" ? FILL_WHITE : FILL;
  // Swirl: reserve the upper Body for the schedule stack; keep Body lower.
  const midY =
    crownKind === "spiral"
      ? bodyTop + (brimTop - bodyTop) * 0.78
      : (bodyTop + brimTop) / 2;
  return [
    `<rect class="hat-shaping-diagram__body" x="${fmtNum(hatLeft)}" y="${fmtNum(bodyTop)}" width="${fmtNum(hatWidth)}" height="${fmtNum(brimTop - bodyTop)}" fill="${fill}" stroke="${STROKE}" stroke-width="1.75"/>`,
    `<text class="hat-shaping-diagram__body-label" x="${fmtNum(hatMidX)}" y="${fmtNum(midY)}" text-anchor="middle" dominant-baseline="middle" fill="${STROKE}" ${textFont(FS_SECTION, FW_SECTION)}>Body</text>`,
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
  const stackTopMin = headingY + FS_CROWN_TITLE + 10;
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
    `<text x="${fmtNum(hatMidX)}" y="${fmtNum(headingY)}" text-anchor="middle" fill="${STROKE}" ${textFont(FS_CROWN_TITLE, FW_SECTION)}>Crown</text>`,
    drawNotationStack(labels.crownLines, hatMidX, firstBaseline),
    `</g>`,
  ].join("");
}

function drawFourGoreCrown(frame: ShapingFrame, labels: ShapingLabels): string {
  const { hatLeft, hatRight, crownTop, bodyTop, brimTop, hatWidth } = frame;
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

  const repLeft = hatLeft + (hatWidth * (FOUR_GORE_REPRESENTATIVE - 1)) / peaks;
  const repRight = hatLeft + (hatWidth * FOUR_GORE_REPRESENTATIVE) / peaks;
  const repX = (repLeft + repRight) / 2;
  const repGorePath = [
    `M ${fmtNum(repLeft)} ${fmtNum(bodyTop)}`,
    `L ${fmtNum(repX)} ${fmtNum(tipY)}`,
    `L ${fmtNum(repRight)} ${fmtNum(bodyTop)}`,
    "Z",
  ].join(" ");

  const crownHeight = Math.max(1, bodyTop - tipY);
  // Final count above the tip; gore # in the lower portion; start below base.
  // Labels stay outside the shaded triangle (above tip / below base).
  const endLabelY = Math.max(FS_DETAIL + 2, tipY - 6);
  const goreNumY = Math.min(
    tipY + crownHeight * 0.78,
    bodyTop - Math.max(12, FS_GORE * 0.45),
  );
  const bodyMidY = (bodyTop + brimTop) / 2;
  const startBelowBase = bodyTop + Math.max(FS_DETAIL + 10, 22);
  const startClearOfBody = bodyMidY - FS_SECTION * 0.55;
  const startLabelY = Math.min(startBelowBase, startClearOfBody);
  // Schedule / final / start share the representative gore centerline.
  const scheduleY = Math.max(18, endLabelY - Math.max(CROWN_NOTATION_GAP, FS_MEASURE + 4));

  const goreAnnotations = [1, 2, 3, 4]
    .map((n) => {
      const left = hatLeft + (hatWidth * (n - 1)) / peaks;
      const right = hatLeft + (hatWidth * n) / peaks;
      const x = (left + right) / 2;
      const isRepresentative = n === FOUR_GORE_REPRESENTATIVE;
      const parts: string[] = [];
      if (isRepresentative && labels.goreEndLabel) {
        parts.push(
          `<text class="hat-shaping-diagram__gore-end" data-gore="${n}" data-gore-end-sts="true" data-gore-representative="true" x="${fmtNum(repX)}" y="${fmtNum(endLabelY)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_DETAIL)}>${escapeXml(labels.goreEndLabel)}</text>`,
        );
      }
      parts.push(
        `<text class="hat-shaping-diagram__gore-number" data-gore="${n}" x="${fmtNum(x)}" y="${fmtNum(goreNumY)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_GORE)}>#${n}</text>`,
      );
      if (isRepresentative && labels.goreStartLabel) {
        parts.push(
          `<text class="hat-shaping-diagram__gore-start" data-gore="${n}" data-gore-start-sts="true" data-gore-representative="true" x="${fmtNum(repX)}" y="${fmtNum(startLabelY)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_DETAIL)}>${escapeXml(labels.goreStartLabel)}</text>`,
        );
      }
      return parts.join("");
    })
    .join("");

  const scheduleLine = labels.crownLines[0] ?? "";
  const scheduleText = scheduleLine
    ? `<text class="hat-shaping-diagram__schedule" data-hat-shaping-schedule="true" x="${fmtNum(repX)}" y="${fmtNum(scheduleY)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_MEASURE)}>${escapeXml(scheduleLine)}</text>`
    : "";

  return [
    `<g class="hat-shaping-diagram__crown hat-shaping-diagram__crown--four-gore" data-crown-style="wedge-4-decrease">`,
    `<polyline points="${pts.join(" ")}" fill="${FILL_WHITE}" stroke="none"/>`,
    `<path class="hat-shaping-diagram__gore-fill" data-gore="${FOUR_GORE_REPRESENTATIVE}" data-gore-representative="true" d="${repGorePath}" fill="${FILL_REP_GORE}" stroke="none"/>`,
    `<polyline points="${pts.join(" ")}" fill="none" stroke="${STROKE}" stroke-width="1.75"/>`,
    `<line class="hat-shaping-diagram__crown-start" x1="${fmtNum(hatLeft)}" y1="${fmtNum(bodyTop)}" x2="${fmtNum(hatRight)}" y2="${fmtNum(bodyTop)}" stroke="${STROKE}" stroke-width="1.25" stroke-dasharray="6 4" fill="none"/>`,
    scheduleText,
    goreAnnotations,
    `</g>`,
  ].join("");
}

/**
 * Swirl crown: shared one-sided sawtooth geometry + construction cue.
 * Schedule notation sits below the crown base so it does not cover wedge lines.
 */
function drawSwirlCrown(frame: ShapingFrame, labels: ShapingLabels): string {
  const { hatLeft, hatRight, crownTop, bodyTop, brimTop, hatMidX, hatWidth } = frame;
  const sectionCount =
    labels.spiralSectionCount > 0
      ? labels.spiralSectionCount
      : SWIRL_CROWN_SECTION_COUNT_FALLBACK;

  const supportGap = FS_SWIRL_SUPPORT + 4;
  const instructionIconSize = SWIRL_INSTRUCTION_ICON_SIZE;
  const headerStackHeight =
    FS_CROWN_TITLE * 0.55 +
    10 +
    supportGap +
    Math.max(FS_SWIRL_SUPPORT, instructionIconSize) * 0.55 +
    14;
  const crownTitleY = Math.max(18, crownTop - headerStackHeight);
  const labelFirstY = crownTitleY + FS_CROWN_TITLE * 0.55 + 10;
  const labelSecondY = labelFirstY + supportGap;
  const headerBottom =
    labelSecondY + Math.max(FS_SWIRL_SUPPORT, instructionIconSize) * 0.45;
  // Room between construction cue and wedge tips for the final-count label.
  const endLabelClearanceAbove = Math.max(12, FS_SWIRL_SUPPORT * 0.55 + 8);
  const endLabelClearanceBelow = Math.max(10, FS_MEASURE * 0.45 + 6);
  const endLabelBand =
    FS_MEASURE + endLabelClearanceAbove + endLabelClearanceBelow;
  const minCrownDrawHeight = 48;
  const tipY = clamp(
    Math.max(crownTop + 6, headerBottom + endLabelBand),
    crownTop + 6,
    bodyTop - minCrownDrawHeight,
  );

  const geometry = buildSwirlCrownGeometry({
    hatLeft,
    hatWidth,
    tipY,
    bodyTop,
    sectionCount,
    representativeIndex: SWIRL_REPRESENTATIVE_SECTION,
    fmt: fmtNum,
  });

  const repSection =
    geometry.sections.find((s) => s.index === geometry.representativeIndex) ??
    geometry.sections[0];

  const sectionGroups = geometry.sections.map(
    (section) =>
      `<g class="hat-shaping-diagram__swirl-section" data-section-index="${section.index}" data-decrease-edge="${section.decreaseEdge}" data-non-decrease-edge="${section.nonDecreaseEdge}" data-decrease-x1="${fmtNum(section.left)}" data-decrease-y1="${fmtNum(section.tipY)}" data-decrease-x2="${fmtNum(section.right)}" data-decrease-y2="${fmtNum(section.bodyTop)}" data-non-decrease-x1="${fmtNum(section.left)}" data-non-decrease-y1="${fmtNum(section.tipY)}" data-non-decrease-x2="${fmtNum(section.left)}" data-non-decrease-y2="${fmtNum(section.bodyTop)}"></g>`,
  );

  const instruction = "decrease at one edge";
  const textWidth = instruction.length * FS_SWIRL_SUPPORT * 0.52;
  // Visible gap between transfer icon and instruction text.
  const iconGap = 10;
  const groupWidth = instructionIconSize + iconGap + textWidth;
  const groupLeft = hatMidX - groupWidth / 2;
  const iconX = groupLeft;
  const iconY = labelSecondY - instructionIconSize / 2;
  const textX = groupLeft + instructionIconSize + iconGap;

  // Bottom-up Japanese reading:
  // end count above the representative tip; rapid then gradual in the upper Body.
  const gradualSeg = labels.crownLines.find((line) => /-2r-/.test(line)) ?? "";
  const rapidSeg = labels.crownLines.find((line) => /-1r-/.test(line)) ?? "";
  const endLabel = labels.remaining;
  const repX = repSection
    ? (repSection.left + repSection.right) / 2
    : hatMidX;
  // Final count outside the wedge: below the cue, above the tip, with clear gaps.
  const endY = clamp(
    tipY - endLabelClearanceBelow,
    headerBottom + endLabelClearanceAbove,
    tipY - endLabelClearanceBelow,
  );
  const scheduleGap = Math.max(20, FS_MEASURE + 2);
  const scheduleTopMin = bodyTop + Math.max(16, FS_MEASURE * 0.55);
  const bodyLabelY = bodyTop + (brimTop - bodyTop) * 0.78;
  const bodyClearance = FS_SECTION * 0.55 + 14;
  const scheduleBottomMax = bodyLabelY - bodyClearance;
  const scheduleSlots = (rapidSeg ? 1 : 0) + (gradualSeg ? 1 : 0);
  let rapidY = scheduleTopMin;
  let gradualY = scheduleTopMin + (rapidSeg ? scheduleGap : 0);
  if (gradualY > scheduleBottomMax && scheduleSlots > 1) {
    const compressedGap = Math.max(
      16,
      (scheduleBottomMax - scheduleTopMin) / (scheduleSlots - 1),
    );
    rapidY = scheduleTopMin;
    gradualY = scheduleTopMin + (rapidSeg ? compressedGap : 0);
  }
  // Ensure both schedule lines stay strictly below the crown base.
  rapidY = Math.max(rapidY, bodyTop + 12);
  gradualY = Math.max(gradualY, rapidSeg ? rapidY + 16 : bodyTop + 12);

  const scheduleParts: string[] = [];
  if (endLabel) {
    scheduleParts.push(
      `<text class="hat-shaping-diagram__swirl-end" data-swirl-schedule-role="end" data-swirl-end-placement="above-tip" x="${fmtNum(repX)}" y="${fmtNum(endY)}" text-anchor="middle" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_MEASURE)}>${escapeXml(endLabel)}</text>`,
    );
  }
  if (rapidSeg) {
    scheduleParts.push(
      `<text class="hat-shaping-diagram__swirl-rapid" data-swirl-schedule-role="rapid" data-swirl-schedule-placement="body" x="${fmtNum(repX)}" y="${fmtNum(rapidY)}" text-anchor="middle" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_MEASURE)}>${escapeXml(rapidSeg)}</text>`,
    );
  }
  if (gradualSeg) {
    scheduleParts.push(
      `<text class="hat-shaping-diagram__swirl-gradual" data-swirl-schedule-role="gradual" data-swirl-schedule-placement="body" x="${fmtNum(repX)}" y="${fmtNum(gradualY)}" text-anchor="middle" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_MEASURE)}>${escapeXml(gradualSeg)}</text>`,
    );
  }

  return [
    `<g class="hat-shaping-diagram__crown hat-shaping-diagram__crown--swirl" data-crown-style="spiral" data-swirl-section-count="${geometry.sectionCount}" data-swirl-decrease-edge="${geometry.decreaseEdge}">`,
    `<text class="hat-shaping-diagram__swirl-title" x="${fmtNum(hatMidX)}" y="${fmtNum(crownTitleY)}" text-anchor="middle" fill="${STROKE}" ${textFont(FS_CROWN_TITLE, FW_SECTION)}>Crown · Swirl</text>`,
    `<text class="hat-shaping-diagram__swirl-section-label" data-swirl-section-label="${geometry.sectionCount} sections" data-swirl-label-placement="above-crown" x="${fmtNum(hatMidX)}" y="${fmtNum(labelFirstY)}" text-anchor="middle" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_SWIRL_SUPPORT)}>${escapeXml(`${geometry.sectionCount} sections`)}</text>`,
    `<g class="hat-shaping-diagram__swirl-instruction" data-swirl-instruction="decrease-one-edge">`,
    `<image class="hat-shaping-diagram__swirl-instruction-icon" href="${HAT_TRANSFER_STEP_ICON_SRC}" xlink:href="${HAT_TRANSFER_STEP_ICON_SRC}" x="${fmtNum(iconX)}" y="${fmtNum(iconY)}" width="${fmtNum(instructionIconSize)}" height="${fmtNum(instructionIconSize)}" />`,
    `<text class="hat-shaping-diagram__swirl-instruction-text" x="${fmtNum(textX)}" y="${fmtNum(labelSecondY)}" text-anchor="start" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_SWIRL_SUPPORT)}>${escapeXml(instruction)}</text>`,
    `</g>`,
    `<polyline class="hat-shaping-diagram__swirl-outline" points="${geometry.outlinePoints}" fill="${FILL_WHITE}" stroke="none"/>`,
    repSection
      ? `<path class="hat-shaping-diagram__swirl-section-fill" data-section-index="${repSection.index}" data-swirl-representative="true" d="${repSection.pathD}" fill="${FILL_REP_GORE}" stroke="none"/>`
      : "",
    `<polyline class="hat-shaping-diagram__swirl-outline-stroke" points="${geometry.outlinePoints}" fill="none" stroke="${STROKE}" stroke-width="1.75"/>`,
    sectionGroups.join(""),
    `<line class="hat-shaping-diagram__crown-start" x1="${fmtNum(hatLeft)}" y1="${fmtNum(bodyTop)}" x2="${fmtNum(hatRight)}" y2="${fmtNum(bodyTop)}" stroke="${STROKE}" stroke-width="1.25" stroke-dasharray="6 4" fill="none"/>`,
    scheduleParts.length > 0
      ? `<g class="hat-shaping-diagram__swirl-schedule" data-hat-shaping-swirl-schedule="true" data-swirl-schedule-order="bottom-up">${scheduleParts.join("")}</g>`
      : "",
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
      `<text class="hat-shaping-diagram__cast-on" x="${fmtNum(labelX)}" y="${fmtNum(frame.hatBottom)}" text-anchor="end" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_MEASURE)}>${escapeXml(labels.castOn)}</text>`,
    );
  }
  if (labels.brimEndRc) {
    parts.push(
      `<text class="hat-shaping-diagram__brim-body-rc" x="${fmtNum(labelX)}" y="${fmtNum(frame.brimTop)}" text-anchor="end" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_MEASURE)}>${escapeXml(labels.brimEndRc)}</text>`,
    );
  }
  if (labels.crownBeginRc) {
    parts.push(
      `<text class="hat-shaping-diagram__crown-begin-rc" x="${fmtNum(labelX)}" y="${fmtNum(frame.bodyTop)}" text-anchor="end" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_MEASURE)}>${escapeXml(labels.crownBeginRc)}</text>`,
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

/** Exported for typography tests — sizes used by the shaping-notation diagram. */
export const HAT_SHAPING_NOTATION_TYPE = {
  section: FS_SECTION,
  crownTitle: FS_CROWN_TITLE,
  measure: FS_MEASURE,
  detail: FS_DETAIL,
  gore: FS_GORE,
  small: FS_SMALL,
  sectionWeight: FW_SECTION,
  fontFamily: FONT,
} as const;
