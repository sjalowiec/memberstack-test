import { describe, expect, it } from "vitest";
import type { ShapingEvent } from "../shapingTimeline";
import { neckDecreaseStitchesPerSideFromOpening } from "./vNeckline";
import { buildVNeckShoulderEventsByRow } from "./vNeckShoulderBridge";

function sumInnerDecreaseAmounts(map: Map<number, ShapingEvent[]>): number {
  let n = 0;
  for (const evs of map.values()) {
    for (const e of evs) {
      if (e.edge === "inner" && e.kind === "decrease") {
        n += e.amount;
      }
    }
  }
  return n;
}

describe("buildVNeckShoulderEventsByRow", () => {
  it("preserves V-neck inner-edge events when no shoulder events are passed", () => {
    const map = buildVNeckShoulderEventsByRow({
      stitchesAfterArmhole: 120,
      neckOpeningStitches: 24,
      vNeckStartRow: 100,
      shoulderEndRow: 109,
      side: "left",
    });

    expect(map.size).toBeGreaterThan(0);
    expect(sumInnerDecreaseAmounts(map)).toBe(neckDecreaseStitchesPerSideFromOpening(24));
    for (const evs of map.values()) {
      expect(evs.every((e) => e.edge === "inner")).toBe(true);
    }
  });

  it("preserves shoulder-only events when neck opening yields no V-neck decreases", () => {
    const shoulder: ShapingEvent[] = [
      { kind: "bindOff", side: "left", edge: "outer", amount: 4 },
    ];
    const map = buildVNeckShoulderEventsByRow({
      stitchesAfterArmhole: 80,
      neckOpeningStitches: 0,
      vNeckStartRow: 50,
      shoulderEndRow: 60,
      side: "left",
      shoulderEvents: [{ row: 55, events: shoulder }],
    });

    expect(map.size).toBe(1);
    expect(map.get(55)).toEqual(shoulder);
    expect(sumInnerDecreaseAmounts(map)).toBe(0);
  });

  it("places inner V-neck events before shoulder events on the same RC (timeline convention)", () => {
    const shoulder: ShapingEvent[] = [
      { kind: "bindOff", side: "left", edge: "outer", amount: 2 },
    ];
    const map = buildVNeckShoulderEventsByRow({
      stitchesAfterArmhole: 100,
      neckOpeningStitches: 10,
      vNeckStartRow: 200,
      shoulderEndRow: 204,
      side: "right",
      shoulderEventsByRow: new Map([[202, shoulder]]),
    });

    const evs = map.get(202);
    expect(evs).toBeDefined();
    expect(evs!.length).toBe(2);
    expect(evs![0]).toMatchObject({ edge: "inner", kind: "decrease", side: "right" });
    expect(evs![1]).toMatchObject({ edge: "outer", kind: "bindOff", side: "left" });
  });

  it("merges shoulderEvents and shoulderEventsByRow on the same RC", () => {
    const map = buildVNeckShoulderEventsByRow({
      stitchesAfterArmhole: 90,
      neckOpeningStitches: 0,
      vNeckStartRow: 1,
      shoulderEndRow: 5,
      side: "left",
      shoulderEventsByRow: new Map([[10, [{ kind: "bindOff", side: "left", edge: "outer", amount: 1 }]]]),
      shoulderEvents: [{ row: 10, events: [{ kind: "bindOff", side: "right", edge: "outer", amount: 3 }] }],
    });

    expect(map.get(10)?.length).toBe(2);
  });

  it("total inner-neck decrease stitches still equals floor(neckOpeningStitches / 2) when merged with shoulder", () => {
    const N = 37;
    const map = buildVNeckShoulderEventsByRow({
      stitchesAfterArmhole: 110,
      neckOpeningStitches: N,
      vNeckStartRow: 300,
      shoulderEndRow: 320,
      side: "left",
      shoulderEvents: [
        { row: 305, events: [{ kind: "bindOff", side: "left", edge: "outer", amount: 5 }] },
        { row: 310, events: [{ kind: "bindOff", side: "right", edge: "outer", amount: 2 }] },
      ],
    });

    expect(sumInnerDecreaseAmounts(map)).toBe(Math.floor(N / 2));
  });
});
