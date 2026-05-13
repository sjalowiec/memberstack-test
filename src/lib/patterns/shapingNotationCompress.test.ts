import { describe, expect, it } from "vitest";
import { compressStitchDecreasePointsToNotationLines, type StitchDecreasePoint } from "./shapingNotationCompress";

describe("compressStitchDecreasePointsToNotationLines", () => {
  it("merges consecutive same-gap single-stitch decreases into one segment", () => {
    const pts: StitchDecreasePoint[] = Array.from({ length: 26 }, (_, i) => ({
      row: 200 + i,
      amount: 1,
    }));
    expect(compressStitchDecreasePointsToNotationLines(pts)).toEqual(["1s-1r-26x"]);
  });

  it("splits only when the row interval between decreases changes", () => {
    const pts: StitchDecreasePoint[] = [
      { row: 10, amount: 1 },
      { row: 12, amount: 1 },
      { row: 14, amount: 1 },
      { row: 15, amount: 1 },
      { row: 16, amount: 1 },
    ];
    expect(compressStitchDecreasePointsToNotationLines(pts)).toEqual(["1s-2r-3x", "1s-1r-2x"]);
  });
});
