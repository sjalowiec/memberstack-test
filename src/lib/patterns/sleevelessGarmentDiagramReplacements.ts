/**
 * Shared `{{TOKEN}}` replacement maps for sleeveless garment SVG diagrams (screen + print).
 */

import type { CardiganFrontSplit } from "./cardiganFrontBlock";
import {
  cardiganHalfFrontBodySts,
  splitBodyBackCastOnToSymmetricCardiganHalves,
} from "./cardiganFrontBlock";
import { calculateHemRows, getDefaultHemLengthInches } from "./hemDefaults";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function fmtNumber(n: number): string {
  if (!isFiniteNumber(n)) return "";
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 1e-9) return String(rounded);
  const one = Math.round(n * 10) / 10;
  return String(one).replace(/\.0$/, "");
}

function inchesToUnit(inches: number | undefined, unit: "cm" | "in"): number | undefined {
  if (!isFiniteNumber(inches)) return undefined;
  if (unit === "cm") return inches * 2.54;
  return inches;
}

function toPositiveNumber(value: unknown): number | undefined {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/[^\d.-]/g, ""))
        : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function selectedMeasurementsFromPatternData(patternData: Record<string, unknown>): Record<string, unknown> {
  const fit = section(patternData?.fit);
  return section(fit.selectedMeasurements);
}

/** Same audience resolution as {@link generateSleevelessBackPattern} / `pickAudience`. */
function pickAudienceFromPatternData(patternData: Record<string, unknown>): string | undefined {
  const fit = section(patternData.fit);
  const style = section(patternData.style);
  const chart = fit.sizingChart ?? fit.knitFor;
  if (typeof chart === "string" && chart.trim()) return chart.trim();
  const cat = style.recipientCategory;
  if (typeof cat === "string" && cat.trim()) return cat.trim();
  return undefined;
}

/** Hem band rows + depth for `{{HEM_ROWS}}` / `{{HEM_INCHES}}` diagram labels. */
function resolveHemFieldsForSleevelessDiagram(
  d: SleevelessBackPatternResult["debug"],
  patternData: Record<string, unknown>,
  unit: "cm" | "in",
): { HEM_ROWS: string; HEM_INCHES: string } {
  const audience = pickAudienceFromPatternData(patternData);
  const hemRows = isFiniteNumber(d.hemRows)
    ? Math.round(d.hemRows)
    : calculateHemRows(d.rowsPerInch ?? NaN, audience);
  const hemDepthIn = getDefaultHemLengthInches(audience);
  return {
    HEM_ROWS: isFiniteNumber(hemRows) ? String(Math.max(0, hemRows)) : "",
    HEM_INCHES: fmtNumber(inchesToUnit(hemDepthIn, unit) ?? Number.NaN),
  };
}

/** Neck depth labels for diagram overlays — matches legacy sleeveless behavior for back/front/shared. */
export function resolveNeckDepthFieldsForSleevelessDiagram(
  result: SleevelessBackPatternResult,
  patternData: Record<string, unknown>,
  piece: "back" | "front" | "shared",
  unit: "cm" | "in",
): { NECK_DEPTH_ROWS: string; NECK_DEPTH: string } {
  const d = result?.debug ?? {};
  const sm = selectedMeasurementsFromPatternData(patternData);
  const rpi = d.rowsPerInch;

  const backDepthIn = toPositiveNumber(sm.back_neck_depth);
  const frontDepthIn = toPositiveNumber(sm.front_neck_depth);

  let pieceDepthIn: number | undefined;
  if (piece === "back") pieceDepthIn = backDepthIn;
  else if (piece === "front") pieceDepthIn = frontDepthIn;

  const depthInches = isFiniteNumber(pieceDepthIn) ? pieceDepthIn : d.reservedNecklineShoulderInches;
  const depthRows =
    isFiniteNumber(pieceDepthIn) && isFiniteNumber(rpi) && rpi > 0
      ? Math.max(0, Math.round(pieceDepthIn * rpi))
      : d.reservedNecklineShoulderRows;

  return {
    NECK_DEPTH_ROWS: isFiniteNumber(depthRows) ? String(Math.round(depthRows)) : "",
    NECK_DEPTH: fmtNumber(inchesToUnit(depthInches, unit) ?? Number.NaN),
  };
}

export type SleevelessDiagramReplacementPiece = "back" | "front" | "shared";

function halfStitchesRounded(value: number | undefined): number | undefined {
  if (!isFiniteNumber(value)) return undefined;
  return Math.round(value / 2);
}

function applyCardiganHalfFrontMeasurements(
  repl: Record<string, string>,
  d: SleevelessBackPatternResult["debug"],
  split: CardiganFrontSplit,
  side: "left" | "right",
  finishedBust: number | undefined,
  unit: "cm" | "in",
): void {
  const bustSts = cardiganHalfFrontBodySts(split, side);
  repl.BUST_STS = String(bustSts);

  const bustWidthIn = finishedBust !== undefined ? finishedBust / 4 : undefined;
  repl.BUST_WIDTH = fmtNumber(inchesToUnit(bustWidthIn, unit) ?? NaN);

  // RULE 5: shoulder seam matches back / pullover front — not halved for half-body schematic.
  repl.SHOULDER_STS = isFiniteNumber(d.stitchesAfterArmhole)
    ? String(Math.round(d.stitchesAfterArmhole))
    : "";
  repl.SHOULDER_WIDTH = fmtNumber(inchesToUnit(d.shoulderWidthInches, unit) ?? NaN);

  // Half-front diagram: neckline at CF is split — show half the neck stitches / width on this piece.
  repl.NECK_STS =
    halfStitchesRounded(d.necklineStitches) !== undefined
      ? String(halfStitchesRounded(d.necklineStitches)!)
      : "";
  repl.NECK_WIDTH = fmtNumber(
    inchesToUnit(isFiniteNumber(d.necklineWidthInches) ? d.necklineWidthInches / 2 : undefined, unit) ?? NaN,
  );

  repl.OPENING_STS = String(split.frontOpeningWidthSts);
  repl.PIECE_TITLE = side === "left" ? "LEFT FRONT" : "RIGHT FRONT";
  /** Reserved token for future CF annotations; empty until bands/overlap UI exists. */
  repl.CF_EDGE_NOTE = "";
}

export type BuildSleevelessGarmentDiagramReplacementsOptions = {
  patternData: Record<string, unknown>;
  /** Which neckline depth row applies (matches diagram URL inference). */
  measurementPiece: SleevelessDiagramReplacementPiece;
  /**
   * One cardigan half — cast-on / bust width tokens use half **body/back** width; shoulder and
   * row/armhole tokens stay aligned with back / pullover front (RULE 3–5).
   */
  cardiganHalfSide?: "left" | "right";
};

export function buildSleevelessGarmentDiagramReplacements(
  result: SleevelessBackPatternResult,
  unit: "cm" | "in",
  options: BuildSleevelessGarmentDiagramReplacementsOptions,
): Record<string, string> {
  const d = result?.debug ?? {};
  const neckDepth = resolveNeckDepthFieldsForSleevelessDiagram(
    result,
    options.patternData,
    options.measurementPiece,
    unit,
  );
  const hemFields = resolveHemFieldsForSleevelessDiagram(d, options.patternData, unit);

  const finishedBust = isFiniteNumber(d.finishedBustChest) ? d.finishedBustChest : undefined;
  const bustWidthIn = finishedBust !== undefined ? finishedBust / 2 : undefined;

  const unitLabel = unit === "cm" ? "cm" : "in";

  const SIDE_LENGTH = (() => {
    const rpi = d.rowsPerInch;
    if (!isFiniteNumber(rpi) || rpi <= 0) return "";
    if (!isFiniteNumber(d.hemRows) || !isFiniteNumber(d.bodyRows)) return "";
    const sideRows = Math.max(0, Math.round(d.hemRows + d.bodyRows));
    const inches = sideRows / rpi;
    return fmtNumber(inchesToUnit(inches, unit) ?? NaN);
  })();

  const repl: Record<string, string> = {
    UNIT: unitLabel,
    HEIGHT: fmtNumber(inchesToUnit(d.backNeckToHem, unit) ?? NaN),
    ARMHOLE_DEPTH: fmtNumber(inchesToUnit(d.armholeDepth, unit) ?? NaN),
    ARMHOLE_ROWS: isFiniteNumber(d.armholeRows) ? String(Math.round(d.armholeRows)) : "",
    BUST_STS: isFiniteNumber(d.backStitches) ? String(Math.round(d.backStitches)) : "",
    BUST_WIDTH: fmtNumber(inchesToUnit(bustWidthIn, unit) ?? NaN),
    SHOULDER_STS: isFiniteNumber(d.stitchesAfterArmhole) ? String(Math.round(d.stitchesAfterArmhole)) : "",
    SHOULDER_WIDTH: fmtNumber(inchesToUnit(d.shoulderWidthInches, unit) ?? NaN),
    NECK_STS: isFiniteNumber(d.necklineStitches) ? String(Math.round(d.necklineStitches)) : "",
    NECK_WIDTH: fmtNumber(inchesToUnit(d.necklineWidthInches, unit) ?? NaN),
    NECK_DEPTH_ROWS: neckDepth.NECK_DEPTH_ROWS,
    NECK_DEPTH: neckDepth.NECK_DEPTH,
    SIDE_LENGTH_ROWS:
      isFiniteNumber(d.hemRows) && isFiniteNumber(d.bodyRows)
        ? String(Math.max(0, Math.round(d.hemRows + d.bodyRows)))
        : "",
    SIDE_LENGTH,
    HEM_ROWS: hemFields.HEM_ROWS,
    HEM_INCHES: hemFields.HEM_INCHES,
    OPENING_STS: "",
    PIECE_TITLE: "",
    CF_EDGE_NOTE: "",
  };

  if (options.cardiganHalfSide === "left" || options.cardiganHalfSide === "right") {
    const split = splitBodyBackCastOnToSymmetricCardiganHalves(d.backStitches ?? 0);
    applyCardiganHalfFrontMeasurements(repl, d, split, options.cardiganHalfSide, finishedBust, unit);
    if (options.cardiganHalfSide === "left" && isFiniteNumber(d.cardiganHalfLeftCastOnSts)) {
      repl.BUST_STS = String(Math.round(d.cardiganHalfLeftCastOnSts));
    }
  }

  return repl;
}
