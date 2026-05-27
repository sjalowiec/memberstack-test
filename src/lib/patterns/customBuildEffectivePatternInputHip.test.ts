/**
 * Regression: custom-build hip in cbMeasurementOverrides must reach pattern math and diagram tokens.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { buildCustomBuildEffectivePatternInput } from "./buildCustomBuildEffectivePatternInput";
import { resolveEffectiveFinishedHipInches } from "./customBuildEffectiveFinishedHip";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import {
  loadMeasurementOverrides,
  persistMeasurementOverrides,
} from "./sleevelessCustomMeasurementStorage";
import {
  saveCurrentPattern,
  savePatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { CUSTOM_BUILD_STYLE_STORAGE_KEYS } from "./sleevelessCustomBuildStyleKeys";
import { stubLocalStorage } from "./test/stubLocalStorage";

const baseMeasurements = {
  finished_bust_chest: 41,
  finished_hip: 41,
  back_neck_to_hem: 24,
  armhole_depth: 8,
  neck_opening: 3,
  shoulder_width: 4.25,
  front_neck_depth: 3,
  back_neck_depth: 1,
};

function readCb(gen: Record<string, unknown>): Record<string, string> {
  const fit = gen.fit as { cbMeasurementOverrides?: Record<string, string> } | undefined;
  return (fit?.cbMeasurementOverrides ?? {}) as Record<string, string>;
}

function seedCustomBuildStraightSession(overrides: Record<string, string>): void {
  localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape, "straight");
  localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType, "pullover");
  localStorage.setItem(
    SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
    JSON.stringify({
      values: { who: "women", selectedSize: "M", fit: "standard" },
      cbMeasurementOverrides: overrides,
    }),
  );
  saveCurrentPattern({
    style: { patternMode: "custom-build", bodyShape: "straight", garmentStyle: "pullover" },
    fit: {
      selectedSize: "M",
      selectedMeasurements: { ...baseMeasurements },
      cbMeasurementOverrides: overrides,
    },
    yarnGauge: { stitchGauge: "5", rowGauge: "7" },
    machine: { availableNeedles: "200" },
    measurements: { finishedHip: 41 },
  });
  savePatternData("style", { patternMode: "custom-build", bodyShape: "straight", garmentStyle: "pullover" });
  savePatternData("fit", {
    selectedSize: "M",
    selectedMeasurements: { ...baseMeasurements },
    cbMeasurementOverrides: overrides,
  });
  savePatternData("yarnGaugeMachine", {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  });
}

describe("custom build effective pattern input — hip 43 / chestBust 41", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("buildCustomBuildEffectivePatternInput includes hip in cbMeasurementOverrides", () => {
    seedCustomBuildStraightSession({
      hemDepth: "2",
      chestBust: "41",
      hip: "43",
      finishedLength: "24",
    });

    const genInput = buildCustomBuildEffectivePatternInput();
    expect(readCb(genInput).hip).toBe("43");
    expect(readCb(genInput).chestBust).toBe("41");
    expect(loadMeasurementOverrides().hip).toBe("43");
    expect(resolveEffectiveFinishedHipInches(genInput)).toBe(43);
  });

  it("generateSleevelessBackPattern uses hip width (hem cast-on above bust-only straight)", () => {
    seedCustomBuildStraightSession({
      hemDepth: "2",
      chestBust: "41",
      hip: "43",
      finishedLength: "24",
    });

    const genInput = buildCustomBuildEffectivePatternInput();
    const straightBustOnly = generateSleevelessBackPattern({
      ...genInput,
      fit: {
        ...(genInput.fit as Record<string, unknown>),
        cbMeasurementOverrides: {
          ...readCb(genInput),
          hip: "41",
        },
      },
    });
    const withWideHip = generateSleevelessBackPattern(genInput);

    expect(withWideHip.debug.hemCastOnStitches).toBeGreaterThan(straightBustOnly.debug.hemCastOnStitches!);
    expect(withWideHip.debug.bustBodyStitches).toBe(straightBustOnly.debug.bustBodyStitches);
  });

  it("diagram HIP_STS reflects hip 43, not bust 41", () => {
    seedCustomBuildStraightSession({
      hemDepth: "2",
      chestBust: "41",
      hip: "43",
      finishedLength: "24",
    });

    const genInput = buildCustomBuildEffectivePatternInput();
    const result = generateSleevelessBackPattern(genInput);
    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: genInput,
      measurementPiece: "front",
    });

    const bustOnlyResult = generateSleevelessBackPattern({
      ...genInput,
      fit: {
        ...(genInput.fit as Record<string, unknown>),
        cbMeasurementOverrides: { ...readCb(genInput), hip: "41" },
      },
    });
    const bustOnlyRepl = buildSleevelessGarmentDiagramReplacements(bustOnlyResult, "in", {
      patternData: genInput,
      measurementPiece: "front",
    });

    expect(result.debug.hemCastOnStitches).toBeGreaterThan(bustOnlyResult.debug.hemCastOnStitches!);
    expect(Number(repl.HIP_STS)).toBeGreaterThan(Number(bustOnlyRepl.HIP_STS));
    expect(repl.HIP_STS).toBe(String(result.debug.hemCastOnStitches));
  });

  it("augments hip from measurements.finishedHip when fit.cb overrides omit hip", () => {
    seedCustomBuildStraightSession({
      hemDepth: "2",
      chestBust: "41",
      finishedLength: "24",
    });
    saveCurrentPattern({
      measurements: { finishedHip: 43 },
    });
    persistMeasurementOverrides({
      hemDepth: "2",
      chestBust: "41",
      finishedLength: "24",
    });

    const genInput = buildCustomBuildEffectivePatternInput();
    expect(readCb(genInput).hip).toBe("43");
    expect(resolveEffectiveFinishedHipInches(genInput)).toBe(43);
  });
});
