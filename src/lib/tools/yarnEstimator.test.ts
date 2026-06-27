import { describe, expect, it } from "vitest";
import {
  estimateYarnGrams,
  formatGrams,
  formatYarnEstimateResult,
  parsePositiveNumber,
} from "./yarnEstimator";

describe("yarnEstimator", () => {
  it("parses positive numbers", () => {
    expect(parsePositiveNumber("4")).toBe(4);
    expect(parsePositiveNumber(" 2.5 ")).toBe(2.5);
    expect(parsePositiveNumber("")).toBeNull();
    expect(parsePositiveNumber("0")).toBeNull();
    expect(parsePositiveNumber("-1")).toBeNull();
    expect(parsePositiveNumber("abc")).toBeNull();
  });

  it("formats grams without trailing decimals for whole numbers", () => {
    expect(formatGrams(120)).toBe("120");
    expect(formatGrams(120.4)).toBe("120.4");
    expect(formatGrams(120.45)).toBe("120.5");
  });

  it("estimates yarn from swatch and piece dimensions", () => {
    const grams = estimateYarnGrams({
      swatchWidth: 4,
      swatchHeight: 4,
      swatchWeight: 10,
      pieceWidth: 40,
      pieceHeight: 60,
    });
    expect(grams).toBe(1500);
    expect(formatYarnEstimateResult(grams)).toBe("1500 grams are needed for this piece");
  });
});
