import { describe, expect, it } from "vitest";
import {
  armholeDecreaseLocalRcs,
  composeFrontVNeckTimelineWithArmholeOverlap,
  liveFrontStitchesAfterArmholeLocalRc,
} from "./frontArmholeNecklineComposition";
import { buildVNeckFrontFullWidthTimeline } from "./vNeckFrontFullWidthTimeline";

const AMANDA = {
  armholeStartSts: 78,
  bindOffSts: 8,
  decreaseSts: 7,
  stitchesAfterArmhole: 48,
  firstArmholeGarmentRc: 70,
  firstShapingRow: 77, // local RC 007
  N: 24,
  S: 12,
  neckDepthRows: 50,
  shoulderBindoffRows: 7,
};

function amandaGeometryTimeline() {
  return buildVNeckFrontFullWidthTimeline({
    firstShapingRow: AMANDA.firstShapingRow,
    shoulderStitchesPerSide: AMANDA.S,
    centerNeckBindOff: AMANDA.N,
    neckDepthRows: AMANDA.neckDepthRows,
    neckProfile: "front",
    stitchesAfterArmhole: AMANDA.stitchesAfterArmhole,
    shoulderBindoffRows: AMANDA.shoulderBindoffRows,
  }).timeline;
}

describe("armhole live-stitch walk", () => {
  it("lists Amanda decrease RCs 2 through 14", () => {
    expect(armholeDecreaseLocalRcs(7)).toEqual([2, 4, 6, 8, 10, 12, 14]);
  });

  it("reaches 56 after RC 006/007 and 54 after RC 008", () => {
    const args = {
      armholeStartSts: 78,
      bindOffSts: 8,
      decreaseSts: 7,
    };
    expect(liveFrontStitchesAfterArmholeLocalRc({ ...args, afterLocalRc: 1 })).toBe(62);
    expect(liveFrontStitchesAfterArmholeLocalRc({ ...args, afterLocalRc: 6 })).toBe(56);
    expect(liveFrontStitchesAfterArmholeLocalRc({ ...args, afterLocalRc: 7 })).toBe(56);
    expect(liveFrontStitchesAfterArmholeLocalRc({ ...args, afterLocalRc: 8 })).toBe(54);
    expect(liveFrontStitchesAfterArmholeLocalRc({ ...args, afterLocalRc: 14 })).toBe(48);
  });
});

describe("composeFrontVNeckTimelineWithArmholeOverlap", () => {
  it("does not change a shallow timeline whose divide is after the last armhole decrease", () => {
    const shallow = buildVNeckFrontFullWidthTimeline({
      firstShapingRow: 70 + 20,
      shoulderStitchesPerSide: 12,
      centerNeckBindOff: 24,
      neckDepthRows: 30,
      neckProfile: "front",
      stitchesAfterArmhole: 48,
      shoulderBindoffRows: 7,
    }).timeline;
    const innerBefore = shallow.flatMap((e) =>
      e.events.filter((ev) => ev.edge === "inner").map((ev) => ({ row: e.row, ...ev })),
    );
    const composed = composeFrontVNeckTimelineWithArmholeOverlap(shallow, {
      firstArmholeGarmentRc: 70,
      armholeStartSts: 78,
      bindOffSts: 8,
      decreaseSts: 7,
      stitchesAfterArmhole: 48,
    });
    expect(composed.overlap).toBeNull();
    expect(composed.timeline).toEqual(shallow);
    const innerAfter = composed.timeline.flatMap((e) =>
      e.events.filter((ev) => ev.edge === "inner").map((ev) => ({ row: e.row, ...ev })),
    );
    expect(innerAfter).toEqual(innerBefore);
  });

  it("Amanda: divide from 56 → 28/28 and overlays remaining armhole decreases", () => {
    const geometry = amandaGeometryTimeline();
    const first = geometry[0]!;
    expect(first.stitchesL + first.stitchesR).toBe(48);

    const neckRows = new Set(
      geometry
        .filter((e) => e.events.some((ev) => ev.edge === "inner" && ev.kind === "decrease"))
        .map((e) => e.row),
    );
    const shoulderRows = new Set(
      geometry
        .filter((e) => e.events.some((ev) => ev.edge === "outer" && ev.kind === "bindOff"))
        .map((e) => e.row),
    );

    const { timeline, overlap } = composeFrontVNeckTimelineWithArmholeOverlap(geometry, {
      firstArmholeGarmentRc: AMANDA.firstArmholeGarmentRc,
      armholeStartSts: AMANDA.armholeStartSts,
      bindOffSts: AMANDA.bindOffSts,
      decreaseSts: AMANDA.decreaseSts,
      stitchesAfterArmhole: AMANDA.stitchesAfterArmhole,
    });

    expect(overlap).toMatchObject({
      completedDecreaseLocalRcs: [2, 4, 6],
      remainingDecreaseLocalRcs: [8, 10, 12, 14],
      liveTotalAtDivide: 56,
      leftAtDivide: 28,
      rightAtDivide: 28,
      stitchesAfterArmhole: 48,
    });

    const divide = timeline[0]!;
    expect(divide.row).toBe(77);
    expect(divide.stitchesL).toBe(28);
    expect(divide.stitchesR).toBe(28);
    expect(divide.events).toEqual([]);

    const byLocal = new Map(
      timeline.map((e) => [e.row - AMANDA.firstArmholeGarmentRc, e]),
    );
    const rc8 = byLocal.get(8)!;
    expect(rc8.events.filter((e) => e.edge === "outer" && e.kind === "decrease")).toHaveLength(2);
    expect(rc8.events.some((e) => e.edge === "inner" && e.kind === "decrease")).toBe(true);
    expect(rc8.events.some((e) => e.kind === "bindOff" && e.edge === "outer")).toBe(false);
    expect(rc8.stitchesL).toBe(26);
    expect(rc8.stitchesR).toBe(26);

    for (const local of [10, 12, 14]) {
      const row = byLocal.get(local)!;
      expect(row.events.filter((e) => e.edge === "outer" && e.kind === "decrease")).toHaveLength(2);
      expect(row.events.some((e) => e.kind === "bindOff" && e.edge === "outer")).toBe(false);
    }

    const lastArmhole = byLocal.get(14)!;
    const afterArmhole = timeline.find((e) => e.row > lastArmhole.row);
    expect(afterArmhole).toBeDefined();
    expect(
      afterArmhole!.events.some((e) => e.edge === "outer" && e.kind === "decrease"),
    ).toBe(false);

    const neckRowsAfter = new Set(
      timeline
        .filter((e) => e.events.some((ev) => ev.edge === "inner" && ev.kind === "decrease"))
        .map((e) => e.row),
    );
    expect(neckRowsAfter).toEqual(neckRows);

    const shoulderRowsAfter = new Set(
      timeline
        .filter((e) => e.events.some((ev) => ev.edge === "outer" && ev.kind === "bindOff"))
        .map((e) => e.row),
    );
    expect(shoulderRowsAfter).toEqual(shoulderRows);
  });
});
