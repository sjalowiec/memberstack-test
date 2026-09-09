/**
 * Numeric Sideways V-Neck sleeve instruction model (no written knitting copy).
 *
 * Cuff-up and top-down are reverse constructions of the same Drop Shoulder sleeve
 * dimensions. Sideways-knit sleeves are not generated.
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
  SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS,
} from "./sidewaysCardiganConstructionIdentity";

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
  const { shapingPlan, topSts, wristSts, sleeveBodyRows } = calc;
  const delta = Math.abs(topSts - wristSts);
  if (shapingPlan.noShaping || delta === 0) {
    return `Knit ${sleeveBodyRows} rows (sleeve body, ${wristSts} stitches)`;
  }
  const verb = shapingPlan.shapingDirection === "decrease" ? "Decrease" : "Increase";
  const start = calc.direction === "top-down" ? topSts : wristSts;
  const end = calc.direction === "top-down" ? wristSts : topSts;
  const step0 = shapingPlan.steps[0];
  const intervalText =
    step0 && step0.times > 0 && step0.rows > 0
      ? `; every ${step0.rows} rows ${step0.times} ${step0.times === 1 ? "time" : "times"}`
      : "";
  const remainder =
    shapingPlan.remainderRows > 0
      ? `, then knit ${shapingPlan.remainderRows} rows even`
      : "";
  return `${verb} ${delta} stitches over ${sleeveBodyRows} rows (${start} → ${end})${intervalText}${remainder}`;
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

export function renderSidewaysCardiganSleeveSequenceHtml(
  instructions: SidewaysCardiganSleeveInstructions,
): string {
  const label = SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS[instructions.direction];
  const intro = `${label} sleeve: temporary numeric sequence (make 2).`;
  const items = instructions.steps
    .map((s) => `<li>${escapeHtml(s.summary)}</li>`)
    .join("");
  return `<p class="sg-fit-size-copy sideways-sleeve-style-note">${escapeHtml(intro)}</p><ol class="sideways-sleeve-sequence">${items}</ol>`;
}

export function renderSidewaysSleeveNotConnectedHtml(): string {
  return `<p class="sg-fit-size-copy" data-sideways-sleeve-not-connected>${escapeHtml(SIDEWAYS_SLEEVE_NOT_CONNECTED_NOTICE)}</p>`;
}
