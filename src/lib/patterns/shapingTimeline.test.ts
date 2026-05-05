import { describe, expect, it } from "vitest";
import { buildTimeline } from "./shapingTimeline";
import { buildNeckShoulderShapingChartRows } from "./neckShoulderShapingChartRows";
import {
  calculateRoundNecklineShaping,
  initialCenterNeckStitches,
  neckEdgeDecreasesPerSide,
} from "./legoBlocks/roundNeckline";

/** Symmetric fixture: B = N + 2×S (full shoulder line + neck opening). */
function stitchesAfterArmholeFixture(necklineStitches: number, shoulderPerSide: number): number {
  return necklineStitches + 2 * shoulderPerSide;
}

describe("buildTimeline round neckline (back profile)", () => {
  it("binds off initial center only; inner-neck decreases remove the rest of total N", () => {
    const N = 53;
    const S = 38;
    const B = stitchesAfterArmholeFixture(N, S);
    const c0 = initialCenterNeckStitches(N);
    expect(c0).toBeLessThan(N);
    const postCenter = 40;
    const timeline = buildTimeline({
      firstShapingRow: 100,
      shoulderStitchesPerSide: S,
      centerNeckBindOff: N,
      neckDepthRows: postCenter + 1,
      neckProfile: "back",
      stitchesAfterArmhole: B,
    });
    const row0 = timeline[0]!;
    const centerBo = row0.events
      .filter((e) => e.kind === "bindOff" && e.side === "center")
      .reduce((s, e) => s + e.amount, 0);
    expect(centerBo).toBe(c0);
    const innerAfter = timeline.slice(1).some((row) =>
      row.events.some(
        (e) =>
          e.edge === "inner" &&
          e.amount > 0 &&
          (e.kind === "decrease" || e.kind === "bindOff")
      )
    );
    expect(innerAfter).toBe(true);
  });

  it("schedules neck-edge stair bind-offs then single inner decreases every other row", () => {
    const N = 22;
    const S = 38;
    const B = stitchesAfterArmholeFixture(N, S);
    const edge = neckEdgeDecreasesPerSide(N);
    expect(edge).toBeGreaterThan(0);
    const plan = calculateRoundNecklineShaping({ necklineStitches: N });
    const stairRows = Math.max(plan.left.stairSteps.length, plan.right.stairSteps.length);
    const maxSingles = Math.max(plan.left.singleDecreaseCount, plan.right.singleDecreaseCount);
    const postCenter = Math.max(15, stairRows + (maxSingles > 0 ? 2 * maxSingles - 1 : 0) + 4);
    const timeline = buildTimeline({
      firstShapingRow: 300,
      shoulderStitchesPerSide: S,
      centerNeckBindOff: N,
      neckDepthRows: postCenter + 1,
      neckProfile: "back",
      stitchesAfterArmhole: B,
    });
    const [, ...afterCenter] = timeline;
    for (let i = 0; i < stairRows; i++) {
      const hasInner = afterCenter[i]?.events.some(
        (e) =>
          e.edge === "inner" &&
          e.amount > 0 &&
          (e.kind === "bindOff" || e.kind === "decrease")
      );
      expect(hasInner).toBe(true);
    }
    for (let si = 0; si < maxSingles; si++) {
      const i = stairRows + 2 * si;
      const hasInnerDecrease = afterCenter[i]?.events.some(
        (e) => e.kind === "decrease" && e.edge === "inner" && e.amount > 0
      );
      expect(hasInnerDecrease).toBe(true);
    }
  });

  it("does not emit outer-edge stitch decreases (shoulder slope funded separately from neck-edge budget)", () => {
    const N = 53;
    const S = 38;
    const B = stitchesAfterArmholeFixture(N, S);
    const timeline = buildTimeline({
      firstShapingRow: 300,
      shoulderStitchesPerSide: S,
      centerNeckBindOff: N,
      neckDepthRows: 41,
      neckProfile: "back",
      stitchesAfterArmhole: B,
    });
    const [, ...afterCenter] = timeline;
    const hasOuter = afterCenter.some((row) =>
      row.events.some((e) => e.edge === "outer" && e.amount > 0)
    );
    expect(hasOuter).toBe(false);
  });

  it("places stair neck bind-offs before single neck decreases for N=53", () => {
    const N = 53;
    const S = 38;
    const B = stitchesAfterArmholeFixture(N, S);
    const timeline = buildTimeline({
      firstShapingRow: 100,
      shoulderStitchesPerSide: S,
      centerNeckBindOff: 53,
      neckDepthRows: 41,
      neckProfile: "back",
      stitchesAfterArmhole: B,
    });
    const [, ...afterCenter] = timeline;
    expect(
      afterCenter[0]!.events.some(
        (e) => e.kind === "bindOff" && e.edge === "inner" && e.amount === 3
      )
    ).toBe(true);
    expect(
      afterCenter[3]!.events.some(
        (e) => e.kind === "decrease" && e.edge === "inner" && e.amount === 1
      )
    ).toBe(true);
  });

  it("chart stitch counts match post-action shoulder totals on each row", () => {
    const input = {
      firstShapingRow: 143,
      shoulderStitchesPerSide: 20,
      centerNeckBindOff: 10,
      neckDepthRows: 6,
      neckProfile: "back" as const,
      stitchesAfterArmhole: 10 + 40,
    };
    const chartRows = buildNeckShoulderShapingChartRows(input);
    const timeline = buildTimeline(input);
    expect(chartRows.length).toBeGreaterThan(2);
    expect(chartRows.length).toBe(timeline.length);
    expect(timeline.length).toBe(input.neckDepthRows);

    for (let i = 0; i < chartRows.length; i++) {
      expect(chartRows[i]!.leftStitchCount).toBe(timeline[i]!.stitchesL);
      expect(chartRows[i]!.rightStitchCount).toBe(timeline[i]!.stitchesR);
    }
  });

  it("ends at shoulderStitchesPerSide per side when inner neck completes in the row budget", () => {
    const N = 53;
    const S = 38;
    const B = stitchesAfterArmholeFixture(N, S);
    const timeline = buildTimeline({
      firstShapingRow: 100,
      shoulderStitchesPerSide: S,
      centerNeckBindOff: N,
      neckDepthRows: 41,
      neckProfile: "back",
      stitchesAfterArmhole: B,
    });
    const last = timeline[timeline.length - 1]!;
    expect(last.stitchesL).toBe(S);
    expect(last.stitchesR).toBe(S);
  });
});
