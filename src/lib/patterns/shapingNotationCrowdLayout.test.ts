import { describe, expect, it } from "vitest";
import {
  dropStackKeepingGaps,
  notationBoxHitsSegment,
  notationBoxesOverlap,
  notationLabelBox,
  placeUpwardStackClearOfCeiling,
  separateBaseline,
} from "./shapingNotationCrowdLayout";

describe("shaping notation crowd layout", () => {
  it("keeps a short armhole stack beside the armhole", () => {
    const placed = placeUpwardStackClearOfCeiling({
      count: 3,
      startY: 200,
      gap: 24,
      topBaseline: 140,
      belowY: 224,
    });
    expect(placed.ys).toEqual([200, 176, 152]);
    expect(placed.firstOverflow).toBe(-1);
  });

  it("continues lines that would cover the shoulder below the armhole", () => {
    const placed = placeUpwardStackClearOfCeiling({
      count: 5,
      startY: 200,
      gap: 24,
      topBaseline: 160,
      belowY: 224,
    });
    expect(placed.ys).toEqual([200, 176, 224, 248, 272]);
    expect(placed.firstOverflow).toBe(2);
  });

  it("moves a row-counter label off a neighbor", () => {
    expect(separateBaseline(100, [108], 18, { min: 16, max: 400 })).toBe(82);
    expect(separateBaseline(100, [200], 18)).toBe(100);
  });

  it("drops a line off the shoulder guide without reversing the stack", () => {
    const onShoulder = notationLabelBox(135, 126, "2s-2r-6x", 17, "start");
    expect(notationBoxHitsSegment(onShoulder, 121, 114, 228, 114)).toBe(true);
    const clear = notationLabelBox(135, 150, "2s-2r-6x", 17, "start");
    expect(notationBoxHitsSegment(clear, 121, 114, 228, 114)).toBe(false);
    const dropped = dropStackKeepingGaps({
      ys: [150, 126, 102],
      gap: 24,
      limit: 400,
      fits: (_index, baseline) => baseline >= 140,
    });
    expect(dropped[2]).toBeGreaterThanOrEqual(140);
    expect(dropped[1]! - dropped[2]!).toBeGreaterThanOrEqual(24);
    expect(dropped[0]! - dropped[1]!).toBeGreaterThanOrEqual(24);
  });

  it("treats overlapping notation boxes as collisions", () => {
    const shoulder = notationLabelBox(240, 100, "4s-2r-3x", 17, "start");
    const armhole = notationLabelBox(300, 102, "1s-2r-10x", 17, "start");
    expect(notationBoxesOverlap(shoulder, armhole)).toBe(true);
    const lowered = notationLabelBox(300, 140, "1s-2r-10x", 17, "start");
    expect(notationBoxesOverlap(shoulder, lowered)).toBe(false);
  });
});
