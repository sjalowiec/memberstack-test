/**
 * Shared presentation for round-neck plans: written instructions, Japanese notation,
 * and validation helpers.
 *
 * **Back** necklines always use {@link calculateBackRoundNecklinePlan} (documented shallow hold).
 * **Front** necklines use {@link calculateRoundNecklinePlan} (deep when depth allows, shallow hold otherwise).
 */

import {
  calculateBackRoundNecklinePlan,
  calculateRoundNecklinePlan,
  compressHoldGroupsToSegments,
  isShallowHoldRoundPlan,
  type RoundNecklinePlanResult,
  type RoundNecklineShapingResult,
  type RoundNecklineSidePlan,
} from "./legoBlocks/roundNeckline";
import {
  computeShallowBackNeckNeedleLayout,
  formatCenterNeedleHoldPhraseHtml,
  formatFirstSideHoldPhraseHtml,
  formatNeedleRangeHtml,
  formatNeedleRangeThrough,
  formatStitchCountValidation,
  NEEDLE_RANGE_CLASS,
} from "./legoBlocks/shallowBackNeckNeedleLayout";
import { formatHoldNotation, formatShapingSegment } from "./sleevelessBackJapaneseNotation";

export type RoundNeckBackShallowExecutionOptions = {
  /** Full back body width in stitches — enables needle-range execution instructions. */
  bodyWidthStitches: number;
};

export { NEEDLE_RANGE_CLASS };

export type RoundNeckPlanSide = "left" | "right";

export {
  calculateBackRoundNecklinePlan,
  calculateRoundNecklinePlan,
  type RoundNecklinePlanResult,
};

/** Front (or depth-aware) round-neck plan. */
export function roundNeckPlanForDepth(
  necklineStitches: number,
  necklineDepthRows: number,
): RoundNecklinePlanResult {
  return calculateRoundNecklinePlan({ necklineStitches, necklineDepthRows });
}

/** Back neck — always documented shallow-round (hold-based short rows). */
export function backRoundNeckPlanForDepth(
  necklineStitches: number,
  necklineDepthRows: number,
): RoundNecklinePlanResult {
  return calculateBackRoundNecklinePlan({ necklineStitches, necklineDepthRows });
}

function sidePlan(
  plan: RoundNecklinePlanResult | RoundNecklineShapingResult,
  side: RoundNeckPlanSide,
): RoundNecklineSidePlan {
  return side === "right" ? plan.right : plan.left;
}

/** Shallow machine-knit plan: short-row hold groups every other row (no stair bind-offs). */
export function isShallowSinglesOnlyPlan(
  plan: RoundNecklinePlanResult | RoundNecklineShapingResult,
): boolean {
  return isShallowHoldRoundPlan(plan);
}

function holdSegmentWrittenLine(
  stitchCount: number,
  repeatCount: number,
  edgePhrase: string,
): string {
  const stWord = stitchCount === 1 ? "stitch" : "stitches";
  return `At ${edgePhrase}, put ${stitchCount} ${stWord} in hold every other row ${repeatCount} time${repeatCount === 1 ? "" : "s"}.`;
}

/** Center neckline written line (hold for shallow; bind-off for deep). */
export function roundNeckPlanCenterWrittenLine(
  plan: RoundNecklinePlanResult | RoundNecklineShapingResult,
): string | null {
  const n = plan.centerBindOff;
  if (n <= 0) return null;
  if (isShallowHoldRoundPlan(plan)) {
    return `Place the center ${n} stitch${n === 1 ? "" : "es"} in hold.`;
  }
  return `Bind off the center ${n} stitch${n === 1 ? "" : "es"}.`;
}

/** Closing line after shallow hold shaping — neckline cleanup. */
export function roundNeckPlanFinishHeldStitchesLine(): string {
  return "Scrap off or bind off all remaining held neckline stitches.";
}

function holdNeedleSegmentBullet(stitchCount: number, repeatCount: number): string {
  const needleWord = stitchCount === 1 ? "needle" : "needles";
  return `• Put ${stitchCount} ${needleWord} into hold every other row ${repeatCount} time${repeatCount === 1 ? "" : "s"}.`;
}

function roundNeckBackNeedleSideShapingLines(
  segments: { stitchCount: number; repeatCount: number }[],
  sideLabel: "right" | "left",
): string[] {
  if (segments.length === 0) {
    return [`Knit the ${sideLabel} shoulder with no neck-edge hold shaping on this side.`];
  }
  return [
    "At the neck edge:",
    ...segments.map((seg) => holdNeedleSegmentBullet(seg.stitchCount, seg.repeatCount)),
  ];
}

function roundNeckBackShallowNeedleExecutionLines(
  plan: RoundNecklinePlanResult | RoundNecklineShapingResult,
  bodyWidthStitches: number,
): string[] {
  const layout = computeShallowBackNeckNeedleLayout(bodyWidthStitches, plan.centerBindOff);
  const { stitchCounts: counts } = layout;
  const rightSegments = compressHoldGroupsToSegments(plan.right.holdGroups);
  const leftSegments = compressHoldGroupsToSegments(plan.left.holdGroups);
  const centerRangeHtml = formatCenterNeedleHoldPhraseHtml(layout);
  const leftWorkRangeHtml = formatNeedleRangeHtml(
    formatNeedleRangeThrough(layout.leftShoulder.start, layout.leftShoulder.end),
  );
  const rightWorkRangeHtml = formatNeedleRangeHtml(
    formatNeedleRangeThrough(layout.rightShoulder.start, layout.rightShoulder.end),
  );

  return [
    "RIGHT SIDE",
    "",
    `Put needles ${formatFirstSideHoldPhraseHtml(layout)} into hold${formatStitchCountValidation(counts.firstSideHold)}.`,
    `Work needles ${rightWorkRangeHtml}${formatStitchCountValidation(counts.rightShoulder)}.`,
    ...roundNeckBackNeedleSideShapingLines(rightSegments, "right"),
    "",
    "When the final neck-edge group has been placed in hold, the right shoulder is complete.",
    "Scrap off or bind off the remaining right shoulder stitches.",
    "Break yarn and move the carriage to the opposite side.",
    "",
    "LEFT SIDE",
    "",
    `Return needles ${leftWorkRangeHtml} to working position${formatStitchCountValidation(counts.leftShoulder)}.`,
    `Leave center neckline needles ${centerRangeHtml} in hold${formatStitchCountValidation(counts.center)}.`,
    `Work needles ${leftWorkRangeHtml}.`,
    ...roundNeckBackNeedleSideShapingLines(leftSegments, "left"),
    "",
    "When the final neck-edge group has been placed in hold, the left shoulder is complete.",
    "Scrap off or bind off the remaining left shoulder stitches.",
    "",
    "BACK NECKLINE CLEANUP",
    "",
    roundNeckPlanFinishHeldStitchesLine(),
  ];
}

/** Armhole-local RC label for sleeveless back-neck summary (e.g. `RC:049`). */
export type RoundNeckBackShallowSleevelessSummaryOptions = RoundNeckBackShallowExecutionOptions & {
  necklineStartRcLabel?: string;
};

const SLEEVELESS_BACK_NECK_CHECKLIST_LINE =
  "Use the checklist below for row-by-row neckline and shoulder shaping.";

/**
 * Sleeveless back-neck **setup overview** — needle ranges without drop-shoulder RIGHT/LEFT workflow.
 * Row-by-row neck and shoulder shaping remain in the active-shoulder checklist.
 */
export function roundNeckBackShallowSleevelessSummaryWrittenLines(
  plan: RoundNecklinePlanResult | RoundNecklineShapingResult,
  options?: RoundNeckBackShallowSleevelessSummaryOptions,
): string[] {
  const checklistLine = SLEEVELESS_BACK_NECK_CHECKLIST_LINE;

  if (!isShallowHoldRoundPlan(plan)) {
    return [checklistLine];
  }

  const bodyWidth = options?.bodyWidthStitches ?? 0;
  const rcLabel = String(options?.necklineStartRcLabel ?? "").trim();
  const rcLine = rcLabel ? `At ${rcLabel}, begin back neckline and shoulder shaping.` : null;

  if (bodyWidth <= 0) {
    const centerLine = roundNeckPlanCenterWrittenLine(plan);
    return [rcLine, centerLine, checklistLine].filter((line): line is string => Boolean(line));
  }

  const layout = computeShallowBackNeckNeedleLayout(bodyWidth, plan.centerBindOff);
  const { stitchCounts: counts } = layout;
  const centerRangeHtml = formatCenterNeedleHoldPhraseHtml(layout);
  const rightWorkRangeHtml = formatNeedleRangeHtml(
    formatNeedleRangeThrough(layout.rightShoulder.start, layout.rightShoulder.end),
  );

  return [
    ...(rcLine ? [rcLine] : []),
    `Place center neckline needles ${centerRangeHtml} in hold${formatStitchCountValidation(counts.center)}.`,
    `Put needles ${formatFirstSideHoldPhraseHtml(layout)} into hold${formatStitchCountValidation(counts.firstSideHold)}.`,
    `Work needles ${rightWorkRangeHtml} first${formatStitchCountValidation(counts.rightShoulder)}.`,
    checklistLine,
  ];
}

/**
 * Shallow back-neck **execution** instructions (machine-knit workflow with needle ranges).
 * Drop-shoulder only — does not affect JP notation or shaping math — prose only.
 */
export function roundNeckBackShallowExecutionWrittenLines(
  plan: RoundNecklinePlanResult | RoundNecklineShapingResult,
  options?: RoundNeckBackShallowExecutionOptions,
): string[] {
  if (!isShallowHoldRoundPlan(plan)) {
    return roundNeckBackBothEdgesWrittenLines(plan);
  }

  const bodyWidth = options?.bodyWidthStitches ?? 0;
  if (bodyWidth > 0) {
    return roundNeckBackShallowNeedleExecutionLines(plan, bodyWidth);
  }

  const rightSegments = compressHoldGroupsToSegments(plan.right.holdGroups);
  const leftSegments = compressHoldGroupsToSegments(plan.left.holdGroups);
  return [
    "RIGHT SIDE",
    "",
    ...roundNeckBackNeedleSideShapingLines(rightSegments, "right"),
    "",
    "When the final neck-edge group has been placed in hold, the right shoulder is complete.",
    "Scrap off or bind off the remaining right shoulder stitches.",
    "Break yarn and move the carriage to the opposite side.",
    "",
    "LEFT SIDE",
    "",
    ...roundNeckBackNeedleSideShapingLines(leftSegments, "left"),
    "",
    "When the final neck-edge group has been placed in hold, the left shoulder is complete.",
    "Scrap off or bind off the remaining left shoulder stitches.",
    "",
    "BACK NECKLINE CLEANUP",
    "",
    roundNeckPlanFinishHeldStitchesLine(),
  ];
}

/** One-side neck-edge written lines (excludes center hold/bind-off). */
export function roundNeckPlanOneSideNeckEdgeWrittenLines(
  plan: RoundNecklinePlanResult | RoundNecklineShapingResult,
  side: RoundNeckPlanSide = "right",
): string[] {
  const { stairSteps, singleDecreaseCount, holdGroups } = sidePlan(plan, side);

  if (isShallowHoldRoundPlan(plan)) {
    return compressHoldGroupsToSegments(holdGroups).map((seg) =>
      holdSegmentWrittenLine(seg.stitchCount, seg.repeatCount, "the neck edge"),
    );
  }

  const lines: string[] = [];
  if (stairSteps.length > 0) {
    lines.push(
      `At the neck edge, bind off ${stairSteps.join(", then ")} stitch${stairSteps.length === 1 && stairSteps[0] === 1 ? "" : "es"} on alternate (neck-edge) rows.`,
    );
  }
  if (singleDecreaseCount > 0) {
    lines.push(
      `Decrease 1 stitch at the neck edge every other row ${singleDecreaseCount} time${singleDecreaseCount === 1 ? "" : "s"}.`,
    );
  }
  return lines;
}

function roundNeckPlanHoldGroupsJpLines(
  plan: RoundNecklinePlanResult | RoundNecklineShapingResult,
  side: RoundNeckPlanSide,
): string[] {
  const groups = sidePlan(plan, side).holdGroups;
  return compressHoldGroupsToSegments(groups).map((seg) =>
    formatShapingSegment(seg.stitchCount, 2, seg.repeatCount),
  );
}

/** One-side JP shaping lines (excludes center). Shallow: Xs-2r-Nx hold segments; deep: stairs + singles. */
export function roundNeckPlanOneSideNeckEdgeJpLines(
  plan: RoundNecklinePlanResult | RoundNecklineShapingResult,
  side: RoundNeckPlanSide = "right",
): string[] {
  if (isShallowHoldRoundPlan(plan)) {
    return roundNeckPlanHoldGroupsJpLines(plan, side);
  }

  const { stairSteps, singleDecreaseCount } = sidePlan(plan, side);
  const lines: string[] = [];
  for (const amount of stairSteps) {
    if (amount > 0) {
      lines.push(formatShapingSegment(amount, 2, 1));
    }
  }
  if (singleDecreaseCount > 0) {
    lines.push(formatShapingSegment(1, 2, singleDecreaseCount));
  }
  return lines;
}

/** Full one-side JP block: center hold/bind-off + edge shaping lines. */
export function roundNeckPlanOneSideFullJpLines(
  plan: RoundNecklinePlanResult | RoundNecklineShapingResult,
  side: RoundNeckPlanSide = "right",
): string[] {
  const center = plan.centerBindOff;
  const shaping = roundNeckPlanOneSideNeckEdgeJpLines(plan, side);
  const centerToken = isShallowHoldRoundPlan(plan)
    ? formatHoldNotation(center)
    : center > 0
      ? `bo${center}`
      : "";
  return [centerToken, ...shaping].filter(Boolean);
}

/** Back piece: both neck edges shaped together (drop-shoulder / full-width back). */
export function roundNeckBackBothEdgesWrittenLines(
  plan: RoundNecklinePlanResult | RoundNecklineShapingResult,
): string[] {
  if (!isShallowHoldRoundPlan(plan)) {
    return roundNeckPlanOneSideNeckEdgeWrittenLines(plan, "right");
  }

  const leftLines = roundNeckPlanOneSideNeckEdgeWrittenLines(plan, "left");
  const rightLines = roundNeckPlanOneSideNeckEdgeWrittenLines(plan, "right");
  if (leftLines.join("\n") === rightLines.join("\n")) {
    return leftLines.map((l) => l.replace("At the neck edge", "At each neck edge"));
  }
  return [
    ...leftLines.map((l) => l.replace("At the neck edge", "At the left neck edge")),
    ...rightLines.map((l) => l.replace("At the neck edge", "At the right neck edge")),
  ];
}

/** Cardigan CF edge: combined hold groups from both sides of the full shallow/deep plan. */
export function roundNeckCardiganCfEdgeWrittenLines(
  plan: RoundNecklinePlanResult | RoundNecklineShapingResult,
): string[] {
  if (isShallowHoldRoundPlan(plan)) {
    const combined = [...plan.left.holdGroups];
    for (let i = 0; i < plan.right.holdGroups.length; i++) {
      combined[i] = (combined[i] ?? 0) + (plan.right.holdGroups[i] ?? 0);
    }
    const trimmed = combined.filter((g) => g > 0);
    if (trimmed.length === 0) return [];
    return compressHoldGroupsToSegments(trimmed).map((seg) =>
      holdSegmentWrittenLine(seg.stitchCount, seg.repeatCount, "the neck edge"),
    );
  }
  return roundNeckPlanOneSideNeckEdgeWrittenLines(plan, "right");
}

/** @deprecated Use {@link roundNeckPlanOneSideNeckEdgeWrittenLines}. */
export const roundNeckPlanOneSideBackNeckEdgeWrittenLines = roundNeckPlanOneSideNeckEdgeWrittenLines;

/** @deprecated Use {@link roundNeckPlanOneSideNeckEdgeJpLines}. */
export const roundNeckPlanOneSideBackNeckEdgeJpLines = roundNeckPlanOneSideNeckEdgeJpLines;

/** @deprecated Use {@link roundNeckPlanOneSideFullJpLines}. */
export const roundNeckPlanOneSideBackFullJpLines = roundNeckPlanOneSideFullJpLines;
