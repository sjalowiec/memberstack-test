/**
 * Programmatic Shaping Notation SVG for Sleeveless Back.
 *
 * Consumes finalized {@link SleevelessBackPatternResult} plus the existing
 * Back Japanese-notation / RC helpers. No second calculation layer.
 *
 * Visual language follows the approved Pullover V-neck Front renderer
 * (400×480, row Y, stitch X, clean shoulder slopes, compact notation).
 * Geometry is Back-specific: shallow-round neckline, armhole-local RC after reset.
 */

import { pulloverArmholeEvents } from "./frontArmholeNecklineComposition";
import { collectInnerNeckDecreasePointsFromTimeline } from "./notationOverlaySvg";
import { shapingActionRowNumbers } from "./evenShapingSchedule";
import {
  armholeBindOffDecreaseFromEachSide,
  buildBackJapaneseNotationReplacements,
  formatRcNotation,
  garmentRcAtArmholeStart,
  isBackJapaneseNotationSupported,
  shoulderShapingBeginLocalRCForDiagram,
} from "./sleevelessBackJapaneseNotation";
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
const ARMHOLE_NOTATION_GAP = Math.round(FS_NOTATION * 1.6);
const BODY_NOTATION_GAP = Math.round(FS_NOTATION * 1.6);
const BODY_LABEL_OUTLINE_CLEARANCE = 18;
const RC_RESET_GAP = Math.round(FS_RC * 1.75);

const LABEL_GUTTER = 88;
const RIGHT_PAD = 92;
const TOP = 52;
const ARMHOLE_LABEL_START_X = LABEL_GUTTER + (VB_W - LABEL_GUTTER - RIGHT_PAD) + 12;
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

type BodyShapingDirection = "inward" | "outward" | "straight";

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
  neckCenterLeft: number;
  neckCenterRight: number;
  hemLeft: number;
  hemRight: number;
  hemY: number;
  bottomY: number;
  neckStartY: number;
  armholeStartY: number;
  lastArmholeY: number;
  shoulderY: number;
  shoulderTopY: number;
  neckCornerY: number;
  bodyWidth: number;
  bodyStartStitches: number;
  bodyEndStitches: number;
  bodyDirection: BodyShapingDirection;
  bodyShapeStartRc: number;
  bodyShapeEndRc: number;
  bodyShapeStartY: number;
  bodyShapeEndY: number;
  bodyShapeRows: readonly number[];
  neckWidthStitches: number;
  centerNeckStitches: number;
  backNeckDepthRows: number;
  armholeRows: number;
  pixelsPerStitch: number;
};

type Pt = { x: number; y: number };

type NotationLabels = {
  castOn: string;
  armholeBo: string;
  armholeShaping: string;
  neckBo: string;
  neckShaping: string;
  shoulderShaping: string;
  bodyShaping: string;
  rcCastOn: string;
  rcHem: string;
  rcArmholeBo: string;
  rcReset: string;
  rcNeckStart: string;
  rcShoulderStart: string;
};

type BackArmholeEvent = {
  kind: "bindOff" | "decrease";
  garmentRc: number;
  localRc: number;
  amount: number;
};

function resolveBodyShapingModel(result: SleevelessBackPatternResult): {
  hemSts: number;
  bustSts: number;
  direction: BodyShapingDirection;
  rows: number[];
  startRc: number;
  endRc: number;
} {
  const d = result.debug;
  const hemSts = Math.max(
    1,
    Math.round(finiteOr(d.hemCastOnStitches, finiteOr(d.backStitches, 1))),
  );
  const bustSts = Math.max(1, Math.round(finiteOr(d.bustBodyStitches, hemSts)));
  const rows = [...(d.alineBodyShapingRowNumbers ?? [])]
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    .map((n) => Math.floor(n))
    .sort((a, b) => a - b);
  const direction: BodyShapingDirection =
    hemSts > bustSts ? "inward" : hemSts < bustSts ? "outward" : "straight";
  if (direction === "straight") {
    return { hemSts, bustSts, direction, rows: [], startRc: 0, endRc: 0 };
  }
  if (rows.length === 0) {
    const armholeRc = Math.max(
      0,
      Math.floor(finiteOr(d.armholeStartRow, d.rowsFromCastOnToArmholeStart ?? 0)),
    );
    return { hemSts, bustSts, direction, rows, startRc: 0, endRc: armholeRc };
  }
  return {
    hemSts,
    bustSts,
    direction,
    rows,
    startRc: rows[0]!,
    endRc: rows[rows.length - 1]!,
  };
}

function rightBodyOutlineXAtY(frame: NotationFrame, y: number): number {
  if (frame.bodyDirection === "straight") return frame.right;
  if (y >= frame.bodyShapeStartY - 0.01) return frame.hemRight;
  if (y <= frame.bodyShapeEndY + 0.01) return frame.right;
  const span = frame.bodyShapeStartY - frame.bodyShapeEndY;
  if (!(span > 0)) return frame.right;
  const t = clamp((frame.bodyShapeStartY - y) / span, 0, 1);
  return frame.hemRight + t * (frame.right - frame.hemRight);
}

/**
 * Bottom-up armhole contour: side seam → BO step → decrease slope → even.
 * SVG Y decreases upward, so later knitting actions have smaller Y.
 */
function backArmholeSidePoints(
  sideX: number,
  boX: number,
  afterX: number,
  armholeStartY: number,
  lastArmholeY: number,
  shoulderY: number,
): Pt[] {
  return [
    { x: sideX, y: armholeStartY },
    { x: boX, y: armholeStartY },
    { x: afterX, y: lastArmholeY },
    { x: afterX, y: shoulderY },
  ];
}

function bodySidePoints(
  hemX: number,
  bustX: number,
  bottomY: number,
  startY: number,
  endY: number,
  armholeY: number,
  direction: BodyShapingDirection,
): Pt[] {
  if (direction === "straight") {
    return [
      { x: bustX, y: bottomY },
      { x: bustX, y: armholeY },
    ];
  }
  const pts: Pt[] = [{ x: hemX, y: bottomY }];
  if (startY < bottomY - 0.5) {
    pts.push({ x: hemX, y: startY });
  }
  pts.push({ x: bustX, y: endY });
  if (endY > armholeY + 0.5) {
    pts.push({ x: bustX, y: armholeY });
  }
  return pts;
}

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
  const repl = buildBackJapaneseNotationReplacements(result, patternData);
  return {
    castOn: repl["jp-caston"] ?? "",
    armholeBo: repl["jp-armhole-bo"] ?? "",
    armholeShaping: repl["jp-armhole-shaping"] ?? "",
    neckBo: repl["jp-neckline-bo"] ?? "",
    neckShaping: repl["jp-neckline-shaping"] ?? "",
    shoulderShaping: sleevelessBackShoulderNotationLines(result).join("\n"),
    bodyShaping: repl["jp-body-shaping"] ?? "",
    rcCastOn: repl["rc-caston"] ?? "",
    rcHem: repl["rc-hem"] ?? "",
    rcArmholeBo: repl["rc-armhole-bo"] ?? "",
    rcReset: repl.rc_reset ?? "",
    rcNeckStart: repl["rc-neckline-start"] ?? "",
    rcShoulderStart: repl["rc-shoulder-start"] ?? "",
  };
}

function backTimeline(result: SleevelessBackPatternResult) {
  return result.backNeckShoulderTimeline ?? result.neckShoulderShapingChart.timeline ?? [];
}

/**
 * Back shoulder bind-off points at/after shoulder start.
 * Excludes outer-edge events that occur before shoulder shaping begins.
 */
export function sleevelessBackShoulderPoints(
  result: SleevelessBackPatternResult,
): StitchDecreasePoint[] {
  const timeline = backTimeline(result);
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

/** Back shoulder summaries: outer bind-offs at/after shoulder start. */
export function sleevelessBackShoulderNotationLines(
  result: SleevelessBackPatternResult,
): string[] {
  return compressStitchDecreasePointsToNotationLines(sleevelessBackShoulderPoints(result));
}

function displayRcAfterArmholeReset(garmentRc: number, armholeStart: number): number {
  return Math.max(0, Math.floor(garmentRc) - Math.floor(armholeStart));
}

function backArmholeDecreaseEvents(
  armholeStart: number,
  decreaseSts: number,
): BackArmholeEvent[] {
  return shapingActionRowNumbers(2, decreaseSts, 2).map((localRc) => ({
    kind: "decrease" as const,
    garmentRc: armholeStart + localRc,
    localRc,
    amount: 1,
  }));
}

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
  decreaseSts: number;
  armholeStart: number;
} {
  const d = result.debug;
  const hemRc = Math.max(0, Math.floor(finiteOr(d.hemRows, 0)));
  const armholeStart = Math.max(
    0,
    Math.floor(finiteOr(garmentRcAtArmholeStart(d), finiteOr(d.armholeStartRow, 0))),
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
  const lastDecreaseGarmentRc = armholeEvents
    .filter((ev) => ev.kind === "decrease")
    .reduce((max, ev) => Math.max(max, ev.garmentRc), armholeStart);
  const lastArmholeGarmentRc = lastDecreaseGarmentRc;
  const neckStartGarmentRc = Math.max(
    armholeStart,
    Math.floor(finiteOr(d.backNecklineStartRC, armholeStart + finiteOr(d.backNecklineStartLocalRC, 0))),
  );
  const shoulderRc = Math.max(
    lastArmholeGarmentRc,
    Math.floor(finiteOr(d.shoulderStartRow, lastArmholeGarmentRc)),
  );
  const endRc = Math.max(
    shoulderRc,
    Math.floor(finiteOr(d.backFinalRow, finiteOr(d.expectedGarmentRows, shoulderRc))),
  );
  const bands = allocateBands({
    hemRc,
    firstShapeRc: armholeStart,
    shoulderRc,
    endRc,
  });

  const bodyModel = resolveBodyShapingModel(result);
  const bustSts = bodyModel.bustSts;
  const afterSts = Math.max(1, Math.round(finiteOr(d.stitchesAfterArmhole, bustSts)));
  const neckSts = Math.max(0, Math.round(finiteOr(d.necklineStitches, 0)));
  const centerSts = Math.max(0, Math.round(finiteOr(d.centerNeckBindOffStitches, 0)));
  const maxBodyW = VB_W - LABEL_GUTTER - RIGHT_PAD;
  const widthScale = clamp(bustSts / REF_BUST_STS, 0.6, 1.25);
  const bodyWidth = maxBodyW * (widthScale / 1.25);
  const cx = LABEL_GUTTER + maxBodyW / 2;
  const half = bodyWidth / 2;
  const pixelsPerStitch = bustSts > 0 ? bodyWidth / bustSts : 0;
  const afterHalf = Math.max(18, half * (afterSts / Math.max(1, bustSts)));
  const boInset = Math.max(0, half * (bindOffSts / Math.max(1, bustSts)));
  const neckHalf = clamp(
    half * (neckSts / Math.max(1, bustSts)),
    0,
    Math.max(0, afterHalf - 1),
  );
  const centerHalf = clamp(
    half * (centerSts / Math.max(1, bustSts)),
    0,
    neckHalf,
  );
  const maxHemHalf = Math.min(cx - 12, VB_W - 12 - cx);
  const hemHalf = clamp(half * (bodyModel.hemSts / bustSts), 18, maxHemHalf);

  const bottomY = yAtRc(0, bands);
  const hemY = hemRc > 0 ? yAtRc(hemRc, bands) : bottomY;
  const neckStartY = yAtRc(neckStartGarmentRc, bands);
  const armholeStartY = yAtRc(armholeStart, bands);
  const lastArmholeY = yAtRc(lastArmholeGarmentRc, bands);
  const shoulderY = yAtRc(shoulderRc, bands);
  const bodyShapeStartY =
    bodyModel.direction === "straight" ? bottomY : yAtRc(bodyModel.startRc, bands);
  const bodyShapeEndY =
    bodyModel.direction === "straight" ? armholeStartY : yAtRc(bodyModel.endRc, bands);
  const armholeRows = Math.max(
    1,
    Math.round(finiteOr(d.armholeRows, Math.max(1, shoulderRc - armholeStart))),
  );
  const armholeVisualH = Math.max(0, armholeStartY - shoulderY);
  const backNeckDepthRows = Math.max(0, Math.round(finiteOr(d.backNeckDepthRows, 0)));
  const neckVisualDepth = (backNeckDepthRows / armholeRows) * armholeVisualH;
  const neckCornerY = clamp(neckStartY - neckVisualDepth, TOP, neckStartY);
  const shoulderTopY = neckCornerY;

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
      neckCenterLeft: cx - centerHalf,
      neckCenterRight: cx + centerHalf,
      hemLeft: cx - hemHalf,
      hemRight: cx + hemHalf,
      hemY,
      bottomY,
      neckStartY,
      armholeStartY,
      lastArmholeY,
      shoulderY,
      shoulderTopY,
      neckCornerY,
      bodyWidth,
      bodyStartStitches: bodyModel.hemSts,
      bodyEndStitches: bodyModel.bustSts,
      bodyDirection: bodyModel.direction,
      bodyShapeStartRc: bodyModel.startRc,
      bodyShapeEndRc: bodyModel.endRc,
      bodyShapeStartY,
      bodyShapeEndY,
      bodyShapeRows: bodyModel.rows,
      neckWidthStitches: neckSts,
      centerNeckStitches: centerSts,
      backNeckDepthRows,
      armholeRows,
      pixelsPerStitch,
    },
    bands,
    neckStartGarmentRc,
    lastArmholeGarmentRc,
    bindOffSts,
    decreaseSts,
    armholeStart,
  };
}

type BackNeckPath = {
  d: string;
  curveCommands: string;
  depthY: number;
  leftX: number;
  rightX: number;
  centerLeftX: number;
  centerRightX: number;
};

/**
 * Smooth scoop from the canonical neck corners, center-hold width, and depth Y.
 * Two cubics with horizontal end tangents — not a V and not a rectangular notch.
 */
function buildBackNeckPath(frame: NotationFrame): BackNeckPath {
  const leftX = frame.neckLeft;
  const rightX = frame.neckRight;
  const centerLeftX = frame.neckCenterLeft;
  const centerRightX = frame.neckCenterRight;
  const cornerY = frame.neckCornerY;
  const depthY = Math.max(frame.neckStartY, cornerY);
  const neckW = Math.max(0, rightX - leftX);
  const curveCommands =
    depthY - Math.min(frame.neckStartY, cornerY) > 0.75 && neckW > 1
      ? [
          `C ${fmtNum(leftX + neckW * 0.22)} ${fmtNum(cornerY)} ${fmtNum(centerLeftX)} ${fmtNum(depthY)} ${fmtNum(frame.cx)} ${fmtNum(depthY)}`,
          `C ${fmtNum(centerRightX)} ${fmtNum(depthY)} ${fmtNum(rightX - neckW * 0.22)} ${fmtNum(cornerY)} ${fmtNum(rightX)} ${fmtNum(cornerY)}`,
        ].join(" ")
      : `L ${fmtNum(rightX)} ${fmtNum(cornerY)}`;
  return {
    d: `M ${fmtNum(leftX)} ${fmtNum(cornerY)} ${curveCommands}`,
    curveCommands,
    depthY,
    leftX,
    rightX,
    centerLeftX,
    centerRightX,
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
  neck: BackNeckPath,
): string {
  const leftBody = bodySidePoints(
    frame.hemLeft,
    frame.left,
    frame.bottomY,
    frame.bodyShapeStartY,
    frame.bodyShapeEndY,
    frame.armholeStartY,
    frame.bodyDirection,
  );
  const rightBody = bodySidePoints(
    frame.hemRight,
    frame.right,
    frame.bottomY,
    frame.bodyShapeStartY,
    frame.bodyShapeEndY,
    frame.armholeStartY,
    frame.bodyDirection,
  );
  const leftArmhole = backArmholeSidePoints(
    frame.left,
    frame.boLeft,
    frame.afterLeft,
    frame.armholeStartY,
    frame.lastArmholeY,
    frame.shoulderY,
  );
  const rightArmhole = backArmholeSidePoints(
    frame.right,
    frame.boRight,
    frame.afterRight,
    frame.armholeStartY,
    frame.lastArmholeY,
    frame.shoulderY,
  );
  const leftSteps = leftShoulder.slice(1);
  const rightDown = [...rightShoulder].reverse().slice(1);
  const rightBodyDown = [...rightBody].reverse().slice(1);
  const path = [
    ...leftBody.map((p, i) => `${i === 0 ? "M" : "L"} ${fmtNum(p.x)} ${fmtNum(p.y)}`),
    ...leftArmhole.slice(1).map((p) => `L ${fmtNum(p.x)} ${fmtNum(p.y)}`),
    ...leftSteps.map((p) => `L ${fmtNum(p.x)} ${fmtNum(p.y)}`),
    `L ${fmtNum(frame.neckLeft)} ${fmtNum(frame.neckCornerY)}`,
    neck.curveCommands,
    ...rightDown.map((p) => `L ${fmtNum(p.x)} ${fmtNum(p.y)}`),
    ...[...rightArmhole].reverse().map((p) => `L ${fmtNum(p.x)} ${fmtNum(p.y)}`),
    ...rightBodyDown.map((p) => `L ${fmtNum(p.x)} ${fmtNum(p.y)}`),
    "Z",
  ].join(" ");
  return [
    `<path class="sleeveless-back-notation__body" d="${path}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    `<path data-role="left-body-path" data-body-shaping-direction="${frame.bodyDirection}" d="${polylineD(leftBody)}" fill="none" stroke="none"/>`,
    `<path data-role="right-body-path" data-body-shaping-direction="${frame.bodyDirection}" d="${polylineD(rightBody)}" fill="none" stroke="none"/>`,
    `<path data-role="left-armhole-path" data-armhole-read-order="bottom-up" d="${polylineD(leftArmhole)}" fill="none" stroke="none"/>`,
    `<path data-role="right-armhole-path" data-armhole-read-order="bottom-up" d="${polylineD(rightArmhole)}" fill="none" stroke="none"/>`,
    `<path data-role="left-shoulder-path" d="${polylineD(leftShoulder)}" fill="none" stroke="none"/>`,
    `<path data-role="right-shoulder-path" d="${polylineD(rightShoulder)}" fill="none" stroke="none"/>`,
    `<path data-role="back-neck-path" data-neck-width-stitches="${fmtNum(frame.neckWidthStitches)}" data-center-neck-stitches="${fmtNum(frame.centerNeckStitches)}" data-neck-depth-rows="${fmtNum(frame.backNeckDepthRows)}" data-neck-depth-y="${fmtNum(neck.depthY)}" data-neck-left-x="${fmtNum(neck.leftX)}" data-neck-right-x="${fmtNum(neck.rightX)}" data-neck-center-left-x="${fmtNum(neck.centerLeftX)}" data-neck-center-right-x="${fmtNum(neck.centerRightX)}" d="${neck.d}" fill="none" stroke="none"/>`,
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
): string {
  return `<g data-role="${role}" data-rc="${escapeXml(formatRcNotation(displayRc))}" data-garment-rc="${fmtNum(garmentRc)}" data-y="${fmtNum(y)}"></g>`;
}

/**
 * Build a responsive Sleeveless Back Shaping Notation SVG from the finalized
 * sleeveless result. Labels reuse {@link buildBackJapaneseNotationReplacements}.
 */
export function buildSleevelessBackShapingNotationDiagramSvg(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): string {
  const supported = isBackJapaneseNotationSupported(patternData, result);
  if (!supported) {
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" class="sleeveless-back-notation-svg" viewBox="0 0 ${VB_W} ${VB_H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" data-sleeveless-back-generated-notation="true" data-supported="false">`,
      `<title>Sleeveless Back shaping notation unavailable</title>`,
      `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#fff"/>`,
      `</svg>`,
    ].join("");
  }

  const d = result.debug;
  const labels = buildLabels(result, patternData ?? {});
  const shoulderPasses = sleevelessBackShoulderPoints(result);
  const {
    frame,
    bands,
    neckStartGarmentRc,
    lastArmholeGarmentRc,
    bindOffSts,
    decreaseSts,
    armholeStart,
  } = buildFrame(result, shoulderPasses);
  const shoulderRise = Math.max(0, frame.shoulderY - frame.neckCornerY);
  const slopeEnds = buildShoulderSlopeEnds(shoulderPasses, shoulderRise);
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
  const neckPath = buildBackNeckPath(frame);
  const shoulderSts = shoulderPasses.reduce((sum, p) => sum + Math.max(0, p.amount), 0);
  const decreaseEvents = backArmholeDecreaseEvents(armholeStart, decreaseSts);
  const timeline = backTimeline(result);
  const neckPointsTimeline = collectInnerNeckDecreasePointsFromTimeline(timeline, "right");
  const gutterX = Math.max(8, Math.min(frame.left, frame.hemLeft) - 10);
  const resetY = labels.rcReset ? frame.armholeStartY - RC_RESET_GAP : frame.armholeStartY;
  const shoulderStartDisplayRc = shoulderShapingBeginLocalRCForDiagram(d);
  const neckStartDisplayRc = Math.max(
    0,
    Math.floor(finiteOr(d.backNecklineStartLocalRC, displayRcAfterArmholeReset(neckStartGarmentRc, armholeStart))),
  );

  const parts: string[] = [
    drawSilhouette(frame, leftShoulder, rightShoulder, neckPath),
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
      frame.neckCenterRight,
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
    labels.rcReset && Math.abs(frame.neckStartY - frame.armholeStartY) < 1.5
      ? RC_RESET_GAP + Math.round(FS_RC * 1.25)
      : Math.abs(frame.neckStartY - frame.shoulderY) < 1.5
        ? RC_RESET_GAP
        : 0;
  parts.push(
    rcText(
      gutterX,
      frame.neckStartY + neckStartOffset,
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

  if (bindOffSts > 0) {
    parts.push(eventHook("armhole-event", 0, armholeStart, frame.armholeStartY));
  }
  for (const ev of decreaseEvents) {
    parts.push(eventHook("armhole-event", ev.localRc, ev.garmentRc, yAtRc(ev.garmentRc, bands)));
  }
  parts.push(
    eventHook("neck-start", neckStartDisplayRc, neckStartGarmentRc, frame.neckStartY),
  );
  for (const pt of neckPointsTimeline) {
    const displayRc = displayRcAfterArmholeReset(pt.row, armholeStart);
    parts.push(eventHook("neck-event", displayRc, pt.row, yAtRc(pt.row, bands)));
  }
  for (const row of frame.bodyShapeRows) {
    parts.push(
      `<g data-role="body-event" data-rc="${escapeXml(formatRcNotation(row))}" data-garment-rc="${fmtNum(row)}" data-y="${fmtNum(yAtRc(row, bands))}" data-body-shaping-direction="${frame.bodyDirection}"></g>`,
    );
  }
  for (const pt of shoulderPasses) {
    const displayRc = displayRcAfterArmholeReset(pt.row, armholeStart);
    parts.push(eventHook("shoulder-event", displayRc, pt.row, yAtRc(pt.row, bands)));
  }
  if (shoulderPasses.length === 0 && shoulderStartDisplayRc !== undefined) {
    parts.push(
      eventHook(
        "shoulder-event",
        shoulderStartDisplayRc,
        finiteOr(d.shoulderStartRow, armholeStart + shoulderStartDisplayRc),
        frame.shoulderY,
      ),
    );
  }

  const armholeLabelX = ARMHOLE_LABEL_START_X;
  const armholeBoY = frame.armholeStartY - 14;
  const ahLines = labels.armholeShaping.split("\n").filter(Boolean);
  const armholeStack = [
    { role: "armhole-bo", notation: labels.armholeBo, line: labels.armholeBo },
    ...ahLines.map((line) => ({
      role: "armhole-shaping",
      notation: labels.armholeShaping,
      line,
    })),
  ].filter((entry) => entry.line.length > 0);
  for (const [i, entry] of armholeStack.entries()) {
    const y = armholeBoY - i * ARMHOLE_NOTATION_GAP;
    parts.push(
      `<text data-role="${entry.role}" data-notation="${escapeXml(entry.notation)}" data-label-zone="armhole" data-stack-order="${i}" x="${fmtNum(armholeLabelX)}" y="${fmtNum(y)}" text-anchor="start" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(entry.line)}</text>`,
    );
  }

  const neckLines = [labels.neckBo, ...labels.neckShaping.split("\n")].filter(Boolean);
  const neckLabelX = frame.cx;
  const neckFirstBaseline = Math.min(VB_H - 24, frame.neckStartY + 22);
  parts.push(
    `<g data-role="neck-label-zone" data-x="${fmtNum(neckLabelX)}" data-y="${fmtNum(neckFirstBaseline)}" data-neck-label-clearance="20"></g>`,
  );
  for (const [i, line] of neckLines.entries()) {
    const y = neckFirstBaseline + i * NECK_NOTATION_GAP;
    const role = i === 0 && labels.neckBo && line === labels.neckBo ? "neck-bo" : "neck-shaping";
    const notation = role === "neck-bo" ? labels.neckBo : labels.neckShaping;
    parts.push(
      `<text data-role="${role}" data-label-zone="neck" data-notation="${escapeXml(notation)}" data-stack-order="${i}" x="${fmtNum(neckLabelX)}" y="${fmtNum(y)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(line)}</text>`,
    );
  }

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

  const bodyLines =
    frame.bodyDirection === "straight" ? [] : labels.bodyShaping.split("\n").filter(Boolean);
  let bodyLabelX = 0;
  let bodyOutlineX = 0;
  let bodyLastBaseline = 0;
  if (bodyLines.length > 0) {
    const bodyMidY = (frame.bodyShapeStartY + frame.bodyShapeEndY) / 2;
    const bodyStackH = Math.max(0, (bodyLines.length - 1) * BODY_NOTATION_GAP);
    bodyLastBaseline = clamp(
      bodyMidY + bodyStackH / 2,
      frame.armholeStartY + 40 + bodyStackH,
      frame.bottomY - 28,
    );
    bodyOutlineX = rightBodyOutlineXAtY(frame, bodyLastBaseline);
    bodyLabelX = bodyOutlineX - BODY_LABEL_OUTLINE_CLEARANCE;
    parts.push(
      `<g data-role="body-shaping-label-zone" data-body-label-x="${fmtNum(bodyLabelX)}" data-body-outline-x-at-label="${fmtNum(bodyOutlineX)}" data-body-label-y="${fmtNum(bodyLastBaseline)}" data-body-label-clearance="${BODY_LABEL_OUTLINE_CLEARANCE}"></g>`,
    );
    parts.push(
      drawNotationStack(
        bodyLines,
        bodyLabelX,
        bodyLastBaseline,
        `data-role="body-shaping" data-label-zone="body" data-notation="${escapeXml(labels.bodyShaping)}"`,
        "end",
        BODY_NOTATION_GAP,
      ),
    );
  }
  parts.push(
    `<text data-role="cast-on" data-notation="${escapeXml(labels.castOn)}" x="${fmtNum(frame.cx)}" y="${fmtNum(Math.min(VB_H - 8, frame.bottomY + 16))}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(labels.castOn)}</text>`,
  );

  const safeBody = parts
    .join("")
    .replace(/\bNaN\b/g, "0")
    .replace(/\bInfinity\b/g, "0")
    .replace(/\bundefined\b/g, "");

  const desc = `Sleeveless Back shaping notation. ${labels.castOn}. Neck ${labels.rcNeckStart}. Armhole ${labels.rcArmholeBo}.`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="sleeveless-back-notation-svg" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-labelledby="sleeveless-back-notation-title" data-sleeveless-back-generated-notation="true" data-supported="true" data-reset="${labels.rcReset ? "true" : "false"}" data-neck-start-display-rc="${fmtNum(neckStartDisplayRc)}" data-neck-start-garment-rc="${fmtNum(neckStartGarmentRc)}" data-armhole-start-garment-rc="${fmtNum(armholeStart)}" data-last-armhole-garment-rc="${fmtNum(lastArmholeGarmentRc)}" data-shoulder-start-display-rc="${fmtNum(finiteOr(shoulderStartDisplayRc, -1))}" data-neck-start-y="${fmtNum(frame.neckStartY)}" data-armhole-start-y="${fmtNum(frame.armholeStartY)}" data-last-armhole-y="${fmtNum(frame.lastArmholeY)}" data-armhole-read-order="bottom-up" data-shoulder-y="${fmtNum(frame.shoulderY)}" data-shoulder-top-y="${fmtNum(frame.shoulderTopY)}" data-neck-corner-y="${fmtNum(frame.neckCornerY)}" data-neck-center-left="${fmtNum(frame.neckCenterLeft)}" data-neck-center-right="${fmtNum(frame.neckCenterRight)}" data-neck-left="${fmtNum(frame.neckLeft)}" data-neck-right="${fmtNum(frame.neckRight)}" data-bo-left="${fmtNum(frame.boLeft)}" data-after-left="${fmtNum(frame.afterLeft)}" data-after-right="${fmtNum(frame.afterRight)}" data-pixels-per-stitch="${fmtNum(frame.pixelsPerStitch)}" data-armhole-rows="${fmtNum(frame.armholeRows)}" data-neck-width-stitches="${fmtNum(frame.neckWidthStitches)}" data-center-neck-stitches="${fmtNum(frame.centerNeckStitches)}" data-neck-depth-rows="${fmtNum(frame.backNeckDepthRows)}" data-neck-contour="scoop" data-shoulder-contour="slope" data-shoulder-pass-count="${shoulderPasses.length}" data-shoulder-shaping-stitches="${fmtNum(shoulderSts)}" data-body-width="${fmtNum(frame.bodyWidth)}" data-body-start-stitches="${fmtNum(frame.bodyStartStitches)}" data-body-end-stitches="${fmtNum(frame.bodyEndStitches)}" data-body-shaping-direction="${frame.bodyDirection}" data-body-shaping-start-rc="${fmtNum(frame.bodyShapeStartRc)}" data-body-shaping-end-rc="${fmtNum(frame.bodyShapeEndRc)}" data-body-shaping-start-y="${fmtNum(frame.bodyShapeStartY)}" data-body-shaping-end-y="${fmtNum(frame.bodyShapeEndY)}" data-hem-left="${fmtNum(frame.hemLeft)}" data-hem-right="${fmtNum(frame.hemRight)}" data-bust-left="${fmtNum(frame.left)}" data-bust-right="${fmtNum(frame.right)}" data-body-shaping="${escapeXml(frame.bodyDirection === "straight" ? "" : labels.bodyShaping)}" data-body-label-x="${fmtNum(bodyLabelX)}" data-body-outline-x-at-label="${fmtNum(bodyOutlineX)}" data-body-label-clearance="${BODY_LABEL_OUTLINE_CLEARANCE}" data-right-label-safe-max-x="${ARMHOLE_LABEL_SAFE_MAX_X}" data-neck-label-x="${fmtNum(neckLabelX)}" data-neck-label-y="${fmtNum(neckFirstBaseline)}" data-cast-on="${escapeXml(labels.castOn)}" data-armhole-bo="${escapeXml(labels.armholeBo)}" data-armhole-shaping="${escapeXml(labels.armholeShaping)}" data-neck-bo="${escapeXml(labels.neckBo)}" data-neck-shaping="${escapeXml(labels.neckShaping)}" data-shoulder-shaping="${escapeXml(labels.shoulderShaping)}" data-rc-neck-start="${escapeXml(labels.rcNeckStart)}" data-rc-armhole-bo="${escapeXml(labels.rcArmholeBo)}" data-rc-reset="${escapeXml(labels.rcReset)}" data-rc-shoulder-start="${escapeXml(labels.rcShoulderStart)}" data-bind-off-sts="${fmtNum(bindOffSts)}" data-decrease-sts="${fmtNum(decreaseSts)}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet">`,
    `<title id="sleeveless-back-notation-title">Sleeveless Back shaping notation</title>`,
    `<desc>${escapeXml(desc)}</desc>`,
    `<style type="text/css"><![CDATA[text{font-family:${FONT}}]]></style>`,
    `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#fff"/>`,
    safeBody,
    `</svg>`,
  ].join("");
}

export const SLEEVELESS_BACK_NOTATION_VIEWBOX = { width: VB_W, height: VB_H } as const;
export const SLEEVELESS_BACK_ARMHOLE_LABEL_START_X = ARMHOLE_LABEL_START_X;
export const SLEEVELESS_BACK_ARMHOLE_NOTATION_GAP = ARMHOLE_NOTATION_GAP;
export const SLEEVELESS_BACK_ARMHOLE_LABEL_SAFE_MAX_X = ARMHOLE_LABEL_SAFE_MAX_X;
export const SLEEVELESS_BACK_BODY_LABEL_OUTLINE_CLEARANCE = BODY_LABEL_OUTLINE_CLEARANCE;
export const SLEEVELESS_BACK_RC_RESET_GAP = RC_RESET_GAP;

export function shouldUseGeneratedSleevelessBackNotation(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): boolean {
  return isBackJapaneseNotationSupported(patternData, result);
}

/**
 * Supported generated markup for the live Back Shaping Notation tab, or `null`
 * so hydration can fall back to the Illustrator template.
 */
export function tryBuildLiveSleevelessBackNotationSvg(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): string | null {
  if (!shouldUseGeneratedSleevelessBackNotation(result, patternData)) return null;
  const svg = buildSleevelessBackShapingNotationDiagramSvg(result, patternData);
  if (!svg.includes('data-sleeveless-back-generated-notation="true"')) return null;
  if (!svg.includes('data-supported="true"')) return null;
  return svg;
}
