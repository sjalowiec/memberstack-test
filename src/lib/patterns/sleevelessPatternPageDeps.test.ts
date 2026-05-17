/**
 * Regression: pattern page boot sync + diagram helpers import cleanly (no circular init failures).
 */
import { describe, expect, it } from "vitest";
import { buildSleevelessGarmentDiagramPatternData } from "./sleevelessPatternBuilderMerge";
import { syncCustomBuildToPatternStorage } from "./syncCustomBuildToPatternStorage";

describe("sleeveless pattern page dependencies", () => {
  it("exports syncCustomBuildToPatternStorage for custom-build pattern tab refresh", () => {
    expect(typeof syncCustomBuildToPatternStorage).toBe("function");
  });

  it("buildSleevelessGarmentDiagramPatternData accepts undefined generator input", () => {
    const data = buildSleevelessGarmentDiagramPatternData(
      { style: { neckline: "round" }, fit: {} },
      undefined,
    );
    expect(data.style?.neckline).toBe("round");
  });
});
