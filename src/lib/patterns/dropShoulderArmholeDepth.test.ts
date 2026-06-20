import { describe, expect, it } from "vitest";
import { computeDropShoulderArmholeDepthInches } from "./dropShoulderArmholeDepth";

describe("computeDropShoulderArmholeDepthInches", () => {
  it("returns upper arm divided by two", () => {
    expect(computeDropShoulderArmholeDepthInches(12)).toBe(6);
    expect(computeDropShoulderArmholeDepthInches(6.25)).toBe(3.125);
  });

  it("returns undefined for missing or non-positive upper arm", () => {
    expect(computeDropShoulderArmholeDepthInches(undefined)).toBeUndefined();
    expect(computeDropShoulderArmholeDepthInches(0)).toBeUndefined();
    expect(computeDropShoulderArmholeDepthInches(-1)).toBeUndefined();
  });
});
