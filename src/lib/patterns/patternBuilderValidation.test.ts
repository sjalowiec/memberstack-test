import { beforeEach, describe, expect, it } from "vitest";
import { hydrateSavedCustomPatternProjectSession } from "./hydrateSavedCustomPatternProject";
import { validatePatternBuilderRequired } from "./patternBuilderValidation";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import {
  getPatternData,
  savePatternData,
} from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";

function customBuildProjectWithDiagramOverrides(
  overrides: Record<string, string>,
): CustomPatternProject {
  return {
    id: "proj-cb",
    name: "Custom build test",
    family: "sleeveless",
    source: "custom-build",
    notes: "",
    customOverrides: {},
    createdAt: "t1",
    updatedAt: "t2",
    version: 1,
    pattern: {
      id: "pattern-cb",
      patternType: "sleeveless",
      status: "draft",
      version: 1,
      createdAt: "t1",
      updatedAt: "t1",
      style: {
        patternMode: "custom-build",
        recipientCategory: "misses",
        bodyShape: "straight",
        frontStyle: "closed",
        garmentStyle: "pullover",
        neckline: "round",
      },
      fit: {
        selectedSize: "3",
        easeChoice: "standard",
        sizingChart: "misses",
        cbMeasurementOverrides: { ...overrides },
      },
      yarnGauge: {
        stitchGauge: "7",
        rowGauge: "11",
        gaugeStitchRaw: "28",
        gaugeRowRaw: "44",
        gaugeRawUnit: "in",
      },
      measurements: {},
      machine: { availableNeedles: "200" },
      calculations: {},
      instructions: {},
      patternProject: {
        title: "Custom build test",
        notes: "",
        titleCustomized: true,
      },
    },
  };
}

describe("validatePatternBuilderRequired saved custom-build compatibility", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("passes when bust lives in cbMeasurementOverrides.chestBust without selectedMeasurements", () => {
    hydrateSavedCustomPatternProjectSession(
      customBuildProjectWithDiagramOverrides({
        chestBust: "40",
        finishedLength: "24",
        armholeDepth: "8",
        shoulderWidth: "14",
        finishedNeckOpeningWidth: "6",
        neckDepth: "3",
        hip: "40",
      }),
    );
    savePatternData("yarnGaugeMachine", {
      gaugeStitchesPerInch: "7",
      gaugeRowsPerInch: "11",
      gaugeStitchRaw: "28",
      gaugeRowRaw: "44",
      gaugeRawUnit: "in",
      availableNeedles: "200",
    });

    const validation = validatePatternBuilderRequired(getPatternData());
    expect(validation.ok).toBe(true);
    expect(validation.missingItems.map((m) => m.id)).not.toContain("finished_bust_chest");
    expect(validation.missingItems.map((m) => m.id)).not.toContain("design_choices");
  });

  it("still fails when neither chart bust nor diagram chestBust override is present", () => {
    hydrateSavedCustomPatternProjectSession(
      customBuildProjectWithDiagramOverrides({
        finishedLength: "24",
        armholeDepth: "8",
        shoulderWidth: "14",
        finishedNeckOpeningWidth: "6",
        neckDepth: "3",
        hip: "40",
      }),
    );
    savePatternData("yarnGaugeMachine", {
      gaugeStitchesPerInch: "7",
      gaugeRowsPerInch: "11",
      availableNeedles: "200",
    });

    const validation = validatePatternBuilderRequired(getPatternData());
    expect(validation.ok).toBe(false);
    expect(validation.missingItems.some((m) => m.id === "finished_bust_chest")).toBe(true);
  });
});
