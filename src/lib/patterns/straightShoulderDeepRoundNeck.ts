/**
 * Straight-shoulder deep round neckline for a full-width Drop Shoulder front
 * whose neckline starts on the same row as the armhole marker.
 *
 * Uses the deep-round stitch plan unchanged. Neck-edge bind-offs and fully
 * fashioned decreases are on the odd rows, when the carriage and yarn are at
 * the neck. The center is bound off on the setup row. The opposite shoulder
 * is held. Shoulders stay straight.
 */

import {
  compressHoldGroupsToSegments,
  type RoundNecklinePlanResult,
  type RoundNecklineSidePlan,
} from "./legoBlocks/roundNeckline";
import {
  computeShallowBackNeckNeedleLayout,
  formatCenterNeedleHoldPhraseHtml,
  formatNeedleRangeHtml,
  formatNeedleRangeThrough,
  formatStitchCountValidation,
} from "./legoBlocks/shallowBackNeckNeedleLayout";
import { formatParentheticalShapingRowNumbers, shapingActionRowNumbers } from "./evenShapingSchedule";
import { inlineRcHeadingLine, inlineSubheadingLine } from "./inlineRcHeading";

export type StraightShoulderDeepRoundNeckRc = {
  necklineStartRc: number;
  shoulderCompleteRc: number;
};

export function dropShoulderDeepRoundStartsWithArmhole(args: {
  isCardigan: boolean;
  isVNeck: boolean;
  strategy: string | undefined;
  necklineStartRc: number;
  armholeMarkerRc: number;
}): boolean {
  return (
    !args.isCardigan &&
    !args.isVNeck &&
    args.strategy === "deep-round" &&
    args.necklineStartRc === args.armholeMarkerRc
  );
}

function formatRcLabel(rc: number): string {
  return `RC: ${String(Math.max(0, Math.floor(rc))).padStart(3, "0")}`;
}

function sideRemoval(side: RoundNecklineSidePlan): number {
  return side.stairSteps.reduce((sum, step) => sum + step, 0) + side.singleDecreaseCount;
}

function repeatTimes(count: number): string {
  return `${count} time${count === 1 ? "" : "s"}`;
}

function shapingBullet(stitchCount: number, repeatCount: number, firstActionRc: number): string {
  const times = repeatTimes(repeatCount);
  const line =
    stitchCount <= 1
      ? `• Decrease 1 stitch at the neck edge, fully fashioned, every other row ${times}.`
      : `• Bind off ${stitchCount} stitches every other row ${times}.`;
  return `${line} ${formatParentheticalShapingRowNumbers(shapingActionRowNumbers(firstActionRc, repeatCount, 2))}`;
}

/** Odd local rows: neckline start + 1, + 3, + 5… The carriage starts those rows at the neck. */
export function deepNeckEdgeActionRcs(necklineStartRc: number, actionCount: number): number[] {
  return shapingActionRowNumbers(necklineStartRc + 1, actionCount, 2);
}

function sideShapingLines(side: RoundNecklineSidePlan, necklineStartRc: number): { lines: string[]; lastActionRc: number | undefined } {
  const stairs = compressHoldGroupsToSegments(side.stairSteps);
  const lines: string[] = [
    "At the neck edge, with the carriage and the working yarn there, work each action below before knitting that row:",
  ];
  let actionRc = necklineStartRc + 1;
  let lastActionRc: number | undefined;
  for (const segment of stairs) {
    lines.push(inlineRcHeadingLine(formatRcLabel(actionRc)));
    lines.push(shapingBullet(segment.stitchCount, segment.repeatCount, actionRc));
    lastActionRc = actionRc + 2 * (segment.repeatCount - 1);
    actionRc += 2 * segment.repeatCount;
  }
  if (side.singleDecreaseCount > 0) {
    lines.push(inlineRcHeadingLine(formatRcLabel(actionRc)));
    lines.push(shapingBullet(1, side.singleDecreaseCount, actionRc));
    lastActionRc = actionRc + 2 * (side.singleDecreaseCount - 1);
  }
  if (stairs.length === 0 && side.singleDecreaseCount === 0) {
    return { lines: ["Knit this shoulder with no neck-edge shaping."], lastActionRc: undefined };
  }
  return { lines, lastActionRc };
}

function knitEvenLines(remain: number, lastActionRc: number | undefined, shoulderRc: number): string[] {
  const remainText = `${remain} stitch${remain === 1 ? "" : "es"} remain on the working shoulder`;
  if (lastActionRc === undefined || shoulderRc <= lastActionRc) {
    return [`After neckline shaping, ${remainText}.`];
  }
  return [
    `After neckline shaping, ${remainText}. Knit even to ${formatRcLabel(shoulderRc)}. No further neck-edge shaping.`,
  ];
}

/**
 * RIGHT SIDE / LEFT SIDE instructions. The caller places the armhole marker and
 * the row-counter reset on the shared garment row before these lines.
 */
export function straightShoulderDeepRoundNeckWrittenLines(
  plan: RoundNecklinePlanResult,
  bodyWidthStitches: number,
  rc: StraightShoulderDeepRoundNeckRc,
): string[] {
  const layout = computeShallowBackNeckNeedleLayout(bodyWidthStitches, plan.centerBindOff);
  const { stitchCounts: counts } = layout;
  const centerRangeHtml = formatCenterNeedleHoldPhraseHtml(layout);
  const leftRangeHtml = formatNeedleRangeHtml(
    formatNeedleRangeThrough(layout.leftShoulder.start, layout.leftShoulder.end),
  );
  const rightRangeHtml = formatNeedleRangeHtml(
    formatNeedleRangeThrough(layout.rightShoulder.start, layout.rightShoulder.end),
  );
  const rightRemain = counts.rightShoulder - sideRemoval(plan.right);
  const leftRemain = counts.leftShoulder - sideRemoval(plan.left);
  const rightShaping = sideShapingLines(plan.right, rc.necklineStartRc);
  const leftShaping = sideShapingLines(plan.left, rc.necklineStartRc);
  const carriageAtShoulder =
    "Before knitting this row, the carriage is at the shoulder edge. After this row, the carriage is at the neck edge.";
  const centerStart = layout.center.start;

  return [
    inlineSubheadingLine("RIGHT SIDE"),
    "",
    `Put needles ${leftRangeHtml} into hold${formatStitchCountValidation(counts.leftShoulder)}.`,
    `Bind off center neckline needles ${centerRangeHtml}${formatStitchCountValidation(counts.center)}. Start this bind-off with the carriage and the working yarn at ${centerStart}. Bind off through ${layout.center.end}. These center stitches are removed from work and finished. The yarn finishes at the neck edge of the working shoulder.`,
    "Place the carriage at the shoulder edge without knitting a row.",
    `Work needles ${rightRangeHtml}${formatStitchCountValidation(counts.rightShoulder)}.`,
    carriageAtShoulder,
    ...rightShaping.lines,
    "",
    ...knitEvenLines(rightRemain, rightShaping.lastActionRc, rc.shoulderCompleteRc),
    inlineRcHeadingLine(formatRcLabel(rc.shoulderCompleteRc)),
    "The first shoulder is complete.",
    "Scrap off or bind off the remaining shoulder stitches.",
    "Break the yarn.",
    `Reset the row counter to ${formatRcLabel(rc.necklineStartRc)}.`,
    "Place the carriage at the shoulder edge without knitting a row.",
    "Attach the yarn at the neck edge.",
    "",
    inlineSubheadingLine("LEFT SIDE"),
    "",
    `Return needles ${leftRangeHtml} to working position${formatStitchCountValidation(counts.leftShoulder)}.`,
    "The center neckline stitches are already bound off.",
    `Work needles ${leftRangeHtml}.`,
    carriageAtShoulder,
    ...leftShaping.lines,
    "",
    ...knitEvenLines(leftRemain, leftShaping.lastActionRc, rc.shoulderCompleteRc),
    inlineRcHeadingLine(formatRcLabel(rc.shoulderCompleteRc)),
    "The second shoulder is complete.",
    "Scrap off or bind off the remaining shoulder stitches.",
  ];
}
