/**
 * Shallow round neckline worked at the same time as short-row shoulder shaping.
 *
 * Neck-edge groups of 2 or more are bind-offs. A 1-stitch group is a fully fashioned
 * decrease. Those stay on the odd rows, when the carriage is at the neck.
 *
 * The calculated shoulder groups are the same sizes the shaped-shoulder schedule
 * already uses. That schedule places them on the odd rows, which is the neck edge,
 * so a shoulder bind-off cannot be worked there. Each group is held instead:
 * all but one stitch go into hold on the neck-edge pass (opposite the carriage),
 * and the last stitch is pulled into hold on the next row, when the carriage is
 * at the shoulder, so the automatic wrap can happen. Stitch totals and the
 * neckline depth stay the same.
 */

import { distributeTotalAcrossRows } from "./distributeTotalAcrossRows";
import {
  alignShallowHoldGroupsToShoulderSections,
} from "./straightShoulderShallowRoundNeck";
import type { RoundNecklinePlanResult, RoundNecklineShapingResult } from "./legoBlocks/roundNeckline";
import {
  computeShallowBackNeckNeedleLayout,
  formatCenterNeedleHoldPhraseHtml,
  formatFirstSideHoldPhraseHtml,
  formatNeedleRangeHtml,
  formatNeedleRangeThrough,
  formatStitchCountValidation,
} from "./legoBlocks/shallowBackNeckNeedleLayout";
import { inlineRcHeadingLine, inlineSubheadingLine } from "./inlineRcHeading";
import {
  AUTOMATIC_WRAP_GLOSSARY_ID,
  AUTOMATIC_WRAP_GLOSSARY_TERM,
} from "./sock/sockInstructionRender";
import type { RowEntry } from "./shapingTimeline";

export type ShallowNeckShortRowPass = {
  localRc: number;
  /** Carriage is at the neck on odd rows and at the shoulder on even rows. */
  carriage: "neck" | "shoulder";
  neck?: { amount: number; kind: "bindOff" | "decrease" };
  /** Shoulder stitches put into hold opposite the carriage, on a neck-edge row. */
  shoulderHoldOpposite: number;
  /** Shoulder stitch pulled into hold on the carriage side so it wraps. */
  shoulderWrap: number;
};

export type ShallowNeckShortRowShoulderPlan = {
  fits: boolean;
  /** Why the calculated groups cannot be knitted inside the calculated depth. */
  conflict: string | null;
  /**
   * The shaped-shoulder schedule puts these groups on the odd (neck-edge) rows.
   * The passes below move the wrap to the following even row.
   */
  shoulderGroupsOnNeckRows: boolean;
  passes: ShallowNeckShortRowPass[];
  neckRemoved: number;
  shoulderHeld: number;
  finishedShoulder: number;
  depthRows: number;
};

function formatRcLabel(rc: number): string {
  return `RC: ${String(Math.max(0, Math.floor(rc))).padStart(3, "0")}`;
}

function stitchWord(n: number): string {
  return n === 1 ? "stitch" : "stitches";
}

function automaticWrapHtml(): string {
  return `<span class="glossary-tooltip-placeholder" data-glossary-id="${AUTOMATIC_WRAP_GLOSSARY_ID}" data-term="${AUTOMATIC_WRAP_GLOSSARY_TERM}" data-aria-label="${AUTOMATIC_WRAP_GLOSSARY_TERM}">${AUTOMATIC_WRAP_GLOSSARY_TERM}</span>`;
}

/** Shoulder short-row groups from the existing shaped-shoulder slot count. */
export function shortRowShoulderGroups(
  shoulderStitches: number,
  neckDepthRows: number,
  rowsPerInch: number,
): number[] {
  const workRows = Math.max(0, Math.floor(neckDepthRows) - 1);
  const shoulderRows = Math.max(1, Math.round(rowsPerInch));
  const placement = Math.min(shoulderRows, Math.max(workRows, 1));
  const slots = Math.max(1, Math.ceil(placement / 2));
  return distributeTotalAcrossRows(shoulderStitches, slots).filter((n) => n > 0);
}

function neckActions(groups: readonly number[]): { amount: number; kind: "bindOff" | "decrease" }[] {
  return groups
    .filter((amount) => amount > 0)
    .map((amount) => ({ amount, kind: amount <= 1 ? "decrease" : "bindOff" }));
}

/**
 * Pair each neckline action with the calculated shoulder group inside the
 * existing depth. Does not add rows or change group sizes.
 */
export function planShallowNeckShortRowShoulders(input: {
  neckGroups: readonly number[];
  shoulderGroups: readonly number[];
  depthRows: number;
  sectionStitches: number;
}): ShallowNeckShortRowShoulderPlan {
  const depthRows = Math.max(0, Math.floor(input.depthRows));
  const oddSlots = Math.floor(depthRows / 2);
  const evenSlots = Math.floor(depthRows / 2);
  const neck = neckActions(input.neckGroups);
  const shoulder = input.shoulderGroups.filter((n) => n > 0);
  const neckRemoved = neck.reduce((sum, action) => sum + action.amount, 0);
  const shoulderHeld = shoulder.reduce((sum, n) => sum + n, 0);
  const finishedShoulder = input.sectionStitches - neckRemoved;
  const passes: ShallowNeckShortRowPass[] = [];

  if (neck.length > oddSlots || shoulder.length > evenSlots) {
    return {
      fits: false,
      conflict:
        `The calculated neckline needs ${neck.length} neck-edge rows and the calculated shoulder groups need ${shoulder.length} shoulder-edge rows. This ${depthRows}-row neckline has ${oddSlots} odd rows and ${evenSlots} even rows. The depth was not increased.`,
      shoulderGroupsOnNeckRows: true,
      passes: [],
      neckRemoved,
      shoulderHeld,
      finishedShoulder,
      depthRows,
    };
  }

  const count = Math.max(neck.length, shoulder.length);
  for (let i = 0; i < count; i++) {
    const group = shoulder[i] ?? 0;
    const opposite = group > 1 ? group - 1 : 0;
    const wrap = group > 0 ? 1 : 0;
    const neckAction = neck[i];
    passes.push({
      localRc: 1 + 2 * i,
      carriage: "neck",
      ...(neckAction ? { neck: neckAction } : {}),
      shoulderHoldOpposite: opposite,
      shoulderWrap: 0,
    });
    if (wrap > 0) {
      passes.push({
        localRc: 2 + 2 * i,
        carriage: "shoulder",
        shoulderHoldOpposite: 0,
        shoulderWrap: wrap,
      });
    }
  }

  return {
    fits: true,
    conflict: null,
    shoulderGroupsOnNeckRows: shoulder.length > 0,
    passes,
    neckRemoved,
    shoulderHeld,
    finishedShoulder,
    depthRows,
  };
}

function neckSentence(action: { amount: number; kind: "bindOff" | "decrease" }): string {
  if (action.kind === "decrease") {
    return "Decrease 1 stitch at the neck edge, fully fashioned. This stitch is removed for the neckline.";
  }
  return `Bind off ${action.amount} ${stitchWord(action.amount)} at the neck edge. These stitches are removed for the neckline.`;
}

function passLines(pass: ShallowNeckShortRowPass): string[] {
  const lines = [inlineRcHeadingLine(formatRcLabel(pass.localRc))];
  if (pass.carriage === "neck") {
    lines.push("Before knitting this row, the carriage and the working yarn are at the neck edge.");
    if (pass.neck) lines.push(neckSentence(pass.neck));
    if (pass.shoulderHoldOpposite > 0) {
      const n = pass.shoulderHoldOpposite;
      lines.push(
        `On this same row, put ${n} ${stitchWord(n)} at the shoulder edge into hold. The carriage is opposite those stitches. These stitches are held for the shoulder slope. They are not removed.`,
      );
    }
    lines.push("Knit to the shoulder edge.");
    return lines;
  }
  lines.push("Before knitting this row, the carriage and the working yarn are at the shoulder edge.");
  lines.push(
    `On the carriage side, put 1 needle into hold, ${automaticWrapHtml()}, and knit back to the neck edge. This held stitch is part of the shoulder slope. It is not removed.`,
  );
  return lines;
}

function finishLines(
  orderLabel: "first" | "second",
  plan: ShallowNeckShortRowShoulderPlan,
): string[] {
  return [
    `${plan.neckRemoved} ${stitchWord(plan.neckRemoved)} were removed for the neckline. ${plan.shoulderHeld} ${stitchWord(plan.shoulderHeld)} were held for the shoulder slope and are still on the machine.`,
    `Bind off the ${plan.finishedShoulder} shoulder stitches.`,
    `The ${orderLabel} shoulder is complete.`,
  ];
}

export type ShallowNeckShortRowInstructionBlock = {
  lines: string[];
  stitchCount?: number;
};

/**
 * Both shoulders, in knitting order, from one calculated plan.
 * The second shoulder names the neck edge and the shoulder edge. It does not say to reverse the first shoulder.
 */
export function shallowNeckShortRowShoulderBlocks(input: {
  plan: RoundNecklinePlanResult | RoundNecklineShapingResult;
  bodyWidthStitches: number;
  shoulderGroups: readonly number[];
  depthRows: number;
}): ShallowNeckShortRowInstructionBlock[] | null {
  const aligned = alignShallowHoldGroupsToShoulderSections(
    input.bodyWidthStitches,
    input.plan.centerBindOff,
    input.plan.left.holdGroups,
    input.plan.right.holdGroups,
  );
  const layout = computeShallowBackNeckNeedleLayout(input.bodyWidthStitches, input.plan.centerBindOff);
  const rightPlan = planShallowNeckShortRowShoulders({
    neckGroups: aligned.rightGroups,
    shoulderGroups: input.shoulderGroups,
    depthRows: input.depthRows,
    sectionStitches: layout.stitchCounts.rightShoulder,
  });
  const leftPlan = planShallowNeckShortRowShoulders({
    neckGroups: aligned.leftGroups,
    shoulderGroups: input.shoulderGroups,
    depthRows: input.depthRows,
    sectionStitches: layout.stitchCounts.leftShoulder,
  });
  if (!rightPlan.fits || !leftPlan.fits) return null;

  const counts = layout.stitchCounts;
  const rightWork = formatNeedleRangeHtml(
    formatNeedleRangeThrough(layout.rightShoulder.start, layout.rightShoulder.end),
  );
  const leftWork = formatNeedleRangeHtml(
    formatNeedleRangeThrough(layout.leftShoulder.start, layout.leftShoulder.end),
  );
  const center = formatCenterNeedleHoldPhraseHtml(layout);

  const rightLines = [
    inlineSubheadingLine("RIGHT SIDE"),
    "Divide the neckline. Work one shoulder at a time.",
    `Put needles ${formatFirstSideHoldPhraseHtml(layout)} into hold${formatStitchCountValidation(counts.firstSideHold)}. This is the second shoulder waiting. These stitches are not the short-row shoulder shaping.`,
    `Work needles ${rightWork}${formatStitchCountValidation(counts.rightShoulder)}.`,
    "Place the carriage at the shoulder edge without knitting a row.",
    "Knit this row. The carriage finishes at the neck edge.",
    ...rightPlan.passes.flatMap(passLines),
    ...finishLines("first", rightPlan),
  ];
  const leftLines = [
    inlineSubheadingLine("LEFT SIDE"),
    "Break the yarn.",
    `Return needles ${leftWork} to working position${formatStitchCountValidation(counts.leftShoulder)}.`,
    `Leave center neckline needles ${center} in hold${formatStitchCountValidation(counts.center)}. The center stitches were not bound off. They are still in hold.`,
    "Reset the row counter to RC: 000.",
    "Place the carriage at the shoulder edge without knitting a row.",
    "Knit this row. The carriage finishes at the neck edge.",
    "Work this shoulder on its own. The neck edge is toward the center. The shoulder edge is the outer edge.",
    ...leftPlan.passes.flatMap(passLines),
    ...finishLines("second", leftPlan),
    "Scrap off or bind off the center neckline stitches left in hold.",
  ];

  return [
    { lines: rightLines, stitchCount: rightPlan.finishedShoulder },
    { lines: leftLines, stitchCount: leftPlan.finishedShoulder },
  ];
}

/** Timeline rows for the shaping map. Rows are garment RC. Holds are shoulder short rows. */
export function shallowNeckShortRowShoulderTimeline(input: {
  plan: RoundNecklinePlanResult | RoundNecklineShapingResult;
  bodyWidthStitches: number;
  shoulderGroups: readonly number[];
  depthRows: number;
  necklineStartRc: number;
}): RowEntry[] | null {
  const aligned = alignShallowHoldGroupsToShoulderSections(
    input.bodyWidthStitches,
    input.plan.centerBindOff,
    input.plan.left.holdGroups,
    input.plan.right.holdGroups,
  );
  const layout = computeShallowBackNeckNeedleLayout(input.bodyWidthStitches, input.plan.centerBindOff);
  const right = planShallowNeckShortRowShoulders({
    neckGroups: aligned.rightGroups,
    shoulderGroups: input.shoulderGroups,
    depthRows: input.depthRows,
    sectionStitches: layout.stitchCounts.rightShoulder,
  });
  const left = planShallowNeckShortRowShoulders({
    neckGroups: aligned.leftGroups,
    shoulderGroups: input.shoulderGroups,
    depthRows: input.depthRows,
    sectionStitches: layout.stitchCounts.leftShoulder,
  });
  if (!right.fits || !left.fits) return null;

  const start = Math.floor(input.necklineStartRc);
  const row = (localRc: number, events: RowEntry["events"]): RowEntry => ({
    row: start + localRc,
    events,
    stitchesL: layout.stitchCounts.leftShoulder,
    stitchesR: layout.stitchCounts.rightShoulder,
    netChangeL: 0,
    netChangeR: 0,
    isSplit: true,
    centerWidth: input.plan.centerBindOff,
    leftOuterEdge: 0,
    leftInnerEdge: 0,
    rightInnerEdge: 0,
    rightOuterEdge: 0,
  });

  const rows: RowEntry[] = [
    row(0, [{ kind: "hold", side: "center", edge: "center", amount: input.plan.centerBindOff }]),
  ];
  const byLocal = new Map<number, RowEntry["events"]>();
  const add = (
    localRc: number,
    side: "left" | "right",
    pass: ShallowNeckShortRowPass,
  ) => {
    const events = byLocal.get(localRc) ?? [];
    if (pass.neck) {
      events.push({ kind: pass.neck.kind, side, edge: "inner", amount: pass.neck.amount });
    }
    const held = pass.shoulderHoldOpposite + pass.shoulderWrap;
    if (held > 0) {
      events.push({ kind: "hold", side, edge: "outer", amount: held });
    }
    byLocal.set(localRc, events);
  };
  for (const pass of right.passes) add(pass.localRc, "right", pass);
  for (const pass of left.passes) add(pass.localRc, "left", pass);
  for (const localRc of [...byLocal.keys()].sort((a, b) => a - b)) {
    rows.push(row(localRc, byLocal.get(localRc) ?? []));
  }
  return rows;
}
