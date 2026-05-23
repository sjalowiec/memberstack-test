import { describe, expect, it } from "vitest";
import {
  vNeckDivideSideStartsFromLiveStitches,
  vNeckNeckDecreasesForSide,
} from "./legoBlocks/vNeckline";
import { buildVNeckFrontFullWidthTimeline } from "./vNeckFrontFullWidthTimeline";
import type { RowEntry } from "./shapingTimeline";

function sumInnerDecreases(timeline: RowEntry[], side: "left" | "right"): number {
  let n = 0;
  for (const entry of timeline) {
    for (const e of entry.events) {
      if (e.kind === "decrease" && e.edge === "inner" && e.side === side) n += e.amount;
    }
  }
  return n;
}

function timelineInputs(overrides: {
  B: number;
  N: number;
  S: number;
  neckDepthRows?: number;
  firstShapingRow?: number;
  minFinalStitchesPerSide?: number;
}) {
  return {
    firstShapingRow: overrides.firstShapingRow ?? 26,
    shoulderStitchesPerSide: overrides.S,
    centerNeckBindOff: overrides.N,
    neckDepthRows: overrides.neckDepthRows ?? 22,
    neckProfile: "front" as const,
    stitchesAfterArmhole: overrides.B,
    shoulderBindoffRows: 7,
  };
}

function timelineOptions(overrides: { minFinalStitchesPerSide: number }) {
  return { minFinalStitchesPerSide: overrides.minFinalStitchesPerSide };
}

describe("vNeckDivideSideStartsFromLiveStitches", () => {
  it("splits even B exactly in half with no stitch loss", () => {
    expect(vNeckDivideSideStartsFromLiveStitches(88)).toEqual({ left: 44, right: 44 });
  });

  it("splits odd B with floor left and ceil right (explicit center stitch)", () => {
    expect(vNeckDivideSideStartsFromLiveStitches(87)).toEqual({ left: 43, right: 44 });
  });
});

describe("buildVNeckFrontFullWidthTimeline V-neck divide", () => {
  it("even B=88: first chart row shows 44 sts per side (no hidden center consumption)", () => {
    const B = 88;
    const N = 36;
    const S = 26;
    const { timeline } = buildVNeckFrontFullWidthTimeline(timelineInputs({ B, N, S }));
    expect(timeline.length).toBeGreaterThan(0);
    const first = timeline[0]!;
    expect(first.stitchesL).toBe(44);
    expect(first.stitchesR).toBe(44);
    expect(first.stitchesL + first.stitchesR).toBe(B);
    expect(first.events.some((e) => e.side === "center")).toBe(false);
  });

  it("even B=88: neckline decreases = sideStart − shoulder (18 per side) and final shoulder count", () => {
    const B = 88;
    const N = 36;
    const S = 26;
    const { left, right } = vNeckDivideSideStartsFromLiveStitches(B);
    expect(vNeckNeckDecreasesForSide({ sideStartStitches: left, shoulderStitchesOnSide: S })).toBe(18);
    expect(vNeckNeckDecreasesForSide({ sideStartStitches: right, shoulderStitchesOnSide: S })).toBe(18);

    const { timeline } = buildVNeckFrontFullWidthTimeline(
      timelineInputs({ B, N, S, neckDepthRows: 24 }),
      timelineOptions({ minFinalStitchesPerSide: S }),
    );
    expect(sumInnerDecreases(timeline, "left")).toBe(18);
    expect(sumInnerDecreases(timeline, "right")).toBe(18);

    const last = timeline[timeline.length - 1]!;
    expect(last.stitchesL).toBe(S);
    expect(last.stitchesR).toBe(S);
  });

  it("odd B: asymmetric side starts and per-side neck decreases still reconcile to shoulder targets", () => {
    const B = 87;
    const N = 35;
    const leftShoulder = Math.floor((B - N) / 2);
    const rightShoulder = Math.ceil((B - N) / 2);
    const { left, right } = vNeckDivideSideStartsFromLiveStitches(B);
    expect(left).toBe(43);
    expect(right).toBe(44);
    expect(vNeckNeckDecreasesForSide({ sideStartStitches: left, shoulderStitchesOnSide: leftShoulder })).toBe(
      left - leftShoulder,
    );
    expect(
      vNeckNeckDecreasesForSide({ sideStartStitches: right, shoulderStitchesOnSide: rightShoulder }),
    ).toBe(right - rightShoulder);

    const { timeline } = buildVNeckFrontFullWidthTimeline(
      timelineInputs({ B, N, S: leftShoulder, neckDepthRows: 24 }),
      timelineOptions({ minFinalStitchesPerSide: Math.min(leftShoulder, rightShoulder) }),
    );
    const first = timeline[0]!;
    expect(first.stitchesL).toBe(43);
    expect(first.stitchesR).toBe(44);
    expect(first.stitchesL + first.stitchesR).toBe(B);
    expect(first.centerWidth).toBe(1);

    expect(sumInnerDecreases(timeline, "left")).toBe(left - leftShoulder);
    expect(sumInnerDecreases(timeline, "right")).toBe(right - rightShoulder);

    const last = timeline[timeline.length - 1]!;
    expect(last.stitchesL).toBe(leftShoulder);
    expect(last.stitchesR).toBe(rightShoulder);
  });
});
