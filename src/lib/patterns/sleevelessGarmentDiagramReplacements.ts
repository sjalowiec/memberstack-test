/**
 * Shared `{{TOKEN}}` replacement maps for sleeveless garment SVG diagrams (screen + print).
 */

import {
  resolveCardiganHalfFrontWidths,
  type CardiganHalfFrontWidths,
} from "./cardiganFrontBlock";
import {
  resolveDiagramFinishedHipInches,
  resolveEffectiveFinishedHipInches,
} from "./customBuildEffectiveFinishedHip";
import { resolveEffectiveHemDepthInches } from "./customBuildEffectiveHemDepth";
import { calculateHemRowsFromInches } from "./hemDefaults";
import { lengthFromRowsForDiagram, resolveTotalInstructionRows } from "./sleevelessRowAccounting";
import {
  resolveEffectiveBackNeckDepthInches,
  resolveEffectiveFrontNeckDepthInches,
} from "./customBuildEffectiveNeckDepth";
import { isSleevelessCardiganGarmentStyle } from "./sleevelessFrontDiagramSrc";
import {
  dropShoulderSleeveShapingPlan,
  formatDropShoulderSleeveShapingNotation,
} from "./dropShoulderSleeveShaping";
import type { DropShoulderSleeveDirection } from "./dropShoulderSleeveConstruction";
import {
  formatBodyRowsNotation,
  formatCastOnNotation,
} from "./sleevelessBackJapaneseNotation";
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

/**
 * Per-side shoulder stitch budget used by shoulder-shaping validation.
 *
 * NOTE: This is NOT the cross-back schematic label — that dimension line shows the full
 * post-armhole body width (see {@link crossBackWidthForDiagram}). This per-side value is the
 * shoulder bind-off target consumed by shoulder shaping notation/validation.
 */
export function shoulderStitchesPerSideForDiagram(
  d: SleevelessBackPatternResult["debug"],
): number | undefined {
  if (isFiniteNumber(d.shoulderStitches) && d.shoulderStitches > 0) {
    return Math.round(d.shoulderStitches);
  }
  if (
    isFiniteNumber(d.stitchesAfterArmhole) &&
    isFiniteNumber(d.necklineStitches) &&
    d.stitchesAfterArmhole > d.necklineStitches
  ) {
    return Math.max(1, Math.floor((d.stitchesAfterArmhole - d.necklineStitches) / 2));
  }
  return undefined;
}

/**
 * Horizontal dimension label whose stitch count and inch value are derived from the *same* stitch
 * count, so the two never disagree (e.g. 76 sts → 76 / spi in, not the raw measurement input).
 *
 * Used for dimension lines where the knitted stitch count is the source of truth and the inch value
 * is just its gauge conversion — the cross-back width above the armhole and the neck opening.
 */
function stitchWidthLabel(
  stitches: number | undefined,
  stitchesPerInch: number | undefined,
  unit: "cm" | "in",
): { sts: number | undefined; widthLabel: string } {
  const sts =
    isFiniteNumber(stitches) && stitches > 0 ? Math.round(stitches) : undefined;
  const inches =
    sts !== undefined && isFiniteNumber(stitchesPerInch) && stitchesPerInch > 0
      ? sts / stitchesPerInch
      : undefined;
  return {
    sts,
    widthLabel: fmtNumber(inchesToUnit(inches, unit) ?? Number.NaN),
  };
}

/**
 * Cross-back (cross-shoulder) dimension line that sits above the armhole on the FRONT/BACK schematics.
 *
 * This is the body width *remaining after armhole shaping is complete* (`stitchesAfterArmhole`),
 * i.e. the same source-of-truth value the written armhole instructions decrease down to — not a
 * per-side shoulder count.
 */
function crossBackWidthForDiagram(
  stitchesAfterArmhole: number | undefined,
  stitchesPerInch: number | undefined,
  unit: "cm" | "in",
): { sts: number | undefined; widthLabel: string } {
  return stitchWidthLabel(stitchesAfterArmhole, stitchesPerInch, unit);
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

/** Hip labels for `{{HIP_STS}}`, `{{HIP_ROWS}}`, and `{{HIP_INCHES}}` on garment schematics. */
function resolveHipFieldsForSleevelessDiagram(
  d: SleevelessBackPatternResult["debug"],
  patternData: Record<string, unknown>,
  unit: "cm" | "in",
): { HIP_STS: string; HIP_ROWS: string; HIP_INCHES: string } {
  const finishedBust = isFiniteNumber(d.finishedBustChest) ? d.finishedBustChest : undefined;
  const finishedHip = resolveDiagramFinishedHipInches(patternData, finishedBust);
  // Explicit, stored hip (undefined when only the bust default would apply) so the hip stitch count
  // tracks the hip — not the bust cast-on — whenever a real hip measurement is present.
  const explicitHip = resolveEffectiveFinishedHipInches(patternData);
  const spi = d.stitchesPerInch;

  let hipSts: number | undefined;
  if (isFiniteNumber(d.hemCastOnStitches) && d.hemCastOnStitches > 0) {
    // Generated patterns always provide this and it already reflects any hip shaping.
    hipSts = Math.round(d.hemCastOnStitches);
  } else if (isFiniteNumber(explicitHip) && isFiniteNumber(spi) && spi > 0) {
    // Half-panel hip stitches, derived from the same hip measurement HIP_INCHES uses.
    hipSts = Math.round((explicitHip * spi) / 2);
  } else if (isFiniteNumber(d.backStitches) && d.backStitches > 0) {
    hipSts = Math.round(d.backStitches);
  } else if (isFiniteNumber(finishedHip) && isFiniteNumber(spi) && spi > 0) {
    hipSts = Math.round((finishedHip * spi) / 2);
  }

  const hipHalfWidthIn =
    isFiniteNumber(finishedHip) && finishedHip > 0 ? finishedHip / 2 : undefined;

  const hipRowsFromHem = isFiniteNumber(d.hipRowsFromHem)
    ? Math.max(0, Math.round(d.hipRowsFromHem))
    : undefined;

  return {
    HIP_STS: isFiniteNumber(hipSts) ? String(Math.max(0, hipSts)) : "",
    HIP_ROWS: isFiniteNumber(hipRowsFromHem) ? String(hipRowsFromHem) : "",
    HIP_INCHES: fmtNumber(inchesToUnit(hipHalfWidthIn, unit) ?? Number.NaN),
  };
}

/** Vertical side-seam label above the hem: cast-on-to-armhole rows minus hem rows
 * (body only — does not include the hem band).
 */
function resolveSideSeamAboveHemRows(d: SleevelessBackPatternResult["debug"]): number | undefined {
  const hemRows = isFiniteNumber(d.hemRows) ? Math.round(d.hemRows) : undefined;
  const castOnToArmhole = isFiniteNumber(d.rowsFromCastOnToArmholeStart)
    ? Math.round(d.rowsFromCastOnToArmholeStart)
    : isFiniteNumber(hemRows) && isFiniteNumber(d.bodyRows)
      ? hemRows + Math.round(d.bodyRows)
      : undefined;
  if (castOnToArmhole !== undefined && hemRows !== undefined) {
    return Math.max(0, castOnToArmhole - hemRows);
  }
  if (isFiniteNumber(d.bodyRows)) {
    return Math.max(0, Math.round(d.bodyRows));
  }
  return undefined;
}

/**
 * Drop-shoulder garment diagrams label straight knitting from the armhole marker to neckline
 * start separately from {@link NECK_DEPTH_ROWS}. Full derived armhole depth (marker → shoulder)
 * double-counts the neck band when both labels appear on the schematic.
 */
export function resolveArmholeRowsForGarmentDiagram(
  result: SleevelessBackPatternResult,
  measurementPiece: SleevelessDiagramReplacementPiece,
  d: SleevelessBackPatternResult["debug"],
): number | undefined {
  if (!result.isDropShoulder) {
    return isFiniteNumber(d.armholeRows) ? Math.round(d.armholeRows) : undefined;
  }

  const markerRc = isFiniteNumber(d.rowsFromCastOnToArmholeStart)
    ? Math.round(d.rowsFromCastOnToArmholeStart)
    : isFiniteNumber(d.hemRows) && isFiniteNumber(d.bodyRows)
      ? Math.round(d.hemRows + d.bodyRows)
      : undefined;

  const necklineStartRc =
    measurementPiece === "front"
      ? isFiniteNumber(d.frontNecklineStartRC)
        ? Math.round(d.frontNecklineStartRC)
        : undefined
      : isFiniteNumber(d.backNecklineStartRC)
        ? Math.round(d.backNecklineStartRC)
        : isFiniteNumber(d.finalRC)
          ? Math.round(d.finalRC)
          : undefined;

  if (markerRc !== undefined && necklineStartRc !== undefined) {
    return Math.max(0, necklineStartRc - markerRc);
  }

  const fullArmholeRows = isFiniteNumber(d.armholeRows) ? Math.round(d.armholeRows) : undefined;
  const neckDepthRows =
    measurementPiece === "front"
      ? isFiniteNumber(d.frontNeckDepthRows)
        ? Math.round(d.frontNeckDepthRows)
        : undefined
      : isFiniteNumber(d.backNeckDepthRows)
        ? Math.round(d.backNeckDepthRows)
        : isFiniteNumber(d.reservedNecklineShoulderRows)
          ? Math.round(d.reservedNecklineShoulderRows)
          : undefined;

  if (fullArmholeRows !== undefined && neckDepthRows !== undefined) {
    return Math.max(0, fullArmholeRows - neckDepthRows);
  }

  return fullArmholeRows;
}

/** Hem band rows + depth for `{{HEM_ROWS}}` / `{{HEM_INCHES}}` diagram labels. */
function resolveHemFieldsForSleevelessDiagram(
  d: SleevelessBackPatternResult["debug"],
  patternData: Record<string, unknown>,
  unit: "cm" | "in",
): { HEM_ROWS: string; HEM_INCHES: string } {
  const audience = pickAudienceFromPatternData(patternData);
  const hemDepthIn = resolveEffectiveHemDepthInches(patternData, audience);
  const hemRows = isFiniteNumber(d.hemRows)
    ? Math.round(d.hemRows)
    : calculateHemRowsFromInches(d.rowsPerInch ?? NaN, hemDepthIn);
  const rpi = d.rowsPerInch;
  const hemInchesFromRows =
    isFiniteNumber(hemRows) && isFiniteNumber(rpi) && rpi > 0
      ? lengthFromRowsForDiagram(hemRows, rpi, unit)
      : undefined;
  const hemFields = {
    HEM_ROWS: isFiniteNumber(hemRows) ? String(Math.max(0, hemRows)) : "",
    HEM_INCHES: fmtNumber(hemInchesFromRows ?? inchesToUnit(hemDepthIn, unit) ?? Number.NaN),
  };
  return hemFields;
}

/** Neck depth labels for diagram overlays — matches legacy sleeveless behavior for back/front/shared. */
export function resolveNeckDepthFieldsForSleevelessDiagram(
  result: SleevelessBackPatternResult,
  patternData: Record<string, unknown>,
  piece: "back" | "front" | "shared",
  unit: "cm" | "in",
): { NECK_DEPTH_ROWS: string; NECK_DEPTH: string } {
  const d = result?.debug ?? {};
  const rpi = d.rowsPerInch;

  const backDepthIn = resolveEffectiveBackNeckDepthInches(patternData);
  const frontDepthIn = resolveEffectiveFrontNeckDepthInches(patternData);

  let pieceDepthIn: number | undefined;
  if (piece === "back") pieceDepthIn = backDepthIn;
  else if (piece === "front") pieceDepthIn = frontDepthIn;

  const depthInches = isFiniteNumber(pieceDepthIn)
    ? pieceDepthIn
    : piece === "front" && isFiniteNumber(d.frontNeckDepth)
      ? d.frontNeckDepth
      : d.reservedNecklineShoulderInches;

  let depthRows: number | undefined;
  if (piece === "front" && isFiniteNumber(d.frontNeckDepthRows) && d.frontNeckDepthRows > 0) {
    depthRows = d.frontNeckDepthRows;
  } else if (piece === "back" && isFiniteNumber(d.backNeckDepthRows) && d.backNeckDepthRows > 0) {
    depthRows = d.backNeckDepthRows;
  } else if (isFiniteNumber(pieceDepthIn) && isFiniteNumber(rpi) && rpi > 0) {
    depthRows = Math.max(0, Math.round(pieceDepthIn * rpi));
  } else {
    depthRows = d.reservedNecklineShoulderRows;
  }

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
  half: CardiganHalfFrontWidths,
  side: "left" | "right",
  finishedBust: number | undefined,
  finishedHip: number | undefined,
  unit: "cm" | "in",
): void {
  repl.BUST_STS = String(half.bustBodySts);
  const bustWidthIn = finishedBust !== undefined ? finishedBust / 4 : undefined;
  repl.BUST_WIDTH = fmtNumber(inchesToUnit(bustWidthIn, unit) ?? NaN);

  repl.HIP_STS = String(half.hemCastOnSts);
  const hipCirc = finishedHip ?? finishedBust;
  const hipWidthIn = hipCirc !== undefined ? hipCirc / 4 : undefined;
  repl.HIP_INCHES = fmtNumber(inchesToUnit(hipWidthIn, unit) ?? NaN);

  // Cross-back dimension for one cardigan front panel = that panel's post-armhole body width.
  const crossBackHalf = crossBackWidthForDiagram(half.stitchesAfterArmhole, d.stitchesPerInch, unit);
  repl.SHOULDER_STS = crossBackHalf.sts !== undefined ? String(crossBackHalf.sts) : "";
  repl.SHOULDER_WIDTH = crossBackHalf.widthLabel;

  // Half-front diagram: neckline at CF is split — show half the neck stitches / width on this piece.
  // Inch value is derived from that half stitch count so the label stays internally consistent.
  const halfNeckSts = halfStitchesRounded(d.necklineStitches);
  const halfNeck = stitchWidthLabel(halfNeckSts, d.stitchesPerInch, unit);
  repl.NECK_STS = halfNeck.sts !== undefined ? String(halfNeck.sts) : "";
  repl.NECK_WIDTH = halfNeck.widthLabel;

  const shoulderBindOffSts = shoulderStitchesPerSideForDiagram(d);
  repl.SHOULDER_BINDOFF_STS =
    shoulderBindOffSts !== undefined ? String(shoulderBindOffSts) : "";

  repl.OPENING_STS = "0";
  repl.PIECE_TITLE = side === "left" ? "LEFT FRONT" : "RIGHT FRONT";
  /** Reserved token for future CF annotations; empty until bands/overlap UI exists. */
  repl.CF_EDGE_NOTE = "";
}

export type BuildSleevelessGarmentDiagramReplacementsOptions = {
  patternData: Record<string, unknown>;
  /** Which neckline depth row applies (matches diagram URL inference). */
  measurementPiece: SleevelessDiagramReplacementPiece;
  /** One cardigan half — all width stitch tokens use half-panel values (hem, bust, armhole). */
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
  const hipFields = resolveHipFieldsForSleevelessDiagram(d, options.patternData, unit);

  const finishedBust = isFiniteNumber(d.finishedBustChest) ? d.finishedBustChest : undefined;
  const finishedHip = resolveDiagramFinishedHipInches(options.patternData, finishedBust);
  const bustWidthIn = finishedBust !== undefined ? finishedBust / 2 : undefined;

  const unitLabel = unit === "cm" ? "cm" : "in";

  const sideSeamAboveHemRows = resolveSideSeamAboveHemRows(d);

  const SIDE_LENGTH = (() => {
    const rpi = d.rowsPerInch;
    if (!isFiniteNumber(rpi) || rpi <= 0) return "";
    if (!isFiniteNumber(sideSeamAboveHemRows)) return "";
    const fromRows = lengthFromRowsForDiagram(sideSeamAboveHemRows, rpi, unit);
    return fmtNumber(fromRows ?? Number.NaN);
  })();

  const rpiForDiagram = d.rowsPerInch;
  const totalInstructionRows = resolveTotalInstructionRows(d);
  const heightFromRows =
    isFiniteNumber(totalInstructionRows) &&
    isFiniteNumber(rpiForDiagram) &&
    rpiForDiagram > 0
      ? lengthFromRowsForDiagram(totalInstructionRows, rpiForDiagram, unit)
      : undefined;
  const armholeRowsForDiagram = resolveArmholeRowsForGarmentDiagram(
    result,
    options.measurementPiece,
    d,
  );
  const armholeDepthFromRows =
    isFiniteNumber(armholeRowsForDiagram) &&
    isFiniteNumber(rpiForDiagram) &&
    rpiForDiagram > 0
      ? lengthFromRowsForDiagram(armholeRowsForDiagram, rpiForDiagram, unit)
      : undefined;

  const crossBack = crossBackWidthForDiagram(d.stitchesAfterArmhole, d.stitchesPerInch, unit);
  // Neck opening label: derive inches from the knitted neck stitch count, not the raw measurement.
  const neckOpening = stitchWidthLabel(d.necklineStitches, d.stitchesPerInch, unit);
  const shoulderBindOffSts = shoulderStitchesPerSideForDiagram(d);

  const repl: Record<string, string> = {
    UNIT: unitLabel,
    HEIGHT: fmtNumber(heightFromRows ?? inchesToUnit(d.backNeckToHem, unit) ?? NaN),
    ARMHOLE_DEPTH: fmtNumber(
      armholeDepthFromRows ?? inchesToUnit(d.armholeDepth, unit) ?? Number.NaN,
    ),
    ARMHOLE_ROWS: isFiniteNumber(armholeRowsForDiagram) ? String(armholeRowsForDiagram) : "",
    BUST_STS: isFiniteNumber(d.backStitches) ? String(Math.round(d.backStitches)) : "",
    BUST_WIDTH: fmtNumber(inchesToUnit(bustWidthIn, unit) ?? NaN),
    SHOULDER_STS: crossBack.sts !== undefined ? String(crossBack.sts) : "",
    SHOULDER_WIDTH: crossBack.widthLabel,
    SHOULDER_BINDOFF_STS:
      shoulderBindOffSts !== undefined ? String(shoulderBindOffSts) : "",
    NECK_STS: neckOpening.sts !== undefined ? String(neckOpening.sts) : "",
    NECK_WIDTH: neckOpening.widthLabel,
    NECK_DEPTH_ROWS: neckDepth.NECK_DEPTH_ROWS,
    NECK_DEPTH: neckDepth.NECK_DEPTH,
    SIDE_LENGTH_ROWS: isFiniteNumber(sideSeamAboveHemRows)
      ? String(sideSeamAboveHemRows)
      : "",
    SIDE_LENGTH,
    HEM_ROWS: hemFields.HEM_ROWS,
    HEM_INCHES: hemFields.HEM_INCHES,
    HIP_STS: hipFields.HIP_STS,
    HIP_ROWS: hipFields.HIP_ROWS,
    HIP_INCHES: hipFields.HIP_INCHES,
    OPENING_STS: "",
    PIECE_TITLE: "",
    CF_EDGE_NOTE: "",
  };

  let cardiganHalfSide = options.cardiganHalfSide;
  if (
    !cardiganHalfSide &&
    options.measurementPiece === "front" &&
    isSleevelessCardiganGarmentStyle(options.patternData)
  ) {
    cardiganHalfSide = "left";
  }

  if (cardiganHalfSide === "left" || cardiganHalfSide === "right") {
    const hemBase =
      isFiniteNumber(d.hemCastOnStitches) && d.hemCastOnStitches > 0
        ? d.hemCastOnStitches
        : isFiniteNumber(d.backStitches)
          ? d.backStitches
          : 0;
    const bustBase =
      isFiniteNumber(d.bustBodyStitches) && d.bustBodyStitches > 0
        ? d.bustBodyStitches
        : hemBase;
    const shoulderBase = isFiniteNumber(d.stitchesAfterArmhole) ? d.stitchesAfterArmhole : 0;
    const half = resolveCardiganHalfFrontWidths(
      {
        hemCastOnSts: hemBase,
        bustBodySts: bustBase,
        stitchesAfterArmhole: shoulderBase,
      },
      cardiganHalfSide,
    );
    applyCardiganHalfFrontMeasurements(
      repl,
      d,
      half,
      cardiganHalfSide,
      finishedBust,
      finishedHip,
      unit,
    );
    const hipFieldsHalf = resolveHipFieldsForSleevelessDiagram(d, options.patternData, unit);
    if (hipFieldsHalf.HIP_ROWS) repl.HIP_ROWS = hipFieldsHalf.HIP_ROWS;
  }

  return repl;
}

/** Debug slice written by {@link generateDropShoulderPattern} for the sleeve schematic. */
type DropShoulderSleeveDiagramDebug = {
  rowsPerInch?: number;
  dropShoulderSleeveTotalRows?: number;
  dropShoulderSleeveBodyRows?: number;
  dropShoulderSleeveCuffRows?: number;
  dropShoulderSleeveLengthInches?: number;
  dropShoulderSleeveTopStitches?: number;
  dropShoulderSleeveWristStitches?: number;
  dropShoulderWristInches?: number;
  dropShoulderUpperArmInches?: number;
  dropShoulderUpperArmRows?: number;
  dropShoulderCuffDepthInches?: number;
};

/**
 * Sleeve body rows on the measurement schematic (above cuff, through bind-off RC).
 * Prefer total − cuff so shaping remainder rows are always included in the label.
 */
export function resolveDropShoulderSleeveBodyRowsForDiagram(
  d: DropShoulderSleeveDiagramDebug,
): number | undefined {
  const total = isFiniteNumber(d.dropShoulderSleeveTotalRows)
    ? Math.round(d.dropShoulderSleeveTotalRows)
    : undefined;
  const cuff = isFiniteNumber(d.dropShoulderSleeveCuffRows)
    ? Math.round(d.dropShoulderSleeveCuffRows)
    : undefined;
  if (total !== undefined && cuff !== undefined) {
    return Math.max(0, total - cuff);
  }
  if (isFiniteNumber(d.dropShoulderSleeveBodyRows) && d.dropShoulderSleeveBodyRows > 0) {
    return Math.round(d.dropShoulderSleeveBodyRows);
  }
  return undefined;
}

/**
 * Replacement map for `public/images/patterns/drop-shoulder/drop-body-sleeve.svg`.
 * Reuses the same fetch/replace pipeline as body schematics; values come from drop-shoulder debug only.
 */
export function buildDropShoulderSleeveDiagramReplacements(
  result: SleevelessBackPatternResult,
  unit: "cm" | "in",
  sleeveDirection: DropShoulderSleeveDirection = "cuff-up",
): Record<string, string> {
  const d = (result?.debug ?? {}) as DropShoulderSleeveDiagramDebug;
  const rpi = d.rowsPerInch;
  const unitLabel = unit === "cm" ? "cm" : "in";

  const armLengthRows = isFiniteNumber(d.dropShoulderSleeveTotalRows)
    ? Math.round(d.dropShoulderSleeveTotalRows)
    : undefined;
  const sleeveBodyRows = resolveDropShoulderSleeveBodyRowsForDiagram(d);
  const armLengthInches = isFiniteNumber(d.dropShoulderSleeveLengthInches)
    ? d.dropShoulderSleeveLengthInches
    : undefined;
  const upperArmRows = isFiniteNumber(d.dropShoulderUpperArmRows)
    ? Math.round(d.dropShoulderUpperArmRows)
    : undefined;
  const upperArmInches = isFiniteNumber(d.dropShoulderUpperArmInches)
    ? d.dropShoulderUpperArmInches
    : undefined;
  const cuffRows = isFiniteNumber(d.dropShoulderSleeveCuffRows)
    ? Math.round(d.dropShoulderSleeveCuffRows)
    : undefined;
  const topSts = isFiniteNumber(d.dropShoulderSleeveTopStitches)
    ? Math.round(d.dropShoulderSleeveTopStitches)
    : undefined;
  const wristSts = isFiniteNumber(d.dropShoulderSleeveWristStitches)
    ? Math.round(d.dropShoulderSleeveWristStitches)
    : undefined;
  const wristInches = isFiniteNumber(d.dropShoulderWristInches)
    ? d.dropShoulderWristInches
    : undefined;

  const cuffInchesFromRows =
    isFiniteNumber(cuffRows) && isFiniteNumber(rpi) && rpi > 0
      ? lengthFromRowsForDiagram(cuffRows, rpi, unit)
      : undefined;
  const cuffInchesFallback = isFiniteNumber(d.dropShoulderCuffDepthInches)
    ? d.dropShoulderCuffDepthInches
    : undefined;
  const cuffDepthLabel = fmtNumber(
    cuffInchesFromRows ?? inchesToUnit(cuffInchesFallback, unit) ?? Number.NaN,
  );
  const sideLengthFromBodyRows =
    isFiniteNumber(sleeveBodyRows) && isFiniteNumber(rpi) && rpi > 0
      ? lengthFromRowsForDiagram(sleeveBodyRows, rpi, unit)
      : undefined;
  const armLengthFromTotalRows =
    isFiniteNumber(armLengthRows) && isFiniteNumber(rpi) && rpi > 0
      ? lengthFromRowsForDiagram(armLengthRows, rpi, unit)
      : undefined;

  // Physical sleeve ends — independent of diagram orientation.
  const upperArmStitches = topSts;
  const cuffStitches = wristSts;
  const upperArmCircumference = upperArmInches;
  const cuffCircumference = wristInches;

  const isTopDown = sleeveDirection === "top-down";
  const topEndStitches = isTopDown ? cuffStitches : upperArmStitches;
  const bottomEndStitches = isTopDown ? upperArmStitches : cuffStitches;
  const topEndCircumference = isTopDown ? cuffCircumference : upperArmCircumference;
  const bottomEndCircumference = isTopDown ? upperArmCircumference : cuffCircumference;

  // Cuff-up artwork: SLEEVE_CAP at top, WRIST at bottom. Top-down artwork: WRIST at top, SLEEVE_CAP at bottom.
  const sleeveCapStsToken = isTopDown ? bottomEndStitches : topEndStitches;
  const wristStsToken = isTopDown ? topEndStitches : bottomEndStitches;
  const sleeveCapWidthToken = isTopDown ? bottomEndCircumference : topEndCircumference;
  const wristWidthToken = isTopDown ? topEndCircumference : bottomEndCircumference;

  return {
    UNIT: unitLabel,
    // Legacy tokens (prior drop-shoulder sleeve schematic).
    ARM_LENGTH_ROWS: isFiniteNumber(armLengthRows) ? String(armLengthRows) : "",
    ARM_LENGTH: fmtNumber(armLengthFromTotalRows ?? inchesToUnit(armLengthInches, unit) ?? Number.NaN),
    UPPER_ARM_ROWS: isFiniteNumber(upperArmRows) ? String(upperArmRows) : "",
    UPPER_ARM_INCHES: fmtNumber(inchesToUnit(upperArmInches, unit) ?? Number.NaN),
    CUFF_ROWS: isFiniteNumber(cuffRows) ? String(cuffRows) : "",
    CUFF_INCHES: cuffDepthLabel,
    // Measurement schematics (`drop-body-sleeve.svg` / `drop-body-sleeve-top-down.svg`).
    SLEEVE_CAP_STS: isFiniteNumber(sleeveCapStsToken) ? String(sleeveCapStsToken) : "",
    SLEEVE_CAP_WIDTH: fmtNumber(inchesToUnit(sleeveCapWidthToken, unit) ?? Number.NaN),
    WRIST_STS: isFiniteNumber(wristStsToken) ? String(wristStsToken) : "",
    WRIST_WIDTH: fmtNumber(inchesToUnit(wristWidthToken, unit) ?? Number.NaN),
    SLEEVE_LENGTH_ROWS: isFiniteNumber(sleeveBodyRows) ? String(sleeveBodyRows) : "",
    // Body line only (excludes cuff) — derive inches from the same row count, never full sleeve length.
    SIDE_LENGTH: fmtNumber(sideLengthFromBodyRows ?? Number.NaN),
    CUFF_DEPTH: cuffDepthLabel,
  };
}

/**
 * Japanese notation tokens for `public/images/patterns/drop-shoulder/JP-drop-body-sleeve.svg`.
 */
export function buildDropShoulderSleeveJapaneseNotationReplacements(
  result: SleevelessBackPatternResult,
  sleeveDirection: DropShoulderSleeveDirection = "cuff-up",
): Record<string, string> {
  const d = (result?.debug ?? {}) as DropShoulderSleeveDiagramDebug;
  const wristSts = isFiniteNumber(d.dropShoulderSleeveWristStitches)
    ? Math.round(d.dropShoulderSleeveWristStitches)
    : undefined;
  const topSts = isFiniteNumber(d.dropShoulderSleeveTopStitches)
    ? Math.round(d.dropShoulderSleeveTopStitches)
    : undefined;
  const bodyRows = resolveDropShoulderSleeveBodyRowsForDiagram(d);
  const cuffRows = isFiniteNumber(d.dropShoulderSleeveCuffRows)
    ? Math.round(d.dropShoulderSleeveCuffRows)
    : undefined;

  const shapingPlan =
    isFiniteNumber(topSts) && isFiniteNumber(wristSts) && isFiniteNumber(bodyRows) && bodyRows > 0
      ? dropShoulderSleeveShapingPlan({ topSts, wristSts, sleeveBodyRows: bodyRows })
      : {
          steps: [],
          remainderRows: bodyRows ?? 0,
          noShaping: true,
          shapingDirection: "increase" as const,
          schedule: { interval: 0, count: 0, remainderRows: bodyRows ?? 0 },
        };

  const sleeveShapingNotation = formatDropShoulderSleeveShapingNotation(shapingPlan.steps);

  const isTopDown = sleeveDirection === "top-down";
  const castOnSts = isTopDown ? topSts : wristSts;
  // Bottom-up: label at upper arm. Top-down: same token sits at the cuff/wrist edge.
  const jpSleeveCapEdgeSts = isTopDown ? wristSts : topSts;

  return {
    "jp-caston":
      isFiniteNumber(castOnSts) && castOnSts > 0 ? `${formatCastOnNotation(castOnSts)} sts` : "",
    "jp-cuff":
      isFiniteNumber(cuffRows) && cuffRows > 0
        ? `${formatBodyRowsNotation(cuffRows)} rows`
        : "",
    "jp-sleeve-shaping": sleeveShapingNotation,
    "jp-sleeve_cap_sts":
      isFiniteNumber(jpSleeveCapEdgeSts) && jpSleeveCapEdgeSts > 0 ? `${jpSleeveCapEdgeSts} sts` : "",
    "jp-sleeve":
      sleeveShapingNotation ||
      (isFiniteNumber(bodyRows) && bodyRows > 0 ? formatBodyRowsNotation(bodyRows) : ""),
  };
}
