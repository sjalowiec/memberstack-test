/**
 * Programmatic Shaping Notation SVG for Sleeveless Back.
 *
 * Garment geometry is the shared approved Back Stitches & Rows silhouette.
 * Japanese notation is an annotation layer on that garment — not a second
 * drawing model.
 */

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
import {
  buildSleevelessBackGarmentFrame,
  sleevelessBackArmholePoints,
  sleevelessBackBodySidePoints,
  sleevelessBackPolylineD,
  sleevelessBackRoundNecklineCurveD,
  sleevelessBackShoulderSegment,
  sleevelessBackSilhouettePathD,
  sleevelessBackYAtRc,
  SLEEVELESS_BACK_GARMENT_VB_H,
  SLEEVELESS_BACK_GARMENT_VB_W,
  usesSleevelessBackAlineBodySilhouette,
  type SleevelessBackGarmentFrame,
  type SleevelessBackGarmentYBand,
} from "./sleevelessBackGarmentGeometry";
import { buildSleevelessBackStsRowsDiagramModel } from "./sleevelessBackStsRowsDiagramModel";
import { shoulderStitchesPerSideForDiagram } from "./sleevelessGarmentDiagramReplacements";
import {
  compressStitchDecreasePointsToNotationLines,
  type StitchDecreasePoint,
} from "./shapingNotationCompress";
import { collectCompleteShoulderShapingPoints } from "./shoulderShapingNotation";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";

const VB_W = SLEEVELESS_BACK_GARMENT_VB_W;
const VB_H = SLEEVELESS_BACK_GARMENT_VB_H;

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
const BODY_NOTATION_GAP = 18;
const BODY_LABEL_OUTLINE_CLEARANCE = 18;
const RC_RESET_GAP = Math.round(FS_RC * 1.75);
const SHOULDER_LABEL_GAP = 14;
const SHOULDER_OUTLINE_CLEARANCE = 10;

const ARMHOLE_LABEL_START_X = 320;
const ARMHOLE_LABEL_SAFE_MAX_X = VB_W - 16;

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

type BodyShapingDirection = "inward" | "outward" | "straight";

type NotationFrame = SleevelessBackGarmentFrame & {
  neckCenterLeft: number;
  neckCenterRight: number;
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

function rightBodyOutlineXAtY(frame: NotationFrame, y: number): number {
  if (frame.bodyDirection === "straight") return frame.right;
  if (y >= frame.bodyShapeStartY - 0.01) return frame.hemRight;
  if (y <= frame.bodyShapeEndY + 0.01) return frame.right;
  const span = frame.bodyShapeStartY - frame.bodyShapeEndY;
  if (!(span > 0)) return frame.right;
  const t = clamp((frame.bodyShapeStartY - y) / span, 0, 1);
  return frame.hemRight + t * (frame.right - frame.hemRight);
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

function buildFrame(
  result: SleevelessBackPatternResult,
  patternData: unknown,
): {
  frame: NotationFrame;
  bands: SleevelessBackGarmentYBand[];
  neckStartGarmentRc: number;
  lastArmholeGarmentRc: number;
  bindOffSts: number;
  decreaseSts: number;
  armholeStart: number;
  model: NonNullable<ReturnType<typeof buildSleevelessBackStsRowsDiagramModel>>;
} | null {
  const model = buildSleevelessBackStsRowsDiagramModel(result, patternData, {
    requireSupportedBodyShape: false,
  });
  if (!model) return null;
  const { frame: garment, bands } = buildSleevelessBackGarmentFrame(model);
  const armholeStart = model.armhole.startGarmentRc;
  const lastArmholeGarmentRc = garment.lastDecreaseRc;
  const neckStartGarmentRc = model.neckline.startGarmentRc;
  const bindOffSts = model.armhole.bindOffStsEachSide;
  const decreaseSts = model.armhole.decreaseStsEachSide;
  const centerHalf = (model.neckline.centerBindOffStitches * garment.pxPerStitch) / 2;
  const frame: NotationFrame = {
    ...garment,
    neckCenterLeft: garment.cx - centerHalf,
    neckCenterRight: garment.cx + centerHalf,
    bodyStartStitches: model.bodyShaping.hemStitches,
    bodyEndStitches: model.bodyShaping.bustStitches,
    bodyDirection: model.bodyShaping.direction,
    bodyShapeStartRc: model.bodyShaping.startRc,
    bodyShapeEndRc: model.bodyShaping.endRc,
    bodyShapeStartY: garment.shapeStartY,
    bodyShapeEndY: garment.shapeEndY,
    bodyShapeRows: model.bodyShaping.rowNumbers,
    neckWidthStitches: model.widths.necklineStitches,
    centerNeckStitches: model.neckline.centerBindOffStitches,
    backNeckDepthRows: model.rows.backNeckDepthRows,
    armholeRows: model.rows.armholeRows,
    pixelsPerStitch: garment.pxPerStitch,
  };
  return {
    frame,
    bands,
    neckStartGarmentRc,
    lastArmholeGarmentRc,
    bindOffSts,
    decreaseSts,
    armholeStart,
    model,
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

function drawSilhouette(frame: NotationFrame, tapered: boolean): string {
  const leftBody = sleevelessBackBodySidePoints(frame, "left", tapered);
  const rightBody = sleevelessBackBodySidePoints(frame, "right", tapered);
  const leftShoulder = sleevelessBackShoulderSegment(frame, "left");
  const rightShoulder = sleevelessBackShoulderSegment(frame, "right");
  const leftArmhole = sleevelessBackArmholePoints(frame, "left");
  const rightArmhole = sleevelessBackArmholePoints(frame, "right");
  const neckD = sleevelessBackRoundNecklineCurveD(frame);
  return [
    `<path class="sleeveless-back-notation__body" data-role="body-outline" d="${sleevelessBackSilhouettePathD(frame, tapered)}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    `<path data-role="left-body-path" data-body-shaping-direction="${frame.bodyDirection}" d="${sleevelessBackPolylineD(leftBody)}" fill="none" stroke="none"/>`,
    `<path data-role="right-body-path" data-body-shaping-direction="${frame.bodyDirection}" d="${sleevelessBackPolylineD(rightBody)}" fill="none" stroke="none"/>`,
    `<path data-role="left-armhole-path" data-armhole-read-order="bottom-up" d="${sleevelessBackPolylineD(leftArmhole)}" fill="none" stroke="none"/>`,
    `<path data-role="right-armhole-path" data-armhole-read-order="bottom-up" d="${sleevelessBackPolylineD(rightArmhole)}" fill="none" stroke="none"/>`,
    `<path data-role="left-shoulder-path" d="${sleevelessBackPolylineD(leftShoulder)}" fill="none" stroke="none"/>`,
    `<path data-role="right-shoulder-path" d="${sleevelessBackPolylineD(rightShoulder)}" fill="none" stroke="none"/>`,
    `<path data-role="back-neck-path" data-neck-width-stitches="${fmtNum(frame.neckWidthStitches)}" data-center-neck-stitches="${fmtNum(frame.centerNeckStitches)}" data-neck-depth-rows="${fmtNum(frame.backNeckDepthRows)}" data-neck-depth-y="${fmtNum(frame.neckStartY)}" data-neck-left-x="${fmtNum(frame.neckLeft)}" data-neck-right-x="${fmtNum(frame.neckRight)}" data-neck-center-left-x="${fmtNum(frame.neckCenterLeft)}" data-neck-center-right-x="${fmtNum(frame.neckCenterRight)}" data-neck-control-left-x="${fmtNum(frame.neckLeft)}" data-neck-control-right-x="${fmtNum(frame.neckRight)}" d="${neckD}" fill="none" stroke="none"/>`,
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
function unsupportedBackNotationSvg(): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="sleeveless-back-notation-svg" viewBox="0 0 ${VB_W} ${VB_H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" data-sleeveless-back-generated-notation="true" data-supported="false">`,
    `<title>Sleeveless Back shaping notation unavailable</title>`,
    `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#fff"/>`,
    `</svg>`,
  ].join("");
}

export function buildSleevelessBackShapingNotationDiagramSvg(
  result: SleevelessBackPatternResult,
  patternData?: unknown,
): string {
  const supported = isBackJapaneseNotationSupported(patternData, result);
  if (!supported) return unsupportedBackNotationSvg();

  const built = buildFrame(result, patternData);
  if (!built) return unsupportedBackNotationSvg();

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
    model,
  } = built;
  const tapered =
    usesSleevelessBackAlineBodySilhouette(model) || frame.bodyDirection !== "straight";
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
  const neckRcY = frame.neckStartY + neckStartOffset;
  const shoulderRcY = frame.shoulderY;
  /**
   * Neck start and shoulder start are consecutive garment rows on a shallow Back.
   * The visual neck remap also parks the scoop next to the shoulder line, so both
   * RC labels land on one top guide. Keep the earlier neckline-start RC.
   */
  const shareTopRcGuide = Math.abs(neckRcY - shoulderRcY) < FS_RC;
  parts.push(
    rcText(
      gutterX,
      neckRcY,
      labels.rcNeckStart,
      "neck-start-rc",
      ` data-rc="${escapeXml(labels.rcNeckStart)}" data-garment-rc="${fmtNum(neckStartGarmentRc)}"`,
    ),
  );
  if (labels.rcShoulderStart && !shareTopRcGuide) {
    parts.push(
      rcText(
        gutterX,
        shoulderRcY,
        labels.rcShoulderStart,
        "shoulder-start-rc",
        ` data-rc="${escapeXml(labels.rcShoulderStart)}"`,
      ),
    );
  }

  if (bindOffSts > 0) {
    parts.push(eventHook("armhole-event", 0, armholeStart, frame.armholeStartY));
  }
  for (const ev of decreaseEvents) {
    parts.push(eventHook("armhole-event", ev.localRc, ev.garmentRc, sleevelessBackYAtRc(ev.garmentRc, bands)));
  }
  parts.push(
    eventHook("neck-start", neckStartDisplayRc, neckStartGarmentRc, frame.neckStartY),
  );
  for (const pt of neckPointsTimeline) {
    const displayRc = displayRcAfterArmholeReset(pt.row, armholeStart);
    parts.push(eventHook("neck-event", displayRc, pt.row, sleevelessBackYAtRc(pt.row, bands)));
  }
  for (const row of frame.bodyShapeRows) {
    parts.push(
      `<g data-role="body-event" data-rc="${escapeXml(formatRcNotation(row))}" data-garment-rc="${fmtNum(row)}" data-y="${fmtNum(sleevelessBackYAtRc(row, bands))}" data-body-shaping-direction="${frame.bodyDirection}"></g>`,
    );
  }
  for (const pt of shoulderPasses) {
    const displayRc = displayRcAfterArmholeReset(pt.row, armholeStart);
    parts.push(eventHook("shoulder-event", displayRc, pt.row, sleevelessBackYAtRc(pt.row, bands)));
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

  /**
   * Neck JP lines are chronological (center HOLD/BO first, then decrease groups
   * in working order). SVG Y increases downward, so the first knitting action
   * must sit at the largest Y and later decreases stack above it.
   */
  const neckShapingLines = labels.neckShaping.split("\n").filter(Boolean);
  const neckLabelX = frame.cx;
  const neckHighestY = Math.min(VB_H - 24, frame.neckStartY + 22);
  const neckHoldOffset = labels.neckBo ? 1 : 0;
  const neckBoY =
    neckHighestY + Math.max(0, neckShapingLines.length + neckHoldOffset - 1) * NECK_NOTATION_GAP;
  parts.push(
    `<g data-role="neck-label-zone" data-x="${fmtNum(neckLabelX)}" data-y="${fmtNum(neckHighestY)}" data-bo-y="${fmtNum(neckBoY)}" data-neck-label-clearance="20" data-neck-working-order="bottom-up"></g>`,
  );
  for (const [i, line] of neckShapingLines.entries()) {
    const y = neckBoY - (i + neckHoldOffset) * NECK_NOTATION_GAP;
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
    `<svg xmlns="http://www.w3.org/2000/svg" class="sleeveless-back-notation-svg" viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-labelledby="sleeveless-back-notation-title" data-sleeveless-back-generated-notation="true" data-supported="true" data-reset="${labels.rcReset ? "true" : "false"}" data-neck-start-display-rc="${fmtNum(neckStartDisplayRc)}" data-neck-start-garment-rc="${fmtNum(neckStartGarmentRc)}" data-armhole-start-garment-rc="${fmtNum(armholeStart)}" data-last-armhole-garment-rc="${fmtNum(lastArmholeGarmentRc)}" data-shoulder-start-display-rc="${fmtNum(finiteOr(shoulderStartDisplayRc, -1))}" data-neck-start-y="${fmtNum(frame.neckStartY)}" data-armhole-start-y="${fmtNum(frame.armholeStartY)}" data-last-armhole-y="${fmtNum(frame.lastArmholeY)}" data-armhole-read-order="bottom-up" data-shoulder-y="${fmtNum(frame.shoulderY)}" data-shoulder-top-y="${fmtNum(frame.shoulderTopY)}" data-neck-corner-y="${fmtNum(frame.neckCornerY)}" data-neck-center-left="${fmtNum(frame.neckCenterLeft)}" data-neck-center-right="${fmtNum(frame.neckCenterRight)}" data-neck-left="${fmtNum(frame.neckLeft)}" data-neck-right="${fmtNum(frame.neckRight)}" data-bo-left="${fmtNum(frame.boLeft)}" data-bo-right="${fmtNum(frame.boRight)}" data-after-left="${fmtNum(frame.afterLeft)}" data-after-right="${fmtNum(frame.afterRight)}" data-pixels-per-stitch="${fmtNum(frame.pixelsPerStitch)}" data-armhole-rows="${fmtNum(frame.armholeRows)}" data-neck-width-stitches="${fmtNum(frame.neckWidthStitches)}" data-center-neck-stitches="${fmtNum(frame.centerNeckStitches)}" data-neck-depth-rows="${fmtNum(frame.backNeckDepthRows)}" data-neck-contour="scoop" data-shoulder-contour="slope" data-shoulder-pass-count="${shoulderPasses.length}" data-shoulder-shaping-stitches="${fmtNum(shoulderSts)}" data-body-width="${fmtNum(frame.bodyWidth)}" data-bust-width="${fmtNum(frame.bodyWidth)}" data-after-armhole-width="${fmtNum(frame.afterWidth)}" data-true-after-width="${fmtNum(frame.trueAfterWidth)}" data-neck-width="${fmtNum(frame.neckWidth)}" data-shoulder-side-width="${fmtNum(frame.shoulderSideWidth)}" data-visual-neck-h="${fmtNum(frame.visualNeckH)}" data-visual-armhole-h="${fmtNum(frame.visualArmholeH)}" data-last-decrease-rc="${fmtNum(frame.lastDecreaseRc)}" data-px-per-stitch="${fmtNum(frame.pxPerStitch)}" data-body-start-stitches="${fmtNum(frame.bodyStartStitches)}" data-body-end-stitches="${fmtNum(frame.bodyEndStitches)}" data-body-shaping-direction="${frame.bodyDirection}" data-body-shaping-start-rc="${fmtNum(frame.bodyShapeStartRc)}" data-body-shaping-end-rc="${fmtNum(frame.bodyShapeEndRc)}" data-body-shaping-start-y="${fmtNum(frame.bodyShapeStartY)}" data-body-shaping-end-y="${fmtNum(frame.bodyShapeEndY)}" data-hem-left="${fmtNum(frame.hemLeft)}" data-hem-right="${fmtNum(frame.hemRight)}" data-bust-left="${fmtNum(frame.left)}" data-bust-right="${fmtNum(frame.right)}" data-body-shaping="${escapeXml(frame.bodyDirection === "straight" ? "" : labels.bodyShaping)}" data-body-label-x="${fmtNum(bodyLabelX)}" data-body-outline-x-at-label="${fmtNum(bodyOutlineX)}" data-body-label-clearance="${BODY_LABEL_OUTLINE_CLEARANCE}" data-right-label-safe-max-x="${ARMHOLE_LABEL_SAFE_MAX_X}" data-neck-label-x="${fmtNum(neckLabelX)}" data-neck-label-y="${fmtNum(neckHighestY)}" data-neck-bo-y="${fmtNum(neckBoY)}" data-neck-working-order="bottom-up" data-shared-top-rc-guide="${shareTopRcGuide ? "true" : "false"}" data-kept-top-rc="${shareTopRcGuide ? "neck-start" : "both"}" data-cast-on="${escapeXml(labels.castOn)}" data-armhole-bo="${escapeXml(labels.armholeBo)}" data-armhole-shaping="${escapeXml(labels.armholeShaping)}" data-neck-bo="${escapeXml(labels.neckBo)}" data-neck-shaping="${escapeXml(labels.neckShaping)}" data-shoulder-shaping="${escapeXml(labels.shoulderShaping)}" data-rc-neck-start="${escapeXml(labels.rcNeckStart)}" data-rc-armhole-bo="${escapeXml(labels.rcArmholeBo)}" data-rc-reset="${escapeXml(labels.rcReset)}" data-rc-shoulder-start="${escapeXml(labels.rcShoulderStart)}" data-bind-off-sts="${fmtNum(bindOffSts)}" data-decrease-sts="${fmtNum(decreaseSts)}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet">`,
    `<title id="sleeveless-back-notation-title">Sleeveless Back shaping notation</title>`,
    `<desc>${escapeXml(desc)}</desc>`,
    `<style type="text/css"><![CDATA[text{font-family:${FONT}}]]></style>`,
    `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#fff"/>`,
    safeBody,
    `</svg>`,
  ].join("");
}

export const SLEEVELESS_BACK_NOTATION_VIEWBOX = { width: VB_W, height: VB_H } as const;
export const SLEEVELESS_BACK_NOTATION_FS_NOTATION = FS_NOTATION;
export const SLEEVELESS_BACK_NOTATION_FS_RC = FS_RC;
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
