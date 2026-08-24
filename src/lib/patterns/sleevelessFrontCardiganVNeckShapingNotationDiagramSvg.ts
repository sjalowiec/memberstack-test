/**
 * Generated Shaping Notation SVG for Sleeveless Cardigan LEFT FRONT / V-neck /
 * Straight Body.
 *
 * Garment geometry is the approved Cardigan V Stitches & Rows LEFT FRONT
 * silhouette (same model + the same frame math). Japanese notation is an
 * annotation layer — not a second drawing model and not a full-width pullover V.
 */

import { collectInnerNeckDecreasePointsFromTimeline } from "./notationOverlaySvg";
import { formatRcNotation } from "./sleevelessBackJapaneseNotation";
import {
  resolveSleevelessDiagramBodyShapeKind,
} from "./sleevelessDiagramBodyShapeSrc";
import {
  isSleevelessCardiganGarmentStyle,
  isSleevelessVNeckChoice,
} from "./sleevelessFrontDiagramSrc";
import { buildFrontJapaneseNotationReplacements } from "./sleevelessFrontJapaneseNotation";
import {
  buildSleevelessFrontStsRowsDiagramModel,
  isSleevelessFrontStsRowsVNeckline,
  type SleevelessFrontStsRowsDiagramModel,
} from "./sleevelessFrontStsRowsDiagramModel";
import { SLEEVELESS_FRONT_STS_ROWS_VISUAL } from "./sleevelessFrontStsRowsDiagramSvg";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";

const VB_W = 400;
const VB_H = 480;
const LABEL_GUTTER = 96;
const RIGHT_PAD = 86;
const TOP = 76;
const BOTTOM = 428;
const REF_BUST_STS = 80;

const STROKE = "#1a1a1a";
const FILL = "#f4f6f1";
const MUTED = "#4b5563";
const GUIDE = "#bdbec0";
const FONT = "Poppins, system-ui, Arial, sans-serif";
const FS_NOTATION = 17;
const FS_RC = 14;
const NOTATION_GAP = 18;
const NECK_NOTATION_GAP = 18;
const ARMHOLE_NOTATION_GAP = 18;
const RC_RESET_GAP = Math.round(FS_RC * 1.75);
const SHOULDER_LABEL_GAP = 14;
const SHOULDER_OUTLINE_CLEARANCE = 10;
const ARMHOLE_LABEL_SAFE_MAX_X = VB_W - 16;

type YBand = {
  rc0: number;
  rc1: number;
  yBottom: number;
  yTop: number;
};

type Pt = { x: number; y: number };

type Frame = {
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
  bottomY: number;
  hemY: number;
  shapeStartY: number;
  shapeEndY: number;
  armholeStartY: number;
  lastArmholeY: number;
  neckStartY: number;
  shoulderY: number;
  neckCornerY: number;
  shoulderTopY: number;
  bodyWidth: number;
  hemWidth: number;
  afterWidth: number;
  neckWidth: number;
  shoulderSideWidth: number;
  pxPerStitch: number;
  visualHemH: number;
  visualBodyH: number;
  visualArmholeH: number;
  visualShoulderH: number;
  visualNeckH: number;
  visualGarmentH: number;
  trueAfterWidth: number;
  upperScale: number;
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

function polylineD(points: readonly Pt[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${fmtNum(p.x)} ${fmtNum(p.y)}`)
    .join(" ");
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

function sectionInches(rows: number, rowsPerInch: number, fallback: number): number {
  if (rowsPerInch > 0 && rows > 0) return rows / rowsPerInch;
  return fallback;
}

/** Same inch-weighted bands as Cardigan V Stitches & Rows. */
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
  if (hemH > 0) {
    hemH = clamp(hemH, SLEEVELESS_FRONT_STS_ROWS_VISUAL.minHem, SLEEVELESS_FRONT_STS_ROWS_VISUAL.maxHem);
  }
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
  bands.push({ rc0: shoulderRc, rc1: endRc, yBottom: shoulderY, yTop: endY });
  return { bands, hemH, bodyH, armholeH, shoulderH };
}

/**
 * Cardigan LEFT FRONT frame — same formulas as
 * {@link buildSleevelessFrontStsRowsDiagramSvg} `buildFrame` cardigan branch.
 */
function buildCardiganVFrame(
  model: SleevelessFrontStsRowsDiagramModel,
): { frame: Frame; bands: YBand[] } {
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
  const trueAfterWidth = afterSts * pxPerStitch;
  const afterWidth = trueAfterWidth;
  const shoulderSideWidth = shoulderSts * pxPerStitch;
  const neckWidth = Math.max(0, afterWidth - shoulderSideWidth);
  const boInset = Math.max(0, bindOffSts * pxPerStitch);
  const left = cx - half;
  const right = cx + half;
  const cardiganHemWidth = clamp(hemSts * pxPerStitch, 18, Math.max(18, VB_W - 12 - left));
  const hemLeft = left;
  const hemRight = left + cardiganHemWidth;
  const afterLeft = left;
  const afterRight = left + afterWidth;
  const neckLeft = left;
  const neckRight = left + neckWidth;
  const bottomY = yAtRc(0, bands);
  const hemY = hemRc > 0 ? yAtRc(hemRc, bands) : bottomY;
  const armholeStartY = yAtRc(armholeStart, bands);
  const shapeStartRc = clamp(model.bodyShaping.startRc, 0, armholeStart);
  const shapeEndRc = clamp(model.bodyShaping.endRc, shapeStartRc, armholeStart);
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
      left,
      right,
      afterLeft,
      afterRight,
      boLeft: left,
      boRight: cx + half - boInset,
      neckLeft,
      neckRight,
      hemLeft,
      hemRight,
      bottomY,
      hemY,
      shapeStartY: yAtRc(shapeStartRc, bands),
      shapeEndY: yAtRc(shapeEndRc, bands),
      armholeStartY,
      lastArmholeY,
      neckStartY,
      shoulderY,
      neckCornerY,
      shoulderTopY,
      bodyWidth,
      hemWidth: hemRight - hemLeft,
      afterWidth,
      neckWidth,
      shoulderSideWidth,
      pxPerStitch,
      visualHemH: allocated.hemH,
      visualBodyH: allocated.bodyH,
      visualArmholeH: allocated.armholeH,
      visualShoulderH: allocated.shoulderH,
      visualNeckH: Math.max(0, neckStartY - neckCornerY),
      visualGarmentH: Math.max(0, bottomY - shoulderTopY),
      trueAfterWidth,
      upperScale: 1,
    },
    bands,
  };
}

function bodySidePoints(frame: Frame, side: "left" | "right"): Pt[] {
  const bustX = side === "left" ? frame.left : frame.right;
  return [
    { x: bustX, y: frame.bottomY },
    { x: bustX, y: side === "left" ? frame.neckStartY : frame.armholeStartY },
  ];
}

function drawSilhouette(frame: Frame): string {
  const leftBody = bodySidePoints(frame, "left");
  const rightBody = bodySidePoints(frame, "right");
  const rightArmhole: Pt[] = [
    { x: frame.right, y: frame.armholeStartY },
    { x: frame.boRight, y: frame.armholeStartY },
    { x: frame.afterRight, y: frame.lastArmholeY },
    { x: frame.afterRight, y: frame.shoulderY },
  ];
  const rightShoulder: Pt[] = [
    { x: frame.afterRight, y: frame.shoulderY },
    { x: frame.neckRight, y: frame.neckCornerY },
  ];
  const vNeckline: Pt[] = [
    { x: frame.neckLeft, y: frame.neckStartY },
    { x: frame.neckRight, y: frame.neckCornerY },
  ];
  const silhouette = [
    `M ${fmtNum(frame.left)} ${fmtNum(frame.bottomY)}`,
    `L ${fmtNum(frame.left)} ${fmtNum(frame.neckStartY)}`,
    `L ${fmtNum(frame.neckRight)} ${fmtNum(frame.neckCornerY)}`,
    `L ${fmtNum(frame.afterRight)} ${fmtNum(frame.shoulderY)}`,
    `L ${fmtNum(frame.afterRight)} ${fmtNum(frame.lastArmholeY)}`,
    `L ${fmtNum(frame.boRight)} ${fmtNum(frame.armholeStartY)}`,
    `L ${fmtNum(frame.right)} ${fmtNum(frame.armholeStartY)}`,
    `L ${fmtNum(frame.right)} ${fmtNum(frame.bottomY)}`,
    "Z",
  ].join(" ");
  return [
    `<path class="sleeveless-cardigan-v-notation__body" data-role="body-outline" d="${silhouette}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    `<path data-role="center-front-edge" d="${polylineD(leftBody)}" fill="none" stroke="none"/>`,
    `<path data-role="left-body-path" d="${polylineD(leftBody)}" fill="none" stroke="none"/>`,
    `<path data-role="right-body-path" d="${polylineD(rightBody)}" fill="none" stroke="none"/>`,
    `<path data-role="armhole-outline" data-side="right" d="${polylineD(rightArmhole)}" fill="none" stroke="none"/>`,
    `<path data-role="neckline-outline" data-contour="v" d="${polylineD(vNeckline)}" fill="none" stroke="none"/>`,
    `<path data-role="shoulder-outline" data-side="right" data-contour="slope" d="${polylineD(rightShoulder)}" fill="none" stroke="none"/>`,
    `<g data-role="v-point" data-x="${fmtNum(frame.neckLeft)}" data-y="${fmtNum(frame.neckStartY)}"></g>`,
  ].join("");
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

function rightShoulderOutlineXAtY(frame: Frame, y: number): number {
  if (y >= frame.shoulderY) return frame.afterRight;
  if (y <= frame.neckCornerY) return frame.neckRight;
  const span = frame.shoulderY - frame.neckCornerY;
  if (!(span > 0)) return Math.max(frame.afterRight, frame.neckRight);
  const t = clamp((frame.shoulderY - y) / span, 0, 1);
  return frame.afterRight + t * (frame.neckRight - frame.afterRight);
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
    neckBo: repl["jp-neckline-bo"] ?? "",
    neckShaping: repl["jp-neckline-shaping"] ?? "",
    shoulderShaping: repl["jp-shoulder-shaping"] ?? "",
    rcCastOn: repl["rc-caston"] ?? "",
    rcHem: repl["rc-hem"] ?? "",
    rcArmholeBo: repl["rc-armhole-bo"] ?? "",
    rcReset: repl.rc_reset ?? "",
    rcNeckStart: repl["rc-neckline-start"] ?? "",
    rcShoulderStart: repl["rc-shoulder-start"] ?? "",
  };
}

function displayRcAfterArmholeReset(garmentRc: number, armholeStart: number): number {
  return Math.max(0, Math.floor(garmentRc) - Math.floor(armholeStart));
}

function frontTimeline(result: SleevelessBackPatternResult) {
  return result.frontNeckShoulderTimeline ?? result.frontNeckShoulderShapingChart.timeline ?? [];
}

function isSupportedCardiganVModel(model: SleevelessFrontStsRowsDiagramModel): boolean {
  if (model.piece !== "front" || model.garmentStyle !== "cardigan") return false;
  if (model.frontPiece !== "leftFront") return false;
  if (model.neckline.style !== "v-neck") return false;
  if (model.neckline.construction !== "half-front-cf") return false;
  if (model.bodyShape !== "straight") return false;
  return model.bodyShaping.direction === "straight";
}

function unsupportedSvg(): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="sleeveless-cardigan-v-notation-svg" viewBox="0 0 ${VB_W} ${VB_H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" data-sleeveless-cardigan-v-generated-notation="true" data-supported="false">`,
    `<title>Sleeveless Cardigan V-neck Front shaping notation unavailable</title>`,
    `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#fff"/>`,
    `</svg>`,
  ].join("");
}

export function shouldUseGeneratedSleevelessFrontCardiganVNeckNotation(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): boolean {
  if (!isSleevelessCardiganGarmentStyle(patternData ?? {})) return false;
  if (!isSleevelessVNeckChoice(patternData)) return false;
  if (resolveSleevelessDiagramBodyShapeKind(patternData) !== "straight") return false;
  if (!result.frontNeckShoulderChartUsesLiveRows) return false;
  const model = buildSleevelessFrontStsRowsDiagramModel(result, patternData);
  return model != null && isSupportedCardiganVModel(model);
}

export function buildSleevelessFrontCardiganVNeckShapingNotationDiagramSvg(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): string {
  if (!shouldUseGeneratedSleevelessFrontCardiganVNeckNotation(result, patternData)) {
    return unsupportedSvg();
  }
  const model = buildSleevelessFrontStsRowsDiagramModel(result, patternData);
  if (!model || !isSupportedCardiganVModel(model) || !isSleevelessFrontStsRowsVNeckline(model.neckline)) {
    return unsupportedSvg();
  }

  const { frame, bands } = buildCardiganVFrame(model);
  const labels = buildLabels(result, patternData ?? {});
  const armholeStart = model.armhole.startGarmentRc;
  const neckStartGarmentRc = model.neckline.startGarmentRc;
  const timeline = frontTimeline(result);
  const neckPoints = collectInnerNeckDecreasePointsFromTimeline(timeline, "right");
  const gutterX = Math.max(8, frame.left - 10);
  const resetY = labels.rcReset ? frame.armholeStartY - RC_RESET_GAP : frame.armholeStartY;
  const hemMidX = (frame.hemLeft + frame.hemRight) / 2;
  const d = result.debug;

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
  if (d.hemRows > 0) {
    parts.push(
      dashedLine(gutterX + 6, frame.hemY, frame.left + 12, "hem", ` data-y="${fmtNum(frame.hemY)}"`),
    );
  }
  parts.push(
    rcText(gutterX, frame.bottomY, labels.rcCastOn, "rc-caston", ` data-rc="${escapeXml(labels.rcCastOn)}"`),
  );
  if (d.hemRows > 0) {
    parts.push(rcText(gutterX, frame.hemY, labels.rcHem, "rc-hem", ` data-rc="${escapeXml(labels.rcHem)}"`));
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
      rcText(gutterX, resetY, labels.rcReset, "rc-reset", ` data-rc="${escapeXml(labels.rcReset)}"`),
    );
  }
  const neckStartOffset =
    labels.rcReset && Math.abs(frame.neckStartY - frame.armholeStartY) < 1.5
      ? RC_RESET_GAP + Math.round(FS_RC * 1.25)
      : 0;
  parts.push(
    rcText(
      gutterX,
      frame.neckStartY - neckStartOffset,
      labels.rcNeckStart,
      "neck-start-rc",
      ` data-rc="${escapeXml(labels.rcNeckStart)}" data-garment-rc="${fmtNum(neckStartGarmentRc)}"`,
    ),
  );
  const shareTopRcGuide = Math.abs(frame.neckStartY - neckStartOffset - frame.shoulderY) < FS_RC;
  if (labels.rcShoulderStart && !shareTopRcGuide) {
    parts.push(
      rcText(
        gutterX,
        frame.shoulderY,
        labels.rcShoulderStart,
        "shoulder-start-rc",
        ` data-rc="${escapeXml(labels.rcShoulderStart)}"`,
      ),
    );
  }

  if (model.armhole.bindOffStsEachSide > 0) {
    parts.push(eventHook("armhole-event", 0, armholeStart, frame.armholeStartY));
  }
  for (const ev of model.armhole.events.filter((e) => e.kind === "decrease")) {
    parts.push(
      eventHook(
        "armhole-event",
        displayRcAfterArmholeReset(ev.garmentRc, armholeStart),
        ev.garmentRc,
        yAtRc(ev.garmentRc, bands),
      ),
    );
  }
  parts.push(eventHook("neck-start", displayRcAfterArmholeReset(neckStartGarmentRc, armholeStart), neckStartGarmentRc, frame.neckStartY));
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
  for (const pt of model.shoulder.points) {
    parts.push(
      eventHook(
        "shoulder-event",
        displayRcAfterArmholeReset(pt.row, armholeStart),
        pt.row,
        yAtRc(pt.row, bands),
      ),
    );
  }

  const armholeLabelX = clamp(frame.afterRight + 12, frame.afterRight + 8, ARMHOLE_LABEL_SAFE_MAX_X);
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
    const y = armholeBoY + i * ARMHOLE_NOTATION_GAP;
    parts.push(
      `<text data-role="${entry.role}" data-notation="${escapeXml(entry.notation)}" data-label-zone="armhole" data-stack-order="${i}" x="${fmtNum(armholeLabelX)}" y="${fmtNum(y)}" text-anchor="start" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(entry.line)}</text>`,
    );
  }

  const neckLines = labels.neckShaping.split("\n").filter(Boolean);
  const neckLabelX = clamp(
    frame.left + Math.max(18, frame.neckWidth * 0.38),
    frame.left + 12,
    frame.neckRight - 8,
  );
  const vBandTop = Math.min(frame.neckStartY, frame.neckCornerY);
  const vBandBot = Math.max(frame.neckStartY, frame.neckCornerY);
  const neckStackH = Math.max(0, (neckLines.length - 1) * NECK_NOTATION_GAP);
  const neckLastBaseline = clamp(vBandBot - 28, vBandTop + 24 + neckStackH, vBandBot - 12);
  parts.push(
    `<g data-role="neck-label-zone" data-x="${fmtNum(neckLabelX)}" data-y="${fmtNum(neckLastBaseline)}"></g>`,
  );
  parts.push(
    drawNotationStack(
      neckLines,
      neckLabelX,
      neckLastBaseline,
      `data-role="neck-shaping" data-label-zone="neck" data-notation="${escapeXml(labels.neckShaping)}"`,
    ),
  );

  const shLines = labels.shoulderShaping.split("\n").filter(Boolean);
  const shoulderMidX = (frame.afterRight + frame.neckRight) / 2;
  const shoulderMidY = (frame.shoulderY + frame.neckCornerY) / 2;
  const slopeDx = frame.neckRight - frame.afterRight;
  const slopeDy = frame.neckCornerY - frame.shoulderY;
  const slopeLen = Math.hypot(slopeDx, slopeDy) || 1;
  const shAnchorX = shoulderMidX + (-slopeDy / slopeLen) * SHOULDER_LABEL_GAP;
  const shAnchorY = shoulderMidY + (slopeDx / slopeLen) * SHOULDER_LABEL_GAP;
  const shLabelX = clamp(
    Math.max(shAnchorX, rightShoulderOutlineXAtY(frame, shAnchorY) + SHOULDER_OUTLINE_CLEARANCE),
    frame.neckRight + 4,
    ARMHOLE_LABEL_SAFE_MAX_X,
  );
  parts.push(
    `<g data-role="shoulder-label-zone" data-x="${fmtNum(shLabelX)}" data-y="${fmtNum(shAnchorY)}"></g>`,
  );
  parts.push(
    drawNotationStack(
      shLines,
      shLabelX,
      shAnchorY,
      `data-role="shoulder-shaping" data-label-zone="shoulder" data-notation="${escapeXml(labels.shoulderShaping)}"`,
    ),
  );
  parts.push(
    `<text data-role="cast-on" data-notation="${escapeXml(labels.castOn)}" x="${fmtNum(hemMidX)}" y="${fmtNum(Math.min(VB_H - 8, frame.bottomY + 16))}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(labels.castOn)}</text>`,
  );

  const safeBody = parts
    .join("")
    .replace(/\bNaN\b/g, "0")
    .replace(/\bInfinity\b/g, "0")
    .replace(/\bundefined\b/g, "");
  const desc = `Sleeveless Cardigan left Front V-neck shaping notation. ${labels.castOn}. Neck ${labels.rcNeckStart}. Armhole ${labels.rcArmholeBo}.`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="sleeveless-cardigan-v-notation-svg" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-labelledby="sleeveless-cardigan-v-notation-title" data-sleeveless-cardigan-v-generated-notation="true" data-supported="true" data-piece="front" data-garment-style="cardigan" data-front-piece="leftFront" data-neckline-style="v-neck" data-neckline-construction="half-front-cf" data-body-shape="straight" data-front-band-included="false" data-cf-x="${fmtNum(frame.left)}" data-neck-contour="v" data-shoulder-contour="slope" data-reset="${labels.rcReset ? "true" : "false"}" data-hem-sts="${fmtNum(model.widths.hemStitches)}" data-bust-sts="${fmtNum(model.widths.bustStitches)}" data-after-armhole-sts="${fmtNum(model.widths.stitchesAfterArmhole)}" data-neck-sts="${fmtNum(model.widths.necklineStitches)}" data-shoulder-sts="${fmtNum(model.widths.shoulderStitchesPerSide)}" data-hem-width="${fmtNum(frame.hemWidth)}" data-bust-width="${fmtNum(frame.bodyWidth)}" data-after-armhole-width="${fmtNum(frame.afterWidth)}" data-neck-width="${fmtNum(frame.neckWidth)}" data-px-per-stitch="${fmtNum(frame.pxPerStitch)}" data-hem-left="${fmtNum(frame.hemLeft)}" data-hem-right="${fmtNum(frame.hemRight)}" data-bust-left="${fmtNum(frame.left)}" data-bust-right="${fmtNum(frame.right)}" data-after-left="${fmtNum(frame.afterLeft)}" data-after-right="${fmtNum(frame.afterRight)}" data-bo-right="${fmtNum(frame.boRight)}" data-neck-left="${fmtNum(frame.neckLeft)}" data-neck-right="${fmtNum(frame.neckRight)}" data-bottom-y="${fmtNum(frame.bottomY)}" data-hem-y="${fmtNum(frame.hemY)}" data-armhole-start-y="${fmtNum(frame.armholeStartY)}" data-last-armhole-y="${fmtNum(frame.lastArmholeY)}" data-neck-start-y="${fmtNum(frame.neckStartY)}" data-shoulder-y="${fmtNum(frame.shoulderY)}" data-neck-corner-y="${fmtNum(frame.neckCornerY)}" data-shoulder-top-y="${fmtNum(frame.shoulderTopY)}" data-armhole-start-garment-rc="${fmtNum(armholeStart)}" data-neck-start-garment-rc="${fmtNum(neckStartGarmentRc)}" data-last-armhole-garment-rc="${fmtNum(model.armhole.lastGarmentRc)}" data-bind-off-sts="${fmtNum(model.armhole.bindOffStsEachSide)}" data-decrease-sts="${fmtNum(model.armhole.decreaseStsEachSide)}" data-neck-decrease-count="${fmtNum(neckPoints.length)}" data-shoulder-point-count="${fmtNum(model.shoulder.points.length)}" data-cast-on="${escapeXml(labels.castOn)}" data-armhole-bo="${escapeXml(labels.armholeBo)}" data-armhole-shaping="${escapeXml(labels.armholeShaping)}" data-neck-bo="${escapeXml(labels.neckBo)}" data-neck-shaping="${escapeXml(labels.neckShaping)}" data-shoulder-shaping="${escapeXml(labels.shoulderShaping)}" data-rc-neck-start="${escapeXml(labels.rcNeckStart)}" data-rc-armhole-bo="${escapeXml(labels.rcArmholeBo)}" data-rc-reset="${escapeXml(labels.rcReset)}" data-rc-shoulder-start="${escapeXml(labels.rcShoulderStart)}" data-timeline-source="frontNeckShoulderTimeline-full-width-v-right-edge" width="100%" height="auto" preserveAspectRatio="xMidYMid meet">`,
    `<title id="sleeveless-cardigan-v-notation-title">Sleeveless Cardigan left Front V-neck shaping notation</title>`,
    `<desc>${escapeXml(desc)}</desc>`,
    `<style type="text/css"><![CDATA[text{font-family:${FONT}}]]></style>`,
    `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#fff"/>`,
    safeBody,
    `</svg>`,
  ].join("");
}

export const SLEEVELESS_FRONT_CARDIGAN_VNECK_NOTATION_VIEWBOX = { width: VB_W, height: VB_H } as const;
export const SLEEVELESS_FRONT_CARDIGAN_VNECK_NOTATION_FS_NOTATION = FS_NOTATION;
export const SLEEVELESS_FRONT_CARDIGAN_VNECK_NOTATION_FS_RC = FS_RC;

export function tryBuildLiveSleevelessFrontCardiganVNeckNotationSvg(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): string | null {
  if (!shouldUseGeneratedSleevelessFrontCardiganVNeckNotation(result, patternData)) return null;
  const svg = buildSleevelessFrontCardiganVNeckShapingNotationDiagramSvg(result, patternData);
  if (!svg.includes('data-sleeveless-cardigan-v-generated-notation="true"')) return null;
  if (!svg.includes('data-supported="true"')) return null;
  return svg;
}
