import { describe, expect, it } from "vitest";
import {
  YARN_REQUIREMENT_BUFFER,
  estimateYarnWeightWithBuffer,
  resolveYarnProjectAreaSquareInches,
} from "./yarnRequirementDimensions";

describe("yarnRequirementDimensions", () => {
  it("keeps the existing 10% buffer", () => {
    expect(YARN_REQUIREMENT_BUFFER).toBe(1.1);
  });

  it("estimates yarn as density × area × buffer (sweater/hat shared formula)", () => {
    // 4×4 swatch @ 10g → 10/16 g per in²; 40×60 piece = 2400 in² → 1500g × 1.1 = 1650g
    const grams = estimateYarnWeightWithBuffer({
      swatchWidthInches: 4,
      swatchLengthInches: 4,
      swatchWeight: 10,
      projectAreaSquareInches: 40 * 60,
    });
    expect(grams).toBeCloseTo(1650, 10);
  });

  it("uses W×L when no explicit fabric area is provided", () => {
    expect(
      resolveYarnProjectAreaSquareInches({
        widthInches: 20.5,
        lengthInches: 11,
      }),
    ).toBe(20.5 * 11);
  });

  it("prefers explicit fabric area over W×L", () => {
    expect(
      resolveYarnProjectAreaSquareInches({
        widthInches: 20.5,
        lengthInches: 11,
        projectAreaSquareInches: 250,
      }),
    ).toBe(250);
  });

  it("ignores non-positive explicit area and falls back to W×L", () => {
    expect(
      resolveYarnProjectAreaSquareInches({
        widthInches: 10,
        lengthInches: 8,
        projectAreaSquareInches: 0,
      }),
    ).toBe(80);
  });
});
