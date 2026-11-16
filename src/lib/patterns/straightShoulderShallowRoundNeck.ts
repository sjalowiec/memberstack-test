/**
 * Straight-shoulder shallow round neckline for a full-width Drop Shoulder piece.
 *
 * Selected when the shaping plan strategy is `shallow-round`, for the back and for a
 * front whose calculated depth uses that same plan. Setup holds stay holds. Neck-edge
 * groups of 2 or more stitches are bind-offs. A 1-stitch group is a fully fashioned
 * decrease. Those actions sit on the odd local rows the timeline already uses, so the
 * carriage and working yarn are at the neck edge.
 */

import {
  compressHoldGroupsToSegments,
  type RoundNecklinePlanResult,
  type RoundNecklineShapingResult,
} from "./legoBlocks/roundNeckline";
import {
  computeShallowBackNeckNeedleLayout,
  formatCenterNeedleHoldPhraseHtml,
  formatFirstSideHoldPhraseHtml,
  formatNeedleRangeHtml,
  formatNeedleRangeThrough,
  formatStitchCountValidation,
} from "./legoBlocks/shallowBackNeckNeedleLayout";
import { formatParentheticalShapingRowNumbers, shapingActionRowNumbers } from "./evenShapingSchedule";
import { inlineRcHeadingLine, inlineSubheadingLine } from "./inlineRcHeading";

export type StraightShoulderShallowRoundNeckRc = {
  /** Local or garment RC of the setup row (center and opposite shoulder go into hold). */
  necklineStartRc: number;
  /** RC where the working shoulder is finished and scrapped or bound off. */
  shoulderCompleteRc: number;
};

/**
 * Put the larger neck-edge group on the larger shoulder section.
 * An odd center puts the extra needle on the right, which makes that shoulder smaller.
 * The edge split puts its extra stitch on the right as well. Those extras stack, so one
 * shoulder finishes short and the other finishes long. Swapping the groups cancels them.
 * Even centers already match and are left alone.
 */
export function alignShallowHoldGroupsToShoulderSections(
  bodyWidthStitches: number,
  centerHoldStitches: number,
  leftGroups: readonly number[],
  rightGroups: readonly number[],
): { leftGroups: number[]; rightGroups: number[] } {
  const left = [...leftGroups];
  const right = [...rightGroups];
  const layout = computeShallowBackNeckNeedleLayout(bodyWidthStitches, centerHoldStitches);
  const leftSection = layout.stitchCounts.leftShoulder;
  const rightSection = layout.stitchCounts.rightShoulder;
  const sum = (groups: readonly number[]) => groups.reduce((total, group) => total + group, 0);
  const leftEdge = sum(left);
  const rightEdge = sum(right);
  if (leftSection - leftEdge === rightSection - rightEdge && leftSection - leftEdge > 0) {
    return { leftGroups: left, rightGroups: right };
  }
  const swappedLeftFinish = leftSection - rightEdge;
  const swappedRightFinish = rightSection - leftEdge;
  if (swappedLeftFinish === swappedRightFinish && swappedLeftFinish > 0) {
    return { leftGroups: [...right], rightGroups: [...left] };
  }
  return { leftGroups: left, rightGroups: right };
}

function formatRcLabel(rc: number): string {
  return `RC: ${String(Math.max(0, Math.floor(rc))).padStart(3, "0")}`;
}

function repeatTimes(count: number): string {
  return `${count} time${count === 1 ? "" : "s"}`;
}

function neckEdgeBullet(stitchCount: number, repeatCount: number, firstActionRc: number | undefined): string {
  const times = repeatTimes(repeatCount);
  const line =
    stitchCount <= 1
      ? `• Decrease 1 stitch at the neck edge, fully fashioned, every other row ${times}.`
      : `• Bind off ${stitchCount} stitches every other row ${times}.`;
  if (firstActionRc === undefined) return line;
  return `${line} ${formatParentheticalShapingRowNumbers(
    shapingActionRowNumbers(firstActionRc, repeatCount, 2),
  )}`;
}

function sideShapingLines(
  groups: readonly number[],
  necklineStartRc: number | undefined,
): string[] {
  const segments = compressHoldGroupsToSegments(groups);
  if (segments.length === 0) {
    return ["Knit this shoulder with no neck-edge shaping."];
  }
  const lines: string[] = [
    "At the neck edge, with the carriage and the working yarn there, work each action below before knitting that row:",
  ];
  let actionRc = necklineStartRc === undefined ? undefined : necklineStartRc + 1;
  for (const segment of segments) {
    if (actionRc !== undefined && necklineStartRc !== undefined && actionRc !== necklineStartRc) {
      lines.push(inlineRcHeadingLine(formatRcLabel(actionRc)));
    }
    lines.push(neckEdgeBullet(segment.stitchCount, segment.repeatCount, actionRc));
    if (actionRc !== undefined) actionRc += 2 * segment.repeatCount;
  }
  return lines;
}

function shoulderCompleteLines(
  orderLabel: "first" | "second",
  rc: StraightShoulderShallowRoundNeckRc | undefined,
): string[] {
  if (!rc) return [`The ${orderLabel} shoulder is complete.`];
  return [
    inlineRcHeadingLine(formatRcLabel(rc.shoulderCompleteRc)),
    `The ${orderLabel} shoulder is complete.`,
  ];
}

/**
 * RIGHT SIDE / LEFT SIDE instructions for one full-width straight-shoulder shallow round neck.
 * The same lines are the back and a front whose plan strategy is `shallow-round`.
 */
export function straightShoulderShallowRoundNeckWrittenLines(
  plan: RoundNecklinePlanResult | RoundNecklineShapingResult,
  bodyWidthStitches: number,
  rc?: StraightShoulderShallowRoundNeckRc,
): string[] {
  const aligned = alignShallowHoldGroupsToShoulderSections(
    bodyWidthStitches,
    plan.centerBindOff,
    plan.left.holdGroups,
    plan.right.holdGroups,
  );
  const layout = computeShallowBackNeckNeedleLayout(bodyWidthStitches, plan.centerBindOff);
  const { stitchCounts: counts } = layout;
  const centerRangeHtml = formatCenterNeedleHoldPhraseHtml(layout);
  const leftWorkRangeHtml = formatNeedleRangeHtml(
    formatNeedleRangeThrough(layout.leftShoulder.start, layout.leftShoulder.end),
  );
  const rightWorkRangeHtml = formatNeedleRangeHtml(
    formatNeedleRangeThrough(layout.rightShoulder.start, layout.rightShoulder.end),
  );
  const carriageAtShoulder =
    "Before knitting this row, the carriage is at the shoulder edge. After this row, the carriage is at the neck edge.";
  const resetLine =
    rc !== undefined
      ? [`Reset the row counter to ${formatRcLabel(rc.necklineStartRc)}.`, "Place the carriage at the shoulder edge."]
      : ["Place the carriage at the shoulder edge."];

  return [
    inlineSubheadingLine("RIGHT SIDE"),
    "",
    `Put needles ${formatFirstSideHoldPhraseHtml(layout)} into hold${formatStitchCountValidation(counts.firstSideHold)}.`,
    `Work needles ${rightWorkRangeHtml}${formatStitchCountValidation(counts.rightShoulder)}.`,
    carriageAtShoulder,
    ...sideShapingLines(aligned.rightGroups, rc?.necklineStartRc),
    "",
    ...shoulderCompleteLines("first", rc),
    "Scrap off or bind off the remaining shoulder stitches.",
    "Break yarn and move the carriage to the opposite side.",
    ...resetLine,
    "",
    inlineSubheadingLine("LEFT SIDE"),
    "",
    `Return needles ${leftWorkRangeHtml} to working position${formatStitchCountValidation(counts.leftShoulder)}.`,
    `Leave center neckline needles ${centerRangeHtml} in hold${formatStitchCountValidation(counts.center)}.`,
    `Work needles ${leftWorkRangeHtml}.`,
    carriageAtShoulder,
    ...sideShapingLines(aligned.leftGroups, rc?.necklineStartRc),
    "",
    ...shoulderCompleteLines("second", rc),
    "Scrap off or bind off the remaining shoulder stitches.",
    "Scrap off or bind off the center neckline stitches left in hold.",
  ];
}
