import {
  calculateRoundNecklinePlan,
  type RoundNecklinePlanResult,
} from "../patterns/legoBlocks/roundNeckline";
import {
  roundNeckPlanOneSideFullJpLines,
  roundNeckPlanOneSideNeckEdgeWrittenLines,
} from "../patterns/roundNeckPlanPresentation";
import { inchesToRows } from "../patterns/sleevelessRowAccounting";

/**
 * Fixed practice-piece dimensions for a drop-shoulder-style front with round neckline.
 * Finished height = body before neck + neck/shoulder zone (no separate armhole or shoulder shaping).
 */
export const ROUND_NECKLINE_PRACTICE_DEFAULTS = {
  pieceWidthInches: 14,
  rowsBeforeNecklineInches: 3,
  neckOpeningWidthInches: 5,
  neckDepthInches: 3,
} as const;

export type RoundNecklinePracticeDimensions = typeof ROUND_NECKLINE_PRACTICE_DEFAULTS;

export type RoundNecklinePracticeGauge = {
  stitchesPerFourInches: number;
  rowsPerFourInches: number;
};

export type RoundNecklinePracticeShapingChartRow = {
  step: string;
  rows: string;
  stitches: string;
  detail: string;
};

/** SVG placeholder keys populated from the shared calculation result. */
export type RoundNecklinePracticeSvgPlaceholders = {
  "cast-on": number;
  NECK_STS: number;
  SHOULDER_BINDOFF_STS: number;
  /** Body rows below the neck opening (lower dimension line on the SVG). */
  HEIGHT: number;
  HEIGHT_TOP: number;
  HEIGHT_TOTAL: number;
  /** Neck/shoulder zone depth (upper dimension line on the SVG). */
  DEPTH: number;
  JP_LINE1: string;
  JP_LINE2: string;
  JP_LINE3: string;
  "JP-SHAPING": string;
};

export type RoundNecklinePracticeResult = {
  gauge: {
    stitchesPerFourInches: number;
    rowsPerFourInches: number;
    stitchesPerInch: number;
    rowsPerInch: number;
  };
  dimensions: RoundNecklinePracticeDimensions & {
    finishedHeightInches: number;
  };
  castOnStitches: number;
  totalRows: number;
  rowsBeforeNeckline: number;
  neckDepthRows: number;
  neckOpeningStitches: number;
  neckOpeningWidthInches: number;
  neckDepthInches: number;
  centerBindOffStitches: number;
  leftShoulderStitches: number;
  rightShoulderStitches: number;
  oneSideStartingStitches: number;
  oppositeSideStitches: number;
  neckPlan: RoundNecklinePlanResult;
  neckShapingRows: number;
  rowsRemainingAfterFinalNecklineShaping: number;
  neckEdgeWrittenLines: string[];
  japaneseNotationLines: string[];
  svgPlaceholders: RoundNecklinePracticeSvgPlaceholders;
  worksheetSteps: string[];
  shapingChart: RoundNecklinePracticeShapingChartRow[];
  warnings: string[];
};

export function stitchesPerInchFromGauge(stitchesPerFourInches: number): number {
  if (!Number.isFinite(stitchesPerFourInches) || stitchesPerFourInches <= 0) return 0;
  return stitchesPerFourInches / 4;
}

export function rowsPerInchFromGauge(rowsPerFourInches: number): number {
  if (!Number.isFinite(rowsPerFourInches) || rowsPerFourInches <= 0) return 0;
  return rowsPerFourInches / 4;
}

/**
 * When cast-on minus neck opening leaves an odd remainder, bump neck width by 1 stitch
 * so left and right shoulders can match.
 */
export function adjustNecklineStitchesForEvenShoulders(
  pieceWidthStitches: number,
  neckOpeningStitches: number,
): number {
  const width = Math.max(0, Math.round(pieceWidthStitches));
  let neck = Math.max(0, Math.round(neckOpeningStitches));
  if (width > 0 && (width - neck) % 2 !== 0) {
    neck += 1;
  }
  return neck;
}

function buildJapaneseNotationPlaceholders(
  lines: readonly string[],
): Pick<
  RoundNecklinePracticeSvgPlaceholders,
  "JP_LINE1" | "JP_LINE2" | "JP_LINE3" | "JP-SHAPING"
> {
  const filtered = lines.filter((line) => line.length > 0);
  return {
    JP_LINE1: filtered[0] ?? "",
    JP_LINE2: filtered[1] ?? "",
    JP_LINE3: filtered[2] ?? "",
    "JP-SHAPING": filtered.join("\n"),
  };
}

function buildWorksheetSteps(input: {
  castOnStitches: number;
  rowsBeforeNeckline: number;
  centerBindOffStitches: number;
  oppositeSideStitches: number;
  neckEdgeWrittenLines: string[];
  rowsRemainingAfterFinalNecklineShaping: number;
  shoulderStitches: number;
}): string[] {
  const steps = [
    `Cast on ${input.castOnStitches} stitches.`,
    `Knit ${input.rowsBeforeNeckline} rows even.`,
    `Bind off the center ${input.centerBindOffStitches} stitches.`,
    `Work one side of the neckline (${input.oppositeSideStitches} stitches on hold on the other side).`,
  ];

  if (input.neckEdgeWrittenLines.length > 0) {
    steps.push(`Shape the neck edge: ${input.neckEdgeWrittenLines.join(" ")}`);
  } else {
    steps.push("Shape the neck edge as needed for your stitch count.");
  }

  if (input.rowsRemainingAfterFinalNecklineShaping > 0) {
    steps.push(
      `Knit ${input.rowsRemainingAfterFinalNecklineShaping} rows even to the shoulder.`,
    );
  }

  steps.push(`Bind off ${input.shoulderStitches} shoulder stitches.`);
  steps.push("Repeat for the second side, reversing the shaping.");

  return steps;
}

function buildShapingChart(input: {
  castOnStitches: number;
  rowsBeforeNeckline: number;
  centerBindOffStitches: number;
  oppositeSideStitches: number;
  neckEdgeWrittenLines: string[];
  neckShapingRows: number;
  rowsRemainingAfterFinalNecklineShaping: number;
  shoulderStitches: number;
}): RoundNecklinePracticeShapingChartRow[] {
  const rows: RoundNecklinePracticeShapingChartRow[] = [
    {
      step: "Cast on",
      rows: "-",
      stitches: String(input.castOnStitches),
      detail: "Full practice piece width",
    },
    {
      step: "Knit even",
      rows: String(input.rowsBeforeNeckline),
      stitches: String(input.castOnStitches),
      detail: "Before neckline shaping begins",
    },
    {
      step: "Center bind off",
      rows: "1",
      stitches: String(input.centerBindOffStitches),
      detail: "Center neck stitches bound off",
    },
    {
      step: "Opposite side",
      rows: "-",
      stitches: String(input.oppositeSideStitches),
      detail: "Stitches on hold while working first side",
    },
  ];

  if (input.neckEdgeWrittenLines.length > 0) {
    rows.push({
      step: "Neck edge (each side)",
      rows: String(input.neckShapingRows),
      stitches: "-",
      detail: input.neckEdgeWrittenLines.join(" "),
    });
  }

  if (input.rowsRemainingAfterFinalNecklineShaping > 0) {
    rows.push({
      step: "Knit even",
      rows: String(input.rowsRemainingAfterFinalNecklineShaping),
      stitches: String(input.shoulderStitches),
      detail: "At shoulder width before bind-off",
    });
  }

  rows.push({
    step: "Bind off shoulder",
    rows: "1",
    stitches: String(input.shoulderStitches),
    detail: "Each side",
  });

  return rows;
}

/**
 * Single source of truth for the Round Neckline Skill Builder.
 * Uses drop-shoulder front round-neck shaping only (no armhole or shoulder shaping).
 */
export function calculateRoundNecklinePractice(
  gauge: RoundNecklinePracticeGauge,
  dimensions: RoundNecklinePracticeDimensions = ROUND_NECKLINE_PRACTICE_DEFAULTS,
): RoundNecklinePracticeResult | null {
  const spi = stitchesPerInchFromGauge(gauge.stitchesPerFourInches);
  const rpi = rowsPerInchFromGauge(gauge.rowsPerFourInches);
  if (spi <= 0 || rpi <= 0) return null;

  const castOnStitches = Math.round(dimensions.pieceWidthInches * spi);
  const rowsBeforeNeckline = inchesToRows(dimensions.rowsBeforeNecklineInches, rpi);
  const neckDepthRows = inchesToRows(dimensions.neckDepthInches, rpi);
  const totalRows = rowsBeforeNeckline + neckDepthRows;
  const finishedHeightInches =
    dimensions.rowsBeforeNecklineInches + dimensions.neckDepthInches;

  const rawNeckOpeningStitches = Math.round(dimensions.neckOpeningWidthInches * spi);
  const neckOpeningStitches = adjustNecklineStitchesForEvenShoulders(
    castOnStitches,
    rawNeckOpeningStitches,
  );
  const shoulderStitches = Math.floor((castOnStitches - neckOpeningStitches) / 2);
  const leftShoulderStitches = shoulderStitches;
  const rightShoulderStitches = shoulderStitches;

  const neckPlan = calculateRoundNecklinePlan({
    necklineStitches: neckOpeningStitches,
    necklineDepthRows: neckDepthRows,
  });

  const centerBindOffStitches = neckPlan.centerBindOff;
  const neckShapingRows = neckPlan.rowsRequired;
  const rowsRemainingAfterFinalNecklineShaping = Math.max(0, neckDepthRows - neckShapingRows);
  const oneSideStartingStitches = Math.floor((castOnStitches - centerBindOffStitches) / 2);
  const oppositeSideStitches = oneSideStartingStitches;

  const neckEdgeWrittenLines = roundNeckPlanOneSideNeckEdgeWrittenLines(neckPlan, "right");
  const japaneseNotationLines = roundNeckPlanOneSideFullJpLines(neckPlan, "right");

  const warnings: string[] = [...neckPlan.warnings];
  if (neckShapingRows > neckDepthRows) {
    warnings.push(
      `Neckline shaping needs ${neckShapingRows} rows but the neck zone allows ${neckDepthRows} rows; no even rows remain before bind-off.`,
    );
  }

  const svgPlaceholders: RoundNecklinePracticeSvgPlaceholders = {
    "cast-on": castOnStitches,
    NECK_STS: neckOpeningStitches,
    SHOULDER_BINDOFF_STS: shoulderStitches,
    HEIGHT: rowsBeforeNeckline,
    HEIGHT_TOP: rowsBeforeNeckline,
    HEIGHT_TOTAL: totalRows,
    DEPTH: neckDepthRows,
    ...buildJapaneseNotationPlaceholders(japaneseNotationLines),
  };

  const worksheetSteps = buildWorksheetSteps({
    castOnStitches,
    rowsBeforeNeckline,
    centerBindOffStitches,
    oppositeSideStitches,
    neckEdgeWrittenLines,
    rowsRemainingAfterFinalNecklineShaping,
    shoulderStitches,
  });

  const shapingChart = buildShapingChart({
    castOnStitches,
    rowsBeforeNeckline,
    centerBindOffStitches,
    oppositeSideStitches,
    neckEdgeWrittenLines,
    neckShapingRows,
    rowsRemainingAfterFinalNecklineShaping,
    shoulderStitches,
  });

  return {
    gauge: {
      stitchesPerFourInches: gauge.stitchesPerFourInches,
      rowsPerFourInches: gauge.rowsPerFourInches,
      stitchesPerInch: spi,
      rowsPerInch: rpi,
    },
    dimensions: {
      ...dimensions,
      finishedHeightInches,
    },
    castOnStitches,
    totalRows,
    rowsBeforeNeckline,
    neckDepthRows,
    neckOpeningStitches,
    neckOpeningWidthInches: neckOpeningStitches / spi,
    neckDepthInches: neckDepthRows / rpi,
    centerBindOffStitches,
    leftShoulderStitches,
    rightShoulderStitches,
    oneSideStartingStitches,
    oppositeSideStitches,
    neckPlan,
    neckShapingRows,
    rowsRemainingAfterFinalNecklineShaping,
    neckEdgeWrittenLines,
    japaneseNotationLines,
    svgPlaceholders,
    worksheetSteps,
    shapingChart,
    warnings,
  };
}
