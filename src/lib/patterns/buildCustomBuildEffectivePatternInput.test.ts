import { beforeEach, describe, expect, it } from "vitest";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { buildCustomBuildEffectivePatternInput } from "./buildCustomBuildEffectivePatternInput";
import { resolveEffectiveHemDepthInches } from "./customBuildEffectiveHemDepth";
import { calculateHemRowsFromInches } from "./hemDefaults";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import {
  saveCurrentPattern,
  savePatternData,
} from "./patternStorage";
import { CUSTOM_BUILD_STYLE_STORAGE_KEYS } from "./sleevelessCustomBuildStyleKeys";
import { stubLocalStorage } from "./test/stubLocalStorage";

const baseMeasurements = {
  finished_bust_chest: 40,
  back_neck_to_hem: 24,
  armhole_depth: 8,
  neck_opening: 3,
  shoulder_width: 4.25,
  front_neck_depth: 3,
  back_neck_depth: 1,
};

describe("buildCustomBuildEffectivePatternInput patternMode", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("forces custom-build when overrides exist and storage is stale express (custom-build style step)", () => {
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape, "straight");
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType, "pullover");

    saveCurrentPattern({
      style: { patternMode: "express", recipientCategory: "misses", bodyShape: "straight" },
      fit: {
        selectedMeasurements: { ...baseMeasurements },
        cbMeasurementOverrides: {
          hemDepth: "1",
          chestBust: "40",
          finishedLength: "24",
        },
      },
      yarnGauge: { stitchGauge: "5", rowGauge: "7" },
      machine: { availableNeedles: "200" },
    });
    savePatternData("style", {
      patternMode: "express",
      garmentStyle: "pullover",
      recipientCategory: "misses",
    });
    savePatternData("fit", {
      selectedMeasurements: { ...baseMeasurements },
      cbMeasurementOverrides: { hemDepth: "2", chestBust: "40", finishedLength: "24" },
    });
    savePatternData("yarnGaugeMachine", {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    });

    const genInput = buildCustomBuildEffectivePatternInput();

    expect(genInput.fit?.cbMeasurementOverrides).toMatchObject({ hemDepth: "1" });
    expect(genInput.style?.patternMode).toBe("custom-build");
    expect(resolveEffectiveHemDepthInches(genInput, "misses")).toBe(1);

    const result = generateSleevelessBackPattern(genInput);
    expect(result.debug.hemRows).toBe(calculateHemRowsFromInches(7, 1));

    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: genInput,
      measurementPiece: "front",
    });
    expect(Number(repl.HEM_ROWS)).toBe(result.debug.hemRows);
    expect(result.debug.hemRows).toBeLessThan(calculateHemRowsFromInches(7, 2));
  });

  it("keeps express mode for intentional express-only sessions with review overrides", () => {
    saveCurrentPattern({
      style: { patternMode: "express", recipientCategory: "misses" },
      fit: {
        selectedMeasurements: { ...baseMeasurements },
        cbMeasurementOverrides: { hemDepth: "1.75", chestBust: "20", hip: "28.8" },
      },
      yarnGauge: { stitchGauge: "5", rowGauge: "7" },
      machine: { availableNeedles: "200" },
    });
    savePatternData("style", { patternMode: "express", garmentStyle: "pullover" });
    savePatternData("fit", {
      selectedMeasurements: { ...baseMeasurements },
      cbMeasurementOverrides: { hemDepth: "1.75", chestBust: "20", hip: "28.8" },
    });
    savePatternData("yarnGaugeMachine", {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    });

    const genInput = buildCustomBuildEffectivePatternInput();

    expect(genInput.style?.patternMode).toBe("express");
    expect(resolveEffectiveHemDepthInches(genInput, "misses")).toBe(2);
  });
});
