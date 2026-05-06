import { describe, expect, it } from "vitest";
import {
  calculateRoundNecklinePlan,
  calculateRoundNecklineShaping,
  initialCenterNeckStitches,
  neckEdgeDecreasesPerSide,
  partitionNecklineThirds,
  rowsRequiredForDeepPlan,
  stairBindOffStepsForSide,
} from "./roundNeckline";

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

describe("calculateRoundNecklineShaping", () => {
  it("53 stitches: ~thirds center/stair/singles and totalCheck 53", () => {
    const p = calculateRoundNecklineShaping({ necklineStitches: 53 });
    expect(p.centerBindOff).toBe(17);
    expect(sum(p.left.stairSteps) + sum(p.right.stairSteps)).toBe(18);
    expect(p.left.singleDecreaseCount + p.right.singleDecreaseCount).toBe(18);
    expect(p.totalCheck).toBe(53);
    expect(p.necklineStitches).toBe(53);
  });

  it("even total: 54 stitches thirds 18/18/18", () => {
    const p = calculateRoundNecklineShaping({ necklineStitches: 54 });
    expect(partitionNecklineThirds(54)).toEqual([18, 18, 18]);
    expect(p.totalCheck).toBe(54);
    expect(Math.abs(p.left.singleDecreaseCount - p.right.singleDecreaseCount)).toBeLessThanOrEqual(1);
  });

  it("odd total: 52 stitches partitions sum to 52", () => {
    const p = calculateRoundNecklineShaping({ necklineStitches: 52 });
    expect(p.totalCheck).toBe(52);
    expect(p.centerBindOff).toBe(16);
    expect(p.left.stairSteps).toEqual([3, 3, 3]);
    expect(p.right.stairSteps).toEqual([3, 3, 3]);
    expect(p.left.singleDecreaseCount).toBe(9);
    expect(p.right.singleDecreaseCount).toBe(9);
  });

  it("small N: 10 stitches totals match", () => {
    const p = calculateRoundNecklineShaping({ necklineStitches: 10 });
    expect(p.totalCheck).toBe(10);
  });

  it("totals always equal necklineStitches for a range of N", () => {
    for (let n = 0; n <= 120; n++) {
      const p = calculateRoundNecklineShaping({ necklineStitches: n });
      expect(p.totalCheck).toBe(n);
    }
  });

  it("stair steps use only 2 and 3 when non-empty", () => {
    for (let n = 3; n <= 120; n++) {
      const p = calculateRoundNecklineShaping({ necklineStitches: n });
      for (const v of [...p.left.stairSteps, ...p.right.stairSteps]) {
        expect(v === 2 || v === 3).toBe(true);
      }
    }
  });

  it("3-stitch bind-offs come before 2-stitch bind-offs on each side", () => {
    for (let n = 3; n <= 120; n++) {
      const p = calculateRoundNecklineShaping({ necklineStitches: n });
      for (const steps of [p.left.stairSteps, p.right.stairSteps]) {
        let seen2 = false;
        for (const s of steps) {
          if (s === 2) seen2 = true;
          if (s === 3 && seen2) {
            throw new Error(`3 after 2 for n=${n}`);
          }
        }
      }
    }
  });

  it("left/right stitch totals differ by at most 1 for stair and for singles", () => {
    for (let n = 3; n <= 120; n++) {
      const p = calculateRoundNecklineShaping({ necklineStitches: n });
      const ls = sum(p.left.stairSteps);
      const rs = sum(p.right.stairSteps);
      expect(Math.abs(ls - rs)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.left.singleDecreaseCount - p.right.singleDecreaseCount)).toBeLessThanOrEqual(1);
    }
  });

  it("initialCenterNeckStitches and neckEdgeDecreasesPerSide align with plan", () => {
    const n = 53;
    const p = calculateRoundNecklineShaping({ necklineStitches: n });
    expect(initialCenterNeckStitches(n)).toBe(p.centerBindOff);
    expect(neckEdgeDecreasesPerSide(n)).toBe(
      Math.max(
        sum(p.left.stairSteps) + p.left.singleDecreaseCount,
        sum(p.right.stairSteps) + p.right.singleDecreaseCount
      )
    );
  });
});

describe("stairBindOffStepsForSide", () => {
  it("decomposes sample totals with 3s before 2s", () => {
    expect(stairBindOffStepsForSide(9)).toEqual([3, 3, 3]);
    expect(stairBindOffStepsForSide(7)).toEqual([3, 2, 2]);
    expect(stairBindOffStepsForSide(5)).toEqual([3, 2]);
    expect(stairBindOffStepsForSide(4)).toEqual([2, 2]);
  });
});

describe("calculateRoundNecklinePlan (strategy)", () => {
  it("53 stitches with enough rows uses deep-round", () => {
    const deepOnly = calculateRoundNecklineShaping({ necklineStitches: 53 });
    const need = rowsRequiredForDeepPlan(deepOnly);
    expect(need).toBe(21);

    const plan = calculateRoundNecklinePlan({
      necklineStitches: 53,
      necklineDepthRows: need,
    });
    expect(plan.strategy).toBe("deep-round");
    expect(plan.rowsRequired).toBe(need);
    expect(plan.warnings).toHaveLength(0);
    expect(plan.centerBindOff).toBe(17);
    expect(plan.fitsAvailableRows).toBe(true);
  });

  it("53 stitches with only 6 rows uses shallow-round with a warning", () => {
    const plan = calculateRoundNecklinePlan({
      necklineStitches: 53,
      necklineDepthRows: 6,
    });
    expect(plan.strategy).toBe("shallow-round");
    expect(plan.warnings.length).toBeGreaterThan(0);
    expect(plan.centerBindOff).toBe(53);
    expect(plan.rowsRequired).toBe(1);
    expect(plan.totalCheck).toBe(53);
    expect(plan.fitsAvailableRows).toBe(true);
  });

  it("two low-row scenarios both use shallow-round (numeric-only inputs)", () => {
    const scenarioA = { necklineStitches: 41, necklineDepthRows: 5 };
    const scenarioB = { necklineStitches: 60, necklineDepthRows: 4 };
    const a = calculateRoundNecklinePlan(scenarioA);
    const b = calculateRoundNecklinePlan(scenarioB);
    expect(a.strategy).toBe("shallow-round");
    expect(b.strategy).toBe("shallow-round");
    expect(a.totalCheck).toBe(41);
    expect(b.totalCheck).toBe(60);
  });

  it("two generous-row scenarios both use deep-round (numeric-only inputs)", () => {
    const scenarioA = { necklineStitches: 41, necklineDepthRows: 40 };
    const scenarioB = { necklineStitches: 60, necklineDepthRows: 45 };
    const a = calculateRoundNecklinePlan(scenarioA);
    const b = calculateRoundNecklinePlan(scenarioB);
    expect(a.strategy).toBe("deep-round");
    expect(b.strategy).toBe("deep-round");
    expect(a.warnings).toHaveLength(0);
    expect(b.warnings).toHaveLength(0);
  });

  it("totalCheck always equals necklineStitches for a grid of N and depths", () => {
    for (let n = 1; n <= 80; n++) {
      for (let d = 0; d <= 45; d++) {
        const plan = calculateRoundNecklinePlan({ necklineStitches: n, necklineDepthRows: d });
        expect(plan.totalCheck).toBe(n);
      }
    }
  });

  it("strategy depends only on stitch count and depth rows (repeat call)", () => {
    const necklineStitches = 29;
    const necklineDepthRows = 12;
    const first = calculateRoundNecklinePlan({ necklineStitches, necklineDepthRows });
    const second = calculateRoundNecklinePlan({ necklineStitches, necklineDepthRows });
    expect(first.strategy).toBe(second.strategy);
    expect(first.rowsRequired).toBe(second.rowsRequired);
  });
});
