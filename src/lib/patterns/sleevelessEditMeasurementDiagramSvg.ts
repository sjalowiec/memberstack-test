/**
 * Sleeveless Edit Pattern measurement diagram.
 *
 * Measurement-focused Front silhouette (not Stitches & Rows / Shaping Notation).
 * Reuses approved classification + Front garment-frame geometry. Does not invent
 * neckline or body-shape math.
 */

import { PATTERN_SUMMARY_MEASUREMENT_TARGETS } from "./patternSummaryMeasurementOverlay";
import {
  resolveEffectiveSleevelessBodyShapeKind,
  type SleevelessEffectiveBodyShapeKind,
} from "./sleevelessAlineShaping";
import { deriveSleevelessEditWorkspaceBodyShape } from "./sleevelessEditWorkspaceBodyShape";
import { isSleevelessVNeckChoice } from "./sleevelessFrontDiagramSrc";
import {
  SLEEVELESS_FRONT_GARMENT_VB_H,
  SLEEVELESS_FRONT_GARMENT_VB_W,
  buildSleevelessMeasurementGarmentFrame,
  sleevelessFrontBodySidePoints,
  sleevelessFrontGarmentFmtNum,
  sleevelessFrontPolylineD,
  sleevelessFrontPulloverRoundNecklineCubicD,
  sleevelessFrontPulloverRoundNecklineCurveD,
  sleevelessFrontPulloverVNecklinePoints,
  type SleevelessFrontGarmentFrame,
  type SleevelessMeasurementGarmentInput,
} from "./sleevelessFrontGarmentGeometry";

export const SLEEVELESS_EDIT_MEASUREMENT_VIEWBOX = {
  width: SLEEVELESS_FRONT_GARMENT_VB_W,
  height: SLEEVELESS_FRONT_GARMENT_VB_H,
} as const;

/** Stable chip anchors — same IDs the overlay already binds on pattern_summary.svg. */
export const SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS = [
  PATTERN_SUMMARY_MEASUREMENT_TARGETS.neckOpening,
  PATTERN_SUMMARY_MEASUREMENT_TARGETS.neckDepth,
  PATTERN_SUMMARY_MEASUREMENT_TARGETS.chest,
  PATTERN_SUMMARY_MEASUREMENT_TARGETS.bust,
  PATTERN_SUMMARY_MEASUREMENT_TARGETS.garmentLength,
  "target_garmemt_length",
  PATTERN_SUMMARY_MEASUREMENT_TARGETS.hip,
  PATTERN_SUMMARY_MEASUREMENT_TARGETS.armholeDepth,
  PATTERN_SUMMARY_MEASUREMENT_TARGETS.hem,
] as const;

const STROKE = "#1a1a1a";
const FILL = "#f4f6f1";
const GUIDE = "#bcbec0";

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function storedEditBodyShape(
  patternData: unknown,
): "straight" | "aline" {
  const style = section(section(patternData).style);
  const raw = String(style.bodyShape ?? "").trim().toLowerCase();
  return raw === "aline" ? "aline" : "straight";
}

/** Live radio / wizard token wins; otherwise {@link isSleevelessVNeckChoice}. */
export function resolveSleevelessEditMeasurementIsVNeck(
  patternData: unknown,
  liveNeckline?: string,
): boolean {
  if (liveNeckline && liveNeckline.trim()) {
    return isSleevelessVNeckChoice({ style: { neckline: liveNeckline } });
  }
  return isSleevelessVNeckChoice(patternData);
}

/**
 * Body silhouette from current bust/hip inches, using edit-workspace reclassify
 * plus {@link resolveEffectiveSleevelessBodyShapeKind} (same thresholds as generation).
 */
export function resolveSleevelessEditMeasurementBodyShapeKind(
  bustInches: number,
  hipInches: number,
  patternData?: unknown,
): SleevelessEffectiveBodyShapeKind {
  const persistable = deriveSleevelessEditWorkspaceBodyShape(
    { chestBust: String(bustInches), hip: String(hipInches) },
    storedEditBodyShape(patternData),
  );
  const style = section(section(patternData).style);
  return resolveEffectiveSleevelessBodyShapeKind(
    { style: { ...style, bodyShape: persistable } },
    bustInches,
    hipInches,
  );
}

export type SleevelessEditMeasurementDiagramInput = {
  measurements: SleevelessMeasurementGarmentInput;
  patternData?: unknown;
  liveNeckline?: string;
};

export type SleevelessEditMeasurementDiagramModel = {
  isVNeck: boolean;
  bodyShapeKind: SleevelessEffectiveBodyShapeKind;
  tapered: boolean;
  frame: SleevelessFrontGarmentFrame;
};

export function buildSleevelessEditMeasurementDiagramModel(
  input: SleevelessEditMeasurementDiagramInput,
): SleevelessEditMeasurementDiagramModel {
  const { measurements } = input;
  const isVNeck = resolveSleevelessEditMeasurementIsVNeck(input.patternData, input.liveNeckline);
  const bodyShapeKind = resolveSleevelessEditMeasurementBodyShapeKind(
    measurements.bustInches,
    measurements.hipInches,
    input.patternData,
  );
  const tapered = bodyShapeKind !== "straight";
  return {
    isVNeck,
    bodyShapeKind,
    tapered,
    frame: buildSleevelessMeasurementGarmentFrame(measurements),
  };
}

function neckOpeningPath(frame: SleevelessFrontGarmentFrame, isVNeck: boolean): string {
  const f = sleevelessFrontGarmentFmtNum;
  if (isVNeck) {
    return [
      `L ${f(frame.neckLeft)} ${f(frame.neckCornerY)}`,
      `L ${f(frame.cx)} ${f(frame.neckStartY)}`,
      `L ${f(frame.neckRight)} ${f(frame.neckCornerY)}`,
    ].join(" ");
  }
  return `L ${f(frame.neckLeft)} ${f(frame.neckCornerY)} ${sleevelessFrontPulloverRoundNecklineCubicD(frame)}`;
}

function drawSilhouette(model: SleevelessEditMeasurementDiagramModel): string {
  const { frame, isVNeck, tapered } = model;
  const f = sleevelessFrontGarmentFmtNum;
  const leftBody = sleevelessFrontBodySidePoints(frame, "left", tapered);
  const rightBody = sleevelessFrontBodySidePoints(frame, "right", tapered);
  const necklineD = isVNeck
    ? sleevelessFrontPolylineD(sleevelessFrontPulloverVNecklinePoints(frame))
    : sleevelessFrontPulloverRoundNecklineCurveD(frame);
  const upper = [
    `L ${f(frame.boLeft)} ${f(frame.armholeStartY)}`,
    `L ${f(frame.afterLeft)} ${f(frame.lastArmholeY)}`,
    `L ${f(frame.afterLeft)} ${f(frame.shoulderY)}`,
    neckOpeningPath(frame, isVNeck),
    `L ${f(frame.afterRight)} ${f(frame.shoulderY)}`,
    `L ${f(frame.afterRight)} ${f(frame.lastArmholeY)}`,
    `L ${f(frame.boRight)} ${f(frame.armholeStartY)}`,
  ];
  const silhouette = tapered
    ? [
        sleevelessFrontPolylineD(leftBody),
        ...upper,
        ...[...rightBody].reverse().map((p) => `L ${f(p.x)} ${f(p.y)}`),
        "Z",
      ].join(" ")
    : [
        `M ${f(frame.left)} ${f(frame.bottomY)}`,
        `L ${f(frame.left)} ${f(frame.armholeStartY)}`,
        ...upper,
        `L ${f(frame.right)} ${f(frame.armholeStartY)}`,
        `L ${f(frame.right)} ${f(frame.bottomY)}`,
        "Z",
      ].join(" ");

  return [
    `<path data-role="body-outline" d="${silhouette}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.6" stroke-linejoin="round"/>`,
    `<path data-role="neckline-outline" data-neckline="${isVNeck ? "v-neck" : "round"}" d="${necklineD}" fill="none" stroke="none"/>`,
  ].join("");
}

function drawGuides(frame: SleevelessFrontGarmentFrame): string {
  const f = sleevelessFrontGarmentFmtNum;
  const bustY = frame.armholeStartY + 8;
  const hipY = frame.hemY + (frame.bottomY - frame.hemY) * 0.35;
  const shoulderY = (frame.shoulderY + frame.neckCornerY) / 2;
  return [
    `<g data-role="measurement-guides" fill="none" stroke="${GUIDE}" stroke-width="0.8" stroke-dasharray="4 3">`,
    `<line data-role="line-neck-opening" x1="${f(frame.neckLeft)}" y1="${f(frame.neckCornerY)}" x2="${f(frame.neckRight)}" y2="${f(frame.neckCornerY)}"/>`,
    `<line data-role="line-neck-depth" x1="${f(frame.cx)}" y1="${f(frame.neckCornerY)}" x2="${f(frame.cx)}" y2="${f(frame.neckStartY)}"/>`,
    `<line data-role="line-shoulder" x1="${f(frame.afterLeft)}" y1="${f(shoulderY)}" x2="${f(frame.neckLeft)}" y2="${f(shoulderY)}"/>`,
    `<line data-role="line-armhole" x1="${f(frame.left - 8)}" y1="${f(frame.shoulderTopY)}" x2="${f(frame.left - 8)}" y2="${f(frame.armholeStartY)}"/>`,
    `<line data-role="line-bust" x1="${f(frame.left)}" y1="${f(bustY)}" x2="${f(frame.right)}" y2="${f(bustY)}"/>`,
    `<line data-role="line-hip" x1="${f(frame.hemLeft)}" y1="${f(hipY)}" x2="${f(frame.hemRight)}" y2="${f(hipY)}"/>`,
    `<line data-role="line-garment-length" x1="${f(frame.right + 14)}" y1="${f(frame.shoulderTopY)}" x2="${f(frame.right + 14)}" y2="${f(frame.bottomY)}"/>`,
    `<line data-role="line-hem" x1="${f(frame.left - 8)}" y1="${f(frame.hemY)}" x2="${f(frame.left - 8)}" y2="${f(frame.bottomY)}"/>`,
    `</g>`,
  ].join("");
}

function targetCircle(id: string, x: number, y: number): string {
  const f = sleevelessFrontGarmentFmtNum;
  return `<circle id="${id}" cx="${f(x)}" cy="${f(y)}" r="2.5" fill="none"/>`;
}

function drawTargets(frame: SleevelessFrontGarmentFrame): string {
  const bustY = frame.armholeStartY + 8;
  const hipY = frame.hemY + (frame.bottomY - frame.hemY) * 0.35;
  const shoulderY = (frame.shoulderY + frame.neckCornerY) / 2;
  const neckDepthX = Math.min(frame.cx + 22, frame.neckRight + 8);
  const neckDepthY = (frame.neckCornerY + frame.neckStartY) / 2;
  return [
    `<g data-role="measurement-targets">`,
    targetCircle(PATTERN_SUMMARY_MEASUREMENT_TARGETS.neckOpening, frame.cx, frame.neckCornerY - 10),
    targetCircle(PATTERN_SUMMARY_MEASUREMENT_TARGETS.neckDepth, neckDepthX, neckDepthY),
    targetCircle(PATTERN_SUMMARY_MEASUREMENT_TARGETS.chest, (frame.afterLeft + frame.neckLeft) / 2, shoulderY),
    targetCircle(PATTERN_SUMMARY_MEASUREMENT_TARGETS.bust, frame.cx + 10, bustY),
    targetCircle(PATTERN_SUMMARY_MEASUREMENT_TARGETS.hip, frame.cx + 12, hipY),
    targetCircle(PATTERN_SUMMARY_MEASUREMENT_TARGETS.armholeDepth, frame.left - 8, (frame.shoulderTopY + frame.armholeStartY) / 2),
    targetCircle(PATTERN_SUMMARY_MEASUREMENT_TARGETS.hem, frame.left - 8, (frame.hemY + frame.bottomY) / 2),
    targetCircle(PATTERN_SUMMARY_MEASUREMENT_TARGETS.garmentLength, frame.right + 14, (frame.shoulderTopY + frame.bottomY) / 2),
    targetCircle("target_garmemt_length", frame.right + 14, (frame.shoulderTopY + frame.bottomY) / 2),
    `</g>`,
  ].join("");
}

export function buildSleevelessEditMeasurementDiagramSvg(
  input: SleevelessEditMeasurementDiagramInput,
): string {
  const model = buildSleevelessEditMeasurementDiagramModel(input);
  const { width, height } = SLEEVELESS_EDIT_MEASUREMENT_VIEWBOX;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Sleeveless sweater body measurement diagram" focusable="false" class="express-mbp-art" data-sleeveless-edit-diagram="true" data-sleeveless-edit-neckline="${model.isVNeck ? "v-neck" : "round"}" data-sleeveless-edit-body-shape="${model.bodyShapeKind}">`,
    drawSilhouette(model),
    drawGuides(model.frame),
    drawTargets(model.frame),
    `</svg>`,
  ].join("");
}
