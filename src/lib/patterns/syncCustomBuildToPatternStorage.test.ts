import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOM_BUILD_STYLE_STORAGE_KEYS,
  readCustomBuildExpressValues,
  syncCustomBuildToPatternStorage,
} from "./syncCustomBuildToPatternStorage";
import {
  getCurrentPattern,
  getPatternData,
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
});
