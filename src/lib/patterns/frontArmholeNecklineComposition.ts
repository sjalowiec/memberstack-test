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
  /**
   * When set, these events replace the sleeveless bind-off-then-decrease schedule.
   * The V-neck divide formula is unchanged; only the armhole rows that feed it change.
   */
  armholeEvents?: readonly FrontArmholeEvent[];
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

/**
 * Knitter-facing row-counter policy for Sleeveless Pullover V-neck Front.
 * Internal only — never shown to the knitter.
 */
export type FrontVNeckRowCounterDisplayPolicy =
  | "armhole-reset-first"
  | "shared-reset"
  | "continuous-garment-rc";

export function resolveFrontVNeckRowCounterDisplayPolicy(
  overlap?: FrontArmholeNecklineOverlap | null,
): FrontVNeckRowCounterDisplayPolicy {
  const timing = resolveFrontVNeckShapingTimingCase(overlap);
  if (timing === "before-armhole") return "continuous-garment-rc";
  if (timing === "with-armhole") return "shared-reset";
  return "armhole-reset-first";
}

/**
 * Display RC: garment number before the armhole reset, Armhole-local after —
 * unless {@link policy} is `continuous-garment-rc` (Case 4: V-neck already owns the counter).
 */
export function displayRcFromGarmentRc(
  garmentRc: number,
  firstArmholeGarmentRc: number,
  policy?: FrontVNeckRowCounterDisplayPolicy,
): number {
  const g = Math.floor(garmentRc);
  const a = Math.floor(firstArmholeGarmentRc);
  if (!Number.isFinite(g) || !Number.isFinite(a)) return Math.max(0, g);
  if (policy === "continuous-garment-rc") return Math.max(0, g);
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
  "Follow the First Side and Second Side instructions below for the exact row-by-row sequence.";

export const FRONT_VNECK_HANDOFF_DURING_ARMHOLE =
  "Begin V-neck shaping. Continue the armhole shaping.";

export const FRONT_VNECK_HANDOFF_WITH_ARMHOLE = "Begin V-neck and armhole shaping.";

export const FRONT_VNECK_HANDOFF_BEFORE_ARMHOLE = "Begin V-neck shaping.";

export const FRONT_VNECK_ARMHOLE_BEGINS_WHILE_VNECK_CONTINUES =
  "Begin armhole shaping. Continue V-neck shaping.";

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
      resolveFrontVNeckRowCounterDisplayPolicy(args.overlap),
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

/**
 * Full-width armhole events. Each bind-off step is worked on the right, then the left.
 * Decreases then start on the next even local row, one stitch each side, every other row.
 */
export function pulloverArmholeEventsFromSteps(args: {
  firstArmholeGarmentRc: number;
  bindOffStepsEachSide: readonly number[];
  decreaseStitchesEachSide: number;
}): FrontArmholeEvent[] {
  const start = Math.floor(args.firstArmholeGarmentRc);
  const out: FrontArmholeEvent[] = [];
  let local = 0;
  for (const raw of args.bindOffStepsEachSide) {
    const amount = Math.max(0, Math.floor(raw));
    if (amount <= 0) continue;
    out.push({ garmentRc: start + local, kind: "bindOff", side: "right", amount });
    out.push({ garmentRc: start + local + 1, kind: "bindOff", side: "left", amount });
    local += 2;
  }
  const decreaseStart = local;
  for (const decreaseLocal of shapingActionRowNumbers(
    decreaseStart,
    Math.max(0, Math.floor(args.decreaseStitchesEachSide)),
    2,
  )) {
    out.push({ garmentRc: start + decreaseLocal, kind: "decrease", side: "right", amount: 1 });
    out.push({ garmentRc: start + decreaseLocal, kind: "decrease", side: "left", amount: 1 });
  }
  return out;
}

/**
 * Cardigan front: the armhole edge only. Row numbers match the right-edge events of
 * {@link pulloverArmholeEventsFromSteps} (bind off, knit across, then every-other-row decreases).
 * The center front is already a separate piece, so there is no second-edge bind-off.
 */
export function cardiganArmholeEventsFromSteps(args: {
  firstArmholeGarmentRc: number;
  bindOffStepsEachSide: readonly number[];
  decreaseStitchesEachSide: number;
}): FrontArmholeEvent[] {
  return pulloverArmholeEventsFromSteps(args).filter((event) => event.side === "right");
}

function liveStitchesBeforeEvents(
  armholeStartSts: number,
  events: readonly FrontArmholeEvent[],
  beforeGarmentRc: number,
): number {
  let sts = Math.max(0, Math.floor(armholeStartSts));
  const before = Math.floor(beforeGarmentRc);
  for (const ev of events) {
    if (ev.garmentRc >= before) break;
    sts -= ev.amount;
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
  const allArmhole =
    input.armholeEvents && input.armholeEvents.length > 0
      ? [...input.armholeEvents].sort((a, b) => a.garmentRc - b.garmentRc)
      : pulloverArmholeEvents({
          firstArmholeGarmentRc: firstArmhole,
          bindOffSts: input.bindOffSts,
          decreaseSts: input.decreaseSts,
        });
  const remainingArmhole = allArmhole.filter((e) => e.garmentRc >= divideGarmentRc);
  if (remainingArmhole.length === 0) {
    return { timeline: [...timeline], overlap: null };
  }

  const liveTotalAtDivide = input.armholeEvents
    ? liveStitchesBeforeEvents(input.armholeStartSts, allArmhole, divideGarmentRc)
    : liveFrontStitchesBeforeGarmentRc({
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

  const decreaseLocals = input.armholeEvents
    ? [
        ...new Set(
          allArmhole
            .filter((event) => event.kind === "decrease" && event.side === "right")
            .map((event) => event.garmentRc - firstArmhole),
        ),
      ].sort((a, b) => a - b)
    : armholeDecreaseLocalRcs(input.decreaseSts);
  const completedDecreaseLocalRcs = decreaseLocals.filter((rc) => firstArmhole + rc < divideGarmentRc);
  const remainingDecreaseLocalRcs = decreaseLocals.filter((rc) => firstArmhole + rc >= divideGarmentRc);

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

/**
 * Round necks and cardigan fronts already have a neckline timeline. Overlay the armhole
 * events that are still to come so both edges are one schedule. A pullover V-neck divide
 * stays on {@link composeFrontVNeckTimelineWithArmholeOverlap}.
 * A cardigan front is already a separate piece: pass one-edge {@link cardiganArmholeEventsFromSteps}.
 */
export function composeNecklineTimelineWithArmholeOverlay(
  timeline: readonly RowEntry[],
  input: ComposeFrontVNeckArmholeOverlapInput,
): { timeline: RowEntry[]; overlap: FrontArmholeNecklineOverlap | null } {
  if (timeline.length === 0) return { timeline: [...timeline], overlap: null };
  const firstArmhole = Math.floor(input.firstArmholeGarmentRc);
  const first = [...timeline].sort((a, b) => a.row - b.row)[0];
  if (!first || !Number.isFinite(firstArmhole)) return { timeline: [...timeline], overlap: null };

  const necklineGarmentRc = Math.floor(first.row);
  const allArmhole =
    input.armholeEvents && input.armholeEvents.length > 0
      ? [...input.armholeEvents].sort((a, b) => a.garmentRc - b.garmentRc)
      : pulloverArmholeEvents({
          firstArmholeGarmentRc: firstArmhole,
          bindOffSts: input.bindOffSts,
          decreaseSts: input.decreaseSts,
        });
  const remainingArmhole = allArmhole.filter((event) => event.garmentRc >= necklineGarmentRc);
  if (remainingArmhole.length === 0) return { timeline: [...timeline], overlap: null };

  const withRows = insertMissingGarmentRows(
    timeline,
    remainingArmhole.map((event) => event.garmentRc),
  );
  let pendingL = 0;
  let pendingR = 0;
  for (const event of remainingArmhole) {
    if (event.side === "left") pendingL += event.amount;
    else pendingR += event.amount;
  }
  const composed = withRows.map((entry) => {
    const here = remainingArmhole.filter((event) => event.garmentRc === entry.row);
    let removeL = 0;
    let removeR = 0;
    const events = entry.events.map((event) => ({ ...event }));
    for (const event of here) {
      events.push({ kind: event.kind, side: event.side, edge: "outer", amount: event.amount });
      if (event.side === "left") removeL += event.amount;
      else removeR += event.amount;
    }
    const stitchesL = Math.max(0, entry.stitchesL + pendingL - removeL);
    const stitchesR = Math.max(0, entry.stitchesR + pendingR - removeR);
    pendingL -= removeL;
    pendingR -= removeR;
    return {
      ...entry,
      events,
      stitchesL,
      stitchesR,
      netChangeL: entry.netChangeL - removeL,
      netChangeR: entry.netChangeR - removeR,
      leftOuterEdge: entry.leftOuterEdge - pendingL,
      rightOuterEdge: entry.rightOuterEdge + pendingR,
    };
  });
  const divideRow = composed.find((entry) => entry.row === necklineGarmentRc) ?? composed[0]!;
  const decreaseLocals = [
    ...new Set(
      allArmhole
        .filter((event) => event.kind === "decrease" && event.side === "right")
        .map((event) => event.garmentRc - firstArmhole),
    ),
  ].sort((a, b) => a - b);
  const completedDecreaseLocalRcs = decreaseLocals.filter((rc) => firstArmhole + rc < necklineGarmentRc);
  const remainingDecreaseLocalRcs = decreaseLocals.filter((rc) => firstArmhole + rc >= necklineGarmentRc);
  const liveBefore = input.armholeEvents
    ? liveStitchesBeforeEvents(input.armholeStartSts, allArmhole, necklineGarmentRc)
    : liveFrontStitchesBeforeGarmentRc({
        armholeStartSts: input.armholeStartSts,
        bindOffSts: input.bindOffSts,
        decreaseSts: input.decreaseSts,
        firstArmholeGarmentRc: firstArmhole,
        beforeGarmentRc: necklineGarmentRc,
      });

  return {
    timeline: composed,
    overlap: {
      divideGarmentRc: necklineGarmentRc,
      firstArmholeGarmentRc: firstArmhole,
      necklineBeginsBeforeArmhole: necklineGarmentRc < firstArmhole,
      liveTotalAtDivide: liveBefore,
      leftAtDivide: Math.max(0, Math.floor(divideRow.stitchesL)),
      rightAtDivide: Math.max(0, Math.floor(divideRow.stitchesR)),
      heldAfterDivideRow: Math.max(0, Math.floor(divideRow.stitchesL)),
      activeAfterDivideRow: Math.max(0, Math.floor(divideRow.stitchesR)),
      completedDecreaseLocalRcs,
      remainingDecreaseLocalRcs,
      completedDecreaseSts: completedDecreaseLocalRcs.length,
      remainingDecreaseSts: remainingDecreaseLocalRcs.length,
      lastArmholeGarmentRc: Math.max(...remainingArmhole.map((event) => event.garmentRc)),
      stitchesAfterArmhole: Math.round(input.stitchesAfterArmhole),
    },
  };
}

/** Written handoff when armhole and neckline share one checklist. */
export function coordinatedShapingHandoffLines(args: {
  timing: FrontVNeckShapingTimingCase;
  neckline: "round" | "v-neck";
  cardigan: boolean;
}): string[] {
  const follow = args.cardigan
    ? "Follow the checklist below for the exact row-by-row sequence."
    : args.neckline === "v-neck"
      ? FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST
      : "Follow the First Shoulder and Second Shoulder instructions below for the exact row-by-row sequence.";
  if (args.neckline === "v-neck" && !args.cardigan) {
    const lead =
      args.timing === "with-armhole"
        ? FRONT_VNECK_HANDOFF_WITH_ARMHOLE
        : args.timing === "before-armhole"
          ? FRONT_VNECK_HANDOFF_BEFORE_ARMHOLE
          : args.timing === "during-armhole"
            ? FRONT_VNECK_HANDOFF_DURING_ARMHOLE
            : FRONT_VNECK_HANDOFF_AFTER_ARMHOLE;
    return [lead, follow];
  }
  const neck = args.neckline === "v-neck" ? "V-neck" : "neckline";
  const lead =
    args.timing === "with-armhole"
      ? `Begin ${neck} and armhole shaping.`
      : args.timing === "before-armhole"
        ? `Begin armhole shaping. Continue ${neck === "V-neck" ? "V-neck" : "the neckline"} shaping.`
        : args.timing === "during-armhole"
          ? `Begin ${neck} shaping. Continue the armhole shaping.`
          : `Begin ${neck} shaping.`;
  return [lead, follow];
}

/**
 * Move inner-edge shaping onto neck-side rows and outer-edge shaping onto
 * armhole-side rows. Even display RC is the armhole side; odd display RC is
 * the neck side. Rows already in the timeline are reused, so the piece does
 * not gain a knitted row.
 */
export function phaseLockTimelineToCarriageSide(
  timeline: readonly RowEntry[],
  firstArmholeGarmentRc: number,
  policy?: FrontVNeckRowCounterDisplayPolicy,
): RowEntry[] {
  const sorted = [...timeline].sort((a, b) => a.row - b.row);
  const first = sorted[0];
  if (!first) return [];
  const rowNumbers = sorted.map((entry) => entry.row);
  const armholeSide = (row: number) =>
    displayRcFromGarmentRc(row, firstArmholeGarmentRc, policy) % 2 === 0;
  const eventsByRow = new Map<number, ShapingEvent[]>(
    sorted.map((entry) => [entry.row, entry.events.map((event) => ({ ...event }))]),
  );

  const neighbor = (row: number, wantArmholeSide: boolean, direction: 1 | -1): number | undefined => {
    const start = rowNumbers.indexOf(row);
    for (let index = start + direction; index >= 0 && index < rowNumbers.length; index += direction) {
      const candidate = rowNumbers[index]!;
      if (armholeSide(candidate) === wantArmholeSide) return candidate;
    }
    return undefined;
  };

  const neckSideRowIsOpen = (row: number): boolean => {
    const start = rowNumbers.indexOf(row);
    for (let index = start; index < rowNumbers.length; index += 1) {
      const candidate = rowNumbers[index]!;
      if (armholeSide(candidate)) continue;
      if (!(eventsByRow.get(candidate) ?? []).some((event) => event.edge === "inner")) return true;
    }
    return false;
  };

  const takeEdge = (row: number, edge: "inner" | "outer"): ShapingEvent[] => {
    const events = eventsByRow.get(row) ?? [];
    const taken = events.filter((event) => event.edge === edge && event.side !== "center" && event.amount > 0);
    eventsByRow.set(
      row,
      events.filter((event) => !(event.edge === edge && event.side !== "center" && event.amount > 0)),
    );
    return taken;
  };

  const cascadeInners = (row: number, seen: Set<number>) => {
    if (seen.has(row)) return;
    seen.add(row);
    const moving = takeEdge(row, "inner");
    if (moving.length === 0) return;
    const forward = neighbor(row, false, 1);
    const target = forward ?? neighbor(row, false, -1);
    if (target === undefined) {
      eventsByRow.set(row, [...(eventsByRow.get(row) ?? []), ...moving]);
      return;
    }
    const occupants = (eventsByRow.get(target) ?? []).some((event) => event.edge === "inner");
    if (forward !== undefined && occupants && neckSideRowIsOpen(forward)) {
      cascadeInners(forward, seen);
    }
    eventsByRow.set(target, coalesceCarriageEvents([...(eventsByRow.get(target) ?? []), ...moving]));
  };

  for (const row of rowNumbers) {
    if (!armholeSide(row)) continue;
    if ((eventsByRow.get(row) ?? []).some((event) => event.edge === "inner")) {
      cascadeInners(row, new Set());
    }
  }

  for (const row of [...rowNumbers].reverse()) {
    if (armholeSide(row)) continue;
    const moving = takeEdge(row, "outer");
    if (moving.length === 0) continue;
    const backward = neighbor(row, true, -1);
    const forward = neighbor(row, true, 1);
    const backwardBusy =
      backward !== undefined && (eventsByRow.get(backward) ?? []).some((event) => event.edge === "outer");
    const target = backward === undefined || backwardBusy ? (forward ?? backward) : backward;
    if (target === undefined) {
      eventsByRow.set(row, [...(eventsByRow.get(row) ?? []), ...moving]);
      continue;
    }
    eventsByRow.set(target, coalesceCarriageEvents([...(eventsByRow.get(target) ?? []), ...moving]));
  }

  for (const row of rowNumbers) {
    eventsByRow.set(row, coalesceCarriageEvents(eventsByRow.get(row) ?? []));
  }

  const state = reverseEvents(edgeStateFrom(first), first.events);
  return sorted.map((entry) => {
    const before = { ...state };
    for (const event of eventsByRow.get(entry.row) ?? []) applyCarriageEvent(state, event, 1);
    state.leftCount = Math.max(0, state.leftCount);
    state.rightCount = Math.max(0, state.rightCount);
    return {
      ...entry,
      events: eventsByRow.get(entry.row) ?? [],
      stitchesL: state.leftCount,
      stitchesR: state.rightCount,
      netChangeL: state.leftCount - before.leftCount,
      netChangeR: state.rightCount - before.rightCount,
      centerWidth: state.rightInnerEdge - state.leftInnerEdge - 1,
      leftOuterEdge: state.leftOuterEdge,
      leftInnerEdge: state.leftInnerEdge,
      rightInnerEdge: state.rightInnerEdge,
      rightOuterEdge: state.rightOuterEdge,
    };
  });
}

function coalesceCarriageEvents(events: readonly ShapingEvent[]): ShapingEvent[] {
  const combined: ShapingEvent[] = [];
  for (const event of events) {
    const match = combined.find(
      (existing) =>
        existing.side === event.side && existing.edge === event.edge && existing.kind === event.kind,
    );
    if (match) match.amount += event.amount;
    else combined.push({ ...event });
  }
  return combined;
}

type CarriageEdgeState = {
  leftCount: number;
  rightCount: number;
  leftOuterEdge: number;
  leftInnerEdge: number;
  rightInnerEdge: number;
  rightOuterEdge: number;
};

function edgeStateFrom(row: RowEntry): CarriageEdgeState {
  return {
    leftCount: row.stitchesL,
    rightCount: row.stitchesR,
    leftOuterEdge: row.leftOuterEdge,
    leftInnerEdge: row.leftInnerEdge,
    rightInnerEdge: row.rightInnerEdge,
    rightOuterEdge: row.rightOuterEdge,
  };
}

function applyCarriageEvent(state: CarriageEdgeState, event: ShapingEvent, direction: 1 | -1): void {
  if (event.edge === "center" || event.side === "center" || event.amount <= 0) return;
  const amount = event.amount * direction;
  if (event.side === "right" && event.edge === "inner") {
    state.rightInnerEdge += amount;
    state.rightCount -= amount;
  } else if (event.side === "right" && event.edge === "outer") {
    state.rightOuterEdge -= amount;
    state.rightCount -= amount;
  } else if (event.side === "left" && event.edge === "inner") {
    state.leftInnerEdge -= amount;
    state.leftCount -= amount;
  } else if (event.side === "left" && event.edge === "outer") {
    state.leftOuterEdge += amount;
    state.leftCount -= amount;
  }
}

function reverseEvents(state: CarriageEdgeState, events: readonly ShapingEvent[]): CarriageEdgeState {
  for (const event of [...events].reverse()) applyCarriageEvent(state, event, -1);
  return state;
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
