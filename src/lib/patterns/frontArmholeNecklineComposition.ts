/**
 * Front pullover V-neck composition: merge independent armhole and neckline
 * schedules on garment RC. Geometry still uses finished B. After the V divide,
 * each half is tracked separately.
 */

import { shapingActionRowNumbers } from "./evenShapingSchedule";
import { vNeckDivideSideStartsFromLiveStitches } from "./legoBlocks/vNeckline";
import type { RowEntry, ShapingEvent } from "./shapingTimeline";

export type FrontArmholeEvent = {
  garmentRc: number;
  kind: "bindOff" | "decrease";
  /** Which half owns this outer-edge event. */
  side: "left" | "right";
  amount: number;
};

export type FrontArmholeNecklineOverlap = {
  divideGarmentRc: number;
  firstArmholeGarmentRc: number;
  necklineBeginsBeforeArmhole: boolean;
  /** Full-Front live stitches at the divide, before same-row half events. */
  liveTotalAtDivide: number;
  leftAtDivide: number;
  rightAtDivide: number;
  /** Left (held) count after same-row events on the divide garment RC. */
  heldAfterDivideRow: number;
  /** Right (active) count after same-row events on the divide garment RC. */
  activeAfterDivideRow: number;
  completedDecreaseLocalRcs: number[];
  remainingDecreaseLocalRcs: number[];
  completedDecreaseSts: number;
  remainingDecreaseSts: number;
  /** Last garment RC that still carries an Armhole (not Shoulder) outer event. */
  lastArmholeGarmentRc: number;
  stitchesAfterArmhole: number;
};

export type ComposeFrontVNeckArmholeOverlapInput = {
  firstArmholeGarmentRc: number;
  armholeStartSts: number;
  bindOffSts: number;
  decreaseSts: number;
  stitchesAfterArmhole: number;
};

/** Armhole-local RCs for every-other-row decreases starting at RC 002. */
export function armholeDecreaseLocalRcs(decreaseSts: number): number[] {
  return shapingActionRowNumbers(2, decreaseSts, 2);
}

/**
 * Full-width Front live count after armhole events with garment RC **strictly before**
 * `beforeGarmentRc`. Same-row events are not included (divide happens first on that row).
 */
export function liveFrontStitchesBeforeGarmentRc(args: {
  armholeStartSts: number;
  bindOffSts: number;
  decreaseSts: number;
  firstArmholeGarmentRc: number;
  beforeGarmentRc: number;
}): number {
  const events = pulloverArmholeEvents({
    firstArmholeGarmentRc: args.firstArmholeGarmentRc,
    bindOffSts: args.bindOffSts,
    decreaseSts: args.decreaseSts,
  });
  let sts = Math.max(0, Math.floor(args.armholeStartSts));
  const before = Math.floor(args.beforeGarmentRc);
  for (const ev of events) {
    if (ev.garmentRc >= before) break;
    sts -= ev.amount;
  }
  return Math.max(0, sts);
}

/** Display RC: garment number before the armhole reset, Armhole-local after. */
export function displayRcFromGarmentRc(
  garmentRc: number,
  firstArmholeGarmentRc: number,
): number {
  const g = Math.floor(garmentRc);
  const a = Math.floor(firstArmholeGarmentRc);
  if (!Number.isFinite(g) || !Number.isFinite(a)) return Math.max(0, g);
  return g < a ? g : g - a;
}

/** Pullover V-neck Front written-instruction timing (presentation only). */
export type FrontVNeckShapingTimingCase =
  | "after-armhole"
  | "during-armhole"
  | "with-armhole"
  | "before-armhole";

export function resolveFrontVNeckShapingTimingCase(
  overlap: FrontArmholeNecklineOverlap | null | undefined,
): FrontVNeckShapingTimingCase {
  if (!overlap) return "after-armhole";
  const divide = Math.floor(overlap.divideGarmentRc);
  const armhole = Math.floor(overlap.firstArmholeGarmentRc);
  if (overlap.necklineBeginsBeforeArmhole || divide < armhole) return "before-armhole";
  if (divide <= armhole) return "with-armhole";
  return "during-armhole";
}

export const FRONT_VNECK_HANDOFF_AFTER_ARMHOLE = "Begin V-neck shaping.";

export const FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST =
  "Follow the First Shoulder and Second Shoulder checklists below for the exact row-by-row sequence.";

export const FRONT_VNECK_HANDOFF_DURING_ARMHOLE =
  "Begin V-neck shaping. Continue the armhole shaping at the outside edge.";

export const FRONT_VNECK_HANDOFF_WITH_ARMHOLE = "Begin V-neck and armhole shaping.";

export const FRONT_VNECK_HANDOFF_BEFORE_ARMHOLE = "Begin V-neck shaping.";

export const FRONT_VNECK_ARMHOLE_BEGINS_WHILE_VNECK_CONTINUES =
  "Begin armhole shaping at the outside edge. Continue V-neck shaping.";

/** Page/checklist flags derived from the existing overlap record. */
export function sleevelessFrontVNeckWrittenPathPresentation(
  overlap: FrontArmholeNecklineOverlap | null | undefined,
): {
  timing: FrontVNeckShapingTimingCase;
  checklistPrimary: boolean;
  checklistDefaultOpen: boolean;
  visualGuidesAfterChecklist: boolean;
} {
  const timing = resolveFrontVNeckShapingTimingCase(overlap);
  const overlapCase = timing !== "after-armhole";
  return {
    timing,
    checklistPrimary: overlapCase,
    checklistDefaultOpen: overlapCase,
    visualGuidesAfterChecklist: overlapCase,
  };
}

/**
 * User-facing RC where the knitter begins the V-neck: the divide/setup event.
 * Never the later first Neck decrease ({@link FrontArmholeNecklineOverlap} does not store that).
 * Case 4 returns the garment divide RC; Cases 1–3 return the post-reset / local RC.
 */
export function sleevelessPulloverVNeckBeginDisplayRc(args: {
  overlap?: FrontArmholeNecklineOverlap | null;
  frontNecklineStartLocalRC?: number;
  frontNecklineCenterDivideLocalRC?: number;
}): number | undefined {
  if (args.overlap) {
    return displayRcFromGarmentRc(
      args.overlap.divideGarmentRc,
      args.overlap.firstArmholeGarmentRc,
    );
  }
  const center = args.frontNecklineCenterDivideLocalRC;
  if (center !== undefined && Number.isFinite(center)) {
    return Math.floor(center);
  }
  const start = args.frontNecklineStartLocalRC;
  if (start !== undefined && Number.isFinite(start) && start >= 0) {
    return Math.floor(start);
  }
  return undefined;
}

export function pulloverArmholeEvents(args: {
  firstArmholeGarmentRc: number;
  bindOffSts: number;
  decreaseSts: number;
}): FrontArmholeEvent[] {
  const start = Math.floor(args.firstArmholeGarmentRc);
  const bo = Math.max(0, Math.floor(args.bindOffSts));
  const out: FrontArmholeEvent[] = [];
  if (bo > 0) {
    out.push({ garmentRc: start, kind: "bindOff", side: "right", amount: bo });
    out.push({ garmentRc: start + 1, kind: "bindOff", side: "left", amount: bo });
  }
  for (const local of armholeDecreaseLocalRcs(args.decreaseSts)) {
    out.push({ garmentRc: start + local, kind: "decrease", side: "right", amount: 1 });
    out.push({ garmentRc: start + local, kind: "decrease", side: "left", amount: 1 });
  }
  return out;
}

export function timelineHasOverlappingArmholeDecreases(timeline: readonly RowEntry[]): boolean {
  return timeline.some((entry) =>
    entry.events.some(
      (ev) => ev.edge === "outer" && ev.kind === "decrease" && ev.amount > 0,
    ),
  );
}

export function timelineHasComposedArmholeOverlap(timeline: readonly RowEntry[]): boolean {
  if (timelineHasOverlappingArmholeDecreases(timeline)) return true;
  const first = [...timeline].sort((a, b) => a.row - b.row)[0];
  if (!first) return false;
  return first.events.some(
    (ev) => ev.edge === "outer" && ev.kind === "bindOff" && ev.amount > 0,
  );
}

function eventsForGarmentRc(
  events: readonly FrontArmholeEvent[],
  garmentRc: number,
): FrontArmholeEvent[] {
  return events.filter((e) => e.garmentRc === garmentRc);
}

function rebuildCountsFromLiveDivide(
  timeline: readonly RowEntry[],
  liveTotalAtDivide: number,
  remainingArmholeEvents: readonly FrontArmholeEvent[],
): RowEntry[] {
  const { left: leftStart, right: rightStart } =
    vNeckDivideSideStartsFromLiveStitches(liveTotalAtDivide);
  const centerStitchGap = liveTotalAtDivide % 2;

  let leftOuterEdge = 1;
  let leftInnerEdge = leftStart;
  let rightInnerEdge = leftInnerEdge + centerStitchGap + 1;
  let rightOuterEdge = rightInnerEdge + rightStart - 1;
  let leftCount = leftStart;
  let rightCount = rightStart;

  return timeline.map((entry) => {
    const events: ShapingEvent[] = entry.events
      .filter((e) => !(e.edge === "outer" && e.kind === "decrease"))
      .map((e) => ({ ...e }));

    for (const ev of eventsForGarmentRc(remainingArmholeEvents, entry.row)) {
      events.push({
        kind: ev.kind,
        side: ev.side,
        edge: "outer",
        amount: ev.amount,
      });
    }

    const startL = leftCount;
    const startR = rightCount;

    for (const e of events) {
      if (e.amount <= 0) continue;
      if (e.edge === "inner" && (e.kind === "decrease" || e.kind === "bindOff" || e.kind === "hold")) {
        if (e.side === "left") {
          leftInnerEdge -= e.amount;
          leftCount -= e.amount;
        } else if (e.side === "right") {
          rightInnerEdge += e.amount;
          rightCount -= e.amount;
        }
      } else if (e.edge === "outer" && (e.kind === "decrease" || e.kind === "bindOff")) {
        if (e.side === "left") {
          leftOuterEdge += e.amount;
          leftCount -= e.amount;
        } else if (e.side === "right") {
          rightOuterEdge -= e.amount;
          rightCount -= e.amount;
        }
      }
    }

    leftCount = Math.max(0, leftCount);
    rightCount = Math.max(0, rightCount);

    return {
      ...entry,
      events,
      stitchesL: leftCount,
      stitchesR: rightCount,
      netChangeL: leftCount - startL,
      netChangeR: rightCount - startR,
      isSplit: true,
      centerWidth: rightInnerEdge - leftInnerEdge - 1,
      leftOuterEdge,
      leftInnerEdge,
      rightInnerEdge,
      rightOuterEdge,
    };
  });
}

/**
 * Merge leftover armhole events onto the V-neck timeline by garment RC.
 * Returns the original timeline when every armhole event is already finished
 * before the divide (shallow neck).
 */
export function composeFrontVNeckTimelineWithArmholeOverlap(
  timeline: readonly RowEntry[],
  input: ComposeFrontVNeckArmholeOverlapInput,
): { timeline: RowEntry[]; overlap: FrontArmholeNecklineOverlap | null } {
  if (timeline.length === 0) {
    return { timeline: [...timeline], overlap: null };
  }

  const firstArmhole = Math.floor(input.firstArmholeGarmentRc);
  const first = [...timeline].sort((a, b) => a.row - b.row)[0];
  if (!first || !Number.isFinite(firstArmhole)) {
    return { timeline: [...timeline], overlap: null };
  }

  const divideGarmentRc = Math.floor(first.row);
  const allArmhole = pulloverArmholeEvents({
    firstArmholeGarmentRc: firstArmhole,
    bindOffSts: input.bindOffSts,
    decreaseSts: input.decreaseSts,
  });
  const remainingArmhole = allArmhole.filter((e) => e.garmentRc >= divideGarmentRc);
  if (remainingArmhole.length === 0) {
    return { timeline: [...timeline], overlap: null };
  }

  const liveTotalAtDivide = liveFrontStitchesBeforeGarmentRc({
    armholeStartSts: input.armholeStartSts,
    bindOffSts: input.bindOffSts,
    decreaseSts: input.decreaseSts,
    firstArmholeGarmentRc: firstArmhole,
    beforeGarmentRc: divideGarmentRc,
  });
  const sides = vNeckDivideSideStartsFromLiveStitches(liveTotalAtDivide);
  const timelineWithArmholeRows = insertMissingGarmentRows(
    timeline,
    remainingArmhole.map((e) => e.garmentRc),
  );
  const composed = rebuildCountsFromLiveDivide(
    timelineWithArmholeRows,
    liveTotalAtDivide,
    remainingArmhole,
  );
  const divideRow = composed.find((e) => e.row === divideGarmentRc) ?? composed[0]!;

  const decLocals = armholeDecreaseLocalRcs(input.decreaseSts);
  const completedDecreaseLocalRcs = decLocals.filter((rc) => firstArmhole + rc < divideGarmentRc);
  const remainingDecreaseLocalRcs = decLocals.filter((rc) => firstArmhole + rc >= divideGarmentRc);

  return {
    timeline: composed,
    overlap: {
      divideGarmentRc,
      firstArmholeGarmentRc: firstArmhole,
      necklineBeginsBeforeArmhole: divideGarmentRc < firstArmhole,
      liveTotalAtDivide,
      leftAtDivide: sides.left,
      rightAtDivide: sides.right,
      heldAfterDivideRow: Math.max(0, Math.floor(divideRow.stitchesL)),
      activeAfterDivideRow: Math.max(0, Math.floor(divideRow.stitchesR)),
      completedDecreaseLocalRcs,
      remainingDecreaseLocalRcs,
      completedDecreaseSts: completedDecreaseLocalRcs.length,
      remainingDecreaseSts: remainingDecreaseLocalRcs.length,
      lastArmholeGarmentRc: Math.max(...remainingArmhole.map((e) => e.garmentRc)),
      stitchesAfterArmhole: Math.round(input.stitchesAfterArmhole),
    },
  };
}

function insertMissingGarmentRows(
  timeline: readonly RowEntry[],
  garmentRcs: readonly number[],
): RowEntry[] {
  const sorted = [...timeline].sort((a, b) => a.row - b.row);
  const have = new Set(sorted.map((e) => e.row));
  const extra = [...new Set(garmentRcs)]
    .filter((rc) => Number.isFinite(rc) && !have.has(rc))
    .sort((a, b) => a - b);
  if (extra.length === 0) return sorted;
  const first = sorted[0];
  if (!first) return sorted;
  for (const rc of extra) {
    const prev = [...sorted].reverse().find((e) => e.row < rc) ?? first;
    sorted.push({
      ...prev,
      row: rc,
      events: [],
      netChangeL: 0,
      netChangeR: 0,
    });
    sorted.sort((a, b) => a.row - b.row);
  }
  return sorted;
}
