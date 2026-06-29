import type {
  RoundNecklinePracticeGauge,
  RoundNecklinePracticeResult,
} from "./roundNecklinePractice";
import {
  formatRoundNecklinePracticeTimelineForSummary,
  validateRoundNecklinePracticeRowAccounting,
} from "./roundNecklinePracticeTimeline";

function formatInches(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}"` : `${rounded.toFixed(1)}"`;
}

function sidePlanSummary(result: RoundNecklinePracticeResult): string {
  const side = result.neckPlan.right;
  const parts: string[] = [];
  if (side.stairSteps.length > 0) {
    parts.push(`stairSteps (right): [${side.stairSteps.join(", ")}]`);
  }
  if (side.singleDecreaseCount > 0) {
    parts.push(`singleDecreases (right): ${side.singleDecreaseCount}`);
  }
  if (side.holdGroups.length > 0) {
    parts.push(`holdGroups (right): [${side.holdGroups.join(", ")}]`);
  }
  return parts.length > 0 ? parts.join("\n") : "(none)";
}

/**
 * Temporary developer summary - verifies SVG and written instructions share one result object.
 * Presentation only; does not recalculate shaping.
 */
export function buildRoundNecklinePracticeCalculationSummary(
  result: RoundNecklinePracticeResult,
  gauge: RoundNecklinePracticeGauge,
): string {
  const { dimensions, svgPlaceholders: svg } = result;

  const lines: string[] = [
    "Calculation Summary (temporary - dev only)",
    "",
    "Source of truth:",
    "  calculateRoundNecklinePractice()",
    "",
    "Row check:",
    "  rowsBeforeNeckline + neckDepthRows = totalRows",
    `  ${result.rowsBeforeNeckline} + ${result.neckDepthRows} = ${result.totalRows}`,
    "",
    "Stitch check:",
    "  leftShoulder + neckOpening + rightShoulder = castOn",
    `  ${result.leftShoulderStitches} + ${result.neckOpeningStitches} + ${result.rightShoulderStitches} = ${result.castOnStitches}`,
    "",
    "Rounding:",
    "  Neck width bumps by 1 stitch when (castOn - rawNeck) is odd so shoulders match.",
    "",
    "Gauge:",
    `  ${gauge.stitchesPerFourInches} sts / ${gauge.rowsPerFourInches} rows (per 4\")`,
    `  ${result.gauge.stitchesPerInch} sts/in, ${result.gauge.rowsPerInch} rows/in`,
    "",
    "Practice piece dimensions (fixed):",
    `  Finished width: ${formatInches(dimensions.pieceWidthInches)}`,
    `  Finished height: ${formatInches(dimensions.finishedHeightInches)}`,
    `  Body before neck: ${formatInches(dimensions.rowsBeforeNecklineInches)}`,
    `  Neck/shoulder zone: ${formatInches(dimensions.neckDepthInches)}`,
    `  Neck opening width target: ${formatInches(dimensions.neckOpeningWidthInches)}`,
    "",
    "Instruction values:",
    `  Cast on = ${result.castOnStitches}`,
    `  Knit before neckline = ${result.rowsBeforeNeckline}`,
    `  Center bind off = ${result.centerBindOffStitches}`,
    `  Opposite side on hold = ${result.oppositeSideStitches}`,
    `  Neck shaping rows = ${result.neckShapingRows}`,
    `  Rows after final neckline shaping = ${result.rowsRemainingAfterFinalNecklineShaping}`,
    `  Shoulder bind off = ${result.leftShoulderStitches}`,
    "",
    "SVG values:",
    `  cast-on = ${svg["cast-on"]}`,
    `  NECK_STS = ${svg.NECK_STS}`,
    `  SHOULDER_BINDOFF_STS = ${svg.SHOULDER_BINDOFF_STS}`,
    `  HEIGHT = ${svg.HEIGHT} (body segment on diagram)`,
    `  HEIGHT_TOP = ${svg.HEIGHT_TOP}`,
    `  HEIGHT_TOTAL = ${svg.HEIGHT_TOTAL}`,
    `  DEPTH = ${svg.DEPTH}`,
    `  JP_LINE1 = ${svg.JP_LINE1 || "(empty)"}`,
    `  JP_LINE2 = ${svg.JP_LINE2 || "(empty)"}`,
    `  JP_LINE3 = ${svg.JP_LINE3 || "(empty)"}`,
    "",
    "Neck zone row partition:",
    `  neckShapingRows + rowsRemainingAfterFinalNecklineShaping = neckDepthRows`,
    `  ${result.neckShapingRows} + ${result.rowsRemainingAfterFinalNecklineShaping} = ${result.neckDepthRows}`,
    "",
    "Neck plan:",
    `  Strategy: ${result.neckPlan.strategy}`,
    sidePlanSummary(result),
    "",
    "Japanese notation:",
    ...result.japaneseNotationLines.map((line) => `  ${line}`),
    "",
    "Written instructions (from same result):",
    ...result.worksheetSteps.map((step, i) => `  ${i + 1}. ${step}`),
  ];

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:", ...result.warnings.map((w) => `  ${w}`));
  }

  const accounting = validateRoundNecklinePracticeRowAccounting(result);
  lines.push("", ...formatRoundNecklinePracticeTimelineForSummary(accounting));

  return lines.join("\n");
}
