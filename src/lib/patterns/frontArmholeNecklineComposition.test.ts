import { describe, expect, it } from "vitest";
import {
  armholeDecreaseLocalRcs,
  composeFrontVNeckTimelineWithArmholeOverlap,
  liveFrontStitchesBeforeGarmentRc,
  resolveFrontVNeckShapingTimingCase,
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

describe("armhole live-stitch walk (events strictly before garment RC)", () => {
  it("lists Amanda decrease RCs 2 through 14", () => {
    expect(armholeDecreaseLocalRcs(7)).toEqual([2, 4, 6, 8, 10, 12, 14]);
  });

  it("reaches 56 before RC 007/008 and 54 before the next decrease after 008", () => {
    const args = {
      armholeStartSts: 78,
      bindOffSts: 8,
      decreaseSts: 7,
      firstArmholeGarmentRc: 70,
    };
    expect(liveFrontStitchesBeforeGarmentRc({ ...args, beforeGarmentRc: 71 })).toBe(70);
    expect(liveFrontStitchesBeforeGarmentRc({ ...args, beforeGarmentRc: 72 })).toBe(62);
    expect(liveFrontStitchesBeforeGarmentRc({ ...args, beforeGarmentRc: 76 })).toBe(58);
    expect(liveFrontStitchesBeforeGarmentRc({ ...args, beforeGarmentRc: 77 })).toBe(56);
    expect(liveFrontStitchesBeforeGarmentRc({ ...args, beforeGarmentRc: 78 })).toBe(56);
    expect(liveFrontStitchesBeforeGarmentRc({ ...args, beforeGarmentRc: 133 })).toBe(48);
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
      divideGarmentRc: 77,
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

  it("Case B 102-st: divides 51/51 on the BO #1 garment row, then active BO → 47/51", () => {
    const firstArmhole = 133;
    const geometry = buildVNeckFrontFullWidthTimeline({
      firstShapingRow: firstArmhole,
      shoulderStitchesPerSide: 32,
      centerNeckBindOff: 24,
      neckDepthRows: 62,
      neckProfile: "front",
      stitchesAfterArmhole: 88,
      shoulderBindoffRows: 7,
    }).timeline;
    expect(geometry[0]!.row).toBe(firstArmhole);
    expect(geometry[0]!.stitchesL + geometry[0]!.stitchesR).toBe(88);

    const { timeline, overlap } = composeFrontVNeckTimelineWithArmholeOverlap(geometry, {
      firstArmholeGarmentRc: firstArmhole,
      armholeStartSts: 102,
      bindOffSts: 4,
      decreaseSts: 3,
      stitchesAfterArmhole: 88,
    });

    expect(overlap).toMatchObject({
      completedDecreaseLocalRcs: [],
      remainingDecreaseLocalRcs: [2, 4, 6],
      liveTotalAtDivide: 102,
      leftAtDivide: 51,
      rightAtDivide: 51,
      heldAfterDivideRow: 51,
      activeAfterDivideRow: 47,
      divideGarmentRc: firstArmhole,
      stitchesAfterArmhole: 88,
    });
    expect(overlap!.liveTotalAtDivide).not.toBe(94);
    expect(overlap!.leftAtDivide).not.toBe(49);
    expect(overlap!.leftAtDivide).not.toBe(47);

    const byLocal = new Map(timeline.map((e) => [e.row - firstArmhole, e]));
    const divide = byLocal.get(0)!;
    expect(divide.events.filter((e) => e.side === "right" && e.edge === "outer" && e.kind === "bindOff")).toEqual([
      expect.objectContaining({ amount: 4 }),
    ]);
    expect(divide.events.some((e) => e.side === "left" && e.kind === "bindOff")).toBe(false);
    expect(divide.stitchesR).toBe(47);
    expect(divide.stitchesL).toBe(51);

    const next = byLocal.get(1)!;
    expect(next.events.some((e) => e.edge === "inner" && e.kind === "decrease" && e.side === "right")).toBe(
      true,
    );
    expect(next.events.filter((e) => e.side === "right" && e.edge === "outer" && e.kind === "bindOff")).toHaveLength(
      0,
    );
    expect(next.events.some((e) => e.side === "left" && e.edge === "outer" && e.kind === "bindOff")).toBe(
      true,
    );

    for (const local of [2, 4, 6]) {
      const row = byLocal.get(local)!;
      expect(row.events.filter((e) => e.edge === "outer" && e.kind === "decrease")).toHaveLength(2);
      expect(row.events.some((e) => e.kind === "bindOff" && e.edge === "outer")).toBe(false);
    }
  });

  it("Case A: V-neck before armhole divides from the full Front, then overlays later BOs", () => {
    const firstArmhole = 133;
    const divide = 125;
    const geometry = buildVNeckFrontFullWidthTimeline({
      firstShapingRow: divide,
      shoulderStitchesPerSide: 32,
      centerNeckBindOff: 24,
      neckDepthRows: 70,
      neckProfile: "front",
      stitchesAfterArmhole: 88,
      shoulderBindoffRows: 7,
    }).timeline;

    const { timeline, overlap } = composeFrontVNeckTimelineWithArmholeOverlap(geometry, {
      firstArmholeGarmentRc: firstArmhole,
      armholeStartSts: 102,
      bindOffSts: 4,
      decreaseSts: 3,
      stitchesAfterArmhole: 88,
    });

    expect(overlap).toBeDefined();
    expect(overlap!.necklineBeginsBeforeArmhole).toBe(true);
    expect(overlap!.divideGarmentRc).toBe(divide);
    expect(overlap!.liveTotalAtDivide).toBe(102);
    expect(overlap!.leftAtDivide).toBe(51);
    expect(overlap!.rightAtDivide).toBe(51);

    const byRow = new Map(timeline.map((e) => [e.row, e]));
    const divideRow = byRow.get(divide)!;
    expect(divideRow.stitchesL).toBe(51);
    expect(divideRow.stitchesR).toBe(51);
    expect(divideRow.events.some((e) => e.edge === "outer")).toBe(false);

    expect(byRow.get(firstArmhole - 1)!.events.some((e) => e.edge === "outer")).toBe(false);

    const bo1 = byRow.get(firstArmhole)!;
    expect(bo1.events.filter((e) => e.side === "right" && e.edge === "outer" && e.kind === "bindOff")).toEqual([
      expect.objectContaining({ amount: 4 }),
    ]);
    expect(bo1.events.some((e) => e.side === "left" && e.kind === "bindOff")).toBe(false);

    const bo2 = byRow.get(firstArmhole + 1)!;
    expect(bo2.events.some((e) => e.side === "left" && e.edge === "outer" && e.kind === "bindOff")).toBe(
      true,
    );
  });
});

describe("resolveFrontVNeckShapingTimingCase", () => {
  const base = {
    liveTotalAtDivide: 50,
    leftAtDivide: 25,
    rightAtDivide: 25,
    heldAfterDivideRow: 25,
    activeAfterDivideRow: 25,
    completedDecreaseLocalRcs: [] as number[],
    remainingDecreaseLocalRcs: [2],
    completedDecreaseSts: 0,
    remainingDecreaseSts: 1,
    lastArmholeGarmentRc: 80,
    stitchesAfterArmhole: 40,
  };

  it("classifies the four presentation timing cases from overlap fields", () => {
    expect(resolveFrontVNeckShapingTimingCase(null)).toBe("after-armhole");
    expect(
      resolveFrontVNeckShapingTimingCase({
        ...base,
        divideGarmentRc: 77,
        firstArmholeGarmentRc: 70,
        necklineBeginsBeforeArmhole: false,
      }),
    ).toBe("during-armhole");
    expect(
      resolveFrontVNeckShapingTimingCase({
        ...base,
        divideGarmentRc: 70,
        firstArmholeGarmentRc: 70,
        necklineBeginsBeforeArmhole: false,
      }),
    ).toBe("with-armhole");
    expect(
      resolveFrontVNeckShapingTimingCase({
        ...base,
        divideGarmentRc: 60,
        firstArmholeGarmentRc: 70,
        necklineBeginsBeforeArmhole: true,
      }),
    ).toBe("before-armhole");
  });
});
