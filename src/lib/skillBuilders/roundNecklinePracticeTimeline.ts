import { isShallowHoldRoundPlan, type RoundNecklineShapingResult } from "../patterns/legoBlocks/roundNeckline";
import type { RoundNecklinePracticeResult } from "./roundNecklinePractice";

export type RoundNecklinePracticeTimelinePhase =
  | "body-even"
  | "center-bind-off"
  | "neck-shaping"
  | "shoulder-even"
  | "shoulder-bind-off";

export type RoundNecklinePracticeTimelineEntry = {
  absoluteRow: number;
  neckZoneRow?: number;
  phase: RoundNecklinePracticeTimelinePhase;
  label: string;
};

export type RoundNecklinePracticeRowAccounting = {
  timeline: RoundNecklinePracticeTimelineEntry[];
  bodyRows: number;
  neckZoneRows: number;
  neckShapingRowsCounted: number;
  shoulderEvenRows: number;
  totalKnittedRows: number;
  japaneseNotationChecks: string[];
  validationLines: string[];
};

const SHAPING_SEGMENT_PATTERN = /^(\d+)s-(\d+)r-(\d+)x$/;
const BIND_OFF_PATTERN = /^bo(\d+)$/i;
const HOLD_PATTERN = /^hold(\d+)$/i;

/** Inner-neck row span after center (matches `neckInnerRowSpanForPlan` in shapingTimeline). */
function neckInnerRowSpan(plan: RoundNecklineShapingResult): number {
  const stairRowCount = Math.max(plan.left.stairSteps.length, plan.right.stairSteps.length);
  if (isShallowHoldRoundPlan(plan)) {
    const maxHold = Math.max(plan.left.holdGroups.length, plan.right.holdGroups.length);
    return stairRowCount + (maxHold > 0 ? 2 * maxHold - 1 : 0);
  }
  const maxSingles = Math.max(plan.left.singleDecreaseCount, plan.right.singleDecreaseCount);
  return stairRowCount + (maxSingles > 0 ? 2 * maxSingles - 1 : 0);
}

/**
 * One-side neck-edge label for inner row index `i` (post-center).
 * Mirrors `backInnerNeckRow` in shapingTimeline for the working (right) side only.
 */
function oneSideInnerNeckRowLabel(
  plan: RoundNecklineShapingResult,
  side: "left" | "right",
  i: number,
  innerSpan: number,
): string {
  const sidePlan = side === "right" ? plan.right : plan.left;
  const stairRowCount = sidePlan.stairSteps.length;
  const shallowHold = isShallowHoldRoundPlan(plan);

  if (i >= innerSpan) {
    return "Even";
  }
  if (i < stairRowCount) {
    const amount = sidePlan.stairSteps[i] ?? 0;
    if (amount <= 0) return "Even";
    if (shallowHold) return `Hold ${amount}`;
    return `Bind off ${amount}`;
  }

  const j = i - stairRowCount;
  if (j % 2 !== 0) {
    return "Even";
  }

  const si = j / 2;
  if (shallowHold) {
    const amount = sidePlan.holdGroups[si] ?? 0;
    return amount > 0 ? `Hold ${amount}` : "Even";
  }
  return si < sidePlan.singleDecreaseCount ? "Decrease 1" : "Even";
}

function isShapingActionLabel(label: string): boolean {
  return (
    label.startsWith("Bind off ") ||
    label.startsWith("Decrease ") ||
    label.startsWith("Hold ")
  );
}

/**
 * Expand the skill-builder knitting sequence into absolute row numbers.
 * Uses the same post-center inner-row indexing as drop-shoulder front round-neck timelines.
 */
export function expandRoundNecklinePracticeTimeline(
  result: RoundNecklinePracticeResult,
  side: "left" | "right" = "right",
): RoundNecklinePracticeTimelineEntry[] {
  const { rowsBeforeNeckline, neckDepthRows, centerBindOffStitches, leftShoulderStitches } =
    result;
  const plan = result.neckPlan;
  const innerSpan = neckInnerRowSpan(plan);
  const workRows = Math.max(0, neckDepthRows - 1);
  const neckStart = rowsBeforeNeckline + 1;

  const timeline: RoundNecklinePracticeTimelineEntry[] = [];

  if (rowsBeforeNeckline > 0) {
    timeline.push({
      absoluteRow: 1,
      phase: "body-even",
      label:
        rowsBeforeNeckline === 1
          ? "Knit even"
          : `Rows 1-${rowsBeforeNeckline}: Knit even`,
    });
  }

  timeline.push({
    absoluteRow: neckStart,
    neckZoneRow: 1,
    phase: "center-bind-off",
    label: isShallowHoldRoundPlan(plan)
      ? `Hold ${centerBindOffStitches} (center)`
      : `Bind off ${centerBindOffStitches} (center)`,
  });

  for (let i = 0; i < workRows; i += 1) {
    const absoluteRow = neckStart + 1 + i;
    const neckZoneRow = 2 + i;
    const label = oneSideInnerNeckRowLabel(plan, side, i, innerSpan);
    timeline.push({
      absoluteRow,
      neckZoneRow,
      phase: isShapingActionLabel(label) ? "neck-shaping" : "shoulder-even",
      label,
    });
  }

  const shoulderEvenStart = neckStart + 1 + innerSpan;
  const shoulderEvenEnd = neckStart + neckDepthRows - 1;
  if (shoulderEvenStart <= shoulderEvenEnd) {
    const first = timeline.find((entry) => entry.absoluteRow === shoulderEvenStart);
    if (first && first.label === "Even") {
      first.label =
        shoulderEvenStart === shoulderEvenEnd
          ? "Even"
          : `Rows ${shoulderEvenStart}-${shoulderEvenEnd}: Knit even`;
      for (let row = shoulderEvenStart + 1; row <= shoulderEvenEnd; row += 1) {
        const idx = timeline.findIndex((entry) => entry.absoluteRow === row);
        if (idx >= 0) timeline.splice(idx, 1);
      }
    }
  }

  timeline.push({
    absoluteRow: neckStart + neckDepthRows,
    phase: "shoulder-bind-off",
    label: `Bind off ${leftShoulderStitches} shoulder stitches`,
  });

  return timeline;
}

function parseJapaneseNotationLines(
  lines: readonly string[],
  shallowHold: boolean,
): {
  centerAmount: number;
  centerIsHold: boolean;
  stairBindOffSegments: { stitches: number; times: number }[];
  singleDecreaseTimes: number;
  holdSegments: { stitches: number; times: number }[];
} {
  let centerAmount = 0;
  let centerIsHold = false;
  const stairBindOffSegments: { stitches: number; times: number }[] = [];
  const holdSegments: { stitches: number; times: number }[] = [];
  let singleDecreaseTimes = 0;

  for (const raw of lines) {
    const line = raw.trim();
    const boMatch = line.match(BIND_OFF_PATTERN);
    if (boMatch) {
      centerAmount = Number(boMatch[1]);
      continue;
    }
    const holdMatch = line.match(HOLD_PATTERN);
    if (holdMatch) {
      centerAmount = Number(holdMatch[1]);
      centerIsHold = true;
      continue;
    }
    const segMatch = line.match(SHAPING_SEGMENT_PATTERN);
    if (!segMatch) continue;
    const stitches = Number(segMatch[1]);
    const times = Number(segMatch[3]);
    if (shallowHold) {
      holdSegments.push({ stitches, times });
    } else if (stitches === 1) {
      singleDecreaseTimes += times;
    } else {
      stairBindOffSegments.push({ stitches, times });
    }
  }

  return {
    centerAmount,
    centerIsHold,
    stairBindOffSegments,
    singleDecreaseTimes,
    holdSegments,
  };
}

/** Verify JP tokens, written lines, and expanded timeline describe the same schedule. */
export function validateRoundNecklinePracticeRowAccounting(
  result: RoundNecklinePracticeResult,
): RoundNecklinePracticeRowAccounting {
  const timeline = expandRoundNecklinePracticeTimeline(result);
  const plan = result.neckPlan;
  const sidePlan = plan.right;
  const innerSpan = neckInnerRowSpan(plan);
  const shallowHold = isShallowHoldRoundPlan(plan);

  const neckShapingEntries = timeline.filter((entry) => entry.phase === "neck-shaping");
  const shoulderEvenEntries = timeline.filter(
    (entry) =>
      entry.phase === "shoulder-even" &&
      entry.neckZoneRow !== undefined &&
      entry.neckZoneRow > 1,
  );

  let shoulderEvenRows = shoulderEvenEntries.length;
  const groupedEven = shoulderEvenEntries.find((entry) => entry.label.startsWith("Rows "));
  if (groupedEven) {
    const match = /Rows (\d+)-(\d+)/.exec(groupedEven.label);
    if (match) {
      shoulderEvenRows = Number(match[2]) - Number(match[1]) + 1;
    }
  }

  const japaneseNotationChecks: string[] = [];
  const parsed = parseJapaneseNotationLines(result.japaneseNotationLines, shallowHold);

  japaneseNotationChecks.push(
    `Center token (${parsed.centerIsHold ? "hold" : "bo"}) = ${parsed.centerAmount}, plan centerBindOff = ${result.centerBindOffStitches}`,
  );

  if (shallowHold) {
    const holdTimes = parsed.holdSegments.reduce((sum, seg) => sum + seg.times, 0);
    japaneseNotationChecks.push(
      `Hold edge segments total ${holdTimes} repeats, holdGroups length = ${sidePlan.holdGroups.length}`,
    );
  } else {
    const stairTimes = parsed.stairBindOffSegments.reduce((sum, seg) => sum + seg.times, 0);
    japaneseNotationChecks.push(
      `Stair bind-off segment repeats = ${stairTimes}, stairSteps length = ${sidePlan.stairSteps.length}`,
    );
    japaneseNotationChecks.push(
      `Single-decrease segment repeats = ${parsed.singleDecreaseTimes}, singleDecreaseCount = ${sidePlan.singleDecreaseCount}`,
    );
  }

  const validationLines: string[] = [];
  validationLines.push(
    `Body rows: ${result.rowsBeforeNeckline} (instruction step 2, SVG HEIGHT / HEIGHT_TOP)`,
  );
  validationLines.push(
    `Neck zone rows: ${result.neckDepthRows} (= 1 center + ${innerSpan} inner span + ${shoulderEvenRows} even at shoulder width)`,
  );
  validationLines.push(
    `Neck shaping rows (plan rowsRequired): ${result.neckShapingRows} = 1 center + ${innerSpan} post-center inner span`,
  );
  validationLines.push(
    `Rows after final neckline shaping: ${result.rowsRemainingAfterFinalNecklineShaping} (instruction even-to-shoulder step)`,
  );
  validationLines.push(
    `Check: neckShapingRows + rowsRemaining = neckDepthRows -> ${result.neckShapingRows} + ${result.rowsRemainingAfterFinalNecklineShaping} = ${result.neckDepthRows}`,
  );
  validationLines.push(
    `Check: rowsBeforeNeckline + neckDepthRows = totalRows -> ${result.rowsBeforeNeckline} + ${result.neckDepthRows} = ${result.totalRows}`,
  );
  validationLines.push(
    `Inner span action rows: ${neckShapingEntries.filter((e) => e.neckZoneRow !== 1).length}`,
  );

  const stairMatches =
    !shallowHold &&
    parsed.stairBindOffSegments.reduce((sum, seg) => sum + seg.times, 0) ===
      sidePlan.stairSteps.length;
  const singlesMatch = !shallowHold && parsed.singleDecreaseTimes === sidePlan.singleDecreaseCount;
  const centerMatches = parsed.centerAmount === result.centerBindOffStitches;

  if (centerMatches && (shallowHold || (stairMatches && singlesMatch))) {
    validationLines.push("Japanese notation matches plan stair/single/center counts.");
  } else {
    validationLines.push("WARNING: Japanese notation counts differ from plan ù inspect tokens.");
  }

  if (result.neckShapingRows !== 1 + innerSpan) {
    validationLines.push(
      `WARNING: neckShapingRows (${result.neckShapingRows}) != 1 + innerSpan (${1 + innerSpan})`,
    );
  }

  return {
    timeline,
    bodyRows: result.rowsBeforeNeckline,
    neckZoneRows: result.neckDepthRows,
    neckShapingRowsCounted: result.neckShapingRows,
    shoulderEvenRows,
    totalKnittedRows: result.totalRows,
    japaneseNotationChecks,
    validationLines,
  };
}

export function formatRoundNecklinePracticeTimelineForSummary(
  accounting: RoundNecklinePracticeRowAccounting,
): string[] {
  const lines: string[] = ["Neck shaping timeline", ""];

  for (const entry of accounting.timeline) {
    if (entry.phase === "body-even" && entry.absoluteRow === 1) {
      lines.push(entry.label);
      continue;
    }
    if (entry.phase === "shoulder-bind-off") {
      lines.push("");
      lines.push(entry.label);
      continue;
    }
    if (entry.label.startsWith("Rows ")) {
      lines.push(entry.label);
      continue;
    }
    lines.push(`Row ${entry.absoluteRow}`);
    lines.push(entry.label);
  }

  lines.push("");
  lines.push("Row accounting validation:");
  for (const line of accounting.validationLines) {
    lines.push(`  ${line}`);
  }

  lines.push("");
  lines.push("Japanese notation vs timeline:");
  for (const line of accounting.japaneseNotationChecks) {
    lines.push(`  ${line}`);
  }

  lines.push("");
  lines.push("Inner-row convention (drop-shoulder front):");
  lines.push("  Each stair step = one post-center inner row index (one neck-edge bind-off row).");
  lines.push("  Each 1s-2r-Nx segment = N decreases on every other inner row (2N-1 inner rows).");
  lines.push(
    "  The 2r in Xs-2r-1x is the return-row spacing label, not an extra inner index per stair.",
  );

  return lines;
}
