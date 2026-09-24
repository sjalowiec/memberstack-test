/**
 * Customer-facing Sideways Cardigan BODY instructions.
 * Adapts {@link SidewaysCardiganBodyInstructions} onto Sleeveless display rows.
 * Does not recompute measurements or landmarks.
 */

import { buildGlossaryTooltipPlaceholderHtml } from "../glossary/glossaryTooltipPrint";
import { formatSidewaysHeldStitchCensus, formatStitchesCount } from "./sidewaysCardiganDisplayFormat";
import {
  wrapPatternSectionHtml,
  renderPatternDisplayRowsHtml,
} from "./sleevelessPatternDisplayHtml";
import { buildPatternQuickTipInnerHtml } from "./patternQuickTip";
import {
  formatRcColon,
  type SleevelessPatternDisplayRow,
} from "./sleevelessPatternOutput";
import type { SleevelessBodyShapingChartRow } from "./sleevelessBodyShapingChartHtml";
import type {
  SidewaysCardiganBodyInstructions,
  SidewaysCardiganBodyInstructionStep,
} from "./sidewaysCardiganBodyInstructions";

export { shortRowActionRowCounters } from "./sidewaysCardiganBodyInstructions";

export const SHORT_ROW_INCREASE_GLOSSARY_ID = 1789995174575;
export const SHORT_ROW_DECREASE_GLOSSARY_ID = 1789995192454;
export const SHORT_ROW_PARTIAL_KNITTING_GLOSSARY_ID = 811;
export const EVERY_OTHER_ROW_GLOSSARY_ID = 182;
export const MANUAL_WRAP_GLOSSARY_ID = 718;
export const CAST_ON_RAG_GLOSSARY_ID = 339;
export const EWRAP_CAST_ON_GLOSSARY_ID = 312;
export const RAVEL_CORD_GLOSSARY_ID = 249;
export const CLOSED_CAST_ON_GLOSSARY_ID = 263;

const BODY_PIECE_TITLE = "BODY";
const SIDEWAYS_COMPLETED_ROWS_LABEL = "Completed rows";

export const SIDEWAYS_CARDIGAN_BODY_SECTION_TITLES = [
  "BEFORE YOU BEGIN",
  "CAST ON",
  "FIRST V-NECK",
  "FIRST FRONT SHOULDER",
  "FIRST ARMHOLE",
  "FIRST BACK SHOULDER",
  "BACK NECK",
  "SECOND BACK SHOULDER",
  "SECOND ARMHOLE",
  "SECOND FRONT SHOULDER",
  "SECOND V-NECK",
  "BIND OFF",
] as const;

function escAttr(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function g(glossaryId: number, visibleText: string): string {
  return buildGlossaryTooltipPlaceholderHtml(glossaryId, visibleText, escAttr, (s) => s);
}

function requireStep(
  instructions: SidewaysCardiganBodyInstructions,
  id: string,
): SidewaysCardiganBodyInstructionStep {
  const step = instructions.steps.find((s) => s.id === id);
  if (!step) {
    throw new Error(`Sideways Cardigan instruction model is missing step "${id}".`);
  }
  return step;
}

export function compactSlopeSequence(
  sequence: readonly number[],
): { stitches: number; times: number }[] {
  const groups: { stitches: number; times: number }[] = [];
  for (const stitches of sequence) {
    const last = groups[groups.length - 1];
    if (last && last.stitches === stitches) last.times += 1;
    else groups.push({ stitches, times: 1 });
  }
  return groups;
}

function timesPhrase(times: number): string {
  return times === 1 ? "once" : `${times} times`;
}

function slopeProseLines(sequence: readonly number[], returningFromHold: boolean): string[] {
  const verb = returningFromHold ? "Return" : "Place";
  const prep = returningFromHold ? "to work" : "into hold";
  return compactSlopeSequence(sequence).map(
    (group) =>
      `${verb} ${formatStitchesCount(group.stitches)} ${prep} ${timesPhrase(group.times)}.`,
  );
}

function shapingChartRows(
  rcs: readonly number[],
  deltas: readonly number[],
  workingAfter: readonly number[],
  returningFromHold: boolean,
): SleevelessBodyShapingChartRow[] {
  const actionVerb = returningFromHold ? "Return" : "Place";
  const prep = returningFromHold ? "to work" : "into hold";
  return rcs.map((rc, i) => ({
    rc,
    action: `${actionVerb} ${formatStitchesCount(deltas[i] ?? 0)} ${prep}`,
    stitchesRemaining: workingAfter[i] ?? 0,
  }));
}

function section(title: string): Extract<SleevelessPatternDisplayRow, { kind: "section" }> {
  return { kind: "section", title };
}

function heldCensus(working: number, held: number, total: number) {
  return { working, held, total };
}

function startStateCount(args: { working: number; held: number; total: number }): {
  stitchCount?: number;
  stitchCensus?: { working: number; held: number; total: number };
} {
  if (args.held > 0) return { stitchCensus: heldCensus(args.working, args.held, args.total) };
  return { stitchCount: args.total };
}

function castOnHelpTip(tipId: string, bodyHtml: string) {
  return {
    tipHtml: buildPatternQuickTipInnerHtml({
      summaryLabel: "Cast-on method",
      bodyHtml,
    }),
    tipHtmlIsFull: true as const,
    tipPresentation: "quick-tip" as const,
    tipId,
  };
}

function block(args: {
  rc?: number;
  paragraphs?: string[];
  trustedParagraphs?: string[];
  stitchCount?: number;
  stitchCensus?: { working: number; held: number; total: number };
  bodyShapingChartRows?: SleevelessBodyShapingChartRow[];
  bodyShapingChartId?: string;
  bodyShapingChartCompletedRowsLabel?: string;
  tipHtml?: string;
  tipHtmlIsFull?: boolean;
  tipPresentation?: "quick-tip" | "help-card";
  tipId?: string;
}): Extract<SleevelessPatternDisplayRow, { kind: "block" }> {
  return {
    kind: "block",
    ...(args.rc !== undefined ? { rc: formatRcColon(args.rc) } : {}),
    paragraphs: args.paragraphs ?? [],
    ...(args.trustedParagraphs ? { trustedParagraphs: args.trustedParagraphs } : {}),
    ...(args.tipHtml ? { tipHtml: args.tipHtml } : {}),
    ...(args.tipHtmlIsFull ? { tipHtmlIsFull: true as const } : {}),
    ...(args.tipPresentation ? { tipPresentation: args.tipPresentation } : {}),
    ...(args.tipId ? { tipId: args.tipId } : {}),
    ...(args.stitchCount !== undefined ? { stitchCount: args.stitchCount } : {}),
    ...(args.stitchCensus ? { stitchCensus: args.stitchCensus } : {}),
    ...(args.bodyShapingChartRows ? { bodyShapingChartRows: args.bodyShapingChartRows } : {}),
    ...(args.bodyShapingChartId ? { bodyShapingChartId: args.bodyShapingChartId } : {}),
    ...(args.bodyShapingChartCompletedRowsLabel
      ? { bodyShapingChartCompletedRowsLabel: args.bodyShapingChartCompletedRowsLabel }
      : {}),
  };
}

/**
 * Cardigan BODY display rows only. Pullover returns an empty list so its
 * existing numbered sequence is left unchanged.
 */
export function buildSidewaysCardiganBodyDisplayRows(
  instructions: SidewaysCardiganBodyInstructions,
): SleevelessPatternDisplayRow[] {
  if (instructions.garmentStyle !== "cardigan") return [];

  const { calc, firstV, secondV, landmarks, startingFrontStitches, backNeckLiveStitches } =
    instructions;
  const fullWidth = calc.garmentLengthStitches;
  const vSts = calc.vNeckDepthStitches;
  const armhole = calc.armholeDepthStitches;
  const backNeck = calc.backNeckDepthStitches;
  const firstVStep = requireStep(instructions, "first-v-neck");
  const secondVStep = requireStep(instructions, "second-v-neck");
  const firstVActionRcs = firstV.actionRowCounters;
  const secondVActionRcs = secondV.actionRowCounters;
  const lastDecreaseWorking = secondV.workingStitchesAfterAction.at(-1) ?? startingFrontStitches;
  const lastDecreaseHeld = secondV.heldStitchesAfterAction.at(-1) ?? vSts;
  const heldStartCensus = formatSidewaysHeldStitchCensus({
    working: startingFrontStitches,
    held: vSts,
    total: fullWidth,
  });
  const lastDecreaseCensus = formatSidewaysHeldStitchCensus({
    working: lastDecreaseWorking,
    held: lastDecreaseHeld,
    total: fullWidth,
  });
  const allWorkingCount = `${fullWidth} sts`;

  const increasePh = g(SHORT_ROW_INCREASE_GLOSSARY_ID, "Short-row Increase");
  const decreasePh = g(SHORT_ROW_DECREASE_GLOSSARY_ID, "Short-row Decrease");
  const eorPh = g(EVERY_OTHER_ROW_GLOSSARY_ID, "every other row");
  const wrapPh = g(MANUAL_WRAP_GLOSSARY_ID, "manually wrap");
  const ravelPh = g(RAVEL_CORD_GLOSSARY_ID, "ravel cord");
  const closedPh = g(CLOSED_CAST_ON_GLOSSARY_ID, "closed cast-on");
  const ewrapPh = g(EWRAP_CAST_ON_GLOSSARY_ID, "e-wrap");
  const ragPh = g(CAST_ON_RAG_GLOSSARY_ID, "cast-on rag");

  return [
    { kind: "piece", title: BODY_PIECE_TITLE },
    block({
      paragraphs: [
        "The cardigan body is knitted sideways in one piece, beginning at one center-front edge and ending at the other. Two armhole openings are knitted into the body.",
      ],
    }),
    section("BEFORE YOU BEGIN"),
    block({
      trustedParagraphs: [
        `V-neck shaping is worked with ${g(SHORT_ROW_PARTIAL_KNITTING_GLOSSARY_ID, "short rows")} (${increasePh} and ${decreasePh}).`,
        `Shaping is performed ${eorPh}.`,
        "Move needles into or out of hold opposite the carriage.",
        `${g(MANUAL_WRAP_GLOSSARY_ID, "Manually wrap")} at each shaping turn to prevent holes.`,
        "Keep the row counter running continuously through the body.",
      ],
    }),
    section("CAST ON"),
    block({
      rc: 0,
      trustedParagraphs: [
        `Bring ${fullWidth} needles into work.`,
        `Scrap on across all ${fullWidth} needles to provide fabric for weights.`,
        `Knit one row of ${ravelPh}.`,
        `Work a ${closedPh} with garment yarn across all ${fullWidth} needles.`,
        `Set ${formatRcColon(0)}.`,
        `Place the ${vSts} neckline stitches into hold.`,
        `Leave ${startingFrontStitches} body stitches working.`,
        `Continue with ${heldStartCensus}.`,
      ],
      ...startStateCount({ working: fullWidth, held: 0, total: fullWidth }),
    }),
    section("FIRST V-NECK"),
    block({
      rc: firstVStep.rowCounterStart,
      trustedParagraphs: [
        `Begin with ${startingFrontStitches} stitches working and ${vSts} stitches held.`,
        `Knit ${firstV.rowInterval} rows over the ${startingFrontStitches} working stitches before the first return-to-work action.`,
        `Work a ${increasePh} over ${firstV.rows} rows:`,
        ...slopeProseLines(instructions.increaseSequence, true),
        `Work each action ${eorPh}.`,
        `Move needles opposite the carriage and ${wrapPh}.`,
        `After the final action, all ${fullWidth} stitches are in work.`,
        `End at ${formatRcColon(firstVStep.rowCounterEnd)} with ${allWorkingCount}.`,
      ],
      ...startStateCount({
        working: startingFrontStitches,
        held: vSts,
        total: fullWidth,
      }),
      bodyShapingChartId: "sideways-cardigan-first-v-neck",
      bodyShapingChartCompletedRowsLabel: SIDEWAYS_COMPLETED_ROWS_LABEL,
      bodyShapingChartRows: shapingChartRows(
        firstVActionRcs,
        firstV.stitchesChangedOnAction,
        firstV.workingStitchesAfterAction,
        true,
      ),
    }),
    section("FIRST FRONT SHOULDER"),
    block({
      rc: firstVStep.rowCounterEnd,
      paragraphs: [
        `The first row knits across all ${fullWidth} stitches.`,
        `Knit ${instructions.sectionRowCounts.firstFrontShoulder} rows even on ${fullWidth} stitches.`,
        `End at ${formatRcColon(landmarks.firstSideSeam)}.`,
      ],
      stitchCount: fullWidth,
    }),
    section("FIRST ARMHOLE"),
    block({
      rc: landmarks.firstSideSeam,
      trustedParagraphs: [
        `At ${formatRcColon(landmarks.firstSideSeam)}:`,
        `At the neck edge, bind off the ${armhole} armhole stitches.`,
        `Immediately cast on ${armhole} stitches.`,
        `Continue with ${fullWidth} stitches.`,
      ],
      ...castOnHelpTip(
        "sideways-cardigan-cast-on-first-armhole",
        `<p>Recommend an ${ewrapPh} cast-on, but you may use the cast-on method of your choice.</p>` +
          `<p>Use a ${ragPh} as needed to support and weight the new stitches.</p>`,
      ),
      stitchCount: fullWidth,
    }),
    section("FIRST BACK SHOULDER"),
    block({
      rc: landmarks.firstSideSeam,
      paragraphs: [
        `Knit ${instructions.sectionRowCounts.firstBackShoulder} rows even.`,
        `End at ${formatRcColon(landmarks.firstBackNeckEdge)}.`,
      ],
      stitchCount: fullWidth,
    }),
    section("BACK NECK"),
    block({
      rc: landmarks.firstBackNeckEdge,
      trustedParagraphs: [
        "At the neck edge:",
        `Bind off the ${backNeck} back-neck-depth stitches.`,
        `Knit ${instructions.sectionRowCounts.backNeckOpening} rows on the remaining ${backNeckLiveStitches} stitches.`,
        `End at ${formatRcColon(landmarks.secondBackNeckEdge)}.`,
        `Cast the ${backNeck} stitches back on.`,
        `Continue knitting over ${fullWidth} stitches.`,
      ],
      ...castOnHelpTip(
        "sideways-cardigan-cast-on-back-neck",
        `<p>Recommend an ${ewrapPh}, while allowing the cast-on method of your choice.</p>`,
      ),
      stitchCount: fullWidth,
    }),
    section("SECOND BACK SHOULDER"),
    block({
      rc: landmarks.secondBackNeckEdge,
      paragraphs: [
        `Knit ${instructions.sectionRowCounts.secondBackShoulder} rows even.`,
        `End at ${formatRcColon(landmarks.secondSideSeam)}.`,
      ],
      stitchCount: fullWidth,
    }),
    section("SECOND ARMHOLE"),
    block({
      rc: landmarks.secondSideSeam,
      trustedParagraphs: [
        `At ${formatRcColon(landmarks.secondSideSeam)}, repeat the first armhole shaping using ${armhole} stitches.`,
        `Continue knitting over ${fullWidth} stitches.`,
      ],
      stitchCount: fullWidth,
    }),
    section("SECOND FRONT SHOULDER"),
    block({
      rc: landmarks.secondSideSeam,
      paragraphs: [
        `Knit ${instructions.sectionRowCounts.secondFrontShoulder} rows even.`,
        `End at ${formatRcColon(landmarks.startFinalVShaping)}.`,
      ],
      stitchCount: fullWidth,
    }),
    section("SECOND V-NECK"),
    block({
      rc: secondVStep.rowCounterStart,
      trustedParagraphs: [
        `Begin with all ${fullWidth} stitches in work.`,
        `Work a ${decreasePh} using the reversed slope sequence:`,
        ...slopeProseLines(instructions.decreaseSequence, false),
        `Work actions ${eorPh}.`,
        `Move needles opposite the carriage and ${wrapPh}.`,
        `After the last short-row action, ${lastDecreaseCensus}.`,
        `During the final two-row interval, return all held stitches to work and knit across all ${fullWidth} stitches to enclose the wraps.`,
        `End at ${formatRcColon(landmarks.endSecondVShaping)}, not ${formatRcColon(landmarks.endSecondVShaping + 1)}, with ${allWorkingCount}.`,
      ],
      ...startStateCount({ working: fullWidth, held: 0, total: fullWidth }),
      bodyShapingChartId: "sideways-cardigan-second-v-neck",
      bodyShapingChartCompletedRowsLabel: SIDEWAYS_COMPLETED_ROWS_LABEL,
      bodyShapingChartRows: shapingChartRows(
        secondVActionRcs,
        secondV.stitchesChangedOnAction,
        secondV.workingStitchesAfterAction,
        false,
      ),
    }),
    section("BIND OFF"),
    block({
      rc: landmarks.finalBindOff,
      paragraphs: [`Bind off all ${fullWidth} stitches loosely.`],
    }),
  ];
}

export function renderSidewaysCardiganBodyDisplayHtml(
  instructions: SidewaysCardiganBodyInstructions,
): string {
  const rows = buildSidewaysCardiganBodyDisplayRows(instructions);
  if (rows.length === 0) return "";
  const inner = renderPatternDisplayRowsHtml(rows, {
    pieceSectionId: "body",
    omitPieceBanner: true,
  });
  return wrapPatternSectionHtml("sg-body", BODY_PIECE_TITLE, inner, {
    sectionClassName: "pattern-section--garment-piece",
  });
}
