/**
 * Programmatic Shaping Notation SVG for Sleeveless Pullover V-neck Front.
 *
 * Live Pullover V-neck Front Shaping Notation renderer.
 * Consumes finalized {@link SleevelessBackPatternResult} plus the existing
 * notation / RC helpers. No second calculation layer.
 *
 * Architecture follows Hat generated notation (string SVG, fixed viewBox,
 * construction labels, NaN sanitization). Geometry is Sleeveless-specific.
 */

import {
  displayRcFromGarmentRc,
  pulloverArmholeEvents,
} from "./frontArmholeNecklineComposition";
import { collectInnerNeckDecreasePointsFromTimeline } from "./notationOverlaySvg";
import {
  armholeBindOffDecreaseFromEachSide,
  formatRcNotation,
} from "./sleevelessBackJapaneseNotation";
import { isSleevelessCardiganGarmentStyle } from "./sleevelessFrontDiagramSrc";
import {
  buildFrontJapaneseNotationReplacements,
  isSleevelessPulloverVNeckFrontNotation,
  resolveFrontVNeckNotationRcModel,
} from "./sleevelessFrontJapaneseNotation";
import { shoulderStitchesPerSideForDiagram } from "./sleevelessGarmentDiagramReplacements";
import {
  compressStitchDecreasePointsToNotationLines,
  type StitchDecreasePoint,
} from "./shapingNotationCompress";
import { collectCompleteShoulderShapingPoints } from "./shoulderShapingNotation";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";

const VB_W = 400;
const VB_H = 480;

const STROKE = "#1a1a1a";
const FILL = "#f4f6f1";
const MUTED = "#4b5563";
const GUIDE = "#bdbec0";
const FONT = "Poppins, system-ui, Arial, sans-serif";
const FS_RC = 12;
const FS_NOTATION = 13;
const NOTATION_GAP = 16;
const NECK_NOTATION_GAP = 20;

const LABEL_GUTTER = 88;
const RIGHT_PAD = 92;
const TOP = 52;
/** Shared left X for the right-side armhole notation stack (`text-anchor="start"`). */
const ARMHOLE_LABEL_START_X = LABEL_GUTTER + (VB_W - LABEL_GUTTER - RIGHT_PAD) + 12;
/** Right-edge cap so the left-aligned stack stays inside the viewBox. */
const ARMHOLE_LABEL_SAFE_MAX_X = VB_W - 16;
const BOTTOM = 428;
const MIN_HEM = 16;
const MIN_BODY = 56;
const MIN_SHAPING = 100;
const MIN_SHOULDER = 28;
const REF_BUST_STS = 80;

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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function textFont(size: number, weight?: number): string {
  const w = weight != null ? ` font-weight="${weight}"` : "";
  return `font-family="${FONT}" font-size="${size}"${w}`;
}

function finiteOr(n: unknown, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

type YBand = {
  rc0: number;
  rc1: number;
  yBottom: number;
  yTop: number;
};

type NotationFrame = {
  cx: number;
  left: number;
  right: number;
  afterLeft: number;
  afterRight: number;
  boLeft: number;
  boRight: number;
  neckLeft: number;
  neckRight: number;
  hemY: number;
  bottomY: number;
  neckStartY: number;
  armholeStartY: number;
  lastArmholeY: number;
  shoulderY: number;
  shoulderTopY: number;
  neckCornerY: number;
  bodyWidth: number;
};

type Pt = { x: number; y: number };

type NotationLabels = {
  castOn: string;
  armholeBo: string;
  armholeShaping: string;
  neckShaping: string;
  shoulderShaping: string;
  rcCastOn: string;
  rcHem: string;
  rcArmholeBo: string;
  rcReset: string;
  rcNeckStart: string;
  rcShoulderStart: string;
};

function yAtRc(rc: number, bands: readonly YBand[]): number {
  if (bands.length === 0) return BOTTOM;
  if (rc <= bands[0]!.rc0) return bands[0]!.yBottom;
  for (let i = 0; i < bands.length; i += 1) {
    const band = bands[i]!;
    const isLast = i === bands.length - 1;
    if (rc <= band.rc1 || isLast) {
      const span = band.rc1 - band.rc0;
      if (!(span > 0)) return band.yBottom;
      const t = clamp((rc - band.rc0) / span, 0, 1);
      return band.yBottom + t * (band.yTop - band.yBottom);
    }
  }
  return bands[bands.length - 1]!.yTop;
}

function allocateBands(args: {
  hemRc: number;
  firstShapeRc: number;
  shoulderRc: number;
  endRc: number;
}): YBand[] {
  const hemRc = Math.max(0, args.hemRc);
  const firstShapeRc = Math.max(hemRc, args.firstShapeRc);
  const shoulderRc = Math.max(firstShapeRc, args.shoulderRc);
  const endRc = Math.max(shoulderRc, args.endRc);

  const usable = BOTTOM - TOP;
  const hemRows = Math.max(0, hemRc);
  const bodyRows = Math.max(0, firstShapeRc - hemRc);
  const shapeRows = Math.max(0, shoulderRc - firstShapeRc);
  const shoulderRows = Math.max(0, endRc - shoulderRc);
  const totalRows = Math.max(1, hemRows + bodyRows + shapeRows + shoulderRows);

  let hemH = hemRows > 0 ? Math.max(MIN_HEM, (hemRows / totalRows) * usable) : 0;
  let bodyH = Math.max(MIN_BODY, (bodyRows / totalRows) * usable);
  let shapeH = Math.max(MIN_SHAPING, (shapeRows / totalRows) * usable);
  let shoulderH = Math.max(MIN_SHOULDER, (shoulderRows / totalRows) * usable);

  let sum = hemH + bodyH + shapeH + shoulderH;
  if (sum > usable && sum > 0) {
    const k = usable / sum;
    hemH *= k;
    bodyH *= k;
    shapeH *= k;
    shoulderH *= k;
  } else if (sum < usable) {
    bodyH += usable - sum;
  }

  const hemY = BOTTOM - hemH;
  const firstShapeY = hemY - bodyH;
  const shoulderY = firstShapeY - shapeH;
  const endY = shoulderY - shoulderH;

  const bands: YBand[] = [];
  if (hemRows > 0) {
    bands.push({ rc0: 0, rc1: hemRc, yBottom: BOTTOM, yTop: hemY });
  }
  bands.push({
    rc0: hemRows > 0 ? hemRc : 0,
    rc1: firstShapeRc,
    yBottom: hemRows > 0 ? hemY : BOTTOM,
    yTop: firstShapeY,
  });
  bands.push({
    rc0: firstShapeRc,
    rc1: shoulderRc,
    yBottom: firstShapeY,
    yTop: shoulderY,
  });
  bands.push({
    rc0: shoulderRc,
    rc1: endRc,
    yBottom: shoulderY,
    yTop: endY,
  });
  return bands;
}

function buildLabels(
  result: SleevelessBackPatternResult,
  patternData: unknown,
): NotationLabels {
  const repl = buildFrontJapaneseNotationReplacements(result, patternData);
  return {
    castOn: repl["jp-caston"] ?? "",
    armholeBo: repl["jp-armhole-bo"] ?? "",
    armholeShaping: repl["jp-armhole-shaping"] ?? "",
    neckShaping: repl["jp-neckline-shaping"] ?? "",
    shoulderShaping: pulloverVNeckFrontShoulderNotationLines(result).join("\n"),
    rcCastOn: repl["rc-caston"] ?? "",
    rcHem: repl["rc-hem"] ?? "",
    rcArmholeBo: repl["rc-armhole-bo"] ?? "",
    rcReset: repl.rc_reset ?? "",
    rcNeckStart: repl["rc-neckline-start"] ?? "",
    rcShoulderStart: repl["rc-shoulder-start"] ?? "",
  };
}

/**
 * Pullover V-neck Front shoulder bind-off points at/after shoulder start.
 * Excludes composed armhole bind-offs that share `edge: "outer"` on the front timeline.
 */
export function pulloverVNeckFrontShoulderPoints(
  result: SleevelessBackPatternResult,
): StitchDecreasePoint[] {
  const timeline =
    result.frontNeckShoulderTimeline ??
    result.frontNeckShoulderShapingChart.timeline ??
    [];
  if (timeline.length === 0) return [];
  const budget = shoulderStitchesPerSideForDiagram(result.debug);
  const points = collectCompleteShoulderShapingPoints(timeline, "right", undefined, {
    shoulderStitchesBudget: budget,
  });
  const shoulderStart = result.debug.shoulderStartRow;
  if (shoulderStart !== undefined && Number.isFinite(shoulderStart)) {
    return points.filter((p) => p.row >= Math.floor(shoulderStart));
  }
  return points;
}

/**
 * Pullover V-neck Front shoulder summaries: outer bind-offs at/after shoulder start.
 */
export function pulloverVNeckFrontShoulderNotationLines(
  result: SleevelessBackPatternResult,
): string[] {
  return compressStitchDecreasePointsToNotationLines(pulloverVNeckFrontShoulderPoints(result));
}

function shoulderBandHeight(bands: readonly YBand[], shoulderY: number): number {
  const last = bands[bands.length - 1];
  if (!last) return MIN_SHOULDER;
  return Math.max(8, shoulderY - last.yTop);
}

/** One visible slope: armhole-side shoulder start → neck-side shoulder corner. */
function buildShoulderSlopeEnds(
  passes: readonly StitchDecreasePoint[],
  bandH: number,
): { tX: number; tY: number }[] {
  const start = { tX: 0, tY: 0 };
  const total = passes.reduce((sum, p) => sum + Math.max(0, p.amount), 0);
  if (passes.length === 0 || !(total > 0) || !(bandH > 0)) return [start];
  return [start, { tX: 1, tY: bandH }];
}

function mapShoulderCorners(
  corners: readonly { tX: number; tY: number }[],
  outerX: number,
  innerX: number,
  shoulderY: number,
): Pt[] {
  const span = innerX - outerX;
  return corners.map((c) => ({
    x: outerX + c.tX * span,
    y: shoulderY - c.tY,
  }));
}

function buildFrame(
  result: SleevelessBackPatternResult,
  shoulderPasses: readonly StitchDecreasePoint[],
): {
  frame: NotationFrame;
  bands: YBand[];
  neckStartGarmentRc: number;
  lastArmholeGarmentRc: number;
  bindOffSts: number;
} {
  const d = result.debug;
  const rcModel = resolveFrontVNeckNotationRcModel(result);
  const overlap = d.frontArmholeNecklineOverlap;
  const hemRc = Math.max(0, Math.floor(finiteOr(d.hemRows, 0)));
  const armholeStart = Math.max(
    0,
    Math.floor(finiteOr(rcModel.armholeBoGarmentRc, d.armholeStartRow ?? 0)),
  );
  const neckStartGarmentRc = Math.max(
    0,
    Math.floor(
      finiteOr(overlap?.divideGarmentRc, finiteOr(d.frontNecklineStartRC, armholeStart)),
    ),
  );
  const eachSide = d.armholeStitchesEachSide;
  const { bindOffSts, decreaseSts } =
    eachSide !== undefined
      ? armholeBindOffDecreaseFromEachSide(eachSide)
      : { bindOffSts: 0, decreaseSts: 0 };
  const armholeEvents = pulloverArmholeEvents({
    firstArmholeGarmentRc: armholeStart,
    bindOffSts,
    decreaseSts,
  });
  const lastDecrease = [...armholeEvents]
    .filter((ev) => ev.kind === "decrease")
    .reduce((max, ev) => Math.max(max, ev.garmentRc), armholeStart);
  const lastArmholeGarmentRc = Math.max(
    armholeStart,
    Math.floor(finiteOr(overlap?.lastArmholeGarmentRc, lastDecrease)),
  );
  const shoulderRc = Math.max(
    lastArmholeGarmentRc,
    Math.floor(finiteOr(d.shoulderStartRow, lastArmholeGarmentRc)),
  );
  const endRc = Math.max(
    shoulderRc,
    Math.floor(finiteOr(d.frontFinalRow, finiteOr(d.expectedGarmentRows, shoulderRc))),
  );
  const firstShapeRc = Math.min(neckStartGarmentRc, armholeStart);
  const bands = allocateBands({
    hemRc,
    firstShapeRc,
    shoulderRc,
    endRc,
  });

  const bustSts = Math.max(
    1,
    Math.round(finiteOr(d.bustBodyStitches, finiteOr(d.hemCastOnStitches, d.backStitches))),
  );
  const afterSts = Math.max(
    1,
    Math.round(finiteOr(d.stitchesAfterArmhole, bustSts)),
  );
  const neckSts = Math.max(0, Math.round(finiteOr(d.necklineStitches, 0)));
  const maxBodyW = VB_W - LABEL_GUTTER - RIGHT_PAD;
  const widthScale = clamp(bustSts / REF_BUST_STS, 0.6, 1.25);
  const bodyWidth = maxBodyW * (widthScale / 1.25);
  const cx = LABEL_GUTTER + maxBodyW / 2;
  const half = bodyWidth / 2;
  const afterHalf = Math.max(18, half * (afterSts / bustSts));
  const boInset = Math.max(0, half * (bindOffSts / bustSts));
  const neckHalf = Math.max(10, Math.min(afterHalf - 8, half * (neckSts / 2 / bustSts)));

  const bottomY = yAtRc(0, bands);
  const hemY = hemRc > 0 ? yAtRc(hemRc, bands) : bottomY;
  const neckStartY = yAtRc(neckStartGarmentRc, bands);
  const armholeStartY = yAtRc(armholeStart, bands);
  const lastArmholeY = yAtRc(lastArmholeGarmentRc, bands);
  const shoulderY = yAtRc(shoulderRc, bands);
  const bandH = shoulderBandHeight(bands, shoulderY);
  const slopeEnds = buildShoulderSlopeEnds(shoulderPasses, bandH);
  const lastCorner = slopeEnds[slopeEnds.length - 1]!;
  const shoulderTopY = shoulderY - lastCorner.tY;
  const neckCornerY = shoulderPasses.length > 0 ? shoulderTopY : shoulderY;

  return {
    frame: {
      cx,
      left: cx - half,
      right: cx + half,
      afterLeft: cx - afterHalf,
      afterRight: cx + afterHalf,
      boLeft: cx - half + boInset,
      boRight: cx + half - boInset,
      neckLeft: cx - neckHalf,
      neckRight: cx + neckHalf,
      hemY,
      bottomY,
      neckStartY,
      armholeStartY,
      lastArmholeY,
      shoulderY,
      shoulderTopY,
      neckCornerY,
      bodyWidth,
    },
    bands,
    neckStartGarmentRc,
    lastArmholeGarmentRc,
    bindOffSts,
  };
}

function drawNotationStack(
  lines: readonly string[],
  x: number,
  lastBaselineY: number,
  attrs: string,
  textAnchor: "middle" | "start" | "end" = "middle",
  gap: number = NOTATION_GAP,
): string {
  const cleaned = lines.filter((line) => line.length > 0);
  if (cleaned.length === 0) return "";
  return cleaned
    .map((line, i) => {
      const y = lastBaselineY - i * gap;
      return `<text x="${fmtNum(x)}" y="${fmtNum(y)}" text-anchor="${textAnchor}" fill="${MUTED}" ${textFont(FS_NOTATION)} ${attrs}>${escapeXml(line)}</text>`;
    })
    .join("");
}

function polylineD(points: readonly Pt[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${fmtNum(p.x)} ${fmtNum(p.y)}`)
    .join(" ");
}

function drawSilhouette(
  frame: NotationFrame,
  leftShoulder: readonly Pt[],
  rightShoulder: readonly Pt[],
): string {
  const leftSteps = leftShoulder.slice(1);
  const rightDown = [...rightShoulder].reverse().slice(1);
  const path = [
    `M ${fmtNum(frame.left)} ${fmtNum(frame.bottomY)}`,
    `L ${fmtNum(frame.left)} ${fmtNum(frame.armholeStartY)}`,
    `L ${fmtNum(frame.boLeft)} ${fmtNum(frame.armholeStartY)}`,
    `L ${fmtNum(frame.afterLeft)} ${fmtNum(frame.lastArmholeY)}`,
    `L ${fmtNum(frame.afterLeft)} ${fmtNum(frame.shoulderY)}`,
    ...leftSteps.map((p) => `L ${fmtNum(p.x)} ${fmtNum(p.y)}`),
    `L ${fmtNum(frame.neckLeft)} ${fmtNum(frame.neckCornerY)}`,
    `L ${fmtNum(frame.cx)} ${fmtNum(frame.neckStartY)}`,
    `L ${fmtNum(frame.neckRight)} ${fmtNum(frame.neckCornerY)}`,
    ...rightDown.map((p) => `L ${fmtNum(p.x)} ${fmtNum(p.y)}`),
    `L ${fmtNum(frame.afterRight)} ${fmtNum(frame.shoulderY)}`,
    `L ${fmtNum(frame.afterRight)} ${fmtNum(frame.lastArmholeY)}`,
    `L ${fmtNum(frame.boRight)} ${fmtNum(frame.armholeStartY)}`,
    `L ${fmtNum(frame.right)} ${fmtNum(frame.armholeStartY)}`,
    `L ${fmtNum(frame.right)} ${fmtNum(frame.bottomY)}`,
    "Z",
  ].join(" ");
  return [
    `<path class="sleeveless-vneck-notation__body" d="${path}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    `<path data-role="left-shoulder-path" d="${polylineD(leftShoulder)}" fill="none" stroke="none"/>`,
    `<path data-role="right-shoulder-path" d="${polylineD(rightShoulder)}" fill="none" stroke="none"/>`,
  ].join("");
}

function dashedLine(
  x1: number,
  y: number,
  x2: number,
  role: string,
  extra = "",
): string {
  return `<line data-role="${role}" x1="${fmtNum(x1)}" y1="${fmtNum(y)}" x2="${fmtNum(x2)}" y2="${fmtNum(y)}" stroke="${GUIDE}" stroke-width="1" stroke-dasharray="4 3" fill="none"${extra}/>`;
}

function rcText(
  x: number,
  y: number,
  text: string,
  role: string,
  extra = "",
): string {
  if (!text) return "";
  return `<text data-role="${role}" x="${fmtNum(x)}" y="${fmtNum(y)}" text-anchor="end" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_RC)}${extra}>${escapeXml(text)}</text>`;
}

function eventHook(
  role: string,
  displayRc: number,
  garmentRc: number,
  y: number,
  shared: boolean,
): string {
  const rcAttr = formatRcNotation(displayRc);
  const sharedAttr = shared ? ` data-shared-rc="true"` : "";
  return `<g data-role="${role}" data-rc="${escapeXml(rcAttr)}" data-garment-rc="${fmtNum(garmentRc)}" data-y="${fmtNum(y)}"${sharedAttr}></g>`;
}

/**
 * Build a responsive Pullover V-neck Front Shaping Notation SVG from the
 * finalized sleeveless result. Labels reuse {@link buildFrontJapaneseNotationReplacements}.
 */
export function buildSleevelessFrontVNeckShapingNotationDiagramSvg(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): string {
  const supported = isSleevelessPulloverVNeckFrontNotation(result, patternData);
  if (!supported || !result.frontNeckShoulderChartUsesLiveRows) {
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" class="sleeveless-vneck-notation-svg" viewBox="0 0 ${VB_W} ${VB_H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" data-sleeveless-vneck-generated-notation="true" data-supported="false">`,
      `<title>Sleeveless V-neck Front shaping notation unavailable</title>`,
      `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#fff"/>`,
      `</svg>`,
    ].join("");
  }

  const d = result.debug;
  const rcModel = resolveFrontVNeckNotationRcModel(result);
  const labels = buildLabels(result, patternData ?? { style: { neckline: "v-neck" } });
  const shoulderPasses = pulloverVNeckFrontShoulderPoints(result);
  const { frame, bands, neckStartGarmentRc, lastArmholeGarmentRc, bindOffSts } =
    buildFrame(result, shoulderPasses);
  const shoulderBandH = shoulderBandHeight(bands, frame.shoulderY);
  const slopeEnds = buildShoulderSlopeEnds(shoulderPasses, shoulderBandH);
  const leftShoulder = mapShoulderCorners(
    slopeEnds,
    frame.afterLeft,
    frame.neckLeft,
    frame.shoulderY,
  );
  const rightShoulder = mapShoulderCorners(
    slopeEnds,
    frame.afterRight,
    frame.neckRight,
    frame.shoulderY,
  );
  const shoulderSts = shoulderPasses.reduce((sum, p) => sum + Math.max(0, p.amount), 0);
  const armholeStart = Math.max(0, Math.floor(finiteOr(rcModel.armholeBoGarmentRc, 0)));
  const eachSide = d.armholeStitchesEachSide;
  const { decreaseSts } =
    eachSide !== undefined
      ? armholeBindOffDecreaseFromEachSide(eachSide)
      : { decreaseSts: 0 };
  const armholeEvents = pulloverArmholeEvents({
    firstArmholeGarmentRc: armholeStart,
    bindOffSts,
    decreaseSts,
  }).filter((ev) => ev.side === "right");
  const timeline =
    result.frontNeckShoulderTimeline ??
    result.frontNeckShoulderShapingChart.timeline ??
    [];
  const neckPoints = collectInnerNeckDecreasePointsFromTimeline(timeline, "right");
  const armholeEventGarmentRcs = new Set(armholeEvents.map((ev) => ev.garmentRc));
  const sharedGarmentRcs = new Set(
    neckPoints.filter((p) => armholeEventGarmentRcs.has(p.row)).map((p) => p.row),
  );
  const sharedDisplayRcs = new Set(
    [...sharedGarmentRcs].map((g) =>
      displayRcFromGarmentRc(g, armholeStart, rcModel.policy),
    ),
  );
  const gutterX = Math.max(8, frame.left - 10);
  const resetY =
    rcModel.policy === "shared-reset"
      ? frame.armholeStartY
      : frame.armholeStartY - 11;

  const parts: string[] = [
    drawSilhouette(frame, leftShoulder, rightShoulder),
    dashedLine(
      gutterX + 6,
      frame.armholeStartY,
      frame.right + 8,
      "armhole-start",
      ` data-garment-rc="${fmtNum(armholeStart)}" data-y="${fmtNum(frame.armholeStartY)}"`,
    ),
    dashedLine(
      gutterX + 6,
      frame.neckStartY,
      frame.cx,
      "neck-start",
      ` data-garment-rc="${fmtNum(neckStartGarmentRc)}" data-rc="${escapeXml(labels.rcNeckStart)}" data-y="${fmtNum(frame.neckStartY)}"`,
    ),
    dashedLine(
      frame.afterLeft,
      frame.shoulderY,
      frame.afterRight,
      "shoulder-start",
      ` data-rc="${escapeXml(labels.rcShoulderStart)}" data-y="${fmtNum(frame.shoulderY)}"`,
    ),
    `<g data-role="v-point" data-y="${fmtNum(frame.neckStartY)}"></g>`,
  ];

  if (d.hemRows > 0) {
    parts.push(
      dashedLine(gutterX + 6, frame.hemY, frame.left + 12, "hem", ` data-y="${fmtNum(frame.hemY)}"`),
    );
  }

  parts.push(
    rcText(gutterX, frame.bottomY, labels.rcCastOn, "rc-caston", ` data-rc="${escapeXml(labels.rcCastOn)}"`),
  );
  if (d.hemRows > 0) {
    parts.push(
      rcText(gutterX, frame.hemY, labels.rcHem, "rc-hem", ` data-rc="${escapeXml(labels.rcHem)}"`),
    );
  }
  parts.push(
    rcText(
      gutterX,
      frame.armholeStartY,
      labels.rcArmholeBo,
      "armhole-start-rc",
      ` data-rc="${escapeXml(labels.rcArmholeBo)}" data-garment-rc="${fmtNum(armholeStart)}"`,
    ),
  );
  if (labels.rcReset) {
    parts.push(
      rcText(
        gutterX,
        resetY,
        labels.rcReset,
        "rc-reset",
        ` data-rc="${escapeXml(labels.rcReset)}"`,
      ),
    );
  }
  const neckStartOffset =
    labels.rcReset && Math.abs(frame.neckStartY - frame.armholeStartY) < 1.5 ? 12 : 0;
  parts.push(
    rcText(
      gutterX,
      frame.neckStartY - neckStartOffset,
      labels.rcNeckStart,
      "neck-start-rc",
      ` data-rc="${escapeXml(labels.rcNeckStart)}" data-garment-rc="${fmtNum(neckStartGarmentRc)}"`,
    ),
  );
  parts.push(
    rcText(
      gutterX,
      frame.shoulderY,
      labels.rcShoulderStart,
      "shoulder-start-rc",
      ` data-rc="${escapeXml(labels.rcShoulderStart)}"`,
    ),
  );

  const drawnRcKeys = new Set<string>();
  const markRc = (displayRc: number, y: number, shared: boolean) => {
    const key = formatRcNotation(displayRc);
    if (drawnRcKeys.has(key)) return;
    drawnRcKeys.add(key);
    const extra = shared ? ` data-shared-rc="true"` : "";
    parts.push(
      `<g data-role="rc" data-rc="${escapeXml(key)}" data-y="${fmtNum(y)}"${extra}></g>`,
    );
  };

  for (const ev of armholeEvents) {
    const y = yAtRc(ev.garmentRc, bands);
    const displayRc = displayRcFromGarmentRc(ev.garmentRc, armholeStart, rcModel.policy);
    const shared = sharedGarmentRcs.has(ev.garmentRc);
    parts.push(eventHook("armhole-event", displayRc, ev.garmentRc, y, shared));
    if (shared) markRc(displayRc, y, true);
  }
  for (const pt of neckPoints) {
    const y = yAtRc(pt.row, bands);
    const displayRc = displayRcFromGarmentRc(pt.row, armholeStart, rcModel.policy);
    const shared = sharedGarmentRcs.has(pt.row);
    parts.push(eventHook("neck-event", displayRc, pt.row, y, shared));
    if (shared) markRc(displayRc, y, true);
  }
  if (rcModel.shoulderStartDisplayRc !== undefined) {
    parts.push(
      eventHook(
        "shoulder-event",
        rcModel.shoulderStartDisplayRc,
        finiteOr(d.shoulderStartRow, rcModel.shoulderStartDisplayRc),
        frame.shoulderY,
        false,
      ),
    );
  }

  const armholeLabelX = ARMHOLE_LABEL_START_X;
  parts.push(
    `<text data-role="armhole-bo" data-notation="${escapeXml(labels.armholeBo)}" data-label-zone="armhole" x="${fmtNum(armholeLabelX)}" y="${fmtNum(frame.armholeStartY - 14)}" text-anchor="start" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(labels.armholeBo)}</text>`,
  );
  const ahLines = labels.armholeShaping.split("\n").filter(Boolean);
  parts.push(
    drawNotationStack(
      ahLines,
      armholeLabelX,
      (frame.armholeStartY + frame.lastArmholeY) / 2,
      `data-role="armhole-shaping" data-label-zone="armhole" data-notation="${escapeXml(labels.armholeShaping)}"`,
      "start",
    ),
  );
  const neckLines = labels.neckShaping.split("\n").filter(Boolean);
  const neckLabelX = Math.min(
    (frame.afterLeft + frame.neckLeft) / 2,
    frame.neckLeft - 16,
  );
  const vBandTop = Math.min(frame.neckStartY, frame.neckCornerY);
  const vBandBot = Math.max(frame.neckStartY, frame.neckCornerY);
  const neckStackH = Math.max(0, (neckLines.length - 1) * NECK_NOTATION_GAP);
  const neckBandMin = vBandTop + 42 + neckStackH;
  const neckBandMax = vBandBot - 18;
  const neckLastBaseline =
    neckBandMin <= neckBandMax
      ? clamp(vBandBot - 36, neckBandMin, neckBandMax)
      : vBandBot - 20;
  parts.push(
    `<g data-role="neck-label-zone" data-x="${fmtNum(neckLabelX)}" data-y="${fmtNum(neckLastBaseline)}"></g>`,
  );
  parts.push(
    drawNotationStack(
      neckLines,
      neckLabelX,
      neckLastBaseline,
      `data-role="neck-shaping" data-label-zone="neck" data-notation="${escapeXml(labels.neckShaping)}"`,
      "middle",
      NECK_NOTATION_GAP,
    ),
  );
  const shLines = labels.shoulderShaping.split("\n").filter(Boolean);
  const shLabelX = (frame.afterRight + frame.neckRight) / 2;
  const shLastBaseline = frame.shoulderTopY - 26;
  parts.push(
    drawNotationStack(
      shLines,
      shLabelX,
      shLastBaseline,
      `data-role="shoulder-shaping" data-label-zone="shoulder" data-notation="${escapeXml(labels.shoulderShaping)}"`,
    ),
  );
  parts.push(
    `<text data-role="cast-on" data-notation="${escapeXml(labels.castOn)}" x="${fmtNum(frame.cx)}" y="${fmtNum(Math.min(VB_H - 8, frame.bottomY + 16))}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(labels.castOn)}</text>`,
  );

  const firstNeckDec = d.frontNecklineShapingBeginLocalRC;
  if (firstNeckDec !== undefined && Number.isFinite(firstNeckDec)) {
    parts.push(
      `<g data-role="first-neck-decrease" data-rc="${escapeXml(formatRcNotation(firstNeckDec))}"></g>`,
    );
  }

  const safeBody = parts
    .join("")
    .replace(/\bNaN\b/g, "0")
    .replace(/\bInfinity\b/g, "0")
    .replace(/\bundefined\b/g, "");

  const desc = `Sleeveless pullover V-neck Front shaping notation. ${labels.castOn}. Neck ${labels.rcNeckStart}. Armhole ${labels.rcArmholeBo}.`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="sleeveless-vneck-notation-svg" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-labelledby="sleeveless-vneck-notation-title" data-sleeveless-vneck-generated-notation="true" data-supported="true" data-rc-policy="${escapeXml(rcModel.policy)}" data-reset="${labels.rcReset ? "true" : "false"}" data-neck-start-display-rc="${fmtNum(finiteOr(rcModel.necklineStartDisplayRc, -1))}" data-neck-start-garment-rc="${fmtNum(neckStartGarmentRc)}" data-armhole-start-garment-rc="${fmtNum(armholeStart)}" data-last-armhole-garment-rc="${fmtNum(lastArmholeGarmentRc)}" data-shoulder-start-display-rc="${fmtNum(finiteOr(rcModel.shoulderStartDisplayRc, -1))}" data-neck-start-y="${fmtNum(frame.neckStartY)}" data-armhole-start-y="${fmtNum(frame.armholeStartY)}" data-last-armhole-y="${fmtNum(frame.lastArmholeY)}" data-shoulder-y="${fmtNum(frame.shoulderY)}" data-shoulder-top-y="${fmtNum(frame.shoulderTopY)}" data-neck-corner-y="${fmtNum(frame.neckCornerY)}" data-shoulder-contour="slope" data-shoulder-pass-count="${shoulderPasses.length}" data-shoulder-shaping-stitches="${fmtNum(shoulderSts)}" data-body-width="${fmtNum(frame.bodyWidth)}" data-right-label-safe-max-x="${ARMHOLE_LABEL_SAFE_MAX_X}" data-neck-label-x="${fmtNum(neckLabelX)}" data-cast-on="${escapeXml(labels.castOn)}" data-armhole-bo="${escapeXml(labels.armholeBo)}" data-armhole-shaping="${escapeXml(labels.armholeShaping)}" data-neck-shaping="${escapeXml(labels.neckShaping)}" data-shoulder-shaping="${escapeXml(labels.shoulderShaping)}" data-rc-neck-start="${escapeXml(labels.rcNeckStart)}" data-rc-armhole-bo="${escapeXml(labels.rcArmholeBo)}" data-rc-reset="${escapeXml(labels.rcReset)}" data-rc-shoulder-start="${escapeXml(labels.rcShoulderStart)}" data-shared-display-rcs="${escapeXml([...sharedDisplayRcs].map((n) => formatRcNotation(n)).join(","))}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet">`,
    `<title id="sleeveless-vneck-notation-title">Sleeveless pullover V-neck Front shaping notation</title>`,
    `<desc>${escapeXml(desc)}</desc>`,
    `<style type="text/css"><![CDATA[text{font-family:${FONT}}]]></style>`,
    `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#fff"/>`,
    safeBody,
    `</svg>`,
  ].join("");
}

/** Exported for tests — stable viewBox dimensions. */
export const SLEEVELESS_FRONT_VNECK_NOTATION_VIEWBOX = { width: VB_W, height: VB_H } as const;

/** Shared left X for Armhole labels (`text-anchor="start"`). */
export const SLEEVELESS_FRONT_VNECK_ARMHOLE_LABEL_START_X = ARMHOLE_LABEL_START_X;

/** Right-edge cap so the left-aligned Armhole stack stays inside the viewBox. */
export const SLEEVELESS_FRONT_VNECK_ARMHOLE_LABEL_SAFE_MAX_X = ARMHOLE_LABEL_SAFE_MAX_X;

/**
 * Live cutover gate: Pullover V-neck Front only.
 * Cardigan V-neck also sets `sleevelessFullWidthVNeckFront`, so the notation
 * predicate is not sufficient by itself.
 */
export function shouldUseGeneratedSleevelessFrontVNeckNotation(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): boolean {
  if (isSleevelessCardiganGarmentStyle(patternData ?? {})) return false;
  return isSleevelessPulloverVNeckFrontNotation(result, patternData);
}

/**
 * Supported generated markup for the live Front Shaping Notation tab, or `null`
 * so hydration can fall back to the Illustrator template.
 */
export function tryBuildLiveSleevelessFrontVNeckNotationSvg(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): string | null {
  if (!shouldUseGeneratedSleevelessFrontVNeckNotation(result, patternData)) return null;
  const svg = buildSleevelessFrontVNeckShapingNotationDiagramSvg(result, patternData);
  if (!svg.includes('data-sleeveless-vneck-generated-notation="true"')) return null;
  if (!svg.includes('data-supported="true"')) return null;
  return svg;
}
