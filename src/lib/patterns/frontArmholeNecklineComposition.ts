/**
 * Front-only composition: overlay unfinished armhole decreases onto an existing
 * V-neck neck/shoulder timeline without changing armhole or neckline geometry.
 *
 * Geometry still uses finished post-armhole width B. This walk uses live stitches
 * at each Armhole RC so the knitter sees the real count when the neckline starts
 * before the armhole decrease schedule is finished.
 */

import { shapingActionRowNumbers } from "./evenShapingSchedule";
import { vNeckDivideSideStartsFromLiveStitches } from "./legoBlocks/vNeckline";
import type { RowEntry, ShapingEvent } from "./shapingTimeline";

export type FrontArmholeNecklineOverlap = {
  /** Armhole-local RCs already worked before the neckline divide (e.g. 2, 4, 6). */
  completedDecreaseLocalRcs: number[];
  /** Armhole-local RCs that still fall on/after the divide (e.g. 8, 10, 12, 14). */
  remainingDecreaseLocalRcs: number[];
  /** Live total after completed decreases (Amanda: 56), not finished B. */
  liveTotalAtDivide: number;
  leftAtDivide: number;
  rightAtDivide: number;
  completedDecreaseSts: number;
  remainingDecreaseSts: number;
  /**
   * Finished post-armhole width B from geometry. Display must not show this
   * as the live count until remaining armhole decreases are actually worked.
   */
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
 * Live total-front stitches after working through `afterLocalRc` (inclusive)
 * of the pullover (two-edge) armhole schedule.
 */
export function liveFrontStitchesAfterArmholeLocalRc(args: {
  armholeStartSts: number;
  bindOffSts: number;
  decreaseSts: number;
  afterLocalRc: number;
}): number {
  const start = Math.max(0, Math.floor(args.armholeStartSts));
  const bo = Math.max(0, Math.floor(args.bindOffSts));
  const after = Math.floor(args.afterLocalRc);
  if (!Number.isFinite(after) || after < 0) return start;

  let sts = start;
  sts -= bo;
  if (after < 1) return Math.max(0, sts);
  sts -= bo;

  for (const rc of armholeDecreaseLocalRcs(args.decreaseSts)) {
    if (rc > after) break;
    sts -= 2;
  }
  return Math.max(0, sts);
}

export function timelineHasOverlappingArmholeDecreases(timeline: readonly RowEntry[]): boolean {
  return timeline.some((entry) =>
    entry.events.some(
      (ev) => ev.edge === "outer" && ev.kind === "decrease" && ev.amount > 0,
    ),
  );
}

function garmentRcToLocal(garmentRc: number, firstArmholeGarmentRc: number): number {
  return Math.max(0, Math.floor(garmentRc) - Math.floor(firstArmholeGarmentRc));
}

function rebuildCountsFromLiveDivide(
  timeline: readonly RowEntry[],
  liveTotalAtDivide: number,
  remainingDecreaseGarmentRcs: ReadonlySet<number>,
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

    if (remainingDecreaseGarmentRcs.has(entry.row)) {
      events.push({ kind: "decrease", side: "left", edge: "outer", amount: 1 });
      events.push({ kind: "decrease", side: "right", edge: "outer", amount: 1 });
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
 * If the Front V-neck divide falls before the last armhole decrease, overlay those
 * remaining outer decreases and recast per-side counts from the live total.
 * Returns the original timeline when there is no overlap (shallow neck).
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

  const divideLocal = garmentRcToLocal(first.row, firstArmhole);
  const allDec = armholeDecreaseLocalRcs(input.decreaseSts);
  const completedDecreaseLocalRcs = allDec.filter((rc) => rc < divideLocal);
  const remainingDecreaseLocalRcs = allDec.filter((rc) => rc >= divideLocal);

  if (remainingDecreaseLocalRcs.length === 0) {
    return { timeline: [...timeline], overlap: null };
  }

  const liveTotalAtDivide = liveFrontStitchesAfterArmholeLocalRc({
    armholeStartSts: input.armholeStartSts,
    bindOffSts: input.bindOffSts,
    decreaseSts: input.decreaseSts,
    afterLocalRc: divideLocal,
  });
  const sides = vNeckDivideSideStartsFromLiveStitches(liveTotalAtDivide);
  const remainingGarment = new Set(
    remainingDecreaseLocalRcs.map((local) => firstArmhole + local),
  );

  return {
    timeline: rebuildCountsFromLiveDivide(timeline, liveTotalAtDivide, remainingGarment),
    overlap: {
      completedDecreaseLocalRcs,
      remainingDecreaseLocalRcs,
      liveTotalAtDivide,
      leftAtDivide: sides.left,
      rightAtDivide: sides.right,
      completedDecreaseSts: completedDecreaseLocalRcs.length,
      remainingDecreaseSts: remainingDecreaseLocalRcs.length,
      stitchesAfterArmhole: Math.round(input.stitchesAfterArmhole),
    },
  };
}
