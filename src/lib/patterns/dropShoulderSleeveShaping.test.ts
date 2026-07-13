import { describe, expect, it } from "vitest";
import { formatParentheticalShapingRowNumbers } from "./evenShapingSchedule";
import {
  dropShoulderSleevePreShapingSpan,
  dropShoulderSleeveShapingRcSequence,
} from "./dropShoulderSleeveShapingChart";
import {
  dropShoulderSleeveShapingPlan,
  dropShoulderSleeveShapingPlanForDirection,
  formatDropShoulderSleeveShapingNotation,
  formatDropShoulderSleeveShapingWrittenLines,
} from "./dropShoulderSleeveShaping";

const CUFF_UP_CHART_INPUT = {
  topSts: 80,
  wristSts: 40,
  cuffRows: 20,
  sleeveBodyRows: 100,
  sleeveTotalRows: 120,
  direction: "cuff-up" as const,
};

const TOP_DOWN_CHART_INPUT = {
  ...CUFF_UP_CHART_INPUT,
  direction: "top-down" as const,
};

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
    const rcList = dropShoulderSleeveShapingRcSequence(CUFF_UP_CHART_INPUT);
    expect(formatDropShoulderSleeveShapingWrittenLines(plan.shapingDirection, plan.steps)).toEqual([
      "Increase 1 stitch at each side every 4 rows 20 times.",
    ]);
    expect(
      formatDropShoulderSleeveShapingWrittenLines(plan.shapingDirection, plan.steps, rcList),
    ).toEqual([
      `Increase 1 stitch at each side every 4 rows 20 times. ${formatParentheticalShapingRowNumbers(rcList)}`,
    ]);
  });

  it("formats explicit top-down decrease wording", () => {
    const plan = dropShoulderSleeveShapingPlanForDirection(tapered, "top-down");
    const rcList = dropShoulderSleeveShapingRcSequence(TOP_DOWN_CHART_INPUT);
    expect(formatDropShoulderSleeveShapingWrittenLines(plan.shapingDirection, plan.steps)).toEqual([
      "Decrease 1 stitch at each side every 4 rows 20 times.",
    ]);
    expect(
      formatDropShoulderSleeveShapingWrittenLines(plan.shapingDirection, plan.steps, rcList),
    ).toEqual([
      `Decrease 1 stitch at each side every 4 rows 20 times. ${formatParentheticalShapingRowNumbers(rcList)}`,
    ]);
  });

  it("formats multi-interval shaping in one line with then-clauses", () => {
    const rcList = [10, 16, 22, 28, 30, 38, 46];
    const lines = formatDropShoulderSleeveShapingWrittenLines(
      "increase",
      [
        { sts: 1, rows: 6, times: 4 },
        { sts: 1, rows: 8, times: 3 },
      ],
      rcList,
    );
    expect(lines).toEqual([
      `Increase 1 stitch at each side every 6 rows 4 times, then every 8 rows 3 times. ${formatParentheticalShapingRowNumbers(rcList)}`,
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

describe("dropShoulderSleevePreShapingSpan", () => {
  it("derives straight rows before the first shaping RC (cuff-up)", () => {
    expect(dropShoulderSleevePreShapingSpan(CUFF_UP_CHART_INPUT)).toEqual({
      bodyStartRc: 20,
      firstShapingRc: 24,
      straightRows: 4,
    });
  });

  it("derives straight rows from sleeve-body start for top-down", () => {
    expect(dropShoulderSleevePreShapingSpan(TOP_DOWN_CHART_INPUT)).toEqual({
      bodyStartRc: 0,
      firstShapingRc: 4,
      straightRows: 4,
    });
  });

  it("returns zero straight rows when there is no shaping", () => {
    expect(
      dropShoulderSleevePreShapingSpan({
        ...CUFF_UP_CHART_INPUT,
        topSts: 40,
        wristSts: 40,
      }),
    ).toEqual({
      bodyStartRc: 20,
      firstShapingRc: undefined,
      straightRows: 0,
    });
  });
});
