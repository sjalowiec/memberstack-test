import { describe, expect, it } from "vitest";
import {
  buildProjectRecord,
  gaugeFromProject,
  isSupportedCustomPatternProjectType,
  UNSUPPORTED_CUSTOM_PATTERN_TYPE_ERROR,
} from "./custom-pattern-projects-store.js";

const SLEEVELESS_ONLY_WARNING = "Only sleeveless pattern projects are supported in this phase.";

function projectInput(pattern, extra = {}) {
  return {
    name: "Test pattern",
    family: "sleeveless",
    source: "express",
    pattern,
    customOverrides: {},
    ...extra,
  };
}

describe("isSupportedCustomPatternProjectType", () => {
  it("accepts sleeveless and hat identities, including hat via patternSystem", () => {
    expect(isSupportedCustomPatternProjectType({ patternType: "sleeveless" })).toBe(true);
    expect(isSupportedCustomPatternProjectType({ patternType: "hat" })).toBe(true);
    expect(isSupportedCustomPatternProjectType({ patternSystem: "hat" })).toBe(true);
    expect(
      isSupportedCustomPatternProjectType({
        patternType: "sleeveless",
        style: { construction: "drop-shoulder", constructionAuthored: "drop-shoulder" },
      }),
    ).toBe(true);
  });

  it("rejects unsupported pattern types", () => {
    expect(isSupportedCustomPatternProjectType({ patternType: "raglan" })).toBe(false);
    expect(isSupportedCustomPatternProjectType({ patternType: "blanket" })).toBe(false);
    expect(isSupportedCustomPatternProjectType({})).toBe(false);
  });
});

describe("buildProjectRecord pattern-type gate", () => {
  it("saves a Hat project (patternType hat)", () => {
    const built = buildProjectRecord(
      projectInput({ patternType: "hat", patternSystem: "hat", brimType: "single" }),
      "user-1",
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.project.pattern.patternType).toBe("hat");
    expect(built.error).toBeUndefined();
  });

  it("saves a Hat project identified only by patternSystem", () => {
    const built = buildProjectRecord(projectInput({ patternSystem: "hat" }), "user-1");
    expect(built.ok).toBe(true);
  });

  it("still saves sleeveless and drop-shoulder (sleeveless blob type)", () => {
    expect(buildProjectRecord(projectInput({ patternType: "sleeveless" }), "user-1").ok).toBe(true);
    expect(
      buildProjectRecord(
        projectInput({
          patternType: "sleeveless",
          style: { construction: "drop-shoulder", constructionAuthored: "drop-shoulder" },
        }),
        "user-1",
      ).ok,
    ).toBe(true);
  });

  it("rejects unsupported types without the leftover sleeveless-only warning", () => {
    const built = buildProjectRecord(projectInput({ patternType: "raglan" }), "user-1");
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toBe(UNSUPPORTED_CUSTOM_PATTERN_TYPE_ERROR);
    expect(built.error).not.toBe(SLEEVELESS_ONLY_WARNING);
    expect(built.error).not.toMatch(/^Only sleeveless pattern projects are supported/);
  });
});

describe("gaugeFromProject", () => {
  it("derives Hat gauge from gaugeSlots instead of yarnGauge", () => {
    const gauge = gaugeFromProject({
      pattern: {
        patternType: "hat",
        patternSystem: "hat",
        unit: "inches",
        gaugeSlots: { inches: { stitch: "5", row: "7" }, cm: { stitch: "", row: "" } },
      },
    });
    expect(gauge).toEqual({
      stitchesPerInch: 1.25,
      rowsPerInch: 1.75,
      displayStitches: 5,
      displayRows: 7,
    });
  });

  it("returns null for a Hat with empty gaugeSlots", () => {
    expect(
      gaugeFromProject({
        pattern: {
          patternType: "hat",
          gaugeSlots: { inches: { stitch: "", row: "" }, cm: { stitch: "", row: "" } },
        },
      }),
    ).toBeNull();
  });

  it("still reads sweater yarnGauge", () => {
    expect(
      gaugeFromProject({
        pattern: { patternType: "sleeveless", yarnGauge: { stitchGauge: "7", rowGauge: "11" } },
      }),
    ).toEqual({ stitchesPerInch: 7, rowsPerInch: 11 });
  });
});
