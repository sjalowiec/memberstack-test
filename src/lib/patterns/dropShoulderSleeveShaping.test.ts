import { describe, expect, it } from "vitest";
import {
  dropShoulderSleeveShapingPlan,
  dropShoulderSleeveShapingPlanForDirection,
  formatDropShoulderSleeveShapingNotation,
  formatDropShoulderSleeveShapingWrittenLines,
} from "./dropShoulderSleeveShaping";

describe("dropShoulderSleeveShaping", () => {
  const tapered = { topSts: 80, wristSts: 40, sleeveBodyRows: 100 };

  it("derives shaping steps from sleeveEvenShapingSchedule", () => {
    const plan = dropShoulderSleeveShapingPlan(tapered);
    expect(plan.noShaping).toBe(false);
    expect(plan.steps).toEqual([{ sts: 1, rows: 4, times: 20 }]);
    expect(plan.remainderRows).toBe(20);
    expect(plan.schedule).toEqual({ interval: 4, count: 20, remainderRows: 20 });
  });

  it("formats explicit bottom-up increase wording", () => {
    const plan = dropShoulderSleeveShapingPlanForDirection(tapered, "cuff-up");
    expect(formatDropShoulderSleeveShapingWrittenLines(plan.shapingDirection, plan.steps)).toEqual([
      "Increase 1 stitch at each side every 4 rows 20 times.",
    ]);
  });

  it("formats explicit top-down decrease wording", () => {
    const plan = dropShoulderSleeveShapingPlanForDirection(tapered, "top-down");
    expect(formatDropShoulderSleeveShapingWrittenLines(plan.shapingDirection, plan.steps)).toEqual([
      "Decrease 1 stitch at each side every 4 rows 20 times.",
    ]);
  });

  it("formats multi-interval shaping in one line with then-clauses", () => {
    const lines = formatDropShoulderSleeveShapingWrittenLines("increase", [
      { sts: 1, rows: 6, times: 4 },
      { sts: 1, rows: 8, times: 3 },
    ]);
    expect(lines).toEqual([
      "Increase 1 stitch at each side every 6 rows 4 times, then every 8 rows 3 times.",
    ]);
  });

  it("formats Japanese notation from the same steps", () => {
    const plan = dropShoulderSleeveShapingPlan(tapered);
    expect(formatDropShoulderSleeveShapingNotation(plan.steps)).toBe("1s-4r-20x");
    expect(
      formatDropShoulderSleeveShapingNotation([
        { sts: 1, rows: 6, times: 4 },
        { sts: 1, rows: 8, times: 3 },
      ]),
    ).toBe("1s-6r-4x, 1s-8r-3x");
  });

  it("marks equal cuff and upper-arm as no shaping", () => {
    const plan = dropShoulderSleeveShapingPlan({ topSts: 40, wristSts: 40, sleeveBodyRows: 100 });
    expect(plan.noShaping).toBe(true);
    expect(plan.steps).toEqual([]);
    expect(plan.remainderRows).toBe(100);
  });
});
