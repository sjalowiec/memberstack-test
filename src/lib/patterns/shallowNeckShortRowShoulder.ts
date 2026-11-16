/**
 * Shallow round neckline worked at the same time as short-row shoulder shaping.
 *
 * The center neckline is bound off once, before either shoulder is shaped.
 * The opposite shoulder waits in hold. That hold is not the short-row shaping.
 *
 * Neck-edge groups of 2 or more are bind-offs. A 1-stitch group is a fully fashioned
 * decrease. Those stay on the odd rows, when the carriage is at the neck.
 *
 * Shoulder groups use the existing shaped-shoulder sizes. The automatic wrap
 * (short-row Skill Builder, glossary 346) holds all but one stitch opposite the
 * carriage, knits across, then pulls the last needle into hold on the carriage
 * side. The last group ends on that wrap: no working needle remains, so that
 * return is not knitted. The 12-row depth is the positioning row plus those
 * knitted short rows. The shoulder is bound off at the resulting row counter.
 * Stitch totals and the neckline depth stay the same.
 */

import { distributeTotalAcrossRows } from "./distributeTotalAcrossRows";
import {
  alignShallowHoldGroupsToShoulderSections,
} from "./straightShoulderShallowRoundNeck";
import type { RoundNecklinePlanResult, RoundNecklineShapingResult } from "./legoBlocks/roundNeckline";
import {
  computeShallowBackNeckNeedleLayout,
  formatCenterNeedleHoldPhraseHtml,
  formatNeedleLabel,
  parseNeedleLabel,
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

type ShoulderSide = "right" | "left";

function counterSentence(localRc: number): string {
  const label = formatRcLabel(localRc);
  return `The row counter shows ${label}. This row has not been knitted.`;
}

function afterKnitSentence(localRc: number): string {
  return `After this row, the row counter shows ${formatRcLabel(localRc + 1)}.`;
}

function sideWords(side: ShoulderSide): {
  bed: "L" | "R";
  neckCarriage: string;
  shoulderCarriage: string;
  knitToShoulderFinish: string;
  knitToNeckFinish: string;
} {
  if (side === "right") {
    return {
      bed: "R",
      neckCarriage:
        "The carriage is at the neck edge, beside the center, on the left of these working stitches.",
      shoulderCarriage: "The carriage is COR, at the shoulder edge.",
      knitToShoulderFinish: "COR, at the shoulder edge",
      knitToNeckFinish: "at the neck edge, beside the center",
    };
  }
  return {
    bed: "L",
    neckCarriage:
      "The carriage is at the neck edge, beside the center, on the right of these working stitches.",
    shoulderCarriage: "The carriage is COL, at the shoulder edge.",
    knitToShoulderFinish: "COL, at the shoulder edge",
    knitToNeckFinish: "at the neck edge, beside the center",
  };
}

function rangePhrase(bed: "L" | "R", from: number, to: number): string {
  if (from === to) return formatNeedleRangeHtml(formatNeedleLabel(bed, from));
  return formatNeedleRangeHtml(
    formatNeedleRangeThrough(formatNeedleLabel(bed, from), formatNeedleLabel(bed, to)),
  );
}

/**
 * One shoulder, in carriage order. A row heading is the counter before that row is knitted.
 * The final wrap is not given a row to knit when no working needle remains.
 */
function shoulderPassLines(
  side: ShoulderSide,
  plan: ShallowNeckShortRowShoulderPlan,
  neckIndex: number,
  shoulderIndex: number,
): string[] {
  const words = sideWords(side);
  let neck = neckIndex;
  let shoulder = shoulderIndex;
  let working = plan.finishedShoulder + plan.neckRemoved;
  const lines: string[] = [];

  for (const pass of plan.passes) {
    if (pass.carriage === "neck") {
      lines.push(inlineRcHeadingLine(formatRcLabel(pass.localRc)));
      lines.push(counterSentence(pass.localRc));
      lines.push(words.neckCarriage);
      if (pass.neck) {
        const removed = rangePhrase(words.bed, neck, neck + pass.neck.amount - 1);
        lines.push(`${neckSentence(pass.neck)} Remove ${removed}.`);
        neck += pass.neck.amount;
        working -= pass.neck.amount;
      }
      if (pass.shoulderHoldOpposite > 0) {
        const n = pass.shoulderHoldOpposite;
        const held = rangePhrase(words.bed, shoulder - n + 1, shoulder);
        lines.push(
          `Before knitting, put ${removedOrHeld(n)} ${held} into hold at the shoulder edge. The carriage is opposite those needles. These stitches are held for the shoulder slope. They are not removed, and they are not the other shoulder waiting in hold.`,
        );
        shoulder -= n;
        working -= n;
      }
      if (working > 0) {
        lines.push(
          `Knit the ${working} working ${stitchWord(working)}, ${rangePhrase(words.bed, neck, shoulder)}. The carriage finishes ${words.knitToShoulderFinish}. ${afterKnitSentence(pass.localRc)}`,
        );
      } else {
        lines.push(
          `No working stitches remain. Do not knit this row. The row counter stays at ${formatRcLabel(pass.localRc)}.`,
        );
      }
      continue;
    }

    const wrappingLast = pass.shoulderWrap > 0 && working <= pass.shoulderWrap;
    if (wrappingLast) {
      lines.push(
        `The row counter shows ${formatRcLabel(pass.localRc)}. ${words.shoulderCarriage} Put the last working needle, ${rangePhrase(words.bed, shoulder, shoulder)}, into hold, ${automaticWrapHtml()}. This stitch is held for the shoulder slope. It is not removed. No working needles remain. Do not knit. The row counter stays at ${formatRcLabel(pass.localRc)}.`,
      );
      working = 0;
      continue;
    }

    lines.push(inlineRcHeadingLine(formatRcLabel(pass.localRc)));
    lines.push(counterSentence(pass.localRc));
    lines.push(words.shoulderCarriage);
    if (pass.shoulderWrap > 0) {
      const wrapped = rangePhrase(words.bed, shoulder, shoulder);
      lines.push(
        `On the carriage side, put 1 needle, ${wrapped}, into hold, ${automaticWrapHtml()}. This stitch is held for the shoulder slope. It is not removed.`,
      );
      shoulder -= 1;
      working -= 1;
    }
    lines.push(
      `Knit the ${working} working ${stitchWord(working)}, ${rangePhrase(words.bed, neck, shoulder)}, back to the neck edge. The carriage finishes ${words.knitToNeckFinish}. ${afterKnitSentence(pass.localRc)}`,
    );
  }
  return lines;
}

function removedOrHeld(n: number): string {
  return `${n} ${stitchWord(n)}`;
}

function finishLines(
  side: ShoulderSide,
  orderLabel: "first" | "second",
  plan: ShallowNeckShortRowShoulderPlan,
): string[] {
  const words = sideWords(side);
  const held = plan.shoulderHeld;
  const removed = plan.neckRemoved;
  const finished = plan.finishedShoulder;
  return [
    `${removed} ${stitchWord(removed)} were removed for the neckline. ${held} ${stitchWord(held)} were held for the shoulder slope and are still on the machine. These held stitches are the short-row shoulder. They are not the other shoulder.`,
    `Return the ${held} held shoulder stitches to working position. ${words.shoulderCarriage} Each of those needles has its wrap.`,
    `Bind off the ${finished} shoulder stitches from the shoulder edge. Knit each wrap together with its stitch as that stitch is bound off.`,
    `The row counter is at ${formatRcLabel(plan.depthRows)}. This bind-off does not add a knitted row. Do not knit a separate row across the shoulder before the bind-off. That row would end at ${formatRcLabel(plan.depthRows + 1)}, one row past the calculated neckline depth.`,
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
  const rightNeck = layout.rightShoulder.start;
  const rightOuter = layout.rightShoulder.end;
  const leftOuter = layout.leftShoulder.start;
  const leftNeck = layout.leftShoulder.end;

  const rightLines = [
    inlineSubheadingLine("RIGHT SIDE"),
    "Divide the neckline. Work one shoulder at a time.",
    `Put needles ${leftWork} into hold${formatStitchCountValidation(counts.leftShoulder)}. This is the left shoulder waiting. These stitches are not the short-row shoulder shaping.`,
    inlineRcHeadingLine(formatRcLabel(0)),
    "The row counter shows RC: 000. This row has not been knitted.",
    `Break the yarn and join it at ${layout.center.start}. Bind off center neckline needles ${center}${formatStitchCountValidation(counts.center)}. Start this bind-off at ${layout.center.start} and bind off through ${layout.center.end}. These center stitches are removed from work and finished. The yarn finishes at the neck edge of the right shoulder. If the carriage passes the row-counter tripper during this bind-off, set the row counter back to RC: 000.`,
    "Place the carriage at the shoulder edge, COR, without knitting a row. The row counter stays at RC: 000.",
    `Work needles ${rightWork}${formatStitchCountValidation(counts.rightShoulder)}. The neck edge is ${rightNeck}. The shoulder edge is ${rightOuter}, COR.`,
    "Knit this row. The carriage finishes at the neck edge, on the left of these working stitches. After this row, the row counter shows RC: 001.",
    ...shoulderPassLines(
      "right",
      rightPlan,
      parseNeedleLabel(rightNeck).index,
      parseNeedleLabel(rightOuter).index,
    ),
    ...finishLines("right", "first", rightPlan),
  ];
  const leftLines = [
    inlineSubheadingLine("LEFT SIDE"),
    "Break the yarn.",
    `Return needles ${leftWork} to working position${formatStitchCountValidation(counts.leftShoulder)}. This is the shoulder that was waiting. These stitches are not the short-row shoulder shaping.`,
    "The center neckline stitches are already bound off. Do not bind them off again.",
    "Reset the row counter to RC: 000. This row has not been knitted.",
    "Place the carriage at the shoulder edge, COL, without knitting a row. The row counter stays at RC: 000.",
    "Attach the yarn at the neck edge.",
    `Work needles ${leftWork}. The neck edge is ${leftNeck}, toward the center. The shoulder edge is ${leftOuter}, COL.`,
    "Knit this row. The carriage finishes at the neck edge, on the right of these working stitches. After this row, the row counter shows RC: 001.",
    ...shoulderPassLines(
      "left",
      leftPlan,
      parseNeedleLabel(leftNeck).index,
      parseNeedleLabel(leftOuter).index,
    ),
    ...finishLines("left", "second", leftPlan),
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
    row(0, [{ kind: "bindOff", side: "center", edge: "center", amount: input.plan.centerBindOff }]),
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
