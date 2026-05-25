import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOM_BUILD_STYLE_STORAGE_KEYS,
  readCustomBuildExpressValues,
  syncCustomBuildToPatternStorage,
} from "./syncCustomBuildToPatternStorage";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";

vi.mock("./sleevelessExpressSizeChartClient", () => ({
  loadExpressSweaterCharts: vi.fn().mockResolvedValue(undefined),
  findExpressChartRow: vi.fn(() => ({
    size: "M",
    bust_or_chest: 36,
    waist: 30,
    hip: 38,
    garment_back_length: 24,
    armhole_depth: 8,
    shoulder_width: 14,
    neck_opening: 6,
    front_neck_depth: 3,
  })),
  resolveExpressChartFit: vi.fn(() => ({
    selectedSize: "M",
    selectedMeasurements: {
      finished_bust_chest: 39,
      finished_waist: 33,
      finished_hip: 39,
      back_neck_to_hem: 24,
    },
  })),
  computeDefaultMeasurementsFromChartRow: vi.fn(),
  nonEmptyTrimmed: (s: unknown) => typeof s === "string" && s.trim() !== "",
}));

describe("syncCustomBuildToPatternStorage", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    });
  });

  it("sets custom-build pattern mode and chart measurements", async () => {
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({
        values: {
          who: "women",
          selectedSize: "M",
          fit: "standard",
          neckline: "round",
        },
      }),
    );
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape, "straight");
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType, "pullover");

    syncCustomBuildToPatternStorage({ awaitCharts: false });

    const pattern = getCurrentPattern();
    expect(pattern.style?.patternMode).toBe("custom-build");
    expect(pattern.style?.garmentStyle).toBe("pullover");
    expect(pattern.fit?.selectedSize).toBe("M");
    expect(pattern.fit?.selectedMeasurements?.finished_bust_chest).toBe(39);

    const pb = getPatternData();
    expect(pb.style?.patternMode).toBe("custom-build");
    expect(readCustomBuildExpressValues().who).toBe("women");
  });

  it("persists cardigan garmentStyle to canonical and patternBuilderData", () => {
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({
        values: {
          who: "women",
          selectedSize: "M",
          fit: "standard",
          neckline: "round",
        },
      }),
    );
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape, "straight");
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType, "cardigan");

    syncCustomBuildToPatternStorage({ awaitCharts: false });

    expect(getCurrentPattern().style?.garmentStyle).toBe("cardigan");
    expect(getCurrentPattern().style?.frontStyle).toBe("open");
    expect(getPatternData().style?.garmentStyle).toBe("cardigan");
    expect(getPatternData().style?.frontStyle).toBe("open");
  });

  it("writes v neckline to pattern storage when express values have v-neck", () => {
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({
        values: {
          who: "women",
          selectedSize: "M",
          fit: "standard",
          neckline: "v-neck",
        },
      }),
    );
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape, "straight");
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType, "pullover");

    syncCustomBuildToPatternStorage({ awaitCharts: false });

    expect(getCurrentPattern().style?.neckline).toBe("v");
    expect(getPatternData().style?.neckline).toBe("v");
  });

  it("preserves express patternMode when canonical storage is express (review handoff)", () => {
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({
        values: {
          who: "women",
          selectedSize: "M",
          fit: "standard",
          neckline: "round",
          style: "straight-pullover",
        },
        availableNeedles: "100",
      }),
    );
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape, "straight");
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType, "pullover");

    saveCurrentPattern({
      style: {
        patternMode: "express",
        bodyShape: "straight",
        frontStyle: "closed",
        garmentStyle: "pullover",
        recipientCategory: "misses",
      },
    });
    savePatternData("style", { patternMode: "express" });
    savePatternData("yarnGaugeMachine", {
      availableNeedles: "100",
      gaugeStitchesPerInch: "5",
      gaugeRowsPerInch: "7",
    });

    syncCustomBuildToPatternStorage({ awaitCharts: false });

    expect(getCurrentPattern().style?.patternMode).toBe("express");
    expect(getPatternData().style?.patternMode).toBe("express");
    expect(getPatternData().yarnGaugeMachine?.availableNeedles).toBe("100");
  });
});
