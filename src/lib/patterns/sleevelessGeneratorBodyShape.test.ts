import { beforeEach, describe, expect, it } from "vitest";
import {
  deriveExpressStyleKeyFromShapeFront,
  resolveExpressGarmentStyleKey,
  resolveGeneratorBodyShape,
} from "./sleevelessGeneratorBodyShape";
import { CUSTOM_BUILD_STYLE_STORAGE_KEYS } from "./sleevelessCustomBuildStyleKeys";
import { SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";

describe("resolveGeneratorBodyShape", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    globalThis.localStorage = {
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
      key: () => null,
      length: 0,
    } as Storage;
  });

  it("prefers express shaped-pullover over straight canonical, PB, and style-step storage", () => {
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({ values: { style: "shaped-pullover" } }),
    );
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape, "straight");

    expect(
      resolveGeneratorBodyShape({ bodyShape: "straight" }, { bodyShape: "straight" }),
    ).toBe("aline");
  });

  it("derives shaped-pullover from values.shape aline when values.style is missing", () => {
    expect(deriveExpressStyleKeyFromShapeFront("aline", "closed")).toBe("shaped-pullover");
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({
        values: { shape: "aline", front: "closed" },
        cbMeasurementOverrides: { chestBust: "36", hip: "40" },
      }),
    );
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape, "straight");

    expect(resolveGeneratorBodyShape({ bodyShape: "straight" }, { bodyShape: "straight" })).toBe(
      "aline",
    );
    expect(resolveExpressGarmentStyleKey({ shape: "aline", front: "closed" })).toBe(
      "shaped-pullover",
    );
  });

  it("prefers style-step aline over stale straight in canonical storage", () => {
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape, "aline");

    expect(resolveGeneratorBodyShape({ bodyShape: "straight" }, { bodyShape: "straight" })).toBe(
      "aline",
    );
  });

  it("does not infer straight from bust/hip overrides alone", () => {
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({
        values: { style: "shaped-pullover" },
        cbMeasurementOverrides: { chestBust: "36", hip: "40" },
      }),
    );
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape, "straight");

    expect(resolveGeneratorBodyShape({}, {})).toBe("aline");
  });
});
