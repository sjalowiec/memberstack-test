import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import {
  buildGeneratorPatternDataFromSources,
  mergedPatternForDisplayFromSources,
} from "./sleevelessPatternBuilderMerge";
import { calculateHemRowsFromInches } from "./hemDefaults";
import { resolveEffectiveHemDepthInches } from "./customBuildEffectiveHemDepth";
import {
  collectCustomBuildMeasurementOverridesFromDom,
  flushCustomBuildMeasurementOverridesToCanonical,
  loadMeasurementOverrides,
  persistMeasurementOverrides,
} from "./sleevelessCustomMeasurementStorage";
import { prepareCustomBuildPatternGeneration } from "./prepareCustomBuildPatternGeneration";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";

const baseMeasurements = {
  finished_bust_chest: 40,
  back_neck_to_hem: 22,
  armhole_depth: 8,
  neck_opening: 3,
  shoulder_width: 4.25,
  front_neck_depth: 3,
  back_neck_depth: 1,
};

function seedCustomBuildDraft(hemDepth = "2"): void {
  saveCurrentPattern({
    style: { patternMode: "custom-build", recipientCategory: "misses", bodyShape: "straight" },
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
  savePatternData("style", getCurrentPattern().style as Record<string, unknown>);
  savePatternData("fit", getCurrentPattern().fit as Record<string, unknown>);
  savePatternData("yarnGaugeMachine", {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  });
  localStorage.setItem(
    SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
    JSON.stringify({
      values: { who: "women", selectedSize: "M", fit: "standard" },
      cbMeasurementOverrides: getCurrentPattern().fit?.cbMeasurementOverrides,
    }),
  );
}

function createMeasureFlushRoot(values: Partial<Record<string, string>>): ParentNode {
  const inputs = new Map(
    Object.entries(values).map(([key, value]) => [
      key,
      { value, trim: () => value.trim() } as HTMLInputElement,
    ]),
  );
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

describe("prepareCustomBuildPatternGeneration", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("flushes visible hem depth into storage before generation uses edited value", () => {
    seedCustomBuildDraft("2");
    const measureRoot = createMeasureFlushRoot({ hemDepth: "4" });

    prepareCustomBuildPatternGeneration({ root: measureRoot, rehydrateSavedProject: false });

    expect(loadMeasurementOverrides().hemDepth).toBe("4");

    const merged = mergedPatternForDisplayFromSources(getCurrentPattern(), getPatternData());
    const genInput = buildGeneratorPatternDataFromSources(merged, getPatternData(), getCurrentPattern());
    expect(resolveEffectiveHemDepthInches(genInput, "misses")).toBe(4);

    const result = generateSleevelessBackPattern(genInput);
    expect(result.debug.hemRows).toBe(calculateHemRowsFromInches(7, 4));

    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: genInput,
      measurementPiece: "front",
    });
    expect(repl.HEM_INCHES).toBe("4");
    expect(Number(repl.HEM_ROWS)).toBe(result.debug.hemRows);
  });
});

describe("loadMeasurementOverrides canonical precedence", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("prefers canonical draft hemDepth over stale express builder storage", () => {
    saveCurrentPattern({
      style: { patternMode: "custom-build" },
      fit: { cbMeasurementOverrides: { hemDepth: "4" } },
    });
    savePatternData("fit", { cbMeasurementOverrides: { hemDepth: "2" } });
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({ cbMeasurementOverrides: { hemDepth: "2" } }),
    );

    expect(loadMeasurementOverrides().hemDepth).toBe("4");
  });
});

describe("collectCustomBuildMeasurementOverridesFromDom hem depth", () => {
  it("reads unblurred hem depth input", () => {
    const root = createMeasureFlushRoot({ hemDepth: "3.5" });
    expect(collectCustomBuildMeasurementOverridesFromDom(root).hemDepth).toBe("3.5");
  });
});

describe("edited hem depth end-to-end generation", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("generated pattern and diagram reflect persisted hem depth override", () => {
    seedCustomBuildDraft("2");
    const mergedBaseline = mergedPatternForDisplayFromSources(getCurrentPattern(), getPatternData());
    const baselineInput = buildGeneratorPatternDataFromSources(
      mergedBaseline,
      getPatternData(),
      getCurrentPattern(),
    );
    const baseline = generateSleevelessBackPattern(baselineInput);

    persistMeasurementOverrides({ ...loadMeasurementOverrides(), hemDepth: "4" });
    flushCustomBuildMeasurementOverridesToCanonical();

    const merged = mergedPatternForDisplayFromSources(getCurrentPattern(), getPatternData());
    const genInput = buildGeneratorPatternDataFromSources(merged, getPatternData(), getCurrentPattern());
    const edited = generateSleevelessBackPattern(genInput);

    expect(edited.debug.hemRows).toBeGreaterThan(baseline.debug.hemRows);
    expect(edited.debug.hemRows).toBe(calculateHemRowsFromInches(7, 4));

    const repl = buildSleevelessGarmentDiagramReplacements(edited, "in", {
      patternData: genInput,
      measurementPiece: "front",
    });
    expect(repl.HEM_INCHES).toBe("4");
    expect(Number(repl.HEM_ROWS)).toBe(edited.debug.hemRows);
  });
});
