import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveEffectiveArmholeDepthInches } from "./customBuildEffectiveArmholeDepth";
import * as customMeasurementStorage from "./sleevelessCustomMeasurementStorage";
import {
  applyCustomBuildMeasurementOverridesToGenerator,
  buildGeneratorPatternDataFromSources,
  buildSleevelessGarmentDiagramPatternData,
  resolveCustomBuildGarmentStyleForStyle,
  resolveCustomBuildNecklineForStyle,
  resolveGeneratorPatternMode,
  storageNecklineIndicatesVNeck,
} from "./sleevelessPatternBuilderMerge";
import { CUSTOM_BUILD_GARMENT_TYPE_KEY } from "./sleevelessCustomBuildWizardNeckline";
import { resolveSleevelessFrontDiagram } from "./sleevelessFrontDiagramSrc";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";

const baseMeasurements = {
  finished_bust_chest: 40,
  back_neck_to_hem: 22,
  armhole_depth: 8,
  neck_opening: 3,
  shoulder_width: 4.25,
  front_neck_depth: 3,
  back_neck_depth: 1,
};

describe("resolveGeneratorPatternMode", () => {
  it("prefers custom-build when canonical is custom-build and patternBuilderData is express", () => {
    expect(
      resolveGeneratorPatternMode({ patternMode: "custom-build" }, { patternMode: "express" }),
    ).toBe("custom-build");
  });
});

describe("resolveCustomBuildNecklineForStyle", () => {
  it("prefers V-neck when patternBuilderData has v but canonical still has round", () => {
    expect(resolveCustomBuildNecklineForStyle({ neckline: "round" }, { neckline: "v" })).toBe("v");
    expect(resolveCustomBuildNecklineForStyle({ neckline: "round" }, { neckline: "v-neck" })).toBe("v");
    expect(storageNecklineIndicatesVNeck("v-neck")).toBe(true);
  });

  it("prefers wizard express v-neck when both stored styles are still round", () => {
    expect(
      resolveCustomBuildNecklineForStyle({ neckline: "round" }, { neckline: "round" }, "v-neck"),
    ).toBe("v");
  });
});

describe("buildGeneratorPatternDataFromSources V-neck front diagram routing", () => {
  const lsStore: Record<string, string> = {};

  beforeEach(() => {
    for (const k of Object.keys(lsStore)) delete lsStore[k];
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => lsStore[key] ?? null,
      setItem: (key: string, value: string) => {
        lsStore[key] = value;
      },
      removeItem: (key: string) => {
        delete lsStore[key];
      },
    });
  });

  it("routes to diagram-front-V.svg when express values have v-neck but stored styles are round", () => {
    lsStore[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] = JSON.stringify({
      values: { neckline: "v-neck", who: "women", fit: "standard", selectedSize: "M" },
    });

    const merged = {
      style: { patternMode: "custom-build", neckline: "round", garmentStyle: "pullover" },
      fit: { selectedMeasurements: baseMeasurements },
    };
    const pb = {
      style: { patternMode: "custom-build", neckline: "round", garmentStyle: "pullover" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    };

    const gen = buildGeneratorPatternDataFromSources(merged, pb);
    expect(gen.style).toMatchObject({ neckline: "v" });

    const diagramData = buildSleevelessGarmentDiagramPatternData(merged, gen);
    const front = resolveSleevelessFrontDiagram(diagramData, { devForceCardiganHalfLeft: false });
    expect(front.diagramType).toBe("pulloverFullFrontV");
    expect(front.src).toBe("/images/patterns/sleeveless/diagram-front-V.svg");
  });

  it("routes to diagram-front-V.svg when canonical cardigan is stale but wizard is pullover v-neck", () => {
    lsStore[CUSTOM_BUILD_GARMENT_TYPE_KEY] = "pullover";
    lsStore[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] = JSON.stringify({
      values: { neckline: "v-neck" },
    });

    const merged = {
      style: {
        patternMode: "custom-build",
        neckline: "v",
        garmentStyle: "cardigan",
        frontStyle: "open",
      },
      fit: { selectedMeasurements: baseMeasurements },
    };
    const pb = {
      style: {
        patternMode: "custom-build",
        neckline: "round",
        garmentStyle: "pullover",
        frontStyle: "closed",
      },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    };

    const gen = buildGeneratorPatternDataFromSources(merged, pb);
    expect(gen.style).toMatchObject({
      neckline: "v",
      garmentStyle: "pullover",
      frontStyle: "closed",
    });

    const diagramData = buildSleevelessGarmentDiagramPatternData(merged, gen);
    const front = resolveSleevelessFrontDiagram(diagramData, { devForceCardiganHalfLeft: false });
    expect(front.diagramType).toBe("pulloverFullFrontV");
    expect(front.src).toBe("/images/patterns/sleeveless/diagram-front-V.svg");
  });

  it("routes to diagram-front-V.svg when canonical round is stale but PB has v-neck", () => {
    const merged = {
      style: { patternMode: "custom-build", neckline: "round", garmentStyle: "pullover" },
      fit: { selectedMeasurements: baseMeasurements },
    };
    const pb = {
      style: { patternMode: "custom-build", neckline: "v-neck", garmentStyle: "pullover" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    };

    const gen = buildGeneratorPatternDataFromSources(merged, pb);
    expect(gen.style).toMatchObject({ neckline: "v" });

    const diagramData = buildSleevelessGarmentDiagramPatternData(merged, gen);
    const front = resolveSleevelessFrontDiagram(diagramData, { devForceCardiganHalfLeft: false });
    expect(front.diagramType).toBe("pulloverFullFrontV");
    expect(front.src).toBe("/images/patterns/sleeveless/diagram-front-V.svg");
  });
});

describe("resolveCustomBuildGarmentStyleForStyle", () => {
  it("prefers pullover when canonical cardigan is stale and patternBuilderData is pullover", () => {
    expect(
      resolveCustomBuildGarmentStyleForStyle(
        { garmentStyle: "cardigan", frontStyle: "open" },
        { garmentStyle: "pullover", frontStyle: "closed" },
      ),
    ).toEqual({ garmentStyle: "pullover", frontStyle: "closed" });
  });

  it("uses wizard garmentType when set", () => {
    expect(
      resolveCustomBuildGarmentStyleForStyle(
        { garmentStyle: "cardigan" },
        { garmentStyle: "cardigan" },
        "pullover",
      ),
    ).toEqual({ garmentStyle: "pullover", frontStyle: "closed" });
  });
});

describe("buildGeneratorPatternDataFromSources", () => {
  it("applies armhole override when patternBuilderData still has express mode", () => {
    const merged = {
      style: { patternMode: "custom-build", neckline: "round", garmentStyle: "pullover" },
      fit: { selectedMeasurements: baseMeasurements },
    };
    const pb = {
      style: { patternMode: "express", neckline: "round", garmentStyle: "pullover" },
      fit: { selectedMeasurements: baseMeasurements },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    };

    vi.spyOn(customMeasurementStorage, "loadMeasurementOverrides").mockReturnValue({
      armholeDepth: "10",
    });
    const gen = buildGeneratorPatternDataFromSources(merged, pb);

    expect(gen.style).toMatchObject({ patternMode: "custom-build" });
    expect(resolveEffectiveArmholeDepthInches(gen)).toBe(10);

    const result = generateSleevelessBackPattern(gen);
    expect(result.debug.armholeDepth).toBe(10);
  });

  it("does not apply storage overrides when generator mode is express", () => {
    const gen = applyCustomBuildMeasurementOverridesToGenerator(
      {
        style: { patternMode: "express" },
        fit: { selectedMeasurements: baseMeasurements },
      },
      () => ({ armholeDepth: "10" }),
    );
    expect(gen.fit).not.toHaveProperty("cbMeasurementOverrides");
    expect(resolveEffectiveArmholeDepthInches(gen)).toBe(8);
  });
});
