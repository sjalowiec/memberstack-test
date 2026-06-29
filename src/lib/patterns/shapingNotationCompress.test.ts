import { describe, expect, it } from "vitest";
import {
  compressStitchDecreasePointsToNotationLines,
  consolidateConsecutiveJapaneseNotationLines,
  type StitchDecreasePoint,
} from "./shapingNotationCompress";

describe("consolidateConsecutiveJapaneseNotationLines", () => {
  it("merges two consecutive identical shaping segments into one repeat count of 2", () => {
    expect(
      consolidateConsecutiveJapaneseNotationLines(["3s-2r-1x", "3s-2r-1x"]),
    ).toEqual(["3s-2r-2x"]);
  });

  it("merges three consecutive identical shaping segments into one repeat count of 3", () => {
    expect(
      consolidateConsecutiveJapaneseNotationLines(["1s-2r-1x", "1s-2r-1x", "1s-2r-1x"]),
    ).toEqual(["1s-2r-3x"]);
  });

  it("does not merge identical segments separated by a different operation", () => {
    expect(
      consolidateConsecutiveJapaneseNotationLines(["3s-2r-1x", "2s-2r-1x", "3s-2r-1x"]),
    ).toEqual(["3s-2r-1x", "2s-2r-1x", "3s-2r-1x"]);
  });

  it("leaves bind-off and hold lines on their own lines", () => {
    expect(
      consolidateConsecutiveJapaneseNotationLines(["bo12", "3s-2r-1x", "3s-2r-1x", "1s-2r-6x"]),
    ).toEqual(["bo12", "3s-2r-2x", "1s-2r-6x"]);
  });

  it("merges segments that already carry a repeat count when stitches and rows match", () => {
    expect(
      consolidateConsecutiveJapaneseNotationLines(["3s-2r-2x", "3s-2r-1x"]),
    ).toEqual(["3s-2r-3x"]);
  });
});

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
