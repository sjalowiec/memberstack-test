import { describe, expect, it } from "vitest";
import {
  approximatePickupStitchesFromRows,
  MACHINE_KNITTING_PICKUP_2_PER_3_ROWS,
} from "./machineKnittingPickupRatio";

describe("approximatePickupStitchesFromRows", () => {
  it("uses 2 stitches per 3 rows by default", () => {
    expect(approximatePickupStitchesFromRows(3)).toBe(2);
    expect(approximatePickupStitchesFromRows(6)).toBe(4);
    expect(approximatePickupStitchesFromRows(150)).toBe(100);
  });

  it("returns 0 for zero rows and at least 1 for positive rows", () => {
    expect(approximatePickupStitchesFromRows(0)).toBe(0);
    expect(approximatePickupStitchesFromRows(1)).toBe(1);
  });

  it("accepts a custom ratio", () => {
    expect(
      approximatePickupStitchesFromRows(12, { stitches: 3, rows: 4 }),
    ).toBe(9);
    expect(MACHINE_KNITTING_PICKUP_2_PER_3_ROWS).toEqual({ stitches: 2, rows: 3 });
  });
});
