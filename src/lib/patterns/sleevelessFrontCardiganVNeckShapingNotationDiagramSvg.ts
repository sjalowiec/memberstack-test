/**
 * Generated Shaping Notation SVG for Sleeveless Cardigan LEFT FRONT / V-neck
 * (straight or A-line).
 *
 * Garment geometry is the approved Cardigan V Stitches & Rows LEFT FRONT
 * silhouette (same model + shared Front garment frame). Japanese notation is an
 * annotation layer — not a second drawing model and not a full-width pullover V.
 * A-line tapers the right/side-seam edge only (`armholeEdgeOnly`).
 */

import { collectInnerNeckDecreasePointsFromTimeline } from "./notationOverlaySvg";
import { cardiganArmholeNotationYs } from "./sleevelessFrontCardiganArmholeNotationLayout";
import { formatRcNotation } from "./sleevelessBackJapaneseNotation";
import { isSleevelessShapedBodyShape } from "./sleevelessAlineShaping";
import {
  isSleevelessCardiganGarmentStyle,
  isSleevelessVNeckChoice,
} from "./sleevelessFrontDiagramSrc";
import { buildFrontJapaneseNotationReplacements } from "./sleevelessFrontJapaneseNotation";
import {
  buildSleevelessFrontGarmentFrame,
  sleevelessFrontBodySidePoints,
  sleevelessFrontCardiganCenterFrontPoints,
  sleevelessFrontPolylineD,
  sleevelessFrontRightBodyOutlineXAtY,
  sleevelessFrontYAtRc,
  usesSleevelessFrontAlineBodySilhouette,
  type SleevelessFrontGarmentFrame,
  type SleevelessFrontGarmentPt,
} from "./sleevelessFrontGarmentGeometry";
import {
  buildSleevelessFrontStsRowsDiagramModel,
  isSleevelessFrontStsRowsVNeckline,
  type SleevelessFrontStsRowsDiagramModel,
} from "./sleevelessFrontStsRowsDiagramModel";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";

const VB_W = 400;
const VB_H = 480;

const STROKE = "#1a1a1a";
const FILL = "#f4f6f1";
const MUTED = "#4b5563";
const GUIDE = "#bdbec0";
const FONT = "Poppins, system-ui, Arial, sans-serif";
const FS_NOTATION = 17;
const FS_RC = 14;
const NOTATION_GAP = 18;
const NECK_NOTATION_GAP = 18;
const RC_RESET_GAP = Math.round(FS_RC * 1.75);
/** 0 = outer/armhole end of the slope, 1 = neck corner. */
const SHOULDER_SLOPE_T = 0.3;
const SHOULDER_OUT_RIGHT = 14;
const SHOULDER_OUT_UP = 6;
const SHOULDER_OUTLINE_CLEARANCE = 12;
const ARMHOLE_LABEL_CLEARANCE = 14;
const ARMHOLE_LABEL_SAFE_MAX_X = VB_W - 16;
/** Gap from the V edge into the garment interior. */
const V_EDGE_GAP = 10;
/** Minimum space between RC-gutter anchor (right edge of RC text) and neck-block left edge. */
const RC_GUTTER_MIN_CLEARANCE = 24;
const BODY_NOTATION_GAP = 18;
const BODY_LABEL_OUTLINE_CLEARANCE = 18;

type Pt = SleevelessFrontGarmentPt;
type Frame = SleevelessFrontGarmentFrame;

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

const polylineD = sleevelessFrontPolylineD;
const yAtRc = sleevelessFrontYAtRc;
const buildCardiganVFrame = buildSleevelessFrontGarmentFrame;

function drawSilhouette(frame: Frame, tapered: boolean): string {
  const leftBody = sleevelessFrontCardiganCenterFrontPoints(frame);
  const rightBody = sleevelessFrontBodySidePoints(frame, "right", tapered);
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
  const rightDown = [...rightBody].reverse();
  const rightClose =
    rightDown[0] &&
    Math.abs(rightDown[0].x - frame.right) < 0.05 &&
    Math.abs(rightDown[0].y - frame.armholeStartY) < 0.05
      ? rightDown.slice(1)
      : rightDown;
  const silhouette = [
    `M ${fmtNum(frame.left)} ${fmtNum(frame.bottomY)}`,
    `L ${fmtNum(frame.left)} ${fmtNum(frame.neckStartY)}`,
    `L ${fmtNum(frame.neckRight)} ${fmtNum(frame.neckCornerY)}`,
    `L ${fmtNum(frame.afterRight)} ${fmtNum(frame.shoulderY)}`,
    `L ${fmtNum(frame.afterRight)} ${fmtNum(frame.lastArmholeY)}`,
    `L ${fmtNum(frame.boRight)} ${fmtNum(frame.armholeStartY)}`,
    `L ${fmtNum(frame.right)} ${fmtNum(frame.armholeStartY)}`,
    ...rightClose.map((pt) => `L ${fmtNum(pt.x)} ${fmtNum(pt.y)}`),
    "Z",
  ].join(" ");
  return [
    `<path class="sleeveless-cardigan-v-notation__body" data-role="body-outline" d="${silhouette}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    `<path data-role="center-front-edge" d="${polylineD(leftBody)}" fill="none" stroke="none"/>`,
    `<path data-role="left-body-path" d="${polylineD(leftBody)}" fill="none" stroke="none"/>`,
    `<path data-role="right-body-path" data-shaping-edge="side-seam" d="${polylineD(rightBody)}" fill="none" stroke="none"/>`,
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

/** Right-armhole outline X at a canvas Y (BO ledge → decrease slope → vertical). */
function rightArmholeOutlineXAtY(frame: Frame, y: number): number {
  if (y >= frame.armholeStartY) return frame.right;
  if (y <= frame.lastArmholeY) return frame.afterRight;
  const span = frame.armholeStartY - frame.lastArmholeY;
  if (!(span > 0)) return Math.max(frame.right, frame.afterRight);
  const t = clamp((frame.armholeStartY - y) / span, 0, 1);
  return frame.boRight + t * (frame.afterRight - frame.boRight);
}

/** Cardigan V edge X at a canvas Y (CF at neck start → neck/shoulder corner). */
function vNeckEdgeXAtY(frame: Frame, y: number): number {
  if (y >= frame.neckStartY) return frame.neckLeft;
  if (y <= frame.neckCornerY) return frame.neckRight;
  const span = frame.neckStartY - frame.neckCornerY;
  if (!(span > 0)) return frame.neckLeft;
  const t = clamp((frame.neckStartY - y) / span, 0, 1);
  return frame.neckLeft + t * (frame.neckRight - frame.neckLeft);
}

function stackYs(lastBaselineY: number, count: number, gap: number, direction: "up" | "down"): number[] {
  const n = Math.max(1, count);
  return Array.from({ length: n }, (_, i) =>
    direction === "down" ? lastBaselineY + i * gap : lastBaselineY - i * gap,
  );
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
    bodyShaping: repl["jp-body-shaping"] ?? "",
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
  if (model.bodyShape === "straight") return model.bodyShaping.direction === "straight";
  return model.bodyShape === "aline";
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
  if (
    isSleevelessShapedBodyShape(
      patternData && typeof patternData === "object" && !Array.isArray(patternData)
        ? (patternData as Record<string, unknown>)
        : {},
    )
  ) {
    return false;
  }
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
  const tapered = usesSleevelessFrontAlineBodySilhouette(model);
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
    drawSilhouette(frame, tapered),
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
  if (tapered) {
    for (const row of model.bodyShaping.rowNumbers) {
      parts.push(
        `<g data-role="body-event" data-rc="${escapeXml(formatRcNotation(row))}" data-garment-rc="${fmtNum(row)}" data-y="${fmtNum(yAtRc(row, bands))}" data-body-shaping-direction="${model.bodyShaping.direction}"></g>`,
      );
    }
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
  const armholeBoY = frame.armholeStartY;
  const armholeYs = cardiganArmholeNotationYs(armholeBoY, armholeStack.length);
  const armholeOutlineX = armholeYs.reduce(
    (maxX, y) => Math.max(maxX, rightArmholeOutlineXAtY(frame, y)),
    frame.afterRight,
  );
  const armholeLabelX = clamp(
    armholeOutlineX + ARMHOLE_LABEL_CLEARANCE,
    armholeOutlineX + ARMHOLE_LABEL_CLEARANCE,
    ARMHOLE_LABEL_SAFE_MAX_X,
  );
  parts.push(
    `<g data-role="armhole-label-zone" data-x="${fmtNum(armholeLabelX)}" data-y="${fmtNum(armholeBoY)}" data-outline-x="${fmtNum(armholeOutlineX)}" data-clearance="${fmtNum(ARMHOLE_LABEL_CLEARANCE)}"></g>`,
  );
  for (const [i, entry] of armholeStack.entries()) {
    const y = armholeYs[i]!;
    parts.push(
      `<text data-role="${entry.role}" data-notation="${escapeXml(entry.notation)}" data-label-zone="armhole" data-stack-order="${i}" x="${fmtNum(armholeLabelX)}" y="${fmtNum(y)}" text-anchor="start" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(entry.line)}</text>`,
    );
  }

  const neckLines = labels.neckShaping.split("\n").filter(Boolean);
  const vBandTop = Math.min(frame.neckStartY, frame.neckCornerY);
  const vBandBot = Math.max(frame.neckStartY, frame.neckCornerY);
  const neckStackH = Math.max(0, (neckLines.length - 1) * NECK_NOTATION_GAP);
  const neckLastBaseline = clamp(vBandBot - 8, vBandTop + 20 + neckStackH, vBandBot - 4);
  const neckMidY = neckLastBaseline - neckStackH / 2;
  const vEdgeX = vNeckEdgeXAtY(frame, neckMidY);
  const rcSafeX = gutterX + RC_GUTTER_MIN_CLEARANCE;
  const neckLabelX = clamp(Math.max(vEdgeX + V_EDGE_GAP, rcSafeX), rcSafeX, ARMHOLE_LABEL_SAFE_MAX_X);
  parts.push(
    `<g data-role="neck-label-zone" data-x="${fmtNum(neckLabelX)}" data-y="${fmtNum(neckLastBaseline)}" data-v-edge-x="${fmtNum(vEdgeX)}" data-rc-safe-x="${fmtNum(rcSafeX)}" data-placement="cardigan-v"></g>`,
  );
  parts.push(
    drawNotationStack(
      neckLines,
      neckLabelX,
      neckLastBaseline,
      `data-role="neck-shaping" data-label-zone="neck" data-notation="${escapeXml(labels.neckShaping)}"`,
      "start",
      NECK_NOTATION_GAP,
    ),
  );

  const shLines = labels.shoulderShaping.split("\n").filter(Boolean);
  const shAnchorX = frame.afterRight + SHOULDER_SLOPE_T * (frame.neckRight - frame.afterRight);
  const shAnchorY = frame.shoulderY + SHOULDER_SLOPE_T * (frame.neckCornerY - frame.shoulderY);
  const shLastBaseline = shAnchorY - SHOULDER_OUT_UP;
  const shYs = stackYs(shLastBaseline, shLines.length, NOTATION_GAP, "up");
  const shoulderOutlineX = shYs.reduce(
    (maxX, y) => Math.max(maxX, rightShoulderOutlineXAtY(frame, y)),
    frame.afterRight,
  );
  const shLabelX = clamp(
    Math.max(shAnchorX + SHOULDER_OUT_RIGHT, shoulderOutlineX + SHOULDER_OUTLINE_CLEARANCE),
    shoulderOutlineX + SHOULDER_OUTLINE_CLEARANCE,
    ARMHOLE_LABEL_SAFE_MAX_X,
  );
  parts.push(
    `<g data-role="shoulder-label-zone" data-x="${fmtNum(shLabelX)}" data-y="${fmtNum(shLastBaseline)}" data-outline-x="${fmtNum(shoulderOutlineX)}" data-slope-t="${fmtNum(SHOULDER_SLOPE_T)}"></g>`,
  );
  parts.push(
    drawNotationStack(
      shLines,
      shLabelX,
      shLastBaseline,
      `data-role="shoulder-shaping" data-label-zone="shoulder" data-notation="${escapeXml(labels.shoulderShaping)}"`,
      "start",
    ),
  );
  parts.push(
    `<text data-role="cast-on" data-notation="${escapeXml(labels.castOn)}" x="${fmtNum(hemMidX)}" y="${fmtNum(Math.min(VB_H - 8, frame.bottomY + 16))}" text-anchor="middle" fill="${MUTED}" ${textFont(FS_NOTATION)}>${escapeXml(labels.castOn)}</text>`,
  );
  const bodyLines = tapered ? labels.bodyShaping.split("\n").filter(Boolean) : [];
  let bodyLabelX = 0;
  let bodyOutlineX = 0;
  let bodyLastBaseline = 0;
  if (bodyLines.length > 0) {
    const bodyMidY = (frame.shapeStartY + frame.shapeEndY) / 2;
    const bodyStackH = Math.max(0, (bodyLines.length - 1) * BODY_NOTATION_GAP);
    bodyLastBaseline = clamp(
      bodyMidY + bodyStackH / 2,
      frame.armholeStartY + 40 + bodyStackH,
      frame.bottomY - 28,
    );
    bodyOutlineX = sleevelessFrontRightBodyOutlineXAtY(frame, bodyLastBaseline, tapered);
    bodyLabelX = bodyOutlineX + BODY_LABEL_OUTLINE_CLEARANCE;
    parts.push(
      `<g data-role="body-shaping-label-zone" data-body-label-x="${fmtNum(bodyLabelX)}" data-body-outline-x-at-label="${fmtNum(bodyOutlineX)}" data-body-label-y="${fmtNum(bodyLastBaseline)}" data-body-label-clearance="${BODY_LABEL_OUTLINE_CLEARANCE}"></g>`,
    );
    parts.push(
      drawNotationStack(
        bodyLines,
        bodyLabelX,
        bodyLastBaseline,
        `data-role="body-shaping" data-label-zone="body" data-notation="${escapeXml(labels.bodyShaping)}"`,
        "start",
        BODY_NOTATION_GAP,
      ),
    );
  }

  const safeBody = parts
    .join("")
    .replace(/\bNaN\b/g, "0")
    .replace(/\bInfinity\b/g, "0")
    .replace(/\bundefined\b/g, "");
  const desc = `Sleeveless Cardigan left Front V-neck shaping notation. ${labels.castOn}. Neck ${labels.rcNeckStart}. Armhole ${labels.rcArmholeBo}.`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="sleeveless-cardigan-v-notation-svg" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-labelledby="sleeveless-cardigan-v-notation-title" data-sleeveless-cardigan-v-generated-notation="true" data-supported="true" data-piece="front" data-garment-style="cardigan" data-front-piece="leftFront" data-neckline-style="v-neck" data-neckline-construction="half-front-cf" data-body-shape="${escapeXml(model.bodyShape)}" data-body-shaping-direction="${escapeXml(model.bodyShaping.direction)}" data-body-start-stitches="${fmtNum(model.bodyShaping.hemStitches)}" data-body-end-stitches="${fmtNum(model.bodyShaping.bustStitches)}" data-body-shaping-start-rc="${fmtNum(model.bodyShaping.startRc)}" data-body-shaping-end-rc="${fmtNum(model.bodyShaping.endRc)}" data-body-shaping-start-y="${fmtNum(frame.shapeStartY)}" data-body-shaping-end-y="${fmtNum(frame.shapeEndY)}" data-body-shaping="${escapeXml(tapered ? labels.bodyShaping : "")}" data-body-label-x="${fmtNum(bodyLabelX)}" data-body-outline-x-at-label="${fmtNum(bodyOutlineX)}" data-shaping-edge="side-seam" data-front-band-included="false" data-cf-x="${fmtNum(frame.left)}" data-rc-gutter-x="${fmtNum(gutterX)}" data-rc-gutter-min-clearance="${fmtNum(RC_GUTTER_MIN_CLEARANCE)}" data-v-edge-gap="${fmtNum(V_EDGE_GAP)}" data-neck-contour="v" data-shoulder-contour="slope" data-reset="${labels.rcReset ? "true" : "false"}" data-hem-sts="${fmtNum(model.widths.hemStitches)}" data-bust-sts="${fmtNum(model.widths.bustStitches)}" data-after-armhole-sts="${fmtNum(model.widths.stitchesAfterArmhole)}" data-neck-sts="${fmtNum(model.widths.necklineStitches)}" data-shoulder-sts="${fmtNum(model.widths.shoulderStitchesPerSide)}" data-hem-width="${fmtNum(frame.hemWidth)}" data-bust-width="${fmtNum(frame.bodyWidth)}" data-after-armhole-width="${fmtNum(frame.afterWidth)}" data-neck-width="${fmtNum(frame.neckWidth)}" data-px-per-stitch="${fmtNum(frame.pxPerStitch)}" data-hem-left="${fmtNum(frame.hemLeft)}" data-hem-right="${fmtNum(frame.hemRight)}" data-bust-left="${fmtNum(frame.left)}" data-bust-right="${fmtNum(frame.right)}" data-after-left="${fmtNum(frame.afterLeft)}" data-after-right="${fmtNum(frame.afterRight)}" data-bo-right="${fmtNum(frame.boRight)}" data-neck-left="${fmtNum(frame.neckLeft)}" data-neck-right="${fmtNum(frame.neckRight)}" data-bottom-y="${fmtNum(frame.bottomY)}" data-hem-y="${fmtNum(frame.hemY)}" data-armhole-start-y="${fmtNum(frame.armholeStartY)}" data-last-armhole-y="${fmtNum(frame.lastArmholeY)}" data-neck-start-y="${fmtNum(frame.neckStartY)}" data-shoulder-y="${fmtNum(frame.shoulderY)}" data-neck-corner-y="${fmtNum(frame.neckCornerY)}" data-shoulder-top-y="${fmtNum(frame.shoulderTopY)}" data-armhole-start-garment-rc="${fmtNum(armholeStart)}" data-neck-start-garment-rc="${fmtNum(neckStartGarmentRc)}" data-last-armhole-garment-rc="${fmtNum(model.armhole.lastGarmentRc)}" data-bind-off-sts="${fmtNum(model.armhole.bindOffStsEachSide)}" data-decrease-sts="${fmtNum(model.armhole.decreaseStsEachSide)}" data-neck-decrease-count="${fmtNum(neckPoints.length)}" data-shoulder-point-count="${fmtNum(model.shoulder.points.length)}" data-cast-on="${escapeXml(labels.castOn)}" data-armhole-bo="${escapeXml(labels.armholeBo)}" data-armhole-shaping="${escapeXml(labels.armholeShaping)}" data-neck-bo="${escapeXml(labels.neckBo)}" data-neck-shaping="${escapeXml(labels.neckShaping)}" data-shoulder-shaping="${escapeXml(labels.shoulderShaping)}" data-rc-neck-start="${escapeXml(labels.rcNeckStart)}" data-rc-armhole-bo="${escapeXml(labels.rcArmholeBo)}" data-rc-reset="${escapeXml(labels.rcReset)}" data-rc-shoulder-start="${escapeXml(labels.rcShoulderStart)}" data-timeline-source="frontNeckShoulderTimeline-full-width-v-right-edge" width="100%" height="auto" preserveAspectRatio="xMidYMid meet">`,
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
export const SLEEVELESS_FRONT_CARDIGAN_VNECK_RC_GUTTER_MIN_CLEARANCE = RC_GUTTER_MIN_CLEARANCE;
export const SLEEVELESS_FRONT_CARDIGAN_VNECK_ARMHOLE_LABEL_CLEARANCE = ARMHOLE_LABEL_CLEARANCE;
export const SLEEVELESS_FRONT_CARDIGAN_VNECK_SHOULDER_OUTLINE_CLEARANCE = SHOULDER_OUTLINE_CLEARANCE;
export const SLEEVELESS_FRONT_CARDIGAN_VNECK_V_EDGE_GAP = V_EDGE_GAP;

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
