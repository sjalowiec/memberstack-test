import { describe, expect, it } from "vitest";
import { evenShapingSchedule, evenShapingGarmentRowNumbers, formatParentheticalShapingRowNumbers, shapingActionRowNumbers, sleeveEvenShapingSchedule } from "./evenShapingSchedule";

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

  it("schedules reverse taper when cuff is wider than upper arm", () => {
    expect(sleeveEvenShapingSchedule(60, 70, 100)).toEqual({
      interval: 20,
      count: 5,
      remainderRows: 0,
    });
  });
});

describe("shapingActionRowNumbers", () => {
  it("lists every-other-row garment RCs from the first action", () => {
    expect(shapingActionRowNumbers(113, 5, 2)).toEqual([113, 115, 117, 119, 121]);
    expect(formatParentheticalShapingRowNumbers([113, 115, 117, 119, 121])).toBe(
      "<em>(RC: 113, 115, 117, 119, 121)</em>",
    );
  });
});

describe("evenShapingGarmentRowNumbers", () => {
  it("offsets the first decrease by one interval from the shaping start RC", () => {
    const sched = evenShapingSchedule(18, 28);
    expect(evenShapingGarmentRowNumbers(140, sched)).toEqual([
      141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158,
    ]);
  });
});
