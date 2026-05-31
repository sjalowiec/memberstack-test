import { beforeEach, describe, expect, it } from "vitest";
import { CUSTOM_BUILD_STYLE_STORAGE_KEYS } from "./sleevelessCustomBuildStyleKeys";
import {
  applyCustomBuildBodyShapeToExpressValues,
  persistCustomBuildBodyShapeSelection,
} from "./persistCustomBuildBodyShapeSelection";
import {
  getCurrentPattern,
  getPatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";

describe("persistCustomBuildBodyShapeSelection", () => {
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

  it("writes aline to localStorage, patternBuilderData, and express builder", () => {
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({ values: { who: "women", shape: "straight", style: "straight-pullover" } }),
    );

    persistCustomBuildBodyShapeSelection("aline", { label: "test", runFullSync: false });

    expect(localStorage.getItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape)).toBe("aline");
    expect(getPatternData().style?.bodyShape).toBe("aline");
    expect(getCurrentPattern().style?.bodyShape).toBe("aline");

    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    const parsed = JSON.parse(raw ?? "{}") as { values?: Record<string, string> };
    expect(parsed.values?.shape).toBe("aline");
    expect(parsed.values?.style).toBe("shaped-pullover");
  });

  it("applyCustomBuildBodyShapeToExpressValues preserves aline when style step is set", () => {
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.bodyShape, "aline");
    const v: Record<string, string> = {};
    applyCustomBuildBodyShapeToExpressValues(v);
    expect(v.shape).toBe("aline");
    expect(v.style).toBe("shaped-pullover");
  });
});
