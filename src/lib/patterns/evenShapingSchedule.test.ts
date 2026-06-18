import { describe, expect, it } from "vitest";
import { evenShapingSchedule, sleeveEvenShapingSchedule } from "./evenShapingSchedule";

describe("evenShapingSchedule", () => {
  it("returns all-even rows when count is zero", () => {
    expect(evenShapingSchedule(0, 100)).toEqual({ interval: 0, count: 0, remainderRows: 100 });
  });

  it("prefers an even row spacing when possible", () => {
    expect(evenShapingSchedule(20, 100)).toEqual({ interval: 4, count: 20, remainderRows: 20 });
  });
});

describe("sleeveEvenShapingSchedule", () => {
  it("matches drop-shoulder sleeve taper math (80 top, 40 wrist, 100 body rows)", () => {
    expect(sleeveEvenShapingSchedule(80, 40, 100)).toEqual({
      interval: 4,
      count: 20,
      remainderRows: 20,
    });
  });

  it("returns no shaping when wrist equals top", () => {
    expect(sleeveEvenShapingSchedule(40, 40, 100)).toEqual({
      interval: 0,
      count: 0,
      remainderRows: 100,
    });
  });
});
