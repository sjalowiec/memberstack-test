/**
 * Sideways V-Neck sleeve instructions for a flat, seamed sleeve.
 *
 * Cuff-up and top-down reuse the Drop Shoulder sleeve display rows, shaping
 * schedule, and written lines. Sideways-knit sleeves are not generated.
 */

import {
  calculateSidewaysCardiganSleeve,
  SIDEWAYS_CARDIGAN_SLEEVE_NOT_CONNECTED,
  SIDEWAYS_SLEEVE_NOT_CONNECTED_NOTICE,
  type SidewaysCardiganConventionalSleeveDirection,
  type SidewaysCardiganSleeveCalc,
  type SidewaysCardiganSleeveCalcError,
  type SidewaysCardiganSleeveCalcInput,
} from "./sidewaysCardiganSleeveCalc";
import {
  dropShoulderSleeveShapingRcSequence,
} from "./dropShoulderSleeveShapingChart";
import { formatDropShoulderSleeveShapingWrittenLines } from "./dropShoulderSleeveShaping";
import { type SidewaysCardiganSleeveDirection } from "./sidewaysCardiganConstructionIdentity";
import { buildDropShoulderSleeveDisplayRows } from "./dropShoulderPatternOutput";
import {
  renderPatternDisplayRowsHtml,
  wrapPatternSectionHtml,
} from "./sleevelessPatternDisplayHtml";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import {
  readStoredDropShoulderSleeveConstruction,
  renderSleeveConstructionChoiceHtml,
  SIDEWAYS_SLEEVE_CONSTRUCTION_CHOICE_TIP_ID,
  SIDEWAYS_SLEEVE_CONSTRUCTION_CUFF_UP_LABEL,
  SIDEWAYS_SLEEVE_CONSTRUCTION_TOP_DOWN_LABEL,
  sidewaysSleeveConstructionChoiceQuickTipInnerHtml,
} from "./dropShoulderSleeveConstruction";

export type SidewaysCardiganSleeveInstructionStep = {
  id: string;
  order: number;
  summary: string;
  rows: number;
  stitchesBefore: number;
  stitchesAfter: number;
  rowCounterStart: number;
  rowCounterEnd: number;
};

export type SidewaysCardiganSleeveInstructions = {
  direction: SidewaysCardiganConventionalSleeveDirection;
  calc: SidewaysCardiganSleeveCalc;
  steps: SidewaysCardiganSleeveInstructionStep[];
};

export type SidewaysCardiganSleeveInstructionResult =
  | { ok: true; instructions: SidewaysCardiganSleeveInstructions }
  | { ok: false; error: SidewaysCardiganSleeveCalcError };

function step(args: {
  id: string;
  order: number;
  summary: string;
  rows: number;
  stitchesBefore: number;
  stitchesAfter: number;
  rowCounterStart: number;
}): SidewaysCardiganSleeveInstructionStep {
  return {
    ...args,
    rowCounterEnd: args.rowCounterStart + args.rows,
  };
}

type StepPusher = (
  partial: Omit<SidewaysCardiganSleeveInstructionStep, "rowCounterStart" | "rowCounterEnd">,
) => void;

function createStepPusher(steps: SidewaysCardiganSleeveInstructionStep[]): {
  push: StepPusher;
  live: () => number;
} {
  let rc = 0;
  let live = 0;
  return {
    live: () => live,
    push: (partial) => {
      const built = step({ ...partial, rowCounterStart: rc });
      steps.push(built);
      rc = built.rowCounterEnd;
      live = built.stitchesAfter;
    },
  };
}

function shapingScheduleSummary(calc: SidewaysCardiganSleeveCalc): string {
  const chartInput = {
    topSts: calc.topSts,
    wristSts: calc.wristSts,
    cuffRows: calc.cuffRows,
    sleeveBodyRows: calc.sleeveBodyRows,
    sleeveTotalRows: calc.sleeveTotalRows,
    direction: calc.direction,
  };
  const lines = formatDropShoulderSleeveShapingWrittenLines(
    calc.shapingPlan.shapingDirection,
    calc.shapingPlan.steps,
    dropShoulderSleeveShapingRcSequence(chartInput),
  ).map((line) => line.replace(/<[^>]+>/g, ""));
  if (lines.length > 0) return lines.join(" ");
  return `Knit ${calc.sleeveBodyRows} rows even (${calc.wristSts} stitches)`;
}

function buildCuffUpSteps(calc: SidewaysCardiganSleeveCalc): SidewaysCardiganSleeveInstructionStep[] {
  const steps: SidewaysCardiganSleeveInstructionStep[] = [];
  const { push, live } = createStepPusher(steps);
  push({
    id: "cast-on-wrist",
    order: 1,
    summary: `Cast on ${calc.wristSts} stitches (wrist)`,
    rows: 0,
    stitchesBefore: 0,
    stitchesAfter: calc.wristSts,
  });
  push({
    id: "cuff",
    order: 2,
    summary: `Knit ${calc.cuffRows} rows (cuff, ${calc.wristSts} stitches)`,
    rows: calc.cuffRows,
    stitchesBefore: live(),
    stitchesAfter: calc.wristSts,
  });
  push({
    id: "sleeve-body",
    order: 3,
    summary: shapingScheduleSummary(calc),
    rows: calc.sleeveBodyRows,
    stitchesBefore: live(),
    stitchesAfter: calc.topSts,
  });
  push({
    id: "bind-off-upper-arm",
    order: 4,
    summary: `Bind off ${calc.topSts} stitches (upper arm)`,
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: 0,
  });
  return steps;
}

function buildTopDownSteps(calc: SidewaysCardiganSleeveCalc): SidewaysCardiganSleeveInstructionStep[] {
  const steps: SidewaysCardiganSleeveInstructionStep[] = [];
  const { push, live } = createStepPusher(steps);
  push({
    id: "cast-on-upper-arm",
    order: 1,
    summary: `Cast on ${calc.topSts} stitches (upper arm)`,
    rows: 0,
    stitchesBefore: 0,
    stitchesAfter: calc.topSts,
  });
  push({
    id: "sleeve-body",
    order: 2,
    summary: shapingScheduleSummary(calc),
    rows: calc.sleeveBodyRows,
    stitchesBefore: live(),
    stitchesAfter: calc.wristSts,
  });
  push({
    id: "cuff",
    order: 3,
    summary: `Knit ${calc.cuffRows} rows (cuff, ${calc.wristSts} stitches)`,
    rows: calc.cuffRows,
    stitchesBefore: live(),
    stitchesAfter: calc.wristSts,
  });
  push({
    id: "bind-off-wrist",
    order: 4,
    summary: `Bind off ${calc.wristSts} stitches (wrist)`,
    rows: 0,
    stitchesBefore: live(),
    stitchesAfter: 0,
  });
  return steps;
}

export function buildSidewaysCardiganSleeveInstructions(
  input: SidewaysCardiganSleeveCalcInput,
): SidewaysCardiganSleeveInstructionResult {
  const calcResult = calculateSidewaysCardiganSleeve(input);
  if (!calcResult.ok) return calcResult;
  const { calc } = calcResult;
  const steps =
    calc.direction === "top-down" ? buildTopDownSteps(calc) : buildCuffUpSteps(calc);
  return {
    ok: true,
    instructions: {
      direction: calc.direction,
      calc,
      steps,
    },
  };
}

export function sidewaysSleeveNotConnectedResult(): SidewaysCardiganSleeveInstructionResult {
  return {
    ok: false,
    error: {
      code: SIDEWAYS_CARDIGAN_SLEEVE_NOT_CONNECTED,
      message: SIDEWAYS_SLEEVE_NOT_CONNECTED_NOTICE,
    },
  };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Drop Shoulder sleeve rows for this calculated cuff-up or top-down sleeve. */
export function buildSidewaysCardiganSleeveDisplayRows(
  calc: SidewaysCardiganSleeveCalc,
): SleevelessPatternDisplayRow[] {
  return buildDropShoulderSleeveDisplayRows({
    topSts: calc.topSts,
    wristSts: calc.wristSts,
    cuffRows: calc.cuffRows,
    sleeveBodyRows: calc.sleeveBodyRows,
    sleeveTotalRows: calc.sleeveTotalRows,
    direction: calc.direction,
    valid: true,
  });
}

export function renderSidewaysCardiganSleeveSequenceHtml(
  instructions: SidewaysCardiganSleeveInstructions,
): string {
  const rows = buildSidewaysCardiganSleeveDisplayRows(instructions.calc);
  const instructionsHtml = renderPatternDisplayRowsHtml(rows, {
    pieceSectionId: "sleeve",
    omitPieceBanner: true,
  });
  const choice = renderSleeveConstructionChoiceHtml({
    direction: instructions.direction,
    cuffUpLabel: SIDEWAYS_SLEEVE_CONSTRUCTION_CUFF_UP_LABEL,
    topDownLabel: SIDEWAYS_SLEEVE_CONSTRUCTION_TOP_DOWN_LABEL,
    tipInnerHtml: sidewaysSleeveConstructionChoiceQuickTipInnerHtml(),
    tipId: SIDEWAYS_SLEEVE_CONSTRUCTION_CHOICE_TIP_ID,
  });
  const split =
    `<div class="pattern-layout pattern-layout--garment-columns sleeveless-piece-split sleeveless-pattern-reading-layout sideways-sleeve-reading-layout" data-sideways-sleeve-layout>` +
    `<div class="pattern-layout__content sleeveless-piece-split__text sleeveless-pattern-reading-layout__instructions sideways-sleeve-reading-layout__instructions">${choice}${instructionsHtml}</div>` +
    `<aside class="pattern-layout__sidebar sleeveless-piece-split__diagram sleeveless-pattern-reading-layout__diagram sideways-sleeve-reading-layout__diagram pattern-print-keep-together" aria-label="Sleeve diagram" data-sideways-sleeve-diagram-tabs-mount></aside>` +
    `</div>`;
  return wrapPatternSectionHtml("sg-sleeve", "SLEEVE", split, {
    sectionClassName: "pattern-section--garment-piece",
  });
}

/**
 * Builder direction until the knitter changes the finished-pattern choice.
 * That change uses the same localStorage key as Drop Shoulder.
 */
export function resolveSidewaysFinishedSleeveDirection(
  builderDirection: SidewaysCardiganSleeveDirection,
  patternId: string,
): SidewaysCardiganConventionalSleeveDirection | "sideways" {
  if (builderDirection === "sideways") return "sideways";
  const stored = readStoredDropShoulderSleeveConstruction(patternId);
  if (stored) return stored;
  return builderDirection === "top-down" ? "top-down" : "cuff-up";
}

export function renderSidewaysSleeveSequenceForDirection(
  input: SidewaysCardiganSleeveCalcInput,
  direction: SidewaysCardiganConventionalSleeveDirection,
): { ok: true; html: string; instructions: SidewaysCardiganSleeveInstructions } | { ok: false; error: SidewaysCardiganSleeveCalcError } {
  const built = buildSidewaysCardiganSleeveInstructions({ ...input, direction });
  if (!built.ok) return built;
  return {
    ok: true,
    instructions: built.instructions,
    html: renderSidewaysCardiganSleeveSequenceHtml(built.instructions),
  };
}

export function renderSidewaysSleeveNotConnectedHtml(): string {
  return `<p class="sg-fit-size-copy" data-sideways-sleeve-not-connected>${escapeHtml(SIDEWAYS_SLEEVE_NOT_CONNECTED_NOTICE)}</p>`;
}
