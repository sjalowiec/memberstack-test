/**
 * Inline back-piece schematic for print — replaces SVG placeholders using {@link SleevelessBackPatternResult.debug}
 * (same approach as the interactive pattern tab; no pattern math here).
 */

import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import { getSleevelessFrontDiagramSrc } from "./sleevelessFrontDiagramSrc";

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

function resolveNeckDepthFields(
  result: SleevelessBackPatternResult,
  patternData: Record<string, unknown>,
  piece: "back" | "front",
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

function buildReplacements(
  result: SleevelessBackPatternResult,
  unit: "cm" | "in",
  patternData: Record<string, unknown>,
): Record<string, string> {
  const d = result?.debug ?? {};
  const neckDepth = resolveNeckDepthFields(result, patternData, "back", unit);

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

  return {
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
  };
}

async function fetchSvgWithReplacements(src: string, replacements: Record<string, string>): Promise<string> {
  const res = await fetch(src, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Failed to load SVG: ${src} (${res.status})`);
  let svgText = await res.text();

  for (const [k, v] of Object.entries(replacements)) {
    const safeKey = String(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\{\\{\\s*${safeKey}\\s*\\}\\}`, "g");
    svgText = svgText.replace(re, v == null ? "" : String(v));
  }

  return svgText;
}

/** Returns SVG markup (single root `<svg>`) ready for `innerHTML`, with placeholders filled from `result.debug`. */
export async function loadSleevelessBackDiagramSvgMarkup(
  result: SleevelessBackPatternResult,
  patternData: Record<string, unknown>,
  unit: "cm" | "in",
): Promise<string> {
  return loadSleevelessPieceDiagramSvgMarkup(result, patternData, unit, "back");
}

/** Returns FRONT schematic SVG markup with generated front measurement values. */
export async function loadSleevelessFrontDiagramSvgMarkup(
  result: SleevelessBackPatternResult,
  patternData: Record<string, unknown>,
  unit: "cm" | "in",
): Promise<string> {
  return loadSleevelessPieceDiagramSvgMarkup(result, patternData, unit, "front");
}

async function loadSleevelessPieceDiagramSvgMarkup(
  result: SleevelessBackPatternResult,
  patternData: Record<string, unknown>,
  unit: "cm" | "in",
  piece: "back" | "front",
): Promise<string> {
  const replacements = buildReplacements(result, unit, patternData);
  if (piece === "front") {
    const frontNeckDepth = resolveNeckDepthFields(result, patternData, "front", unit);
    replacements.NECK_DEPTH_ROWS = frontNeckDepth.NECK_DEPTH_ROWS;
    replacements.NECK_DEPTH = frontNeckDepth.NECK_DEPTH;
  }
  const src =
    piece === "front"
      ? getSleevelessFrontDiagramSrc(patternData)
      : "/images/patterns/sleeveless/diagram-back.svg";
  const raw = await fetchSvgWithReplacements(src, replacements);
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg") {
    const pe = doc.querySelector("parsererror");
    throw new Error(pe?.textContent || "SVG parse error");
  }
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    piece === "front"
      ? "Front piece schematic with key measurements"
      : "Back piece schematic with key measurements",
  );
  svg.classList.add("print-back-diagram-svg");
  return svg.outerHTML;
}
