/**
 * Hat pattern diagram helpers (Phase A).
 * Ported from `generateDiagram` in `src/pages/patterns/hat.astro`.
 *
 * Spiral reuses the gathered crown diagram template for now.
 */

import { applyHatCrownCastOnAdjustment, type HatPatternCalc } from "./hatMath";

export type HatDiagramFormatters = {
  convertLength: (value: number, from: string, to: string) => number;
  formatLengthWithUnit: (value: number, unit: string) => string;
};

/** Map crown style to `/diagrams/{name}.svg` template (spiral → gathered). */
export function resolveHatDiagramTemplateName(crown: string): string {
  if (crown === "wedge-4" || crown === "wedge-4-decrease") return "hat-4-wedge";
  return "hat-gathered";
}

export type HatDiagramTokens = Record<string, string>;

/** Build placeholder replacement map for the SVG diagram template. */
export function buildHatDiagramTokens(
  calc: HatPatternCalc,
  currentUnit: "inches" | "cm",
  formatters: HatDiagramFormatters,
): HatDiagramTokens {
  const { convertLength, formatLengthWithUnit } = formatters;
  const {
    hatHeight,
    brimDepth,
    targetWidth,
    castOnSts,
    brimRows,
    bodyRows,
    crown,
    crownRowCount,
    bodyHeightInches,
    crownHeightInches,
    stGaugePerInch,
  } = calc;

  const displayWidth = formatLengthWithUnit(
    currentUnit === "inches" ? targetWidth : convertLength(targetWidth, "inches", currentUnit),
    currentUnit,
  );

  const displayHeight = formatLengthWithUnit(
    currentUnit === "inches" ? hatHeight : convertLength(hatHeight, "inches", currentUnit),
    currentUnit,
  );

  const displayBrimDepth = formatLengthWithUnit(
    currentUnit === "inches" ? brimDepth : convertLength(brimDepth, "inches", currentUnit),
    currentUnit,
  );

  const displayBodyHeight = formatLengthWithUnit(
    currentUnit === "inches"
      ? bodyHeightInches
      : convertLength(bodyHeightInches, "inches", currentUnit),
    currentUnit,
  );

  const displayCrownDepth = formatLengthWithUnit(
    currentUnit === "inches"
      ? crownHeightInches
      : convertLength(crownHeightInches, "inches", currentUnit),
    currentUnit,
  );

  const displayCastOnSts = applyHatCrownCastOnAdjustment(castOnSts, crown);

  const isWedgeCrown = crown === "wedge-4" || crown === "wedge-4-decrease";
  let wedgeStsLabel = "";
  let wedgeWidthLabel = "";

  if (isWedgeCrown && castOnSts) {
    const wedgeSts = Math.round(castOnSts / 4);
    const finishedWidth = targetWidth || castOnSts / stGaugePerInch;
    const wedgeWidth = finishedWidth / 4;
    wedgeStsLabel = String(wedgeSts);
    wedgeWidthLabel = formatLengthWithUnit(
      currentUnit === "inches" ? wedgeWidth : convertLength(wedgeWidth, "inches", currentUnit),
      currentUnit,
    );
  }

  return {
    "{{WIDTH}}": displayWidth,
    "{{HEIGHT}}": displayHeight,
    "{{BRIM_DEPTH}}": displayBrimDepth,
    "{{BODY_HEIGHT}}": displayBodyHeight,
    "{{CROWN_DEPTH}}": displayCrownDepth,
    "{{CAST_ON_STS}}": `${displayCastOnSts} sts`,
    "{{BRIM_ROWS}}": `${brimRows} rows`,
    "{{BODY_ROWS}}": `${bodyRows} rows`,
    "{{CROWN_ROWS}}": `${crownRowCount} rows`,
    "{{WEDGE_STS}}": wedgeStsLabel,
    "{{WEDGE_WIDTH}}": wedgeWidthLabel,
  };
}

export function applyHatDiagramTokens(svgContent: string, tokens: HatDiagramTokens): string {
  let out = svgContent;
  for (const [token, value] of Object.entries(tokens)) {
    out = out.split(token).join(value);
  }
  return out;
}

/**
 * Fetch diagram SVG and fill tokens. Returns HTML string for `#diagram-content`.
 */
export async function loadHatDiagramSvg(
  calc: HatPatternCalc,
  currentUnit: "inches" | "cm",
  formatters: HatDiagramFormatters,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const templateName = resolveHatDiagramTemplateName(calc.crown);
  try {
    const response = await fetchImpl(`/diagrams/${templateName}.svg`);
    const svgContent = await response.text();
    const tokens = buildHatDiagramTokens(calc, currentUnit, formatters);
    return applyHatDiagramTokens(svgContent, tokens);
  } catch (error) {
    console.error("Failed to load diagram template:", templateName, error);
    return '<p style="text-align: center; color: #6b7280;">Diagram unavailable</p>';
  }
}
