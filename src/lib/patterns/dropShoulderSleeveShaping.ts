/**
 * Drop-shoulder sleeve shaping — single source of truth for written instructions,
 * row-by-row chart, and Japanese notation diagram tokens.
 *
 * Steps come from {@link sleeveEvenShapingSchedule} (one interval + remainder rows).
 */

import type { ShapingStep } from "../shaping/generateRowByRow";
import { formatShapingSegment } from "./sleevelessBackJapaneseNotation";
import {
  sleeveEvenShapingSchedule,
  sleeveShapingPerSide,
  type EvenShapingSchedule,
} from "./evenShapingSchedule";
import type { DropShoulderSleeveDirection } from "./dropShoulderSleeveConstruction";

export type DropShoulderSleeveShapingPlanInput = {
  topSts: number;
  wristSts: number;
  sleeveBodyRows: number;
};

export type DropShoulderSleeveShapingPlan = {
  steps: ShapingStep[];
  remainderRows: number;
  noShaping: boolean;
  /** Increase (bottom-up) or decrease (top-down). */
  shapingDirection: "increase" | "decrease";
  schedule: EvenShapingSchedule;
};

function rowIntervalPhrase(rowsBetween: number): string {
  if (rowsBetween <= 1) return "every row";
  return `every ${rowsBetween} rows`;
}

function timesWord(times: number): string {
  return times === 1 ? "time" : "times";
}

export function dropShoulderSleeveShapingPlan(
  input: DropShoulderSleeveShapingPlanInput,
): DropShoulderSleeveShapingPlan {
  const { topSts, wristSts, sleeveBodyRows } = input;
  const schedule = sleeveEvenShapingSchedule(topSts, wristSts, sleeveBodyRows);
  const shapingPerSide = sleeveShapingPerSide(topSts, wristSts);

  if (shapingPerSide <= 0 || sleeveBodyRows <= 0) {
    return {
      steps: [],
      remainderRows: Math.max(0, sleeveBodyRows),
      noShaping: true,
      shapingDirection: "increase",
      schedule,
    };
  }

  const steps: ShapingStep[] =
    schedule.count > 0 && schedule.interval > 0
      ? [{ sts: 1, rows: schedule.interval, times: schedule.count }]
      : [];

  return {
    steps,
    remainderRows: schedule.remainderRows,
    noShaping: steps.length === 0,
    shapingDirection: "increase",
    schedule,
  };
}

export function dropShoulderSleeveShapingPlanForDirection(
  input: DropShoulderSleeveShapingPlanInput,
  sleeveConstruction: DropShoulderSleeveDirection,
): DropShoulderSleeveShapingPlan {
  const plan = dropShoulderSleeveShapingPlan(input);
  return {
    ...plan,
    shapingDirection: sleeveConstruction === "top-down" ? "decrease" : "increase",
  };
}

/** Japanese notation segment(s), e.g. `1s-4r-20x` or `1s-6r-4x, 1s-8r-3x`. */
export function formatDropShoulderSleeveShapingNotation(steps: readonly ShapingStep[]): string {
  return steps
    .filter((s) => s.times > 0 && s.rows > 0)
    .map((s) => formatShapingSegment(s.sts, s.rows, s.times))
    .join(", ");
}

/**
 * Fully expanded written shaping line(s) for machine knitting (each side).
 * Example: `Increase 1 stitch at each side every 6 rows 4 times, then every 8 rows 3 times.`
 */
export function formatDropShoulderSleeveShapingWrittenLines(
  shapingDirection: "increase" | "decrease",
  steps: readonly ShapingStep[],
): string[] {
  const verb = shapingDirection === "decrease" ? "Decrease" : "Increase";
  const filtered = steps.filter((s) => s.times > 0 && s.rows > 0);
  if (filtered.length === 0) return [];

  if (filtered.length === 1) {
    const step = filtered[0]!;
    return [
      `${verb} 1 stitch at each side ${rowIntervalPhrase(step.rows)} ${step.times} ${timesWord(step.times)}.`,
    ];
  }

  const clauses = filtered.map(
    (step) => `${rowIntervalPhrase(step.rows)} ${step.times} ${timesWord(step.times)}`,
  );
  return [`${verb} 1 stitch at each side ${clauses[0]}, then ${clauses.slice(1).join(", then ")}.`];
}
