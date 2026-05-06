import { describe, expect, it } from "vitest";
import { buildTimeline } from "./shapingTimeline";
import { buildNeckShoulderShapingChartRows } from "./neckShoulderShapingChartRows";
import {
  calculateRoundNecklineShaping,
  initialCenterNeckStitches,
  neckEdgeDecreasesPerSide,
} from "./legoBlocks/roundNeckline";

/** Typical shoulder-bind-off span used in tests (≈1" at 7 rpi). */
const SHOULDER_BINDOFF_ROWS = 7;

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
      shoulderBindoffRows: SHOULDER_BINDOFF_ROWS,
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
      shoulderBindoffRows: SHOULDER_BINDOFF_ROWS,
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

  it("schedules outer shoulder bind-offs only in the final post-center rows (tail overlay)", () => {
    const N = 53;
    const S = 38;
    const B = stitchesAfterArmholeFixture(N, S);
    const neckDepthRows = 41;
    const workRows = neckDepthRows - 1;
    const placement = Math.min(SHOULDER_BINDOFF_ROWS, workRows);
    const firstShoulderIndex = workRows - placement;
    const timeline = buildTimeline({
      firstShapingRow: 300,
      shoulderStitchesPerSide: S,
      centerNeckBindOff: N,
      neckDepthRows,
      neckProfile: "back",
      stitchesAfterArmhole: B,
      shoulderBindoffRows: SHOULDER_BINDOFF_ROWS,
    });
    const [, ...afterCenter] = timeline;
    for (let i = 0; i < firstShoulderIndex; i++) {
      const hasOuter = afterCenter[i]!.events.some(
        (e) => e.edge === "outer" && e.kind === "bindOff" && e.amount > 0
      );
      expect(hasOuter).toBe(false);
    }
    const outerSumL = afterCenter.reduce(
      (s, row) =>
        s +
        row.events
          .filter((e) => e.side === "left" && e.edge === "outer" && e.kind === "bindOff")
          .reduce((a, e) => a + e.amount, 0),
      0
    );
    const outerSumR = afterCenter.reduce(
      (s, row) =>
        s +
        row.events
          .filter((e) => e.side === "right" && e.edge === "outer" && e.kind === "bindOff")
          .reduce((a, e) => a + e.amount, 0),
      0
    );
    expect(outerSumL).toBe(Math.floor((B - N) / 2));
    expect(outerSumR).toBe(Math.ceil((B - N) / 2));
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
      shoulderBindoffRows: SHOULDER_BINDOFF_ROWS,
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
      shoulderBindoffRows: SHOULDER_BINDOFF_ROWS,
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

  it("ends at 0/0 — shoulder bind-offs consume the shoulder band after neckline shaping", () => {
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
      shoulderBindoffRows: SHOULDER_BINDOFF_ROWS,
    });
    const last = timeline[timeline.length - 1]!;
    expect(last.stitchesL).toBe(0);
    expect(last.stitchesR).toBe(0);
  });
});
