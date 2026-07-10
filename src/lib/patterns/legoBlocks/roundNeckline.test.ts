import { describe, expect, it } from "vitest";

import {
  calculateBackRoundNecklinePlan,
  calculateDocumentedShallowRoundNecklineShaping,
  calculateRoundNecklinePlan,
  calculateRoundNecklineShaping,
  distributeHoldGroupsPerSide,
  initialBackCenterNeckStitches,
  initialCenterNeckStitches,
  neckEdgeDecreasesPerSide,
  normalizeRoundNecklineDepthRows,
  partitionNecklineThirds,
  rowsRequiredForDeepPlan,
  rowsRequiredForBackShallowPlan,
  rowsRequiredForShallowPlan,
  stairBindOffStepsForSide,
} from "./roundNeckline";

import {

  backRoundNeckPlanForDepth,

  roundNeckBackBothEdgesWrittenLines,
  roundNeckBackShallowExecutionWrittenLines,
  roundNeckBackShallowSleevelessSummaryWrittenLines,

  roundNeckPlanOneSideBackFullJpLines,

  roundNeckPlanOneSideFullJpLines,

  roundNeckPlanOneSideNeckEdgeWrittenLines,

} from "../roundNeckPlanPresentation";
import { inlineSubheadingLine } from "../inlineRcHeading";



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



describe("normalizeRoundNecklineDepthRows", () => {

  it("forces odd depths to the next even row count", () => {

    expect(normalizeRoundNecklineDepthRows(7)).toBe(8);

    expect(normalizeRoundNecklineDepthRows(8)).toBe(8);

    expect(normalizeRoundNecklineDepthRows(0)).toBe(0);

  });

});



function sumHold(side: { holdGroups: number[] }): number {
  return side.holdGroups.reduce((a, b) => a + b, 0);
}

describe("distributeHoldGroupsPerSide", () => {
  it("uses all 1-stitch groups when R <= K", () => {
    expect(distributeHoldGroupsPerSide(4, 5)).toEqual([1, 1, 1, 1]);
  });

  it("distributes extras round-robin when R > K (N=44, 11/side, depth 10 → K=5)", () => {
    expect(distributeHoldGroupsPerSide(11, 5)).toEqual([3, 2, 2, 2, 2]);
  });

  it("N=20 at 1 inch depth (K=4): 2s-2r-1x + 1s-2r-3x per side", () => {
    expect(distributeHoldGroupsPerSide(5, 4)).toEqual([2, 1, 1, 1]);
  });
});

describe("calculateDocumentedShallowRoundNecklineShaping", () => {
  it("24 stitches without depth: center 12, hold groups fill remaining per side", () => {
    const p = calculateDocumentedShallowRoundNecklineShaping({ necklineStitches: 24 });
    expect(p.centerBindOff).toBe(12);
    expect(p.left.stairSteps).toEqual([]);
    expect(p.right.stairSteps).toEqual([]);
    expect(p.left.singleDecreaseCount).toBe(0);
    expect(p.right.singleDecreaseCount).toBe(0);
    expect(sumHold(p.left)).toBe(6);
    expect(sumHold(p.right)).toBe(6);
    expect(p.left.holdGroups).toEqual([1, 1, 1, 1, 1, 1]);
    expect(p.totalCheck).toBe(24);
    expect(rowsRequiredForShallowPlan(p)).toBe(12);
  });

  it("depth-constrained shaping uses hold groups (never 1s-1r)", () => {
    const p = calculateDocumentedShallowRoundNecklineShaping({
      necklineStitches: 36,
      necklineDepthRows: 8,
    });
    expect(p.left.holdGroups).toEqual([3, 2, 2, 2]);
    expect(sumHold(p.left)).toBe(9);
    expect(rowsRequiredForShallowPlan(p)).toBe(8);
  });

  it("front shallow fallback at 1 inch depth uses hold JP and even depth", () => {
    const plan = calculateRoundNecklinePlan({ necklineStitches: 24, necklineDepthRows: 7 });
    expect(plan.strategy).toBe("shallow-round");
    expect(plan.necklineDepthRows).toBe(8);
    expect(roundNeckPlanOneSideFullJpLines(plan, "right")).toEqual([
      "hold12",
      "2s-2r-2x",
      "1s-2r-2x",
    ]);
    expect(plan.rowsRequired).toBe(8);
    expect(roundNeckPlanOneSideNeckEdgeWrittenLines(plan, "right")).toEqual([
      "At the neck edge, put 2 stitches in hold every other row 2 times.",
      "At the neck edge, put 1 stitch in hold every other row 2 times.",
    ]);
  });

  it("deep round-neck JP merges consecutive identical stair bind-off segments", () => {
    const plan = calculateRoundNecklineShaping({ necklineStitches: 52 });
    expect(plan.left.stairSteps).toEqual([3, 3, 3]);
    expect(roundNeckPlanOneSideFullJpLines(plan, "right")).toEqual([
      "bo16",
      "3s-2r-3x",
      "1s-2r-9x",
    ]);
  });
});

describe("shallow round-neck written instructions", () => {
  it("back shallow execution uses needle-range hold workflow with validation counts", () => {
    const plan = calculateBackRoundNecklinePlan({
      necklineStitches: 36,
      necklineDepthRows: 10,
    });
    const lines = roundNeckBackShallowExecutionWrittenLines(plan, { bodyWidthStitches: 100 });
    // First line is the RIGHT SIDE subheading (a presentation marker; renders as "RIGHT SIDE").
    expect(lines[0]).toBe(inlineSubheadingLine("RIGHT SIDE"));
    expect(lines.some((l) => /Put needles .*needle-range.*L50 through R9.*into hold \(59 stitches total\)/i.test(l))).toBe(
      true,
    );
    expect(lines.some((l) => /Work needles .*needle-range.*R10 through R50.*\(41 stitches total\)/i.test(l))).toBe(
      true,
    );
    expect(lines.some((l) => /Return needles .*needle-range.*L50 through L10.*\(41 stitches total\)/i.test(l))).toBe(
      true,
    );
    expect(lines.some((l) => /Leave center neckline needles .*needle-range.*L9 through R9.*in hold \(18 stitches total\)/i.test(l))).toBe(
      true,
    );
    expect(lines.some((l) => /Work needles .*L50 through L10/.test(l) && !/\(\d+ stitches total\)/.test(l))).toBe(
      true,
    );
    expect(lines.filter((l) => l.includes('class="needle-range"')).length).toBeGreaterThanOrEqual(5);
    expect(lines.some((l) => /Scrap off or bind off the remaining right shoulder stitches/i.test(l))).toBe(
      true,
    );
    expect(lines.some((l) => /Break yarn and move the carriage to the opposite side/i.test(l))).toBe(
      true,
    );
    expect(lines.some((l) => /BACK NECKLINE CLEANUP/i.test(l))).toBe(true);
    expect(lines.some((l) => /Put \d+ needles into hold every other row/i.test(l))).toBe(true);
    expect(lines.some((l) => /Place the (center|opposite)/i.test(l))).toBe(false);
    expect(lines.some((l) => /Continue to RC:/i.test(l))).toBe(false);
    expect(lines.some((l) => /Stage 1/i.test(l))).toBe(false);
  });

  it("sleeveless summary is setup overview only — checklist handles row-by-row shaping", () => {
    const plan = calculateBackRoundNecklinePlan({
      necklineStitches: 36,
      necklineDepthRows: 10,
    });
    const lines = roundNeckBackShallowSleevelessSummaryWrittenLines(plan, {
      bodyWidthStitches: 100,
      necklineStartRcLabel: "RC:049",
    });
    expect(lines[0]).toBe("Begin back neckline and shoulder shaping.");
    expect(lines.some((l) => /Place center neckline needles .*L9 through R9/i.test(l))).toBe(true);
    expect(lines.some((l) => /Put needles .*L50 through R9.*into hold/i.test(l))).toBe(true);
    expect(lines.some((l) => /Work needles .*R10 through R50.*first/i.test(l))).toBe(true);
    expect(lines.at(-1)).toBe(
      "Use the checklist below for row-by-row neckline and shoulder shaping.",
    );
    expect(lines.some((l) => /^RIGHT SIDE$/i.test(l))).toBe(false);
    expect(lines.some((l) => /Scrap off or bind off the remaining (right|left) shoulder stitches/i.test(l))).toBe(
      false,
    );
  });

  it("roundNeckBackBothEdgesWrittenLines summarizes symmetric hold per edge", () => {
    const plan = calculateBackRoundNecklinePlan({
      necklineStitches: 36,
      necklineDepthRows: 10,
    });
    expect(roundNeckBackBothEdgesWrittenLines(plan)).toEqual([
      "At each neck edge, put 2 stitches in hold every other row 4 times.",
      "At each neck edge, put 1 stitch in hold every other row 1 time.",
    ]);
  });
  it("deep-round one-side wording keeps stair bind-offs and every-other-row singles", () => {

    const plan = calculateRoundNecklinePlan({ necklineStitches: 53, necklineDepthRows: 21 });

    expect(plan.strategy).toBe("deep-round");

    const lines = roundNeckPlanOneSideNeckEdgeWrittenLines(plan, "right");

    expect(lines.some((l) => /bind off .* on alternate \(neck-edge\) rows/i.test(l))).toBe(true);

    expect(lines.some((l) => /every other row/i.test(l))).toBe(true);

    expect(lines.some((l) => /every row/i.test(l))).toBe(false);

  });

});



describe("calculateBackRoundNecklinePlan", () => {
  it("16 stitches: center 8, hold groups 4 per side, 8 rows, JP hold8 + 1s-2r-4x", () => {
    const plan = calculateBackRoundNecklinePlan({
      necklineStitches: 16,
      necklineDepthRows: 10,
    });
    expect(plan.centerBindOff).toBe(8);
    expect(plan.left.holdGroups).toEqual([1, 1, 1, 1]);
    expect(plan.right.holdGroups).toEqual([1, 1, 1, 1]);
    expect(plan.left.singleDecreaseCount).toBe(0);
    expect(plan.rowsRequired).toBe(8);
    expect(roundNeckPlanOneSideBackFullJpLines(plan, "right")).toEqual(["hold8", "1s-2r-4x"]);
  });

  it("uses hold groups every other row when depth allows (36 sts, generous depth)", () => {
    const shallow = calculateBackRoundNecklinePlan({
      necklineStitches: 36,
      necklineDepthRows: 40,
    });
    expect(shallow.strategy).toBe("shallow-round");
    expect(shallow.centerBindOff).toBe(18);
    expect(shallow.left.holdGroups).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(shallow.rowsRequired).toBe(18);
    expect(rowsRequiredForBackShallowPlan(shallow)).toBe(18);
    expect(roundNeckPlanOneSideBackFullJpLines(shallow, "right")).toEqual(["hold18", "1s-2r-9x"]);
  });
  it("initialBackCenterNeckStitches matches shallow center", () => {

    expect(initialBackCenterNeckStitches(24)).toBe(12);

    expect(initialBackCenterNeckStitches(24)).not.toBe(initialCenterNeckStitches(24));

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

    expect(plan.necklineDepthRows).toBe(6);

    expect(plan.warnings.length).toBeGreaterThan(0);

    expect(plan.centerBindOff).toBe(26);
    expect(plan.left.stairSteps).toEqual([]);
    expect(plan.right.stairSteps).toEqual([]);
    expect(plan.left.holdGroups).toEqual([5, 4, 4]);
    expect(plan.right.holdGroups).toEqual([5, 5, 4]);
    expect(plan.rowsRequired).toBe(6);
    expect(plan.fitsAvailableRows).toBe(true);

    expect(plan.totalCheck).toBe(53);

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

