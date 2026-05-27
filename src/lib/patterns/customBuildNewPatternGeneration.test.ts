/**
 * Regression: brand-new Custom Build sessions must generate from cbMeasurementOverrides,
 * not audience defaults — even when express-shaped wizard values live in builder storage.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { resolveEffectiveHemDepthInches } from "./customBuildEffectiveHemDepth";
import { calculateHemRowsFromInches, getDefaultHemLengthInches } from "./hemDefaults";
import { buildCustomBuildEffectivePatternInput } from "./buildCustomBuildEffectivePatternInput";
import {
  buildGeneratorPatternDataFromSources,
  mergedPatternForDisplayFromSources,
} from "./sleevelessPatternBuilderMerge";
import { resolveEffectiveFinishedBustInches } from "./customBuildEffectiveFinishedBust";
import { resolveEffectiveFinishedLengthInches } from "./customBuildEffectiveFinishedLength";
import { prepareCustomBuildPatternGeneration } from "./prepareCustomBuildPatternGeneration";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { syncCustomBuildToPatternStorage } from "./syncCustomBuildToPatternStorage";
import { CUSTOM_BUILD_STYLE_STORAGE_KEYS } from "./syncCustomBuildToPatternStorage";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { loadMeasurementOverrides } from "./sleevelessCustomMeasurementStorage";
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

function seedNewCustomBuildSession(hemDepth: string): void {
  localStorage.setItem(
    SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
    JSON.stringify({
      values: {
        who: "women",
        selectedSize: "M",
        fit: "standard",
        neckline: "round",
        front: "closed",
        style: "straight-pullover",
      },
      cbMeasurementOverrides: {
        finishedNeckOpeningWidth: "6",
        neckDepth: "3",
        shoulderWidth: "14",
        armholeDepth: "8",
        chestBust: "40",
        hip: "40",
        finishedLength: "24",
        hemDepth,
      },
    }),
  );
  localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape, "straight");
  localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType, "pullover");
  saveCurrentPattern({
    fit: {
      selectedSize: "M",
      easeChoice: "standard",
      sizingChart: "misses",
      selectedMeasurements: { ...baseMeasurements },
      cbMeasurementOverrides: {
        finishedNeckOpeningWidth: "6",
        neckDepth: "3",
        shoulderWidth: "14",
        armholeDepth: "8",
        chestBust: "40",
        hip: "40",
        finishedLength: "24",
        hemDepth,
      },
    },
    yarnGauge: { stitchGauge: "5", rowGauge: "7", gaugeRawUnit: "in" },
    machine: { availableNeedles: "200" },
  });
}

function createMeasureFlushRoot(hemDepth: string): ParentNode {
  const inputs = new Map<string, HTMLInputElement>([
    ["hemDepth", { value: hemDepth, trim: () => hemDepth } as HTMLInputElement],
  ]);
  return {
    querySelector(sel: string) {
      const match = /data-cb-measure-input="([^"]+)"/.exec(sel);
      if (!match) return null;
      return inputs.get(match[1]) ?? null;
    },
    querySelectorAll() {
      return [];
    },
  } as unknown as ParentNode;
}

describe("brand-new custom-build pattern generation", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("sync sets custom-build mode when only express-shaped wizard values exist", () => {
    seedNewCustomBuildSession("2");
    expect(getCurrentPattern().style?.patternMode).toBeUndefined();

    syncCustomBuildToPatternStorage({ awaitCharts: false });

    expect(getCurrentPattern().style?.patternMode).toBe("custom-build");
    expect(getPatternData().style?.patternMode).toBe("custom-build");
  });

  it("hem depth 4 drives generator math, body rows, and diagram tokens (not default 2)", () => {
    seedNewCustomBuildSession("2");
    syncCustomBuildToPatternStorage({ awaitCharts: false });

    const measureRoot = createMeasureFlushRoot("4");
    prepareCustomBuildPatternGeneration({ root: measureRoot, rehydrateSavedProject: false });

    expect(getCurrentPattern().style?.patternMode).toBe("custom-build");

    const merged = mergedPatternForDisplayFromSources(getCurrentPattern(), getPatternData());
    const genInput = buildGeneratorPatternDataFromSources(merged, getPatternData(), getCurrentPattern());

    expect(resolveEffectiveHemDepthInches(genInput, "misses")).toBe(4);
    expect(resolveEffectiveHemDepthInches(genInput, "misses")).not.toBe(
      getDefaultHemLengthInches("misses"),
    );

    const result = generateSleevelessBackPattern(genInput);
    const defaultHemRows = calculateHemRowsFromInches(7, getDefaultHemLengthInches("misses"));

    expect(result.debug.hemRows).toBe(calculateHemRowsFromInches(7, 4));
    expect(result.debug.hemRows).not.toBe(defaultHemRows);
    expect(result.debug.hemRows).toBeGreaterThan(defaultHemRows);

    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: genInput,
      measurementPiece: "front",
    });
    expect(repl.HEM_INCHES).toBe("4");
    expect(Number(repl.HEM_ROWS)).toBe(result.debug.hemRows);
  });

  it("effective pattern input uses canonical draft overrides when patternBuilderData is stale express (My Pattern path)", () => {
    saveCurrentPattern({
      fit: {
        selectedMeasurements: { ...baseMeasurements },
        cbMeasurementOverrides: {
          finishedNeckOpeningWidth: "6",
          neckDepth: "3",
          shoulderWidth: "14",
          armholeDepth: "8",
          chestBust: "42",
          hip: "42",
          finishedLength: "26",
          hemDepth: "4",
        },
      },
      style: { recipientCategory: "misses", bodyShape: "straight" },
      yarnGauge: { stitchGauge: "5", rowGauge: "7", gaugeRawUnit: "in" },
      machine: { availableNeedles: "200" },
    });
    savePatternData("style", {
      patternMode: "express",
      garmentStyle: "pullover",
      recipientCategory: "misses",
      bodyShape: "straight",
    });
    savePatternData("fit", {
      selectedMeasurements: { ...baseMeasurements },
      cbMeasurementOverrides: {
        chestBust: "40",
        hip: "40",
        finishedLength: "24",
        hemDepth: "2",
      },
    });
    savePatternData("yarnGaugeMachine", {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    });
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({
        values: { who: "women", selectedSize: "M", fit: "standard" },
        cbMeasurementOverrides: {
          chestBust: "40",
          hip: "40",
          finishedLength: "24",
          hemDepth: "2",
        },
      }),
    );

    expect(loadMeasurementOverrides().hemDepth).toBe("4");
    expect(loadMeasurementOverrides().chestBust).toBe("42");
    expect(loadMeasurementOverrides().finishedLength).toBe("26");

    const genInput = buildCustomBuildEffectivePatternInput();
    expect(genInput.style?.patternMode).toBe("custom-build");
    expect(resolveEffectiveHemDepthInches(genInput, "misses")).toBe(4);
    expect(resolveEffectiveFinishedBustInches(genInput)).toBe(42);
    expect(resolveEffectiveFinishedLengthInches(genInput)).toBe(26);

    const legacyGenInput = buildGeneratorPatternDataFromSources(
      mergedPatternForDisplayFromSources(getCurrentPattern(), getPatternData()),
      getPatternData(),
      getCurrentPattern(),
    );
    expect(legacyGenInput.style?.patternMode).toBe("custom-build");
    expect(resolveEffectiveHemDepthInches(legacyGenInput, "misses")).toBe(4);
    expect(resolveEffectiveFinishedLengthInches(legacyGenInput)).toBe(26);

    const result = generateSleevelessBackPattern(genInput);
    const defaultHemRows = calculateHemRowsFromInches(7, getDefaultHemLengthInches("misses"));
    expect(result.debug.hemRows).toBe(calculateHemRowsFromInches(7, 4));
    expect(result.debug.hemRows).not.toBe(defaultHemRows);
    expect(result.debug.expectedGarmentRows).toBe(Math.round(26 * 7));
    expect(result.debug.backNeckToHem).toBe(26);

    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: genInput,
      measurementPiece: "front",
    });
    expect(repl.HEM_INCHES).toBe("4");
    expect(Number(repl.HEM_ROWS)).toBe(result.debug.hemRows);
  });
});
