/**
 * Programmatic Shaping Notation SVG for Sleeveless Pullover Round-neck Front
 * (straight body).
 *
 * Geometry comes from the generated Front Stitches & Rows model — the same
 * stitch-true widths, armhole contour, shoulder positions, and round-neck
 * curve used by that renderer. Notation is a presentation layer on that
 * garment, not a second silhouette system.
 *
 * Labels come from the front neck/shoulder timeline and `pulloverArmholeEvents`.
 * Chart-cell parsing is not used.
 */

import { pulloverArmholeEvents } from "./frontArmholeNecklineComposition";
import {
  armholeBindOffDecreaseFromEachSide,
  formatBindOffNotation,
  formatCastOnNotation,
  formatHoldNotation,
  formatRcNotation,
  formatRcResetNotation,
  garmentRcAtArmholeStart,
  shoulderShapingBeginLocalRCForDiagram,
} from "./sleevelessBackJapaneseNotation";
import { resolveSleevelessDiagramBodyShapeKind } from "./sleevelessDiagramBodyShapeSrc";
import {
  isSleevelessCardiganGarmentStyle,
  isSleevelessVNeckChoice,
} from "./sleevelessFrontDiagramSrc";
import { isSleevelessPulloverVNeckFrontNotation } from "./sleevelessFrontJapaneseNotation";
import {
  buildSleevelessFrontStsRowsDiagramModel,
  isSleevelessFrontStsRowsRoundNeckline,
  type SleevelessFrontStsRowsDiagramModel,
  type SleevelessFrontStsRowsRoundNeckline,
} from "./sleevelessFrontStsRowsDiagramModel";
import { SLEEVELESS_FRONT_STS_ROWS_VISUAL } from "./sleevelessFrontStsRowsDiagramSvg";
import { shoulderStitchesPerSideForDiagram } from "./sleevelessGarmentDiagramReplacements";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import { buildSleevelessRoundNeckShapingSchedule } from "./sleevelessRoundNeckShapingSchedule";
import {
  compressStitchDecreasePointsToNotationLines,
  type StitchDecreasePoint,
} from "./shapingNotationCompress";
import type { RowEntry } from "./shapingTimeline";
import {
  collectCompleteShoulderShapingPoints,
  shoulderShapingNotationLinesFromTimeline,
} from "./shoulderShapingNotation";

const VB_W = 400;
const VB_H = 480;

const STROKE = "#1a1a1a";
const FILL = "#f4f6f1";
const MUTED = "#4b5563";
const GUIDE = "#bdbec0";
const FONT = "Poppins, system-ui, Arial, sans-serif";
/** Match generated Front Stitches & Rows measurement type (`FS_STITCH` / `FS_SECONDARY`). */
const FS_NOTATION = 17;
const FS_RC = 14;
const NOTATION_GAP = 18;
const NECK_NOTATION_GAP = 18;
const NECK_BO_BELOW_GUIDE = NECK_NOTATION_GAP;
const ARMHOLE_NOTATION_GAP = 18;
const RC_RESET_GAP = Math.round(FS_RC * 1.75);
const ARMHOLE_LABEL_CLEARANCE = 10;
const SHOULDER_LABEL_GAP = 14;
const SHOULDER_OUTLINE_CLEARANCE = 10;

const LABEL_GUTTER = 88;
const RIGHT_PAD = 92;
const TOP = 52;
const ARMHOLE_LABEL_SAFE_MAX_X = VB_W - 16;
const BOTTOM = 428;
const REF_BUST_STS = 80;

export const SLEEVELESS_FRONT_ROUND_NOTATION_FS_NOTATION = FS_NOTATION;
export const SLEEVELESS_FRONT_ROUND_NOTATION_FS_RC = FS_RC;
export const SLEEVELESS_FRONT_ROUND_NECK_BO_BELOW_GUIDE = NECK_BO_BELOW_GUIDE;
export const SLEEVELESS_FRONT_ROUND_ARMHOLE_LABEL_CLEARANCE = ARMHOLE_LABEL_CLEARANCE;
export const SLEEVELESS_FRONT_ROUND_ARMHOLE_LABEL_SAFE_MAX_X = ARMHOLE_LABEL_SAFE_MAX_X;

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

type YBand = {
  rc0: number;
  rc1: number;
  yBottom: number;
  yTop: number;
};

type Pt = { x: number; y: number };

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
  afterWidth: number;
  neckWidth: number;
  shoulderSideWidth: number;
  hemWidth: number;
  pxPerStitch: number;
  visualHemH: number;
  visualBodyH: number;
  visualArmholeH: number;
  visualShoulderH: number;
  visualNeckH: number;
};

type NotationLabels = {
  castOn: string;
  armholeBo: string;
  armholeShaping: string;
  neckBo: string;
  neckShaping: string;
  shoulderShaping: string;
  rcCastOn: string;
  rcHem: string;
  rcArmholeBo: string;
  rcReset: string;
  rcNeckStart: string;
  rcShoulderStart: string;
};

function frontTimeline(result: SleevelessBackPatternResult): RowEntry[] {
  return result.frontNeckShoulderTimeline ?? result.frontNeckShoulderShapingChart.timeline ?? [];
}

function sortTimelineByRow(timeline: readonly RowEntry[]): RowEntry[] {
  return [...timeline].sort((a, b) => a.row - b.row);
}

/**
 * Inner-neck decrease and bind-off points from the live front timeline.
 * Holds stay on the center event — they are not inner-edge shaping.
 */
export function collectRoundFrontInnerNeckShapingPoints(
  timeline: readonly RowEntry[],
  side: "left" | "right" = "right",
): StitchDecreasePoint[] {
  return sortTimelineByRow(timeline)
    .map((entry) => {
      let amount = 0;
      for (const ev of entry.events) {
        if (ev.side !== side || ev.edge !== "inner") continue;
        if (ev.kind !== "decrease" && ev.kind !== "bindOff") continue;
        if (ev.amount <= 0) continue;
        amount += ev.amount;
      }
      return { row: entry.row, amount };
    })
    .filter((p) => p.amount > 0);
}

export function pulloverRoundFrontNeckNotationLines(
  result: SleevelessBackPatternResult,
): string[] {
  return compressStitchDecreasePointsToNotationLines(
    collectRoundFrontInnerNeckShapingPoints(frontTimeline(result), "right"),
  );
}

export function pulloverRoundFrontCenterNeckNotation(
  result: SleevelessBackPatternResult,
  neckline?: SleevelessFrontStsRowsRoundNeckline,
): string {
  const schedule = buildSleevelessRoundNeckShapingSchedule(frontTimeline(result));
  const amount = Math.max(
    0,
    Math.round(schedule?.centerStitches ?? neckline?.centerBindOffStitches ?? 0),
  );
  const held = schedule?.centerHeld === true || neckline?.centerHeld === true;
  return held ? formatHoldNotation(amount) : formatBindOffNotation(amount);
}

export function pulloverRoundFrontShoulderPoints(
  result: SleevelessBackPatternResult,
): StitchDecreasePoint[] {
  const timeline = frontTimeline(result);
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

export function pulloverRoundFrontShoulderNotationLines(
  result: SleevelessBackPatternResult,
): string[] {
  const timeline = frontTimeline(result);
  if (timeline.length === 0) return [];
  const budget = shoulderStitchesPerSideForDiagram(result.debug);
  const lines = shoulderShapingNotationLinesFromTimeline(timeline, "right", undefined, {
    shoulderStitchesBudget: budget,
  });
  if (lines.length > 0) return lines;
  return compressStitchDecreasePointsToNotationLines(pulloverRoundFrontShoulderPoints(result));
}

export function pulloverRoundFrontArmholeDecreasePoints(
  result: SleevelessBackPatternResult,
): StitchDecreasePoint[] {
  const d = result.debug;
  const armholeStart = Math.max(0, Math.floor(garmentRcAtArmholeStart(d) ?? d.armholeStartRow ?? 0));
  const eachSide = d.armholeStitchesEachSide;
  const { bindOffSts, decreaseSts } =
    eachSide !== undefined
      ? armholeBindOffDecreaseFromEachSide(eachSide)
      : { bindOffSts: 0, decreaseSts: 0 };
  return pulloverArmholeEvents({
    firstArmholeGarmentRc: armholeStart,
    bindOffSts,
    decreaseSts,
  })
    .filter((ev) => ev.kind === "decrease" && ev.side === "right")
    .map((ev) => ({
      row: Math.max(0, ev.garmentRc - armholeStart),
      amount: ev.amount,
    }));
}

function displayRcAfterArmholeReset(garmentRc: number, armholeStart: number): number {
  return Math.max(0, Math.floor(garmentRc) - Math.floor(armholeStart));
}

function joinNotationLines(lines: readonly string[]): string {
  return lines.filter((line) => line.length > 0).join("\n");
}

function sectionInches(rows: number, rowsPerInch: number, fallback: number): number {
  if (rowsPerInch > 0 && rows > 0) return rows / rowsPerInch;
  return fallback;
}

/** Same inch-weighted visual bands as generated Front Stitches & Rows. */
function allocateBands(args: {
  hemRc: number;
  armholeStartRc: number;
  shoulderRc: number;
  endRc: number;
  hemRows: number;
  bodyRows: number;
  armholeRows: number;
  rowsPerInch: number;
}): { bands: YBand[]; hemH: number; bodyH: number; armholeH: number; shoulderH: number } {
  const hemRc = Math.max(0, args.hemRc);
  const armholeStartRc = Math.max(hemRc, args.armholeStartRc);
  const shoulderRc = Math.max(armholeStartRc, args.shoulderRc);
  const endRc = Math.max(shoulderRc, args.endRc);

  const hemIn = args.hemRows > 0 ? sectionInches(args.hemRows, args.rowsPerInch, 0.4) : 0;
  const bodyIn = sectionInches(args.bodyRows, args.rowsPerInch, 1);
  const armholeIn = sectionInches(args.armholeRows, args.rowsPerInch, 1);
  const shoulderIn = 0.4;
  const raw = Math.max(0.01, hemIn + bodyIn + armholeIn + shoulderIn);
  const usable = BOTTOM - TOP;

  let hemH = hemIn > 0 ? (hemIn / raw) * usable : 0;
  let bodyH = (bodyIn / raw) * usable;
  let armholeH = (armholeIn / raw) * usable;
  let shoulderH = (shoulderIn / raw) * usable;

  if (hemH > 0) hemH = clamp(hemH, SLEEVELESS_FRONT_STS_ROWS_VISUAL.minHem, SLEEVELESS_FRONT_STS_ROWS_VISUAL.maxHem);
  bodyH = clamp(bodyH, SLEEVELESS_FRONT_STS_ROWS_VISUAL.minBody, SLEEVELESS_FRONT_STS_ROWS_VISUAL.maxBody);
  armholeH = clamp(
    armholeH,
    SLEEVELESS_FRONT_STS_ROWS_VISUAL.minArmhole,
    SLEEVELESS_FRONT_STS_ROWS_VISUAL.maxArmhole,
  );
  shoulderH = clamp(
    shoulderH,
    SLEEVELESS_FRONT_STS_ROWS_VISUAL.minShoulder,
    SLEEVELESS_FRONT_STS_ROWS_VISUAL.maxShoulder,
  );

  let sum = hemH + bodyH + armholeH + shoulderH;
  if (sum > usable && sum > 0) {
    const k = usable / sum;
    hemH *= k;
    bodyH *= k;
    armholeH *= k;
    shoulderH *= k;
  } else {
    const target = usable * SLEEVELESS_FRONT_STS_ROWS_VISUAL.fillTarget;
    if (sum < target) bodyH += target - sum;
  }

  const hemY = BOTTOM - hemH;
  const armholeStartY = hemY - bodyH;
  const shoulderY = armholeStartY - armholeH;
  const endY = shoulderY - shoulderH;

  const bands: YBand[] = [];
  if (hemH > 0 && hemRc > 0) {
    bands.push({ rc0: 0, rc1: hemRc, yBottom: BOTTOM, yTop: hemY });
  }
  bands.push({
    rc0: hemRc > 0 ? hemRc : 0,
    rc1: armholeStartRc,
    yBottom: hemH > 0 ? hemY : BOTTOM,
    yTop: armholeStartY,
  });
  bands.push({
    rc0: armholeStartRc,
    rc1: shoulderRc,
    yBottom: armholeStartY,
    yTop: shoulderY,
  });
  bands.push({
    rc0: shoulderRc,
    rc1: endRc,
    yBottom: shoulderY,
    yTop: endY,
  });
  return { bands, hemH, bodyH, armholeH, shoulderH };
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

function buildLabels(
  result: SleevelessBackPatternResult,
  model: SleevelessFrontStsRowsDiagramModel,
  neckline: SleevelessFrontStsRowsRoundNeckline,
): NotationLabels {
  const d = result.debug;
  const armholeStart = model.armhole.startGarmentRc;
  const neckLocal = displayRcAfterArmholeReset(neckline.startGarmentRc, armholeStart);
  const shoulderLocal =
    shoulderShapingBeginLocalRCForDiagram(d) ??
    displayRcAfterArmholeReset(model.shoulder.startGarmentRc, armholeStart);
  return {
    castOn: formatCastOnNotation(model.widths.hemStitches),
    armholeBo: formatBindOffNotation(model.armhole.bindOffStsEachSide),
    armholeShaping: joinNotationLines(
      compressStitchDecreasePointsToNotationLines(pulloverRoundFrontArmholeDecreasePoints(result)),
    ),
    neckBo: pulloverRoundFrontCenterNeckNotation(result, neckline),
    neckShaping: joinNotationLines(pulloverRoundFrontNeckNotationLines(result)),
    shoulderShaping: joinNotationLines(pulloverRoundFrontShoulderNotationLines(result)),
    rcCastOn: formatRcNotation(0),
    rcHem: formatRcNotation(model.rows.hemRows),
    rcArmholeBo: formatRcNotation(armholeStart),
    rcReset: formatRcResetNotation(0),
    rcNeckStart: formatRcNotation(neckLocal),
    rcShoulderStart: formatRcNotation(shoulderLocal),
  };
}

function buildFrame(
  model: SleevelessFrontStsRowsDiagramModel,
): { frame: NotationFrame; bands: YBand[] } {
  const hemRc = Math.max(0, model.rows.hemRows);
  const armholeStart = Math.max(0, model.armhole.startGarmentRc);
  const neckStart = Math.max(0, model.neckline.startGarmentRc);
  const shoulderRc = Math.max(armholeStart, model.shoulder.startGarmentRc);
  const endRc = Math.max(shoulderRc, model.rows.frontFinalRow);
  const bodyRows = Math.max(
    0,
    model.rows.sideSeamRowsAboveHem,
    model.rows.rowsFromCastOnToArmholeStart - hemRc,
  );
  const allocated = allocateBands({
    hemRc,
    armholeStartRc: armholeStart,
    shoulderRc,
    endRc,
    hemRows: model.rows.hemRows,
    bodyRows,
    armholeRows: model.rows.armholeRows,
    rowsPerInch: model.rows.rowsPerInch,
  });
  const bands = allocated.bands;

  const bustSts = Math.max(1, model.widths.bustStitches);
  const hemSts = Math.max(1, model.widths.hemStitches);
  const afterSts = Math.max(1, model.widths.stitchesAfterArmhole);
  const shoulderSts = Math.max(0, model.widths.shoulderStitchesPerSide);
  const bindOffSts = Math.max(0, model.armhole.bindOffStsEachSide);

  const maxBodyW = VB_W - LABEL_GUTTER - RIGHT_PAD;
  const widthScale = clamp(bustSts / REF_BUST_STS, 0.6, 1.25);
  const bodyWidth = maxBodyW * (widthScale / 1.25);
  const cx = LABEL_GUTTER + maxBodyW / 2;
  const half = bodyWidth / 2;
  const pxPerStitch = bodyWidth / bustSts;
  const afterWidth = afterSts * pxPerStitch;
  const shoulderSideWidth = shoulderSts * pxPerStitch;
  const neckWidth = Math.max(0, afterWidth - 2 * shoulderSideWidth);
  const afterHalf = afterWidth / 2;
  const neckHalf = neckWidth / 2;
  const boInset = Math.max(0, bindOffSts * pxPerStitch);
  const hemHalf = clamp(half * (hemSts / bustSts), 18, Math.min(cx - 12, VB_W - 12 - cx));

  const bottomY = yAtRc(0, bands);
  const hemY = hemRc > 0 ? yAtRc(hemRc, bands) : bottomY;
  const armholeStartY = yAtRc(armholeStart, bands);
  const lastArmholeY = yAtRc(model.armhole.lastGarmentRc, bands);
  const neckStartY = yAtRc(neckStart, bands);
  const shoulderY = yAtRc(shoulderRc, bands);
  const lastBand = bands[bands.length - 1];
  const shoulderBandH = lastBand
    ? Math.max(8, shoulderY - lastBand.yTop)
    : SLEEVELESS_FRONT_STS_ROWS_VISUAL.minShoulder;
  const hasShoulderSlope = model.shoulder.points.length > 0;
  const shoulderTopY = hasShoulderSlope ? shoulderY - shoulderBandH : shoulderY;
  const neckCornerY = hasShoulderSlope ? shoulderTopY : shoulderY;

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
      afterWidth,
      neckWidth,
      shoulderSideWidth,
      hemWidth: hemHalf * 2,
      pxPerStitch,
      visualHemH: allocated.hemH,
      visualBodyH: allocated.bodyH,
      visualArmholeH: allocated.armholeH,
      visualShoulderH: allocated.shoulderH,
      visualNeckH: Math.max(0, neckStartY - neckCornerY),
    },
    bands,
  };
}

function polylineD(points: readonly Pt[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${fmtNum(p.x)} ${fmtNum(p.y)}`)
    .join(" ");
}

function roundNecklineCurveD(frame: NotationFrame): string {
  return [
    `M ${fmtNum(frame.neckLeft)} ${fmtNum(frame.neckCornerY)}`,
    `C ${fmtNum(frame.neckLeft)} ${fmtNum(frame.neckStartY)} ${fmtNum(frame.cx)} ${fmtNum(frame.neckStartY)} ${fmtNum(frame.cx)} ${fmtNum(frame.neckStartY)}`,
    `C ${fmtNum(frame.cx)} ${fmtNum(frame.neckStartY)} ${fmtNum(frame.neckRight)} ${fmtNum(frame.neckStartY)} ${fmtNum(frame.neckRight)} ${fmtNum(frame.neckCornerY)}`,
  ].join(" ");
}

function drawSilhouette(frame: NotationFrame): string {
  const leftBody: Pt[] = [
    { x: frame.left, y: frame.bottomY },
    { x: frame.left, y: frame.armholeStartY },
  ];
  const rightBody: Pt[] = [
    { x: frame.right, y: frame.bottomY },
    { x: frame.right, y: frame.armholeStartY },
  ];
  const leftArmhole: Pt[] = [
    { x: frame.left, y: frame.armholeStartY },
    { x: frame.boLeft, y: frame.armholeStartY },
    { x: frame.afterLeft, y: frame.lastArmholeY },
    { x: frame.afterLeft, y: frame.shoulderY },
  ];
  const rightArmhole: Pt[] = [
    { x: frame.right, y: frame.armholeStartY },
    { x: frame.boRight, y: frame.armholeStartY },
    { x: frame.afterRight, y: frame.lastArmholeY },
    { x: frame.afterRight, y: frame.shoulderY },
  ];
  const leftShoulder: Pt[] = [
    { x: frame.afterLeft, y: frame.shoulderY },
    { x: frame.neckLeft, y: frame.neckCornerY },
  ];
  const rightShoulder: Pt[] = [
    { x: frame.afterRight, y: frame.shoulderY },
    { x: frame.neckRight, y: frame.neckCornerY },
  ];
  const neckOpening = [
    `L ${fmtNum(frame.neckLeft)} ${fmtNum(frame.neckCornerY)}`,
    `C ${fmtNum(frame.neckLeft)} ${fmtNum(frame.neckStartY)} ${fmtNum(frame.cx)} ${fmtNum(frame.neckStartY)} ${fmtNum(frame.cx)} ${fmtNum(frame.neckStartY)}`,
    `C ${fmtNum(frame.cx)} ${fmtNum(frame.neckStartY)} ${fmtNum(frame.neckRight)} ${fmtNum(frame.neckStartY)} ${fmtNum(frame.neckRight)} ${fmtNum(frame.neckCornerY)}`,
  ];
  const path = [
    `M ${fmtNum(frame.left)} ${fmtNum(frame.bottomY)}`,
    `L ${fmtNum(frame.left)} ${fmtNum(frame.armholeStartY)}`,
    `L ${fmtNum(frame.boLeft)} ${fmtNum(frame.armholeStartY)}`,
    `L ${fmtNum(frame.afterLeft)} ${fmtNum(frame.lastArmholeY)}`,
    `L ${fmtNum(frame.afterLeft)} ${fmtNum(frame.shoulderY)}`,
    ...neckOpening,
    `L ${fmtNum(frame.afterRight)} ${fmtNum(frame.shoulderY)}`,
    `L ${fmtNum(frame.afterRight)} ${fmtNum(frame.lastArmholeY)}`,
    `L ${fmtNum(frame.boRight)} ${fmtNum(frame.armholeStartY)}`,
    `L ${fmtNum(frame.right)} ${fmtNum(frame.armholeStartY)}`,
    `L ${fmtNum(frame.right)} ${fmtNum(frame.bottomY)}`,
    "Z",
  ].join(" ");
  return [
    `<path class="sleeveless-round-front-notation__body" data-role="body-outline" d="${path}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    `<path data-role="left-body-path" data-body-shaping-direction="straight" d="${polylineD(leftBody)}" fill="none" stroke="none"/>`,
    `<path data-role="right-body-path" data-body-shaping-direction="straight" d="${polylineD(rightBody)}" fill="none" stroke="none"/>`,
    `<path data-role="left-armhole-path" data-armhole-read-order="bottom-up" d="${polylineD(leftArmhole)}" fill="none" stroke="none"/>`,
    `<path data-role="right-armhole-path" data-armhole-read-order="bottom-up" d="${polylineD(rightArmhole)}" fill="none" stroke="none"/>`,
    `<path data-role="left-shoulder-path" data-contour="slope" d="${polylineD(leftShoulder)}" fill="none" stroke="none"/>`,
    `<path data-role="right-shoulder-path" data-contour="slope" d="${polylineD(rightShoulder)}" fill="none" stroke="none"/>`,
    `<path data-role="front-neck-path" data-neck-contour="scoop" d="${roundNecklineCurveD(frame)}" fill="none" stroke="none"/>`,
  ].join("");
}

/** Right-armhole outline X at a canvas Y (BO ledge → decrease slope → vertical). */
function rightArmholeOutlineXAtY(frame: NotationFrame, y: number): number {
  if (y >= frame.armholeStartY) return frame.right;
  if (y <= frame.lastArmholeY) return frame.afterRight;
  const span = frame.armholeStartY - frame.lastArmholeY;
  if (!(span > 0)) return Math.max(frame.right, frame.afterRight);
  const t = clamp((frame.armholeStartY - y) / span, 0, 1);
  return frame.boRight + t * (frame.afterRight - frame.boRight);
}

/** Right-shoulder slope X at a canvas Y (armhole end → neck corner). */
function rightShoulderOutlineXAtY(frame: NotationFrame, y: number): number {
  if (y >= frame.shoulderY) return frame.afterRight;
  if (y <= frame.neckCornerY) return frame.neckRight;
  const span = frame.shoulderY - frame.neckCornerY;
  if (!(span > 0)) return Math.max(frame.afterRight, frame.neckRight);
  const t = clamp((frame.shoulderY - y) / span, 0, 1);
  return frame.afterRight + t * (frame.neckRight - frame.afterRight);
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

function dashedLine(x1: number, y: number, x2: number, role: string, extra = ""): string {
  return `<line data-role="${role}" x1="${fmtNum(x1)}" y1="${fmtNum(y)}" x2="${fmtNum(x2)}" y2="${fmtNum(y)}" stroke="${GUIDE}" stroke-width="1" stroke-dasharray="4 3" fill="none"${extra}/>`;
}

function rcText(x: number, y: number, text: string, role: string, extra = ""): string {
  if (!text) return "";
  return `<text data-role="${role}" x="${fmtNum(x)}" y="${fmtNum(y)}" text-anchor="end" dominant-baseline="middle" fill="${MUTED}" ${textFont(FS_RC)}${extra}>${escapeXml(text)}</text>`;
}

function eventHook(role: string, displayRc: number, garmentRc: number, y: number): string {
  return `<g data-role="${role}" data-rc="${escapeXml(formatRcNotation(displayRc))}" data-garment-rc="${fmtNum(garmentRc)}" data-y="${fmtNum(y)}"></g>`;
}

function unsupportedSvg(): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="sleeveless-round-front-notation-svg" viewBox="0 0 ${VB_W} ${VB_H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" data-sleeveless-front-round-generated-notation="true" data-supported="false">`,
    `<title>Sleeveless pullover round-neck Front shaping notation unavailable</title>`,
    `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#fff"/>`,
    `</svg>`,
  ].join("");
}

export function shouldUseGeneratedSleevelessFrontRoundNotation(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): boolean {
  if (isSleevelessCardiganGarmentStyle(patternData ?? {})) return false;
  if (isSleevelessVNeckChoice(patternData ?? {})) return false;
  if (isSleevelessPulloverVNeckFrontNotation(result, patternData)) return false;
  if (!result.frontNeckShoulderChartUsesLiveRows) return false;
  if (resolveSleevelessDiagramBodyShapeKind(patternData) !== "straight") return false;
  const model = buildSleevelessFrontStsRowsDiagramModel(result, patternData);
  if (!model) return false;
  if (model.garmentStyle !== "pullover" || model.frontPiece !== "fullFront") return false;
  if (model.bodyShape !== "straight" || model.bodyShaping.direction !== "straight") return false;
  return isSleevelessFrontStsRowsRoundNeckline(model.neckline);
}

export function buildSleevelessFrontRoundShapingNotationDiagramSvg(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): string {
  if (!shouldUseGeneratedSleevelessFrontRoundNotation(result, patternData)) {
    return unsupportedSvg();
  }
  const model = buildSleevelessFrontStsRowsDiagramModel(result, patternData);
  if (!model || !isSleevelessFrontStsRowsRoundNeckline(model.neckline)) {
    return unsupportedSvg();
  }
  const neckline = model.neckline;
  const labels = buildLabels(result, model, neckline);
  const { frame, bands } = buildFrame(model);
  const armholeStart = model.armhole.startGarmentRc;
  const lastArmholeGarmentRc = model.armhole.lastGarmentRc;
  const neckStartGarmentRc = neckline.startGarmentRc;
  const shoulderPasses = pulloverRoundFrontShoulderPoints(result);
  const neckPoints = collectRoundFrontInnerNeckShapingPoints(frontTimeline(result), "right");
  const armholeEvents = model.armhole.events.filter((ev) => ev.side === "right");
  const gutterX = Math.max(8, Math.min(frame.left, frame.hemLeft) - 10);
  const resetY = labels.rcReset ? frame.armholeStartY - RC_RESET_GAP : frame.armholeStartY;
  const neckStartDisplayRc = displayRcAfterArmholeReset(neckStartGarmentRc, armholeStart);
  const shoulderStartDisplayRc = displayRcAfterArmholeReset(
    model.shoulder.startGarmentRc,
    armholeStart,
  );

  const parts: string[] = [
    drawSilhouette(frame),
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
      frame.neckRight,
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
  if (model.rows.hemRows > 0) {
    parts.push(
      dashedLine(gutterX + 6, frame.hemY, frame.left + 12, "hem", ` data-y="${fmtNum(frame.hemY)}"`),
    );
  }
  parts.push(
    rcText(gutterX, frame.bottomY, labels.rcCastOn, "rc-caston", ` data-rc="${escapeXml(labels.rcCastOn)}"`),
  );
  if (model.rows.hemRows > 0) {
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

  for (const ev of armholeEvents) {
    const displayRc =
      ev.kind === "bindOff" ? 0 : displayRcAfterArmholeReset(ev.garmentRc, armholeStart);
    parts.push(eventHook("armhole-event", displayRc, ev.garmentRc, yAtRc(ev.garmentRc, bands)));
  }
  parts.push(eventHook("neck-start", neckStartDisplayRc, neckStartGarmentRc, frame.neckStartY));
  for (const pt of neckPoints) {
    parts.push(
      eventHook(
        "neck-event",
        displayRcAfterArmholeReset(pt.row, armholeStart),
        pt.row,
        yAtRc(pt.row, bands),
      ),
    );
  }
  for (const pt of shoulderPasses) {
    parts.push(
      eventHook(
        "shoulder-event",
        displayRcAfterArmholeReset(pt.row, armholeStart),
        pt.row,
        yAtRc(pt.row, bands),
      ),
    );
  }
  if (shoulderPasses.length === 0) {
    parts.push(
      eventHook(
        "shoulder-event",
        shoulderStartDisplayRc,
        model.shoulder.startGarmentRc,
        frame.shoulderY,
      ),
    );
  }

  const ahLines = labels.armholeShaping.split("\n").filter(Boolean);
  const armholeStack = [
    { role: "armhole-bo", notation: labels.armholeBo, line: labels.armholeBo },
    ...ahLines.map((line) => ({
      role: "armhole-shaping",
      notation: labels.armholeShaping,
      line,
    })),
  ].filter((entry) => entry.line.length > 0);
  const armholeBoY = frame.armholeStartY - 14;
  const armholeYs = armholeStack.map((_, i) => armholeBoY - i * ARMHOLE_NOTATION_GAP);
  const armholeOutlineX = armholeYs.reduce(
    (maxX, y) => Math.max(maxX, rightArmholeOutlineXAtY(frame, y)),
    frame.afterRight,
  );
  const armholeLabelX = clamp(
    armholeOutlineX + ARMHOLE_LABEL_CLEARANCE,
    frame.afterRight + ARMHOLE_LABEL_CLEARANCE,
    ARMHOLE_LABEL_SAFE_MAX_X,
  );
  parts.push(
    `<g data-role="armhole-label-zone" data-x="${fmtNum(armholeLabelX)}" data-y="${fmtNum(armholeBoY)}" data-outline-x="${fmtNum(armholeOutlineX)}"></g>`,
  );
  for (const [i, entry] of armholeStack.entries()) {
    const y = armholeYs[i]!;
    parts.push(
      `<text data-role="${entry.role}" data-notation="${escapeXml(entry.notation)}" data-label-zone="armhole" data-stack-order="${i}" x="${fmtNum(armholeLabelX)}" y="${fmtNum(y)}" text-anchor="start" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(entry.line)}</text>`,
    );
  }

  const neckShapingLines = labels.neckShaping.split("\n").filter(Boolean);
  const neckLabelX = frame.cx;
  const neckGuideY = frame.neckStartY;
  const neckBoY = neckGuideY + NECK_BO_BELOW_GUIDE;
  const neckInsideTop = frame.neckCornerY + Math.max(4, Math.round(FS_NOTATION * 0.25));
  const neckCount = neckShapingLines.length;
  const preferredFirstY = neckGuideY - neckCount * NECK_NOTATION_GAP;
  const neckShapingStep =
    neckCount > 0 && preferredFirstY < neckInsideTop
      ? (neckGuideY - neckInsideTop) / neckCount
      : NECK_NOTATION_GAP;
  const neckShapingFirstY = neckGuideY - neckCount * neckShapingStep;
  parts.push(
    `<g data-role="neck-label-zone" data-x="${fmtNum(neckLabelX)}" data-y="${fmtNum(neckShapingFirstY)}" data-bo-y="${fmtNum(neckBoY)}"></g>`,
  );
  for (const [i, line] of neckShapingLines.entries()) {
    const y = neckShapingFirstY + i * neckShapingStep;
    parts.push(
      `<text data-role="neck-shaping" data-label-zone="neck" data-notation="${escapeXml(labels.neckShaping)}" data-stack-order="${i}" x="${fmtNum(neckLabelX)}" y="${fmtNum(y)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(line)}</text>`,
    );
  }
  if (labels.neckBo) {
    parts.push(
      `<text data-role="neck-bo" data-label-zone="neck" data-notation="${escapeXml(labels.neckBo)}" data-stack-order="${neckShapingLines.length}" x="${fmtNum(neckLabelX)}" y="${fmtNum(neckBoY)}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(labels.neckBo)}</text>`,
    );
  }

  const shLines = labels.shoulderShaping.split("\n").filter(Boolean);
  const shoulderMidX = (frame.afterRight + frame.neckRight) / 2;
  const shoulderMidY = (frame.shoulderY + frame.neckCornerY) / 2;
  const slopeDx = frame.neckRight - frame.afterRight;
  const slopeDy = frame.neckCornerY - frame.shoulderY;
  const slopeLen = Math.hypot(slopeDx, slopeDy) || 1;
  const shAnchorX = shoulderMidX + (-slopeDy / slopeLen) * SHOULDER_LABEL_GAP;
  const shAnchorY = shoulderMidY + (slopeDx / slopeLen) * SHOULDER_LABEL_GAP;
  const shLastBaseline = shAnchorY;
  const shLabelX = clamp(
    Math.max(shAnchorX, rightShoulderOutlineXAtY(frame, shLastBaseline) + SHOULDER_OUTLINE_CLEARANCE),
    frame.neckRight + 4,
    ARMHOLE_LABEL_SAFE_MAX_X,
  );
  parts.push(
    `<g data-role="shoulder-label-zone" data-x="${fmtNum(shLabelX)}" data-y="${fmtNum(shLastBaseline)}"></g>`,
  );
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

  const safeBody = parts
    .join("")
    .replace(/\bNaN\b/g, "0")
    .replace(/\bInfinity\b/g, "0")
    .replace(/\bundefined\b/g, "");

  const desc = `Sleeveless pullover round-neck Front shaping notation. ${labels.castOn}. Neck ${labels.rcNeckStart}. Armhole ${labels.rcArmholeBo}.`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="sleeveless-round-front-notation-svg" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-labelledby="sleeveless-round-front-notation-title" data-sleeveless-front-round-generated-notation="true" data-supported="true" data-reset="${labels.rcReset ? "true" : "false"}" data-neck-contour="scoop" data-shoulder-contour="slope" data-body-shaping-direction="straight" data-body-shape="straight" data-garment-style="pullover" data-neckline-style="round" data-round-strategy="${escapeXml(neckline.strategy)}" data-center-held="${neckline.centerHeld ? "true" : "false"}" data-center-bind-off-sts="${fmtNum(neckline.centerBindOffStitches)}" data-neck-sts="${fmtNum(model.widths.necklineStitches)}" data-neck-depth-rows="${fmtNum(neckline.depthRows)}" data-hem-sts="${fmtNum(model.widths.hemStitches)}" data-bust-sts="${fmtNum(model.widths.bustStitches)}" data-after-armhole-sts="${fmtNum(model.widths.stitchesAfterArmhole)}" data-shoulder-sts="${fmtNum(model.widths.shoulderStitchesPerSide)}" data-bind-off-sts="${fmtNum(model.armhole.bindOffStsEachSide)}" data-decrease-sts="${fmtNum(model.armhole.decreaseStsEachSide)}" data-body-width="${fmtNum(frame.bodyWidth)}" data-after-armhole-width="${fmtNum(frame.afterWidth)}" data-neck-width="${fmtNum(frame.neckWidth)}" data-shoulder-side-width="${fmtNum(frame.shoulderSideWidth)}" data-hem-width="${fmtNum(frame.hemWidth)}" data-px-per-stitch="${fmtNum(frame.pxPerStitch)}" data-cx="${fmtNum(frame.cx)}" data-hem-left="${fmtNum(frame.hemLeft)}" data-hem-right="${fmtNum(frame.hemRight)}" data-bust-left="${fmtNum(frame.left)}" data-bust-right="${fmtNum(frame.right)}" data-after-left="${fmtNum(frame.afterLeft)}" data-after-right="${fmtNum(frame.afterRight)}" data-bo-left="${fmtNum(frame.boLeft)}" data-bo-right="${fmtNum(frame.boRight)}" data-neck-left="${fmtNum(frame.neckLeft)}" data-neck-right="${fmtNum(frame.neckRight)}" data-bottom-y="${fmtNum(frame.bottomY)}" data-hem-y="${fmtNum(frame.hemY)}" data-armhole-start-y="${fmtNum(frame.armholeStartY)}" data-last-armhole-y="${fmtNum(frame.lastArmholeY)}" data-neck-start-y="${fmtNum(frame.neckStartY)}" data-shoulder-y="${fmtNum(frame.shoulderY)}" data-neck-corner-y="${fmtNum(frame.neckCornerY)}" data-shoulder-top-y="${fmtNum(frame.shoulderTopY)}" data-visual-hem-h="${fmtNum(frame.visualHemH)}" data-visual-body-h="${fmtNum(frame.visualBodyH)}" data-visual-armhole-h="${fmtNum(frame.visualArmholeH)}" data-visual-shoulder-h="${fmtNum(frame.visualShoulderH)}" data-visual-neck-h="${fmtNum(frame.visualNeckH)}" data-neck-start-display-rc="${fmtNum(neckStartDisplayRc)}" data-neck-start-garment-rc="${fmtNum(neckStartGarmentRc)}" data-armhole-start-garment-rc="${fmtNum(armholeStart)}" data-last-armhole-garment-rc="${fmtNum(lastArmholeGarmentRc)}" data-shoulder-start-display-rc="${fmtNum(shoulderStartDisplayRc)}" data-shoulder-pass-count="${shoulderPasses.length}" data-cast-on="${escapeXml(labels.castOn)}" data-armhole-bo="${escapeXml(labels.armholeBo)}" data-armhole-shaping="${escapeXml(labels.armholeShaping)}" data-neck-bo="${escapeXml(labels.neckBo)}" data-neck-shaping="${escapeXml(labels.neckShaping)}" data-shoulder-shaping="${escapeXml(labels.shoulderShaping)}" data-rc-neck-start="${escapeXml(labels.rcNeckStart)}" data-rc-armhole-bo="${escapeXml(labels.rcArmholeBo)}" data-rc-reset="${escapeXml(labels.rcReset)}" data-rc-shoulder-start="${escapeXml(labels.rcShoulderStart)}" data-right-label-safe-max-x="${ARMHOLE_LABEL_SAFE_MAX_X}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet">`,
    `<title id="sleeveless-round-front-notation-title">Sleeveless pullover round-neck Front shaping notation</title>`,
    `<desc>${escapeXml(desc)}</desc>`,
    `<style type="text/css"><![CDATA[text{font-family:${FONT}}]]></style>`,
    `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#fff"/>`,
    safeBody,
    `</svg>`,
  ].join("");
}

export const SLEEVELESS_FRONT_ROUND_NOTATION_VIEWBOX = { width: VB_W, height: VB_H } as const;

export function tryBuildLiveSleevelessFrontRoundNotationSvg(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): string | null {
  if (!shouldUseGeneratedSleevelessFrontRoundNotation(result, patternData)) return null;
  const svg = buildSleevelessFrontRoundShapingNotationDiagramSvg(result, patternData);
  if (!svg.includes('data-sleeveless-front-round-generated-notation="true"')) return null;
  if (!svg.includes('data-supported="true"')) return null;
  return svg;
}
