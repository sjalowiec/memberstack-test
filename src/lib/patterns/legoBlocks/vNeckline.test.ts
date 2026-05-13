import { describe, expect, it } from "vitest";
import type { ShapingEvent } from "../shapingTimeline";
import { distributeEvenly } from "../shapingTimeline";
import { compressStitchDecreasePointsToNotationLines } from "../shapingNotationCompress";
import {
  buildVNecklinePlan,
  calculateVNeckNeckEdgePlan,
  distributeVNeckInnerDecreaseRows,
  neckDecreaseStitchesPerSideFromOpening,
  vNeckPlanToInnerEdgeEventsByRow,
} from "./vNeckline";

describe("distributeEvenly (generic)", () => {
  it("returns [] for invalid args", () => {
    expect(distributeEvenly(0, 10, 20)).toEqual([]);
    expect(distributeEvenly(3, 20, 10)).toEqual([]);
  });

  it("when count exceeds span, repeats RCs using row packing", () => {
    const rows = distributeEvenly(5, 10, 12);
    expect(rows.length).toBe(5);
    expect(rows.filter((r) => r === 10).length).toBe(2);
    expect(rows.filter((r) => r === 11).length).toBe(2);
    expect(rows.filter((r) => r === 12).length).toBe(1);
  });
});

describe("distributeVNeckInnerDecreaseRows", () => {
  it("uses one decrease per row when count equals span (every row)", () => {
    expect(distributeVNeckInnerDecreaseRows(5, 50, 54)).toEqual([50, 51, 52, 53, 54]);
  });

  it("anchors first at start and last at end with gap lengths differing by at most 1 when count < span", () => {
    expect(distributeVNeckInnerDecreaseRows(3, 50, 59)).toEqual([50, 55, 59]);
  });

  it("delegates to distributeEvenly when count > span", () => {
    const a = distributeVNeckInnerDecreaseRows(5, 10, 12);
    const b = distributeEvenly(5, 10, 12);
    expect(a).toEqual(b);
  });

  it("places a single decrease at startRow", () => {
    expect(distributeVNeckInnerDecreaseRows(1, 100, 200)).toEqual([100]);
  });
});

describe("calculateVNeckNeckEdgePlan", () => {
  it("derives per-side decreases and event rows", () => {
    const plan = calculateVNeckNeckEdgePlan({
      stitchesAfterArmhole: 120,
      neckOpeningStitches: 40,
      vNeckStartRow: 50,
      shoulderEndRow: 59,
      side: "left",
    });
    expect(plan.neckDecreaseStitchesPerSide).toBe(20);
    expect(plan.shapingRowsAvailable).toBe(10);
    expect(plan.decreaseRows.length).toBe(20);
    expect(Math.min(...plan.decreaseRows)).toBe(50);
    expect(Math.max(...plan.decreaseRows)).toBe(59);

    const byRow = vNeckPlanToInnerEdgeEventsByRow(plan);
    let sum = 0;
    for (const evs of byRow.values()) {
      for (const e of evs) {
        if (e.edge === "inner" && e.kind === "decrease") sum += e.amount;
      }
    }
    expect(sum).toBe(20);
    expect(byRow.get(50)?.[0]).toMatchObject({
      kind: "decrease",
      side: "left",
      edge: "inner",
    });
  });

  it("every-row plan when decreases equal row span", () => {
    const plan = calculateVNeckNeckEdgePlan({
      stitchesAfterArmhole: 100,
      neckOpeningStitches: 24,
      vNeckStartRow: 80,
      shoulderEndRow: 91,
      side: "left",
    });
    expect(plan.neckDecreaseStitchesPerSide).toBe(12);
    expect(plan.shapingRowsAvailable).toBe(12);
    expect(plan.decreaseRows).toEqual([80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91]);
  });

  it("neckDecreaseStitchesPerSide matches floor(N/2)", () => {
    expect(neckDecreaseStitchesPerSideFromOpening(41)).toBe(20);
    expect(neckDecreaseStitchesPerSideFromOpening(40)).toBe(20);
  });
});

describe("buildVNecklinePlan (Lego API for sleeveless + future sweater builders)", () => {
  it("returns a structured plan with row-by-row inner-edge events only", () => {
    const plan = buildVNecklinePlan({
      stitchesAfterArmhole: 120,
      neckWidthSts: 40,
      neckDepthRows: 10,
      rowGauge: 10,
      side: "left",
      firstShapingRow: 50,
      lastShapingRow: 59,
    });

    expect(plan.side).toBe("left");
    expect(plan.neckDecreaseStitchesPerSide).toBe(20);
    expect(plan.shapingRowsAvailable).toBe(10);
    expect(plan.decreaseRows.length).toBe(20);
    expect(Math.min(...plan.decreaseRows)).toBe(50);
    expect(Math.max(...plan.decreaseRows)).toBe(59);

    let innerSum = 0;
    for (const evs of plan.eventsByRow.values()) {
      for (const e of evs as ShapingEvent[]) {
        expect(e.edge).toBe("inner");
        expect(e.side).toBe("left");
        expect(e.kind).toBe("decrease");
        innerSum += e.amount;
      }
    }
    expect(innerSum).toBe(20);
  });

  it("does not include any shoulder (outer-edge) events", () => {
    const plan = buildVNecklinePlan({
      stitchesAfterArmhole: 100,
      neckWidthSts: 24,
      neckDepthRows: 12,
      side: "right",
      firstShapingRow: 80,
      lastShapingRow: 91,
    });

    for (const evs of plan.eventsByRow.values()) {
      for (const e of evs as ShapingEvent[]) {
        expect(e.edge).not.toBe("outer");
        expect(e.side).toBe("right");
      }
    }
  });

  it("warns when neckDepthRows disagrees with the explicit row span (no math change)", () => {
    const plan = buildVNecklinePlan({
      stitchesAfterArmhole: 120,
      neckWidthSts: 40,
      neckDepthRows: 8,
      side: "left",
      firstShapingRow: 50,
      lastShapingRow: 59,
    });

    expect(plan.shapingRowsAvailable).toBe(10);
    expect(plan.warnings.some((w) => w.includes("row budget mismatch"))).toBe(true);
  });
});

describe("V-neck plan vs Japanese notation grouping", () => {
  it("every-row plan (stitches === rows) compresses to a single 1s-1r-Nx segment", () => {
    const rows = distributeVNeckInnerDecreaseRows(26, 100, 125);
    expect(rows).toHaveLength(26);
    const pts = rows.map((row) => ({ row, amount: 1 }));
    expect(compressStitchDecreasePointsToNotationLines(pts)).toEqual(["1s-1r-26x"]);
  });

  it("spaced plan (stitches < rows) yields at most two distinct row intervals between decreases", () => {
    const rows = distributeVNeckInnerDecreaseRows(7, 50, 69);
    const gaps: number[] = [];
    for (let k = 1; k < rows.length; k++) {
      gaps.push(rows[k]! - rows[k - 1]!);
    }
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
  });
});
